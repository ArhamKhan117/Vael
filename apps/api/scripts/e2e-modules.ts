/**
 * Live end-to-end run of the milestone 6 modules on Creditcoin testnet.
 *
 *   pnpm --filter @vael/api exec tsx scripts/e2e-modules.ts
 *
 * Two wallets, one script, every transaction confirmed and every slot read back:
 * fund a second wallet, mint it a hero, fight one arena duel started from each side, claim the
 * raid drop season 1 owes the deployer, equip it, list an item, and buy it from the second wallet.
 *
 * Nothing here is a simulation. Each step asserts against contract state afterwards, so a step
 * that "succeeded" without changing anything fails the run rather than passing quietly.
 *
 * PLAYER2_PRIVATE_KEY is read from the environment and never printed.
 */
import "dotenv/config"

import { Contract, JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers"

const RPC_URL = process.env.CREDITCOIN_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network"
const CHAIN_ID = 102031

const ARENA_ABI = [
  "function challenge(address opponent, uint256 stake) returns (uint256)",
  "function accept(uint256 challengeId)",
  "function resolve(uint256 challengeId)",
  "function challenges(uint256) view returns (address challenger, address opponent, uint256 stake, uint64 openedAtBlock, uint64 acceptedAtBlock, uint8 status, address winner)",
  "function nextChallengeId() view returns (uint256)",
  "function statsOf(address player) view returns (uint32 level, uint16 strength, uint16 agility, uint16 intellect)",
  "event ArenaResolved(uint256 indexed challengeId, address indexed winner, address indexed loser, uint256 payout, uint256 burned, bytes32 seed, bytes rounds)",
]

const LOOT_ABI = [
  "function claimRaidLoot(uint64 seasonId) returns (uint256)",
  "function pendingRaidLoot(uint64 seasonId, address player) view returns (bool claimable, uint256 shareBps, uint8 rarity)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function itemOf(uint256 itemId) view returns (tuple(string name, uint8 slot, uint8 rarity, uint16 strength, uint16 agility, uint16 intellect, bool exists))",
  "function nextItemId() view returns (uint256)",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
]

const EQUIPMENT_ABI = [
  "function equip(uint256 heroTokenId, uint8 slot, uint256 itemId)",
  "function unequip(uint256 heroTokenId, uint8 slot) returns (uint256)",
  "function equipped(uint256 heroTokenId, uint8 slot) view returns (uint256)",
  "function bonusesOf(uint256 heroTokenId) view returns (uint16 strength, uint16 agility, uint16 intellect)",
]

const MARKET_ABI = [
  "function list(uint256 itemId, uint256 amount, uint256 price) returns (uint256)",
  "function buy(uint256 listingId)",
  "function listings(uint256) view returns (address seller, uint256 itemId, uint256 amount, uint256 price, bool active)",
  "function nextListingId() view returns (uint256)",
]

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]

const HERO_ABI = [
  "function mintHero() returns (uint256)",
  "function heroOf(address) view returns (uint256)",
]

const SLOTS = ["weapon", "armour", "trinket", "relic"]
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"]

interface Step {
  what: string
  hash: string
  block: number
  gasUsed: number
  gasLimit: number
  seconds: number
}

const steps: Step[] = []

