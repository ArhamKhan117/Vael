// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {VaelHero} from "../src/game/VaelHero.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";

/// @notice Every hero formula, and the fact that a hero cannot change hands.
contract VaelHeroTest is Test {
    VaelHero internal hero;

    address internal owner = address(this);
    address internal questASC = address(0xA5C);
    address internal player = address(0x2222);
    address internal other = address(0x3333);

    uint8 internal constant PORTAL = uint8(VaelTypes.ActionType.Portal);
    uint8 internal constant TRANSFER = uint8(VaelTypes.ActionType.Erc20Transfer);
    uint8 internal constant SWAP = uint8(VaelTypes.ActionType.UniswapSwap);
    uint8 internal constant SUPPLY = uint8(VaelTypes.ActionType.AaveSupply);
    uint8 internal constant BORROW = uint8(VaelTypes.ActionType.AaveBorrow);

    function setUp() public {
        hero = new VaelHero(owner);
        hero.setQuestASC(questASC);
    }

    function _complete(address who, uint8 action, uint8 tier, uint64 sourceBlock) internal {
        vm.prank(questASC);
        hero.onQuestCompleted(1, 1, who, action, address(0), 0, tier, sourceBlock, keccak256("k"));
    }

    // ---------------------------------------------------------------- minting

    function test_MintIsFreeAndOnePerWallet() public {
        vm.prank(player);
        uint256 tokenId = hero.mintHero();
        assertEq(tokenId, 1);
        assertEq(hero.ownerOf(tokenId), player);
        assertEq(hero.heroByAddress(player).level, 1);

        vm.expectRevert(abi.encodeWithSelector(VaelHero.VaelHero__AlreadyHasHero.selector, player));
        vm.prank(player);
        hero.mintHero();
    }

    // ---------------------------------------------------------------- xp

    function test_BaseXpPerActionType() public view {
        assertEq(hero.xpFor(PORTAL, 1), 50);
        assertEq(hero.xpFor(TRANSFER, 1), 60);
        assertEq(hero.xpFor(SWAP, 1), 100);
        assertEq(hero.xpFor(SUPPLY, 1), 120);
        assertEq(hero.xpFor(BORROW, 1), 150);
    }

    function test_TierMultipliers() public view {
        assertEq(hero.xpFor(SWAP, 1), 100);
        assertEq(hero.xpFor(SWAP, 2), 150, "tier 2 is x1.5");
        assertEq(hero.xpFor(SWAP, 3), 200, "tier 3 is x2");
        // An odd base at x1.5 rounds down rather than needing fixed point.
        assertEq(hero.xpFor(PORTAL, 2), 75);
    }

    function test_XpToNextCurve() public view {
        assertEq(hero.xpToNext(1), 150);
        assertEq(hero.xpToNext(2), 200);
        assertEq(hero.xpToNext(10), 600);
    }

    function test_XpAccumulatesAndLevels() public {
        vm.prank(player);
        hero.mintHero();

        // Level 1 needs 150 XP. A supply is 120 base; the first pays at streak 1 for 132 and the
        // second lands inside the streak window and pays at streak 2 for 144.
        _complete(player, SUPPLY, 1, 100);
        assertEq(hero.heroByAddress(player).xp, 132);
        assertEq(hero.heroByAddress(player).level, 1);

        _complete(player, SUPPLY, 1, 200);
        VaelHero.Hero memory h = hero.heroByAddress(player);
        assertEq(h.level, 2, "276 XP crosses the 150 threshold");
        assertEq(h.xp, 126, "the remainder carries over");
    }

    /// @dev One very large action can cross several levels at once, so the level-up loops.
    function test_OneActionCanCrossSeveralLevels() public {
        vm.prank(player);
        hero.mintHero();
        for (uint256 i = 0; i < 6; ++i) {
            _complete(player, BORROW, 3, uint64(100 + i));
        }
        // 6 x 300 = 1800 XP. Thresholds 150+200+250+300+350 = 1250 to reach level 6.
        assertGe(hero.heroByAddress(player).level, 5);
    }

    // ---------------------------------------------------------------- affinity

    function test_AffinityRoutesEachActionToOneStat() public {
        vm.prank(player);
        hero.mintHero();

        _complete(player, PORTAL, 1, 10);
        _complete(player, TRANSFER, 1, 20);
        _complete(player, SWAP, 1, 30);
        _complete(player, SUPPLY, 1, 40);
        _complete(player, BORROW, 1, 50);

        VaelHero.Hero memory h = hero.heroByAddress(player);
        assertEq(h.strength, 2, "portal and transfer");
        assertEq(h.agility, 1, "swap");
        assertEq(h.intellect, 2, "supply and borrow");
    }

    // ---------------------------------------------------------------- streak

    function test_StreakContinuesInsideTheWindowAndResetsOutside() public {
        vm.prank(player);
        hero.mintHero();

        _complete(player, PORTAL, 1, 1_000_000);
        assertEq(hero.heroByAddress(player).streak, 1, "first action starts the streak");

        _complete(player, PORTAL, 1, 1_000_000 + 7200);
        assertEq(hero.heroByAddress(player).streak, 2, "exactly at the window still counts");

        _complete(player, PORTAL, 1, 1_000_000 + 7200 + 7201);
        assertEq(hero.heroByAddress(player).streak, 1, "one block past the window resets");
        assertEq(hero.heroByAddress(player).lastActionSourceBlock, 1_000_000 + 7200 + 7201);
    }

    // ---------------------------------------------------------------- access

    function test_OnlyQuestASCMayGrantXP() public {
        vm.prank(player);
        hero.mintHero();

        vm.expectRevert(abi.encodeWithSelector(VaelHero.VaelHero__OnlyQuestASC.selector, other));
        vm.prank(other);
        hero.onQuestCompleted(1, 1, player, PORTAL, address(0), 0, 1, 10, keccak256("k"));
    }

    function test_SetQuestASCIsOneShot() public {
        vm.expectRevert(
            abi.encodeWithSelector(VaelHero.VaelHero__QuestASCAlreadySet.selector, questASC)
        );
        hero.setQuestASC(other);
    }

    /// @dev A player who never minted must cost nothing and break nothing.
    function test_PlayerWithoutAHeroIsSilentlySkipped() public {
        _complete(other, PORTAL, 1, 10);
        assertFalse(hero.hasHero(other));
        assertEq(hero.levelOf(other), 0);
    }

    // ---------------------------------------------------------------- soul-bound

    function test_TransferReverts() public {
        vm.prank(player);
        uint256 tokenId = hero.mintHero();

        vm.expectRevert(VaelHero.VaelHero__SoulBound.selector);
        vm.prank(player);
        hero.transferFrom(player, other, tokenId);
    }

    function test_SafeTransferReverts() public {
        vm.prank(player);
        uint256 tokenId = hero.mintHero();

        vm.expectRevert(VaelHero.VaelHero__SoulBound.selector);
        vm.prank(player);
        hero.safeTransferFrom(player, other, tokenId);
    }

    function test_ApprovalsRevertSoNoMarketplaceCanListAHero() public {
        vm.prank(player);
        uint256 tokenId = hero.mintHero();

        vm.expectRevert(VaelHero.VaelHero__SoulBound.selector);
        vm.prank(player);
        hero.approve(other, tokenId);

        vm.expectRevert(VaelHero.VaelHero__SoulBound.selector);
        vm.prank(player);
        hero.setApprovalForAll(other, true);
    }

    function test_MintStillWorksDespiteTheTransferGuard() public {
        vm.prank(player);
        hero.mintHero();
        vm.prank(other);
        hero.mintHero();
        assertEq(hero.balanceOf(player), 1);
        assertEq(hero.balanceOf(other), 1);
    }
    // ---------------------------------------------------------------- v2: streaks

    function test_StreakMultiplierLadder() public view {
        assertEq(hero.streakMultiplierBps(0), 10_000, "no streak is x1");
        assertEq(hero.streakMultiplierBps(1), 11_000);
        assertEq(hero.streakMultiplierBps(5), 15_000);
        assertEq(hero.streakMultiplierBps(10), 20_000, "x2 is the cap");
        assertEq(hero.streakMultiplierBps(11), 20_000, "and it stays the cap");
        assertEq(hero.streakMultiplierBps(1000), 20_000);
    }

    function test_XpForAppliesTheStreak() public view {
        assertEq(hero.xpFor(PORTAL, 1), 50, "the two-argument form ignores streaks");
        assertEq(hero.xpFor(PORTAL, 1, 0), 50);
        assertEq(hero.xpFor(PORTAL, 1, 1), 55);
        assertEq(hero.xpFor(PORTAL, 1, 10), 100, "capped at double");
        assertEq(hero.xpFor(PORTAL, 1, 50), 100, "and it stays capped");
        assertEq(hero.xpFor(BORROW, 3, 10), 600, "tier and streak compound");
    }

    function test_AStreakRaisesTheXpActuallyGranted() public {
        vm.prank(player);
        hero.mintHero();

        // Portal is 50 base. Streak 1 pays 55, streak 2 pays 60, streak 3 pays 65.
        _complete(player, PORTAL, 1, 100);
        assertEq(hero.heroByAddress(player).streak, 1);
        assertEq(hero.heroByAddress(player).xp, 55);

        _complete(player, PORTAL, 1, 200);
        assertEq(hero.heroByAddress(player).streak, 2);
        assertEq(hero.heroByAddress(player).xp, 115);

        // 115 + 65 is 180, past the 150 needed to leave level 1.
        _complete(player, PORTAL, 1, 300);
        assertEq(hero.heroByAddress(player).streak, 3);
        assertEq(hero.heroByAddress(player).level, 2);
        assertEq(hero.heroByAddress(player).xp, 30, "the remainder carries over");
    }

    function test_ABrokenStreakStartsOverAtNoBonus() public {
        vm.prank(player);
        hero.mintHero();

        _complete(player, PORTAL, 1, 100); // 55
        _complete(player, PORTAL, 1, 200); // 60
        assertEq(hero.heroByAddress(player).streak, 2);
        assertEq(hero.heroByAddress(player).xp, 115);

        // Well past the 7200 block window, so the streak restarts at 1 and pays 55 again.
        _complete(player, PORTAL, 1, 100_000);
        assertEq(hero.heroByAddress(player).streak, 1, "the streak reset");
        assertEq(hero.heroByAddress(player).level, 2, "115 + 55 crosses 150");
        assertEq(hero.heroByAddress(player).xp, 20);
    }

    function test_TheStreakBonusIsCappedAtDouble() public {
        vm.prank(player);
        hero.mintHero();

        for (uint64 n = 0; n < 20; n++) {
            _complete(player, PORTAL, 1, 100 + n * 10);
        }
        assertEq(hero.heroByAddress(player).streak, 20, "the streak keeps counting");
        // The twentieth action is still paid at x2, not x2.9.
        assertEq(hero.xpFor(PORTAL, 1, hero.heroByAddress(player).streak), 100);
    }

    // ---------------------------------------------------------------- v2: import

    function _sample() internal pure returns (VaelHero.Hero memory h) {
        h.level = 4;
        h.xp = 77;
        h.strength = 9;
        h.agility = 3;
        h.intellect = 12;
        h.lastActionSourceBlock = 11_670_000;
        h.streak = 5;
    }

    function test_ImportCarriesAHeroAcrossKeepingItsTokenId() public {
        hero.importHero(player, 42, _sample());

        assertEq(hero.heroOf(player), 42, "the token id survived");
        assertEq(hero.ownerOf(42), player);
        VaelHero.Hero memory h = hero.heroByAddress(player);
        assertEq(h.level, 4);
        assertEq(h.xp, 77);
        assertEq(h.strength, 9);
        assertEq(h.intellect, 12);
        assertEq(h.streak, 5);
        assertEq(hero.importedCount(), 1);
    }

    function test_ImportedIdsDoNotCollideWithNewMints() public {
        hero.importHero(player, 42, _sample());

        vm.prank(other);
        uint256 minted = hero.mintHero();
        assertEq(minted, 43, "the counter moved past the imported id");
    }

    function test_ImportRefusesATakenTokenId() public {
        hero.importHero(player, 42, _sample());
        vm.expectRevert(abi.encodeWithSelector(VaelHero.VaelHero__TokenTaken.selector, uint256(42)));
        hero.importHero(other, 42, _sample());
    }

    function test_ImportRefusesAPlayerWhoAlreadyHasAHero() public {
        vm.prank(player);
        hero.mintHero();

        vm.expectRevert(abi.encodeWithSelector(VaelHero.VaelHero__AlreadyHasHero.selector, player));
        hero.importHero(player, 42, _sample());
    }

    function test_OnlyTheOwnerImports() public {
        vm.prank(player);
        vm.expectRevert();
        hero.importHero(player, 42, _sample());
    }

    function test_ImportClosesForGood() public {
        hero.importHero(player, 42, _sample());
        hero.closeImport();
        assertTrue(hero.importClosed());

        vm.expectRevert(VaelHero.VaelHero__ImportClosed.selector);
        hero.importHero(other, 43, _sample());
    }

    function test_BatchImportMovesEveryHero() public {
        address[] memory players = new address[](2);
        uint256[] memory ids = new uint256[](2);
        VaelHero.Hero[] memory data = new VaelHero.Hero[](2);
        players[0] = player;
        players[1] = other;
        ids[0] = 7;
        ids[1] = 9;
        data[0] = _sample();
        data[1] = _sample();

        hero.importHeroes(players, ids, data);

        assertEq(hero.heroOf(player), 7);
        assertEq(hero.heroOf(other), 9);
        assertEq(hero.importedCount(), 2);
    }

    function test_BatchImportRejectsMismatchedLengths() public {
        address[] memory players = new address[](2);
        uint256[] memory ids = new uint256[](1);
        VaelHero.Hero[] memory data = new VaelHero.Hero[](2);
        vm.expectRevert(VaelHero.VaelHero__LengthMismatch.selector);
        hero.importHeroes(players, ids, data);
    }

    function test_AnImportedHeroIsStillSoulBound() public {
        hero.importHero(player, 42, _sample());
        vm.prank(player);
        vm.expectRevert(VaelHero.VaelHero__SoulBound.selector);
        hero.transferFrom(player, other, 42);
    }

}
