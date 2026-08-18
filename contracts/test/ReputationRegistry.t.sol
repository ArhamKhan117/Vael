// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry, IIdentityRegistry} from "../src/erc8004/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    address public owner;
    address public reviewer;
    address public agentController;
    uint256 public agentId;

    function setUp() public {
        owner = address(this);
        reviewer = address(0x1111);
        agentController = address(0x2222);

        identityRegistry = new IdentityRegistry(owner);
        IIdentityRegistry identityRegistryInterface = IIdentityRegistry(address(identityRegistry));
        reputationRegistry = new ReputationRegistry(owner, identityRegistryInterface);

        // Register an agent
        agentId = identityRegistry.registerAgent(agentController, "ipfs://QmAgent");

        // Authorize reviewer
        reputationRegistry.setReviewerAuthorization(reviewer, true);
    }

    function test_SubmitReview() public {
        uint256 questId = 1;
        uint8 score = 85;
        string memory metadataURI = "ipfs://QmReview";
        string memory paymentRef = "tx:0x123";

        vm.expectEmit(true, true, true, true);
        emit ReputationRegistry.ReviewSubmitted(agentId, questId, reviewer, score, metadataURI);

        vm.prank(reviewer);
        reputationRegistry.submitReview(agentId, questId, score, metadataURI, paymentRef);

        ReputationRegistry.Review[] memory reviews = reputationRegistry.getReviews(agentId);
        assertEq(reviews.length, 1);
        assertEq(reviews[0].questId, questId);
        assertEq(reviews[0].score, score);
        assertEq(reviews[0].metadataURI, metadataURI);
        assertEq(reviews[0].reviewer, reviewer);

        uint256 avgScore = reputationRegistry.getAverageScore(agentId);
        assertEq(avgScore, 85);
    }

    function test_SubmitReview_RevertIf_Unauthorized() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                ReputationRegistry.ReputationRegistry__UnauthorizedReviewer.selector, address(0x9999)
            )
        );
        vm.prank(address(0x9999));
        reputationRegistry.submitReview(agentId, 1, 90, "ipfs://Qm", "ref");
    }

    function test_SubmitReview_RevertIf_AgentInactive() public {
        identityRegistry.setAgentStatus(agentId, false);

        vm.expectRevert(abi.encodeWithSelector(ReputationRegistry.ReputationRegistry__AgentInactive.selector, agentId));
        vm.prank(reviewer);
        reputationRegistry.submitReview(agentId, 1, 90, "ipfs://Qm", "ref");
    }

    function test_SubmitReview_RevertIf_InvalidScore() public {
        vm.expectRevert(
            abi.encodeWithSelector(ReputationRegistry.ReputationRegistry__InvalidScore.selector, uint8(101))
        );
        vm.prank(reviewer);
        reputationRegistry.submitReview(agentId, 1, 101, "ipfs://Qm", "ref");
    }

    function test_MultipleReviews_Average() public {
        vm.prank(reviewer);
        reputationRegistry.submitReview(agentId, 1, 80, "ipfs://Qm1", "ref1");

        vm.prank(reviewer);
        reputationRegistry.submitReview(agentId, 2, 90, "ipfs://Qm2", "ref2");

        vm.prank(reviewer);
        reputationRegistry.submitReview(agentId, 3, 100, "ipfs://Qm3", "ref3");

        uint256 avgScore = reputationRegistry.getAverageScore(agentId);
        assertEq(avgScore, 90); // (80 + 90 + 100) / 3 = 90

        ReputationRegistry.Aggregate memory agg = reputationRegistry.getAggregate(agentId);
        assertEq(agg.count, 3);
        assertEq(agg.totalScore, 270);
    }

    function test_GetAverageScore_ZeroIf_NoReviews() public view {
        uint256 avgScore = reputationRegistry.getAverageScore(999);
        assertEq(avgScore, 0);
    }
}

