// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {CompleterSet} from "../access/CompleterSet.sol";

import {ICompletionHook} from "../interfaces/ICompletionHook.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

/// @title VaelHero
/// @notice A soul-bound hero that levels only from verified proofs.
///
/// @dev Every point of XP on every hero traces to one `replayKey`: a log in a source transaction
/// that the Attestcoin block prover verified on Creditcoin. `grantXP` is unreachable except through
/// `onQuestCompleted`, and that is callable only by QuestASC. There is no owner function that
/// grants XP, and adding one would make the leaderboard meaningless.
///
/// Soul-bound because a hero is a record of what an address did. A transferable one would be a
/// tradeable claim about someone else's history.
///
/// **This is v2, and it is not the deployed contract.** Two things changed: the streak multiplier
/// is now spent rather than merely recorded, and a one-time import can carry v1's heroes across.
/// A hero cannot be migrated by its owner, because it is soul-bound and holds state no ERC-721
/// interface exposes, so the import is the only way a redeploy does not erase everybody's history.
/// See `docs/ADDRESSES.md` for the deployment this ships in.
contract VaelHero is ERC721, Ownable, CompleterSet, ICompletionHook {
    struct Hero {
        uint32 level;
        uint64 xp;
        uint16 strength;
        uint16 agility;
        uint16 intellect;
        /// @dev Four equipment slots, reserved for the loot module.
        uint16[4] equipment;
        /// @dev Source block of the most recent action, for the streak window.
        uint64 lastActionSourceBlock;
        uint16 streak;
    }

    /// @notice Base XP per action type, indexed by `VaelTypes.ActionType`.
    /// @dev Rising with how much work the action takes: a portal check-in is one call, an Aave
    /// borrow needs collateral already supplied.
    uint64 internal constant XP_PORTAL = 50;
    uint64 internal constant XP_ERC20_TRANSFER = 60;
    uint64 internal constant XP_UNISWAP_SWAP = 100;
    uint64 internal constant XP_AAVE_SUPPLY = 120;
    uint64 internal constant XP_AAVE_BORROW = 150;
    /// @dev Creditcoin-native actions. Worth less than the same action proved across a chain
    /// boundary, deliberately: a native quest is one transaction and no wait, and the cross-chain
    /// proof is the thing this project exists to make possible. Paying more for the easier path
    /// would say the opposite.
    uint64 internal constant XP_PENGUINSWAP_SWAP = 70;
    uint64 internal constant XP_WRAP_NATIVE = 40;

    /// @notice Sepolia blocks within which a further action continues a streak.
    /// @dev 7200 blocks is roughly a day at 12 second blocks.
    uint64 public constant STREAK_WINDOW_BLOCKS = 7200;

    /// @notice Streak beyond which the XP multiplier stops growing.
    /// @dev The multiplier is 1 + 0.1 per streak, so a streak of 10 is x2 and anything above it is
    /// still x2. Uncapped, a player who never missed a day would out-earn everyone by an amount
    /// that has nothing to do with what they did that day.
    uint16 public constant MAX_STREAK_BONUS = 10;


    mapping(address player => uint256 tokenId) public heroOf;
    mapping(uint256 tokenId => Hero) private _heroes;

    uint256 private _nextTokenId = 1;

    /// @notice Whether the one-time v1 import is still open.
    /// @dev Closed by the owner immediately after migrating, and it cannot be reopened. While it
    /// is open the owner can write hero state directly, which is exactly the privilege the rest of
    /// this contract exists to deny, so the window has to be short and its closing has to be final.
    bool public importClosed;

    /// @notice How many heroes the import carried across.
    uint256 public importedCount;

    event HeroMinted(address indexed player, uint256 indexed tokenId);
    event HeroXPGranted(
        address indexed player,
        uint256 indexed tokenId,
        uint8 actionType,
        uint8 tier,
        uint64 xpGained,
        bytes32 replayKey
    );
    event HeroLeveled(address indexed player, uint256 indexed tokenId, uint32 newLevel);
    event QuestASCUpdated(address indexed questASC);
    event HeroImported(address indexed player, uint256 indexed tokenId, uint32 level, uint64 xp);
    event ImportClosed(uint256 heroesImported);

    error VaelHero__OnlyQuestASC(address caller);
    error VaelHero__QuestASCAlreadySet(address current);
    error VaelHero__InvalidQuestASC();
    error VaelHero__AlreadyHasHero(address player);
    error VaelHero__SoulBound();
    error VaelHero__NoHero(address player);
    error VaelHero__ImportClosed();
    error VaelHero__TokenTaken(uint256 tokenId);
    error VaelHero__LengthMismatch();

    constructor(address owner_) ERC721("Vael Hero", "VHERO") Ownable(owner_) {}

    // ---------------------------------------------------------------- admin


    // ---------------------------------------------------------------- minting

    /// @notice Mint your hero. Free, one per wallet.
    function mintHero() external returns (uint256 tokenId) {
        if (heroOf[msg.sender] != 0) revert VaelHero__AlreadyHasHero(msg.sender);
        tokenId = _nextTokenId++;
        heroOf[msg.sender] = tokenId;

        Hero storage hero = _heroes[tokenId];
        hero.level = 1;
        hero.streak = 0;

        _safeMint(msg.sender, tokenId);
        emit HeroMinted(msg.sender, tokenId);
    }

    // ---------------------------------------------------------------- migration

    /// @notice Carry one v1 hero across, keeping its token id.
    /// @dev Only while the import is open, only for a token id and a player that are both free,
    /// and never for a hero this contract already has. Keeping the token id means a badge, a
    /// screenshot, or an explorer link from v1 still points at the same hero.
    function importHero(address player, uint256 tokenId, Hero calldata data) public onlyOwner {
        if (importClosed) revert VaelHero__ImportClosed();
        if (player == address(0)) revert VaelHero__NoHero(player);
        if (tokenId == 0 || _ownerOf(tokenId) != address(0)) revert VaelHero__TokenTaken(tokenId);
        if (heroOf[player] != 0) revert VaelHero__AlreadyHasHero(player);

        heroOf[player] = tokenId;
        _heroes[tokenId] = data;
        if (tokenId >= _nextTokenId) _nextTokenId = tokenId + 1;
        importedCount += 1;

        _safeMint(player, tokenId);
        emit HeroImported(player, tokenId, data.level, data.xp);
    }

    /// @notice Carry a batch across.
    function importHeroes(address[] calldata players, uint256[] calldata tokenIds, Hero[] calldata data)
        external
        onlyOwner
    {
        if (players.length != tokenIds.length || players.length != data.length) {
            revert VaelHero__LengthMismatch();
        }
        for (uint256 i = 0; i < players.length; i++) {
            importHero(players[i], tokenIds[i], data[i]);
        }
    }

    /// @notice Shut the import for good.
    function closeImport() external onlyOwner {
        importClosed = true;
        emit ImportClosed(importedCount);
    }

    // ---------------------------------------------------------------- the hook

    /// @inheritdoc ICompletionHook
    /// @dev A player without a hero simply gains nothing. Reverting would make QuestASC log a
    /// `HookFailed` for an ordinary situation, and worse, would tempt someone to make the reward
    /// depend on having minted first.
    function onQuestCompleted(
        uint64,
        uint256,
        address player,
        uint8 actionType,
        address,
        uint256,
        uint8 tier,
        uint64 sourceBlock,
        bytes32 replayKey
    ) external {
        // Both completion paths reach here: QuestASC for an Attestcoin-verified quest and
        // NativePortal for a synchronous Creditcoin one. Neither is trusted for what it says,
        // only for having already established it; see CompleterSet.
        if (!completers[msg.sender]) revert VaelHero__OnlyQuestASC(msg.sender);

        uint256 tokenId = heroOf[player];
        if (tokenId == 0) return;

        _grantXP(player, tokenId, actionType, tier, replayKey, sourceBlock);
    }

    function _grantXP(
        address player,
        uint256 tokenId,
        uint8 actionType,
        uint8 tier,
        bytes32 replayKey,
        uint64 sourceBlock
    ) private {
        Hero storage hero = _heroes[tokenId];

        // The streak is settled before the XP is worked out, so this action is paid at the streak
        // it just extended rather than at yesterday's. A further action inside the window
        // continues it; anything later starts again at 1.
        if (sourceBlock != 0) {
            if (
                hero.lastActionSourceBlock != 0 &&
                sourceBlock > hero.lastActionSourceBlock &&
                sourceBlock - hero.lastActionSourceBlock <= STREAK_WINDOW_BLOCKS
            ) {
                hero.streak += 1;
            } else {
                hero.streak = 1;
            }
            hero.lastActionSourceBlock = sourceBlock;
        }

        uint64 gained = xpFor(actionType, tier, hero.streak);
        hero.xp += gained;
        _applyAffinity(hero, actionType);

        emit HeroXPGranted(player, tokenId, actionType, tier, gained, replayKey);

        // Several levels can arrive from one large action, so this loops rather than adding one.
        while (hero.xp >= xpToNext(hero.level)) {
            hero.xp -= xpToNext(hero.level);
            hero.level += 1;
            emit HeroLeveled(player, tokenId, hero.level);
        }
    }

    // ---------------------------------------------------------------- formulas

    /// @notice XP needed to leave a level.
    function xpToNext(uint32 level) public pure returns (uint64) {
        return 100 + 50 * uint64(level);
    }

    /// @notice The streak multiplier in basis points: 1 + 0.1 per streak, capped at x2.
    /// @dev The rule is `1 + 0.1 * streak`, so a streak of 1,
    /// the first action after a gap, is already worth x1.1 and a streak of 10 is worth x2.
    function streakMultiplierBps(uint16 streak) public pure returns (uint256) {
        uint256 steps = streak > MAX_STREAK_BONUS ? MAX_STREAK_BONUS : streak;
        return 10_000 + steps * 1_000;
    }

    /// @notice Base XP for an action, scaled by tier: x1, x1.5, x2.
    /// @dev The 1.5 is done as `* 3 / 2` so tier 2 on an odd base rounds down rather than needing
    /// a fixed-point type for a number this small.
    function xpFor(uint8 actionType, uint8 tier) public pure returns (uint64) {
        return _xpFor(actionType, tier);
    }

    /// @notice XP for an action at a given streak.
    function xpFor(uint8 actionType, uint8 tier, uint16 streak) public pure returns (uint64) {
        return uint64((uint256(_xpFor(actionType, tier)) * streakMultiplierBps(streak)) / 10_000);
    }

    function _xpFor(uint8 actionType, uint8 tier) private pure returns (uint64) {
        uint64 base = _baseXP(actionType);
        if (tier >= 3) return base * 2;
        if (tier == 2) return (base * 3) / 2;
        return base;
    }

    /// @dev Every action type is named. The default is zero rather than the largest value: an
    /// action this table has not been taught about should be worth nothing until somebody decides
    /// what it is worth, not silently worth the most. A trailing `else` handed the two Creditcoin
    /// actions the Aave borrow rate the moment the enum grew, which is exactly that mistake.
    function _baseXP(uint8 actionType) private pure returns (uint64) {
        VaelTypes.ActionType action = VaelTypes.ActionType(actionType);
        if (action == VaelTypes.ActionType.Portal) return XP_PORTAL;
        if (action == VaelTypes.ActionType.Erc20Transfer) return XP_ERC20_TRANSFER;
        if (action == VaelTypes.ActionType.UniswapSwap) return XP_UNISWAP_SWAP;
        if (action == VaelTypes.ActionType.AaveSupply) return XP_AAVE_SUPPLY;
        if (action == VaelTypes.ActionType.AaveBorrow) return XP_AAVE_BORROW;
        if (action == VaelTypes.ActionType.PenguinSwapSwap) return XP_PENGUINSWAP_SWAP;
        if (action == VaelTypes.ActionType.WrapNative) return XP_WRAP_NATIVE;
        return 0;
    }

    /// @dev One point to the stat the action exercises. Portal check-ins, transfers and wrapping
    /// are direct value movement, so strength; a swap is timing, so agility, on either chain;
    /// lending is planning, so intellect.
    function _applyAffinity(Hero storage hero, uint8 actionType) private {
        VaelTypes.ActionType action = VaelTypes.ActionType(actionType);
        if (
            action == VaelTypes.ActionType.Portal || action == VaelTypes.ActionType.Erc20Transfer
                || action == VaelTypes.ActionType.WrapNative
        ) {
            hero.strength += 1;
        } else if (
            action == VaelTypes.ActionType.UniswapSwap || action == VaelTypes.ActionType.PenguinSwapSwap
        ) {
            hero.agility += 1;
        } else {
            hero.intellect += 1;
        }
    }

    // ---------------------------------------------------------------- views

    function heroById(uint256 tokenId) external view returns (Hero memory) {
        return _heroes[tokenId];
    }

    function heroByAddress(address player) external view returns (Hero memory) {
        uint256 tokenId = heroOf[player];
        if (tokenId == 0) revert VaelHero__NoHero(player);
        return _heroes[tokenId];
    }

    /// @notice Hero level, or 0 when the player has not minted. Read by RaidBoss.
    function levelOf(address player) external view returns (uint32) {
        uint256 tokenId = heroOf[player];
        if (tokenId == 0) return 0;
        return _heroes[tokenId].level;
    }

    function hasHero(address player) external view returns (bool) {
        return heroOf[player] != 0;
    }

    // ---------------------------------------------------------------- soul-bound

    /// @dev Mint and burn only. A hero records what one address did, so it cannot change hands.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert VaelHero__SoulBound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert VaelHero__SoulBound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert VaelHero__SoulBound();
    }
}
