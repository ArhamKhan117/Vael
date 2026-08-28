// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {Marketplace} from "../src/game/Marketplace.sol";
import {Loot} from "../src/game/Loot.sol";
import {LootHarness} from "./mocks/LootHarness.sol";
import {RaidBoss, IVaelHeroLevels, IBadgeMinter} from "../src/game/RaidBoss.sol";
import {VaelHero} from "../src/game/VaelHero.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";

/// @notice Escrow, the fee split, and every way a listing can be misused.
contract MarketplaceTest is Test {
    Marketplace internal market;
    LootHarness internal loot;
    VaelToken internal token;

    address internal owner = address(this);
    address internal treasury = address(0x7EA);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    uint8 internal constant WEAPON = 0;
    uint256 internal constant PRICE = 250 ether;

    uint256 internal swordId;

    function setUp() public {
        token = new VaelToken(owner);
        VaelHero hero = new VaelHero(owner);
        BadgeNFT badge = new BadgeNFT(owner);
        RaidBoss raid =
            new RaidBoss(owner, token, IVaelHeroLevels(address(hero)), IBadgeMinter(address(badge)));

        loot = new LootHarness(owner, address(raid));
        swordId = loot.registerItem("Rusted Sword", WEAPON, Loot.Rarity.Common, 2, 0, 0, "ipfs://sword");

        market = new Marketplace(owner, address(token), address(loot), treasury);

        loot.grant(alice, swordId, 3);
        token.mint(bob, 10_000 ether);
        token.mint(carol, 10_000 ether);

        vm.prank(alice);
        loot.setApprovalForAll(address(market), true);
        vm.prank(bob);
        token.approve(address(market), type(uint256).max);
        vm.prank(carol);
        token.approve(address(market), type(uint256).max);
    }

    function _list(uint256 amount, uint256 price) internal returns (uint256 listingId) {
        vm.prank(alice);
        listingId = market.list(swordId, amount, price);
    }

    // ------------------------------------------------------------- listing

    function test_ListingEscrowsTheItems() public {
        uint256 listingId = _list(2, PRICE);

        assertEq(loot.balanceOf(alice, swordId), 1, "two of three left the seller");
        assertEq(loot.balanceOf(address(market), swordId), 2, "and are held by the market");

        Marketplace.Listing memory listing = market.listingOf(listingId);
        assertEq(listing.seller, alice);
        assertEq(listing.itemId, swordId);
        assertEq(listing.amount, 2);
        assertEq(listing.price, PRICE);
        assertTrue(listing.active);
    }

    function test_CannotListNothing() public {
        vm.prank(alice);
        vm.expectRevert(Marketplace.Marketplace__ZeroAmount.selector);
        market.list(swordId, 0, PRICE);
    }

    function test_CannotListForFree() public {
        vm.prank(alice);
        vm.expectRevert(Marketplace.Marketplace__ZeroPrice.selector);
        market.list(swordId, 1, 0);
    }

    function test_CannotListWhatYouDoNotHold() public {
        vm.prank(bob);
        vm.expectRevert();
        market.list(swordId, 1, PRICE);
    }

    // ------------------------------------------------------------- cancel

    function test_SellerCancelsAndTakesTheItemsBack() public {
        uint256 listingId = _list(2, PRICE);

        vm.prank(alice);
        market.cancel(listingId);

        assertEq(loot.balanceOf(alice, swordId), 3, "everything came back");
        assertEq(loot.balanceOf(address(market), swordId), 0);
        assertFalse(market.listingOf(listingId).active);
    }

    function test_OnlyTheSellerCancels() public {
        uint256 listingId = _list(1, PRICE);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Marketplace.Marketplace__NotSeller.selector, listingId, bob));
        market.cancel(listingId);
    }

    function test_CannotCancelTwice() public {
        uint256 listingId = _list(1, PRICE);
        vm.prank(alice);
        market.cancel(listingId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Marketplace.Marketplace__NotActive.selector, listingId));
        market.cancel(listingId);
    }

    // ------------------------------------------------------------- buying

    function test_BuyMovesItemsAndSplitsThePayment() public {
        uint256 listingId = _list(2, PRICE);
        uint256 fee = (PRICE * 200) / 10_000;

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);

        vm.prank(bob);
        market.buy(listingId);

        assertEq(token.balanceOf(alice), aliceBefore + PRICE - fee, "seller keeps the price less the fee");
        assertEq(token.balanceOf(treasury), fee, "the fee reached the treasury");
        assertEq(token.balanceOf(bob), bobBefore - PRICE, "the buyer paid exactly the price");
        assertEq(loot.balanceOf(bob, swordId), 2, "the items arrived");
        assertEq(loot.balanceOf(address(market), swordId), 0, "the market keeps nothing");
    }

    function test_QuoteMatchesWhatBuyingDoes() public {
        uint256 listingId = _list(1, PRICE);
        (uint256 price, uint256 fee, uint256 proceeds) = market.quote(listingId);

        assertEq(price, PRICE);
        assertEq(fee, (PRICE * 200) / 10_000);
        assertEq(proceeds, PRICE - fee);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(bob);
        market.buy(listingId);
        assertEq(token.balanceOf(alice) - aliceBefore, proceeds);
    }

    function test_ASoldListingCannotBeBoughtAgain() public {
        uint256 listingId = _list(1, PRICE);
        vm.prank(bob);
        market.buy(listingId);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Marketplace.Marketplace__NotActive.selector, listingId));
        market.buy(listingId);
    }

    function test_ASoldListingCannotBeCancelled() public {
        uint256 listingId = _list(1, PRICE);
        vm.prank(bob);
        market.buy(listingId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Marketplace.Marketplace__NotActive.selector, listingId));
        market.cancel(listingId);
    }

    function test_SellerCannotBuyTheirOwnListing() public {
        uint256 listingId = _list(1, PRICE);
        token.mint(alice, 1000 ether);
        vm.startPrank(alice);
        token.approve(address(market), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(Marketplace.Marketplace__CannotBuyYourOwnListing.selector, listingId)
        );
        market.buy(listingId);
        vm.stopPrank();
    }

    function test_BuyingNeedsTheMoney() public {
        uint256 listingId = _list(1, PRICE);
        address broke = address(0xB204E);
        vm.startPrank(broke);
        token.approve(address(market), type(uint256).max);
        vm.expectRevert();
        market.buy(listingId);
        vm.stopPrank();
    }

    function test_UnknownListingsAreRejected() public {
        vm.expectRevert(abi.encodeWithSelector(Marketplace.Marketplace__UnknownListing.selector, uint256(99)));
        market.quote(99);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Marketplace.Marketplace__UnknownListing.selector, uint256(99)));
        market.buy(99);
    }

    // ------------------------------------------------------------- fee

    function test_FeeFollowsTheTreasury() public {
        address newTreasury = address(0xFEE5);
        market.setTreasury(newTreasury);

        uint256 listingId = _list(1, PRICE);
        vm.prank(bob);
        market.buy(listingId);

        assertEq(token.balanceOf(newTreasury), (PRICE * 200) / 10_000);
        assertEq(token.balanceOf(treasury), 0);
    }

    function test_OnlyTheOwnerMovesTheTreasury() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setTreasury(alice);
    }

    function test_ATinyPriceRoundsTheFeeDownRatherThanReverting() public {
        // 49 wei of VAEL: the fee floors to zero and the seller keeps all of it. Worth pinning,
        // because the alternative implementations either revert or round the fee up onto the buyer.
        uint256 listingId = _list(1, 49);
        (, uint256 fee, uint256 proceeds) = market.quote(listingId);
        assertEq(fee, 0);
        assertEq(proceeds, 49);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(bob);
        market.buy(listingId);
        assertEq(token.balanceOf(alice) - aliceBefore, 49);
        assertEq(token.balanceOf(treasury), 0);
    }
}
