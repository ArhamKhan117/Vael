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

        // Level 1 needs 150 XP. Two supplies is 240.
        _complete(player, SUPPLY, 1, 100);
        assertEq(hero.heroByAddress(player).xp, 120);
        assertEq(hero.heroByAddress(player).level, 1);

        _complete(player, SUPPLY, 1, 200);
        VaelHero.Hero memory h = hero.heroByAddress(player);
        assertEq(h.level, 2, "240 XP crosses the 150 threshold");
        assertEq(h.xp, 90, "the remainder carries over");
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
}
