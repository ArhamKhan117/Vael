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
import {NativePortal} from "../src/source/NativePortal.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {VaelHero} from "../src/game/VaelHero.sol";
import {IQuestManager} from "../src/interfaces/IQuestManager.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";
import {ICompletionHook} from "../src/interfaces/ICompletionHook.sol";
import {ChainInfoLib} from "../src/interfaces/IChainInfo.sol";
import {MockChainInfo} from "./mocks/MockChainInfo.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";
import {MockWrappedNative} from "./mocks/MockWrappedNative.sol";

/**
 * The native completion path, which exists because Attestcoin cannot attest Creditcoin to itself.
 *
 * The claim these tests defend is narrow and worth stating: NativePortal is not trusted to report
 * that a swap happened. It performs the swap, and if the swap does not happen the quest does not
 * complete. There is still no key that can pay a player for nothing.
 */
contract NativePortalTest is Test {
    QuestManager public questManager;
    RewardVault public rewardVault;
    BadgeNFT public badgeNft;
    QuestASC public questASC;
    NativePortal public portal;
    VaelToken public vael;
    VaelHero public hero;
    MockSwapRouter public router;
    MockWrappedNative public wctc;
    VaelToken public usd1;

    address public owner;
    address public agentController;
    address public player;
    address public stranger;

    uint64 internal constant SEPOLIA = 1;
    address internal constant SEPOLIA_PORTAL = address(0xB0B0);
    uint256 internal constant REWARD = 100e18;
    uint256 internal constant MIN_IN = 1e18;

    function setUp() public {
        owner = address(this);
        agentController = address(0x1111);
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
        rewardVault.setVaelToken(address(vael));

        // The swap's own tokens, and a router holding enough of the output side to pay out.
        usd1 = new VaelToken(owner);
        usd1.grantMinterRole(owner);
        wctc = new MockWrappedNative();
        router = new MockSwapRouter();
        usd1.mint(address(router), 1_000_000e18);

        portal.setSwapRouter(address(router));
        portal.setWrappedNative(address(wctc));

        // The hero hook, wired to the native path as well as the proved one, because a hook must
        // not be able to tell which path completed a quest.
        hero = new VaelHero(owner);
        address[] memory both = new address[](2);
        both[0] = address(questASC);
        both[1] = address(portal);
        hero.initialiseCompleters(both);
        portal.addHook(ICompletionHook(address(hero)));

        vm.prank(player);
        hero.mintHero();

        deal(address(wctc), player, 1_000e18);
        vm.prank(player);
        wctc.approve(address(portal), type(uint256).max);
        vm.deal(player, 100 ether);
    }

    function _nativeRule(VaelTypes.ActionType action, address token, uint256 minAmount)
        internal
        pure
        returns (VaelTypes.VerificationRule memory)
    {
        return VaelTypes.VerificationRule({
            actionType: action,
            emitter: address(0),
            token: token,
            minAmount: minAmount,
            minSourceBlock: 0,
            maxSourceBlock: 0,
            playerMustMatch: true
        });
    }

    function _nativeQuest(VaelTypes.ActionType action, address token, uint256 minAmount)
        internal
        returns (uint256 questId)
    {
        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: address(router),
            parametersHash: keccak256("native"),
            metadataURI: "ipfs://native",
            rewardPerParticipant: REWARD,
            expiry: 0,
            badgeLevel: 1,
            participant: player,
            // Zero is not a source chain, and a native quest does not have one.
            sourceChainKey: 0,
            campaignId: 0,
            rule: _nativeRule(action, token, minAmount)
        });
        vm.prank(agentController);
        questId = questManager.createQuest(params);
        vm.prank(player);
        questManager.acceptQuest(questId);
    }

    // ---------------------------------------------------------------- the happy path

    function test_ASwapCompletesTheQuestAndPaysInOneTransaction() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);

        uint256 vaelBefore = vael.balanceOf(player);
        uint256 usdBefore = usd1.balanceOf(player);
        uint256 wctcBefore = wctc.balanceOf(player);

        vm.prank(player);
        uint256 out = portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);

        assertEq(out, 10e18, "the router did not pay what it said");
        assertEq(usd1.balanceOf(player) - usdBefore, 10e18, "the player did not receive the output");
        assertEq(wctcBefore - wctc.balanceOf(player), 10e18, "the input did not leave the player");
        assertEq(vael.balanceOf(player) - vaelBefore, REWARD, "the reward was not released");
        assertEq(badgeNft.balanceOf(player), 1, "no badge was minted");

        bool completed = questManager.participantProgress(questId, player).completed;
        assertTrue(completed, "the quest did not complete");
    }

    /// @notice Nothing is held here. A swap leaves no input token and no output token behind.
    function test_ThePortalKeepsNothing() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);

        assertEq(wctc.balanceOf(address(portal)), 0, "input token left in the portal");
        assertEq(usd1.balanceOf(address(portal)), 0, "output token left in the portal");
        assertEq(wctc.allowance(address(portal), address(router)), 0, "an approval was left open");
    }

    function test_TheHeroHookRunsForANativeQuestToo() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);
        uint64 xpBefore = hero.heroByAddress(player).xp;

        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);

        assertGt(hero.heroByAddress(player).xp, xpBefore, "no XP was granted on the native path");
    }

    function test_WrappingNativeCompletesItsQuest() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.WrapNative, address(0), 1 ether);

        uint256 before = wctc.balanceOf(player);
        vm.prank(player);
        portal.wrapNative{value: 2 ether}(questId);

        assertEq(wctc.balanceOf(player) - before, 2 ether, "the player was not given wrapped CTC");
        bool completed = questManager.participantProgress(questId, player).completed;
        assertTrue(completed);
    }

    // ---------------------------------------------------------------- what it refuses

    /// @notice The claim, as a test: if the swap does not happen, the quest does not complete.
    function test_AFailedSwapCompletesNothing() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);
        router.setRevert(true);

        vm.expectRevert(MockSwapRouter.MockSwapRouter__Reverted.selector);
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);

        bool completed = questManager.participantProgress(questId, player).completed;
        assertFalse(completed, "a quest completed without its swap");
        assertEq(vael.balanceOf(player), 0, "a reward was paid without a swap");
    }

    /// @notice And if the swap returns less than the player asked for, it reverts before completion.
    function test_ASwapBelowTheSlippageFloorCompletesNothing() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);
        router.setRate(5_000); // half

        vm.expectRevert();
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 9e18);

        bool completed = questManager.participantProgress(questId, player).completed;
        assertFalse(completed);
    }

    function test_AnAmountBelowTheQuestMinimumIsRefused() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), 5e18);

        vm.expectRevert(
            abi.encodeWithSelector(NativePortal.NativePortal__AmountBelowMinimum.selector, 5e18, 1e18)
        );
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 1e18, 0);
    }

    function test_TheWrongInputTokenIsRefused() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);

        vm.expectRevert(
            abi.encodeWithSelector(
                NativePortal.NativePortal__WrongToken.selector, address(wctc), address(usd1)
            )
        );
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(usd1), address(wctc), 500, 10e18, 0);
    }

    function test_SomebodyElseCannotCompleteYourQuest() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);
        deal(address(wctc), stranger, 100e18);
        vm.prank(stranger);
        wctc.approve(address(portal), type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(NativePortal.NativePortal__NotTheParticipant.selector, player, stranger)
        );
        vm.prank(stranger);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);
    }

    function test_AQuestMustBeAcceptedFirst() public {
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
            campaignId: 0,
            rule: _nativeRule(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN)
        });
        vm.prank(agentController);
        uint256 questId = questManager.createQuest(params);

        vm.expectRevert(
            abi.encodeWithSelector(NativePortal.NativePortal__NotAccepted.selector, questId, player)
        );
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);
    }

    function test_ADuplicateCompletionIsRefused() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);

        vm.expectRevert(
            abi.encodeWithSelector(NativePortal.NativePortal__QuestNotActive.selector, questId)
        );
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);
    }

    function test_TheWrongNativeActionIsRefused() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.WrapNative, address(0), 1 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                NativePortal.NativePortal__WrongAction.selector,
                uint8(VaelTypes.ActionType.PenguinSwapSwap),
                uint8(VaelTypes.ActionType.WrapNative)
            )
        );
        vm.prank(player);
        portal.swapViaPenguinSwap(questId, address(wctc), address(usd1), 500, 10e18, 0);
    }

    // ---------------------------------------------------------------- the two paths stay apart

    /// @notice NativePortal cannot complete a quest that was meant to be proved.
    function test_TheNativePortalCannotCompleteAProvedQuest() public {
        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: SEPOLIA_PORTAL,
            parametersHash: keccak256("proved"),
            metadataURI: "ipfs://proved",
            rewardPerParticipant: REWARD,
            expiry: 0,
            badgeLevel: 1,
            participant: player,
            sourceChainKey: SEPOLIA,
            campaignId: 0,
            rule: _nativeRule(VaelTypes.ActionType.Portal, address(0), 0)
        });
        vm.prank(agentController);
        uint256 questId = questManager.createQuest(params);
        vm.prank(player);
        questManager.acceptQuest(questId);

        // Straight at QuestManager, as the portal itself: refused, because this quest's path is
        // QuestASC and a quest belongs to exactly one path.
        vm.expectRevert(
            abi.encodeWithSelector(
                QuestManager.QuestManager__WrongCompleter.selector, address(portal), address(questASC)
            )
        );
        vm.prank(address(portal));
        questManager.recordCompletion(questId, player, keccak256("k"), keccak256("k"));
    }

    /// @notice And QuestASC cannot complete a native one.
    function test_QuestASCCannotCompleteANativeQuest() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);

        vm.expectRevert(
            abi.encodeWithSelector(
                QuestManager.QuestManager__WrongCompleter.selector, address(questASC), address(portal)
            )
        );
        vm.prank(address(questASC));
        questManager.recordCompletion(questId, player, keccak256("k"), keccak256("k"));
    }

    /// @notice Nobody else can complete anything, which is the point of the whole system.
    function test_NoOtherAddressCanRecordACompletion() public {
        uint256 questId = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);

        vm.expectRevert(
            abi.encodeWithSelector(
                QuestManager.QuestManager__WrongCompleter.selector, owner, address(portal)
            )
        );
        questManager.recordCompletion(questId, player, keccak256("k"), keccak256("k"));
    }

    function test_ANativeQuestIsMarkedAsOneAtCreation() public {
        uint256 native = _nativeQuest(VaelTypes.ActionType.PenguinSwapSwap, address(wctc), MIN_IN);
        assertTrue(questManager.isNativeQuest(native), "a native quest was not marked native");

        VaelTypes.VerificationRule memory stored = questManager.nativeRule(native);
        assertEq(uint8(stored.actionType), uint8(VaelTypes.ActionType.PenguinSwapSwap));
        assertEq(stored.token, address(wctc));
        assertEq(stored.minAmount, MIN_IN);
    }
}
