// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BadgeNFT
 * @notice Soul-bound proof that a wallet completed something the chain verified.
 *
 * @dev Three things changed in v3, each for a reason worth stating.
 *
 * **Soul-bound.** A badge is a record of what an address did, so it cannot be sold or gifted
 * without becoming a lie. `_update` permits mint and burn and rejects everything between, and
 * `approve` and `setApprovalForAll` revert outright rather than succeeding on a token that can
 * never move. Burning stays open: an owner may discard their own record, but nobody can acquire
 * someone else's.
 *
 * **Rarity.** Every token carries a `Rarity` from Common to Legendary. It is set at mint and never
 * afterwards, because a rarity that can be edited is a label rather than a property. Callers that
 * do not name one get the rarity implied by the badge level, so the existing three-argument
 * `mintBadge` keeps working unchanged for QuestManager and RaidBoss.
 *
 * **Metadata built on chain.** `tokenURI` returns a data URI assembled here, with rarity, badge
 * level, and quest id as ERC-721 attributes. Previously the URI was a stored string, so "rarity is
 * in the metadata" would have been a promise about a file this contract cannot see, and a missing
 * string made minting revert. Inside a quest completion that revert would have failed the whole
 * proof. Art is still an owner-set URI per badge level; when one is not set the image is simply
 * omitted and the badge still mints.
 */
