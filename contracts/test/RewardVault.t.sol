// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";

/// @notice The vault's funding ledger must be namespaced per QuestManager.
/// @dev Quest ids are a per-manager counter that restarts at 1. Before this was namespaced, the
/// first createQuest on a redeployed manager reverted RewardVault__QuestAlreadyFunded(1) and the
/// manager was permanently stuck, because the id counter only advances on a successful create.
/// This was found on the live network, not in review.
contract RewardVaultTest is Test {
    RewardVault internal vault;
    VaelToken internal token;

    address internal owner = address(this);
    address internal managerA = address(0xA11CE);
    address internal managerB = address(0xB0B);
    address internal player = address(0x9999);

    function setUp() public {
        vault = new RewardVault(owner);
        token = new VaelToken(owner);
        token.grantMinterRole(address(vault));
        vault.setVaelToken(address(token));
        vault.setQuestManager(managerA);
    }

    function test_SameQuestIdUnderTwoManagersIsTwoLedgerEntries() public {
        vm.prank(managerA);
        vault.fundQuest(1, 100 ether);

        // A redeployed manager starts its ids at 1 again. That must not collide.
        vault.setQuestManager(managerB);
        vm.prank(managerB);
        vault.fundQuest(1, 250 ether);

        assertEq(vault.rewardInfo(1).totalAmount, 250 ether, "manager B sees its own entry");

        vault.setQuestManager(managerA);
        assertEq(vault.rewardInfo(1).totalAmount, 100 ether, "manager A entry is intact");
    }

    function test_DoubleFundingUnderTheSameManagerStillReverts() public {
        vm.prank(managerA);
        vault.fundQuest(1, 100 ether);

        vm.expectRevert(
            abi.encodeWithSelector(RewardVault.RewardVault__QuestAlreadyFunded.selector, uint256(1))
        );
        vm.prank(managerA);
        vault.fundQuest(1, 100 ether);
    }

    function test_ReleaseReadsTheCurrentManagerLedger() public {
        vm.prank(managerA);
        vault.fundQuest(7, 100 ether);

        vm.prank(managerA);
        vault.releaseReward(7, player, 100 ether);
        assertEq(token.balanceOf(player), 100 ether);
    }

    function test_ReleaseFailsForAnotherManagersQuest() public {
        vm.prank(managerA);
        vault.fundQuest(7, 100 ether);

        vault.setQuestManager(managerB);
        vm.expectRevert(
            abi.encodeWithSelector(RewardVault.RewardVault__QuestNotFunded.selector, uint256(7))
        );
        vm.prank(managerB);
        vault.releaseReward(7, player, 100 ether);
    }
}
