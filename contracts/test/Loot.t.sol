// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {Loot} from "../src/game/Loot.sol";
import {LootHarness} from "./mocks/LootHarness.sol";
import {Equipment} from "../src/game/Equipment.sol";
import {Arena} from "../src/game/Arena.sol";
import {RaidBoss, IVaelHeroLevels, IBadgeMinter} from "../src/game/RaidBoss.sol";
import {VaelHero} from "../src/game/VaelHero.sol";
import {VaelToken} from "../src/tokens/VaelToken.sol";
import {BadgeNFT} from "../src/BadgeNFT.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";

/// @notice Drops, the claim ledger, equipment ownership, and the bonus arithmetic Arena depends on.
contract LootTest is Test {
    LootHarness internal loot;
    Equipment internal equipment;
    RaidBoss internal raid;
    VaelHero internal hero;
    VaelToken internal token;
    BadgeNFT internal badge;

    address internal owner = address(this);
    address internal questASC = address(0xA5C);
    address internal arena = address(0xA4E4);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);
    address internal dave = address(0xDA7E);

    uint8 internal constant PORTAL = uint8(VaelTypes.ActionType.Portal);
    uint8 internal constant BORROW = uint8(VaelTypes.ActionType.AaveBorrow);

    // Mirrored as locals, and checked against the contract in test_SlotConstantsMatch. Calling
    // WEAPON inside an argument list would consume the vm.prank or vm.expectRevert
    // meant for the call under test, which is a silent way to make a negative test pass.
    uint8 internal constant WEAPON = 0;
    uint8 internal constant ARMOUR = 1;
    uint8 internal constant TRINKET = 2;
    uint8 internal constant RELIC = 3;

    uint256 internal swordId;
    uint256 internal plateId;
    uint256 internal charmId;
    uint256 internal relicId;
    uint256 internal blessedBladeId;

    function setUp() public {
        token = new VaelToken(owner);
        hero = new VaelHero(owner);
        badge = new BadgeNFT(owner);
        badge.setBadgeURI(1, "ipfs://placeholder");

        raid = new RaidBoss(owner, token, IVaelHeroLevels(address(hero)), IBadgeMinter(address(badge)));
        raid.setQuestASC(questASC);
        hero.setQuestASC(questASC);
        badge.setMinter(address(raid), true);

        loot = new LootHarness(owner, address(raid));
        loot.setArena(arena);
        equipment = new Equipment(address(hero), address(loot));

        // One item per rarity so every band has something to award, plus a second weapon at
        // Common so a pool with more than one entry is exercised.
        swordId = loot.registerItem("Rusted Sword", WEAPON, Loot.Rarity.Common, 2, 0, 0, "ipfs://sword");
        plateId = loot.registerItem("Dented Plate", ARMOUR, Loot.Rarity.Common, 1, 0, 1, "ipfs://plate");
        charmId = loot.registerItem("Swift Charm", TRINKET, Loot.Rarity.Rare, 0, 5, 0, "ipfs://charm");
        relicId = loot.registerItem("Old Relic", RELIC, Loot.Rarity.Epic, 0, 0, 7, "ipfs://relic");
        blessedBladeId =
            loot.registerItem("Blessed Blade", WEAPON, Loot.Rarity.Legendary, 12, 4, 0, "ipfs://blade");
    }

    // ------------------------------------------------------------- fixtures

    function _mint(address who) internal {
        vm.prank(who);
        hero.mintHero();
    }

    function _hit(address who, uint8 action, uint8 tier) internal {
        vm.prank(questASC);
        raid.onQuestCompleted(
            1, 1, who, action, address(0), 0, tier, 0, keccak256(abi.encode(who, action, block.number, gasleft()))
        );
    }

    /// @dev A season alice dominates and the other two chip at, then defeated exactly.
    /// Damage is base * (10 + level) / 10 * tier, and a freshly minted hero is level 1, so an
    /// Aave borrow at tier 1 lands 330 and a portal check-in lands 110. 330 + 110 + 110 = 550.
    function _defeatedSeason() internal {
        raid.startSeason(550, 0);
        _mint(alice);
        _mint(bob);
        _mint(carol);
        _hit(alice, BORROW, 1); // 330, a 60% share
        _hit(bob, PORTAL, 1); // 110, a 20% share
        _hit(carol, PORTAL, 1); // 110, takes it to zero
        assertTrue(raid.season(1).defeated, "the season has to be over to claim");
        assertEq(raid.season(1).totalDamage, 550);
    }

    // ------------------------------------------------------------- registry

    function test_SlotConstantsMatch() public view {
        assertEq(loot.SLOT_WEAPON(), WEAPON);
        assertEq(loot.SLOT_ARMOUR(), ARMOUR);
        assertEq(loot.SLOT_TRINKET(), TRINKET);
        assertEq(loot.SLOT_RELIC(), RELIC);
        assertEq(loot.SLOT_COUNT(), 4);
    }

    function test_RegisteringAnItemRecordsItsStatsAndPool() public view {
        Loot.Item memory item = loot.itemOf(charmId);
        assertEq(item.name, "Swift Charm");
        assertEq(item.slot, TRINKET);
        assertEq(uint256(item.rarity), uint256(Loot.Rarity.Rare));
        assertEq(item.agility, 5);
        assertTrue(item.exists);

        assertEq(loot.dropPool(Loot.Rarity.Common).length, 2);
        assertEq(loot.dropPool(Loot.Rarity.Rare)[0], charmId);
        assertEq(loot.uri(charmId), "ipfs://charm");
    }

    function test_OnlyTheOwnerRegisters() public {
        vm.prank(alice);
        vm.expectRevert();
        loot.registerItem("Cheat Blade", 0, Loot.Rarity.Legendary, 99, 99, 99, "ipfs://no");
    }

    function test_RejectsAnUnknownSlot() public {
        vm.expectRevert(abi.encodeWithSelector(Loot.Loot__BadSlot.selector, uint8(4)));
        loot.registerItem("Fifth Slot", 4, Loot.Rarity.Common, 0, 0, 0, "ipfs://no");
    }

    // ------------------------------------------------------------- rarity ladders

    function test_RarityFollowsDamageShare() public view {
        assertEq(uint256(loot.rarityForShare(10_000)), uint256(Loot.Rarity.Legendary));
        assertEq(uint256(loot.rarityForShare(5_000)), uint256(Loot.Rarity.Legendary));
        assertEq(uint256(loot.rarityForShare(4_999)), uint256(Loot.Rarity.Epic));
        assertEq(uint256(loot.rarityForShare(2_500)), uint256(Loot.Rarity.Epic));
        assertEq(uint256(loot.rarityForShare(1_000)), uint256(Loot.Rarity.Rare));
        assertEq(uint256(loot.rarityForShare(250)), uint256(Loot.Rarity.Uncommon));
        assertEq(uint256(loot.rarityForShare(249)), uint256(Loot.Rarity.Common));
        assertEq(uint256(loot.rarityForShare(0)), uint256(Loot.Rarity.Common));
    }

    function test_ArenaTableMatchesWhatIsPublished() public view {
        assertEq(uint256(loot.rarityForRoll(0)), uint256(Loot.Rarity.Common));
        assertEq(uint256(loot.rarityForRoll(59)), uint256(Loot.Rarity.Common));
        assertEq(uint256(loot.rarityForRoll(60)), uint256(Loot.Rarity.Uncommon));
        assertEq(uint256(loot.rarityForRoll(84)), uint256(Loot.Rarity.Uncommon));
        assertEq(uint256(loot.rarityForRoll(85)), uint256(Loot.Rarity.Rare));
        assertEq(uint256(loot.rarityForRoll(94)), uint256(Loot.Rarity.Rare));
        assertEq(uint256(loot.rarityForRoll(95)), uint256(Loot.Rarity.Epic));
        assertEq(uint256(loot.rarityForRoll(98)), uint256(Loot.Rarity.Epic));
        assertEq(uint256(loot.rarityForRoll(99)), uint256(Loot.Rarity.Legendary));
    }

    // ------------------------------------------------------------- raid claims

    function test_ContributorClaimsOneItemWeightedByShare() public {
        _defeatedSeason();

        (bool claimable, uint256 shareBps, Loot.Rarity rarity) = loot.pendingRaidLoot(1, alice);
        assertTrue(claimable);
        assertEq(shareBps, 6000, "alice dealt 330 of 550");
        assertEq(uint256(rarity), uint256(Loot.Rarity.Legendary));

        vm.prank(alice);
        uint256 itemId = loot.claimRaidLoot(1);

        assertEq(itemId, blessedBladeId, "the only Legendary registered");
        assertEq(loot.balanceOf(alice, itemId), 1);
    }

    function test_ASmallContributorGetsASmallerRarity() public {
        _defeatedSeason();

        (, uint256 shareBps, Loot.Rarity rarity) = loot.pendingRaidLoot(1, bob);
        assertEq(shareBps, 2000, "bob dealt 110 of 550");
        assertEq(uint256(rarity), uint256(Loot.Rarity.Rare));

        vm.prank(bob);
        assertEq(loot.claimRaidLoot(1), charmId);
    }

    function test_ClaimOnlyOncePerSeason() public {
        _defeatedSeason();
        vm.prank(alice);
        loot.claimRaidLoot(1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Loot.Loot__AlreadyClaimed.selector, uint64(1), alice));
        loot.claimRaidLoot(1);
    }

    function test_ANonContributorCannotClaim() public {
        _defeatedSeason();
        vm.prank(dave);
        vm.expectRevert(abi.encodeWithSelector(Loot.Loot__NoContribution.selector, uint64(1), dave));
        loot.claimRaidLoot(1);
    }

    function test_CannotClaimALivingSeason() public {
        raid.startSeason(100_000, 0);
        _mint(alice);
        _hit(alice, PORTAL, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Loot.Loot__SeasonNotDefeated.selector, uint64(1)));
        loot.claimRaidLoot(1);
    }

    function test_LootClaimIsIndependentOfTheRaidVaelClaim() public {
        _defeatedSeason();
        vm.prank(alice);
        loot.claimRaidLoot(1);

        // RaidBoss keeps its own ledger for VAEL and is not written by Loot at all.
        assertFalse(raid.lootClaimed(1, alice), "loot must not touch the boss's ledger");
    }

    // ------------------------------------------------------------- arena drops

    function test_OnlyArenaMintsArenaRewards() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Loot.Loot__OnlyArena.selector, alice));
        loot.mintArenaReward(alice, 1);
    }

    function test_ArenaRewardMintsOneItemFromTheTable() public {
        vm.prank(arena);
        uint256 itemId = loot.mintArenaReward(alice, uint256(keccak256("a duel")));

        assertEq(loot.balanceOf(alice, itemId), 1);
        assertTrue(loot.itemOf(itemId).exists);
    }

    function test_ArenaRewardIsReplayableFromTheSameSeed() public {
        vm.prank(arena);
        uint256 first = loot.mintArenaReward(alice, 12345);
        vm.prank(arena);
        uint256 second = loot.mintArenaReward(alice, 12345);
        assertEq(first, second, "same seed, same drop");
    }

    // ------------------------------------------------------------- equipment

    function test_EquipMovesTheItemIntoTheRegistry() public {
        _mint(alice);
        loot.grant(alice, charmId, 1);

        uint256 heroId = hero.heroOf(alice);
        vm.startPrank(alice);
        loot.setApprovalForAll(address(equipment), true);
        equipment.equip(heroId, TRINKET, charmId);
        vm.stopPrank();

        assertEq(loot.balanceOf(alice, charmId), 0, "the item left the player");
        assertEq(loot.balanceOf(address(equipment), charmId), 1, "and is held while equipped");
        assertEq(equipment.equipped(heroId, TRINKET), charmId);
    }

    function test_BonusesAddUpAcrossSlots() public {
        _mint(alice);
        uint256 heroId = hero.heroOf(alice);
        loot.grant(alice, swordId, 1);
        loot.grant(alice, plateId, 1);
        loot.grant(alice, charmId, 1);
        loot.grant(alice, relicId, 1);

        vm.startPrank(alice);
        loot.setApprovalForAll(address(equipment), true);
        equipment.equip(heroId, WEAPON, swordId); // 2 str
        equipment.equip(heroId, ARMOUR, plateId); // 1 str, 1 int
        equipment.equip(heroId, TRINKET, charmId); // 5 agi
        equipment.equip(heroId, RELIC, relicId); // 7 int
        vm.stopPrank();

        (uint16 strength, uint16 agility, uint16 intellect) = equipment.bonusesOf(heroId);
        assertEq(strength, 3);
        assertEq(agility, 5);
        assertEq(intellect, 8);

        uint256[4] memory slots = equipment.loadout(heroId);
        assertEq(slots[0], swordId);
        assertEq(slots[3], relicId);
    }

    function test_OnlyTheHeroOwnerEquips() public {
        _mint(alice);
        uint256 heroId = hero.heroOf(alice);
        loot.grant(bob, charmId, 1);

        vm.startPrank(bob);
        loot.setApprovalForAll(address(equipment), true);
        vm.expectRevert(abi.encodeWithSelector(Equipment.Equipment__NotHeroOwner.selector, heroId, bob));
        equipment.equip(heroId, TRINKET, charmId);
        vm.stopPrank();
    }

    function test_CannotEquipAnItemYouDoNotHold() public {
        _mint(alice);
        uint256 heroId = hero.heroOf(alice);

        vm.startPrank(alice);
        loot.setApprovalForAll(address(equipment), true);
        vm.expectRevert(abi.encodeWithSelector(Equipment.Equipment__NotItemOwner.selector, charmId, alice));
        equipment.equip(heroId, TRINKET, charmId);
        vm.stopPrank();
    }

    function test_AnItemOnlyFitsItsOwnSlot() public {
        _mint(alice);
        uint256 heroId = hero.heroOf(alice);
        loot.grant(alice, charmId, 1);

        vm.startPrank(alice);
        loot.setApprovalForAll(address(equipment), true);
        vm.expectRevert(
            abi.encodeWithSelector(
                Equipment.Equipment__WrongSlot.selector, charmId, TRINKET, WEAPON
            )
        );
        equipment.equip(heroId, WEAPON, charmId);
        vm.stopPrank();
    }

    function test_ASlotHoldsOneItemAtATime() public {
        _mint(alice);
        uint256 heroId = hero.heroOf(alice);
        loot.grant(alice, swordId, 1);
        loot.grant(alice, blessedBladeId, 1);

        vm.startPrank(alice);
        loot.setApprovalForAll(address(equipment), true);
        equipment.equip(heroId, WEAPON, swordId);
        vm.expectRevert(
            abi.encodeWithSelector(
                Equipment.Equipment__SlotOccupied.selector, heroId, WEAPON, swordId
            )
        );
        equipment.equip(heroId, WEAPON, blessedBladeId);
        vm.stopPrank();
    }

    function test_UnequipReturnsTheItem() public {
        _mint(alice);
        uint256 heroId = hero.heroOf(alice);
        loot.grant(alice, charmId, 1);

        vm.startPrank(alice);
        loot.setApprovalForAll(address(equipment), true);
        equipment.equip(heroId, TRINKET, charmId);
        equipment.unequip(heroId, TRINKET);
        vm.stopPrank();

        assertEq(loot.balanceOf(alice, charmId), 1);
        assertEq(equipment.equipped(heroId, TRINKET), 0);
        (uint16 s, uint16 a, uint16 i) = equipment.bonusesOf(heroId);
        assertEq(s + a + i, 0, "an empty loadout is worth nothing");
    }

    function test_CannotUnequipAnEmptySlot() public {
        _mint(alice);
        uint256 heroId = hero.heroOf(alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Equipment.Equipment__SlotEmpty.selector, heroId, RELIC)
        );
        equipment.unequip(heroId, RELIC);
    }

    // ------------------------------------------------------------- arena wiring

    function test_ArenaWinnerReceivesAnItem() public {
        Arena live = new Arena(owner, address(token), address(hero));
        loot.setArena(address(live));
        live.setRewards(address(loot));
        live.setEquipment(address(equipment));

        _mint(alice);
        _mint(bob);
        // Alice has stats, bob has none, so alice wins and takes the drop.
        for (uint256 n = 0; n < 6; n++) {
            vm.prank(questASC);
            hero.onQuestCompleted(1, n + 1, alice, PORTAL, address(0), 0, 1, uint64(n + 1), keccak256(abi.encode(n)));
        }

        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);
        vm.prank(alice);
        token.approve(address(live), type(uint256).max);
        vm.prank(bob);
        token.approve(address(live), type(uint256).max);

        vm.roll(1000);
        vm.prank(alice);
        uint256 id = live.challenge(bob, 10 ether);
        vm.prank(bob);
        live.accept(id);
        // The seed block is two ahead of acceptance and resolve needs it produced.
        vm.roll(block.number + 3);
        live.resolve(id);

        (,,,,,,, address winner) = live.challenges(id);
        assertEq(winner, alice, "the hero with stats wins");
        assertEq(loot.balanceOf(alice, swordId) + loot.balanceOf(alice, plateId), 1, "a Common drop landed");
    }
}
