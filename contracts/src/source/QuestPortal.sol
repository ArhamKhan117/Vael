// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title QuestPortal
/// @notice Vael's own source-chain contract, deployed to Ethereum Sepolia.
///
/// @dev Source chain minimal, Creditcoin maximal. This contract moves assets and emits one
/// unambiguous event. It holds no quest state, decides nothing, and knows nothing about rewards.
/// All of that lives on Creditcoin, where `QuestASC` verifies an Attestcoin proof of the event
/// below before anything is released.
///
/// The event is the entire interface to the rest of the system. Every field a verification rule
/// needs is either an indexed topic or a data word, so the Creditcoin side never has to parse
/// calldata or trust the transaction's `from` field. `player` is indexed precisely so that identity
/// comes from `topics[2]` rather than from the gas payer, which differs behind routers, relayers,
/// and smart accounts.
contract QuestPortal is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Where deposited value is forwarded.
    address public treasury;

    /// @notice The one event this contract emits, and the only thing Creditcoin reads.
    /// @param questId Quest the player is acting on. Indexed, so a rule can bind to it.
    /// @param player The acting player. Indexed, and always the identity the proof carries.
    /// @param actionType Always 0, the Portal action. Indexed to keep the topic layout stable if
    ///        further portal actions are ever added.
    /// @param token Zero address for a native check-in, otherwise the ERC-20 deposited.
    /// @param amount Native value or token amount.
    event QuestActionPerformed(
        uint256 indexed questId,
        address indexed player,
        uint8 indexed actionType,
        address token,
        uint256 amount
    );

    event TreasuryUpdated(address indexed newTreasury);

    error QuestPortal__InvalidTreasury();
    error QuestPortal__ZeroAmount();
    error QuestPortal__TransferFailed();

    constructor(address owner_, address treasury_) Ownable(owner_) {
        if (treasury_ == address(0)) revert QuestPortal__InvalidTreasury();
        treasury = treasury_;
    }

    /// @notice Perform a native-value check-in for a quest.
    /// @dev The minimum is a matter for the verification rule on Creditcoin, not for this contract.
    /// Anything above zero is a valid action here; whether it satisfies a quest is decided by the
    /// rule that reads the proof.
    function checkIn(uint256 questId) external payable {
        if (msg.value == 0) revert QuestPortal__ZeroAmount();

        emit QuestActionPerformed(questId, msg.sender, 0, address(0), msg.value);

        (bool sent,) = treasury.call{value: msg.value}("");
        if (!sent) revert QuestPortal__TransferFailed();
    }

    /// @notice Perform an ERC-20 deposit for a quest.
    function deposit(uint256 questId, address token, uint256 amount) external {
        if (amount == 0) revert QuestPortal__ZeroAmount();

        emit QuestActionPerformed(questId, msg.sender, 0, token, amount);

        IERC20(token).safeTransferFrom(msg.sender, treasury, amount);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert QuestPortal__InvalidTreasury();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Sweep any native balance that ended up here despite the forward-on-receipt design.
    function withdraw(address payable to) external onlyOwner {
        if (to == address(0)) revert QuestPortal__InvalidTreasury();
        (bool sent,) = to.call{value: address(this).balance}("");
        if (!sent) revert QuestPortal__TransferFailed();
    }

    /// @notice Sweep stranded ERC-20 balances.
    function withdrawToken(address token, address to) external onlyOwner {
        if (to == address(0)) revert QuestPortal__InvalidTreasury();
        IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
    }
}
