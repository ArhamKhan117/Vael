// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistry
 * @notice Minimal ERC-8004 Identity Registry implementation backed by ERC-721 identity cards.
 * Each registered agent is assigned a unique token ID that points to off-chain metadata
 * describing its capabilities, endpoints, and other discovery details. The registry owner
 * (initially the deployer) is responsible for approving and revoking agents during the MVP.
 */
contract IdentityRegistry is ERC721, Ownable {
    uint256 private _nextAgentId = 1;

    struct AgentIdentity {
        address controller; // address allowed to manage the identity metadata
        string metadataURI; // JSON-LD metadata per ERC-8004 spec
        bool active;
    }

    // tokenId => identity data
    mapping(uint256 => AgentIdentity) private _identities;

    // controller/operator address => tokenId (1:1 mapping for MVP)
    mapping(address => uint256) private _agentTokenByController;

    event AgentRegistered(uint256 indexed agentId, address indexed controller, string metadataURI);
    event AgentMetadataUpdated(uint256 indexed agentId, string metadataURI);
    event AgentControllerUpdated(uint256 indexed agentId, address indexed newController);
    event AgentStatusChanged(uint256 indexed agentId, bool active);

    error IdentityRegistry__UnknownAgent(uint256 agentId);
    error IdentityRegistry__NotAgentController(uint256 agentId, address caller);
    error IdentityRegistry__ControllerExists(address controller);

    constructor(address owner_) ERC721("Vael Agent", "VAGT") Ownable(owner_) {}

    /**
     * @notice Register a new agent with the given controller and metadata URI.
     * @param controller Address that will operate the agent (also initial NFT recipient).
     * @param metadataURI JSON-LD compliant metadata pointer (e.g. IPFS CID).
     * @return agentId Newly minted token ID.
     */
    function registerAgent(address controller, string calldata metadataURI)
        external
        onlyOwner
        returns (uint256 agentId)
    {
        if (controller == address(0)) revert("IdentityRegistry: controller zero");
        if (_agentTokenByController[controller] != 0) revert IdentityRegistry__ControllerExists(controller);

        agentId = _nextAgentId;
        _nextAgentId += 1;

        _mint(controller, agentId);

        AgentIdentity storage identity = _identities[agentId];
        identity.controller = controller;
        identity.metadataURI = metadataURI;
        identity.active = true;

        _agentTokenByController[controller] = agentId;

        emit AgentRegistered(agentId, controller, metadataURI);
    }

    function updateMetadata(uint256 agentId, string calldata metadataURI) external {
        AgentIdentity storage identity = _requireIdentity(agentId);
        _requireController(agentId, identity, msg.sender);

        identity.metadataURI = metadataURI;
        emit AgentMetadataUpdated(agentId, metadataURI);
    }

    function setController(uint256 agentId, address newController) external onlyOwner {
        if (newController == address(0)) revert("IdentityRegistry: controller zero");

        AgentIdentity storage identity = _requireIdentity(agentId);

        address oldController = identity.controller;
        if (oldController != address(0)) {
            _agentTokenByController[oldController] = 0;
        }

        if (_agentTokenByController[newController] != 0) revert IdentityRegistry__ControllerExists(newController);

        identity.controller = newController;
        _agentTokenByController[newController] = agentId;

        _transfer(oldController, newController, agentId);

        emit AgentControllerUpdated(agentId, newController);
    }

    function setAgentStatus(uint256 agentId, bool active) external onlyOwner {
        AgentIdentity storage identity = _requireIdentity(agentId);
        identity.active = active;
        emit AgentStatusChanged(agentId, active);
    }

    function getAgent(uint256 agentId) external view returns (AgentIdentity memory) {
        AgentIdentity memory identity = _identities[agentId];
        if (identity.controller == address(0)) revert IdentityRegistry__UnknownAgent(agentId);
        return identity;
    }

    function agentIdByController(address controller) external view returns (uint256) {
        return _agentTokenByController[controller];
    }

    function tokenURI(uint256 agentId) public view override returns (string memory) {
        return _requireIdentity(agentId).metadataURI;
    }

    function isActive(uint256 agentId) external view returns (bool) {
        AgentIdentity memory identity = _identities[agentId];
        if (identity.controller == address(0)) return false;
        return identity.active;
    }

    function _requireIdentity(uint256 agentId) internal view returns (AgentIdentity storage) {
        AgentIdentity storage identity = _identities[agentId];
        if (identity.controller == address(0)) revert IdentityRegistry__UnknownAgent(agentId);
        return identity;
    }

    function _requireController(uint256 agentId, AgentIdentity storage identity, address caller) internal view {
        if (caller != identity.controller && caller != owner()) {
            revert IdentityRegistry__NotAgentController(agentId, caller);
        }
    }
}
