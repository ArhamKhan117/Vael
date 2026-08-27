// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Loot} from "../../src/game/Loot.sol";

/// @notice Loot with one extra door, so a test can put a specific item in a specific wallet.
/// @dev Every behaviour under test is the parent's, unchanged. The production contract has no
/// arbitrary mint on purpose: items exist only because a raid was won or a duel was fought, and an
/// owner who could conjure a Legendary would undo the point of earning one. Equipment tests need a
/// named item rather than whatever the drop table hands them, and searching for a seed that drops
/// the right item would test the seed rather than the equipment.
contract LootHarness is Loot {
    constructor(address owner_, address raid) Loot(owner_, raid) {}

    function grant(address to, uint256 itemId, uint256 amount) external {
        _mint(to, itemId, amount, "");
    }
}
