// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry public registry;
    address public owner;
    address public agentController;
    string public constant METADATA_URI = "ipfs://QmTest123";

    event AgentRegistered(uint256 indexed agentId, address indexed controller, string metadataURI);
    event AgentMetadataUpdated(uint256 indexed agentId, string metadataURI);
    event AgentStatusChanged(uint256 indexed agentId, bool active);

    function setUp() public {
        owner = address(this);
        agentController = address(0x1111);
        registry = new IdentityRegistry(owner);
    }

    function test_RegisterAgent() public {
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(1, agentController, METADATA_URI);

        uint256 agentId = registry.registerAgent(agentController, METADATA_URI);

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), agentController);
        assertEq(registry.tokenURI(agentId), METADATA_URI);
        assertEq(registry.agentIdByController(agentController), agentId);
        assertTrue(registry.isActive(agentId));
    }

    function test_RegisterAgent_RevertIf_ZeroController() public {
        vm.expectRevert("IdentityRegistry: controller zero");
        registry.registerAgent(address(0), METADATA_URI);
    }

    function test_RegisterAgent_RevertIf_ControllerExists() public {
        registry.registerAgent(agentController, METADATA_URI);

        vm.expectRevert(
            abi.encodeWithSelector(IdentityRegistry.IdentityRegistry__ControllerExists.selector, agentController)
        );
        registry.registerAgent(agentController, METADATA_URI);
    }

    function test_UpdateMetadata() public {
        uint256 agentId = registry.registerAgent(agentController, METADATA_URI);
        string memory newURI = "ipfs://QmNew456";

        vm.prank(agentController);
        vm.expectEmit(true, false, false, true);
        emit AgentMetadataUpdated(agentId, newURI);

        registry.updateMetadata(agentId, newURI);

        assertEq(registry.tokenURI(agentId), newURI);
    }

    function test_UpdateMetadata_RevertIf_NotController() public {
        uint256 agentId = registry.registerAgent(agentController, METADATA_URI);

        vm.expectRevert(
            abi.encodeWithSelector(
                IdentityRegistry.IdentityRegistry__NotAgentController.selector, agentId, address(0x9999)
            )
        );
        vm.prank(address(0x9999));
        registry.updateMetadata(agentId, "ipfs://QmNew");
    }

    function test_SetAgentStatus() public {
        uint256 agentId = registry.registerAgent(agentController, METADATA_URI);

        vm.expectEmit(true, false, false, true);
        emit AgentStatusChanged(agentId, false);

        registry.setAgentStatus(agentId, false);

        assertFalse(registry.isActive(agentId));
    }

    function test_MultipleAgents() public {
        uint256 agentId1 = registry.registerAgent(agentController, METADATA_URI);
        uint256 agentId2 = registry.registerAgent(address(0x2222), "ipfs://QmTwo");

        assertEq(agentId1, 1);
        assertEq(agentId2, 2);
        assertEq(registry.agentIdByController(agentController), 1);
        assertEq(registry.agentIdByController(address(0x2222)), 2);
    }

    function test_GetAgent() public {
        uint256 agentId = registry.registerAgent(agentController, METADATA_URI);

        IdentityRegistry.AgentIdentity memory identity = registry.getAgent(agentId);

        assertEq(identity.controller, agentController);
        assertEq(identity.metadataURI, METADATA_URI);
        assertTrue(identity.active);
    }

    function test_GetAgent_RevertIf_NotFound() public {
        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.IdentityRegistry__UnknownAgent.selector, uint256(999)));
        registry.getAgent(999);
    }
}

