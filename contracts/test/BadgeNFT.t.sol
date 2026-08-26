// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {BadgeNFT} from "../src/BadgeNFT.sol";

/// @notice A badge is a record, so the tests are about the two ways a record stops being one:
/// changing hands, and carrying a rarity that does not match what was minted.
contract BadgeNFTTest is Test {
    BadgeNFT internal badge;

    address internal owner = address(this);
    address internal questManager = address(0x0001);
    address internal raidBoss = address(0x0002);
    address internal player = address(0x2222);
    address internal other = address(0x3333);

    function setUp() public {
        badge = new BadgeNFT(owner);
        badge.setQuestManager(questManager);
        badge.setMinter(raidBoss, true);
    }

    function _mint(uint256 questId, uint256 level) internal returns (uint256) {
        vm.prank(questManager);
        return badge.mintBadge(player, questId, level);
    }

    // --- minting and access ---

    function test_OnlyQuestManagerOrMinterCanMint() public {
        vm.prank(other);
        vm.expectRevert(BadgeNFT.BadgeNFT__OnlyQuestManager.selector);
        badge.mintBadge(player, 1, 1);

        vm.prank(raidBoss);
        uint256 tokenId = badge.mintBadge(player, 7, 1);
        assertEq(badge.ownerOf(tokenId), player);
    }

    function test_MintsWithoutArtworkConfigured() public {
        // A missing artwork URI must never fail a mint: the mint happens inside a quest
        // completion, and a revert there would fail the whole verified proof.
        uint256 tokenId = _mint(1, 1);
        assertEq(badge.ownerOf(tokenId), player);
        assertEq(badge.badgeURI(1), "");
    }

    function test_RejectsBadgeLevelZero() public {
        vm.prank(questManager);
        vm.expectRevert(BadgeNFT.BadgeNFT__InvalidBadgeLevel.selector);
        badge.mintBadge(player, 1, 0);
    }

    function test_TokenIdsIncrement() public {
        assertEq(_mint(1, 1), 1);
        assertEq(_mint(2, 1), 2);
        assertEq(_mint(3, 1), 3);
    }

    // --- soul-bound ---

    function test_TransferFromReverts() public {
        uint256 tokenId = _mint(1, 1);
        vm.prank(player);
        vm.expectRevert(BadgeNFT.BadgeNFT__SoulBound.selector);
        badge.transferFrom(player, other, tokenId);
    }

    function test_SafeTransferFromReverts() public {
        uint256 tokenId = _mint(1, 1);
        vm.prank(player);
        vm.expectRevert(BadgeNFT.BadgeNFT__SoulBound.selector);
        badge.safeTransferFrom(player, other, tokenId);
    }

    function test_ApproveReverts() public {
        uint256 tokenId = _mint(1, 1);
        vm.prank(player);
        vm.expectRevert(BadgeNFT.BadgeNFT__SoulBound.selector);
        badge.approve(other, tokenId);
    }

    function test_SetApprovalForAllReverts() public {
        _mint(1, 1);
        vm.prank(player);
        vm.expectRevert(BadgeNFT.BadgeNFT__SoulBound.selector);
        badge.setApprovalForAll(other, true);
    }

    function test_OwnerMayBurnTheirOwnBadge() public {
        uint256 tokenId = _mint(1, 1);
        vm.prank(player);
        badge.burn(tokenId);
        assertEq(badge.balanceOf(player), 0);
    }

    function test_NobodyElseMayBurn() public {
        uint256 tokenId = _mint(1, 1);
        vm.prank(other);
        vm.expectRevert(BadgeNFT.BadgeNFT__SoulBound.selector);
        badge.burn(tokenId);

        // Not even the contract owner.
        vm.expectRevert(BadgeNFT.BadgeNFT__SoulBound.selector);
        badge.burn(tokenId);
    }

    // --- rarity ---

    function test_DefaultRarityFollowsBadgeLevel() public view {
        assertEq(uint256(badge.rarityForBadgeLevel(1)), uint256(BadgeNFT.Rarity.Common));
        assertEq(uint256(badge.rarityForBadgeLevel(2)), uint256(BadgeNFT.Rarity.Uncommon));
        assertEq(uint256(badge.rarityForBadgeLevel(3)), uint256(BadgeNFT.Rarity.Rare));
        assertEq(uint256(badge.rarityForBadgeLevel(4)), uint256(BadgeNFT.Rarity.Epic));
        assertEq(uint256(badge.rarityForBadgeLevel(5)), uint256(BadgeNFT.Rarity.Legendary));
        // Anything above the top level stays Legendary rather than overflowing the enum.
        assertEq(uint256(badge.rarityForBadgeLevel(50)), uint256(BadgeNFT.Rarity.Legendary));
    }

    function test_RarityIsRecordedPerToken() public {
        uint256 common = _mint(1, 1);
        uint256 epic = _mint(2, 4);

        assertEq(uint256(badge.rarityByTokenId(common)), uint256(BadgeNFT.Rarity.Common));
        assertEq(uint256(badge.rarityByTokenId(epic)), uint256(BadgeNFT.Rarity.Epic));
    }

    function test_ExplicitRarityOverridesTheDefault() public {
        vm.prank(questManager);
        uint256 tokenId = badge.mintBadgeWithRarity(player, 1, 1, BadgeNFT.Rarity.Legendary);

        assertEq(uint256(badge.rarityByTokenId(tokenId)), uint256(BadgeNFT.Rarity.Legendary));
        // The level is untouched by the rarity choice.
        assertEq(badge.badgeLevelByTokenId(tokenId), 1);
    }

    function test_RarityOfOneTokenIsUnaffectedByLaterMints() public {
        uint256 first = _mint(1, 1);
        _mint(2, 5);
        vm.prank(questManager);
        badge.mintBadgeWithRarity(other, 3, 1, BadgeNFT.Rarity.Rare);

        // Rarity is set once at mint and there is no setter, so the first token is where it was.
        assertEq(uint256(badge.rarityByTokenId(first)), uint256(BadgeNFT.Rarity.Common));
    }

    // --- metadata ---

    function test_MetadataNamesTheRarity() public {
        uint256 tokenId = _mint(42, 4);
        string memory json = _decodeTokenURI(tokenId);

        assertTrue(_contains(json, '"trait_type":"Rarity","value":"Epic"'), "rarity attribute");
        assertTrue(_contains(json, '"trait_type":"Badge level","value":4'), "level attribute");
        assertTrue(_contains(json, '"trait_type":"Quest","value":42'), "quest attribute");
        assertTrue(_contains(json, "Vael Quest Badge #1"), "name");
    }

    function test_MetadataCarriesTheArtworkWhenSet() public {
        badge.setBadgeURI(1, "ipfs://badge-one");
        uint256 tokenId = _mint(1, 1);

        string memory json = _decodeTokenURI(tokenId);
        assertTrue(_contains(json, '"image":"ipfs://badge-one"'), "image");
        assertTrue(_contains(json, '"value":"Common"'), "rarity");
    }

    function test_MetadataOmitsTheImageWhenUnset() public {
        uint256 tokenId = _mint(1, 1);
        string memory json = _decodeTokenURI(tokenId);
        assertFalse(_contains(json, '"image"'), "no image field");
    }

    function test_TokenURIRevertsForATokenThatDoesNotExist() public {
        vm.expectRevert();
        badge.tokenURI(99);
    }

    // --- helpers ---

    function _decodeTokenURI(uint256 tokenId) internal view returns (string memory) {
        string memory uri = badge.tokenURI(tokenId);
        bytes memory raw = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        assertTrue(raw.length > prefix.length, "uri too short");

        bytes memory encoded = new bytes(raw.length - prefix.length);
        for (uint256 i = 0; i < encoded.length; i++) {
            encoded[i] = raw[prefix.length + i];
        }
        return string(_base64Decode(string(encoded)));
    }

    /// @dev Minimal base64 decoder, enough to read the metadata back out in a test.
    function _base64Decode(string memory input) internal pure returns (bytes memory) {
        bytes memory data = bytes(input);
        uint256 padding = 0;
        if (data.length >= 2) {
            if (data[data.length - 1] == "=") padding++;
            if (data[data.length - 2] == "=") padding++;
        }
        bytes memory result = new bytes((data.length / 4) * 3 - padding);

        uint256 out = 0;
        for (uint256 i = 0; i < data.length; i += 4) {
            uint256 chunk = (_b64Value(data[i]) << 18) | (_b64Value(data[i + 1]) << 12)
                | (_b64Value(data[i + 2]) << 6) | _b64Value(data[i + 3]);
            if (out < result.length) result[out++] = bytes1(uint8(chunk >> 16));
            if (out < result.length) result[out++] = bytes1(uint8((chunk >> 8) & 0xFF));
            if (out < result.length) result[out++] = bytes1(uint8(chunk & 0xFF));
        }
        return result;
    }

    function _b64Value(bytes1 char) internal pure returns (uint256) {
        uint8 c = uint8(char);
        if (c >= 65 && c <= 90) return c - 65; // A-Z
        if (c >= 97 && c <= 122) return c - 97 + 26; // a-z
        if (c >= 48 && c <= 57) return c - 48 + 52; // 0-9
        if (c == 43) return 62; // +
        if (c == 47) return 63; // /
        return 0; // padding
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool matched = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched) return true;
        }
        return false;
    }
}
