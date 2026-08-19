// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {VaelAscBase} from "./asc/VaelAscBase.sol";
import {IQuestManager} from "./interfaces/IQuestManager.sol";
import {IQuestASC} from "./interfaces/IQuestASC.sol";
import {VaelTypes} from "./interfaces/IVaelTypes.sol";

interface ICampaignEscrow {
    function releaseReward(bytes32 campaignId, address recipient, uint256 amount) external;
}

/// @title QuestASC
/// @notice The only contract that can complete a Vael quest.
///
/// @dev Everything downstream of this contract is gated on it: `QuestManager.recordCompletion`,
/// and campaign escrow payouts. Nothing here trusts its caller. The submitter supplies proof
/// material and, at most, a quest id hint that can only narrow what is accepted.
///
/// The order of checks in the portal handler is deliberate. Emitter first, because a log from an
/// unregistered contract is somebody else's event and must not reach any quest logic. Then the
/// quest context, then the player binding, then the amount, then the block window. Each one is a
/// separate named revert so a failed submission says which rule it broke.
contract QuestASC is VaelAscBase, Ownable, IQuestASC {
    /// @notice `QuestActionPerformed(uint256,address,uint8,address,uint256)`.
    bytes32 public constant PORTAL_TOPIC =
        0x3ffa602a6835802daaea4f4c4102da0a312d481769471dd020a1512afd9d8022;

    /// @notice The quest manager whose quests this contract completes.
    IQuestManager public immutable QUEST_MANAGER;

    /// @notice Campaign escrow used for partner-funded quests. May be unset.
    ICampaignEscrow public campaignEscrow;

    /// @notice The Vael QuestPortal deployed on each source chain.
    /// @dev Keyed by chain because the same address exists on more than one chain, and a deployer
    /// controls its own testnet addresses. Authorising on the emitter alone would let a deployment
    /// at a matching address on another chain manufacture completions.
    mapping(uint64 chainKey => address) public questPortal;

    /// @notice Emitters this deployment accepts per action type, per chain.
    /// @dev Used by action types whose emitter is a third party, such as a Uniswap pool. The portal
    /// path does not consult this: it requires the exact registered portal.
    mapping(uint64 chainKey => mapping(VaelTypes.ActionType => mapping(address => bool)))
        public allowedEmitters;

    /// @notice Verification rule per quest, written by QuestManager at quest creation.
    mapping(uint256 questId => VaelTypes.VerificationRule) public rules;

    /// @notice Source chain each quest's action must happen on.
    mapping(uint256 questId => uint64) public questSourceChainKey;

    /// @notice Whether a rule was ever registered for a quest.
    mapping(uint256 questId => bool) public ruleExists;

    event QuestProofApplied(
        uint256 indexed questId,
        address indexed player,
        VaelTypes.ActionType indexed actionType,
        bytes32 replayKey,
        uint64 sourceBlock,
        uint256 amount
    );
    event RuleRegistered(uint256 indexed questId, uint64 sourceChainKey, VaelTypes.ActionType actionType);
    event QuestPortalRegistered(uint64 indexed chainKey, address indexed portal);
    event EmitterAllowed(uint64 indexed chainKey, VaelTypes.ActionType indexed actionType, address indexed emitter, bool allowed);
    event CampaignEscrowUpdated(address indexed escrow);

    error OnlyQuestManager(address caller);
    error ActionNotYetSupported(VaelTypes.ActionType actionType);
    error RuleAlreadyRegistered(uint256 questId);
    error NoRuleForQuest(uint256 questId);
    error QuestNotOpen(uint256 questId);
    error QuestHintMismatch(uint256 hinted, uint256 fromLog);
    error WrongSourceChain(uint256 questId, uint64 expected, uint64 provided);
    error WrongEmitter(address expected, address provided);
    error PlayerMismatch(address expected, address decoded);
    error ParticipantHasNotAccepted(uint256 questId, address player);
    error AmountBelowMinimum(uint256 required, uint256 provided);
    error WrongToken(address required, address provided);
    error SourceBlockTooEarly(uint64 provided, uint64 mustExceed);
    error SourceBlockTooLate(uint64 provided, uint64 maximum);
    error MalformedPortalLog();
    error InvalidAddress();

    modifier onlyQuestManager() {
        if (msg.sender != address(QUEST_MANAGER)) revert OnlyQuestManager(msg.sender);
        _;
    }

    constructor(address owner_, IQuestManager questManager_) Ownable(owner_) {
        if (address(questManager_) == address(0)) revert InvalidAddress();
        QUEST_MANAGER = questManager_;
    }

    // ---------------------------------------------------------------- admin

    /// @notice Register the Vael QuestPortal for a source chain.
    function setQuestPortal(uint64 chainKey, address portal) external onlyOwner {
        if (portal == address(0)) revert InvalidAddress();
        questPortal[chainKey] = portal;
        emit QuestPortalRegistered(chainKey, portal);
    }

    /// @notice Allow or disallow a third-party emitter for an action type on a chain.
    function setAllowedEmitter(
        uint64 chainKey,
        VaelTypes.ActionType actionType,
        address emitter,
        bool allowed
    ) external onlyOwner {
        if (emitter == address(0)) revert InvalidAddress();
        allowedEmitters[chainKey][actionType][emitter] = allowed;
        emit EmitterAllowed(chainKey, actionType, emitter, allowed);
    }

    function setCampaignEscrow(address escrow) external onlyOwner {
        campaignEscrow = ICampaignEscrow(escrow);
        emit CampaignEscrowUpdated(escrow);
    }

    // ---------------------------------------------------------------- rules

    /// @inheritdoc IQuestASC
    /// @dev Write-once per quest. A rule that could be rewritten after a player accepted would let
    /// the terms of a quest change under them.
    function setRule(uint256 questId, uint64 sourceChainKey, VaelTypes.VerificationRule calldata rule)
        external
        onlyQuestManager
    {
        if (ruleExists[questId]) revert RuleAlreadyRegistered(questId);
        ruleExists[questId] = true;
        rules[questId] = rule;
        questSourceChainKey[questId] = sourceChainKey;
        emit RuleRegistered(questId, sourceChainKey, rule.actionType);
    }

    // ---------------------------------------------------------------- base hooks

    /// @inheritdoc VaelAscBase
    /// @dev A chain is supported once its portal is registered. milestone 3b widens this to chains that
    /// only carry third-party emitters.
    function _isSupportedChainKey(uint64 chainKey) internal view override returns (bool) {
        return questPortal[chainKey] != address(0);
    }

    /// @inheritdoc VaelAscBase
    function _isRecognised(uint64 chainKey, EvmV1Decoder.LogEntry memory logEntry)
        internal
        view
        override
        returns (bool)
    {
        bytes32 topic0 = logEntry.topics[0];
        if (topic0 == PORTAL_TOPIC) {
            return logEntry.address_ == questPortal[chainKey];
        }
        return false;
    }

    /// @inheritdoc VaelAscBase
    /// @dev Dispatch is on `topics[0]` of a log that has already been proved, never on anything the
    /// caller supplied.
    function _handleRecognisedLog(
        uint64 chainKey,
        uint64 blockHeight,
        bytes32 key,
        EvmV1Decoder.LogEntry memory logEntry,
        uint256 questIdHint
    ) internal override {
        if (logEntry.topics[0] == PORTAL_TOPIC) {
            _handlePortal(chainKey, blockHeight, key, logEntry, questIdHint);
            return;
        }
        // Unreachable while _isRecognised only accepts the portal topic. Kept so that adding a
        // topic to the recogniser without adding a handler fails loudly rather than silently.
        revert ActionNotYetSupported(VaelTypes.ActionType.UniswapSwap);
    }

    // ---------------------------------------------------------------- portal

    /// @dev `QuestActionPerformed(uint256 indexed questId, address indexed player,
    ///      uint8 indexed actionType, address token, uint256 amount)`.
    function _handlePortal(
        uint64 chainKey,
        uint64 blockHeight,
        bytes32 key,
        EvmV1Decoder.LogEntry memory logEntry,
        uint256 questIdHint
    ) private {
        // The emitter was already matched against the registered portal in _isRecognised, but the
        // check is repeated here because this function is what releases money and must not depend
        // on a caller of it having done the right thing.
        address portal = questPortal[chainKey];
        if (logEntry.address_ != portal) revert WrongEmitter(portal, logEntry.address_);

        if (logEntry.topics.length < 4 || logEntry.data.length < 64) revert MalformedPortalLog();

        uint256 questId = uint256(logEntry.topics[1]);
        // Player identity comes from the indexed topic, never from the transaction's `from` field,
        // which is the gas payer and differs behind routers and smart accounts.
        address player = address(uint160(uint256(logEntry.topics[2])));
        (address token, uint256 amount) = abi.decode(logEntry.data, (address, uint256));

        // A hint may only narrow. It cannot select a different quest than the log names.
        if (questIdHint != 0 && questIdHint != questId) revert QuestHintMismatch(questIdHint, questId);

        _applyCompletion(
            questId, player, token, amount, chainKey, blockHeight, key, VaelTypes.ActionType.Portal
        );
    }

    /// @dev Shared tail: every rule check, then the payout. Split out so future action handlers
    /// cannot accidentally skip one of these.
    function _applyCompletion(
        uint256 questId,
        address player,
        address token,
        uint256 amount,
        uint64 chainKey,
        uint64 blockHeight,
        bytes32 key,
        VaelTypes.ActionType actionType
    ) private {
        if (!ruleExists[questId]) revert NoRuleForQuest(questId);
        VaelTypes.VerificationRule memory rule = rules[questId];
        _requireSupportedAction(rule.actionType);
        if (rule.actionType != actionType) revert ActionNotYetSupported(rule.actionType);

        uint64 expectedChain = questSourceChainKey[questId];
        if (expectedChain != chainKey) revert WrongSourceChain(questId, expectedChain, chainKey);

        IQuestManager.QuestVerificationContext memory context =
            QUEST_MANAGER.verificationContext(questId);
        if (!context.exists || !context.active) revert QuestNotOpen(questId);

        // Player binding. The accepting participant is read from QuestManager, not from the caller.
        address participant = context.assignedParticipant;
        if (rule.playerMustMatch && player != participant) revert PlayerMismatch(participant, player);
        if (!QUEST_MANAGER.hasAccepted(questId, participant)) {
            revert ParticipantHasNotAccepted(questId, participant);
        }

        if (rule.token != address(0) && rule.token != token) revert WrongToken(rule.token, token);
        if (amount < rule.minAmount) revert AmountBelowMinimum(rule.minAmount, amount);

        // Time binding. The floor is the attested frontier recorded at acceptance unless the rule
        // sets a higher one explicitly. Strictly greater, so an action in the anchored block itself
        // does not count.
        uint64 floorHeight = rule.minSourceBlock != 0
            ? rule.minSourceBlock
            : QUEST_MANAGER.acceptedAtSourceHeight(questId, participant);
        if (blockHeight <= floorHeight) revert SourceBlockTooEarly(blockHeight, floorHeight);
        if (rule.maxSourceBlock != 0 && blockHeight > rule.maxSourceBlock) {
            revert SourceBlockTooLate(blockHeight, rule.maxSourceBlock);
        }

        // The canonical source transaction hash is not recoverable from the prover's encoding, so
        // the transaction is identified by the same proof-derived tuple as the replay key, minus
        // the log ordinal. It is unforgeable for the same reason the replay key is.
        bytes32 sourceTxId = keccak256(abi.encode(chainKey, blockHeight, key));

        QUEST_MANAGER.recordCompletion(questId, participant, key, sourceTxId);

        if (context.campaignId != 0 && address(campaignEscrow) != address(0)) {
            campaignEscrow.releaseReward(bytes32(context.campaignId), participant, amount);
        }

        emit QuestProofApplied(questId, player, actionType, key, blockHeight, amount);
    }

    // ---------------------------------------------------------------- milestone 3b

    /// @notice Whether this deployment can decode an action type yet.
    /// @dev Portal is the only one in milestone 3a. UniswapSwap, Erc20Transfer, AaveSupply, and
    /// AaveBorrow arrive in milestone 3b. Naming them here, rather than leaving them silently absent,
    /// means a quest created against one fails with a reason a partner can read.
    function isActionSupported(VaelTypes.ActionType actionType) public pure returns (bool) {
        return actionType == VaelTypes.ActionType.Portal;
    }

    function _requireSupportedAction(VaelTypes.ActionType actionType) private pure {
        if (!isActionSupported(actionType)) revert ActionNotYetSupported(actionType);
    }
}
