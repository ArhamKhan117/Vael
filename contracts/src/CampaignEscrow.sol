// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CampaignEscrow
 * @notice Holds partner-funded token rewards (e.g. USDC) for campaign quest completions.
 *         Partner deposits; the configured releaser pays participants on quest completion.
 *         Plain ERC-20 accounting with SafeERC20; no chain-specific token setup is required.
 */
contract CampaignEscrow is Ownable {
    using SafeERC20 for IERC20;

    /// @notice The only address allowed to release rewards. milestone 3 sets this to QuestASC, so
    ///         payouts happen only after an Attestcoin proof has verified on Creditcoin.
    address public rewardReleaser;

    /// @notice Token used for campaign rewards (e.g. USDC)
    IERC20 public rewardToken;

    /// @notice Fee in basis points (e.g. 50 = 0.5%)
    uint256 public feeBps;

    /// @notice Address that receives the platform fee
    address public feeCollector;

    /// @notice campaignId (bytes32) => available balance
    mapping(bytes32 => uint256) private _campaignBalances;

    event RewardReleaserUpdated(address indexed newReleaser);
    event RewardTokenUpdated(address indexed newToken);
    event FeeUpdated(uint256 newFeeBps);
    event FeeCollectorUpdated(address indexed newCollector);
    event Deposited(bytes32 indexed campaignId, address indexed depositor, uint256 amount, uint256 feeAmount);
    event Released(bytes32 indexed campaignId, address indexed recipient, uint256 amount);
    event Refunded(bytes32 indexed campaignId, address indexed recipient, uint256 amount);

    error CampaignEscrow__OnlyRewardReleaser();
    error CampaignEscrow__InvalidReleaser();
    error CampaignEscrow__InvalidFeeCollector();
    error CampaignEscrow__FeeBpsTooHigh();
    error CampaignEscrow__TokenNotConfigured();
    error CampaignEscrow__InsufficientBalance(bytes32 campaignId, uint256 requested, uint256 available);
    error CampaignEscrow__ZeroAmount();

    modifier onlyRewardReleaser() {
        if (msg.sender != rewardReleaser) revert CampaignEscrow__OnlyRewardReleaser();
        _;
    }

    uint256 public constant MAX_FEE_BPS = 1000; // 10% max

    constructor(address owner_) Ownable(owner_) {
        feeBps = 50; // 0.5% default
        feeCollector = owner_;
    }

    function setFeeBps(uint256 bps) external onlyOwner {
        if (bps > MAX_FEE_BPS) revert CampaignEscrow__FeeBpsTooHigh();
        feeBps = bps;
        emit FeeUpdated(bps);
    }

    function setFeeCollector(address collector) external onlyOwner {
        if (collector == address(0)) revert CampaignEscrow__InvalidFeeCollector();
        feeCollector = collector;
        emit FeeCollectorUpdated(collector);
    }

    function setRewardReleaser(address releaser_) external onlyOwner {
        if (releaser_ == address(0)) revert CampaignEscrow__InvalidReleaser();
        rewardReleaser = releaser_;
        emit RewardReleaserUpdated(releaser_);
    }

    function setRewardToken(address tokenAddress) external onlyOwner {
        if (tokenAddress == address(0)) revert CampaignEscrow__TokenNotConfigured();
        rewardToken = IERC20(tokenAddress);
        emit RewardTokenUpdated(tokenAddress);
    }

    /**
     * @notice Partner deposits tokens for a campaign.
     *         Platform fee (feeBps, e.g. 0.5%) is deducted; remainder goes to campaign pool.
     * @param campaignId bytes32 - keccak256(abi.encodePacked(campaignUuid)) from backend
     * @param amount Token amount (with token decimals) - total including fee
     */
    function deposit(bytes32 campaignId, uint256 amount) external {
        if (address(rewardToken) == address(0)) revert CampaignEscrow__TokenNotConfigured();
        if (amount == 0) revert CampaignEscrow__ZeroAmount();

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 feeAmount = (amount * feeBps) / 10_000;
        uint256 poolAmount = amount - feeAmount;

        _campaignBalances[campaignId] += poolAmount;

        if (feeAmount > 0 && feeCollector != address(0)) {
            rewardToken.safeTransfer(feeCollector, feeAmount);
        }

        emit Deposited(campaignId, msg.sender, poolAmount, feeAmount);
    }

    /**
     * @notice Release reward to a player who completed a campaign quest. Caller is the reward releaser.
     * @param campaignId bytes32 - must match the campaign UUID hash used in deposit
     * @param recipient Participant who completed the quest
     * @param amount Token amount to release
     */
    function releaseReward(bytes32 campaignId, address recipient, uint256 amount)
        external
        onlyRewardReleaser
    {
        if (address(rewardToken) == address(0)) revert CampaignEscrow__TokenNotConfigured();
        if (amount == 0) revert CampaignEscrow__ZeroAmount();

        uint256 available = _campaignBalances[campaignId];
        if (amount > available) {
            revert CampaignEscrow__InsufficientBalance(campaignId, amount, available);
        }

        _campaignBalances[campaignId] = available - amount;
        rewardToken.safeTransfer(recipient, amount);

        emit Released(campaignId, recipient, amount);
    }

    /**
     * @notice Refund the unspent pool to the partner. Caller is the reward releaser.
     *         Refundable = balance - (participant_count - claimed_count) * reward_per_quest
     * @param campaignId bytes32 - must match the campaign UUID hash used in deposit
     * @param recipient Partner wallet to receive the refund
     * @param amount Token amount to refund
     */
    function refundToPartner(bytes32 campaignId, address recipient, uint256 amount)
        external
        onlyRewardReleaser
    {
        if (address(rewardToken) == address(0)) revert CampaignEscrow__TokenNotConfigured();
        if (amount == 0) revert CampaignEscrow__ZeroAmount();

        uint256 available = _campaignBalances[campaignId];
        if (amount > available) {
            revert CampaignEscrow__InsufficientBalance(campaignId, amount, available);
        }

        _campaignBalances[campaignId] = available - amount;
        rewardToken.safeTransfer(recipient, amount);

        emit Refunded(campaignId, recipient, amount);
    }

    function campaignBalance(bytes32 campaignId) external view returns (uint256) {
        return _campaignBalances[campaignId];
    }

    /**
     * @notice Given desired pool amount, returns total amount partner must deposit (includes fee).
     *         depositAmount = poolAmount * 10000 / (10000 - feeBps)
     */
    function getDepositAmountForPool(uint256 poolAmount) external view returns (uint256) {
        return (poolAmount * 10_000) / (10_000 - feeBps);
    }

    /**
     * @notice Given deposit amount, returns fee and pool amount after fee.
     */
    function getFeeAndPoolAmount(uint256 depositAmount) external view returns (uint256 feeAmount, uint256 poolAmount) {
        feeAmount = (depositAmount * feeBps) / 10_000;
        poolAmount = depositAmount - feeAmount;
    }
}
