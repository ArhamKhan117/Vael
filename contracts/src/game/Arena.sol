// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IArenaRewards} from "../interfaces/IArenaRewards.sol";
import {IEquipment} from "../interfaces/IEquipment.sol";

interface IVaelHeroStats {
    struct Hero {
        uint32 level;
        uint64 xp;
        uint16 strength;
        uint16 agility;
        uint16 intellect;
        uint16[4] equipment;
        uint64 lastActionSourceBlock;
        uint16 streak;
    }

    function heroOf(address player) external view returns (uint256);
    function heroById(uint256 tokenId) external view returns (Hero memory);
}

interface IBurnableToken is IERC20 {
    function burn(uint256 amount) external;
}

/// @title Arena
/// @notice Player versus player duels fought with stats that were earned, not bought.
///
/// @dev Standalone. Arena touches no core contract and no core contract knows it exists: it reads
/// VaelHero, escrows VAEL, and settles. Nothing here can mint XP, deal raid damage, or complete a
/// quest, so adding it costs no redeploy and carries no new trust.
///
/// The whole point rests on where the stats come from. Strength, agility, and intellect only ever
/// rise through `VaelHero.grantXP`, which is callable only by QuestASC after it verifies an
/// Attestcoin proof. So an arena win is downstream of real DeFi actions on Ethereum, and cannot be
/// bought with a faster script or a funded wallet.
///
/// **Resolution is deterministic and public.** Anyone may call `resolve`; the outcome is a pure
/// function of the two heroes' stats and one seed, and the full round log is emitted so a client
/// can replay the fight exactly. Nobody, including the owner, can change a result.
///
/// **The seed is committed at acceptance, not chosen at resolution.** `accept` fixes
/// `seedBlock = block.number + 2`, a block whose hash nobody knows yet, and `resolve` uses
/// `blockhash(seedBlock)`. There is therefore exactly one seed per duel and no resolver can shop
/// for a better one by waiting: calling in a different block produces the same fight.
///
/// Resolution is bounded because `blockhash` only reaches back 256 blocks. A duel must be resolved
/// after `seedBlock` and within `RESOLVE_WINDOW_BLOCKS` of it, and one that is not can be voided by
/// either player with both stakes returned. Nobody's money is trapped by a seed that has aged out.
///
/// A validator producing `seedBlock` could still influence its own hash, which is the residual any
/// blockhash scheme carries; removing it needs a VRF. What is gone is the part a player could
/// exploit: choosing when to call.
contract Arena is Ownable {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Open,
        Accepted,
        Resolved,
        Expired,
        Cancelled,
        Voided
    }

    struct Challenge {
        address challenger;
        address opponent;
        uint256 stake;
        uint64 openedAtBlock;
        uint64 acceptedAtBlock;
        /// @dev The block whose hash seeds the fight, fixed at acceptance and unknown then.
        uint64 seedBlock;
        Status status;
        address winner;
    }

    /// @notice Rounds a duel can run before it is called a draw.
    uint256 public constant MAX_ROUNDS = 20;

    /// @notice Creditcoin blocks an unanswered challenge stays open.
    /// @dev 7200 blocks, roughly a day at this chain's cadence. After it, the challenger takes
    /// their stake back and the challenge is closed for good.
    uint64 public constant EXPIRY_BLOCKS = 7200;

    /// @notice Blocks after acceptance whose hash seeds the duel.
    /// @dev Two rather than one: the hash of the next block is already being decided when accept
    /// lands, so it is the first one nobody can have seen.
    uint64 public constant SEED_DELAY_BLOCKS = 2;

    /// @notice Blocks after `seedBlock` within which a duel must be resolved.
    /// @dev `blockhash` reaches back 256 blocks, so 250 leaves margin for the transaction to land.
    /// Past it the seed is unreadable and the duel is voidable instead.
    uint64 public constant RESOLVE_WINDOW_BLOCKS = 250;

    /// @notice Basis points of the pot burned on a decisive result.
    uint256 public constant BURN_BPS = 200;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    IBurnableToken public immutable STAKE_TOKEN;
    IVaelHeroStats public immutable HERO;

    /// @notice Equipment bonuses, optional.
    /// @dev Settable rather than immutable because Arena is deployed before the loot module exists.
    /// While unset, duels are fought on base stats alone, which is a coherent state rather than a
    /// broken one.
    IEquipment public equipment;

    /// @notice Loot minted to a winner, optional.
    /// @dev Also settable, and called inside try/catch: a broken loot contract must never be able
    /// to trap two players' stakes.
    IArenaRewards public rewards;

    uint256 public nextChallengeId = 1;
    mapping(uint256 challengeId => Challenge) public challenges;

    /// @notice VAEL currently escrowed across all live challenges.
    /// @dev Tracked so a stray transfer into this contract can never be mistaken for stake.
    uint256 public escrowed;

    event EquipmentUpdated(address indexed equipment);
    event RewardsUpdated(address indexed rewards);
    event ArenaChallenged(
        uint256 indexed challengeId, address indexed challenger, address indexed opponent, uint256 stake
    );
    event ArenaAccepted(
        uint256 indexed challengeId, address indexed opponent, uint64 acceptedAtBlock, uint64 seedBlock
    );
    event ArenaVoided(uint256 indexed challengeId, address indexed challenger, address indexed opponent, uint256 refund);
    event ArenaCancelled(uint256 indexed challengeId, address indexed challenger, uint256 refund);
    event ArenaExpired(uint256 indexed challengeId, address indexed challenger, uint256 refund);
    /// @dev `rounds` is the compact log a client replays: one byte per half-round, see `_encode`.
    event ArenaResolved(
        uint256 indexed challengeId,
        address indexed winner,
        address indexed loser,
        uint256 payout,
        uint256 burned,
        bytes32 seed,
        bytes rounds
    );
    event ArenaDrawn(uint256 indexed challengeId, address challengerRefund, address opponentRefund, bytes32 seed, bytes rounds);
    event ArenaRewardFailed(uint256 indexed challengeId, address indexed winner);

    error Arena__ZeroAddress();
    error Arena__SelfChallenge();
    error Arena__ZeroStake();
    error Arena__NoHero(address player);
    error Arena__UnknownChallenge(uint256 challengeId);
    error Arena__WrongStatus(uint256 challengeId, Status expected, Status actual);
    error Arena__NotOpponent(address caller);
    error Arena__NotChallenger(address caller);
    error Arena__NotExpiredYet(uint256 challengeId, uint64 expiresAtBlock);
    error Arena__Expired(uint256 challengeId);
    error Arena__TooSoon(uint256 challengeId);
    error Arena__SeedWindowClosed(uint256 challengeId, uint64 seedBlock, uint64 closedAtBlock);
    error Arena__StillResolvable(uint256 challengeId, uint64 closesAtBlock);
    error Arena__NotAParticipant(address caller);

    constructor(address owner_, address stakeToken, address hero) Ownable(owner_) {
        if (stakeToken == address(0) || hero == address(0)) revert Arena__ZeroAddress();
        STAKE_TOKEN = IBurnableToken(stakeToken);
        HERO = IVaelHeroStats(hero);
    }

    function setEquipment(address equipment_) external onlyOwner {
        equipment = IEquipment(equipment_);
        emit EquipmentUpdated(equipment_);
    }

    function setRewards(address rewards_) external onlyOwner {
        rewards = IArenaRewards(rewards_);
        emit RewardsUpdated(rewards_);
    }

    /// @notice Open a challenge against a named opponent and escrow the stake.
    /// @dev The stake moves now, not at resolution: a challenge nobody can pay for is not a
    /// challenge, and the opponent should not discover that after accepting.
    function challenge(address opponent, uint256 stake) external returns (uint256 challengeId) {
        if (opponent == address(0)) revert Arena__ZeroAddress();
        if (opponent == msg.sender) revert Arena__SelfChallenge();
        if (stake == 0) revert Arena__ZeroStake();
        _requireHero(msg.sender);
        _requireHero(opponent);

        challengeId = nextChallengeId;
        nextChallengeId += 1;

        challenges[challengeId] = Challenge({
            challenger: msg.sender,
            opponent: opponent,
            stake: stake,
            openedAtBlock: uint64(block.number),
            acceptedAtBlock: 0,
            seedBlock: 0,
            status: Status.Open,
            winner: address(0)
        });

        escrowed += stake;
        IERC20(address(STAKE_TOKEN)).safeTransferFrom(msg.sender, address(this), stake);

        emit ArenaChallenged(challengeId, msg.sender, opponent, stake);
    }

    /// @notice Match the stake and lock the duel in.
    function accept(uint256 challengeId) external {
        Challenge storage duel = _open(challengeId);
        if (msg.sender != duel.opponent) revert Arena__NotOpponent(msg.sender);
        if (block.number > duel.openedAtBlock + EXPIRY_BLOCKS) revert Arena__Expired(challengeId);
        _requireHero(msg.sender);

        duel.status = Status.Accepted;
        duel.acceptedAtBlock = uint64(block.number);
        // Committed here and never rewritten. Whoever calls resolve, and whenever they call it
        // inside the window, gets this seed.
        duel.seedBlock = uint64(block.number) + SEED_DELAY_BLOCKS;

        escrowed += duel.stake;
        IERC20(address(STAKE_TOKEN)).safeTransferFrom(msg.sender, address(this), duel.stake);

        emit ArenaAccepted(challengeId, msg.sender, uint64(block.number), duel.seedBlock);
    }

    /// @notice Withdraw an unanswered challenge.
    function cancel(uint256 challengeId) external {
        Challenge storage duel = _open(challengeId);
        if (msg.sender != duel.challenger) revert Arena__NotChallenger(msg.sender);

        duel.status = Status.Cancelled;
        uint256 refund = duel.stake;
        escrowed -= refund;
        IERC20(address(STAKE_TOKEN)).safeTransfer(duel.challenger, refund);

        emit ArenaCancelled(challengeId, duel.challenger, refund);
    }

    /// @notice Refund a challenge the opponent never answered.
    /// @dev Callable by anyone, so a challenger's stake is not stranded by their own inactivity.
    function expire(uint256 challengeId) external {
        Challenge storage duel = _open(challengeId);
        uint64 expiresAt = duel.openedAtBlock + EXPIRY_BLOCKS;
        if (block.number <= expiresAt) revert Arena__NotExpiredYet(challengeId, expiresAt);

        duel.status = Status.Expired;
        uint256 refund = duel.stake;
        escrowed -= refund;
        IERC20(address(STAKE_TOKEN)).safeTransfer(duel.challenger, refund);

        emit ArenaExpired(challengeId, duel.challenger, refund);
    }

    /// @notice Fight the duel and pay out. Callable by anyone once accepted.
    function resolve(uint256 challengeId) external {
        Challenge storage duel = challenges[challengeId];
        if (duel.status == Status.None) revert Arena__UnknownChallenge(challengeId);
        if (duel.status != Status.Accepted) {
            revert Arena__WrongStatus(challengeId, Status.Accepted, duel.status);
        }
        // The seed block must have been produced, and its hash must still be readable.
        if (block.number <= duel.seedBlock) revert Arena__TooSoon(challengeId);
        uint64 closesAt = duel.seedBlock + RESOLVE_WINDOW_BLOCKS;
        if (block.number > closesAt) {
            revert Arena__SeedWindowClosed(challengeId, duel.seedBlock, closesAt);
        }

        bytes32 seed = keccak256(abi.encodePacked(blockhash(duel.seedBlock), challengeId));
        (address winner, bytes memory rounds) = _fight(duel.challenger, duel.opponent, seed);

        duel.status = Status.Resolved;
        duel.winner = winner;

        uint256 pot = duel.stake * 2;
        escrowed -= pot;

        if (winner == address(0)) {
            IERC20(address(STAKE_TOKEN)).safeTransfer(duel.challenger, duel.stake);
            IERC20(address(STAKE_TOKEN)).safeTransfer(duel.opponent, duel.stake);
            emit ArenaDrawn(challengeId, duel.challenger, duel.opponent, seed, rounds);
            return;
        }

        uint256 burned = (pot * BURN_BPS) / BPS_DENOMINATOR;
        uint256 payout = pot - burned;
        address loser = winner == duel.challenger ? duel.opponent : duel.challenger;

        if (burned > 0) STAKE_TOKEN.burn(burned);
        IERC20(address(STAKE_TOKEN)).safeTransfer(winner, payout);

        if (address(rewards) != address(0)) {
            // A loot contract that reverts must not be able to trap the pot, which has already
            // been paid out above.
            try rewards.mintArenaReward(winner, uint256(seed)) returns (uint256) {}
            catch {
                emit ArenaRewardFailed(challengeId, winner);
            }
        }

        emit ArenaResolved(challengeId, winner, loser, payout, burned, seed, rounds);
    }

    /// @notice Return both stakes on a duel whose seed has aged out of reach.
    /// @dev Either player can call it, and only after the resolution window has closed. `blockhash`
    /// no longer answers for `seedBlock` by then, so there is no fight left to have; the honest
    /// outcome is that neither side wins and neither side loses their stake. Nothing is burned.
    function voidDuel(uint256 challengeId) external {
        Challenge storage duel = challenges[challengeId];
        if (duel.status == Status.None) revert Arena__UnknownChallenge(challengeId);
        if (duel.status != Status.Accepted) {
            revert Arena__WrongStatus(challengeId, Status.Accepted, duel.status);
        }
        if (msg.sender != duel.challenger && msg.sender != duel.opponent) {
            revert Arena__NotAParticipant(msg.sender);
        }

        uint64 closesAt = duel.seedBlock + RESOLVE_WINDOW_BLOCKS;
        if (block.number <= closesAt) revert Arena__StillResolvable(challengeId, closesAt);

        duel.status = Status.Voided;

        uint256 stake = duel.stake;
        escrowed -= stake * 2;
        IERC20(address(STAKE_TOKEN)).safeTransfer(duel.challenger, stake);
        IERC20(address(STAKE_TOKEN)).safeTransfer(duel.opponent, stake);

        emit ArenaVoided(challengeId, duel.challenger, duel.opponent, stake);
    }

    /// @notice The seed a duel will be fought with, or zero while it cannot be known.
    /// @dev Zero before the seed block is produced and zero again once its hash has aged out, which
    /// are the two states in which `resolve` refuses. A client can show the fight before paying gas
    /// for it by passing this to `preview`.
    function seedOf(uint256 challengeId) external view returns (bytes32) {
        Challenge storage duel = challenges[challengeId];
        if (duel.status != Status.Accepted) return bytes32(0);
        if (block.number <= duel.seedBlock) return bytes32(0);
        if (block.number > duel.seedBlock + RESOLVE_WINDOW_BLOCKS) return bytes32(0);
        return keccak256(abi.encodePacked(blockhash(duel.seedBlock), challengeId));
    }

    /// @notice Simulate a duel without touching state, for a UI preview.
    function preview(address challenger, address opponent, bytes32 seed)
        external
        view
        returns (address winner, bytes memory rounds)
    {
        return _fight(challenger, opponent, seed);
    }

    /// @notice The stats a fighter enters with, base plus equipment.
    function statsOf(address player)
        public
        view
        returns (uint32 level, uint16 strength, uint16 agility, uint16 intellect)
    {
        uint256 tokenId = HERO.heroOf(player);
        if (tokenId == 0) revert Arena__NoHero(player);

        IVaelHeroStats.Hero memory hero = HERO.heroById(tokenId);
        level = hero.level;
        strength = hero.strength;
        agility = hero.agility;
        intellect = hero.intellect;

        if (address(equipment) != address(0)) {
            // Bonuses are additive and read live, so unequipping between accept and resolve
            // changes the fight. That is deliberate: the fight is fought with what you hold.
            (uint16 bs, uint16 ba, uint16 bi) = equipment.bonusesOf(tokenId);
            strength += bs;
            agility += ba;
            intellect += bi;
        }
    }

    /// @notice Starting hit points for a set of stats.
    function hitPoints(uint32 level, uint16 intellect) public pure returns (uint256) {
        return 100 + 10 * uint256(level) + 3 * uint256(intellect);
    }

    /**
     * @notice Damage one hit lands before a critical is applied.
     *
     * @dev Level is in here, and it has to be. Without it a new hero had 110 hit points and dealt
     * two damage a swing, so twenty rounds of forty swings came to eighty: two new players could
     * not finish a duel however the seed fell, and every duel between them was a guaranteed draw.
     * That is not a rare outcome, it is arithmetic, and it made the arena unusable for exactly the
     * people most likely to try it first.
     *
     * The two now grow together. Hit points are `100 + 10L + 3I` and damage is `2 + 2L + 2S + A`,
     * so a level-1 duel lands around round ten and a level-7 duel around round three. A draw is
     * still reachable, but it now takes a hero tanky enough to outlast forty swings rather than an
     * opponent too weak to land one.
     */
    function baseDamage(uint32 level, uint16 strength, uint16 agility) public pure returns (uint256) {
        return 2 + 2 * uint256(level) + 2 * uint256(strength) + uint256(agility);
    }

    /// @dev The duel itself. Pure with respect to the chain apart from reading hero stats, so
    /// `preview` and `resolve` cannot disagree about who wins.
    ///
    /// The faster fighter swings first, ties going to the challenger, which is the only place
    /// agility decides something other than damage. Each swing draws its own roll from the root
    /// seed: `keccak256(seed, round, slot)`. §4.1 gives one seed and one crit rule, and a single
    /// roll reused for twenty rounds would make every swing in a duel crit or none of them, which
    /// is not a fight.
    function _fight(address challenger, address opponent, bytes32 seed)
        internal
        view
        returns (address winner, bytes memory rounds)
    {
        (uint32 cLevel, uint16 cStr, uint16 cAgi, uint16 cInt) = statsOf(challenger);
        (uint32 oLevel, uint16 oStr, uint16 oAgi, uint16 oInt) = statsOf(opponent);

        uint256[2] memory hp = [hitPoints(cLevel, cInt), hitPoints(oLevel, oInt)];
        uint256[2] memory dmg = [baseDamage(cLevel, cStr, cAgi), baseDamage(oLevel, oStr, oAgi)];
        uint16[2] memory agi = [cAgi, oAgi];

        // Slot 0 is the challenger, slot 1 the opponent. `first` is whichever swings first.
        uint256 first = oAgi > cAgi ? 1 : 0;

        bytes memory log = new bytes(MAX_ROUNDS * 2 * 3);
        uint256 written = 0;

        for (uint256 round = 0; round < MAX_ROUNDS; round++) {
            for (uint256 turn = 0; turn < 2; turn++) {
                uint256 attacker = turn == 0 ? first : 1 - first;
                uint256 defender = 1 - attacker;

                uint256 roll =
                    uint256(keccak256(abi.encodePacked(seed, round, attacker))) % 100;
                bool crit = roll < agi[attacker];
                uint256 hit = crit ? dmg[attacker] * 2 : dmg[attacker];

                hp[defender] = hit >= hp[defender] ? 0 : hp[defender] - hit;

                written = _encode(log, written, attacker, hit, crit);

                if (hp[defender] == 0) {
                    assembly {
                        mstore(log, written)
                    }
                    return (attacker == 0 ? challenger : opponent, log);
                }
            }
        }

        assembly {
            mstore(log, written)
        }
        return (address(0), log);
    }

    /// @dev Three bytes per swing: attacker slot with the crit flag in bit 1, then damage as a
    /// big-endian uint16. Damage above 65535 is clamped in the log only; the fight itself uses the
    /// real number, so a clamped entry can never change an outcome, only how it is drawn.
    function _encode(bytes memory log, uint256 offset, uint256 attacker, uint256 hit, bool crit)
        internal
        pure
        returns (uint256)
    {
        uint256 capped = hit > type(uint16).max ? type(uint16).max : hit;
        log[offset] = bytes1(uint8(attacker | (crit ? 2 : 0)));
        log[offset + 1] = bytes1(uint8(capped >> 8));
        log[offset + 2] = bytes1(uint8(capped));
        return offset + 3;
    }

    function _open(uint256 challengeId) internal view returns (Challenge storage duel) {
        duel = challenges[challengeId];
        if (duel.status == Status.None) revert Arena__UnknownChallenge(challengeId);
        if (duel.status != Status.Open) {
            revert Arena__WrongStatus(challengeId, Status.Open, duel.status);
        }
    }

    function _requireHero(address player) internal view {
        uint256 tokenId = HERO.heroOf(player);
        if (tokenId == 0) revert Arena__NoHero(player);
        if (HERO.heroById(tokenId).level == 0) revert Arena__NoHero(player);
    }
}
