// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ICompletionHook} from "../interfaces/ICompletionHook.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

/// @title VaelHero
/// @notice A soul-bound hero that levels only from verified proofs.
///
/// @dev Every point of XP on every hero traces to one `replayKey`: a log in a source transaction
/// that the Attestcoin block prover verified on Creditcoin. `grantXP` is unreachable except through
/// `onQuestCompleted`, and that is callable only by QuestASC. There is no owner function that
/// grants XP, and adding one would make the leaderboard meaningless.
///
/// Soul-bound because a hero is a record of what an address did. A transferable one would be a
/// tradeable claim about someone else's history.
contract VaelHero is ERC721, Ownable, ICompletionHook {
    struct Hero {
        uint32 level;
        uint64 xp;
        uint16 strength;
        uint16 agility;
        uint16 intellect;
        /// @dev Four equipment slots, reserved for the loot module in a later phase.
        uint16[4] equipment;
        /// @dev Source block of the most recent action, for the streak window.
        uint64 lastActionSourceBlock;
        uint16 streak;
    }

    /// @notice Base XP per action type, indexed by `VaelTypes.ActionType`.
    /// @dev Rising with how much work the action takes: a portal check-in is one call, an Aave
    /// borrow needs collateral already supplied.
    uint64 internal constant XP_PORTAL = 50;
    uint64 internal constant XP_ERC20_TRANSFER = 60;
    uint64 internal constant XP_UNISWAP_SWAP = 100;
    uint64 internal constant XP_AAVE_SUPPLY = 120;
    uint64 internal constant XP_AAVE_BORROW = 150;

    /// @notice Sepolia blocks within which a further action continues a streak.
    /// @dev 7200 blocks is roughly a day at 12 second blocks. Recorded now, spent in milestone 6: the
    /// streak multiplier is not applied to XP yet, so the number here is data, not balance.
    uint64 public constant STREAK_WINDOW_BLOCKS = 7200;

    /// @notice The only address allowed to grant XP. Set once.
    address public questASC;

    mapping(address player => uint256 tokenId) public heroOf;
    mapping(uint256 tokenId => Hero) private _heroes;

    uint256 private _nextTokenId = 1;

    event HeroMinted(address indexed player, uint256 indexed tokenId);
    event HeroXPGranted(
        address indexed player,
        uint256 indexed tokenId,
        uint8 actionType,
        uint8 tier,
        uint64 xpGained,
        bytes32 replayKey
    );
    event HeroLeveled(address indexed player, uint256 indexed tokenId, uint32 newLevel);
    event QuestASCUpdated(address indexed questASC);

    error VaelHero__OnlyQuestASC(address caller);
    error VaelHero__QuestASCAlreadySet(address current);
    error VaelHero__InvalidQuestASC();
    error VaelHero__AlreadyHasHero(address player);
    error VaelHero__SoulBound();
    error VaelHero__NoHero(address player);

    constructor(address owner_) ERC721("Vael Hero", "VHERO") Ownable(owner_) {}

    // ---------------------------------------------------------------- admin

    /// @dev One-shot, for the same reason QuestManager's is: no later owner action should be able
    /// to redirect XP to a caller that has not verified a proof.
    function setQuestASC(address questASC_) external onlyOwner {
        if (questASC_ == address(0)) revert VaelHero__InvalidQuestASC();
        if (questASC != address(0)) revert VaelHero__QuestASCAlreadySet(questASC);
        questASC = questASC_;
        emit QuestASCUpdated(questASC_);
    }

    // ---------------------------------------------------------------- minting

    /// @notice Mint your hero. Free, one per wallet.
    function mintHero() external returns (uint256 tokenId) {
        if (heroOf[msg.sender] != 0) revert VaelHero__AlreadyHasHero(msg.sender);
        tokenId = _nextTokenId++;
        heroOf[msg.sender] = tokenId;

        Hero storage hero = _heroes[tokenId];
        hero.level = 1;
        hero.streak = 0;

        _safeMint(msg.sender, tokenId);
        emit HeroMinted(msg.sender, tokenId);
    }

    // ---------------------------------------------------------------- the hook

    /// @inheritdoc ICompletionHook
    /// @dev A player without a hero simply gains nothing. Reverting would make QuestASC log a
    /// `HookFailed` for an ordinary situation, and worse, would tempt someone to make the reward
    /// depend on having minted first.
    function onQuestCompleted(
        uint64,
        uint256,
        address player,
        uint8 actionType,
        address,
        uint256,
        uint8 tier,
        uint64 sourceBlock,
        bytes32 replayKey
    ) external {
        if (msg.sender != questASC) revert VaelHero__OnlyQuestASC(msg.sender);

        uint256 tokenId = heroOf[player];
        if (tokenId == 0) return;

        _grantXP(player, tokenId, actionType, tier, replayKey, sourceBlock);
    }

    function _grantXP(
        address player,
        uint256 tokenId,
        uint8 actionType,
        uint8 tier,
        bytes32 replayKey,
        uint64 sourceBlock
    ) private {
        Hero storage hero = _heroes[tokenId];

        uint64 gained = _xpFor(actionType, tier);
        hero.xp += gained;
        _applyAffinity(hero, actionType);

        // Streak is recorded, not yet spent. A further action inside the window continues it;
        // anything later starts again at 1.
        if (sourceBlock != 0) {
            if (
                hero.lastActionSourceBlock != 0 &&
                sourceBlock > hero.lastActionSourceBlock &&
                sourceBlock - hero.lastActionSourceBlock <= STREAK_WINDOW_BLOCKS
            ) {
                hero.streak += 1;
            } else {
                hero.streak = 1;
            }
            hero.lastActionSourceBlock = sourceBlock;
        }

        emit HeroXPGranted(player, tokenId, actionType, tier, gained, replayKey);

        // Several levels can arrive from one large action, so this loops rather than adding one.
        while (hero.xp >= xpToNext(hero.level)) {
            hero.xp -= xpToNext(hero.level);
            hero.level += 1;
            emit HeroLeveled(player, tokenId, hero.level);
        }
    }

    // ---------------------------------------------------------------- formulas

    /// @notice XP needed to leave a level.
    function xpToNext(uint32 level) public pure returns (uint64) {
        return 100 + 50 * uint64(level);
    }

    /// @notice Base XP for an action, scaled by tier: x1, x1.5, x2.
    /// @dev The 1.5 is done as `* 3 / 2` so tier 2 on an odd base rounds down rather than needing
    /// a fixed-point type for a number this small.
    function xpFor(uint8 actionType, uint8 tier) external pure returns (uint64) {
        return _xpFor(actionType, tier);
    }

    function _xpFor(uint8 actionType, uint8 tier) private pure returns (uint64) {
        uint64 base = _baseXP(actionType);
        if (tier >= 3) return base * 2;
        if (tier == 2) return (base * 3) / 2;
        return base;
    }

    function _baseXP(uint8 actionType) private pure returns (uint64) {
        VaelTypes.ActionType action = VaelTypes.ActionType(actionType);
        if (action == VaelTypes.ActionType.Portal) return XP_PORTAL;
        if (action == VaelTypes.ActionType.Erc20Transfer) return XP_ERC20_TRANSFER;
        if (action == VaelTypes.ActionType.UniswapSwap) return XP_UNISWAP_SWAP;
        if (action == VaelTypes.ActionType.AaveSupply) return XP_AAVE_SUPPLY;
        return XP_AAVE_BORROW;
    }

    /// @dev One point to the stat the action exercises. Portal and transfers are direct value
    /// movement, so strength; a swap is timing, so agility; lending is planning, so intellect.
    function _applyAffinity(Hero storage hero, uint8 actionType) private {
        VaelTypes.ActionType action = VaelTypes.ActionType(actionType);
        if (action == VaelTypes.ActionType.Portal || action == VaelTypes.ActionType.Erc20Transfer) {
            hero.strength += 1;
        } else if (action == VaelTypes.ActionType.UniswapSwap) {
            hero.agility += 1;
        } else {
            hero.intellect += 1;
        }
    }

    // ---------------------------------------------------------------- views

    function heroById(uint256 tokenId) external view returns (Hero memory) {
        return _heroes[tokenId];
    }

    function heroByAddress(address player) external view returns (Hero memory) {
        uint256 tokenId = heroOf[player];
        if (tokenId == 0) revert VaelHero__NoHero(player);
        return _heroes[tokenId];
    }

    /// @notice Hero level, or 0 when the player has not minted. Read by RaidBoss.
    function levelOf(address player) external view returns (uint32) {
        uint256 tokenId = heroOf[player];
        if (tokenId == 0) return 0;
        return _heroes[tokenId].level;
    }

    function hasHero(address player) external view returns (bool) {
        return heroOf[player] != 0;
    }

    // ---------------------------------------------------------------- soul-bound

    /// @dev Mint and burn only. A hero records what one address did, so it cannot change hands.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert VaelHero__SoulBound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert VaelHero__SoulBound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert VaelHero__SoulBound();
    }
}
