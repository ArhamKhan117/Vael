// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IChainInfo} from "../../src/interfaces/IChainInfo.sol";

/// @title MockChainInfo
/// @notice Stands in for the ChainInfo precompile at `0x...0fd3` under `vm.etch`.
/// @dev Implements the whole interface with the exact `snake_case` names, because those names are
/// the selectors. A test that passed against a camelCase stub would say nothing about the live call.
contract MockChainInfo is IChainInfo {
    mapping(uint64 chainKey => uint64) public attestedHeight;
    mapping(uint64 chainKey => bool) public chainKnown;

    function setAttestedHeight(uint64 chainKey, uint64 height) external {
        attestedHeight[chainKey] = height;
        chainKnown[chainKey] = true;
    }

    function setChainUnknown(uint64 chainKey) external {
        chainKnown[chainKey] = false;
    }

    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory result)
    {
        result.height = attestedHeight[chainKey];
        result.hash = keccak256(abi.encode(chainKey, attestedHeight[chainKey]));
        result.isAttestation = true;
        result.exists = chainKnown[chainKey];
    }

    function get_supported_chains() external pure returns (ChainInfo[] memory chains) {
        chains = new ChainInfo[](0);
    }

    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfoResult memory result) {
        result.info.chainKey = chainKey;
        result.exists = chainKnown[chainKey];
    }

    function get_latest_checkpoint_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory result)
    {
        result.height = attestedHeight[chainKey];
        result.isAttestation = false;
        result.exists = chainKnown[chainKey];
    }

    function get_attestation_bounds(uint64, uint64 targetHeight)
        external
        pure
        returns (AttestationBoundsResult memory result)
    {
        result.lowerHeight = targetHeight;
        result.upperHeight = targetHeight;
        result.exists = true;
    }

    function get_attestation_genesis_height(uint64) external pure returns (uint64) {
        return 0;
    }

    function get_attestation_height_for_digest(uint64, bytes32)
        external
        pure
        returns (HeightResult memory result)
    {
        result.exists = false;
    }

    function get_checkpoint_for_height(uint64, uint64 height)
        external
        pure
        returns (HeightHashResult memory result)
    {
        result.height = height;
        result.exists = true;
    }

    function is_height_attested(uint64 chainKey, uint64 targetHeight) external view returns (bool) {
        return chainKnown[chainKey] && targetHeight <= attestedHeight[chainKey];
    }

    function find_highest_attested_before(uint64, uint64 targetHeight)
        external
        pure
        returns (HeightResult memory result)
    {
        result.height = targetHeight;
        result.exists = true;
    }

    function find_lowest_attested_after(uint64, uint64 targetHeight)
        external
        pure
        returns (HeightResult memory result)
    {
        result.height = targetHeight;
        result.exists = true;
    }
}
