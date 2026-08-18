// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IIdentityRegistryReader {
    function isActive(uint256 agentId) external view returns (bool);
    function agentIdByController(address controller) external view returns (uint256);
}

/**
 * @title AgentRegistryAdapter
 * @notice Lightweight helper that other contracts (e.g., QuestManager) can use to
 * quickly check whether a caller is a valid ERC-8004 agent.
 */
contract AgentRegistryAdapter {
    IIdentityRegistryReader public immutable IDENTITY_REGISTRY;

    error AgentRegistryAdapter__Unregistered(address controller);
    error AgentRegistryAdapter__Inactive(uint256 agentId);

    constructor(IIdentityRegistryReader identityRegistry_) {
        IDENTITY_REGISTRY = identityRegistry_;
    }

    function requireValidAgent(address controller) external view returns (uint256 agentId) {
        agentId = IDENTITY_REGISTRY.agentIdByController(controller);
        if (agentId == 0) revert AgentRegistryAdapter__Unregistered(controller);
        if (!IDENTITY_REGISTRY.isActive(agentId)) revert AgentRegistryAdapter__Inactive(agentId);
    }
}
