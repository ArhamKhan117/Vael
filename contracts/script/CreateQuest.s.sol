// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {QuestManager} from "../src/QuestManager.sol";

/**
 * @title CreateQuest
 * @notice Create one quest through the registered ERC-8004 agent.
 *
 * Usage:
 *   forge script script/CreateQuest.s.sol:CreateQuest --rpc-url creditcoin --broadcast
 *
 * Environment Variables:
 *   - DEPLOYER_PRIVATE_KEY: agent controller key, must be a registered agent
 *   - QUEST_MANAGER_ADDRESS: Address of deployed QuestManager
 *   - QUEST_CATEGORY: 0=Swap, 1=Liquidity, 2=Stake, 3=Lend
 *   - QUEST_PROTOCOL: Address of DeFi protocol contract
 *   - QUEST_METADATA_URI: IPFS URI for the quest metadata document
 *   - QUEST_PARAMETERS_HASH: keccak256 hash of quest parameters JSON (bytes32)
 *   - REWARD_PER_PARTICIPANT: Reward in VAEL (18 decimals)
 *   - EXPIRY_TIMESTAMP: Unix timestamp for quest expiry (0 = no expiry)
 *   - BADGE_LEVEL: Badge level awarded on completion (1-10)
 *   - QUEST_PARTICIPANT: Address of the player this quest is assigned to
 */
contract CreateQuest is Script {
    function run() external {
        uint256 agentControllerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address agentController = vm.addr(agentControllerPrivateKey);

        address questManagerAddress = vm.envAddress("QUEST_MANAGER_ADDRESS");
        QuestManager.QuestCategory category = QuestManager.QuestCategory(vm.envUint("QUEST_CATEGORY"));
        address protocol = vm.envAddress("QUEST_PROTOCOL");
        bytes32 parametersHash = vm.envBytes32("QUEST_PARAMETERS_HASH");
        string memory metadataURI = vm.envString("QUEST_METADATA_URI");
        uint256 rewardPerParticipant = vm.envUint("REWARD_PER_PARTICIPANT");
        uint64 expiry = uint64(vm.envUint("EXPIRY_TIMESTAMP"));
        uint256 badgeLevel = vm.envUint("BADGE_LEVEL");
        address questParticipant = vm.envAddress("QUEST_PARTICIPANT");

        console.log("Agent Controller:", agentController);
        console.log("QuestManager:", questManagerAddress);
        console.log("Category:", uint256(category));
        console.log("Protocol:", protocol);
        console.log("Parameters Hash:", vm.toString(parametersHash));
        console.log("Metadata URI:", metadataURI);
        console.log("Reward per Participant:", rewardPerParticipant);
        console.log("Expiry:", expiry);
        console.log("Badge Level:", badgeLevel);
        console.log("Quest Participant:", questParticipant);

        QuestManager questManager = QuestManager(questManagerAddress);

        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: category,
            protocol: protocol,
            parametersHash: parametersHash,
            metadataURI: metadataURI,
            rewardPerParticipant: rewardPerParticipant,
            expiry: expiry,
            badgeLevel: badgeLevel,
            participant: questParticipant
        });

        console.log("\n=== Creating Quest ===");
        vm.startBroadcast(agentControllerPrivateKey);
        uint256 questId = questManager.createQuest(params);
        vm.stopBroadcast();

        console.log("\n[OK] Quest Created Successfully!");
        console.log("Quest ID:", questId);
        console.log("\n=== Quest Details ===");
        QuestManager.Quest memory quest = questManager.getQuest(questId);
        console.log("Agent ID:", quest.agentId);
        console.log("Status:", uint256(quest.status));
        console.log("Created At:", quest.createdAt);
        console.log("\n=== Next Steps ===");
        console.log("Participant assigned:", quest.assignedParticipant);
    }
}

