// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry, IIdentityRegistry} from "../src/erc8004/ReputationRegistry.sol";
import {ValidationRegistry, IIdentityRegistryMinimal} from "../src/erc8004/ValidationRegistry.sol";
import {AgentRegistryAdapter, IIdentityRegistryReader} from "../src/erc8004/AgentRegistryAdapter.sol";
import {QuestManager} from "../src/QuestManager.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";
import {QuestASC} from "../src/QuestASC.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";
import {ReleaserSet} from "../src/access/ReleaserSet.sol";
import {NativePortal} from "../src/source/NativePortal.sol";
import {CampaignPayoutHook} from "../src/source/CampaignPayoutHook.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {IQuestManager} from "../src/interfaces/IQuestManager.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";
import {ICompletionHook} from "../src/interfaces/ICompletionHook.sol";
import {ChainInfoLib} from "../src/interfaces/IChainInfo.sol";
import {MockChainInfo} from "./mocks/MockChainInfo.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";
import {MockWrappedNative} from "./mocks/MockWrappedNative.sol";

/**
 * A campaign quest completed on the native path is paid from the partner's escrow.
 *
 * CampaignEscrow v1 trusted one releaser, QuestASC, and NativePortal could not reach it: quests 16
 * and 29 completed against the PenguinSwap demo pool on the live network and no token moved. v2
 * trusts a set, and the native path reaches the escrow through CampaignPayoutHook, the one thing
 * the deployed NativePortal lets its owner add. These tests are the claim that the two paths now
 * pay the same amount from the same place, and that nothing else can.
 */
