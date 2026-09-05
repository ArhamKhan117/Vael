// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {AgentRegistryAdapter} from "./erc8004/AgentRegistryAdapter.sol";
import {RewardVault} from "./RewardVault.sol";
import {BadgeNFT} from "./BadgeNFT.sol";
import {ReputationRegistry} from "./erc8004/ReputationRegistry.sol";
import {ValidationRegistry} from "./erc8004/ValidationRegistry.sol";
import {ChainInfoLib, IChainInfo} from "./interfaces/IChainInfo.sol";
import {IQuestASC} from "./interfaces/IQuestASC.sol";
import {IQuestManager} from "./interfaces/IQuestManager.sol";
import {VaelTypes} from "./interfaces/IVaelTypes.sol";

/**
 * @title QuestManager
 * @notice Coordinates creation, acceptance, and completion of quests issued by ERC-8004 agents.
 *
 * @dev A quest completes exactly one way: `QuestASC` verifies an Attestcoin proof of the player's
 * source-chain transaction and calls `recordCompletion`. `onlyQuestASC` is the whole security
 * model, and `setQuestASC` is one-shot so no later owner action can redirect completions.
 *
 * Acceptance anchors the quest in source-chain time by reading the attested frontier from the
 * ChainInfo precompile. The action must land strictly above that height, so a player cannot accept
 * a quest and then claim a transaction they already made.
 */
