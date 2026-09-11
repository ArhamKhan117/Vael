// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib} from
    "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry, IIdentityRegistry} from "../src/erc8004/ReputationRegistry.sol";
import {ValidationRegistry, IIdentityRegistryMinimal} from "../src/erc8004/ValidationRegistry.sol";
import {AgentRegistryAdapter, IIdentityRegistryReader} from "../src/erc8004/AgentRegistryAdapter.sol";
import {QuestManager} from "../src/QuestManager.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";
import {QuestASC} from "../src/QuestASC.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {VaelAscBase} from "../src/asc/VaelAscBase.sol";
import {IQuestManager} from "../src/interfaces/IQuestManager.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";
import {ChainInfoLib} from "../src/interfaces/IChainInfo.sol";

import {PortalAdapter} from "../src/adapters/PortalAdapter.sol";
import {ICompletionHook} from "../src/interfaces/ICompletionHook.sol";
import {GasBurningHook, RecordingHook, RevertingHook} from "./mocks/HostileHook.sol";
import {MockBlockProver} from "./mocks/MockBlockProver.sol";
import {MockChainInfo} from "./mocks/MockChainInfo.sol";
import {SourceTxFixture} from "./SourceTxFixture.sol";

/// @notice The proof path, end to end, against the real decoder and the real precompile ABI.
/// @dev The block prover and ChainInfo mocks are etched at the real precompile addresses and
/// implement their full interfaces, so these tests exercise the same encode and decode path the
/// live network does. Fixtures are built in the prover's exact wire shape.
contract QuestASCTest is Test {
    IdentityRegistry internal identityRegistry;
    ReputationRegistry internal reputationRegistry;
    ValidationRegistry internal validationRegistry;
    AgentRegistryAdapter internal agentRegistryAdapter;
    RewardVault internal rewardVault;
    BadgeNFT internal badgeNft;
    VaelToken internal vaelToken;
    QuestManager internal questManager;
    QuestASC internal questASC;
    PortalAdapter internal portalAdapter;

    address internal owner;
    address internal agentController;
    address internal player;
    address internal gasPayer;
    address internal portal;

    uint64 internal constant SEPOLIA = 1;
    uint64 internal constant OTHER_CHAIN = 3;
    uint64 internal constant ATTESTED_HEIGHT = 5_000_000;
    uint64 internal constant ACTION_HEIGHT = 5_000_100;
    uint256 internal constant REWARD = 100 ether;
    uint256 internal constant MIN_AMOUNT = 0.001 ether;

    bytes32 internal constant ROOT = keccak256("vael-test-merkle-root");

    function setUp() public {
        owner = address(this);
        agentController = address(0x1111);
        player = address(0x2222);
        gasPayer = address(0x9999); // deliberately not the player
        portal = address(0xB0B0);

        MockChainInfo chainInfoImpl = new MockChainInfo();
        vm.etch(ChainInfoLib.PRECOMPILE_ADDRESS, address(chainInfoImpl).code);
        MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS).setAttestedHeight(SEPOLIA, ATTESTED_HEIGHT);
        MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS).setAttestedHeight(OTHER_CHAIN, ATTESTED_HEIGHT);

        MockBlockProver proverImpl = new MockBlockProver();
        vm.etch(NativeQueryVerifierLib.PRECOMPILE, address(proverImpl).code);

        identityRegistry = new IdentityRegistry(owner);
        reputationRegistry =
            new ReputationRegistry(owner, IIdentityRegistry(address(identityRegistry)));
        validationRegistry =
            new ValidationRegistry(owner, IIdentityRegistryMinimal(address(identityRegistry)));
        agentRegistryAdapter =
            new AgentRegistryAdapter(IIdentityRegistryReader(address(identityRegistry)));
        identityRegistry.registerAgent(agentController, "ipfs://agent");

        rewardVault = new RewardVault(owner);
        badgeNft = new BadgeNFT(owner);
        vaelToken = new VaelToken(owner);

        questManager = new QuestManager(
            owner, agentRegistryAdapter, rewardVault, badgeNft, reputationRegistry, validationRegistry
        );

        vaelToken.grantMinterRole(address(rewardVault));
        rewardVault.setVaelToken(address(vaelToken));
        rewardVault.setQuestManager(address(questManager));
        badgeNft.setQuestManager(address(questManager));
        badgeNft.setBadgeURI(1, "ipfs://placeholder");
        reputationRegistry.setReviewerAuthorization(address(questManager), true);

        questASC = new QuestASC(owner, IQuestManager(address(questManager)));
        portalAdapter = new PortalAdapter();
        questASC.setAdapter(SEPOLIA, portalAdapter.TOPIC(), portalAdapter);
        questASC.setQuestPortal(SEPOLIA, portal);
        questManager.setQuestASC(address(questASC));
    }

    // ---------------------------------------------------------------- helpers

    function prover() internal pure returns (MockBlockProver) {
        return MockBlockProver(NativeQueryVerifierLib.PRECOMPILE);
    }

    function _rule(bool playerMustMatch, uint256 minAmount)
        internal
        view
        returns (VaelTypes.VerificationRule memory)
    {
        return VaelTypes.VerificationRule({
            actionType: VaelTypes.ActionType.Portal,
            emitter: portal,
            token: address(0),
            minAmount: minAmount,
            minSourceBlock: 0,
            maxSourceBlock: 0,
            playerMustMatch: playerMustMatch
        });
    }

    function _createQuest(VaelTypes.VerificationRule memory rule, uint64 chainKey)
        internal
        returns (uint256 questId)
    {
        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: portal,
            parametersHash: keccak256("params"),
            metadataURI: "ipfs://placeholder",
            rewardPerParticipant: REWARD,
            expiry: 0,
            badgeLevel: 1,
            participant: player,
            sourceChainKey: chainKey,
            campaignId: 0,
            rule: rule
        });
        vm.prank(agentController);
        questId = questManager.createQuest(params);
    }

    function _acceptedQuest() internal returns (uint256 questId) {
        questId = _createQuest(_rule(true, MIN_AMOUNT), SEPOLIA);
        vm.prank(player);
        questManager.acceptQuest(questId);
    }

    function _sourceTx(bytes memory encoded, uint64 chainKey, uint64 height)
        internal
        pure
        returns (VaelAscBase.SourceTx memory)
    {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings =
            new INativeQueryVerifier.MerkleProofEntry[](1);
        siblings[0] = INativeQueryVerifier.MerkleProofEntry({hash: keccak256("sib"), isLeft: true});

        bytes32[] memory roots = new bytes32[](1);
        roots[0] = ROOT;

        return VaelAscBase.SourceTx({
            chainKey: chainKey,
            blockHeight: height,
            encodedTransaction: encoded,
            merkleProof: INativeQueryVerifier.MerkleProof({root: ROOT, siblings: siblings}),
            continuityProof: INativeQueryVerifier.ContinuityProof({
                lowerEndpointDigest: keccak256("endpoint"),
                roots: roots
            })
        });
    }

    function _portalTx(uint256 questId, address loggedPlayer, uint256 amount)
        internal
        view
        returns (bytes memory)
    {
        return SourceTxFixture.build(
            gasPayer,
            1,
            SourceTxFixture.single(
                SourceTxFixture.portalLog(portal, questId, loggedPlayer, address(0), amount)
            )
        );
    }

    /// @dev A campaign-funded quest, with the escrow deposited and wired to this QuestASC.
    function _campaignQuest(uint256 campaignId, uint256 deposit)
        internal
        returns (uint256 questId, CampaignEscrow escrow)
    {
        escrow = new CampaignEscrow(owner);
        escrow.setRewardToken(address(vaelToken));
        address[] memory releasers = new address[](1);
        releasers[0] = address(questASC);
        escrow.initialiseReleasers(releasers);
        questASC.setCampaignEscrow(address(escrow));

        vaelToken.grantMinterRole(owner);
        vaelToken.mint(owner, deposit);
        vaelToken.approve(address(escrow), deposit);
        escrow.deposit(bytes32(campaignId), deposit);

        QuestManager.CreateQuestParams memory params = QuestManager.CreateQuestParams({
            category: QuestManager.QuestCategory.Swap,
            protocol: portal,
            parametersHash: keccak256("params"),
            metadataURI: "ipfs://placeholder",
            rewardPerParticipant: REWARD,
            expiry: 0,
            badgeLevel: 1,
            participant: player,
            sourceChainKey: SEPOLIA,
            campaignId: campaignId,
            rule: _rule(true, MIN_AMOUNT)
        });
        vm.prank(agentController);
        questId = questManager.createQuest(params);
        vm.prank(player);
        questManager.acceptQuest(questId);
    }

    // ---------------------------------------------------------------- campaign payouts

    /// @notice The escrow must pay what the campaign promised, not what the player happened to move.
    /// @dev This is the test that was missing. The release used the decoded action amount, so a
    /// player moving far more than the minimum drained the partner's escrow by that instead.
    function test_CampaignEscrowReleasesTheRewardNotTheActionAmount() public {
        uint256 deposit = REWARD * 20;
        (uint256 questId, CampaignEscrow escrow) = _campaignQuest(77, deposit);

        // Deliberately far above the minimum, and nothing like the reward.
        uint256 hugeAction = MIN_AMOUNT * 500;
        uint256 poolBefore = escrow.campaignBalance(bytes32(uint256(77)));
        assertGt(poolBefore, 0, "the campaign has to be funded");

        questASC.submit(_sourceTx(_portalTx(questId, player, hugeAction), SEPOLIA, ACTION_HEIGHT), questId);

        uint256 spent = poolBefore - escrow.campaignBalance(bytes32(uint256(77)));
        assertEq(spent, REWARD, "the escrow released something other than the reward");
        assertTrue(spent != hugeAction, "the escrow released the action amount");
    }

    /// @notice A campaign quest is paid once, by the escrow, and the vault is never funded for it.
    /// @dev Before this, `createQuest` minted the reward into RewardVault and `recordCompletion`
    /// released it, on top of the escrow release: the player was paid twice and the protocol minted
    /// VAEL to cover a reward a partner had already deposited.
    function test_CampaignQuestIsPaidOnlyByTheEscrow() public {
        uint256 deposit = REWARD * 20;
        (uint256 questId, CampaignEscrow escrow) = _campaignQuest(4242, deposit);

        uint256 playerBefore = vaelToken.balanceOf(player);
        uint256 vaultBefore = vaelToken.balanceOf(address(rewardVault));
        uint256 poolBefore = escrow.campaignBalance(bytes32(uint256(4242)));

        questASC.submit(_sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT), questId);

        assertEq(vaelToken.balanceOf(player) - playerBefore, REWARD, "the player was paid twice");
        assertEq(poolBefore - escrow.campaignBalance(bytes32(uint256(4242))), REWARD, "the escrow did not pay");
        assertEq(vaelToken.balanceOf(address(rewardVault)), vaultBefore, "the vault moved for a campaign quest");
    }

    function test_CampaignEscrowIsUntouchedByAPlainQuest() public {
        CampaignEscrow escrow = new CampaignEscrow(owner);
        escrow.setRewardToken(address(vaelToken));
        address[] memory releasers = new address[](1);
        releasers[0] = address(questASC);
        escrow.initialiseReleasers(releasers);
        questASC.setCampaignEscrow(address(escrow));

        vaelToken.grantMinterRole(owner);
        vaelToken.mint(owner, REWARD * 10);
        vaelToken.approve(address(escrow), REWARD * 10);
        escrow.deposit(bytes32(uint256(88)), REWARD * 10);
        uint256 before = escrow.campaignBalance(bytes32(uint256(88)));

        uint256 questId = _acceptedQuest();
        questASC.submit(_sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT), questId);

        assertEq(escrow.campaignBalance(bytes32(uint256(88))), before, "campaignId 0 must not spend");
    }

    function test_OwnerCanRefundAnUnspentCampaign() public {
        uint256 deposit = REWARD * 4;
        (, CampaignEscrow escrow) = _campaignQuest(1234, deposit);

        uint256 pool = escrow.campaignBalance(bytes32(uint256(1234)));
        assertGt(pool, 0);
        uint256 ownerBefore = vaelToken.balanceOf(owner);

        questASC.refundCampaign(bytes32(uint256(1234)), owner, pool);

        assertEq(escrow.campaignBalance(bytes32(uint256(1234))), 0, "the pool was not emptied");
        assertEq(vaelToken.balanceOf(owner) - ownerBefore, pool, "the partner was not repaid");
    }

    function test_OnlyTheOwnerRefunds() public {
        (, CampaignEscrow escrow) = _campaignQuest(4321, REWARD * 2);
        uint256 pool = escrow.campaignBalance(bytes32(uint256(4321)));

        vm.prank(player);
        vm.expectRevert();
        questASC.refundCampaign(bytes32(uint256(4321)), player, pool);
    }

    function test_RefundRefusesWhenNoEscrowIsSet() public {
        QuestASC fresh = new QuestASC(owner, IQuestManager(address(questManager)));
        vm.expectRevert(QuestASC.CampaignEscrowNotSet.selector);
        fresh.refundCampaign(bytes32(uint256(1)), owner, 1);
    }

    // ---------------------------------------------------------------- happy path

    function test_Portal_HappyPath_ReleasesRewardAndMintsBadge() public {
        uint256 questId = _acceptedQuest();

        uint256 balanceBefore = vaelToken.balanceOf(player);
        assertEq(badgeNft.balanceOf(player), 0);

        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);

        uint256 handled = questASC.submit(sourceTx, questId);

        assertEq(handled, 1);
        assertEq(vaelToken.balanceOf(player) - balanceBefore, REWARD, "reward not released");
        assertEq(badgeNft.balanceOf(player), 1, "badge not minted");

        QuestManager.Quest memory quest = questManager.getQuest(questId);
        assertEq(uint256(quest.status), uint256(QuestManager.QuestStatus.Completed));

        bytes32 key = questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0);
        assertTrue(questASC.claimedLog(key), "replay key not claimed");
    }

    /// @dev The gas payer is not the player. Identity must come from the indexed topic.
    function test_Portal_PlayerComesFromIndexedTopicNotFrom() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        questASC.submit(sourceTx, questId);
        assertEq(vaelToken.balanceOf(player), REWARD);
        assertEq(vaelToken.balanceOf(gasPayer), 0, "gas payer must never be credited");
    }

    // ---------------------------------------------------------------- replay

    function test_Replay_SameLogRejected() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        questASC.submit(sourceTx, questId);

        bytes32 key = questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(VaelAscBase.AlreadyClaimed.selector, key));
        questASC.submit(sourceTx, questId);
    }

    /// @dev Two portal logs in one transaction are two distinct claims. A transaction-scoped key
    /// would strand the second one permanently.
    function test_SecondLogInSameTxHasItsOwnKey() public {
        uint256 questA = _acceptedQuest();
        uint256 questB = _createQuest(_rule(true, MIN_AMOUNT), SEPOLIA);
        vm.prank(player);
        questManager.acceptQuest(questB);

        bytes memory encoded = SourceTxFixture.build(
            gasPayer,
            1,
            SourceTxFixture.pair(
                SourceTxFixture.portalLog(portal, questA, player, address(0), MIN_AMOUNT),
                SourceTxFixture.portalLog(portal, questB, player, address(0), MIN_AMOUNT)
            )
        );

        // No hint, because the two logs name different quests.
        uint256 handled = questASC.submit(_sourceTx(encoded, SEPOLIA, ACTION_HEIGHT), 0);
        assertEq(handled, 2, "both logs must be handled");

        assertTrue(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0)));
        assertTrue(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 1)));
        assertEq(vaelToken.balanceOf(player), REWARD * 2);
    }

    /// @dev An unrecognised log between two portal logs must not shift their ordinals.
    function test_UnrecognisedLogIsSkippedButKeepsItsOrdinal() public {
        uint256 questId = _acceptedQuest();
        bytes memory encoded = SourceTxFixture.build(
            gasPayer,
            1,
            SourceTxFixture.pair(
                SourceTxFixture.noiseLog(address(0xFEED)),
                SourceTxFixture.portalLog(portal, questId, player, address(0), MIN_AMOUNT)
            )
        );
        uint256 handled = questASC.submit(_sourceTx(encoded, SEPOLIA, ACTION_HEIGHT), questId);
        assertEq(handled, 1);
        // The portal log is at ordinal 1, not 0.
        assertTrue(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 1)));
        assertFalse(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0)));
    }

    // ---------------------------------------------------------------- rejections

    function test_ReceiptStatusZeroRejected() public {
        uint256 questId = _acceptedQuest();
        bytes memory encoded = SourceTxFixture.build(
            gasPayer,
            0, // reverted source transaction
            SourceTxFixture.single(
                SourceTxFixture.portalLog(portal, questId, player, address(0), MIN_AMOUNT)
            )
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                VaelAscBase.SourceTransactionReverted.selector, SEPOLIA, ACTION_HEIGHT, uint64(0)
            )
        );
        questASC.submit(_sourceTx(encoded, SEPOLIA, ACTION_HEIGHT), questId);
    }

    /// @dev An impostor contract emitting the same event shape is decodable but not allowlisted,
    /// so it is never recognised and never claims a replay key.
    function test_UnallowlistedEmitterIsNotRecognised() public {
        uint256 questId = _acceptedQuest();
        bytes memory encoded = SourceTxFixture.build(
            gasPayer,
            1,
            SourceTxFixture.single(
                SourceTxFixture.portalLog(address(0xBAD), questId, player, address(0), MIN_AMOUNT)
            )
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                VaelAscBase.NothingRecognised.selector, SEPOLIA, ACTION_HEIGHT, uint64(0)
            )
        );
        questASC.submit(_sourceTx(encoded, SEPOLIA, ACTION_HEIGHT), questId);
        assertFalse(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0)));
    }

    /// @dev With no adapter registered for a signature, the log is not recognised at all.
    function test_NoAdapterMeansNothingRecognised() public {
        uint256 questId = _acceptedQuest();
        questASC.setAdapter(SEPOLIA, portalAdapter.TOPIC(), PortalAdapter(address(0)));
        vm.expectRevert(
            abi.encodeWithSelector(
                VaelAscBase.NothingRecognised.selector, SEPOLIA, ACTION_HEIGHT, uint64(0)
            )
        );
        questASC.submit(
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT), questId
        );
    }

    function test_WrongChainKeyRejected() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), OTHER_CHAIN, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(VaelAscBase.UnsupportedChainKey.selector, OTHER_CHAIN)
        );
        questASC.submit(sourceTx, questId);
    }

    /// @dev A portal registered on another chain must not satisfy a Sepolia quest.
    function test_SameAddressOnAnotherChainDoesNotCount() public {
        uint256 questId = _acceptedQuest();
        questASC.setAdapter(OTHER_CHAIN, portalAdapter.TOPIC(), portalAdapter);
        questASC.setQuestPortal(OTHER_CHAIN, portal);

        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), OTHER_CHAIN, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(QuestASC.WrongSourceChain.selector, questId, SEPOLIA, OTHER_CHAIN)
        );
        questASC.submit(sourceTx, questId);
    }

    function test_PlayerMismatchRejected() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, address(0xDEAD), MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(QuestASC.PlayerMismatch.selector, player, address(0xDEAD))
        );
        questASC.submit(sourceTx, questId);
    }

    function test_AmountBelowMinimumRejected() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT - 1), SEPOLIA, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(QuestASC.AmountBelowMinimum.selector, MIN_AMOUNT, MIN_AMOUNT - 1)
        );
        questASC.submit(sourceTx, questId);
    }

    function test_BlockAtAcceptedHeightRejected() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ATTESTED_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(
                QuestASC.SourceBlockTooEarly.selector, ATTESTED_HEIGHT, ATTESTED_HEIGHT
            )
        );
        questASC.submit(sourceTx, questId);
    }

    function test_BlockBeforeAcceptedHeightRejected() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ATTESTED_HEIGHT - 10);
        vm.expectRevert(
            abi.encodeWithSelector(
                QuestASC.SourceBlockTooEarly.selector, ATTESTED_HEIGHT - 10, ATTESTED_HEIGHT
            )
        );
        questASC.submit(sourceTx, questId);
    }

    /// @dev A hint naming a different quest than the event declines the log rather than
    /// redirecting it. The quest id always comes from the event, so the hint can never widen.
    function test_HintNamingAnotherQuestDeclines() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaelAscBase.NothingRecognised.selector, SEPOLIA, ACTION_HEIGHT, uint64(0)
            )
        );
        questASC.submit(sourceTx, questId + 99);
        assertFalse(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0)));
        assertEq(vaelToken.balanceOf(player), 0);
    }

    function test_ProofRejectedByPrecompile() public {
        uint256 questId = _acceptedQuest();
        prover().setRejectRoot(ROOT, true);
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(VaelAscBase.ProofRejected.selector, SEPOLIA, ACTION_HEIGHT, ROOT)
        );
        questASC.submit(sourceTx, questId);
    }

    /// @dev The live precompile reverts with Error(string) rather than returning false.
    function test_PrecompileRevertStringPropagates() public {
        uint256 questId = _acceptedQuest();
        prover().setRevertReason(ROOT, "Merkle root mismatch");
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        vm.expectRevert("Merkle root mismatch");
        questASC.submit(sourceTx, questId);
    }

    /// @dev Nothing is written before the proof gate returns.
    function test_NoStateWrittenWhenProofFails() public {
        uint256 questId = _acceptedQuest();
        prover().setRejectRoot(ROOT, true);
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        try questASC.submit(sourceTx, questId) {
            revert("should have reverted");
        } catch {}
        assertFalse(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0)));
        assertEq(vaelToken.balanceOf(player), 0);
    }

    // ---------------------------------------------------------------- batching

    function test_Batch_AllOrNothing() public {
        uint256 questA = _acceptedQuest();
        uint256 questB = _createQuest(_rule(true, MIN_AMOUNT), SEPOLIA);
        vm.prank(player);
        questManager.acceptQuest(questB);

        VaelAscBase.SourceTx[] memory txs = new VaelAscBase.SourceTx[](2);
        txs[0] = _sourceTx(_portalTx(questA, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        txs[1] = _sourceTx(_portalTx(questB, player, MIN_AMOUNT - 1), SEPOLIA, ACTION_HEIGHT + 1);

        uint256[] memory hints = new uint256[](2);
        hints[0] = questA;
        hints[1] = questB;

        // The second member breaks the amount rule, so the whole batch unwinds.
        vm.expectRevert(
            abi.encodeWithSelector(QuestASC.AmountBelowMinimum.selector, MIN_AMOUNT, MIN_AMOUNT - 1)
        );
        questASC.submitBatch(txs, hints);

        assertEq(vaelToken.balanceOf(player), 0, "no member may be credited");
        assertFalse(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0)));
    }

    function test_Batch_SucceedsWhenEveryMemberIsValid() public {
        uint256 questA = _acceptedQuest();
        uint256 questB = _createQuest(_rule(true, MIN_AMOUNT), SEPOLIA);
        vm.prank(player);
        questManager.acceptQuest(questB);

        VaelAscBase.SourceTx[] memory txs = new VaelAscBase.SourceTx[](2);
        txs[0] = _sourceTx(_portalTx(questA, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        txs[1] = _sourceTx(_portalTx(questB, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT + 1);

        uint256[] memory hints = new uint256[](2);
        hints[0] = questA;
        hints[1] = questB;

        assertEq(questASC.submitBatch(txs, hints), 2);
        assertEq(vaelToken.balanceOf(player), REWARD * 2);
    }

    function test_Batch_RejectsOversizedBatch() public {
        VaelAscBase.SourceTx[] memory txs = new VaelAscBase.SourceTx[](11);
        uint256[] memory hints = new uint256[](11);
        vm.expectRevert(abi.encodeWithSelector(VaelAscBase.BatchTooLarge.selector, 11, 10));
        questASC.submitBatch(txs, hints);
    }

    function test_Batch_RejectsSpanBeyondLimit() public {
        uint256 questId = _acceptedQuest();
        VaelAscBase.SourceTx[] memory txs = new VaelAscBase.SourceTx[](2);
        txs[0] = _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        txs[1] = _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT + 1001);
        uint256[] memory hints = new uint256[](2);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaelAscBase.BatchRangeExceeded.selector, ACTION_HEIGHT, ACTION_HEIGHT + 1001, 1000
            )
        );
        questASC.submitBatch(txs, hints);
    }

    function test_Batch_RejectsEmpty() public {
        vm.expectRevert(VaelAscBase.EmptyBatch.selector);
        questASC.submitBatch(new VaelAscBase.SourceTx[](0), new uint256[](0));
    }

    // ---------------------------------------------------------------- rules

    function test_RuleIsWriteOnce() public {
        uint256 questId = _acceptedQuest();
        vm.expectRevert(abi.encodeWithSelector(QuestASC.RuleAlreadyRegistered.selector, questId));
        vm.prank(address(questManager));
        questASC.setRule(questId, SEPOLIA, _rule(true, 0));
    }

    function test_OnlyQuestManagerMaySetRule() public {
        vm.expectRevert(abi.encodeWithSelector(QuestASC.OnlyQuestManager.selector, address(this)));
        questASC.setRule(999, SEPOLIA, _rule(true, 0));
    }

    /// @dev A portal log cannot satisfy a quest whose rule names a different action. The log is
    /// declined, not treated as an error, and crucially its replay key is left unclaimed so it can
    /// still satisfy the portal quest it belongs to.
    function test_ActionTypeMismatchDeclinesWithoutBurningTheKey() public {
        VaelTypes.VerificationRule memory rule = _rule(true, MIN_AMOUNT);
        rule.actionType = VaelTypes.ActionType.UniswapSwap;
        uint256 mismatched = _createQuest(rule, SEPOLIA);
        vm.prank(player);
        questManager.acceptQuest(mismatched);

        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(mismatched, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaelAscBase.NothingRecognised.selector, SEPOLIA, ACTION_HEIGHT, uint64(0)
            )
        );
        questASC.submit(sourceTx, mismatched);

        bytes32 key = questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0);
        assertFalse(questASC.claimedLog(key), "a declined log must not consume its replay key");
        assertEq(questASC.ingestedAt(key), 0);
    }

    /// @dev The real shape of a Uniswap swap: a Transfer beside the Swap. Claiming the transfer
    /// quest must not burn the swap log, and vice versa. This is the case that failed on the live
    /// network before handlers could decline.
    function test_MixedLogsInOneTxAreEachClaimableByTheirOwnQuest() public {
        // A portal quest and, in the same transaction, an unrelated portal log for another quest.
        uint256 questA = _acceptedQuest();
        uint256 questB = _createQuest(_rule(true, MIN_AMOUNT), SEPOLIA);
        vm.prank(player);
        questManager.acceptQuest(questB);

        bytes memory encoded = SourceTxFixture.build(
            gasPayer,
            1,
            SourceTxFixture.pair(
                SourceTxFixture.portalLog(portal, questA, player, address(0), MIN_AMOUNT),
                SourceTxFixture.portalLog(portal, questB, player, address(0), MIN_AMOUNT)
            )
        );

        // Hint quest A: only its log applies, and B's key stays free.
        assertEq(questASC.submit(_sourceTx(encoded, SEPOLIA, ACTION_HEIGHT), questA), 1);
        assertTrue(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0)));
        assertFalse(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 1)));

        // Now claim B from the very same transaction.
        assertEq(questASC.submit(_sourceTx(encoded, SEPOLIA, ACTION_HEIGHT), questB), 1);
        assertTrue(questASC.claimedLog(questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 1)));
        assertEq(vaelToken.balanceOf(player), REWARD * 2);
    }

    function test_ParticipantWhoNeverAcceptedIsRejected() public {
        uint256 questId = _createQuest(_rule(true, MIN_AMOUNT), SEPOLIA);
        VaelAscBase.SourceTx memory sourceTx =
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT);
        vm.expectRevert(
            abi.encodeWithSelector(QuestASC.ParticipantHasNotAccepted.selector, questId, player)
        );
        questASC.submit(sourceTx, questId);
    }

    // ---------------------------------------------------------------- hooks

    function test_TierFromAmountAgainstTheRuleMinimum() public view {
        assertEq(questASC.tierFor(MIN_AMOUNT, MIN_AMOUNT), 1);
        assertEq(questASC.tierFor(MIN_AMOUNT * 5 - 1, MIN_AMOUNT), 1);
        assertEq(questASC.tierFor(MIN_AMOUNT * 5, MIN_AMOUNT), 2);
        assertEq(questASC.tierFor(MIN_AMOUNT * 25 - 1, MIN_AMOUNT), 2);
        assertEq(questASC.tierFor(MIN_AMOUNT * 25, MIN_AMOUNT), 3);
        // A rule with no minimum has nothing to measure against.
        assertEq(questASC.tierFor(1 ether, 0), 1);
    }

    function test_HookReceivesTheCompletion() public {
        RecordingHook recorder = new RecordingHook();
        questASC.addHook(ICompletionHook(address(recorder)));

        uint256 questId = _acceptedQuest();
        questASC.submit(
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT * 5), SEPOLIA, ACTION_HEIGHT), questId
        );

        assertEq(recorder.calls(), 1);
        assertEq(recorder.lastPlayer(), player);
        assertEq(recorder.lastActionType(), uint8(VaelTypes.ActionType.Portal));
        assertEq(recorder.lastTier(), 2, "5x the minimum is tier 2");
        assertEq(recorder.lastSourceBlock(), ACTION_HEIGHT, "streaks need the source block");
        assertEq(recorder.lastReplayKey(), questASC.replayKey(SEPOLIA, ACTION_HEIGHT, 0, 0));
    }

    /// @dev The whole reason hooks are called inside try/catch: a broken game module must never
    /// cost a player their reward.
    function test_RevertingHookDoesNotBlockTheReward() public {
        questASC.addHook(ICompletionHook(address(new RevertingHook())));

        uint256 questId = _acceptedQuest();
        vm.recordLogs();
        questASC.submit(
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT), questId
        );

        assertEq(vaelToken.balanceOf(player), REWARD, "reward paid despite the hook reverting");
        assertEq(badgeNft.balanceOf(player), 1);
        assertTrue(_sawHookFailed(), "the failure is recorded, not swallowed");
    }

    function test_GasBurningHookIsCappedAndDoesNotBlockTheReward() public {
        questASC.addHook(ICompletionHook(address(new GasBurningHook())));

        uint256 questId = _acceptedQuest();
        vm.recordLogs();
        questASC.submit(
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT), questId
        );

        assertEq(vaelToken.balanceOf(player), REWARD);
        assertTrue(_sawHookFailed());
    }

    /// @dev One bad hook must not stop the hooks after it.
    function test_AFailingHookDoesNotStopLaterHooks() public {
        questASC.addHook(ICompletionHook(address(new RevertingHook())));
        RecordingHook recorder = new RecordingHook();
        questASC.addHook(ICompletionHook(address(recorder)));

        uint256 questId = _acceptedQuest();
        questASC.submit(
            _sourceTx(_portalTx(questId, player, MIN_AMOUNT), SEPOLIA, ACTION_HEIGHT), questId
        );

        assertEq(recorder.calls(), 1, "the second hook still ran");
        assertEq(vaelToken.balanceOf(player), REWARD);
    }

    function test_HooksRunInRegistrationOrder() public {
        RecordingHook first = new RecordingHook();
        RecordingHook second = new RecordingHook();
        questASC.addHook(ICompletionHook(address(first)));
        questASC.addHook(ICompletionHook(address(second)));

        assertEq(questASC.hookCount(), 2);
        assertEq(address(questASC.hooks(0)), address(first));
        assertEq(address(questASC.hooks(1)), address(second));
    }

    function test_RemoveHookPreservesOrder() public {
        RecordingHook a = new RecordingHook();
        RecordingHook b = new RecordingHook();
        RecordingHook c = new RecordingHook();
        questASC.addHook(ICompletionHook(address(a)));
        questASC.addHook(ICompletionHook(address(b)));
        questASC.addHook(ICompletionHook(address(c)));

        questASC.removeHook(1);
        assertEq(questASC.hookCount(), 2);
        assertEq(address(questASC.hooks(0)), address(a));
        assertEq(address(questASC.hooks(1)), address(c), "order survives a removal");
    }

    function test_DuplicateHookRejected() public {
        RecordingHook recorder = new RecordingHook();
        questASC.addHook(ICompletionHook(address(recorder)));
        vm.expectRevert(
            abi.encodeWithSelector(QuestASC.HookAlreadyRegistered.selector, address(recorder))
        );
        questASC.addHook(ICompletionHook(address(recorder)));
    }

    function test_OnlyOwnerMayManageHooks() public {
        RecordingHook recorder = new RecordingHook();
        vm.expectRevert();
        vm.prank(player);
        questASC.addHook(ICompletionHook(address(recorder)));
    }

    /// @dev Scan the recorded logs for HookFailed without depending on its argument encoding.
    function _sawHookFailed() private returns (bool) {
        bytes32 topic = keccak256("HookFailed(address,uint256,bytes)");
        Vm.Log[] memory entries = vm.getRecordedLogs();
        for (uint256 i = 0; i < entries.length; ++i) {
            if (entries[i].topics.length > 0 && entries[i].topics[0] == topic) return true;
        }
        return false;
    }
}
