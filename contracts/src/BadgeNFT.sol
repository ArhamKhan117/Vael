// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BadgeNFT
 * @notice ERC-721 NFT collection for quest completion badges.
 *         Mints badges when users complete quests.
 */
contract BadgeNFT is ERC721, ERC721URIStorage, Ownable {
    address public questManager;

    uint256 private _nextTokenId = 1;

    // Badge level => metadata URI
    mapping(uint256 => string) private _badgeLevelUris;

    // Token ID => badge level
    mapping(uint256 => uint256) public badgeLevelByTokenId;
    // Token ID => quest ID
    mapping(uint256 => uint256) public questIdByTokenId;

    event QuestManagerUpdated(address indexed questManager);
    event BadgeMinted(address indexed to, uint256 indexed questId, uint256 badgeLevel, uint256 tokenId);

    error BadgeNFT__OnlyQuestManager();
    error BadgeNFT__InvalidQuestManager();
    error BadgeNFT__MetadataTooLarge();
    error BadgeNFT__InvalidBadgeLevel();
    error BadgeNFT__MetadataMissing();

    modifier onlyQuestManager() {
        _requireQuestManager();
        _;
    }

    constructor(address owner_) ERC721("Vael Quest Badges", "VQB") Ownable(owner_) {}

    function setQuestManager(address questManager_) external onlyOwner {
        if (questManager_ == address(0)) revert BadgeNFT__InvalidQuestManager();
        questManager = questManager_;
        emit QuestManagerUpdated(questManager_);
    }

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
     * @notice Mint a badge NFT to a user upon quest completion.
     *         Only callable by QuestManager.
     * @param to Address to receive the badge
     * @param questId ID of the completed quest
     * @param badgeLevel Level of the badge (1-10)
     * @return tokenId The minted token ID
     */
    function mintBadge(address to, uint256 questId, uint256 badgeLevel)
        external
        onlyQuestManager
        returns (uint256)
    {
        if (badgeLevel == 0) revert BadgeNFT__InvalidBadgeLevel();

        string memory metadataURI = _badgeLevelUris[badgeLevel];
        if (bytes(metadataURI).length == 0) revert BadgeNFT__MetadataMissing();
        if (bytes(metadataURI).length > 200) revert BadgeNFT__MetadataTooLarge();

        uint256 tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        badgeLevelByTokenId[tokenId] = badgeLevel;
        questIdByTokenId[tokenId] = questId;

        emit BadgeMinted(to, questId, badgeLevel, tokenId);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _requireQuestManager() internal view {
        if (msg.sender != questManager) revert BadgeNFT__OnlyQuestManager();
    }
}
