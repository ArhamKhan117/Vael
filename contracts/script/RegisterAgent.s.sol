// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";

/**
 * @title RegisterAgent
 * @notice Register the quest-generating AI agent in the ERC-8004 IdentityRegistry.
 *
 * Usage:
 *   forge script script/RegisterAgent.s.sol:RegisterAgent --rpc-url creditcoin --broadcast
 *
 * Environment Variables:
 *   - DEPLOYER_PRIVATE_KEY: deployer key, owner of IdentityRegistry
 *   - IDENTITY_REGISTRY_ADDRESS: Address of deployed IdentityRegistry
 *   - AGENT_CONTROLLER_ADDRESS: Address that will control the agent (can be deployer or backend service)
 *   - AGENT_METADATA_URI: IPFS URI for the agent metadata document (JSON-LD)
 */
contract RegisterAgent is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address identityRegistryAddress = vm.envAddress("IDENTITY_REGISTRY_ADDRESS");
        address agentController = vm.envAddress("AGENT_CONTROLLER_ADDRESS");
        string memory metadataURI = vm.envString("AGENT_METADATA_URI");

        console.log("Deployer:", deployer);
        console.log("IdentityRegistry:", identityRegistryAddress);
        console.log("Agent Controller:", agentController);
        console.log("Metadata URI:", metadataURI);

        IdentityRegistry identityRegistry = IdentityRegistry(identityRegistryAddress);

        // Check if agent already registered
        uint256 existingAgentId = identityRegistry.agentIdByController(agentController);
        if (existingAgentId != 0) {
            console.log("\n[WARN] Agent already registered!");
            console.log("Agent ID:", existingAgentId);
            console.log("Agent Status (active):", identityRegistry.isActive(existingAgentId));
            console.log("Current Metadata URI:", identityRegistry.tokenURI(existingAgentId));
            console.log("\nTo update metadata, use UpdateAgentMetadata.s.sol script instead.");
            return;
        }

        // Register agent
        console.log("\n=== Registering QuestMaster AI Agent ===");
        vm.startBroadcast(deployerPrivateKey);
        uint256 agentId = identityRegistry.registerAgent(agentController, metadataURI);
        vm.stopBroadcast();

        console.log("\n[OK] Agent Registered Successfully!");
        console.log("Agent ID:", agentId);
        console.log("Agent Controller:", agentController);
        console.log("Metadata URI:", metadataURI);
        console.log("\n=== Next Steps ===");
        console.log("Agent can now create quests via QuestManager.createQuest()");
        console.log("Set AGENT_ID=", agentId, " in .env for backend usage");
    }
}

