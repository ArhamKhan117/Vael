// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {QuestManager} from "../src/QuestManager.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";

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
 *   - SOURCE_CHAIN_KEY: Attestcoin source chain, 1 for Sepolia (default 1)
 *   - CAMPAIGN_ID: Campaign to pay from, 0 for a plain VAEL quest (default 0)
 *   - RULE_ACTION_TYPE: 0 Portal, 1 UniswapSwap, 2 Erc20Transfer, 3 AaveSupply, 4 AaveBorrow
 *   - RULE_EMITTER, RULE_TOKEN, RULE_MIN_AMOUNT, RULE_MIN_SOURCE_BLOCK, RULE_MAX_SOURCE_BLOCK,
 *     RULE_PLAYER_MUST_MATCH: the verification rule QuestASC enforces against the proved log
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
            participant: questParticipant,
            sourceChainKey: uint64(vm.envOr("SOURCE_CHAIN_KEY", uint256(1))),
            campaignId: vm.envOr("CAMPAIGN_ID", uint256(0)),
            rule: VaelTypes.VerificationRule({
                actionType: VaelTypes.ActionType(vm.envOr("RULE_ACTION_TYPE", uint256(0))),
                emitter: vm.envOr("RULE_EMITTER", address(0)),
                token: vm.envOr("RULE_TOKEN", address(0)),
                minAmount: vm.envOr("RULE_MIN_AMOUNT", uint256(0)),
                minSourceBlock: uint64(vm.envOr("RULE_MIN_SOURCE_BLOCK", uint256(0))),
                maxSourceBlock: uint64(vm.envOr("RULE_MAX_SOURCE_BLOCK", uint256(0))),
                playerMustMatch: vm.envOr("RULE_PLAYER_MUST_MATCH", true)
            })
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

