// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityRegistry {
    function isActive(uint256 agentId) external view returns (bool);
}

/**
 * @title ReputationRegistry
 * @notice Minimal ERC-8004 compliant registry to capture structured feedback for AI agents.
 */
contract ReputationRegistry is Ownable {
    struct Review {
        uint256 questId;
        uint8 score; // 0 - 100 (percentage style)
        string metadataURI; // IPFS/Arweave evidence or structured review payload
        string paymentReference; // optional reference to x402 receipt or on-chain tx
        uint256 timestamp;
        address reviewer;
    }

    struct Aggregate {
        uint256 count;
        uint256 totalScore; // sum of all scores for average calculation
    }

    mapping(uint256 agentId => Review[]) private _reviews;
    mapping(uint256 agentId => Aggregate) private _aggregates;

    mapping(address => bool) private _authorizedReviewers; // typically QuestManager
    IIdentityRegistry public immutable IDENTITY_REGISTRY;

    event ReviewerAuthorizationChanged(address indexed reviewer, bool authorized);
    event ReviewSubmitted(
        uint256 indexed agentId, uint256 indexed questId, address indexed reviewer, uint8 score, string metadataURI
    );

    error ReputationRegistry__AgentInactive(uint256 agentId);
    error ReputationRegistry__UnauthorizedReviewer(address reviewer);
    error ReputationRegistry__InvalidScore(uint8 score);

    constructor(address owner_, IIdentityRegistry identityRegistry_) Ownable(owner_) {
        IDENTITY_REGISTRY = identityRegistry_;
    }

    function setReviewerAuthorization(address reviewer, bool authorized) external onlyOwner {
        _authorizedReviewers[reviewer] = authorized;
        emit ReviewerAuthorizationChanged(reviewer, authorized);
    }

    function isReviewerAuthorized(address reviewer) external view returns (bool) {
        return _authorizedReviewers[reviewer];
    }

    function submitReview(
        uint256 agentId,
        uint256 questId,
        uint8 score,
        string calldata metadataURI,
        string calldata paymentReference
    ) external {
        if (!_authorizedReviewers[msg.sender]) {
            revert ReputationRegistry__UnauthorizedReviewer(msg.sender);
        }
        if (!IDENTITY_REGISTRY.isActive(agentId)) revert ReputationRegistry__AgentInactive(agentId);
        if (score > 100) revert ReputationRegistry__InvalidScore(score);

        Review memory review = Review({
            questId: questId,
            score: score,
            metadataURI: metadataURI,
            paymentReference: paymentReference,
            timestamp: block.timestamp,
            reviewer: msg.sender
        });

        _reviews[agentId].push(review);
        Aggregate storage agg = _aggregates[agentId];
        agg.count += 1;
        agg.totalScore += score;

        emit ReviewSubmitted(agentId, questId, msg.sender, score, metadataURI);
    }

    function getReviews(uint256 agentId) external view returns (Review[] memory) {
        return _reviews[agentId];
    }

    function getAggregate(uint256 agentId) external view returns (Aggregate memory) {
        return _aggregates[agentId];
    }

    function getAverageScore(uint256 agentId) external view returns (uint256) {
        Aggregate memory agg = _aggregates[agentId];
        if (agg.count == 0) {
            return 0;
        }
        return agg.totalScore / agg.count;
    }
}