contract BadgeNFT is ERC721, Ownable {
    using Strings for uint256;

    /// @notice How rare a badge is, in the order the game speaks about them.
    enum Rarity {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }

    address public questManager;

    /// @notice Contracts other than QuestManager allowed to mint.
    /// @dev RaidBoss mints the RaidVictory badge directly, because a raid is won by the community
    /// rather than completed by one quest. Owner-managed and deliberately narrow: every entry here
    /// is a contract whose own minting path is itself gated on verified proofs.
    mapping(address minter => bool) public minters;

    uint256 private _nextTokenId = 1;

    /// @dev Badge level to the artwork URI shown for it. Optional.
    mapping(uint256 badgeLevel => string uri) private _badgeLevelUris;

    mapping(uint256 tokenId => uint256 badgeLevel) public badgeLevelByTokenId;
    mapping(uint256 tokenId => uint256 questId) public questIdByTokenId;
    mapping(uint256 tokenId => Rarity rarity) public rarityByTokenId;

    event QuestManagerUpdated(address indexed questManager);
    event MinterUpdated(address indexed minter, bool allowed);
    event BadgeMinted(
        address indexed to, uint256 indexed questId, uint256 badgeLevel, uint256 tokenId, Rarity rarity
    );

    error BadgeNFT__OnlyQuestManager();
    error BadgeNFT__InvalidQuestManager();
    error BadgeNFT__MetadataTooLarge();
    error BadgeNFT__InvalidBadgeLevel();
    error BadgeNFT__MetadataMissing();
    error BadgeNFT__SoulBound();

    modifier onlyMinter() {
        if (msg.sender != questManager && !minters[msg.sender]) {
            revert BadgeNFT__OnlyQuestManager();
        }
        _;
    }

    modifier onlyQuestManager() {
        _requireQuestManager();
        _;
    }

    constructor(address owner_) ERC721("Vael Quest Badges", "VQB") Ownable(owner_) {}

    function setMinter(address minter, bool allowed) external onlyOwner {
        if (minter == address(0)) revert BadgeNFT__InvalidQuestManager();
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    function setQuestManager(address questManager_) external onlyOwner {
        if (questManager_ == address(0)) revert BadgeNFT__InvalidQuestManager();
        questManager = questManager_;
        emit QuestManagerUpdated(questManager_);
    }

    /// @notice Set the artwork URI for a badge level.
    /// @dev Optional. A level with no URI mints a badge whose metadata simply carries no image.
    function setBadgeURI(uint256 badgeLevel, string calldata metadataURI) external onlyOwner {
        if (badgeLevel == 0) revert BadgeNFT__InvalidBadgeLevel();
        if (bytes(metadataURI).length == 0) revert BadgeNFT__MetadataMissing();
        if (bytes(metadataURI).length > 200) revert BadgeNFT__MetadataTooLarge();
        _badgeLevelUris[badgeLevel] = metadataURI;
    }

    function badgeURI(uint256 badgeLevel) external view returns (string memory) {
        return _badgeLevelUris[badgeLevel];
    }

    /**
     * @notice Mint a badge, taking the rarity implied by the badge level.
     * @dev This is the signature QuestManager and RaidBoss call, and it is unchanged.
     * @param to Address to receive the badge.
     * @param questId The quest, or for a raid badge the season.
     * @param badgeLevel Level of the badge, 1 and up.
     * @return tokenId The minted token id.
     */
    function mintBadge(address to, uint256 questId, uint256 badgeLevel)
        external
        onlyMinter
        returns (uint256)
    {
        return _mintBadge(to, questId, badgeLevel, rarityForBadgeLevel(badgeLevel));
    }

    /**
     * @notice Mint a badge with an explicit rarity.
     * @dev For callers that know the rarity is not simply a function of the level.
     */
    function mintBadgeWithRarity(address to, uint256 questId, uint256 badgeLevel, Rarity rarity)
        external
        onlyMinter
        returns (uint256)
    {
        return _mintBadge(to, questId, badgeLevel, rarity);
    }

    /// @notice Default rarity for a badge level: 1 is Common through 5 and above, Legendary.
    function rarityForBadgeLevel(uint256 badgeLevel) public pure returns (Rarity) {
        if (badgeLevel == 0) revert BadgeNFT__InvalidBadgeLevel();
        if (badgeLevel >= 5) return Rarity.Legendary;
        return Rarity(badgeLevel - 1);
    }

    /// @notice Rarity as the word the game uses, for anything reading it off chain.
    function rarityName(Rarity rarity) public pure returns (string memory) {
        if (rarity == Rarity.Common) return "Common";
        if (rarity == Rarity.Uncommon) return "Uncommon";
        if (rarity == Rarity.Rare) return "Rare";
        if (rarity == Rarity.Epic) return "Epic";
        return "Legendary";
    }

    /**
     * @notice ERC-721 metadata, assembled here rather than fetched.
     * @dev Rarity is an attribute of the token, so it is written by the contract that knows it.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory image = _badgeLevelUris[badgeLevelByTokenId[tokenId]];
        string memory imageField =
            bytes(image).length == 0 ? "" : string.concat('"image":"', image, '",');

        string memory json = string.concat(
            '{"name":"Vael Quest Badge #',
            tokenId.toString(),
            '","description":"Soul-bound proof of an action Creditcoin verified from an Attestcoin proof.",',
            imageField,
            '"attributes":[{"trait_type":"Rarity","value":"',
            rarityName(rarityByTokenId[tokenId]),
            '"},{"trait_type":"Badge level","value":',
            badgeLevelByTokenId[tokenId].toString(),
            '},{"trait_type":"Quest","value":',
            questIdByTokenId[tokenId].toString(),
            "}]}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @notice Burn a badge you own.
    /// @dev The one way a badge leaves a wallet. Discarding your own record is allowed; acquiring
    /// somebody else's is not.
    function burn(uint256 tokenId) external {
        if (_ownerOf(tokenId) != msg.sender) revert BadgeNFT__SoulBound();
        _burn(tokenId);
    }

    function _mintBadge(address to, uint256 questId, uint256 badgeLevel, Rarity rarity)
        internal
        returns (uint256)
    {
        if (badgeLevel == 0) revert BadgeNFT__InvalidBadgeLevel();

        uint256 tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(to, tokenId);

        badgeLevelByTokenId[tokenId] = badgeLevel;
        questIdByTokenId[tokenId] = questId;
        rarityByTokenId[tokenId] = rarity;

        emit BadgeMinted(to, questId, badgeLevel, tokenId, rarity);
        return tokenId;
    }

    /// @dev Mint and burn pass; every transfer between two addresses is rejected.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert BadgeNFT__SoulBound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert BadgeNFT__SoulBound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert BadgeNFT__SoulBound();
    }

    function _requireQuestManager() internal view {
        if (msg.sender != questManager) revert BadgeNFT__OnlyQuestManager();
    }
}
