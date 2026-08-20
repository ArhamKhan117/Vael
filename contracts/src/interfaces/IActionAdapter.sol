// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

/// @title IActionAdapter
/// @notice Decodes one already-proved source log into the fields a verification rule is written
///         against.
///
/// @dev Adapters are stateless and hold no privilege. They are pure decoders: they are handed a log
/// that the block prover has already verified, and they say what it means. Every security decision
/// stays in QuestASC — the replay ledger, the emitter allowlist, the rule, the player binding, the
/// block window, and the payout.
///
/// This split exists so that adding a protocol never again requires redeploying the core.
/// `QuestManager.setQuestASC` and `CampaignEscrow.setRewardReleaser` are one-shot, so a core
/// redeploy means redeploying the manager and the escrow with it. An adapter is registered against
/// a `topics[0]` by the owner and costs one transaction.
///
/// An adapter must be `view` at most and must never revert on a malformed log: it returns
/// `recognised = false` instead. A revert would let one unrecognisable log strand every quest log
/// beside it in the same transaction.
interface IActionAdapter {
    /// @notice Decode a proved log.
    /// @param chainKey Source chain the log came from. Passed because the same address exists on
    ///        more than one chain, and an adapter may hold chain-scoped registrations.
    /// @param logEntry The log, already proved and already known to have a non-empty topic list.
    /// @return recognised False when this log is not the shape the adapter handles. QuestASC then
    ///         skips the log rather than reverting.
    /// @return actionType Which action this represents, as `VaelTypes.ActionType`.
    /// @return player The acting player, always from an indexed topic, never a transaction sender.
    /// @return token The token the rule may constrain. Zero for a native-value action.
    /// @return amount The amount the rule's `minAmount` is compared against.
    /// @return questIdFromEvent Quest id when the event itself names one, as the portal does.
    ///         Zero when the event cannot name a quest, which is the case for every third-party
    ///         protocol; those actions require the submitter to supply a hint.
    function decode(uint64 chainKey, EvmV1Decoder.LogEntry memory logEntry)
        external
        view
        returns (
            bool recognised,
            uint8 actionType,
            address player,
            address token,
            uint256 amount,
            uint256 questIdFromEvent
        );
}
