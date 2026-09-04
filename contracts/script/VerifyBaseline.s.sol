// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/erc8004/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/erc8004/ValidationRegistry.sol";
import {AgentRegistryAdapter} from "../src/erc8004/AgentRegistryAdapter.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";
import {QuestManager} from "../src/QuestManager.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";
import {QuestASC} from "../src/QuestASC.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";
import {VaelHero} from "../src/game/VaelHero.sol";
import {RaidBoss} from "../src/game/RaidBoss.sol";
import {Arena} from "../src/game/Arena.sol";
import {Loot} from "../src/game/Loot.sol";
import {Equipment} from "../src/game/Equipment.sol";
import {Marketplace} from "../src/game/Marketplace.sol";

/**
 * @title VerifyBaseline
 * @notice Keyless read-back of the milestone 2 baseline deployment. Sends no transaction and
 *         needs no private key. Run it WITHOUT --broadcast:
 *
 *           set -a; source .env; set +a
 *           forge script script/VerifyBaseline.s.sol:VerifyBaseline --rpc-url creditcoin
 *
 *         Every address comes from the environment, which is filled from docs/ADDRESSES.md.
 *         Any slot that disagrees with what was recorded reverts the run, so a silent
 *         rewiring or a stale address book cannot pass.
 */
contract VerifyBaseline is Script {
    uint256 internal constant EXPECTED_CHAIN_ID = 102031;
    uint64 internal constant MAINNET_CHAIN_KEY = 3;
    address internal constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // Log signatures the adapters are registered against. Literals rather than keccak calls so a
    // mistyped signature fails here rather than silently checking the wrong slot.
    bytes32 internal constant TOPIC_PORTAL =
        keccak256("QuestActionPerformed(uint256,address,uint8,address,uint256)");
    bytes32 internal constant TOPIC_TRANSFER = keccak256("Transfer(address,address,uint256)");
    bytes32 internal constant TOPIC_SWAP =
        keccak256("Swap(address,address,int256,int256,uint160,uint128,int24)");
    bytes32 internal constant TOPIC_SUPPLY = keccak256("Supply(address,address,address,uint256,uint16)");
    bytes32 internal constant TOPIC_BORROW =
        keccak256("Borrow(address,address,address,uint256,uint8,uint256,uint16)");
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");
    address internal constant ZERO = address(0);

    uint256 internal checks;

    function _eq(string memory what, address got, address want) internal {
        if (got != want) {
            console.log("MISMATCH", what);
            console.log("  expected", want);
            console.log("  on-chain", got);
            revert(string.concat("VerifyBaseline: ", what));
        }
        checks++;
        console.log("ok  ", what);
    }

    function _isTrue(string memory what, bool got) internal {
        if (!got) revert(string.concat("VerifyBaseline: ", what));
        checks++;
        console.log("ok  ", what);
    }

    function run() external {
        require(block.chainid == EXPECTED_CHAIN_ID, "VerifyBaseline: wrong chain");

        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        IdentityRegistry identity = IdentityRegistry(vm.envAddress("IDENTITY_REGISTRY_ADDRESS"));
        ReputationRegistry reputation = ReputationRegistry(vm.envAddress("REPUTATION_REGISTRY_ADDRESS"));
        ValidationRegistry validation = ValidationRegistry(vm.envAddress("VALIDATION_REGISTRY_ADDRESS"));
        AgentRegistryAdapter adapter = AgentRegistryAdapter(vm.envAddress("AGENT_REGISTRY_ADAPTER_ADDRESS"));
        VaelToken token = VaelToken(vm.envAddress("VAEL_TOKEN_ADDRESS"));
        RewardVault vault = RewardVault(vm.envAddress("REWARD_VAULT_ADDRESS"));
        BadgeNFT badge = BadgeNFT(vm.envAddress("BADGE_NFT_ADDRESS"));
        QuestManager manager = QuestManager(vm.envAddress("QUEST_MANAGER_ADDRESS"));
        QuestASC questASC = QuestASC(vm.envAddress("QUEST_ASC_ADDRESS"));
        address questPortal = vm.envAddress("QUEST_PORTAL_ADDRESS");
        VaelHero hero = VaelHero(vm.envAddress("VAEL_HERO_ADDRESS"));
        RaidBoss raid = RaidBoss(vm.envAddress("RAID_BOSS_ADDRESS"));
        uint64 sepoliaChainKey = uint64(vm.envOr("SOURCE_CHAIN_KEY", uint256(1)));
        CampaignEscrow escrow = CampaignEscrow(vm.envAddress("CAMPAIGN_ESCROW_ADDRESS"));
        Arena arena = Arena(vm.envAddress("ARENA_ADDRESS"));
        Loot loot = Loot(vm.envAddress("LOOT_ADDRESS"));
        Equipment equipment = Equipment(vm.envAddress("EQUIPMENT_ADDRESS"));
        Marketplace market = Marketplace(vm.envAddress("MARKETPLACE_ADDRESS"));

        console.log("=== code present ===");
        _hasCode("IdentityRegistry", address(identity));
        _hasCode("ReputationRegistry", address(reputation));
        _hasCode("ValidationRegistry", address(validation));
        _hasCode("AgentRegistryAdapter", address(adapter));
        _hasCode("VaelToken", address(token));
        _hasCode("RewardVault", address(vault));
        _hasCode("BadgeNFT", address(badge));
        _hasCode("QuestManager", address(manager));
        _hasCode("QuestASC", address(questASC));
        _hasCode("VaelHero", address(hero));
        _hasCode("RaidBoss", address(raid));
        _hasCode("CampaignEscrow", address(escrow));

        console.log("=== QuestManager immutables ===");
        _eq("QuestManager.AGENT_REGISTRY", address(manager.AGENT_REGISTRY()), address(adapter));
        _eq("QuestManager.REWARD_VAULT", address(manager.REWARD_VAULT()), address(vault));
        _eq("QuestManager.BADGE_NFT", address(manager.BADGE_NFT()), address(badge));
        _eq("QuestManager.REPUTATION_REGISTRY", address(manager.REPUTATION_REGISTRY()), address(reputation));
        _eq("QuestManager.VALIDATION_REGISTRY", address(manager.VALIDATION_REGISTRY()), address(validation));

        console.log("=== wiring ===");
        _eq("RewardVault.vaelToken", address(vault.vaelToken()), address(token));
        _eq("RewardVault.questManager", vault.questManager(), address(manager));
        _eq("BadgeNFT.questManager", badge.questManager(), address(manager));
        _isTrue("VaelToken.MINTER_ROLE(RewardVault)", token.hasRole(MINTER_ROLE, address(vault)));
        _isTrue("ReputationRegistry.isReviewerAuthorized(QuestManager)", reputation.isReviewerAuthorized(address(manager)));
        _eq("CampaignEscrow.rewardToken", address(escrow.rewardToken()), address(token));
        // QuestManager holds VALIDATION_REGISTRY as an immutable but calls nothing on it,
        // so it must hold no privilege there.
        require(
            !validation.isValidatorAuthorized(address(manager)),
            "VerifyBaseline: QuestManager should not be an authorized validator"
        );
        checks++;
        console.log("ok   ValidationRegistry grants QuestManager nothing");

        console.log("=== ownership ===");
        _eq("IdentityRegistry.owner", identity.owner(), deployer);
        _eq("ReputationRegistry.owner", reputation.owner(), deployer);
        _eq("ValidationRegistry.owner", validation.owner(), deployer);
        _eq("RewardVault.owner", vault.owner(), deployer);
        _eq("BadgeNFT.owner", badge.owner(), deployer);
        _eq("QuestManager.owner", manager.owner(), deployer);
        _eq("CampaignEscrow.owner", escrow.owner(), deployer);
        _eq("CampaignEscrow.feeCollector", escrow.feeCollector(), deployer);

        console.log("=== agent ===");
        uint256 agentId = identity.agentIdByController(deployer);
        require(agentId != 0, "VerifyBaseline: deployer is not a registered agent");
        _isTrue("IdentityRegistry.isActive(agent)", identity.isActive(agentId));
        _eq("AgentRegistryAdapter resolves the agent", _adapterAgent(adapter, deployer), address(uint160(agentId)));

        console.log("=== supply ===");
        require(token.totalSupply() > 0, "VerifyBaseline: no VAEL minted");
        checks++;
        console.log("ok   VaelToken.totalSupply", token.totalSupply());
        // The vault mints on demand in fundQuest, so a standing balance is a convenience, not a
        // requirement. What must hold is that it can mint at all, asserted above via MINTER_ROLE.
        console.log("     RewardVault VAEL balance", token.balanceOf(address(vault)));

        console.log("=== Attestcoin core ===");
        // The one-shot binding is now closed. Only QuestASC can complete a quest.
        _eq("QuestManager.questASC", manager.questASC(), address(questASC));
        _eq("QuestASC.QUEST_MANAGER", address(questASC.QUEST_MANAGER()), address(manager));
        _eq("CampaignEscrow.rewardReleaser", escrow.rewardReleaser(), address(questASC));
        _eq("QuestASC.campaignEscrow", address(questASC.campaignEscrow()), address(escrow));
        _eq("QuestASC.questPortal(sepolia)", questASC.questPortal(sepoliaChainKey), questPortal);
        // VERIFIER is immutable and taken from the address library, never a constructor argument.
        _eq(
            "QuestASC.VERIFIER is the block prover precompile",
            address(questASC.VERIFIER()),
            0x0000000000000000000000000000000000000FD2
        );
        // All five action types are decodable now. Whether a given log is accepted still depends
        // on an adapter being registered for its signature and its emitter being allowlisted.
        _isTrue("QuestASC decodes Portal", questASC.isActionSupported(VaelTypes.ActionType.Portal));
        _isTrue("QuestASC decodes UniswapSwap", questASC.isActionSupported(VaelTypes.ActionType.UniswapSwap));
        _isTrue("QuestASC decodes Erc20Transfer", questASC.isActionSupported(VaelTypes.ActionType.Erc20Transfer));
        _isTrue("QuestASC decodes AaveSupply", questASC.isActionSupported(VaelTypes.ActionType.AaveSupply));
        _isTrue("QuestASC decodes AaveBorrow", questASC.isActionSupported(VaelTypes.ActionType.AaveBorrow));

        console.log("=== game modules ===");
        // Order matters: RaidBoss reads the hero level VaelHero has just updated.
        _eq("QuestASC.hooks[0] is VaelHero", address(questASC.hooks(0)), address(hero));
        _eq("QuestASC.hooks[1] is RaidBoss", address(questASC.hooks(1)), address(raid));
        require(questASC.hookCount() == 2, "VerifyBaseline: expected exactly two hooks");
        checks++;
        console.log("ok   exactly two hooks registered");

        // Each module must refuse callers other than QuestASC, or anyone could mint XP.
        _eq("VaelHero.questASC", hero.questASC(), address(questASC));
        _eq("RaidBoss.questASC", raid.questASC(), address(questASC));
        _eq("RaidBoss.HERO", address(raid.HERO()), address(hero));
        _eq("RaidBoss.LOOT_TOKEN", address(raid.LOOT_TOKEN()), address(token));
        _isTrue("BadgeNFT lets RaidBoss mint", badge.minters(address(raid)));

        console.log("=== milestone 6 modules ===");
        _hasCode("Arena", address(arena));
        _hasCode("Loot", address(loot));
        _hasCode("Equipment", address(equipment));
        _hasCode("Marketplace", address(market));

        // None of these is a hook, a minter, or anything QuestASC calls. That is the point: they
        // read core state and hold no privilege over it, which is why adding them cost no redeploy.
        require(questASC.hookCount() == 2, "VerifyBaseline: milestone 6 must not have added a hook");
        checks++;
        console.log("ok   milestone 6 added no hook to QuestASC");
        _isTrue("BadgeNFT does not let Arena mint", !badge.minters(address(arena)));
        _isTrue("BadgeNFT does not let Loot mint", !badge.minters(address(loot)));

        _eq("Arena.STAKE_TOKEN", address(arena.STAKE_TOKEN()), address(token));
        _eq("Arena.HERO", address(arena.HERO()), address(hero));
        _eq("Arena.rewards is Loot", address(arena.rewards()), address(loot));
        _eq("Arena.equipment is Equipment", address(arena.equipment()), address(equipment));

        // The duel seed is committed at acceptance rather than chosen at resolution, and the
        // resolution window has to stay inside blockhash's 256-block reach or a duel becomes
        // unresolvable and can only be voided.
        require(arena.SEED_DELAY_BLOCKS() > 0, "VerifyBaseline: Arena seeds from the acceptance block");
        checks++;
        console.log("ok   Arena.SEED_DELAY_BLOCKS", arena.SEED_DELAY_BLOCKS());
        require(
            arena.RESOLVE_WINDOW_BLOCKS() > 0 && arena.RESOLVE_WINDOW_BLOCKS() < 256,
            "VerifyBaseline: Arena resolve window is outside blockhash's reach"
        );
        checks++;
        console.log("ok   Arena.RESOLVE_WINDOW_BLOCKS", arena.RESOLVE_WINDOW_BLOCKS());

        // Loot.arena is both the address Loot trusts and the arena minter role, so a superseded
        // Arena keeping it would keep the ability to mint drops.
        address supersededArena = vm.envOr("ARENA_V2_ADDRESS", address(0));
        if (supersededArena != address(0)) {
            _isTrue(
                "Loot no longer lets the superseded Arena mint",
                loot.arena() != supersededArena
            );
        }

        _eq("Loot.RAID is RaidBoss", address(loot.RAID()), address(raid));
        _eq("Loot.arena is Arena", loot.arena(), address(arena));

        _eq("Equipment.HERO", address(equipment.HERO()), address(hero));
        _eq("Equipment.LOOT", address(equipment.LOOT()), address(loot));

        _eq("Marketplace.PAYMENT_TOKEN", address(market.PAYMENT_TOKEN()), address(token));
        _eq("Marketplace.LOOT", address(market.LOOT()), address(loot));
        _eq("Marketplace.treasury", market.treasury(), deployer);

        // Every rarity needs at least one item, or Loot falls back down the ladder and a raid's
        // biggest contributor is quietly paid in a lower tier than they earned.
        for (uint8 rarity = 0; rarity <= 4; rarity++) {
            _isTrue(
                string.concat("Loot drop pool ", vm.toString(rarity), " is populated"),
                loot.dropPool(Loot.Rarity(rarity)).length > 0
            );
        }

        console.log("=== source chains, adapters, and the emitter allowlist ===");
        // A quest can only complete if the chain is supported, an adapter is registered for the
        // log's signature, and the emitter is allowlisted. All three are asserted here, because a
        // deployment that looks complete and has one of them missing fails at the worst moment:
        // after a player has already done the work on the source chain.
        _isTrue("QuestASC supports chainKey 1", questASC.supportedChain(sepoliaChainKey));
        _isTrue("QuestASC supports chainKey 3", questASC.supportedChain(MAINNET_CHAIN_KEY));

        address portalAdapter = vm.envAddress("PORTAL_ADAPTER_ADDRESS");
        address erc20Adapter = vm.envAddress("ERC20_TRANSFER_ADAPTER_ADDRESS");
        address uniswapAdapter = vm.envAddress("UNISWAP_V3_ADAPTER_ADDRESS");
        address aaveAdapter = vm.envAddress("AAVE_V3_ADAPTER_ADDRESS");

        _eq("adapter Portal", address(questASC.adapters(sepoliaChainKey, TOPIC_PORTAL)), portalAdapter);
        _eq("adapter Erc20Transfer", address(questASC.adapters(sepoliaChainKey, TOPIC_TRANSFER)), erc20Adapter);
        _eq("adapter UniswapSwap", address(questASC.adapters(sepoliaChainKey, TOPIC_SWAP)), uniswapAdapter);
        _eq("adapter AaveSupply", address(questASC.adapters(sepoliaChainKey, TOPIC_SUPPLY)), aaveAdapter);
        _eq("adapter AaveBorrow", address(questASC.adapters(sepoliaChainKey, TOPIC_BORROW)), aaveAdapter);
        _eq(
            "adapter Erc20Transfer on chainKey 3",
            address(questASC.adapters(MAINNET_CHAIN_KEY, TOPIC_TRANSFER)),
            erc20Adapter
        );

        _isTrue(
            "QuestPortal allowlisted for Portal",
            questASC.allowedEmitters(sepoliaChainKey, VaelTypes.ActionType.Portal, questPortal)
        );
        _isTrue(
            "Sepolia USDC allowlisted for Erc20Transfer",
            questASC.allowedEmitters(
                sepoliaChainKey, VaelTypes.ActionType.Erc20Transfer, vm.envAddress("SEPOLIA_USDC")
            )
        );
        _isTrue(
            "Uniswap USDC/WETH 0.05% allowlisted for UniswapSwap",
            questASC.allowedEmitters(
                sepoliaChainKey,
                VaelTypes.ActionType.UniswapSwap,
                vm.envAddress("SEPOLIA_POOL_USDC_WETH_500")
            )
        );
        _isTrue(
            "Aave v3 Pool allowlisted for AaveSupply",
            questASC.allowedEmitters(
                sepoliaChainKey, VaelTypes.ActionType.AaveSupply, vm.envAddress("SEPOLIA_AAVE_POOL")
            )
        );
        _isTrue(
            "Aave v3 Pool allowlisted for AaveBorrow",
            questASC.allowedEmitters(
                sepoliaChainKey, VaelTypes.ActionType.AaveBorrow, vm.envAddress("SEPOLIA_AAVE_POOL")
            )
        );
        // Mainnet is registered and provable. No quest is opened against it, which is a decision
        // recorded in docs/MAINNET_SPIKE.md, not an omission.
        _isTrue(
            "mainnet USDC allowlisted for Erc20Transfer on chainKey 3",
            questASC.allowedEmitters(MAINNET_CHAIN_KEY, VaelTypes.ActionType.Erc20Transfer, MAINNET_USDC)
        );

        console.log("=== migration privileges are closed ===");
        // Both migrations needed a window in which the owner could write state the rest of the
        // system exists to make unwritable. Both windows must be shut.
        _isTrue("VaelHero.importClosed", hero.importClosed());
        console.log("     VaelHero.importedCount", hero.importedCount());
        _isTrue(
            "BadgeNFT no longer lets the deployer mint",
            !badge.minters(deployer)
        );
        // The superseded QuestManager keeps no reviewer privilege on the reputation registry.
        address supersededManager = vm.envOr("SUPERSEDED_QUEST_MANAGER_ADDRESS", address(0));
        if (supersededManager != address(0)) {
            _isTrue(
                "ReputationRegistry no longer authorizes the superseded QuestManager",
                !reputation.isReviewerAuthorized(supersededManager)
            );
        }

        console.log("=== loot registry ===");
        require(loot.nextItemId() > 1, "VerifyBaseline: no loot items registered");
        checks++;
        console.log("ok   Loot registered items", loot.nextItemId() - 1);

        console.log("");
        console.log("VerifyBaseline: all checks passed", checks);
    }

    function _hasCode(string memory what, address target) internal {
        require(target.code.length > 0, string.concat("VerifyBaseline: no code at ", what));
        checks++;
        console.log("ok  ", what, target);
    }

    /// @dev Wraps the adapter call so a revert surfaces as a clear failure.
    function _adapterAgent(AgentRegistryAdapter adapter, address controller) internal view returns (address) {
        return address(uint160(adapter.requireValidAgent(controller)));
    }
}
