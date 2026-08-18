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
        _isTrue("ValidationRegistry.isValidatorAuthorized(QuestManager)", validation.isValidatorAuthorized(address(manager)));
        _eq("CampaignEscrow.rewardToken", address(escrow.rewardToken()), address(token));

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
        require(token.balanceOf(address(vault)) > 0, "VerifyBaseline: reward vault unfunded");
        checks += 2;
        console.log("ok   VaelToken.totalSupply", token.totalSupply());
        console.log("ok   RewardVault VAEL balance", token.balanceOf(address(vault)));

        console.log("=== one-shot bindings still open for milestone 3 ===");
        _eq("QuestManager.questASC is unset", manager.questASC(), ZERO);
        _eq("CampaignEscrow.rewardReleaser is unset", escrow.rewardReleaser(), ZERO);

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
