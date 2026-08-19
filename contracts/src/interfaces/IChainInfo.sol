// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IChainInfo
/// @notice Typed surface of the ChainInfo precompile at
/// `0x0000000000000000000000000000000000000fd3`, which publishes what the Attestcoin attestors
/// have recorded about each source chain.
/// @dev The method names are `snake_case` on purpose. A precompile has no source to link against,
/// so the 4-byte selector produced by this declaration *is* the integration: renaming
/// `get_latest_attestation_height_and_hash` to a camelCase spelling changes the selector and the
/// call reverts. Field order in the structs below is wire order and must not be reordered for
/// readability.
///
/// Vael calls exactly one of these in contract code, at quest acceptance, to anchor the source
/// block window. The rest are declared because the worker and future phases read them, and because
/// a partial interface invites someone to guess a selector later.
interface IChainInfo {
    /// @notice A source chain known to the attestors.
    struct ChainInfo {
        /// @dev Attestation-side identifier, used in every other call here. Sepolia is 1.
        uint64 chainKey;
        /// @dev The chain's own EVM chain id. Sepolia is 11155111.
        uint64 chainId;
        /// @dev Human-readable name as variable-length UTF-8 bytes, not `string`.
        bytes chainName;
        /// @dev Encoding family of the chain's block and transaction format.
        uint8 chainEncoding;
    }

    /// @notice A chain descriptor plus a presence flag.
    struct ChainInfoResult {
        /// @dev Meaningful only when `exists` is true; otherwise zero-valued.
        ChainInfo info;
        bool exists;
    }

    /// @notice A height and the digest recorded for it.
    /// @dev The digest is `keccak256(uint64 height || merkleRoot || prevDigest)`, not the block hash.
    struct HeightHashResult {
        uint64 height;
        bytes32 hash;
        /// @dev True for an attestation, false for a checkpoint. Checkpoints sit on a coarser grid
        /// and must not be read as an attested frontier.
        bool isAttestation;
        /// @dev Whether any record was found at all.
        bool exists;
    }

    /// @notice A height plus a presence flag.
    struct HeightResult {
        uint64 height;
        bool exists;
    }

    /// @notice The attested range that brackets a target height.
    struct AttestationBoundsResult {
        uint64 lowerHeight;
        uint64 upperHeight;
        bool exists;
    }

    function get_supported_chains() external view returns (ChainInfo[] memory chains);

    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfoResult memory result);

    /// @notice The highest attestation endpoint recorded for a chain, with its digest.
    /// @dev This is the attested frontier. A source transaction above it is not yet provable, which
    /// is exactly why quest acceptance anchors here: an action can only count if it happens after
    /// the frontier the player accepted at.
    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory result);

    function get_latest_checkpoint_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory result);

    function get_attestation_bounds(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (AttestationBoundsResult memory result);

    function get_attestation_genesis_height(uint64 chainKey)
        external
        view
        returns (uint64 genesisHeight);

    function get_attestation_height_for_digest(uint64 chainKey, bytes32 digest)
        external
        view
        returns (HeightResult memory result);

    function get_checkpoint_for_height(uint64 chainKey, uint64 height)
        external
        view
        returns (HeightHashResult memory result);

    function is_height_attested(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (bool isAttested);

    function find_highest_attested_before(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (HeightResult memory result);

    function find_lowest_attested_after(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (HeightResult memory result);
}

/// @notice Single place where the ChainInfo precompile address is written down.
/// @dev Every call site obtains the precompile through `chainInfo()` rather than casting a literal,
/// so the address appears once in the contract tree and the call is typed.
library ChainInfoLib {
    /// @notice The ChainInfo precompile address on Creditcoin.
    address internal constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000fD3;

    /// @notice The precompile, typed.
    function chainInfo() internal pure returns (IChainInfo info) {
        info = IChainInfo(PRECOMPILE_ADDRESS);
    }
}