contract CampaignPayoutTest is Test {
    QuestManager public questManager;
    RewardVault public rewardVault;
    BadgeNFT public badgeNft;
    QuestASC public questASC;
    NativePortal public portal;
    CampaignPayoutHook public payoutHook;
    CampaignEscrow public escrow;
    VaelToken public vael;
    MockSwapRouter public router;
    MockWrappedNative public wctc;
    VaelToken public usd1;

    address public owner;
    address public agentController;
    address public partner;
    address public player;
    address public stranger;

    uint64 internal constant SEPOLIA = 1;
    address internal constant SEPOLIA_PORTAL = address(0xB0B0);
    uint256 internal constant REWARD = 120e18;
    uint256 internal constant MIN_IN = 1e18;
    uint256 internal constant CAMPAIGN = 0x50c9;

    function setUp() public {
        owner = address(this);
        agentController = address(0x1111);
        partner = address(0x4444);
        player = address(0x2222);
        stranger = address(0x3333);

        MockChainInfo info = new MockChainInfo();
        vm.etch(ChainInfoLib.PRECOMPILE_ADDRESS, address(info).code);
        MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS).setAttestedHeight(SEPOLIA, 5_000_000);

        IdentityRegistry identity = new IdentityRegistry(owner);
        ReputationRegistry reputation = new ReputationRegistry(owner, IIdentityRegistry(address(identity)));
        ValidationRegistry validation =
            new ValidationRegistry(owner, IIdentityRegistryMinimal(address(identity)));
        AgentRegistryAdapter adapter =
            new AgentRegistryAdapter(IIdentityRegistryReader(address(identity)));
        identity.registerAgent(agentController, "ipfs://agent");

        rewardVault = new RewardVault(owner);
        badgeNft = new BadgeNFT(owner);
        questManager = new QuestManager(owner, adapter, rewardVault, badgeNft, reputation, validation);
        rewardVault.setQuestManager(address(questManager));
        badgeNft.setQuestManager(address(questManager));
        badgeNft.setBadgeURI(1, "ipfs://badge");
        reputation.setReviewerAuthorization(address(questManager), true);

        questASC = new QuestASC(owner, IQuestManager(address(questManager)));
        questASC.setQuestPortal(SEPOLIA, SEPOLIA_PORTAL);
        questManager.setQuestASC(address(questASC));

        portal = new NativePortal(owner, address(questManager));
        questManager.setNativePortal(address(portal));

        vael = new VaelToken(owner);
        vael.grantMinterRole(address(rewardVault));
        vael.grantMinterRole(owner);
        rewardVault.setVaelToken(address(vael));

        usd1 = new VaelToken(owner);
        usd1.grantMinterRole(owner);
        wctc = new MockWrappedNative();
        router = new MockSwapRouter();
        usd1.mint(address(router), 1_000_000e18);
        portal.setSwapRouter(address(router));
        portal.setWrappedNative(address(wctc));

        // The escrow, the hook, and the wiring exactly as redeploy-escrow.sh does it on the live
        // network: escrow first, hook pointed at it, the set bootstrapped with both paths, then
        // QuestASC re-pointed and the hook appended to NativePortal.
        escrow = new CampaignEscrow(owner);
        escrow.setRewardToken(address(vael));
        payoutHook = new CampaignPayoutHook(owner, address(questManager), address(portal));
        payoutHook.setCampaignEscrow(address(escrow));
        address[] memory releasers = new address[](2);
        releasers[0] = address(questASC);
        releasers[1] = address(payoutHook);
        escrow.initialiseReleasers(releasers);
        questASC.setCampaignEscrow(address(escrow));
        portal.addHook(ICompletionHook(address(payoutHook)));

        // The partner funds the pool: a deposit that lands exactly three rewards in it.
        vael.mint(partner, 1_000e18);
        uint256 toDeposit = escrow.getDepositAmountForPool(REWARD * 3);
        vm.startPrank(partner);
        vael.approve(address(escrow), toDeposit);
        escrow.deposit(bytes32(CAMPAIGN), toDeposit);
        vm.stopPrank();

        deal(address(wctc), player, 1_000e18);
        vm.prank(player);
        wctc.approve(address(portal), type(uint256).max);
    }

    function _nativeRule() internal pure returns (VaelTypes.VerificationRule memory) {
        return VaelTypes.VerificationRule({
            actionType: VaelTypes.ActionType.PenguinSwapSwap,
            emitter: address(0),
            token: address(0),
            minAmount: MIN_IN,
            minSourceBlock: 0,
            maxSourceBlock: 0,
            playerMustMatch: true
        });
    }

    function _nativeQuest(uint256 campaignId) internal returns (uint256 questId) {
        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: address(router),
            parametersHash: keccak256("native"),
            metadataURI: "ipfs://native",
            rewardPerParticipant: REWARD,
            expiry: 0,
            badgeLevel: 1,
            participant: player,
            sourceChainKey: 0,
            campaignId: campaignId,
            rule: _nativeRule()
        });
        vm.prank(agentController);
        questId = questManager.createQuest(params);
        vm.prank(player);
        questManager.acceptQuest(questId);
    }

    function _swap(uint256 questId) internal {
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);
    }

    // ---------------------------------------------------------------- the native path pays

    function test_ANativeCampaignQuestIsPaidFromTheEscrowInTheSameTransaction() public {
        uint256 questId = _nativeQuest(CAMPAIGN);
        uint256 poolBefore = escrow.campaignBalance(bytes32(CAMPAIGN));
        uint256 playerBefore = vael.balanceOf(player);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit CampaignEscrow.Released(bytes32(CAMPAIGN), player, REWARD);
        vm.expectEmit(true, true, true, true, address(payoutHook));
        emit CampaignPayoutHook.CampaignRewardReleased(questId, player, CAMPAIGN, REWARD);
        _swap(questId);

        assertEq(poolBefore - escrow.campaignBalance(bytes32(CAMPAIGN)), REWARD, "the pool did not fall by the reward");
        assertEq(vael.balanceOf(player) - playerBefore, REWARD, "the player was not paid the reward");
        assertTrue(questManager.participantProgress(questId, player).completed, "the quest did not complete");
        assertTrue(payoutHook.paid(questId, player), "the payout was not recorded");
    }

    /// @notice The vault does not also pay: a campaign quest is the escrow's, and only the escrow's.
    function test_TheVaultDoesNotPayACampaignQuestOnTheNativePath() public {
        uint256 questId = _nativeQuest(CAMPAIGN);
        uint256 supplyBefore = vael.totalSupply();
        _swap(questId);
        assertEq(vael.totalSupply(), supplyBefore, "VAEL was minted for a campaign quest");
    }

    function test_AVaultNativeQuestLeavesTheEscrowAlone() public {
        uint256 questId = _nativeQuest(0);
        uint256 poolBefore = escrow.campaignBalance(bytes32(CAMPAIGN));
        uint256 playerBefore = vael.balanceOf(player);

        _swap(questId);

        assertEq(escrow.campaignBalance(bytes32(CAMPAIGN)), poolBefore, "a vault quest spent the pool");
        assertEq(vael.balanceOf(player) - playerBefore, REWARD, "the vault did not pay the vault quest");
        assertFalse(payoutHook.paid(questId, player), "the hook recorded a payout it did not make");
    }

    /// @notice The one difference from QuestASC, stated as a test: an underfunded pool cannot block
    /// the completion, because a hook runs inside NativePortal's try/catch, so the completion
    /// stands and the hook says what it could not do.
    function test_AnUnderfundedPoolIsSkippedAndSaidRatherThanBlockingTheCompletion() public {
        uint256 questId = _nativeQuest(CAMPAIGN + 1); // a pool nobody funded
        uint256 playerBefore = vael.balanceOf(player);

        vm.expectEmit(true, true, true, true, address(payoutHook));
        emit CampaignPayoutHook.CampaignRewardSkipped(questId, player, CAMPAIGN + 1, REWARD, 0);
        _swap(questId);

        assertTrue(questManager.participantProgress(questId, player).completed, "the completion was blocked");
        assertEq(vael.balanceOf(player), playerBefore, "something paid an empty pool's quest");
        assertFalse(payoutHook.paid(questId, player), "a skipped payout was recorded as paid");
    }

    // ---------------------------------------------------------------- the proved path still pays

    /// @notice QuestASC is still a releaser, through the same set. The proved path's own tests
    /// (QuestASC.t.sol) drive a real proof; this asserts only that v2 admits it.
    function test_QuestASCIsAReleaserAndNativePortalIsNot() public view {
        assertTrue(escrow.releasers(address(questASC)), "QuestASC is not a releaser");
        assertTrue(escrow.releasers(address(payoutHook)), "the payout hook is not a releaser");
        assertFalse(escrow.releasers(address(portal)), "NativePortal releases directly, which it must not");
        assertFalse(escrow.releasers(owner), "the owner is a releaser");
    }

    // ---------------------------------------------------------------- who is refused

    function test_ANonReleaserCannotRelease() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ReleaserSet.ReleaserSet__NotAReleaser.selector, stranger));
        escrow.releaseReward(bytes32(CAMPAIGN), stranger, REWARD);

        // The owner included. There is no owner release, and that is the point of the set.
        vm.expectRevert(abi.encodeWithSelector(ReleaserSet.ReleaserSet__NotAReleaser.selector, owner));
        escrow.releaseReward(bytes32(CAMPAIGN), owner, REWARD);

        vm.prank(address(portal));
        vm.expectRevert(abi.encodeWithSelector(ReleaserSet.ReleaserSet__NotAReleaser.selector, address(portal)));
        escrow.releaseReward(bytes32(CAMPAIGN), player, REWARD);
    }

    function test_ANonReleaserCannotRefund() public {
        vm.prank(partner);
        vm.expectRevert(abi.encodeWithSelector(ReleaserSet.ReleaserSet__NotAReleaser.selector, partner));
        escrow.refundToPartner(bytes32(CAMPAIGN), partner, REWARD);
    }

    function test_TheHookRefusesAnyCallerButNativePortal() public {
        uint256 questId = _nativeQuest(CAMPAIGN);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(CampaignPayoutHook.CampaignPayoutHook__NotNativePortal.selector, stranger));
        payoutHook.onQuestCompleted(0, questId, player, 5, address(0), 10e18, 1, 1, bytes32(0));

        // The owner is not NativePortal either.
        vm.expectRevert(abi.encodeWithSelector(CampaignPayoutHook.CampaignPayoutHook__NotNativePortal.selector, owner));
        payoutHook.onQuestCompleted(0, questId, player, 5, address(0), 10e18, 1, 1, bytes32(0));
    }

    /// @notice Even NativePortal cannot make the hook pay for a quest QuestManager has not
    /// recorded as completed: the hook reads the completion off the chain, not off its caller.
    function test_TheHookRefusesAQuestThatIsNotCompleted() public {
        uint256 questId = _nativeQuest(CAMPAIGN);
        vm.prank(address(portal));
        vm.expectRevert(
            abi.encodeWithSelector(CampaignPayoutHook.CampaignPayoutHook__NotCompleted.selector, questId, player)
        );
        payoutHook.onQuestCompleted(0, questId, player, 5, address(0), 10e18, 1, 1, bytes32(0));
    }

    function test_TheHookPaysOnce() public {
        uint256 questId = _nativeQuest(CAMPAIGN);
        _swap(questId);
        vm.prank(address(portal));
        vm.expectRevert(
            abi.encodeWithSelector(CampaignPayoutHook.CampaignPayoutHook__AlreadyPaid.selector, questId, player)
        );
        payoutHook.onQuestCompleted(0, questId, player, 5, address(0), 10e18, 1, 1, bytes32(0));
    }

    // ---------------------------------------------------------------- the releaser set

    function test_TheReleaserSetIsBootstrappedOnce() public {
        address[] memory again = new address[](1);
        again[0] = stranger;
        vm.expectRevert(ReleaserSet.ReleaserSet__AlreadyInitialised.selector);
        escrow.initialiseReleasers(again);
        assertFalse(escrow.releasers(stranger));
    }

    function test_AReleaserChangeWaitsADay() public {
        escrow.proposeReleaser(stranger, true);
        assertFalse(escrow.releasers(stranger), "a proposal took effect immediately");

        (, , uint64 readyAt) = escrow.pendingReleaser();
        vm.expectRevert(abi.encodeWithSelector(ReleaserSet.ReleaserSet__DelayNotElapsed.selector, readyAt));
        escrow.acceptReleaser();

        vm.warp(readyAt);
        escrow.acceptReleaser();
        assertTrue(escrow.releasers(stranger), "the accepted change did not apply");

        // Removal is a change like any other, and waits the same day.
        escrow.proposeReleaser(address(payoutHook), false);
        assertTrue(escrow.releasers(address(payoutHook)), "a removal took effect immediately");
        vm.warp(block.timestamp + escrow.RELEASER_DELAY());
        escrow.acceptReleaser();
        assertFalse(escrow.releasers(address(payoutHook)), "the removal did not apply");
    }

    function test_AProposalCanBeCancelledAndOnlyByTheOwner() public {
        escrow.proposeReleaser(stranger, true);
        vm.prank(stranger);
        vm.expectRevert();
        escrow.cancelReleaserProposal();
        escrow.cancelReleaserProposal();
        vm.expectRevert(ReleaserSet.ReleaserSet__NoPendingChange.selector);
        escrow.acceptReleaser();
        assertFalse(escrow.releasers(stranger));
    }
}
