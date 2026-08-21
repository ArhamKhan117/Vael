// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @title VaelAscBase
/// @notice The proof gate. Everything Vael pays out passes through `_verifyAndIngest` below, and
///         nothing this contract owns is written before the block prover precompile has returned
///         true for the source transaction.
///
/// @dev Vael deliberately does not inherit `ASCBase` from `@gluwa/asc-contracts`. Three properties
/// this game needs are not available there, and each one is a security property rather than a
/// convenience:
///
/// 1. **The replay key is log-scoped, not transaction-scoped.** `ASCBase` keys replay per proved
///    transaction, so the first recognised log in a transaction consumes that transaction's only
///    identity and every further recognised log in it becomes permanently unclaimable. One Sepolia
///    transaction can easily carry two quest-relevant logs, so that failure mode would be routine.
///    The key here is `keccak256(chainKey, blockHeight, txIndex, logOrdinal)`.
///
/// 2. **Dispatch is derived from the verified log, never from the caller.** There is no action byte
///    in `SourceTx`. A caller-supplied dispatch field sits outside the proof, which means a valid
///    proof of a benign transaction could be aimed at a different interpretation of the same bytes
///    on the code path that releases money. Handlers are selected from the emitting address and
///    `topics[0]` of a log that has already been proved.
///
/// 3. **Every batch member carries its own continuity proof.** Verified on the live network: one
///    continuity proof proves exactly one height. The precompile treats the proof's first root as
///    the transaction-trie root of the height under proof, so a proof built to span a batch verifies
///    only the lowest height and reverts `Merkle root mismatch` at every other one. Carrying the
///    proof inside `SourceTx` makes the wrong pairing unexpressible.
///
/// The transaction index is recovered from the proof's sibling laterality through
/// `calculateTxIndex`, never accepted from the caller, because it is one of the four fields of the
/// replay key: a caller-supplied index would let the same log be claimed under many identities.
abstract contract VaelAscBase {
    // ---------------------------------------------------------------- constants

    /// @notice Largest number of proofs one batch submission may carry.
    /// @dev Bounded because each member costs one `verifyAndEmit` plus one receipt decode, and an
    /// unbounded batch could exceed the block gas limit and become permanently unminable.
    uint256 internal constant MAX_BATCH_PROOFS = 10;

    /// @notice Widest source block-height span one batch may cover.
    /// @dev Not a proof-sharing bound; nothing is shared. A continuity proof is a gapless digest
    /// chain from an attested endpoint down to the proved block, so its calldata grows with the
    /// distance. Capping the span keeps a batch's cost predictable from its size alone.
    uint64 internal constant MAX_BATCH_SPAN_BLOCKS = 1000;

    /// @notice `receiptStatus` value that denotes a successful source transaction.
    /// @dev The precompile proves inclusion, not success. A reverted source transaction moved no
    /// value, so its logs must credit nothing.
    uint8 internal constant RECEIPT_STATUS_SUCCESS = 1;

    // ---------------------------------------------------------------- immutables

    /// @notice The block prover precompile this contract verifies against.
    /// @dev Immutable and taken from the address library rather than a constructor argument, so no
    /// deployment path can aim verification at a contract that merely returns true.
    INativeQueryVerifier public immutable VERIFIER;

    // ---------------------------------------------------------------- storage

    /// @notice Replay ledger, keyed per log.
    mapping(bytes32 replayKey => bool) public claimedLog;

    /// @notice Creditcoin block in which each replay key was ingested.
    /// @dev Audit metadata for off-chain reconciliation. Never read as a gate.
    mapping(bytes32 replayKey => uint64) public ingestedAt;

    // ---------------------------------------------------------------- inputs

    /// @notice One source transaction together with its inclusion proof.
    /// @dev Every field is proof material or source chain data. There is no action byte, no handler
    /// address, and no transaction index.
    struct SourceTx {
        /// @dev Attested-chain identifier. Sepolia is 1, Ethereum mainnet is 3.
        uint64 chainKey;
        /// @dev Source block height holding the transaction.
        uint64 blockHeight;
        /// @dev The transaction as published on the source chain.
        bytes encodedTransaction;
        /// @dev Inclusion proof against that block's transaction-trie root.
        INativeQueryVerifier.MerkleProof merkleProof;
        /// @dev Link from an attested endpoint down to the block holding this transaction.
        ///      Belongs to the transaction, not to the batch. See the contract note above.
        INativeQueryVerifier.ContinuityProof continuityProof;
    }

    // ---------------------------------------------------------------- events

    /// @notice One event per verified source transaction that yielded at least one handled log.
    event SourceTxVerified(
        uint64 indexed chainKey,
        uint64 indexed blockHeight,
        uint64 txIndex,
        uint256 handledLogs
    );

    // ---------------------------------------------------------------- errors

    error EmptyBatch();
    error BatchTooLarge(uint256 provided, uint256 maximum);
    error BatchRangeExceeded(uint64 lowestHeight, uint64 highestHeight, uint64 maximumSpan);
    error BatchLengthMismatch(uint256 sourceTxs, uint256 hints);
    error UnsupportedChainKey(uint64 chainKey);
    error ProofRejected(uint64 chainKey, uint64 blockHeight, bytes32 merkleRoot);
    error UnsupportedTransactionType(uint8 txType);
    error SourceTransactionReverted(uint64 chainKey, uint64 blockHeight, uint64 txIndex);
    error NothingRecognised(uint64 chainKey, uint64 blockHeight, uint64 txIndex);
    error AlreadyClaimed(bytes32 key);

    // ---------------------------------------------------------------- construction

    constructor() {
        VERIFIER = NativeQueryVerifierLib.getVerifier();
    }

    // ---------------------------------------------------------------- replay key

    /// @notice The identity of one source log, and the unit of replay protection.
    /// @dev Log-scoped, so two quest-relevant logs in one source transaction are two claims.
    function replayKey(uint64 chainKey, uint64 blockHeight, uint64 txIndex, uint64 logOrdinal)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(chainKey, blockHeight, txIndex, logOrdinal));
    }

    // ---------------------------------------------------------------- entrypoints

    /// @notice Prove one source transaction and apply every recognised log in it.
    /// @param sourceTx The transaction, its inclusion proof, and its continuity proof.
    /// @param questIdHint Quest the submitter believes this satisfies. Advisory: a handler may
    ///        require the proved log to agree with it, but the hint can never widen what is
    ///        accepted, only narrow it.
    /// @return handledLogs Number of logs this submission applied.
    function submit(SourceTx calldata sourceTx, uint256 questIdHint)
        external
        returns (uint256 handledLogs)
    {
        handledLogs = _verifyAndIngest(sourceTx, questIdHint);
    }

    /// @notice Prove several source transactions in one Creditcoin transaction, all or nothing.
    /// @dev Sequential `verifyAndEmit` calls, each with its own continuity proof. A single revert
    /// unwinds the whole batch, so a caller can never mix fresh and replayed logs and have the
    /// fresh ones credited.
    function submitBatch(SourceTx[] calldata sourceTxs, uint256[] calldata questIdHints)
        external
        returns (uint256 handledLogs)
    {
        uint256 count = sourceTxs.length;
        if (count == 0) revert EmptyBatch();
        if (count > MAX_BATCH_PROOFS) revert BatchTooLarge(count, MAX_BATCH_PROOFS);
        if (count != questIdHints.length) revert BatchLengthMismatch(count, questIdHints.length);

        // Bound the span before verifying anything, so an ill-formed batch costs no proof calls.
        uint64 lowest = sourceTxs[0].blockHeight;
        uint64 highest = lowest;
        for (uint256 i = 1; i < count; ++i) {
            uint64 height = sourceTxs[i].blockHeight;
            if (height < lowest) lowest = height;
            if (height > highest) highest = height;
        }
        if (highest - lowest > MAX_BATCH_SPAN_BLOCKS) {
            revert BatchRangeExceeded(lowest, highest, MAX_BATCH_SPAN_BLOCKS);
        }

        for (uint256 i = 0; i < count; ++i) {
            handledLogs += _verifyAndIngest(sourceTxs[i], questIdHints[i]);
        }
    }

    // ---------------------------------------------------------------- core

    /// @dev The order of the steps below is load-bearing. Nothing is decoded before inclusion is
    /// proved, no index is trusted from the caller, no field is read before the transaction type is
    /// accepted, and no log is applied before the receipt is known to have succeeded. The first
    /// storage write happens in step 5, after the proof gate in step 1 returned true.
    function _verifyAndIngest(SourceTx calldata sourceTx, uint256 questIdHint)
        internal
        returns (uint256 handledLogs)
    {
        // 0. Source chain gate. Cheapest rejection, and it runs before any external call.
        if (!_isSupportedChainKey(sourceTx.chainKey)) revert UnsupportedChainKey(sourceTx.chainKey);

        // 1. Proof first.
        bool verified = VERIFIER.verifyAndEmit(
            sourceTx.chainKey,
            sourceTx.blockHeight,
            sourceTx.encodedTransaction,
            sourceTx.merkleProof,
            sourceTx.continuityProof
        );
        if (!verified) {
            revert ProofRejected(sourceTx.chainKey, sourceTx.blockHeight, sourceTx.merkleProof.root);
        }

        // 2. Transaction index recovered from the proof, never from the caller.
        uint64 txIndex = VERIFIER.calculateTxIndex(sourceTx.merkleProof);

        // 3. Transaction type gate before any field decoding.
        uint8 txType = EvmV1Decoder.getTransactionType(sourceTx.encodedTransaction);
        if (!EvmV1Decoder.isValidTransactionType(txType)) revert UnsupportedTransactionType(txType);

        // 4. Receipt status gate before any log is applied.
        EvmV1Decoder.ReceiptFields memory receipt =
            EvmV1Decoder.decodeReceiptFields(sourceTx.encodedTransaction);
        if (receipt.receiptStatus != RECEIPT_STATUS_SUCCESS) {
            revert SourceTransactionReverted(sourceTx.chainKey, sourceTx.blockHeight, txIndex);
        }

        // 5. Ordinal sweep. The loop counter is the receipt-wide log ordinal the replay key needs,
        //    which is why this walks every log rather than taking the first signature match.
        uint256 logCount = receipt.receiptLogs.length;
        bytes32 firstClaimedKey;
        for (uint256 i = 0; i < logCount; ++i) {
            EvmV1Decoder.LogEntry memory logEntry = receipt.receiptLogs[i];

            // A log with no topics carries no event signature, so it can match nothing.
            if (logEntry.topics.length == 0) continue;

            // An (emitter, topics[0]) pair that matches nothing registered is somebody else's
            // event. Skip it and keep going: an unrelated log must not strand the quest logs beside
            // it. chainKey is part of the question because the same address exists on more than one
            // chain, and a deployer controls its own testnet addresses.
            if (!_isRecognised(sourceTx.chainKey, logEntry)) continue;

            // Safe cast: `i` indexes an in-memory array decoded from one receipt, so it is bounded
            // by that receipt's log count and cannot approach 2^64 within any block gas limit.
            uint64 logOrdinal = uint64(i);
            bytes32 key = replayKey(sourceTx.chainKey, sourceTx.blockHeight, txIndex, logOrdinal);

            // An already-claimed log is skipped, not fatal. The whole point of a log-scoped key is
            // that one source transaction can satisfy several quests, and those claims arrive as
            // separate submissions: the second one necessarily sweeps past the first one's log.
            // Double-crediting is still impossible, because the claim below is what prevents it.
            // If nothing else in the transaction applies, the skip is reported as the replay it is.
            if (claimedLog[key]) {
                if (firstClaimedKey == bytes32(0)) firstClaimedKey = key;
                continue;
            }
            claimedLog[key] = true;
            ingestedAt[key] = uint64(block.number);

            bool applied =
                _handleRecognisedLog(sourceTx.chainKey, sourceTx.blockHeight, key, logEntry, questIdHint);

            // A recognised log that does not belong to the quest being claimed is released rather
            // than consumed. One real transaction routinely carries several recognised logs of
            // different kinds — a Uniswap swap emits two ERC-20 Transfers alongside its Swap — and
            // the submitter is claiming exactly one quest. Burning the other logs' keys would make
            // them permanently unclaimable for the quests they *do* satisfy.
            //
            // The claim is set across the handler call and cleared only on a clean false return,
            // so the reentrancy guarantee is unchanged: during any external call the key is held.
            if (!applied) {
                claimedLog[key] = false;
                ingestedAt[key] = 0;
                continue;
            }
            ++handledLogs;
        }

        if (handledLogs == 0) {
            // Nothing applied. If the only thing standing in the way was an already-claimed log,
            // say so plainly: this submission is a replay, and a caller preflighting it needs that
            // answer rather than a generic "nothing here".
            if (firstClaimedKey != bytes32(0)) revert AlreadyClaimed(firstClaimedKey);
            revert NothingRecognised(sourceTx.chainKey, sourceTx.blockHeight, txIndex);
        }

        emit SourceTxVerified(sourceTx.chainKey, sourceTx.blockHeight, txIndex, handledLogs);
    }

    // ---------------------------------------------------------------- hooks

    /// @dev Whether this deployment accepts proofs from a source chain at all.
    function _isSupportedChainKey(uint64 chainKey) internal view virtual returns (bool);

    /// @dev Whether an already-proved log is one this deployment acts on. Must consider both the
    /// emitting address and `topics[0]`, and must consider them together with `chainKey`.
    function _isRecognised(uint64 chainKey, EvmV1Decoder.LogEntry memory logEntry)
        internal
        view
        virtual
        returns (bool);

    /// @dev Apply one recognised log. Called only after the proof passed, the receipt succeeded,
    /// and the replay key was claimed.
    /// @return applied True when the log was credited. False means "recognised, but not the log
    ///         this submission is claiming", and the base releases the replay key so the log stays
    ///         available for the quest it does satisfy.
    function _handleRecognisedLog(
        uint64 chainKey,
        uint64 blockHeight,
        bytes32 key,
        EvmV1Decoder.LogEntry memory logEntry,
        uint256 questIdHint
    ) internal virtual returns (bool applied);
}
