// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IEquipment} from "../interfaces/IEquipment.sol";
import {Loot} from "./Loot.sol";

/// @title Equipment
/// @notice What each hero is carrying, and what it is worth in a fight.
///
/// @dev Standalone. Neither VaelHero nor Loot knows this contract exists; it holds items on behalf
/// of heroes and answers one question for Arena. VaelHero already reserves four `uint16` equipment
/// slots in its struct, but writing them would need QuestASC, which would need a redeploy, so the
/// mapping lives here instead and the hero's own slots stay unused.
///
/// **Items are escrowed while equipped.** The alternative, checking a balance at read time, breaks
/// the moment somebody sells the sword they are fighting with: Arena reads bonuses during
/// `resolve`, and a bonus that can be sold out from under a duel is not a bonus. Holding the item
/// makes the state unambiguous, and `unequip` returns it to whoever owns the hero at that moment.
contract Equipment is IEquipment, ERC1155Holder {
    IERC721 public immutable HERO;
    Loot public immutable LOOT;

    uint8 public constant SLOT_COUNT = 4;

    /// @notice Item equipped in each slot, or 0 for empty.
    mapping(uint256 heroTokenId => mapping(uint8 slot => uint256 itemId)) public equipped;

    event Equipped(uint256 indexed heroTokenId, uint8 indexed slot, uint256 indexed itemId, address owner);
    event Unequipped(uint256 indexed heroTokenId, uint8 indexed slot, uint256 indexed itemId, address owner);

    error Equipment__ZeroAddress();
    error Equipment__NotHeroOwner(uint256 heroTokenId, address caller);
    error Equipment__BadSlot(uint8 slot);
    error Equipment__UnknownItem(uint256 itemId);
    error Equipment__WrongSlot(uint256 itemId, uint8 itemSlot, uint8 slot);
    error Equipment__NotItemOwner(uint256 itemId, address caller);
    error Equipment__SlotOccupied(uint256 heroTokenId, uint8 slot, uint256 itemId);
    error Equipment__SlotEmpty(uint256 heroTokenId, uint8 slot);

    constructor(address hero, address loot) {
        if (hero == address(0) || loot == address(0)) revert Equipment__ZeroAddress();
        HERO = IERC721(hero);
        LOOT = Loot(loot);
    }

    /// @notice Put an item in one of a hero's four slots.
    /// @dev The item moves into this contract. It comes back through `unequip` and no other way.
    function equip(uint256 heroTokenId, uint8 slot, uint256 itemId) external {
        _requireHeroOwner(heroTokenId);
        if (slot >= SLOT_COUNT) revert Equipment__BadSlot(slot);

        Loot.Item memory item = LOOT.itemOf(itemId);
        if (!item.exists) revert Equipment__UnknownItem(itemId);
        if (item.slot != slot) revert Equipment__WrongSlot(itemId, item.slot, slot);

        uint256 occupied = equipped[heroTokenId][slot];
        if (occupied != 0) revert Equipment__SlotOccupied(heroTokenId, slot, occupied);
        if (IERC1155(address(LOOT)).balanceOf(msg.sender, itemId) == 0) {
            revert Equipment__NotItemOwner(itemId, msg.sender);
        }

        equipped[heroTokenId][slot] = itemId;
        IERC1155(address(LOOT)).safeTransferFrom(msg.sender, address(this), itemId, 1, "");

        emit Equipped(heroTokenId, slot, itemId, msg.sender);
    }

    /// @notice Take an item back out of a slot.
    function unequip(uint256 heroTokenId, uint8 slot) external returns (uint256 itemId) {
        _requireHeroOwner(heroTokenId);
        if (slot >= SLOT_COUNT) revert Equipment__BadSlot(slot);

        itemId = equipped[heroTokenId][slot];
        if (itemId == 0) revert Equipment__SlotEmpty(heroTokenId, slot);

        equipped[heroTokenId][slot] = 0;
        IERC1155(address(LOOT)).safeTransferFrom(address(this), msg.sender, itemId, 1, "");

        emit Unequipped(heroTokenId, slot, itemId, msg.sender);
    }

    /// @inheritdoc IEquipment
    function bonusesOf(uint256 heroTokenId)
        external
        view
        returns (uint16 strength, uint16 agility, uint16 intellect)
    {
        for (uint8 slot = 0; slot < SLOT_COUNT; slot++) {
            uint256 itemId = equipped[heroTokenId][slot];
            if (itemId == 0) continue;
            Loot.Item memory item = LOOT.itemOf(itemId);
            strength += item.strength;
            agility += item.agility;
            intellect += item.intellect;
        }
    }

    /// @notice Every slot at once, for a UI.
    function loadout(uint256 heroTokenId) external view returns (uint256[SLOT_COUNT] memory slots) {
        for (uint8 slot = 0; slot < SLOT_COUNT; slot++) {
            slots[slot] = equipped[heroTokenId][slot];
        }
    }

    /// @dev Ownership is checked live, so selling a hero takes its loadout with it and the buyer
    /// is the only one who can unequip. A hero is soul-bound today; this does not assume so.
    function _requireHeroOwner(uint256 heroTokenId) internal view {
        if (HERO.ownerOf(heroTokenId) != msg.sender) {
            revert Equipment__NotHeroOwner(heroTokenId, msg.sender);
        }
    }
}
