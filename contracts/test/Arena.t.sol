// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {Arena} from "../src/game/Arena.sol";
import {VaelHero} from "../src/game/VaelHero.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";
import {IEquipment} from "../src/interfaces/IEquipment.sol";

/// @dev Fixed bonuses for every hero, enough to prove Arena reads equipment at all.
contract StubEquipment is IEquipment {
    uint16 public s;
    uint16 public a;
    uint16 public i;

    function set(uint16 s_, uint16 a_, uint16 i_) external {
        s = s_;
        a = a_;
        i = i_;
    }

    function bonusesOf(uint256) external view returns (uint16, uint16, uint16) {
        return (s, a, i);
    }
}

/// @dev A loot contract that always reverts, to prove a broken one cannot trap the pot.
contract HostileRewards {
    function mintArenaReward(address, uint256) external pure returns (uint256) {
        revert("no");
    }
}

/// @notice Determinism, crits, draws, expiry, and every VAEL that moves.
contract ArenaTest is Test {
    Arena internal arena;
    VaelHero internal hero;
    VaelToken internal token;

    address internal owner = address(this);
    address internal questASC = address(0xA5C);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    uint8 internal constant PORTAL = uint8(VaelTypes.ActionType.Portal);
    uint8 internal constant SWAP = uint8(VaelTypes.ActionType.UniswapSwap);
    uint8 internal constant BORROW = uint8(VaelTypes.ActionType.AaveBorrow);

    uint256 internal constant STAKE = 100 ether;

    function setUp() public {
        token = new VaelToken(owner);
        hero = new VaelHero(owner);
        hero.setQuestASC(questASC);
        arena = new Arena(owner, address(token), address(hero));

        token.mint(alice, 10_000 ether);
        token.mint(bob, 10_000 ether);
        token.mint(carol, 10_000 ether);

        vm.prank(alice);
        token.approve(address(arena), type(uint256).max);
        vm.prank(bob);
        token.approve(address(arena), type(uint256).max);
        vm.prank(carol);
        token.approve(address(arena), type(uint256).max);

        // Give the arena a block history so blockhash(block.number - 1) is meaningful.
        vm.roll(1000);
    }

    // ------------------------------------------------------------- fixtures

    function _mint(address who) internal {
        vm.prank(who);
        hero.mintHero();
    }

    /// @dev The only way a hero gains a stat is a verified proof, so tests grant XP as QuestASC.
    function _train(address who, uint8 action, uint8 tier, uint256 times) internal {
        for (uint256 n = 0; n < times; n++) {
            vm.prank(questASC);
            hero.onQuestCompleted(
                1, n + 1, who, action, address(0), 0, tier, uint64(n + 1), keccak256(abi.encode(who, action, n))
            );
        }
    }

    function _fighters() internal {
        _mint(alice);
        _mint(bob);
        _train(alice, PORTAL, 1, 6); // strength
        _train(bob, SWAP, 1, 6); // agility
    }

    /// @dev Rolls past the committed seed block, which is `SEED_DELAY_BLOCKS` after acceptance,
    /// so the duel is resolvable. Reading the constant off the contract rather than hard-coding it
    /// keeps the tests honest if the delay ever changes.
    function _duel() internal returns (uint256 id) {
        _fighters();
        vm.prank(alice);
        id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);
        vm.roll(block.number + arena.SEED_DELAY_BLOCKS() + 1);
    }

    // ------------------------------------------------------------- lifecycle

    function test_ChallengeEscrowsTheChallengersStake() public {
        _fighters();
        uint256 before = token.balanceOf(alice);

        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);

        assertEq(token.balanceOf(alice), before - STAKE, "stake left the challenger");
        assertEq(token.balanceOf(address(arena)), STAKE);
        assertEq(arena.escrowed(), STAKE);
        (,, uint256 stake,,,, Arena.Status status,) = arena.challenges(id);
        assertEq(stake, STAKE);
        assertEq(uint256(status), uint256(Arena.Status.Open));
    }

    function test_AcceptEscrowsAnEqualStake() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);

        uint256 before = token.balanceOf(bob);
        vm.prank(bob);
        arena.accept(id);

        assertEq(token.balanceOf(bob), before - STAKE);
        assertEq(arena.escrowed(), STAKE * 2);
    }

    function test_OnlyTheNamedOpponentCanAccept() public {
        _fighters();
        _mint(carol);
        _train(carol, PORTAL, 1, 1);

        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Arena.Arena__NotOpponent.selector, carol));
        arena.accept(id);
    }

    function test_BothPlayersNeedAHero() public {
        _mint(alice);
        _train(alice, PORTAL, 1, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Arena.Arena__NoHero.selector, bob));
        arena.challenge(bob, STAKE);
    }

    function test_CannotChallengeYourself() public {
        _fighters();
        vm.prank(alice);
        vm.expectRevert(Arena.Arena__SelfChallenge.selector);
        arena.challenge(alice, STAKE);
    }

    function test_CannotResolveBeforeTheSeedBlockIsProduced() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);

        vm.expectRevert(abi.encodeWithSelector(Arena.Arena__TooSoon.selector, id));
        arena.resolve(id);
    }

    function test_ChallengerCanCancelBeforeAcceptance() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        arena.cancel(id);

        assertEq(token.balanceOf(alice), before + STAKE, "stake came back");
        assertEq(arena.escrowed(), 0);
    }

    // ------------------------------------------------------------- expiry

    function test_ExpiryRefundsTheChallengerAfter7200Blocks() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);

        // Read the open block back off the contract rather than caching block.number in a local.
        // Under via_ir the optimiser folds repeated NUMBER reads together and cannot see vm.roll,
        // so a cached local silently becomes the post-roll value.
        (,,, uint64 opened,,,,) = arena.challenges(id);
        uint64 expiresAt = opened + arena.EXPIRY_BLOCKS();

        vm.roll(expiresAt);
        vm.expectRevert(
            abi.encodeWithSelector(Arena.Arena__NotExpiredYet.selector, id, expiresAt)
        );
        arena.expire(id);

        vm.roll(uint256(expiresAt) + 1);
        uint256 before = token.balanceOf(alice);
        // Anyone may call it, so an inattentive challenger is not what strands the money.
        vm.prank(carol);
        arena.expire(id);

        assertEq(token.balanceOf(alice), before + STAKE);
        assertEq(arena.escrowed(), 0);
    }

    function test_CannotAcceptAnExpiredChallenge() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);

        vm.roll(block.number + arena.EXPIRY_BLOCKS() + 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Arena.Arena__Expired.selector, id));
        arena.accept(id);
    }

    function test_AnExpiredChallengeCannotBeExpiredTwice() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.roll(block.number + arena.EXPIRY_BLOCKS() + 1);
        arena.expire(id);

        vm.expectRevert(
            abi.encodeWithSelector(
                Arena.Arena__WrongStatus.selector, id, Arena.Status.Open, Arena.Status.Expired
            )
        );
        arena.expire(id);
    }

    // ------------------------------------------------------------- simulation

    function test_StatFormulasMatchTheSpec() public view {
        // hp = 100 + 10*level + 3*intellect
        assertEq(arena.hitPoints(1, 0), 110);
        assertEq(arena.hitPoints(3, 10), 160);
        // damage = 2*strength + agility
        assertEq(arena.baseDamage(0, 0), 0);
        assertEq(arena.baseDamage(5, 3), 13);
    }

    function test_ResolutionIsDeterministic() public {
        _fighters();
        bytes32 seed = keccak256("a fixed seed");

        (address winnerA, bytes memory logA) = arena.preview(alice, bob, seed);
        (address winnerB, bytes memory logB) = arena.preview(alice, bob, seed);

        assertEq(winnerA, winnerB);
        assertEq(logA, logB, "same inputs, same fight, byte for byte");
    }

    function test_TheSameFightFromADifferentSeedCanDiffer() public {
        _fighters();
        (, bytes memory one) = arena.preview(alice, bob, keccak256("seed one"));
        (, bytes memory two) = arena.preview(alice, bob, keccak256("seed two"));
        assertTrue(keccak256(one) != keccak256(two), "the seed has to matter");
    }

    function test_ResolveMatchesPreviewForTheSameSeed() public {
        uint256 id = _duel();
        bytes32 seed = keccak256(abi.encodePacked(blockhash(block.number - 1), id));
        (address expected,) = arena.preview(alice, bob, seed);

        arena.resolve(id);

        (,,,,,,, address winner) = arena.challenges(id);
        assertEq(winner, expected, "resolve fought the same fight preview did");
    }

    function test_ARoundLogDecodesToThreeBytesPerSwing() public {
        _fighters();
        (address winner, bytes memory log) = arena.preview(alice, bob, keccak256("log"));

        assertEq(log.length % 3, 0, "three bytes per swing");
        assertTrue(log.length > 0, "somebody swung");
        assertTrue(log.length <= 20 * 2 * 3, "twenty rounds at most");

        uint256 hits;
        for (uint256 i = 0; i < log.length; i += 3) {
            uint8 header = uint8(log[i]);
            assertTrue(header & 1 <= 1, "slot is 0 or 1");
            uint256 damage = (uint256(uint8(log[i + 1])) << 8) | uint256(uint8(log[i + 2]));
            if (damage > 0) hits++;
        }
        assertTrue(hits > 0, "a decisive fight lands damage");
        assertTrue(winner != address(0));
    }

    function test_CritsDoubleDamageAndAreFlagged() public {
        _mint(alice);
        _mint(bob);
        _train(alice, SWAP, 1, 6); // agility 6
        _train(bob, PORTAL, 1, 1); // strength 1, agility 0

        // The crit roll is taken modulo 100, so agility of 100 or more crits on every swing. That
        // is far more agility than a hero earns in a test, so it comes from equipment.
        StubEquipment stub = new StubEquipment();
        stub.set(0, 100, 0);
        arena.setEquipment(address(stub));

        (, uint16 aliceStrength, uint16 aliceAgility,) = arena.statsOf(alice);
        assertGe(aliceAgility, 100, "alice is fast enough to always crit");
        uint256 expected = arena.baseDamage(aliceStrength, aliceAgility) * 2;

        (, bytes memory log) = arena.preview(alice, bob, keccak256("crit"));
        uint8 header = uint8(log[0]);
        uint256 damage = (uint256(uint8(log[1])) << 8) | uint256(uint8(log[2]));

        assertEq(header & 1, 0, "alice swings first, she is faster");
        assertEq(header & 2, 2, "the crit flag is set");
        assertEq(damage, expected > type(uint16).max ? type(uint16).max : expected);
    }

    function test_ZeroDamageHeroesDrawAndBothAreRefunded() public {
        // Two freshly minted heroes have no stats at all, so neither can hurt the other. Twenty
        // rounds of nothing is a draw, and a draw returns both stakes untouched.
        _mint(alice);
        _mint(bob);

        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);
        vm.roll(block.number + arena.SEED_DELAY_BLOCKS() + 1);

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);
        uint256 supplyBefore = token.totalSupply();

        arena.resolve(id);

        assertEq(token.balanceOf(alice), aliceBefore + STAKE, "refunded in full");
        assertEq(token.balanceOf(bob), bobBefore + STAKE, "refunded in full");
        assertEq(token.totalSupply(), supplyBefore, "a draw burns nothing");
        assertEq(arena.escrowed(), 0);

        (,,,,,,, address winner) = arena.challenges(id);
        assertEq(winner, address(0));
    }

    // ------------------------------------------------------------- accounting

    function test_WinnerTakesBothStakesLessATwoPercentBurn() public {
        uint256 id = _duel();
        uint256 pot = STAKE * 2;
        uint256 burn = (pot * 200) / 10_000;

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);
        uint256 supplyBefore = token.totalSupply();

        arena.resolve(id);

        (,,,,,,, address winner) = arena.challenges(id);
        uint256 gained = winner == alice
            ? token.balanceOf(alice) - aliceBefore
            : token.balanceOf(bob) - bobBefore;

        assertEq(gained, pot - burn, "winner takes the pot less the burn");
        assertEq(token.totalSupply(), supplyBefore - burn, "the burn actually leaves supply");
        assertEq(token.balanceOf(address(arena)), 0, "nothing is left behind");
        assertEq(arena.escrowed(), 0);
    }

    function test_ADuelCannotBeResolvedTwice() public {
        uint256 id = _duel();
        arena.resolve(id);

        vm.expectRevert(
            abi.encodeWithSelector(
                Arena.Arena__WrongStatus.selector, id, Arena.Status.Accepted, Arena.Status.Resolved
            )
        );
        arena.resolve(id);
    }

    function test_AnyoneCanResolve() public {
        uint256 id = _duel();
        vm.prank(carol);
        arena.resolve(id);
        (,,,,,, Arena.Status status,) = arena.challenges(id);
        assertEq(uint256(status), uint256(Arena.Status.Resolved));
    }

    // ------------------------------------------------------------- the committed seed

    /// @notice The whole point of committing the seed: when you resolve cannot change the outcome.
    /// @dev Against the old contract this fails. It seeded from `blockhash(block.number - 1)`, so
    /// resolving in a different block gave a different fight, and a resolver could shop for one.
    function test_TheOutcomeIsTheSameWhicheverBlockYouResolveIn() public {
        // Two identical duels, accepted in the same block, resolved many blocks apart.
        _fighters();
        vm.prank(alice);
        uint256 first = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(first);

        uint64 seedBlock = _seedBlockOf(first);

        // Resolve one block after the seed block.
        vm.roll(seedBlock + 1);
        bytes32 early = arena.seedOf(first);
        (address earlyWinner,) = arena.preview(alice, bob, early);

        // And read the same duel's seed a hundred blocks later.
        vm.roll(seedBlock + 100);
        bytes32 late = arena.seedOf(first);
        (address lateWinner,) = arena.preview(alice, bob, late);

        assertEq(early, late, "the seed moved with the resolution block");
        assertEq(earlyWinner, lateWinner, "the winner moved with the resolution block");

        arena.resolve(first);
        (,,,,,,, address winner) = arena.challenges(first);
        assertEq(winner, lateWinner, "resolve disagreed with the committed seed");
    }

    function test_SeedIsUnknowableUntilItsBlockIsProduced() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);

        assertEq(arena.seedOf(id), bytes32(0), "a seed existed in the acceptance block");
        vm.roll(_seedBlockOf(id));
        assertEq(arena.seedOf(id), bytes32(0), "a seed existed in the seed block itself");
        vm.roll(_seedBlockOf(id) + 1);
        assertTrue(arena.seedOf(id) != bytes32(0), "no seed once the block was produced");
    }

    function test_ResolveIsRefusedOnceTheWindowCloses() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);

        uint64 seedBlock = _seedBlockOf(id);
        uint64 closesAt = seedBlock + arena.RESOLVE_WINDOW_BLOCKS();

        // The last block inside the window still resolves.
        vm.roll(closesAt);
        assertTrue(arena.seedOf(id) != bytes32(0), "the seed aged out inside the window");

        vm.roll(closesAt + 1);
        assertEq(arena.seedOf(id), bytes32(0), "a seed survived the window");
        vm.expectRevert(
            abi.encodeWithSelector(Arena.Arena__SeedWindowClosed.selector, id, seedBlock, closesAt)
        );
        arena.resolve(id);
    }

    function test_AStaleDuelIsVoidedAndBothStakesComeBack() public {
        _fighters();
        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);

        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);

        uint64 closesAt = _seedBlockOf(id) + arena.RESOLVE_WINDOW_BLOCKS();

        // Not while it can still be fought.
        vm.roll(closesAt);
        vm.expectRevert(abi.encodeWithSelector(Arena.Arena__StillResolvable.selector, id, closesAt));
        vm.prank(alice);
        arena.voidDuel(id);

        vm.roll(closesAt + 1);
        uint256 supplyBefore = token.totalSupply();
        vm.prank(bob);
        arena.voidDuel(id);

        assertEq(token.balanceOf(alice), aliceBefore, "the challenger did not get their stake back");
        assertEq(token.balanceOf(bob), bobBefore, "the opponent did not get their stake back");
        assertEq(token.totalSupply(), supplyBefore, "a void burned something");
        assertEq(token.balanceOf(address(arena)), 0, "the arena kept escrow");
        assertEq(arena.escrowed(), 0);

        (,,,,,, Arena.Status status,) = arena.challenges(id);
        assertEq(uint256(status), uint256(Arena.Status.Voided));
    }

    function test_OnlyAParticipantCanVoid() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);
        vm.roll(_seedBlockOf(id) + arena.RESOLVE_WINDOW_BLOCKS() + 1);

        vm.expectRevert(abi.encodeWithSelector(Arena.Arena__NotAParticipant.selector, carol));
        vm.prank(carol);
        arena.voidDuel(id);
    }

    function test_AVoidedDuelCannotBeVoidedOrResolvedAgain() public {
        _fighters();
        vm.prank(alice);
        uint256 id = arena.challenge(bob, STAKE);
        vm.prank(bob);
        arena.accept(id);
        vm.roll(_seedBlockOf(id) + arena.RESOLVE_WINDOW_BLOCKS() + 1);

        vm.prank(alice);
        arena.voidDuel(id);

        vm.expectRevert(
            abi.encodeWithSelector(
                Arena.Arena__WrongStatus.selector, id, Arena.Status.Accepted, Arena.Status.Voided
            )
        );
        vm.prank(bob);
        arena.voidDuel(id);

        vm.expectRevert(
            abi.encodeWithSelector(
                Arena.Arena__WrongStatus.selector, id, Arena.Status.Accepted, Arena.Status.Voided
            )
        );
        arena.resolve(id);
    }

    /// @dev The seed block is read off the contract rather than computed here, so a change to
    /// SEED_DELAY_BLOCKS cannot leave these tests quietly asserting the wrong block.
    function _seedBlockOf(uint256 id) internal view returns (uint64 seedBlock) {
        (,,,,, seedBlock,,) = arena.challenges(id);
    }

    // ------------------------------------------------------------- integrations

    function test_EquipmentBonusesRaiseTheStatsUsedInAFight() public {
        _fighters();
        (, uint16 strengthBefore,,) = arena.statsOf(alice);

        StubEquipment stub = new StubEquipment();
        stub.set(7, 0, 0);
        arena.setEquipment(address(stub));

        (, uint16 strengthAfter,,) = arena.statsOf(alice);
        assertEq(strengthAfter, strengthBefore + 7, "bonuses are additive");
    }

    function test_ABrokenLootContractCannotTrapThePot() public {
        uint256 id = _duel();
        arena.setRewards(address(new HostileRewards()));

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);

        arena.resolve(id);

        uint256 paid = (token.balanceOf(alice) - aliceBefore) + (token.balanceOf(bob) - bobBefore);
        assertEq(paid, STAKE * 2 - (STAKE * 2 * 200) / 10_000, "the winner was still paid");
        assertEq(token.balanceOf(address(arena)), 0);
    }
}
