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
