// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CompleterSet
 * @notice The set of contracts allowed to write game state, and a delay on changing it.
 *
 * @dev A game module has to trust somebody: `VaelHero` cannot grant XP without a caller, and if it
 * trusted any caller then anyone could mint XP without doing anything. Earlier versions solved that
 * with a one-shot `setQuestASC`, which is the strongest possible answer and has one cost: every
 * change to the core forced a redeploy of the module, and through the immutable graph a redeploy of
 * everything holding it. That cascade is not free either. It replaced nine contracts in milestone 8,
 * required a hero import and a badge re-mint, and would have stranded a partner's escrow if one had
 * been mid-flight.
 *
 * Vael now has two completion paths, `QuestASC` for Attestcoin-verified quests and `NativePortal`
 * for synchronous Creditcoin ones, so the trusted caller is a set rather than a single address.
 *
 * **Why a delay rather than a one-shot.**
 * - The set is bootstrapped once, at deployment, with no delay: a contract with no completer does
 *   nothing at all, and making the first write wait a day would only mean deploying a day early.
 * - Every change after that is proposed, visible on chain, and cannot take effect for
 *   `COMPLETER_DELAY`. An owner who wanted to redirect XP to themselves would have to announce it
 *   a day in advance, in public, and a player who disagreed has that day to leave.
 * - A completer can write game state and nothing else. It cannot release VAEL, mint a badge, or
 *   mark a quest complete: those live behind `RewardVault.onlyQuestManager`,
 *   `BadgeNFT.onlyMinter`, and `QuestManager`'s own completer check. The blast radius of this
 *   privilege is hero XP and raid damage, which are earned records, not money.
 *
 * That is weaker than one-shot and it is written down rather than glossed. What it buys is that the
 * milestone 10 cascade is the last one: a new completion path is one proposal and one acceptance a day
 * later, not nine deployments and a state migration.
 */
abstract contract CompleterSet is Ownable {
    /// @notice How long a proposed change to the completer set must wait before it can be applied.
    uint256 public constant COMPLETER_DELAY = 24 hours;

    /// @notice Contracts allowed to call the game-state entry point.
    mapping(address completer => bool) public completers;

    /// @notice True once the initial set has been written. Bootstrapping is a one-time act.
    bool public completersInitialised;

    struct PendingCompleter {
        address completer;
        bool allowed;
        uint64 readyAt;
    }

    /// @notice The single change waiting on the delay, if any.
    /// @dev One at a time on purpose: a queue of pending privilege changes is harder to read than
    /// the privilege itself, and nothing here needs to change two callers at once.
    PendingCompleter public pendingCompleter;

    event CompletersInitialised(address[] completers);
    event CompleterProposed(address indexed completer, bool allowed, uint64 readyAt);
    event CompleterChanged(address indexed completer, bool allowed);
    event CompleterProposalCancelled(address indexed completer);

    error CompleterSet__NotACompleter(address caller);
    error CompleterSet__AlreadyInitialised();
    error CompleterSet__InvalidCompleter();
    error CompleterSet__NoPendingChange();
    error CompleterSet__DelayNotElapsed(uint64 readyAt);

    modifier onlyCompleter() {
        if (!completers[msg.sender]) revert CompleterSet__NotACompleter(msg.sender);
        _;
    }

    /// @notice Write the initial completer set. Callable once, by the owner, without a delay.
    function initialiseCompleters(address[] calldata initial) external onlyOwner {
        if (completersInitialised) revert CompleterSet__AlreadyInitialised();
        if (initial.length == 0) revert CompleterSet__InvalidCompleter();

        for (uint256 i = 0; i < initial.length; i++) {
            if (initial[i] == address(0)) revert CompleterSet__InvalidCompleter();
            completers[initial[i]] = true;
            emit CompleterChanged(initial[i], true);
        }

        completersInitialised = true;
        emit CompletersInitialised(initial);
    }

    /// @notice Announce a change to the completer set. It cannot be applied for `COMPLETER_DELAY`.
    function proposeCompleter(address completer, bool allowed) external onlyOwner {
        if (completer == address(0)) revert CompleterSet__InvalidCompleter();
        uint64 readyAt = uint64(block.timestamp + COMPLETER_DELAY);
        pendingCompleter = PendingCompleter({completer: completer, allowed: allowed, readyAt: readyAt});
        emit CompleterProposed(completer, allowed, readyAt);
    }

    /// @notice Apply the announced change, once the delay has passed.
    function acceptCompleter() external onlyOwner {
        PendingCompleter memory pending = pendingCompleter;
        if (pending.completer == address(0)) revert CompleterSet__NoPendingChange();
        if (block.timestamp < pending.readyAt) revert CompleterSet__DelayNotElapsed(pending.readyAt);

        completers[pending.completer] = pending.allowed;
        delete pendingCompleter;
        emit CompleterChanged(pending.completer, pending.allowed);
    }

    /// @notice Withdraw an announced change before it is applied.
    /// @dev Being able to take a proposal back matters: the alternative to cancelling a mistake is
    /// letting it land and proposing the reverse, which spends another day of the delay.
    function cancelCompleterProposal() external onlyOwner {
        address completer = pendingCompleter.completer;
        if (completer == address(0)) revert CompleterSet__NoPendingChange();
        delete pendingCompleter;
        emit CompleterProposalCancelled(completer);
    }
}
