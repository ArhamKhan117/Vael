// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry, IIdentityRegistry} from "../src/erc8004/ReputationRegistry.sol";
import {ValidationRegistry, IIdentityRegistryMinimal} from "../src/erc8004/ValidationRegistry.sol";
import {AgentRegistryAdapter, IIdentityRegistryReader} from "../src/erc8004/AgentRegistryAdapter.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";
import {QuestManager} from "../src/QuestManager.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";

/**
 * Creditcoin deployment scripts.
 *
 * The Creditcoin RPC returns block objects without `mixHash`, so `forge script --broadcast`
 * fails after the first transaction it sends. Every contract below therefore broadcasts
 * exactly one transaction and reads its dependencies from environment addresses. Run them in
 * order, record each address, and confirm each with `cast call` before moving on.
 *
 *   forge script script/Deploy.s.sol:DeployIdentityRegistry --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployReputationRegistry --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployValidationRegistry --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployAgentRegistryAdapter --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployVaelToken --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployRewardVault --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployBadgeNFT --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployQuestManager --rpc-url creditcoin --broadcast
 *   forge script script/Deploy.s.sol:DeployCampaignEscrow --rpc-url creditcoin --broadcast
 *
 * Wiring is one `cast send` per call, each read back with `cast call`:
 *
 *   cast send $VAEL_TOKEN_ADDRESS       "grantMinterRole(address)"          $REWARD_VAULT_ADDRESS
 *   cast send $REWARD_VAULT_ADDRESS     "setVaelToken(address)"             $VAEL_TOKEN_ADDRESS
 *   cast send $REWARD_VAULT_ADDRESS     "setQuestManager(address)"          $QUEST_MANAGER_ADDRESS
 *   cast send $BADGE_NFT_ADDRESS        "setQuestManager(address)"          $QUEST_MANAGER_ADDRESS
 *   cast send $REPUTATION_REGISTRY_ADDRESS "setReviewerAuthorization(address,bool)" $QUEST_MANAGER_ADDRESS true
 *   cast send $CAMPAIGN_ESCROW_ADDRESS  "setRewardToken(address)"           $REWARD_STABLE_ADDRESS
 *   cast send $BADGE_NFT_ADDRESS        "setBadgeURI(uint256,string)"       <level> <ipfs uri>
 *
 * `QuestManager.setQuestASC` and `CampaignEscrow.setRewardReleaser` are wired to QuestASC in
 * milestone 3, once that contract exists. `setQuestASC` is one-shot, so it is the last call made.
 */
abstract contract DeployBase is Script {
    function _deployer() internal view returns (uint256 pk, address addr) {
        pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        addr = vm.addr(pk);
        console.log("Deployer:", addr);
        console.log("Balance:", addr.balance);
    }
}

contract DeployIdentityRegistry is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        vm.broadcast(pk);
        IdentityRegistry registry = new IdentityRegistry(deployer);
        console.log("IDENTITY_REGISTRY_ADDRESS=", address(registry));
    }
}

contract DeployReputationRegistry is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        address identity = vm.envAddress("IDENTITY_REGISTRY_ADDRESS");
        vm.broadcast(pk);
        ReputationRegistry registry = new ReputationRegistry(deployer, IIdentityRegistry(identity));
        console.log("REPUTATION_REGISTRY_ADDRESS=", address(registry));
    }
}

contract DeployValidationRegistry is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        address identity = vm.envAddress("IDENTITY_REGISTRY_ADDRESS");
        vm.broadcast(pk);
        ValidationRegistry registry = new ValidationRegistry(deployer, IIdentityRegistryMinimal(identity));
        console.log("VALIDATION_REGISTRY_ADDRESS=", address(registry));
    }
}

contract DeployAgentRegistryAdapter is DeployBase {
    function run() external {
        (uint256 pk,) = _deployer();
        address identity = vm.envAddress("IDENTITY_REGISTRY_ADDRESS");
        vm.broadcast(pk);
        AgentRegistryAdapter adapter = new AgentRegistryAdapter(IIdentityRegistryReader(identity));
        console.log("AGENT_REGISTRY_ADAPTER_ADDRESS=", address(adapter));
    }
}

contract DeployVaelToken is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        vm.broadcast(pk);
        VaelToken token = new VaelToken(deployer);
        console.log("VAEL_TOKEN_ADDRESS=", address(token));
    }
}

contract DeployRewardVault is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        vm.broadcast(pk);
        RewardVault vault = new RewardVault(deployer);
        console.log("REWARD_VAULT_ADDRESS=", address(vault));
    }
}

contract DeployBadgeNFT is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        vm.broadcast(pk);
        BadgeNFT badge = new BadgeNFT(deployer);
        console.log("BADGE_NFT_ADDRESS=", address(badge));
    }
}

contract DeployQuestManager is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        AgentRegistryAdapter adapter = AgentRegistryAdapter(vm.envAddress("AGENT_REGISTRY_ADAPTER_ADDRESS"));
        RewardVault vault = RewardVault(vm.envAddress("REWARD_VAULT_ADDRESS"));
        BadgeNFT badge = BadgeNFT(vm.envAddress("BADGE_NFT_ADDRESS"));
        ReputationRegistry reputation = ReputationRegistry(vm.envAddress("REPUTATION_REGISTRY_ADDRESS"));
        ValidationRegistry validation = ValidationRegistry(vm.envAddress("VALIDATION_REGISTRY_ADDRESS"));
        vm.broadcast(pk);
        QuestManager manager = new QuestManager(deployer, adapter, vault, badge, reputation, validation);
        console.log("QUEST_MANAGER_ADDRESS=", address(manager));
    }
}

contract DeployCampaignEscrow is DeployBase {
    function run() external {
        (uint256 pk, address deployer) = _deployer();
        vm.broadcast(pk);
        CampaignEscrow escrow = new CampaignEscrow(deployer);
        console.log("CAMPAIGN_ESCROW_ADDRESS=", address(escrow));
        console.log("Next: cast send <escrow> \"setRewardToken(address)\" <reward token>");
    }
}
