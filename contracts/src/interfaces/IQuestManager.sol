// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The slice of QuestManager that QuestASC reads and calls.
/// @dev QuestASC never trusts its caller for any of this. Every field it needs to decide whether a
/// proved log satisfies a quest is read from QuestManager at verification time.
interface IQuestManager {
    /// @notice Everything QuestASC needs about a quest in one read.
    struct QuestVerificationContext {
        bool exists;
        bool active;
        address assignedParticipant;
        uint64 expiry;
        uint64 sourceChainKey;
        uint256 campaignId;
    }

    function verificationContext(uint256 questId)
        external
        view
        returns (QuestVerificationContext memory context);

    /// @notice Attested source height recorded when this participant accepted.
    /// @dev The action must happen strictly after this, which is what stops a player from
    /// retroactively claiming a transaction they made before taking the quest.
    function acceptedAtSourceHeight(uint256 questId, address participant)
        external
        view
        returns (uint64);

    function hasAccepted(uint256 questId, address participant) external view returns (bool);

    /// @notice Record a verified completion. Callable only by QuestASC.
    function recordCompletion(
        uint256 questId,
        address participant,
        bytes32 replayKey,
        bytes32 sourceTxHash
    ) external;
}