function need(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** ethers types dynamic contract members as possibly undefined; getFunction does not. */
function fn(contract: Contract, name: string) {
  return contract.getFunction(name)
}

function log(message: string) {
  const stamp = new Date().toISOString().slice(11, 19)
  console.log(`[${stamp}] ${message}`)
}

/** Send, wait, assert success, and record the gas so the report does not have to guess. */
async function send(
  what: string,
  call: () => Promise<{ hash: string; wait: () => Promise<unknown> }>
): Promise<string> {
  const started = Date.now()
  const tx = (await call()) as {
    hash: string
    gasLimit: bigint
    data?: string
    wait: () => Promise<{ status: number | null; blockNumber: number; gasUsed: bigint } | null>
  }
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) throw new Error(`${what} reverted (tx ${tx.hash})`)
  const gasUsed = Number(receipt.gasUsed)
  const gasLimit = Number(tx.gasLimit)
  // On Creditcoin an exhausted gas limit looks exactly like a revert, so a contract call that
  // spends its whole limit is treated as a failure. A bare value transfer legitimately spends all
  // 21000 of its 21000, which is not the same thing.
  const isCall = Boolean(tx.data && tx.data !== "0x")
  if (isCall && gasUsed >= gasLimit) {
    throw new Error(`${what} exhausted its gas limit (${gasUsed}/${gasLimit})`)
  }
  const seconds = Math.round((Date.now() - started) / 100) / 10
  steps.push({ what, hash: tx.hash, block: receipt.blockNumber, gasUsed, gasLimit, seconds })
  log(`${what}  tx ${tx.hash}  block ${receipt.blockNumber}  gas ${gasUsed}/${gasLimit}  ${seconds}s`)
  return tx.hash
}

/** `Arena.resolve` refuses the acceptance block itself, so the seed cannot be known in advance. */
async function waitForNewBlock(provider: JsonRpcProvider, after: number) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if ((await provider.getBlockNumber()) > after) return
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`no block after ${after} within two minutes`)
}

