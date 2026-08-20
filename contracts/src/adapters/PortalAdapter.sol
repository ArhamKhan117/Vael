// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {IActionAdapter} from "../interfaces/IActionAdapter.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

/// @title PortalAdapter
/// @notice Decodes Vael's own `QuestActionPerformed` event from QuestPortal.
///
/// @dev This is the only action whose event names the quest, because Vael owns the source contract
/// and put the quest id in it. Every third-party protocol emits events that know nothing about
/// Vael, so those adapters return `questIdFromEvent = 0` and the submitter must supply a hint.
contract PortalAdapter is IActionAdapter {
    /// @notice `QuestActionPerformed(uint256,address,uint8,address,uint256)`.
    bytes32 public constant TOPIC =
        0x3ffa602a6835802daaea4f4c4102da0a312d481769471dd020a1512afd9d8022;

    function decode(uint64, EvmV1Decoder.LogEntry memory logEntry)
        external
        pure
        returns (bool, uint8, address, address, uint256, uint256)
    {
        // Never revert on a malformed log: one unrecognisable log must not strand the quest logs
        // beside it in the same transaction.
        if (logEntry.topics[0] != TOPIC) return (false, 0, address(0), address(0), 0, 0);
        if (logEntry.topics.length < 4 || logEntry.data.length < 64) {
            return (false, 0, address(0), address(0), 0, 0);
        }

        uint256 questId = uint256(logEntry.topics[1]);
        // Identity from the indexed topic, never the transaction's `from`, which is the gas payer.
        address player = address(uint160(uint256(logEntry.topics[2])));
        (address token, uint256 amount) = abi.decode(logEntry.data, (address, uint256));

        return (true, uint8(VaelTypes.ActionType.Portal), player, token, amount, questId);
    }
}
