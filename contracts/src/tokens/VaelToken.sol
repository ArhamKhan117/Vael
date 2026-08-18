// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VaelToken
 * @notice ERC-20 token for VAEL DeFi Quest rewards.
 *         Mintable by RewardVault contract for distributing quest rewards.
 */
contract VaelToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    event MinterRoleGranted(address indexed account);
    event MinterRoleRevoked(address indexed account);

    constructor(address owner) ERC20("Vael", "VAEL") {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(MINTER_ROLE, owner);
        _grantRole(BURNER_ROLE, owner);
    }

    /**
     * @notice Mint tokens to a specific address.
     *         Only callable by addresses with MINTER_ROLE (e.g., RewardVault).
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint (with 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Grant MINTER_ROLE to an address (typically RewardVault).
     * @param account Address to grant MINTER_ROLE
     */
    function grantMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, account);
        emit MinterRoleGranted(account);
    }

    /**
     * @notice Revoke MINTER_ROLE from an address.
     * @param account Address to revoke MINTER_ROLE
     */
    function revokeMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, account);
        emit MinterRoleRevoked(account);
    }
}

