// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

/// @title SourceTxFixture
/// @notice Builds `encodedTransaction` bytes in the exact shape the block prover emits, so
///         `EvmV1Decoder` decodes them unmodified.
///
/// @dev The prover delivers a verified transaction as `abi.encode(uint8 txType, bytes[] chunks)`
/// with the receipt as the last chunk. For an EIP-1559 transaction that is three chunks: common
/// fields, type-specific fields, receipt. Building fixtures in that exact shape is what makes these
/// tests meaningful: they run the real decoder over the real layout rather than a stub that returns
/// whatever the test wanted.
///
/// `from` and the indexed player topic are set independently on purpose, because the whole point of
/// reading identity from `topics[2]` is that the gas payer can be a different address.
library SourceTxFixture {
    uint8 internal constant TX_TYPE_EIP1559 = 2;

    /// @notice One log to place in the fabricated receipt.
    struct Log {
        address emitter;
        bytes32[] topics;
        bytes data;
    }

    /// @notice Build a transaction carrying the given logs.
    /// @param from The gas payer. Deliberately independent of any indexed player topic.
    /// @param receiptStatus 1 for success. Anything else must make the whole submission fail.
    function build(address from, uint8 receiptStatus, Log[] memory logs)
        internal
        pure
        returns (bytes memory)
    {
        bytes[] memory chunks = new bytes[](3);

        // chunk 0: common fields, in wire order.
        chunks[0] = abi.encode(
            uint64(7), // nonce
            uint64(21000), // gasLimit
            from,
            false, // toIsNull
            address(0xDEAD), // to
            uint256(0), // value
            bytes("") // data
        );

        // chunk 1: EIP-1559 type-specific fields.
        chunks[1] = abi.encode(
            uint64(11155111), // chainId, Sepolia
            uint128(1 gwei), // maxPriorityFeePerGas
            uint128(30 gwei), // maxFeePerGas
            new EvmV1Decoder.AccessListEntry[](0),
            uint8(0), // yParity
            bytes32(0), // r
            bytes32(0) // s
        );

        // chunk 2: the receipt, which is where every log the rules read comes from.
        EvmV1Decoder.LogEntryTuple[] memory tuples = new EvmV1Decoder.LogEntryTuple[](logs.length);
        for (uint256 i = 0; i < logs.length; ++i) {
            tuples[i] = EvmV1Decoder.LogEntryTuple({
                address_: logs[i].emitter,
                topics: logs[i].topics,
                data: logs[i].data
            });
        }
        chunks[2] = abi.encode(receiptStatus, uint64(120000), tuples, bytes(""));

        return abi.encode(TX_TYPE_EIP1559, chunks);
    }

    /// @notice A `QuestActionPerformed` log as QuestPortal emits it.
    /// @param portal The emitting portal address.
    /// @param questId Indexed, `topics[1]`.
    /// @param player Indexed, `topics[2]`. The identity the rule binds to.
    /// @param token Data word 0. Zero for a native check-in.
    /// @param amount Data word 1.
    function portalLog(
        address portal,
        uint256 questId,
        address player,
        address token,
        uint256 amount
    ) internal pure returns (Log memory) {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = 0x3ffa602a6835802daaea4f4c4102da0a312d481769471dd020a1512afd9d8022;
        topics[1] = bytes32(questId);
        topics[2] = bytes32(uint256(uint160(player)));
        topics[3] = bytes32(uint256(0)); // actionType
        return Log({emitter: portal, topics: topics, data: abi.encode(token, amount)});
    }

    /// @notice An arbitrary unrelated log, to prove the sweep skips what it does not recognise.
    function noiseLog(address emitter) internal pure returns (Log memory) {
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = keccak256("SomethingElse(uint256)");
        return Log({emitter: emitter, topics: topics, data: abi.encode(uint256(1))});
    }

    function single(Log memory a) internal pure returns (Log[] memory out) {
        out = new Log[](1);
        out[0] = a;
    }

    function pair(Log memory a, Log memory b) internal pure returns (Log[] memory out) {
        out = new Log[](2);
        out[0] = a;
        out[1] = b;
    }
}
