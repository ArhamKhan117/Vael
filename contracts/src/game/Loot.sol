// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IArenaRewards} from "../interfaces/IArenaRewards.sol";

interface IRaidLedger {
    struct Season {
        uint256 maxHp;
        uint256 hp;
        uint64 seasonId;
        uint256 lootPool;
        address lastHitter;
        bool defeated;
        uint256 totalDamage;
    }

    function season(uint64 seasonId) external view returns (Season memory);
    function damageOf(uint64 seasonId, address player) external view returns (uint256);
}

/// @title Loot
/// @notice Items that drop from raids and duels, each carrying stat bonuses and a rarity.
///
/// @dev Standalone and pull-based. RaidBoss is read, never written, and knows nothing about this
/// contract: `claimRaidLoot` asks the boss what a season's ledger says and keeps its own record of
/// who has claimed. That is what lets loot exist without redeploying the core.
///
/// **Raid rarity is earned, not rolled.** A contributor's rarity is a pure function of their share
/// of the season's damage, so what you get is decided by what you did rather than by a die this
/// contract throws. Every point of that damage came from a verified Attestcoin proof, so the ladder
/// rests on the same footing as the rest of the game. Which item inside that rarity you receive is
/// drawn from the season's seed, because variety costs nothing and power does not change.
///
/// **Arena drops are rolled**, from a published table, because a duel has no contribution to
/// measure. The roll is derived from the seed Arena already used to fight, so a client that
/// replayed the fight can predict the drop.
contract Loot is ERC1155, Ownable, IArenaRewards {
    enum Rarity {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }

    /// @notice Equipment slots. An item belongs to exactly one.
    uint8 public constant SLOT_WEAPON = 0;
    uint8 public constant SLOT_ARMOUR = 1;
    uint8 public constant SLOT_TRINKET = 2;
    uint8 public constant SLOT_RELIC = 3;
    uint8 public constant SLOT_COUNT = 4;

    struct Item {
        string name;
        uint8 slot;
        Rarity rarity;
        uint16 strength;
        uint16 agility;
        uint16 intellect;
        bool exists;
    }

    /// @notice Damage share, in basis points, at or above which each rarity is awarded.
    /// @dev Read from the top down: a contributor lands in the first band they clear.
    uint256 public constant LEGENDARY_SHARE_BPS = 5000;
    uint256 public constant EPIC_SHARE_BPS = 2500;
    uint256 public constant RARE_SHARE_BPS = 1000;
    uint256 public constant UNCOMMON_SHARE_BPS = 250;

    /// @notice Arena drop table, cumulative out of 100.
    /// @dev Common 60, Uncommon 25, Rare 10, Epic 4, Legendary 1. Published here rather than kept
    /// in a comment so anyone can check a drop against it.
    uint256 public constant ARENA_UNCOMMON_AT = 60;
    uint256 public constant ARENA_RARE_AT = 85;
    uint256 public constant ARENA_EPIC_AT = 95;
    uint256 public constant ARENA_LEGENDARY_AT = 99;

    IRaidLedger public immutable RAID;

    /// @notice The Arena allowed to mint duel rewards.
    address public arena;

    uint256 public nextItemId = 1;
    mapping(uint256 itemId => Item) public items;
    mapping(uint256 itemId => string) private _itemUris;
    /// @notice Item ids available at each rarity, for drops.
    mapping(Rarity => uint256[]) private _dropPool;

    /// @notice Loot's own claim ledger. RaidBoss keeps a separate one for VAEL and is not touched.
    mapping(uint64 seasonId => mapping(address player => bool)) public raidClaimed;

    event ArenaUpdated(address indexed arena);
    event ItemRegistered(uint256 indexed itemId, string name, uint8 slot, Rarity rarity);
    event LootClaimed(
        uint64 indexed seasonId, address indexed player, uint256 indexed itemId, uint256 shareBps, Rarity rarity
    );
    event LootMinted(address indexed to, uint256 indexed itemId, Rarity rarity, bytes32 reason);

    error Loot__ZeroAddress();
    error Loot__OnlyArena(address caller);
    error Loot__UnknownItem(uint256 itemId);
    error Loot__BadSlot(uint8 slot);
    error Loot__EmptyPool(Rarity rarity);
    error Loot__SeasonNotDefeated(uint64 seasonId);
    error Loot__NoContribution(uint64 seasonId, address player);
    error Loot__AlreadyClaimed(uint64 seasonId, address player);

    constructor(address owner_, address raid) ERC1155("") Ownable(owner_) {
        if (raid == address(0)) revert Loot__ZeroAddress();
        RAID = IRaidLedger(raid);
    }

    // ---------------------------------------------------------------- admin

    function setArena(address arena_) external onlyOwner {
        arena = arena_;
        emit ArenaUpdated(arena_);
    }

    /// @notice Register an item kind and add it to its rarity's drop pool.
    /// @dev Registration is owner-only and additive. Nothing here mints; it only says what an item
    /// is worth if one ever drops.
    function registerItem(
        string calldata name,
        uint8 slot,
        Rarity rarity,
        uint16 strength,
        uint16 agility,
        uint16 intellect,
        string calldata metadataUri
    ) external onlyOwner returns (uint256 itemId) {
        if (slot >= SLOT_COUNT) revert Loot__BadSlot(slot);

        itemId = nextItemId;
        nextItemId += 1;

        items[itemId] = Item({
            name: name,
            slot: slot,
            rarity: rarity,
            strength: strength,
            agility: agility,
            intellect: intellect,
            exists: true
        });
        _itemUris[itemId] = metadataUri;
        _dropPool[rarity].push(itemId);

        emit ItemRegistered(itemId, name, slot, rarity);
    }

    /// @notice Point an item at different metadata.
    /// @dev Stats are fixed at registration; only the document describing them can be corrected.
    function setItemUri(uint256 itemId, string calldata metadataUri) external onlyOwner {
        if (!items[itemId].exists) revert Loot__UnknownItem(itemId);
        _itemUris[itemId] = metadataUri;
        emit URI(metadataUri, itemId);
    }

    // ---------------------------------------------------------------- reads

    function uri(uint256 itemId) public view override returns (string memory) {
        return _itemUris[itemId];
    }

    function itemOf(uint256 itemId) external view returns (Item memory) {
        return items[itemId];
    }

    function dropPool(Rarity rarity) external view returns (uint256[] memory) {
        return _dropPool[rarity];
    }

    /// @notice Rarity a damage share earns, in basis points of the season total.
    function rarityForShare(uint256 shareBps) public pure returns (Rarity) {
        if (shareBps >= LEGENDARY_SHARE_BPS) return Rarity.Legendary;
        if (shareBps >= EPIC_SHARE_BPS) return Rarity.Epic;
        if (shareBps >= RARE_SHARE_BPS) return Rarity.Rare;
        if (shareBps >= UNCOMMON_SHARE_BPS) return Rarity.Uncommon;
        return Rarity.Common;
    }

    /// @notice Rarity an arena roll earns, from the published table.
    function rarityForRoll(uint256 roll) public pure returns (Rarity) {
        uint256 r = roll % 100;
        if (r >= ARENA_LEGENDARY_AT) return Rarity.Legendary;
        if (r >= ARENA_EPIC_AT) return Rarity.Epic;
        if (r >= ARENA_RARE_AT) return Rarity.Rare;
        if (r >= ARENA_UNCOMMON_AT) return Rarity.Uncommon;
        return Rarity.Common;
    }

    /// @notice What `claimRaidLoot` would award, without claiming.
    function pendingRaidLoot(uint64 seasonId, address player)
        external
        view
        returns (bool claimable, uint256 shareBps, Rarity rarity)
    {
        IRaidLedger.Season memory s = RAID.season(seasonId);
        if (!s.defeated || s.totalDamage == 0) return (false, 0, Rarity.Common);
        if (raidClaimed[seasonId][player]) return (false, 0, Rarity.Common);

        uint256 damage = RAID.damageOf(seasonId, player);
        if (damage == 0) return (false, 0, Rarity.Common);

        shareBps = (damage * 10_000) / s.totalDamage;
        return (true, shareBps, rarityForShare(shareBps));
    }

    // ---------------------------------------------------------------- drops

    /// @notice Claim the one item a defeated season owes you.
    /// @dev Pull, not push. A season can have any number of contributors and pushing to all of
    /// them in one transaction is a gas limit waiting to be hit; more to the point, pushing would
    /// need RaidBoss to call this contract, which would mean redeploying RaidBoss.
    function claimRaidLoot(uint64 seasonId) external returns (uint256 itemId) {
        IRaidLedger.Season memory s = RAID.season(seasonId);
        if (!s.defeated || s.totalDamage == 0) revert Loot__SeasonNotDefeated(seasonId);
        if (raidClaimed[seasonId][msg.sender]) revert Loot__AlreadyClaimed(seasonId, msg.sender);

        uint256 damage = RAID.damageOf(seasonId, msg.sender);
        if (damage == 0) revert Loot__NoContribution(seasonId, msg.sender);

        raidClaimed[seasonId][msg.sender] = true;

        uint256 shareBps = (damage * 10_000) / s.totalDamage;
        Rarity rarity = rarityForShare(shareBps);
        // Which item, not how good: the seed varies the drop inside a rarity the player earned.
        itemId = _pick(rarity, uint256(keccak256(abi.encodePacked(seasonId, msg.sender, s.totalDamage))));

        _mint(msg.sender, itemId, 1, "");
        emit LootClaimed(seasonId, msg.sender, itemId, shareBps, rarity);
        emit LootMinted(msg.sender, itemId, rarity, "raid");
    }

    /// @inheritdoc IArenaRewards
    function mintArenaReward(address to, uint256 seed) external returns (uint256 itemId) {
        if (msg.sender != arena || arena == address(0)) revert Loot__OnlyArena(msg.sender);

        uint256 roll = uint256(keccak256(abi.encodePacked(seed, to)));
        Rarity rarity = rarityForRoll(roll);
        itemId = _pick(rarity, roll >> 8);

        _mint(to, itemId, 1, "");
        emit LootMinted(to, itemId, rarity, "arena");
    }

    /// @dev Pick from a rarity's pool, falling back down the ladder when a pool is empty. A
    /// registered game will have every pool filled; falling back means a missing Legendary pool
    /// costs the player a rarity rather than reverting their claim.
    function _pick(Rarity rarity, uint256 entropy) internal view returns (uint256) {
        uint256 tier = uint256(rarity);
        for (uint256 step = 0; step <= tier; step++) {
            uint256[] storage pool = _dropPool[Rarity(tier - step)];
            if (pool.length > 0) return pool[entropy % pool.length];
        }
        revert Loot__EmptyPool(rarity);
    }
}