async function main() {
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true })
  const deployer = new Wallet(need("DEPLOYER_PRIVATE_KEY"), provider)
  const player2 = new Wallet(need("PLAYER2_PRIVATE_KEY"), provider)

  const arenaAddress = need("ARENA_ADDRESS")
  const lootAddress = need("LOOT_ADDRESS")
  const equipmentAddress = need("EQUIPMENT_ADDRESS")
  const marketAddress = need("MARKETPLACE_ADDRESS")
  const tokenAddress = need("VAEL_TOKEN_ADDRESS")
  const heroAddress = need("VAEL_HERO_ADDRESS")

  log(`deployer ${deployer.address}`)
  log(`player2  ${player2.address}`)

  const token = new Contract(tokenAddress, TOKEN_ABI, deployer)
  const hero = new Contract(heroAddress, HERO_ABI, provider)
  const arena = new Contract(arenaAddress, ARENA_ABI, deployer)
  const loot = new Contract(lootAddress, LOOT_ABI, deployer)
  const equipment = new Contract(equipmentAddress, EQUIPMENT_ABI, deployer)
  const market = new Contract(marketAddress, MARKET_ABI, deployer)

  // ------------------------------------------------------------ 1. fund

  const gasBefore = await provider.getBalance(player2.address)
  if (gasBefore < parseEther("4")) {
    await send("fund player2 with 5 tCTC", () =>
      deployer.sendTransaction({ to: player2.address, value: parseEther("5") })
    )
  } else {
    log(`player2 already holds ${formatEther(gasBefore)} tCTC`)
  }

  const vaelBefore: bigint = await fn(token, "balanceOf")(player2.address)
  if (vaelBefore < parseEther("500")) {
    await send("send player2 1000 VAEL", () => fn(token, "transfer")(player2.address, parseEther("1000")))
  }
  const gasAfter = await provider.getBalance(player2.address)
  const vaelAfter: bigint = await fn(token, "balanceOf")(player2.address)
  log(`player2 holds ${formatEther(gasAfter)} tCTC and ${formatEther(vaelAfter)} VAEL`)
  if (gasAfter === 0n || vaelAfter === 0n) throw new Error("funding did not land")

  // ------------------------------------------------------------ 2. hero

  let player2Hero: bigint = await fn(hero, "heroOf")(player2.address)
  if (player2Hero === 0n) {
    await send("player2 mints a hero", () =>
      fn(new Contract(heroAddress, HERO_ABI, player2), "mintHero")()
    )
    player2Hero = await fn(hero, "heroOf")(player2.address)
  }
  if (player2Hero === 0n) throw new Error("player2 still has no hero")
  log(`player2 hero token ${player2Hero}`)

  const deployerHero: bigint = await fn(hero, "heroOf")(deployer.address)
  const d = await fn(arena, "statsOf")(deployer.address)
  const p = await fn(arena, "statsOf")(player2.address)
  log(`deployer stats L${d[0]} ${d[1]}/${d[2]}/${d[3]}, player2 stats L${p[0]} ${p[1]}/${p[2]}/${p[3]}`)

  // ------------------------------------------------------------ 3. two duels

  const STAKE = parseEther("10")
  const arenaAsPlayer2 = new Contract(arenaAddress, ARENA_ABI, player2)
  const tokenAsPlayer2 = new Contract(tokenAddress, TOKEN_ABI, player2)

  async function approveVael(who: Wallet, spender: string, amount: bigint) {
    const contract = new Contract(tokenAddress, TOKEN_ABI, who)
    const current: bigint = await fn(contract, "allowance")(who.address, spender)
    if (current >= amount) return
    await send(
      `${who.address === deployer.address ? "deployer" : "player2"} approves ${amount / 10n ** 18n} VAEL`,
      () => fn(contract, "approve")(spender, amount * 10n)
    )
  }

  async function duel(challenger: Wallet, opponent: Wallet, label: string) {
    await approveVael(challenger, arenaAddress, STAKE)
    await approveVael(opponent, arenaAddress, STAKE)

    const idBefore: bigint = await fn(arena, "nextChallengeId")()
    const asChallenger = new Contract(arenaAddress, ARENA_ABI, challenger)
    await send(`${label}: challenge`, () => fn(asChallenger, "challenge")(opponent.address, STAKE))
    const challengeId = idBefore

    const asOpponent = new Contract(arenaAddress, ARENA_ABI, opponent)
    await send(`${label}: accept`, () => fn(asOpponent, "accept")(challengeId))

    const accepted = await fn(arena, "challenges")(challengeId)
    await waitForNewBlock(provider, Number(accepted[4]))

    const resolver = challenger === deployer ? arena : arenaAsPlayer2
    const hash = await send(`${label}: resolve`, () => fn(resolver, "resolve")(challengeId))

    const after = await fn(arena, "challenges")(challengeId)
    if (Number(after[5]) !== 3) throw new Error(`${label} did not reach Resolved (status ${after[5]})`)

    const receipt = await provider.getTransactionReceipt(hash)
    const resolved = receipt?.logs
      .map((entry) => {
        try {
          return arena.interface.parseLog({ topics: [...entry.topics], data: entry.data })
        } catch {
          return null
        }
      })
      .find((parsed) => parsed?.name === "ArenaResolved")

    const swings = resolved ? (String(resolved.args.rounds).length - 2) / 6 : 0
    log(
      `${label}: winner ${after[6]}, payout ${resolved ? formatEther(resolved.args.payout) : "?"} VAEL, ` +
        `burned ${resolved ? formatEther(resolved.args.burned) : "?"} VAEL, ${swings} swings`
    )
    return { challengeId: Number(challengeId), winner: String(after[6]), swings }
  }

  const duelA = await duel(deployer, player2, "duel A (deployer challenges)")
  const duelB = await duel(player2, deployer, "duel B (player2 challenges)")

  // ------------------------------------------------------------ 4. raid loot

  const pending = await fn(loot, "pendingRaidLoot")(1, deployer.address)
  log(`raid season 1 for deployer: claimable ${pending[0]}, share ${Number(pending[1]) / 100}%, rarity ${RARITIES[Number(pending[2])]}`)

  let raidItem = 0
  if (pending[0]) {
    await send("deployer claims the season 1 drop", () => fn(loot, "claimRaidLoot")(1))
  }
  const itemCount = Number(await fn(loot, "nextItemId")()) - 1
  const held: { itemId: number; amount: number; name: string; slot: number; rarity: number }[] = []
  for (let itemId = 1; itemId <= itemCount; itemId++) {
    const amount = Number(await fn(loot, "balanceOf")(deployer.address, itemId))
    if (amount === 0) continue
    const item = await fn(loot, "itemOf")(itemId)
    held.push({ itemId, amount, name: item[0], slot: Number(item[1]), rarity: Number(item[2]) })
  }
  log(`deployer holds: ${held.map((h) => `${h.name} x${h.amount} (${RARITIES[h.rarity]}, ${SLOTS[h.slot]})`).join(", ") || "nothing"}`)
  if (held.length === 0) throw new Error("no items to equip or sell")
  raidItem = held[0]!.itemId

  // ------------------------------------------------------------ 5. equip

  const approvedForEquipment: boolean = await fn(loot, "isApprovedForAll")(deployer.address, equipmentAddress)
  if (!approvedForEquipment) {
    await send("deployer approves Equipment for items", () =>
      fn(loot, "setApprovalForAll")(equipmentAddress, true)
    )
  }
  const toEquip = held[0]!
  const occupied = Number(await fn(equipment, "equipped")(deployerHero, toEquip.slot))
  if (occupied !== 0) {
    await send("deployer unequips the occupied slot", () =>
      fn(equipment, "unequip")(deployerHero, toEquip.slot)
    )
  }
  await send(`deployer equips ${toEquip.name}`, () =>
    fn(equipment, "equip")(deployerHero, toEquip.slot, toEquip.itemId)
  )
  const equippedNow = Number(await fn(equipment, "equipped")(deployerHero, toEquip.slot))
  if (equippedNow !== toEquip.itemId) throw new Error("equip did not take")
  const bonuses = await fn(equipment, "bonusesOf")(deployerHero)
  log(`equipped ${toEquip.name}; bonuses now +${bonuses[0]}/${bonuses[1]}/${bonuses[2]}`)

  // ------------------------------------------------------------ 6. list and buy

  const sellable = held.find((h) => h.itemId !== toEquip.itemId || h.amount > 1)
  if (!sellable) throw new Error("nothing left to sell after equipping")
  const PRICE = parseEther("25")

  const approvedForMarket: boolean = await fn(loot, "isApprovedForAll")(deployer.address, marketAddress)
  if (!approvedForMarket) {
    await send("deployer approves Marketplace for items", () =>
      fn(loot, "setApprovalForAll")(marketAddress, true)
    )
  }
  const listingIdBefore: bigint = await fn(market, "nextListingId")()
  await send(`deployer lists ${sellable.name} for 25 VAEL`, () =>
    fn(market, "list")(sellable.itemId, 1, PRICE)
  )
  const listingId = listingIdBefore

  await approveVael(player2, marketAddress, PRICE)
  const sellerBefore: bigint = await fn(token, "balanceOf")(deployer.address)
  await send("player2 buys the listing", () =>
    fn(new Contract(marketAddress, MARKET_ABI, player2), "buy")(listingId)
  )

  const buyerBalance = Number(await fn(loot, "balanceOf")(player2.address, sellable.itemId))
  const sellerAfter: bigint = await fn(token, "balanceOf")(deployer.address)
  const listing = await fn(market, "listings")(listingId)
  if (buyerBalance === 0) throw new Error("the item did not reach the buyer")
  if (listing[4]) throw new Error("the listing is still active after a sale")
  log(
    `player2 now holds ${buyerBalance} x ${sellable.name}; seller took ` +
      `${formatEther(sellerAfter - sellerBefore)} VAEL of a 25 VAEL price`
  )

  // ------------------------------------------------------------ summary

  console.log("\n=== every transaction ===")
  for (const step of steps) {
    console.log(`${step.what}\n  ${step.hash}  block ${step.block}  gas ${step.gasUsed}/${step.gasLimit}  ${step.seconds}s`)
  }
  const resolves = steps.filter((s) => s.what.endsWith("resolve"))
  if (resolves.length > 0) {
    console.log(`\nresolve gas: ${resolves.map((r) => r.gasUsed).join(", ")}`)
  }
  console.log(`\nduel A winner ${duelA.winner} in ${duelA.swings} swings`)
  console.log(`duel B winner ${duelB.winner} in ${duelB.swings} swings`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
