// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {IActionAdapter} from "../interfaces/IActionAdapter.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

/// @title Erc20TransferAdapter
/// @notice Decodes a plain ERC-20 `Transfer`.
///
/// @dev The token is the emitting contract, so which tokens count is decided entirely by QuestASC's
/// emitter allowlist for `Erc20Transfer`. This adapter deliberately holds no token list of its own:
/// two places that both decide what is allowed is one place too many.
///
/// The player is `from`, the sender. A quest that wanted to reward the recipient would be a
/// different action type, because rewarding `to` lets anyone farm a quest by having a third party
/// send them dust.
contract Erc20TransferAdapter is IActionAdapter {
    /// @notice `Transfer(address,address,uint256)`.
    bytes32 public constant TOPIC =
        0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    function decode(uint64, EvmV1Decoder.LogEntry memory logEntry)
        external
        pure
        returns (bool, uint8, address, address, uint256, uint256)
    {
        if (logEntry.topics[0] != TOPIC) return (false, 0, address(0), address(0), 0, 0);
        // A compliant Transfer has exactly three topics and one data word. ERC-721 emits a
        // four-topic Transfer with the same signature hash; rejecting on length keeps an NFT
        // transfer from being read as a token amount.
        if (logEntry.topics.length != 3 || logEntry.data.length < 32) {
            return (false, 0, address(0), address(0), 0, 0);
        }

        address player = address(uint160(uint256(logEntry.topics[1]))); // from
        uint256 amount = abi.decode(logEntry.data, (uint256));

        return (
            true,
            uint8(VaelTypes.ActionType.Erc20Transfer),
            player,
            logEntry.address_, // the token is the emitter
            amount,
            0 // an ERC-20 Transfer cannot name a quest
        );
    }
}
