// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CompleterSet} from "../src/access/CompleterSet.sol";
import {Test, stdError} from "forge-std/Test.sol";

import {RaidBoss, IVaelHeroLevels, IBadgeMinter} from "../src/game/RaidBoss.sol";
import {VaelHero} from "../src/game/VaelHero.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";

/// @notice Damage, the share split, the last-hit bonus, and everything that must not double-pay.
contract RaidBossTest is Test {
    RaidBoss internal raid;
    VaelHero internal hero;
    VaelToken internal token;
    BadgeNFT internal badge;

    address internal owner = address(this);
    address internal questASC = address(0xA5C);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    uint8 internal constant PORTAL = uint8(VaelTypes.ActionType.Portal);
    uint8 internal constant SWAP = uint8(VaelTypes.ActionType.UniswapSwap);
    uint8 internal constant BORROW = uint8(VaelTypes.ActionType.AaveBorrow);
    uint8 internal constant PENGUIN = uint8(VaelTypes.ActionType.PenguinSwapSwap);
    uint8 internal constant WRAP = uint8(VaelTypes.ActionType.WrapNative);

    uint256 internal constant LOOT = 1000 ether;

    function setUp() public {
        token = new VaelToken(owner);
        hero = new VaelHero(owner);
        badge = new BadgeNFT(owner);
        badge.setBadgeURI(1, "ipfs://placeholder");

        raid = new RaidBoss(owner, token, IVaelHeroLevels(address(hero)), IBadgeMinter(address(badge)));
        {
            address[] memory only = new address[](1);
            only[0] = questASC;
            raid.initialiseCompleters(only);
        }
        {
            address[] memory only = new address[](1);
            only[0] = questASC;
            hero.initialiseCompleters(only);
        }
        badge.setMinter(address(raid), true);

        token.mint(owner, 10_000 ether);
        token.approve(address(raid), type(uint256).max);
    }

    function _hit(address who, uint8 action, uint8 tier) internal {
        vm.prank(questASC);
        raid.onQuestCompleted(1, 1, who, action, address(0), 0, tier, 0, keccak256(abi.encode(who, action)));
    }

    // ---------------------------------------------------------------- damage

    function test_DamageFormula() public view {
        // base * (10 + level) / 10 * tier
        assertEq(raid.damageFor(PORTAL, 1, 0), 100, "no hero is a x1 multiplier, not zero damage");
        assertEq(raid.damageFor(PORTAL, 1, 10), 200, "level 10 doubles it");
        assertEq(raid.damageFor(SWAP, 1, 0), 200);
        assertEq(raid.damageFor(BORROW, 1, 0), 300);
        assertEq(raid.damageFor(SWAP, 2, 0), 300, "tier 2 is x1.5");
        assertEq(raid.damageFor(SWAP, 3, 0), 400, "tier 3 is x2");
        assertEq(raid.damageFor(SWAP, 3, 5), 600, "level and tier compound");
    }

    /**
     * The two Creditcoin actions are worth less than the Ethereum action they mirror.
     *
     * This is the assertion that would have caught the bug it exists for. `_baseDamage` ended in a
     * bare `return DMG_AAVE_BORROW`, so the moment the enum grew, wrapping CTC hit the boss for 300
     * and out-damaged every proved cross-chain action in the game. The ordering is the design, so
     * the ordering is what is asserted, not just the numbers.
     */
    function test_NativeActionsAreWorthLessThanProvedOnes() public view {
        assertEq(raid.damageFor(PENGUIN, 1, 0), 140);
        assertEq(raid.damageFor(WRAP, 1, 0), 80);
        assertLt(
            raid.damageFor(PENGUIN, 1, 0),
            raid.damageFor(SWAP, 1, 0),
            "a native swap must not beat the same swap proved across a chain boundary"
        );
        assertLt(raid.damageFor(WRAP, 1, 0), raid.damageFor(PORTAL, 1, 0), "wrapping is the easiest action there is");
        assertLt(raid.damageFor(WRAP, 1, 0), raid.damageFor(PENGUIN, 1, 0));
    }

    /**
     * An action type this deployment has never heard of is refused, not priced.
     *
     * Solidity panics on a cast past the end of the enum, so the `return 0` at the bottom of
     * `_baseDamage` is unreachable from outside and is there to state the intent. That panic is the
     * right failure: an action a future enum adds costs nothing here until this contract is
     * redeployed knowing about it. The old trailing `else` did the opposite, silently pricing
     * anything unknown at the highest rate in the table.
     */
    function test_AnUnknownActionIsRefusedRatherThanPriced() public {
        vm.expectRevert(stdError.enumConversionError);
        raid.damageFor(200, 1, 0);
    }

    function test_HeroLevelScalesDamage() public {
        raid.startSeason(100_000, 0);
        vm.prank(alice);
        hero.mintHero();

        _hit(alice, PORTAL, 1);
        uint256 atLevel1 = raid.damageOf(1, alice);
        assertEq(atLevel1, 110, "level 1 gives (10+1)/10");
    }

    // ---------------------------------------------------------------- seasons

    function test_DamageBeforeAnySeasonIsIgnored() public {
        _hit(alice, PORTAL, 1);
        assertEq(raid.currentSeasonId(), 0);
        assertEq(raid.damageOf(0, alice), 0);
    }

    function test_CannotStartASeasonWhileOneIsRunning() public {
        raid.startSeason(1000, 0);
        vm.expectRevert(abi.encodeWithSelector(RaidBoss.RaidBoss__SeasonActive.selector, uint64(1)));
        raid.startSeason(1000, 0);
    }

    function test_LootPoolIsTransferredInAtStart() public {
        raid.startSeason(1000, LOOT);
        assertEq(token.balanceOf(address(raid)), LOOT, "the payout is held, not promised");
    }

    // ---------------------------------------------------------------- defeat

    function test_BossDiesAndDamageIsCappedAtRemainingHp() public {
        raid.startSeason(150, 0);
        _hit(alice, PORTAL, 1); // 100
        assertEq(raid.currentSeason().hp, 50);

        _hit(bob, PORTAL, 1); // would be 100, capped to 50
        RaidBoss.Season memory s = raid.currentSeason();
        assertEq(s.hp, 0);
        assertTrue(s.defeated);
        assertEq(s.lastHitter, bob);
        assertEq(raid.damageOf(1, bob), 50, "overkill does not inflate a share");
        assertEq(s.totalDamage, 150);
    }

    function test_DamageAgainstADefeatedBossIsIgnored() public {
        raid.startSeason(100, 0);
        _hit(alice, PORTAL, 1);
        assertTrue(raid.currentSeason().defeated);

        _hit(carol, PORTAL, 1);
        assertEq(raid.damageOf(1, carol), 0, "a completion between seasons still pays its reward");
        assertEq(raid.currentSeason().totalDamage, 100);
    }

    // ---------------------------------------------------------------- loot

    function test_ShareMathAndLastHitBonus() public {
        raid.startSeason(300, LOOT);
        _hit(alice, PORTAL, 1); // 100
        _hit(alice, PORTAL, 1); // 100, alice total 200
        _hit(bob, PORTAL, 1); // 100, kills it, bob is last hitter

        assertTrue(raid.currentSeason().defeated);
        assertEq(raid.currentSeason().totalDamage, 300);

        // 95% of 1000 is 950 shared by damage; 50 reserved for the last hitter.
        uint256 shared = (LOOT * 95) / 100;
        uint256 aliceExpected = (shared * 200) / 300;
        uint256 bobExpected = (shared * 100) / 300 + (LOOT - shared);

        assertEq(raid.pendingLoot(1, alice), aliceExpected);
        assertEq(raid.pendingLoot(1, bob), bobExpected);

        vm.prank(alice);
        assertEq(raid.claimLoot(1), aliceExpected);
        vm.prank(bob);
        assertEq(raid.claimLoot(1), bobExpected);

        assertEq(token.balanceOf(alice), aliceExpected);
        assertEq(token.balanceOf(bob), bobExpected);
        // Everything paid out is within rounding of the pool.
        assertLe(aliceExpected + bobExpected, LOOT);
        assertGe(aliceExpected + bobExpected, LOOT - 10);
    }

    function test_DoubleClaimRejected() public {
        raid.startSeason(100, LOOT);
        _hit(alice, PORTAL, 1);

        vm.prank(alice);
        raid.claimLoot(1);

        vm.expectRevert(
            abi.encodeWithSelector(RaidBoss.RaidBoss__AlreadyClaimed.selector, uint64(1), alice)
        );
        vm.prank(alice);
        raid.claimLoot(1);
    }

    function test_ClaimBeforeDefeatRejected() public {
        raid.startSeason(1000, LOOT);
        _hit(alice, PORTAL, 1);

        vm.expectRevert(
            abi.encodeWithSelector(RaidBoss.RaidBoss__NotDefeated.selector, uint64(1))
        );
        vm.prank(alice);
        raid.claimLoot(1);
    }

    function test_NonContributorCannotClaim() public {
        raid.startSeason(100, LOOT);
        _hit(alice, PORTAL, 1);

        vm.expectRevert(
            abi.encodeWithSelector(RaidBoss.RaidBoss__NothingToClaim.selector, uint64(1), carol)
        );
        vm.prank(carol);
        raid.claimLoot(1);
    }

    function test_ClaimMintsTheVictoryBadge() public {
        raid.startSeason(100, LOOT);
        _hit(alice, PORTAL, 1);

        vm.prank(alice);
        raid.claimLoot(1);
        assertEq(badge.balanceOf(alice), 1, "every contributor gets the RaidVictory badge");
    }

    /// @dev A badge mint that fails must not cost a player their loot.
    function test_LootStillPaysWhenTheBadgeMintFails() public {
        badge.setMinter(address(raid), false); // revoke, so the mint reverts

        raid.startSeason(100, LOOT);
        _hit(alice, PORTAL, 1);

        vm.prank(alice);
        uint256 amount = raid.claimLoot(1);
        assertGt(amount, 0);
        assertEq(token.balanceOf(alice), amount);
        assertEq(badge.balanceOf(alice), 0);
    }

    // ---------------------------------------------------------------- access

    function test_OnlyQuestASCMayDealDamage() public {
        raid.startSeason(1000, 0);
        vm.expectRevert(abi.encodeWithSelector(RaidBoss.RaidBoss__OnlyQuestASC.selector, alice));
        vm.prank(alice);
        raid.onQuestCompleted(1, 1, alice, PORTAL, address(0), 0, 1, 0, keccak256("k"));
    }

    function test_TheCompleterSetIsBootstrappedOnlyOnce() public {
        address[] memory only = new address[](1);
        only[0] = alice;
        vm.expectRevert(CompleterSet.CompleterSet__AlreadyInitialised.selector);
        raid.initialiseCompleters(only);
    }

    /// @notice A change to who may deal damage is announced a day before it takes effect.
    function test_AddingACompleterWaitsOutTheDelay() public {
        raid.proposeCompleter(alice, true);
        assertFalse(raid.completers(alice), "a proposal took effect immediately");

        (address pending, bool allowed, uint64 readyAt) = raid.pendingCompleter();
        assertEq(pending, alice);
        assertTrue(allowed);
        assertEq(readyAt, uint64(block.timestamp + raid.COMPLETER_DELAY()));

        vm.expectRevert(
            abi.encodeWithSelector(CompleterSet.CompleterSet__DelayNotElapsed.selector, readyAt)
        );
        raid.acceptCompleter();

        vm.warp(readyAt);
        raid.acceptCompleter();
        assertTrue(raid.completers(alice), "the change never landed");
    }

    function test_AProposalCanBeWithdrawn() public {
        raid.proposeCompleter(alice, true);
        raid.cancelCompleterProposal();
        vm.warp(block.timestamp + raid.COMPLETER_DELAY() + 1);
        vm.expectRevert(CompleterSet.CompleterSet__NoPendingChange.selector);
        raid.acceptCompleter();
        assertFalse(raid.completers(alice), "a withdrawn proposal still landed");
    }

    /// @notice Removing a completer is the same announced change in the other direction.
    function test_ACompleterCanBeRemovedAfterTheDelay() public {
        raid.proposeCompleter(questASC, false);
        vm.warp(block.timestamp + raid.COMPLETER_DELAY());
        raid.acceptCompleter();
        assertFalse(raid.completers(questASC), "the completer was not removed");

        vm.expectRevert(abi.encodeWithSelector(RaidBoss.RaidBoss__OnlyQuestASC.selector, questASC));
        vm.prank(questASC);
        raid.onQuestCompleted(1, 1, alice, 0, address(0), 0, 1, 10, keccak256("k"));
    }

    /// @dev A player with no hero still contributes, at the level-0 multiplier of exactly 1.
    function test_PlayerWithoutAHeroStillDealsDamage() public {
        raid.startSeason(1000, 0);
        _hit(carol, PORTAL, 1);
        assertEq(raid.damageOf(1, carol), 100);
        assertEq(hero.levelOf(carol), 0);
    }

    function test_NewSeasonStartsCleanAfterDefeat() public {
        raid.startSeason(100, 0);
        _hit(alice, PORTAL, 1);
        assertTrue(raid.currentSeason().defeated);

        raid.startSeason(500, 0);
        assertEq(raid.currentSeasonId(), 2);
        assertEq(raid.currentSeason().hp, 500);
        assertEq(raid.damageOf(2, alice), 0, "damage does not carry between seasons");
        assertEq(raid.damageOf(1, alice), 100, "the old season's ledger is intact");
    }
}
