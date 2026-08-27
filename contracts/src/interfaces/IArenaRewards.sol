// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IArenaRewards
/// @notice What Arena is allowed to ask the loot contract for.
/// @dev One call, one item, to the winner of one match. Arena holds no other privilege over loot,
/// and Loot enforces that the caller is the Arena it was configured with.
interface IArenaRewards {
    /// @notice Mint one item to an arena winner.
    /// @param to The winner.
    /// @param seed Entropy already derived by the caller, reused so the drop is replayable.
    /// @return itemId The item kind minted.
    function mintArenaReward(address to, uint256 seed) external returns (uint256 itemId);
}
