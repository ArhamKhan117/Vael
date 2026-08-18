// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry, IIdentityRegistry} from "../src/erc8004/ReputationRegistry.sol";
import {ValidationRegistry, IIdentityRegistryMinimal} from "../src/erc8004/ValidationRegistry.sol";
import {AgentRegistryAdapter, IIdentityRegistryReader} from "../src/erc8004/AgentRegistryAdapter.sol";
import {QuestManager} from "../src/QuestManager.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";

import {VaelToken} from "../src/tokens/VaelToken.sol";

// These tests wire the real contracts together. QuestASC is stubbed as a plain address so the
// access control on recordCompletion is exercised without the proof path, which lands in milestone 3.

contract QuestManagerTest is Test {
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;
    AgentRegistryAdapter public agentRegistryAdapter;
    RewardVault public rewardVault;
    BadgeNFT public badgeNft;
    QuestManager public questManager;

    address public owner;
    address public agentController;
    address public participant;
    address public questASC;
    uint256 public agentId;

    function setUp() public {
        owner = address(this);
        agentController = address(0x1111);
        participant = address(0x2222);
        questASC = address(0x3333);

        // Deploy ERC-8004 registries
        identityRegistry = new IdentityRegistry(owner);
        IIdentityRegistry identityRegistryInterface = IIdentityRegistry(address(identityRegistry));
        reputationRegistry = new ReputationRegistry(owner, identityRegistryInterface);

        IIdentityRegistryMinimal identityRegistryMinimal = IIdentityRegistryMinimal(address(identityRegistry));
        validationRegistry = new ValidationRegistry(owner, identityRegistryMinimal);

        // Cast IdentityRegistry to IIdentityRegistryReader interface
        IIdentityRegistryReader identityReader = IIdentityRegistryReader(address(identityRegistry));
        agentRegistryAdapter = new AgentRegistryAdapter(identityReader);

        // Register agent
        agentId = identityRegistry.registerAgent(agentController, "ipfs://QmAgent");

        rewardVault = new RewardVault(owner);
        badgeNft = new BadgeNFT(owner);

        // Deploy QuestManager
        questManager = new QuestManager(
            owner, agentRegistryAdapter, rewardVault, badgeNft, reputationRegistry, validationRegistry
        );

        // Setup cross-contract references
        rewardVault.setQuestManager(address(questManager));
        badgeNft.setQuestManager(address(questManager));
        badgeNft.setBadgeURI(1, "ipfs://badge-level-1");
        reputationRegistry.setReviewerAuthorization(address(questManager), true);

        // Bind the QuestASC verifier (stubbed as a plain address in unit tests)
        questManager.setQuestASC(questASC);

        // Deploy VaelToken (ERC-20) for testing
        VaelToken vaelToken = new VaelToken(owner);
        // Grant MINTER_ROLE to RewardVault
        vaelToken.grantMinterRole(address(rewardVault));
        // Set VaelToken in RewardVault
        rewardVault.setVaelToken(address(vaelToken));
    }

    function test_CreateQuest_RevertIf_NoVaelToken() public {
        // Create new vault without vael token set
        RewardVault emptyVault = new RewardVault(owner);
        emptyVault.setQuestManager(address(questManager));

        QuestManager emptyQuestManager =
            new QuestManager(owner, agentRegistryAdapter, emptyVault, badgeNft, reputationRegistry, validationRegistry);

        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: address(0x2222222222222222222222222222222222222222),
            parametersHash: keccak256("minAmount:100"),
            metadataURI: "ipfs://QmQuest",
            rewardPerParticipant: 1000,
            expiry: 0,
            badgeLevel: 1,
            participant: participant
        });

        // Will revert because vaelToken is not set in RewardVault
        vm.expectRevert("QuestManager: reward vault uninitialized");
        vm.prank(agentController);
        emptyQuestManager.createQuest(params);
    }

    function test_CreateQuest() public {
        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: address(0x2222222222222222222222222222222222222222),
            parametersHash: keccak256("minAmount:100"),
            metadataURI: "ipfs://QmQuest",
            rewardPerParticipant: 1000,
            expiry: 0,
            badgeLevel: 1,
            participant: participant
        });

        vm.prank(agentController);
        uint256 questId = questManager.createQuest(params);

        assertEq(questId, 1);
        QuestManager.Quest memory quest = questManager.getQuest(questId);
        assertEq(quest.agentId, agentId);
        assertEq(quest.agentController, agentController);
        assertEq(uint256(quest.category), uint256(QuestManager.QuestCategory.Swap));
        assertEq(quest.rewardPerParticipant, 1000);
        assertEq(quest.assignedParticipant, participant);
    }

    function test_CreateQuest_RevertIf_NotAgent() public {
        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: address(0x2222222222222222222222222222222222222222),
            parametersHash: keccak256("test"),
            metadataURI: "ipfs://Qm",
            rewardPerParticipant: 1000,
            expiry: 0,
            badgeLevel: 1,
            participant: participant
        });

        vm.expectRevert();
        questManager.createQuest(params);
    }

    function test_AcceptQuest() public {
        uint256 questId = _createQuest();

        vm.prank(participant);
        questManager.acceptQuest(questId);

        QuestManager.ParticipantProgress memory progress = questManager.participantProgress(questId, participant);
        assertTrue(progress.accepted);
        assertFalse(progress.completed);

        QuestManager.Quest memory quest = questManager.getQuest(questId);
        assertEq(quest.acceptedCount, 1);
    }

    function test_AcceptQuest_RevertIf_UnauthorizedParticipant() public {
        uint256 questId = _createQuest();

        vm.expectRevert(
            abi.encodeWithSelector(QuestManager.QuestManager__UnauthorizedParticipant.selector, questId, address(0x9999))
        );
        vm.prank(address(0x9999));
        questManager.acceptQuest(questId);
    }

    function test_RecordCompletion() public {
        uint256 questId = _createQuest();

        vm.prank(participant);
        questManager.acceptQuest(questId);

        string memory evidenceURI = "ipfs://QmEvidence";

        vm.prank(questASC);
        questManager.recordCompletion(questId, participant, evidenceURI);

        QuestManager.ParticipantProgress memory progressAfter = questManager.participantProgress(questId, participant);
        assertTrue(progressAfter.accepted);
        assertTrue(progressAfter.completed);

        QuestManager.Quest memory quest = questManager.getQuest(questId);
        assertEq(quest.completedCount, 1);
        assertEq(uint256(quest.status), uint256(QuestManager.QuestStatus.Completed));
    }

    function test_RecordCompletion_RevertIf_NotQuestASC() public {
        uint256 questId = _createQuest();

        vm.prank(participant);
        questManager.acceptQuest(questId);

        vm.expectRevert(abi.encodeWithSelector(QuestManager.QuestManager__OnlyQuestASC.selector, address(0x9999)));
        vm.prank(address(0x9999));
        questManager.recordCompletion(questId, participant, "ipfs://Qm");
    }

    function test_RecordCompletion_RevertIf_ParticipantNotAccepted() public {
        uint256 questId = _createQuest();

        vm.expectRevert(
            abi.encodeWithSelector(QuestManager.QuestManager__ParticipantNotAccepted.selector, questId, participant)
        );
        vm.prank(questASC);
        questManager.recordCompletion(questId, participant, "ipfs://Qm");
    }

    function test_ReputationSubmitted_OnCompletion() public {
        uint256 questId = _createQuest();

        vm.prank(participant);
        questManager.acceptQuest(questId);

        string memory evidenceURI = "ipfs://QmEvidence";

        vm.prank(questASC);
        questManager.recordCompletion(questId, participant, evidenceURI);

        ReputationRegistry.Review[] memory reviews = reputationRegistry.getReviews(agentId);
        assertEq(reviews.length, 1);
        assertEq(reviews[0].score, 95);
    }

    function test_CancelQuest() public {
        uint256 questId = _createQuest();

        vm.prank(agentController);
        questManager.cancelQuest(questId);

        QuestManager.Quest memory quest = questManager.getQuest(questId);
        assertEq(uint256(quest.status), uint256(QuestManager.QuestStatus.Cancelled));
    }

    // Helper function
    function _createQuest() internal returns (uint256) {
        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: address(0x3333333333333333333333333333333333333333),
            parametersHash: keccak256("test"),
            metadataURI: "ipfs://QmQuest",
            rewardPerParticipant: 1000,
            expiry: 0,
            badgeLevel: 1,
            participant: participant
        });

        vm.prank(agentController);
        return questManager.createQuest(params);
    }
}