contract QuestManager is Ownable, IQuestManager {
    enum QuestCategory {
        Swap,
        Liquidity,
        Stake,
        Lend
    }

    enum QuestStatus {
        Inactive,
        Active,
        Completed,
        Cancelled
    }

    struct Quest {
        uint256 agentId;
        address agentController;
        QuestCategory category;
        address protocol;
        bytes32 parametersHash; // hashed metadata for on-chain integrity check
        string metadataURI; // IPFS/Arweave pointer to JSON-LD quest description
        address rewardToken; // VAEL reward token address recorded for reference
        uint256 rewardPerParticipant;
        uint256 badgeLevel;
        address assignedParticipant;
        uint32 acceptedCount;
        uint32 completedCount;
        uint64 expiry;
        QuestStatus status;
        uint64 createdAt;
        /// @dev Attestcoin source chain key the action must happen on.
        uint64 sourceChainKey;
        /// @dev Campaign this quest pays from, or 0.
        uint256 campaignId;
    }

    struct ParticipantProgress {
        bool accepted;
        bool completed;
        /// @dev Attested source height at the moment of acceptance, read from the ChainInfo
        /// precompile. The proved action must sit strictly above it.
        uint64 acceptedAtSourceHeight;
    }

    struct CreateQuestParams {
        QuestCategory category;
        address protocol;
        bytes32 parametersHash;
        string metadataURI;
        uint256 rewardPerParticipant;
        uint64 expiry;
        uint256 badgeLevel;
        address participant;
        /// @dev Attestcoin source chain the action must happen on. Sepolia is 1.
        uint64 sourceChainKey;
        /// @dev Campaign this quest pays from, or 0 for a plain VAEL quest.
        uint256 campaignId;
        /// @dev What a proved log must look like. Forwarded to QuestASC at creation.
        VaelTypes.VerificationRule rule;
    }

    AgentRegistryAdapter public immutable AGENT_REGISTRY;
    RewardVault public immutable REWARD_VAULT;
    BadgeNFT public immutable BADGE_NFT;
    ReputationRegistry public immutable REPUTATION_REGISTRY;
    ValidationRegistry public immutable VALIDATION_REGISTRY;

    uint256 private _nextQuestId = 1;

    mapping(uint256 questId => Quest) private _quests;
    mapping(uint256 questId => mapping(address participant => ParticipantProgress)) private _participantProgress;
    /// @notice The only contract allowed to record completions for an Attestcoin-verified quest.
    /// @dev Set once, after deployment.
    address public questASC;

    /// @notice The only contract allowed to record completions for a Creditcoin-native quest.
    /// @dev Set once, for the same reason. A quest belongs to exactly one path: the rule's action
    /// type decides which, at creation, and nothing can move it afterwards.
    address public nativePortal;

    /// @notice The rule a native quest is judged against, read by NativePortal.
    /// @dev An Attestcoin quest's rule lives in QuestASC because that is what reads it. A native
    /// quest's has to live here, because NativePortal is handed the quest id and needs to know what
    /// the quest asked for before it does anything.
    mapping(uint256 questId => VaelTypes.VerificationRule) private _nativeRules;

    /// @notice Which path owns a quest, written at creation and never afterwards.
    /// @dev Explicit rather than inferred from the stored rule: inferring it would rest on "Portal
    /// is never native", which is true today and is exactly the kind of thing that stops being true
    /// quietly.
    mapping(uint256 questId => bool) public isNativeQuest;

    event QuestCreated(
        uint256 indexed questId,
        uint256 indexed agentId,
        address indexed agentController,
        QuestCategory category,
        address protocol
    );
    event QuestAccepted(
        uint256 indexed questId,
        address indexed participant,
        uint64 sourceChainKey,
        uint64 acceptedAtSourceHeight
    );
    event QuestCompleted(
        uint256 indexed questId,
        address indexed participant,
        bytes32 indexed replayKey,
        bytes32 sourceTxHash
    );
    event QuestCancelled(uint256 indexed questId);
    event QuestASCUpdated(address indexed questASC);
    event NativePortalUpdated(address indexed nativePortal);

    error QuestManager__OnlyQuestASC(address caller);
    error QuestManager__WrongCompleter(address caller, address expected);
    error QuestManager__NativePortalAlreadySet(address current);
    error QuestManager__InvalidNativePortal();
    error QuestManager__NativePortalNotSet();
    error QuestManager__QuestASCAlreadySet(address current);
    error QuestManager__InvalidQuestASC();
    error QuestManager__QuestNotActive(uint256 questId);
    error QuestManager__QuestExpired(uint256 questId);
    error QuestManager__QuestNotFound(uint256 questId);
    error QuestManager__AlreadyAccepted(uint256 questId, address participant);
    error QuestManager__AlreadyCompleted(uint256 questId, address participant);
    error QuestManager__ParticipantNotAccepted(uint256 questId, address participant);
    error QuestManager__UnauthorizedParticipant(uint256 questId, address participant);
    error QuestManager__OnlyAgentController(uint256 questId, address caller);
    error QuestManager__QuestASCNotSet();
    error QuestManager__SourceChainNotAttested(uint64 sourceChainKey);

    modifier onlyQuestASC() {
        if (msg.sender != questASC) revert QuestManager__OnlyQuestASC(msg.sender);
        _;
    }

    constructor(
        address owner_,
        AgentRegistryAdapter agentRegistry,
        RewardVault rewardVault,
        BadgeNFT badgeNft,
        ReputationRegistry reputationRegistry,
        ValidationRegistry validationRegistry
    ) Ownable(owner_) {
        AGENT_REGISTRY = agentRegistry;
        REWARD_VAULT = rewardVault;
        BADGE_NFT = badgeNft;
        REPUTATION_REGISTRY = reputationRegistry;
        VALIDATION_REGISTRY = validationRegistry;
    }

    // ---------------------- Quest lifecycle ----------------------

    function createQuest(CreateQuestParams calldata params) external returns (uint256 questId) {
        uint256 agentId = AGENT_REGISTRY.requireValidAgent(msg.sender);
        if (params.rewardPerParticipant == 0) revert("QuestManager: zero reward");
        if (params.participant == address(0)) revert("QuestManager: participant missing");
        if (params.expiry != 0 && params.expiry <= block.timestamp) revert("QuestManager: invalid expiry");

        address rewardTokenAddress = address(REWARD_VAULT.vaelToken());
        require(rewardTokenAddress != address(0), "QuestManager: reward vault uninitialized");

        questId = _nextQuestId;
        _nextQuestId += 1;

        Quest storage quest = _quests[questId];
        quest.agentId = agentId;
        quest.agentController = msg.sender;
        quest.category = params.category;
        quest.protocol = params.protocol;
        quest.parametersHash = params.parametersHash;
        quest.metadataURI = params.metadataURI;
        quest.rewardToken = rewardTokenAddress;
        quest.rewardPerParticipant = params.rewardPerParticipant;
        quest.badgeLevel = params.badgeLevel;
        quest.assignedParticipant = params.participant;
        quest.expiry = params.expiry;
        quest.status = QuestStatus.Active;
        quest.createdAt = uint64(block.timestamp);
        quest.sourceChainKey = params.sourceChainKey;
        quest.campaignId = params.campaignId;

        // A campaign quest is paid by the partner's escrow and an ordinary quest by the protocol's
        // vault. Never both. Funding the vault for a campaign quest would mint VAEL that nothing
        // could ever release, and releasing it at completion paid the player twice: once out of
        // the vault and once out of the pool the partner deposited.
        if (params.campaignId == 0) {
            REWARD_VAULT.fundQuest(questId, params.rewardPerParticipant);
        }

        // The rule is registered at creation either way, so a quest can never exist without the
        // rule that governs it. Where it goes depends on which path will complete the quest, and
        // that is decided here, once, by the action type.
        if (uint8(params.rule.actionType) >= VaelTypes.FIRST_NATIVE_ACTION) {
            if (nativePortal == address(0)) revert QuestManager__NativePortalNotSet();
            isNativeQuest[questId] = true;
            _nativeRules[questId] = params.rule;
        } else {
            if (questASC == address(0)) revert QuestManager__QuestASCNotSet();
            IQuestASC(questASC).setRule(questId, params.sourceChainKey, params.rule);
        }

        emit QuestCreated(questId, agentId, msg.sender, params.category, params.protocol);
    }

    function getQuest(uint256 questId) external view returns (Quest memory) {
        Quest memory quest = _quests[questId];
        if (quest.agentController == address(0)) revert QuestManager__QuestNotFound(questId);
        return quest;
    }

    function acceptQuest(uint256 questId) external {
        Quest storage quest = _quests[questId];
        if (quest.agentController == address(0)) revert QuestManager__QuestNotFound(questId);
        if (quest.status != QuestStatus.Active) revert QuestManager__QuestNotActive(questId);
        if (quest.expiry != 0 && block.timestamp > quest.expiry) revert QuestManager__QuestExpired(questId);

        ParticipantProgress storage progress = _participantProgress[questId][msg.sender];
        if (quest.assignedParticipant != msg.sender) {
            revert QuestManager__UnauthorizedParticipant(questId, msg.sender);
        }
        if (progress.accepted) revert QuestManager__AlreadyAccepted(questId, msg.sender);

        progress.accepted = true;
        quest.acceptedCount += 1;

        // Anchor the quest in source-chain time. Reading the attested frontier rather than a
        // caller-supplied height is what stops a player accepting a quest and then claiming a
        // transaction they already made: the proved action must sit strictly above this.
        //
        // A native quest has no source chain and therefore no frontier to read. It does not need
        // one: the action it asks for is performed inside the transaction that completes it, so
        // there is no earlier transaction to reach back for. Anchoring it to Creditcoin's own
        // height would be a number that looks like the protection and is not.
        uint64 anchor = 0;
        if (!isNativeQuest[questId]) {
            IChainInfo.HeightHashResult memory frontier =
                ChainInfoLib.chainInfo().get_latest_attestation_height_and_hash(quest.sourceChainKey);
            if (!frontier.exists) revert QuestManager__SourceChainNotAttested(quest.sourceChainKey);
            anchor = frontier.height;
        }
        progress.acceptedAtSourceHeight = anchor;

        emit QuestAccepted(questId, msg.sender, quest.sourceChainKey, anchor);
    }

    /**
     * @notice Record a verified quest completion. The caller must be QuestASC, which only
     *         reaches this point after the Attestcoin block prover has verified the source
     *         transaction on Creditcoin. There is no trusted off-chain completion path.
     */
    function recordCompletion(
        uint256 questId,
        address participant,
        bytes32 replayKey,
        bytes32 sourceTxHash
    ) external {
        Quest storage quest = _quests[questId];
        if (quest.agentController == address(0)) revert QuestManager__QuestNotFound(questId);

        // One quest, one path, decided at creation. QuestASC cannot complete a native quest and
        // NativePortal cannot complete a proved one, so neither can stand in for the other and
        // neither is a general-purpose completion key.
        address expected = isNativeQuest[questId] ? nativePortal : questASC;
        if (msg.sender != expected) revert QuestManager__WrongCompleter(msg.sender, expected);

        if (quest.status != QuestStatus.Active) revert QuestManager__QuestNotActive(questId);
        if (quest.expiry != 0 && block.timestamp > quest.expiry) revert QuestManager__QuestExpired(questId);

        ParticipantProgress storage progress = _participantProgress[questId][participant];
        if (participant != quest.assignedParticipant) {
            revert QuestManager__UnauthorizedParticipant(questId, participant);
        }
        if (!progress.accepted) revert QuestManager__ParticipantNotAccepted(questId, participant);
        if (progress.completed) revert QuestManager__AlreadyCompleted(questId, participant);

        progress.completed = true;
        quest.completedCount += 1;

        // The other half of the same rule: the escrow pays a campaign quest, through QuestASC,
        // immediately after this call returns.
        if (quest.campaignId == 0) {
            REWARD_VAULT.releaseReward(questId, participant, quest.rewardPerParticipant);
        }
        // Mint badge NFT with metadata URI
        BADGE_NFT.mintBadge(participant, questId, quest.badgeLevel);

        // Reputation for the agent that created this quest. The evidence is the proof itself:
        // the source transaction hash and the replay key that verifying it produced.
        string memory evidenceURI = string(
            abi.encodePacked("attestcoin:tx:", _toHexString(sourceTxHash))
        );
        string memory paymentRef = string(abi.encodePacked("quest:", _uint256ToString(questId), ":completed"));
        REPUTATION_REGISTRY.submitReview(quest.agentId, questId, 95, evidenceURI, paymentRef);

        emit QuestCompleted(questId, participant, replayKey, sourceTxHash);
        quest.status = QuestStatus.Completed;
    }

    // ---------------------- Views for QuestASC ----------------------

    /// @inheritdoc IQuestManager
    function verificationContext(uint256 questId)
        external
        view
        returns (QuestVerificationContext memory context)
    {
        Quest storage quest = _quests[questId];
        context.exists = quest.agentController != address(0);
        context.active = quest.status == QuestStatus.Active;
        context.assignedParticipant = quest.assignedParticipant;
        context.expiry = quest.expiry;
        context.sourceChainKey = quest.sourceChainKey;
        context.campaignId = quest.campaignId;
        context.rewardPerParticipant = quest.rewardPerParticipant;
    }

    /// @inheritdoc IQuestManager
    function acceptedAtSourceHeight(uint256 questId, address participant)
        external
        view
        returns (uint64)
    {
        return _participantProgress[questId][participant].acceptedAtSourceHeight;
    }

    /// @inheritdoc IQuestManager
    function hasAccepted(uint256 questId, address participant) external view returns (bool) {
        return _participantProgress[questId][participant].accepted;
    }

    // ---------------------- Lifecycle ----------------------

    function cancelQuest(uint256 questId) external {
        Quest storage quest = _quests[questId];
        if (quest.agentController == address(0)) revert QuestManager__QuestNotFound(questId);
        if (msg.sender != quest.agentController && msg.sender != owner()) {
            revert QuestManager__OnlyAgentController(questId, msg.sender);
        }
        if (quest.status == QuestStatus.Cancelled || quest.status == QuestStatus.Completed) {
            return;
        }
        quest.status = QuestStatus.Cancelled;
        emit QuestCancelled(questId);
    }

    // ---------------------- Admin ----------------------

    /**
     * @notice Bind this manager to its QuestASC verifier. One-shot and irreversible, so no
     *         later owner action can redirect completions to an unverified caller.
     */
    /// @notice Bind the native completion path. Set once, like QuestASC.
    /// @dev NativePortal executes a Creditcoin action itself and completes the quest in the same
    /// transaction. It is not a trusted reporter: it is the contract that did the thing, and it
    /// can only complete quests whose rule said they were native.
    function setNativePortal(address nativePortal_) external onlyOwner {
        if (nativePortal_ == address(0)) revert QuestManager__InvalidNativePortal();
        if (nativePortal != address(0)) revert QuestManager__NativePortalAlreadySet(nativePortal);
        nativePortal = nativePortal_;
        emit NativePortalUpdated(nativePortal_);
    }

    /// @notice The rule a native quest is judged against.
    function nativeRule(uint256 questId) external view returns (VaelTypes.VerificationRule memory) {
        return _nativeRules[questId];
    }

    function setQuestASC(address questASC_) external onlyOwner {
        if (questASC_ == address(0)) revert QuestManager__InvalidQuestASC();
        if (questASC != address(0)) revert QuestManager__QuestASCAlreadySet(questASC);
        questASC = questASC_;
        emit QuestASCUpdated(questASC_);
    }

    function participantProgress(uint256 questId, address participant)
        external
        view
        returns (ParticipantProgress memory)
    {
        return _participantProgress[questId][participant];
    }

    // Helper to convert uint256 to string for payment reference
    /// @dev Lowercase hex of a bytes32, used to build the evidence URI from the source tx hash.
    function _toHexString(bytes32 value) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 32; ++i) {
            out[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            out[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(out);
    }

    function _uint256ToString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            // forge-lint: disable-next-line(unsafe-typecast)
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
