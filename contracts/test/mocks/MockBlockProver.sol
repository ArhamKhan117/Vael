// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {INativeQueryVerifier} from
    "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @title MockBlockProver
/// @notice Stands in for the block prover precompile at `0x...0FD2` under `vm.etch`.
///
/// @dev It implements the *full* `INativeQueryVerifier` interface rather than a single stubbed
/// method, so tests exercise the real ABI encode and decode path. A narrower stub would let a
/// mistake in struct field order or in the selector pass in tests and fail on chain, which is
/// exactly the class of bug the interface exists to prevent.
///
/// Behaviour is controlled per proof root so a test can make one member of a batch fail while the
/// rest succeed, which is how all-or-nothing batching is proved.
contract MockBlockProver is INativeQueryVerifier {
    /// @notice Roots the mock refuses to verify. Everything else verifies.
    mapping(bytes32 root => bool) public rejectRoot;

    /// @notice Roots that revert instead of returning false, mirroring the live precompile, which
    /// reverts with `Error(string)` rather than returning false.
    mapping(bytes32 root => string) public revertReasonForRoot;

    /// @notice Transaction index the mock reports for a given proof root.
    mapping(bytes32 root => uint64) public txIndexForRoot;

    /// @notice How many times `verifyAndEmit` has been called, so a test can prove the proof gate
    /// really ran before any state change.
    uint256 public verifyCount;

    function setRejectRoot(bytes32 root, bool rejected) external {
        rejectRoot[root] = rejected;
    }

    function setRevertReason(bytes32 root, string calldata reason) external {
        revertReasonForRoot[root] = reason;
    }

    function setTxIndex(bytes32 root, uint64 txIndex) external {
        txIndexForRoot[root] = txIndex;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata
    ) external returns (bool) {
        verifyCount++;
        string memory reason = revertReasonForRoot[merkleProof.root];
        if (bytes(reason).length != 0) revert(reason);
        if (rejectRoot[merkleProof.root]) return false;
        emit TransactionVerified(chainKey, height, txIndexForRoot[merkleProof.root]);
        return true;
    }

    function verifyAndEmit(
        uint64,
        uint64[] calldata,
        bytes[] calldata,
        MerkleProof[] calldata,
        ContinuityProof calldata
    ) external pure returns (bool) {
        // Vael never calls the array overload: one continuity proof proves one height, so a shared
        // proof cannot verify a batch. Declared to satisfy the interface, and reverts so that any
        // accidental use is loud.
        revert("MockBlockProver: array overload is not used");
    }

    function verify(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata
    ) external view returns (bool) {
        string memory reason = revertReasonForRoot[merkleProof.root];
        if (bytes(reason).length != 0) revert(reason);
        return !rejectRoot[merkleProof.root];
    }

    function verify(
        uint64,
        uint64[] calldata,
        bytes[] calldata,
        MerkleProof[] calldata,
        ContinuityProof calldata
    ) external pure returns (bool) {
        revert("MockBlockProver: array overload is not used");
    }

    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64) {
        return txIndexForRoot[merkleProof.root];
    }
}
