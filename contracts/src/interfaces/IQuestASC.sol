// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {VaelTypes} from "./IVaelTypes.sol";

/// @notice The slice of QuestASC that QuestManager calls.
interface IQuestASC {
    /// @notice Register the verification rule for a quest. Callable only by QuestManager.
    function setRule(uint256 questId, uint64 sourceChainKey, VaelTypes.VerificationRule calldata rule)
        external;
}
