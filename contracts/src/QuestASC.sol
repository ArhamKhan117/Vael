// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {VaelAscBase} from "./asc/VaelAscBase.sol";
import {IQuestManager} from "./interfaces/IQuestManager.sol";
import {IQuestASC} from "./interfaces/IQuestASC.sol";
import {IActionAdapter} from "./interfaces/IActionAdapter.sol";
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
/// Decoding lives in stateless adapters registered per `topics[0]`. QuestASC keeps everything that
/// matters: proof verification, the replay ledger, rules, the emitter allowlist, and the payout. An
/// adapter is handed a log the block prover already verified and says what it means; it holds no
/// privilege and cannot widen what is accepted.
///
/// The split exists because `QuestManager.setQuestASC` and `CampaignEscrow.setRewardReleaser` are
/// one-shot, so replacing this contract means replacing them too. Adding a protocol should cost one
/// transaction, not three redeploys.
///
/// The order of checks is deliberate. Emitter first, because a log from an unregistered contract is
/// somebody else's event and must not reach any quest logic. Then the quest context, then the
/// player binding, then the amount, then the block window. Each one is a separate named revert so a
/// failed submission says which rule it broke.
contract QuestASC is VaelAscBase, Ownable, IQuestASC {
    /// @notice The quest manager whose quests this contract completes.
    IQuestManager public immutable QUEST_MANAGER;

    /// @notice Campaign escrow used for partner-funded quests. May be unset.
    ICampaignEscrow public campaignEscrow;

    /// @notice Adapter registered for each event signature, per chain.
    /// @dev Owner-managed. Registering an adapter does not by itself allow anything: the emitter
    /// must still be allowlisted for the action type the adapter reports.
    mapping(uint64 chainKey => mapping(bytes32 topic0 => IActionAdapter)) public adapters;

    /// @notice Source chains this deployment accepts proofs from.
    mapping(uint64 chainKey => bool) public supportedChain;

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
    event AdapterRegistered(uint64 indexed chainKey, bytes32 indexed topic0, address indexed adapter);
    event SupportedChainUpdated(uint64 indexed chainKey, bool supported);
    event EmitterAllowed(uint64 indexed chainKey, VaelTypes.ActionType indexed actionType, address indexed emitter, bool allowed);
    event CampaignEscrowUpdated(address indexed escrow);

    error OnlyQuestManager(address caller);
    error ActionNotYetSupported(VaelTypes.ActionType actionType);
    error RuleAlreadyRegistered(uint256 questId);
    error NoRuleForQuest(uint256 questId);
    error QuestNotOpen(uint256 questId);
    error WrongSourceChain(uint256 questId, uint64 expected, uint64 provided);
    error PlayerMismatch(address expected, address decoded);
    error ParticipantHasNotAccepted(uint256 questId, address player);
    error AmountBelowMinimum(uint256 required, uint256 provided);
    error WrongToken(address required, address provided);
    error SourceBlockTooEarly(uint64 provided, uint64 mustExceed);
    error SourceBlockTooLate(uint64 provided, uint64 maximum);
    error NoAdapterForTopic(bytes32 topic0);
    error EmitterNotAllowed(uint64 chainKey, uint8 actionType, address emitter);
    error QuestHintRequired(uint8 actionType);
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
        // The portal goes through the same allowlist as every other emitter. Keeping one code path
        // means the portal cannot drift into being a privileged special case.
        allowedEmitters[chainKey][VaelTypes.ActionType.Portal][portal] = true;
        emit QuestPortalRegistered(chainKey, portal);
        emit EmitterAllowed(chainKey, VaelTypes.ActionType.Portal, portal, true);
    }

    /// @notice Register the adapter that decodes an event signature on a chain.
    /// @dev Pass the zero address to unregister, which immediately stops that event being decoded.
    function setAdapter(uint64 chainKey, bytes32 topic0, IActionAdapter adapter) external onlyOwner {
        adapters[chainKey][topic0] = adapter;
        if (address(adapter) != address(0)) supportedChain[chainKey] = true;
        emit AdapterRegistered(chainKey, topic0, address(adapter));
    }

    /// @notice Turn a whole source chain on or off, independently of its adapters.
    function setSupportedChain(uint64 chainKey, bool supported) external onlyOwner {
        supportedChain[chainKey] = supported;
        emit SupportedChainUpdated(chainKey, supported);
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
    /// @dev A chain is supported once at least one adapter is registered for it. The portal is no
    /// longer special: a chain that only carries third-party protocols is equally valid.
    function _isSupportedChainKey(uint64 chainKey) internal view override returns (bool) {
        return supportedChain[chainKey];
    }

    /// @inheritdoc VaelAscBase
    /// @dev Recognition is two independent questions, and both must be yes. Is there an adapter for
    /// this event signature, and does that adapter actually decode this log? The emitter allowlist
    /// is checked in the handler, against the action type the adapter reports, because the adapter
    /// is what determines which allowlist applies.
    function _isRecognised(uint64 chainKey, EvmV1Decoder.LogEntry memory logEntry)
        internal
        view
        override
        returns (bool)
    {
        IActionAdapter adapter = adapters[chainKey][logEntry.topics[0]];
        if (address(adapter) == address(0)) return false;
        (bool recognised, uint8 actionType,,,,) = adapter.decode(chainKey, logEntry);
        if (!recognised) return false;
        // The emitter gate belongs here, before the base claims a replay key, so a log from an
        // impostor contract is never consumed. Which allowlist applies depends on what the adapter
        // decided the log is, which is why the decode happens first.
        return allowedEmitters[chainKey][VaelTypes.ActionType(actionType)][logEntry.address_];
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
    ) internal override returns (bool) {
        IActionAdapter adapter = adapters[chainKey][logEntry.topics[0]];
        if (address(adapter) == address(0)) revert NoAdapterForTopic(logEntry.topics[0]);

        (
            bool recognised,
            uint8 actionType,
            address player,
            address token,
            uint256 amount,
            uint256 questIdFromEvent
        ) = adapter.decode(chainKey, logEntry);
        if (!recognised) revert NoAdapterForTopic(logEntry.topics[0]);

        // Only Vael's own portal event can name a quest. Every third-party protocol emits events
        // that know nothing about Vael, so those submissions must carry a hint.
        uint256 questId;
        if (questIdFromEvent != 0) {
            questId = questIdFromEvent;
            // The event names the quest, so a hint can only ever confirm or not apply. A hint
            // naming a different quest means this log is not the one being claimed: decline it, so
            // its replay key survives for the quest it does name. The hint can never redirect the
            // log, because questId comes from the event either way.
            if (questIdHint != 0 && questIdHint != questId) return false;
        } else {
            if (questIdHint == 0) revert QuestHintRequired(actionType);
            questId = questIdHint;
        }

        // A real transaction carries several recognised logs: a Uniswap swap emits two ERC-20
        // Transfers beside its Swap. The submitter is claiming one quest, so a log whose action
        // type is not the one that quest's rule names is declined rather than treated as an error.
        // Declining releases the replay key, so that Transfer can still satisfy a transfer quest.
        if (!ruleExists[questId]) revert NoRuleForQuest(questId);
        if (rules[questId].actionType != VaelTypes.ActionType(actionType)) return false;

        _applyCompletion(
            questId,
            player,
            token,
            amount,
            chainKey,
            blockHeight,
            key,
            VaelTypes.ActionType(actionType)
        );
        return true;
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
        VaelTypes.VerificationRule memory rule = rules[questId];

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

    /// @notice Whether a rule may be written against an action type.
    /// @dev All five are decodable now that the adapters exist. Whether a specific log is accepted
    /// still depends on an adapter being registered for its signature and its emitter being
    /// allowlisted, both of which are per-chain.
    function isActionSupported(VaelTypes.ActionType) public pure returns (bool) {
        return true;
    }
}
