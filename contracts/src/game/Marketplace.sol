// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Marketplace
/// @notice Fixed-price sales of Loot items for VAEL.
///
/// @dev Standalone, and deliberately dull. Listings are fixed price with no auction, no offers,
/// and no royalties, because every mechanism added here is a mechanism that can go wrong with
/// somebody else's item inside it.
///
/// **Items are escrowed on listing.** A listing backed by a balance the seller still holds is a
/// promise, not an offer: it can be spent, equipped, or sold elsewhere between listing and buying,
/// and the buyer discovers that only when their purchase reverts. Escrow makes every visible
/// listing fillable.
///
/// Payment is pull-free: the buyer's VAEL moves straight to the seller in the same call that moves
/// the item, so neither side is left holding a claim.
contract Marketplace is Ownable, ERC1155Holder {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint256 itemId;
        uint256 amount;
        /// @dev Price for the whole listing, not per unit. Partial fills would need a price per
        /// unit and a remainder, and neither is worth the surface here.
        uint256 price;
        bool active;
    }

    /// @notice Basis points of every sale taken as a fee.
    uint256 public constant FEE_BPS = 200;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable PAYMENT_TOKEN;
    IERC1155 public immutable LOOT;

    /// @notice Where the fee goes.
    address public treasury;

    uint256 public nextListingId = 1;
    mapping(uint256 listingId => Listing) public listings;

    event TreasuryUpdated(address indexed treasury);
    event Listed(
        uint256 indexed listingId, address indexed seller, uint256 indexed itemId, uint256 amount, uint256 price
    );
    event Cancelled(uint256 indexed listingId, address indexed seller, uint256 indexed itemId, uint256 amount);
    event Sold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        uint256 itemId,
        uint256 amount,
        uint256 price,
        uint256 fee
    );

    error Marketplace__ZeroAddress();
    error Marketplace__ZeroAmount();
    error Marketplace__ZeroPrice();
    error Marketplace__UnknownListing(uint256 listingId);
    error Marketplace__NotActive(uint256 listingId);
    error Marketplace__NotSeller(uint256 listingId, address caller);
    error Marketplace__CannotBuyYourOwnListing(uint256 listingId);

    constructor(address owner_, address paymentToken, address loot, address treasury_) Ownable(owner_) {
        if (paymentToken == address(0) || loot == address(0) || treasury_ == address(0)) {
            revert Marketplace__ZeroAddress();
        }
        PAYMENT_TOKEN = IERC20(paymentToken);
        LOOT = IERC1155(loot);
        treasury = treasury_;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert Marketplace__ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Offer items for sale at a fixed total price.
    function list(uint256 itemId, uint256 amount, uint256 price) external returns (uint256 listingId) {
        if (amount == 0) revert Marketplace__ZeroAmount();
        if (price == 0) revert Marketplace__ZeroPrice();

        listingId = nextListingId;
        nextListingId += 1;

        listings[listingId] =
            Listing({seller: msg.sender, itemId: itemId, amount: amount, price: price, active: true});

        LOOT.safeTransferFrom(msg.sender, address(this), itemId, amount, "");

        emit Listed(listingId, msg.sender, itemId, amount, price);
    }

    /// @notice Withdraw a listing and take the items back.
    function cancel(uint256 listingId) external {
        Listing storage listing = _active(listingId);
        if (listing.seller != msg.sender) revert Marketplace__NotSeller(listingId, msg.sender);

        listing.active = false;
        LOOT.safeTransferFrom(address(this), listing.seller, listing.itemId, listing.amount, "");

        emit Cancelled(listingId, listing.seller, listing.itemId, listing.amount);
    }

    /// @notice Buy a listing outright.
    /// @dev The listing is closed before any transfer, so a token with a callback cannot re-enter
    /// and buy it twice.
    function buy(uint256 listingId) external {
        Listing storage listing = _active(listingId);
        if (listing.seller == msg.sender) revert Marketplace__CannotBuyYourOwnListing(listingId);

        listing.active = false;

        uint256 fee = (listing.price * FEE_BPS) / BPS_DENOMINATOR;
        uint256 proceeds = listing.price - fee;

        PAYMENT_TOKEN.safeTransferFrom(msg.sender, listing.seller, proceeds);
        if (fee > 0) PAYMENT_TOKEN.safeTransferFrom(msg.sender, treasury, fee);
        LOOT.safeTransferFrom(address(this), msg.sender, listing.itemId, listing.amount, "");

        emit Sold(listingId, listing.seller, msg.sender, listing.itemId, listing.amount, listing.price, fee);
    }

    /// @notice What a buyer pays and what the seller keeps.
    function quote(uint256 listingId) external view returns (uint256 price, uint256 fee, uint256 proceeds) {
        Listing memory listing = listings[listingId];
        if (listing.seller == address(0)) revert Marketplace__UnknownListing(listingId);
        price = listing.price;
        fee = (price * FEE_BPS) / BPS_DENOMINATOR;
        proceeds = price - fee;
    }

    function listingOf(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function _active(uint256 listingId) internal view returns (Listing storage listing) {
        listing = listings[listingId];
        if (listing.seller == address(0)) revert Marketplace__UnknownListing(listingId);
        if (!listing.active) revert Marketplace__NotActive(listingId);
    }
}
