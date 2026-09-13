// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ICompletionHook} from "../interfaces/ICompletionHook.sol";
import {IQuestManager} from "../interfaces/IQuestManager.sol";

interface ICampaignEscrowRelease {
    function releaseReward(bytes32 campaignId, address recipient, uint256 amount) external;
    function campaignBalance(bytes32 campaignId) external view returns (uint256);
}

interface IQuestManagerProgress is IQuestManager {
    struct ParticipantProgress {
        bool accepted;
        bool completed;
        uint64 acceptedAtSourceHeight;
    }

    function participantProgress(uint256 questId, address participant)
        external
        view
        returns (ParticipantProgress memory);
}

/**
 * @title CampaignPayoutHook
 * @notice Pays a campaign quest completed on the native path, from the partner's escrow.
 *
 * @dev **Why a hook and not `NativePortal` itself.** `QuestASC` releases a campaign reward inside
 * the same call that records the completion. `NativePortal` never did, and it cannot be taught to:
 * `QuestManager.setNativePortal` is one-shot, so a new `NativePortal` means a new `QuestManager`,
 * and through the immutable graph the nine-contract cascade the completer set was built to end.
 * What the deployed `NativePortal` does expose is its hook list, which the owner can extend. This
 * contract is that hook: `NativePortal` calls it after every native completion, it reads the quest
 * off `QuestManager`, and if the quest draws on a campaign it releases exactly the quest's
 * `rewardPerParticipant` from the escrow to the player. Same amount, same source of truth, same
 * transaction as `QuestASC`'s payout.
 *
 * **What it trusts.** Only `NativePortal`, by address, and only for a completion `QuestManager`
 * itself confirms: the player's progress on the quest must read `completed` at the moment this
 * runs, which is a state only `QuestManager.recordCompletion` can write and only its two
 * completers can call. A caller cannot name a quest that was not completed, and cannot be paid
 * twice for one that was.
 *
 * **What it cannot do.** It cannot pay a vault quest (those are paid by `QuestManager`), cannot
 * pay more than the quest promised, and cannot pay anybody but the participant `QuestManager`
 * recorded. It holds no funds.
 *
 * **The one difference from `QuestASC`.** A hook runs inside `NativePortal`'s `try/catch`, so if
 * the pool cannot cover the reward the completion stands and this emits `CampaignRewardSkipped`
 * where `QuestASC` would have reverted the whole completion. The API refuses to publish a quest a
 * pool cannot cover, and only a releaser can lower a pool, so this is a corner the operator has to
 * work to reach; it is recorded in `docs/ATTESTCOIN_INTEGRATION.md` section 6d rather than glossed.
 */
contract CampaignPayoutHook is Ownable, ICompletionHook {
    IQuestManagerProgress public immutable QUEST_MANAGER;

    /// @notice The only caller. The deployed NativePortal, which QuestManager names once.
    address public immutable NATIVE_PORTAL;

    /// @notice Where campaign pools live. Settable, as on QuestASC, so an escrow can be replaced
    ///         without replacing this contract.
    ICampaignEscrowRelease public campaignEscrow;

    /// @notice One payout per completion. QuestManager already refuses a second completion, and
    ///         NativePortal notifies its hooks once per completion; this makes the same promise
    ///         locally rather than resting it on two other contracts.
    mapping(uint256 questId => mapping(address player => bool)) public paid;

    event CampaignEscrowUpdated(address indexed escrow);
    event CampaignRewardReleased(
        uint256 indexed questId, address indexed player, uint256 indexed campaignId, uint256 amount
    );
    event CampaignRewardSkipped(
        uint256 indexed questId, address indexed player, uint256 indexed campaignId, uint256 amount, uint256 available
    );

    error CampaignPayoutHook__ZeroAddress();
    error CampaignPayoutHook__NotNativePortal(address caller);
    error CampaignPayoutHook__NotCompleted(uint256 questId, address player);
    error CampaignPayoutHook__AlreadyPaid(uint256 questId, address player);
    error CampaignPayoutHook__EscrowNotSet();

    constructor(address owner_, address questManager, address nativePortal) Ownable(owner_) {
        if (questManager == address(0) || nativePortal == address(0)) revert CampaignPayoutHook__ZeroAddress();
        QUEST_MANAGER = IQuestManagerProgress(questManager);
        NATIVE_PORTAL = nativePortal;
    }

    function setCampaignEscrow(address escrow) external onlyOwner {
        if (escrow == address(0)) revert CampaignPayoutHook__ZeroAddress();
        campaignEscrow = ICampaignEscrowRelease(escrow);
        emit CampaignEscrowUpdated(escrow);
    }

    /// @inheritdoc ICompletionHook
    /// @dev `chainKey`, `actionType`, `token`, `amount`, `tier`, `sourceBlock` and `replayKey`
    /// describe the action; the payout depends on none of them. What was promised is read from
    /// the quest, and the escrow releases that.
    function onQuestCompleted(
        uint64,
        uint256 questId,
        address player,
        uint8,
        address,
        uint256,
        uint8,
        uint64,
        bytes32
    ) external override {
        if (msg.sender != NATIVE_PORTAL) revert CampaignPayoutHook__NotNativePortal(msg.sender);

        IQuestManager.QuestVerificationContext memory context = QUEST_MANAGER.verificationContext(questId);
        // A vault quest was paid by QuestManager inside recordCompletion. Nothing to do here.
        if (context.campaignId == 0) return;

        if (!QUEST_MANAGER.participantProgress(questId, player).completed) {
            revert CampaignPayoutHook__NotCompleted(questId, player);
        }
        if (paid[questId][player]) revert CampaignPayoutHook__AlreadyPaid(questId, player);
        if (address(campaignEscrow) == address(0)) revert CampaignPayoutHook__EscrowNotSet();

        bytes32 campaignId = bytes32(context.campaignId);
        uint256 reward = context.rewardPerParticipant;
        uint256 available = campaignEscrow.campaignBalance(campaignId);
        if (available < reward) {
            emit CampaignRewardSkipped(questId, player, context.campaignId, reward, available);
            return;
        }

        paid[questId][player] = true;
        campaignEscrow.releaseReward(campaignId, player, reward);
        emit CampaignRewardReleased(questId, player, context.campaignId, reward);
    }
}
