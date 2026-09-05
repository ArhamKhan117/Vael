// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {CompleterSet} from "../access/CompleterSet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ICompletionHook} from "../interfaces/ICompletionHook.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

interface IVaelHeroLevels {
    function levelOf(address player) external view returns (uint32);
}

interface IBadgeMinter {
    function mintBadge(address to, uint256 questId, uint256 badgeLevel) external returns (uint256);
}

/// @title RaidBoss
/// @notice A community boss whose every point of damage came from a verified proof.
///
/// @dev The raid is the part of Vael that only works because completions are trustworthy. Damage
/// is dealt by `onQuestCompleted`, callable only by QuestASC, so nobody can grind a boss down with
/// a script: each hit is a real DeFi action on Ethereum that the block prover verified on
/// Creditcoin. Loot is then split by damage share, which is only fair if the damage is real.
contract RaidBoss is Ownable, CompleterSet, ICompletionHook {
    using SafeERC20 for IERC20;

    struct Season {
        uint256 maxHp;
        uint256 hp;
        uint64 seasonId;
        uint256 lootPool;
        address lastHitter;
        bool defeated;
        uint256 totalDamage;
    }

    /// @notice Base damage per action type.
    uint256 internal constant DMG_PORTAL = 100;
    uint256 internal constant DMG_ERC20_TRANSFER = 120;
    uint256 internal constant DMG_UNISWAP_SWAP = 200;
    uint256 internal constant DMG_AAVE_SUPPLY = 240;
    uint256 internal constant DMG_AAVE_BORROW = 300;

    /// @notice Share of the loot pool reserved for whoever lands the killing blow, in percent.
    uint256 public constant LAST_HIT_BONUS_PERCENT = 5;

    /// @notice Badge level minted to every contributor when a boss dies.
    uint256 public constant RAID_VICTORY_BADGE_LEVEL = 1;

    IERC20 public immutable LOOT_TOKEN;
    IVaelHeroLevels public immutable HERO;
    IBadgeMinter public immutable BADGE;

    uint64 public currentSeasonId;
    mapping(uint64 seasonId => Season) private _seasons;
    mapping(uint64 seasonId => mapping(address player => uint256)) public damageOf;
    mapping(uint64 seasonId => mapping(address player => bool)) public lootClaimed;

    event SeasonStarted(uint64 indexed seasonId, uint256 maxHp, uint256 lootPool);
    event RaidDamage(
        uint64 indexed seasonId,
        address indexed player,
        uint256 damage,
        uint256 hpRemaining,
        uint8 actionType,
        bytes32 replayKey
    );
    event RaidDefeated(uint64 indexed seasonId, address indexed lastHitter, uint256 totalDamage);
    event LootClaimed(uint64 indexed seasonId, address indexed player, uint256 amount, bool lastHitBonus);
    event QuestASCUpdated(address indexed questASC);

    error RaidBoss__OnlyQuestASC(address caller);
    error RaidBoss__QuestASCAlreadySet(address current);
    error RaidBoss__InvalidQuestASC();
    error RaidBoss__SeasonActive(uint64 seasonId);
    error RaidBoss__InvalidSeason();
    error RaidBoss__NotDefeated(uint64 seasonId);
    error RaidBoss__NothingToClaim(uint64 seasonId, address player);
    error RaidBoss__AlreadyClaimed(uint64 seasonId, address player);

    constructor(address owner_, IERC20 lootToken, IVaelHeroLevels hero, IBadgeMinter badge)
        Ownable(owner_)
    {
        if (address(lootToken) == address(0) || address(hero) == address(0)) {
            revert RaidBoss__InvalidSeason();
        }
        LOOT_TOKEN = lootToken;
        HERO = hero;
        BADGE = badge;
    }

    // ---------------------------------------------------------------- admin

    /// @notice Open a new season, funding the loot pool up front.
    /// @dev The pool is transferred in at the start rather than promised, so the payout a
    /// contributor is owed is always already held by this contract. The owner must approve first.
    function startSeason(uint256 maxHp, uint256 lootPoolAmount) external onlyOwner returns (uint64) {
        if (maxHp == 0) revert RaidBoss__InvalidSeason();
        Season storage running = _seasons[currentSeasonId];
        if (currentSeasonId != 0 && !running.defeated) revert RaidBoss__SeasonActive(currentSeasonId);

        currentSeasonId += 1;
        Season storage season = _seasons[currentSeasonId];
        season.seasonId = currentSeasonId;
        season.maxHp = maxHp;
        season.hp = maxHp;
        season.lootPool = lootPoolAmount;

        if (lootPoolAmount > 0) {
            LOOT_TOKEN.safeTransferFrom(msg.sender, address(this), lootPoolAmount);
        }

        emit SeasonStarted(currentSeasonId, maxHp, lootPoolAmount);
        return currentSeasonId;
    }

    // ---------------------------------------------------------------- the hook

    /// @inheritdoc ICompletionHook
    /// @dev Damage against a defeated boss, or before any season has started, is ignored rather
    /// than reverted. A quest that happens to complete between seasons must still pay its reward.
    function onQuestCompleted(
        uint64,
        uint256,
        address player,
        uint8 actionType,
        address,
        uint256,
        uint8 tier,
        uint64,
        bytes32 replayKey
    ) external {
        // Both completion paths reach here: QuestASC for an Attestcoin-verified quest and
        // NativePortal for a synchronous Creditcoin one. Neither is trusted for what it says,
        // only for having already established it; see CompleterSet.
        if (!completers[msg.sender]) revert RaidBoss__OnlyQuestASC(msg.sender);

        uint64 seasonId = currentSeasonId;
        if (seasonId == 0) return;
        Season storage season = _seasons[seasonId];
        if (season.defeated) return;

        uint256 damage = damageFor(actionType, tier, HERO.levelOf(player));
        if (damage == 0) return;

        if (damage > season.hp) damage = season.hp;
        season.hp -= damage;
        season.totalDamage += damage;
        damageOf[seasonId][player] += damage;
        season.lastHitter = player;

        emit RaidDamage(seasonId, player, damage, season.hp, actionType, replayKey);

        if (season.hp == 0) {
            season.defeated = true;
            emit RaidDefeated(seasonId, player, season.totalDamage);
        }
    }

    // ---------------------------------------------------------------- formulas

    /// @notice `base(actionType) * (10 + heroLevel) / 10 * tierMultiplier`.
    /// @dev A hero's level scales their contribution, which is what ties the two game modules
    /// together: levelling makes you matter more in the raid. Level 0 means no hero, and the
    /// multiplier is then exactly 1, so a player without a hero still contributes.
    function damageFor(uint8 actionType, uint8 tier, uint32 heroLevel) public pure returns (uint256) {
        uint256 base = _baseDamage(actionType);
        uint256 scaled = (base * (10 + uint256(heroLevel))) / 10;
        if (tier >= 3) return scaled * 2;
        if (tier == 2) return (scaled * 3) / 2;
        return scaled;
    }

    function _baseDamage(uint8 actionType) private pure returns (uint256) {
        VaelTypes.ActionType action = VaelTypes.ActionType(actionType);
        if (action == VaelTypes.ActionType.Portal) return DMG_PORTAL;
        if (action == VaelTypes.ActionType.Erc20Transfer) return DMG_ERC20_TRANSFER;
        if (action == VaelTypes.ActionType.UniswapSwap) return DMG_UNISWAP_SWAP;
        if (action == VaelTypes.ActionType.AaveSupply) return DMG_AAVE_SUPPLY;
        return DMG_AAVE_BORROW;
    }

    // ---------------------------------------------------------------- loot

    /// @notice Claim your share of a defeated season's loot, plus the badge.
    /// @dev 95% of the pool is split by damage share and 5% is reserved for the last hitter, who
    /// also takes their ordinary share. Claiming is pull-based and once per season per player.
    function claimLoot(uint64 seasonId) external returns (uint256 amount) {
        Season storage current = _seasons[seasonId];
        if (current.seasonId == 0) revert RaidBoss__InvalidSeason();
        if (!current.defeated) revert RaidBoss__NotDefeated(seasonId);
        if (lootClaimed[seasonId][msg.sender]) revert RaidBoss__AlreadyClaimed(seasonId, msg.sender);

        uint256 damage = damageOf[seasonId][msg.sender];
        if (damage == 0) revert RaidBoss__NothingToClaim(seasonId, msg.sender);

        lootClaimed[seasonId][msg.sender] = true;

        uint256 shared = (current.lootPool * (100 - LAST_HIT_BONUS_PERCENT)) / 100;
        amount = (shared * damage) / current.totalDamage;

        bool isLastHitter = current.lastHitter == msg.sender;
        if (isLastHitter) {
            amount += current.lootPool - shared;
        }

        if (amount > 0) {
            LOOT_TOKEN.safeTransfer(msg.sender, amount);
        }

        // Every contributor gets the victory badge. A failed mint must not cost them their loot,
        // so it is attempted separately from the transfer above.
        if (address(BADGE) != address(0)) {
            try BADGE.mintBadge(msg.sender, uint256(seasonId), RAID_VICTORY_BADGE_LEVEL) returns (
                uint256
            ) {
                // Minted.
            } catch {
                // The loot still moved. A badge is a keepsake, not the payout.
            }
        }

        emit LootClaimed(seasonId, msg.sender, amount, isLastHitter);
    }

    // ---------------------------------------------------------------- views

    function season(uint64 seasonId) external view returns (Season memory) {
        return _seasons[seasonId];
    }

    function currentSeason() external view returns (Season memory) {
        return _seasons[currentSeasonId];
    }

    /// @notice What a player would receive if they claimed now.
    function pendingLoot(uint64 seasonId, address player) external view returns (uint256) {
        Season storage s = _seasons[seasonId];
        if (!s.defeated || s.totalDamage == 0) return 0;
        if (lootClaimed[seasonId][player]) return 0;
        uint256 damage = damageOf[seasonId][player];
        if (damage == 0) return 0;
        uint256 shared = (s.lootPool * (100 - LAST_HIT_BONUS_PERCENT)) / 100;
        uint256 amount = (shared * damage) / s.totalDamage;
        if (s.lastHitter == player) amount += s.lootPool - shared;
        return amount;
    }
}
