// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ICompletionHook
/// @notice Something that reacts to a verified quest completion.
///
/// @dev Hooks are the output side of the same idea adapters serve on the input side: a new game
/// module should cost one `addHook` transaction, not a redeploy of QuestASC, QuestManager, and
/// everything bound to them.
///
/// A hook is called **after** the reward has already been released, inside `try/catch` with a gas
/// cap. It cannot block a payout, and a hook that reverts, runs out of gas, or does not exist is
/// recorded in a `HookFailed` event and otherwise ignored. That asymmetry is deliberate: a player's
/// reward must never depend on a game module being healthy.
///
/// Every implementation must reject callers other than QuestASC. A hook that trusted its caller
/// would let anyone mint XP or deal raid damage without a proof, which is the one thing this whole
/// system exists to prevent.
interface ICompletionHook {
    /// @notice React to a completion that has already been verified and paid.
    /// @param chainKey Source chain the proved action happened on.
    /// @param questId Quest that completed.
    /// @param player The player, taken from the proved log's indexed topic.
    /// @param actionType `VaelTypes.ActionType` of the proved action.
    /// @param token Token the action moved, or zero for a native action.
    /// @param amount Amount the action moved.
    /// @param tier 1, 2, or 3 by how far the amount exceeded the rule's minimum.
    /// @param sourceBlock Source-chain block the proved action was in.
    /// @param replayKey The log-scoped identity of the proof, for an audit trail.
    ///
    /// @dev `sourceBlock` is carried because hero streaks are defined as a window in *source*
    /// blocks, and it cannot be recovered any other way: `replayKey` is a keccak hash of
    /// `(chainKey, blockHeight, txIndex, logOrdinal)`, and Creditcoin's own `block.number` measures
    /// a different chain. The alternative was an extra storage write per log in QuestASC to expose
    /// it, which costs gas on the hot path for data a calldata argument carries for free.
    function onQuestCompleted(
        uint64 chainKey,
        uint256 questId,
        address player,
        uint8 actionType,
        address token,
        uint256 amount,
        uint8 tier,
        uint64 sourceBlock,
        bytes32 replayKey
    ) external;
}
