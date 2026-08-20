// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {VaelToken} from "./tokens/VaelToken.sol";

/**
 * @title RewardVault
 * @notice Holds VAEL ERC-20 reward supply. The vault mints VAEL tokens
 *         when quests are funded and distributes rewards to quest completers.
 */
contract RewardVault is Ownable {
    using SafeERC20 for IERC20;

    struct QuestReward {
        uint256 totalAmount;
        uint256 claimedAmount;
    }

    /// @dev Keyed by `(questManager, questId)`, not by `questId` alone.
    ///
    /// Quest ids are a per-manager counter that restarts at 1, so a redeployed QuestManager reuses
    /// ids the previous one already funded. With a questId-only key, the first `createQuest` on a
    /// fresh manager reverts `RewardVault__QuestAlreadyFunded(1)` and the manager is permanently
    /// stuck, because the id counter only advances on success. Namespacing by manager makes a
    /// manager redeploy safe without touching this contract again.
    mapping(bytes32 rewardKey => QuestReward) private _rewards;

    address public questManager;
    VaelToken public vaelToken;

    event QuestManagerUpdated(address indexed newQuestManager);
    event VaelTokenUpdated(address indexed tokenAddress);
    event RewardFunded(uint256 indexed questId, uint256 amount);
    event RewardReleased(uint256 indexed questId, address indexed recipient, uint256 amount);

    error RewardVault__OnlyQuestManager();
    error RewardVault__InvalidQuestManager();
    error RewardVault__QuestAlreadyFunded(uint256 questId);
    error RewardVault__InsufficientBalance(uint256 questId, uint256 requested, uint256 available);
    error RewardVault__VaelTokenNotConfigured();
    error RewardVault__QuestNotFunded(uint256 questId);

    /// @dev The ledger key for a quest under the current manager.
    function _rewardKey(uint256 questId) private view returns (bytes32) {
        return keccak256(abi.encode(questManager, questId));
    }

    modifier onlyQuestManager() {
        _requireQuestManager();
        _;
    }

    constructor(address owner_) Ownable(owner_) {}

    function setQuestManager(address questManager_) external onlyOwner {
        if (questManager_ == address(0)) revert RewardVault__InvalidQuestManager();
        questManager = questManager_;
        emit QuestManagerUpdated(questManager_);
    }

    function setVaelToken(address tokenAddress) external onlyOwner {
        if (tokenAddress == address(0)) revert RewardVault__VaelTokenNotConfigured();
        vaelToken = VaelToken(tokenAddress);
        emit VaelTokenUpdated(tokenAddress);
    }

    /**
     * @notice Fund a quest with VAEL tokens. Mints tokens to this vault.
     *         Called by QuestManager when a quest is created.
     * @param questId ID of the quest to fund
     * @param amount Total amount of VAEL tokens to fund (with 18 decimals)
     */
    function fundQuest(uint256 questId, uint256 amount) external onlyQuestManager {
        if (address(vaelToken) == address(0)) revert RewardVault__VaelTokenNotConfigured();
        bytes32 key = _rewardKey(questId);
        if (_rewards[key].totalAmount != 0) revert RewardVault__QuestAlreadyFunded(questId);
        if (amount == 0) revert("RewardVault: zero amount");

        _rewards[key] = QuestReward({totalAmount: amount, claimedAmount: 0});

        // Mint tokens directly to this vault
        vaelToken.mint(address(this), amount);

        emit RewardFunded(questId, amount);
    }

    /**
     * @notice Release reward to a quest completer.
     *         Called by QuestManager when a quest is completed.
     * @param questId ID of the quest
     * @param recipient Address to receive the reward
     * @param amount Amount of VAEL tokens to release (with 18 decimals)
     */
    function releaseReward(uint256 questId, address recipient, uint256 amount) external onlyQuestManager {
        QuestReward storage reward = _rewards[_rewardKey(questId)];
        if (reward.totalAmount == 0) revert RewardVault__QuestNotFunded(questId);
        if (amount == 0) revert("RewardVault: zero amount");

        uint256 available = reward.totalAmount - reward.claimedAmount;
        if (amount > available) revert RewardVault__InsufficientBalance(questId, amount, available);

        reward.claimedAmount += amount;

        // Transfer tokens to recipient
        IERC20(address(vaelToken)).safeTransfer(recipient, amount);

        emit RewardReleased(questId, recipient, amount);
    }

    function rewardInfo(uint256 questId) external view returns (QuestReward memory) {
        return _rewards[_rewardKey(questId)];
    }

    function _requireQuestManager() internal view {
        if (msg.sender != questManager) revert RewardVault__OnlyQuestManager();
    }
}
