// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReleaserSet
 * @notice The set of contracts allowed to move a campaign's money, and a delay on changing it.
 *
 * @dev `CampaignEscrow` v1 trusted one address, `QuestASC`, and the setter that named it could be
 * called again by the owner at any time. That was the wrong shape twice over. One releaser meant
 * the native completion path could not pay a campaign quest at all: `NativePortal` completed
 * quests 16 and 29 against the PenguinSwap demo pool and not a token moved. A freely resettable
 * releaser meant the owner could, in one transaction, point the escrow at anything and drain every
 * pool to any address, with nothing on chain announcing it first.
 *
 * This is the same shape `CompleterSet` gives the game modules, for a privilege that matters more:
 * a completer can write hero XP and raid damage, a releaser can pay partner funds to an address of
 * its choosing.
 *
 * - The set is bootstrapped once, at deployment, with no delay: an escrow with no releaser can only
 *   take deposits, and making the first payout wait a day would only mean deploying a day early.
 * - Every change after that is proposed, visible on chain, and cannot take effect for
 *   `RELEASER_DELAY`. An owner who wanted to add a releaser that pays them would have to announce
 *   it a day in advance, in public, and a partner who disagreed has that day to have their pool
 *   refunded through the releaser they trusted when they deposited.
 * - A releaser can move a pool's balance and nothing else: the amount is capped by the pool, and
 *   no releaser can mint.
 *
 * A sibling of `CompleterSet` rather than a shared base, because `CompleterSet` is compiled into
 * the deployed `VaelHero` and `RaidBoss`, and their source stays exactly as it was verified.
 */
abstract contract ReleaserSet is Ownable {
    /// @notice How long a proposed change to the releaser set must wait before it can be applied.
    uint256 public constant RELEASER_DELAY = 24 hours;

    /// @notice Contracts allowed to release from, and refund, a campaign pool.
    mapping(address releaser => bool) public releasers;

    /// @notice True once the initial set has been written. Bootstrapping is a one-time act.
    bool public releasersInitialised;

    struct PendingReleaser {
        address releaser;
        bool allowed;
        uint64 readyAt;
    }

    /// @notice The single change waiting on the delay, if any. One at a time, on purpose.
    PendingReleaser public pendingReleaser;

    event ReleasersInitialised(address[] releasers);
    event ReleaserProposed(address indexed releaser, bool allowed, uint64 readyAt);
    event ReleaserChanged(address indexed releaser, bool allowed);
    event ReleaserProposalCancelled(address indexed releaser);

    error ReleaserSet__NotAReleaser(address caller);
    error ReleaserSet__AlreadyInitialised();
    error ReleaserSet__InvalidReleaser();
    error ReleaserSet__NoPendingChange();
    error ReleaserSet__DelayNotElapsed(uint64 readyAt);

    modifier onlyReleaser() {
        if (!releasers[msg.sender]) revert ReleaserSet__NotAReleaser(msg.sender);
        _;
    }

    /// @notice Write the initial releaser set. Callable once, by the owner, without a delay.
    function initialiseReleasers(address[] calldata initial) external onlyOwner {
        if (releasersInitialised) revert ReleaserSet__AlreadyInitialised();
        if (initial.length == 0) revert ReleaserSet__InvalidReleaser();

        for (uint256 i = 0; i < initial.length; i++) {
            if (initial[i] == address(0)) revert ReleaserSet__InvalidReleaser();
            releasers[initial[i]] = true;
            emit ReleaserChanged(initial[i], true);
        }

        releasersInitialised = true;
        emit ReleasersInitialised(initial);
    }

    /// @notice Announce a change to the releaser set. It cannot be applied for `RELEASER_DELAY`.
    function proposeReleaser(address releaser, bool allowed) external onlyOwner {
        if (releaser == address(0)) revert ReleaserSet__InvalidReleaser();
        uint64 readyAt = uint64(block.timestamp + RELEASER_DELAY);
        pendingReleaser = PendingReleaser({releaser: releaser, allowed: allowed, readyAt: readyAt});
        emit ReleaserProposed(releaser, allowed, readyAt);
    }

    /// @notice Apply the announced change, once the delay has passed.
    function acceptReleaser() external onlyOwner {
        PendingReleaser memory pending = pendingReleaser;
        if (pending.releaser == address(0)) revert ReleaserSet__NoPendingChange();
        if (block.timestamp < pending.readyAt) revert ReleaserSet__DelayNotElapsed(pending.readyAt);

        releasers[pending.releaser] = pending.allowed;
        delete pendingReleaser;
        emit ReleaserChanged(pending.releaser, pending.allowed);
    }

    /// @notice Withdraw an announced change before it is applied.
    function cancelReleaserProposal() external onlyOwner {
        address releaser = pendingReleaser.releaser;
        if (releaser == address(0)) revert ReleaserSet__NoPendingChange();
        delete pendingReleaser;
        emit ReleaserProposalCancelled(releaser);
    }
}
