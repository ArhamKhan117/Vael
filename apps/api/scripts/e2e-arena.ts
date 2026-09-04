/**
 * One live duel on Arena v3, and the claim that made it worth redeploying.
 *
 *   pnpm --filter @vael/api e2e:arena
 *
 * The seed is committed at acceptance, so the outcome cannot depend on when anyone resolves. This
 * run proves that on the live network rather than in a test: it reads the duel's seed as soon as
 * the seed block exists, reads it again several blocks later, previews the fight from it, and only
 * then resolves. If any of the three disagree the run fails.
 *
 * Both keys are read from the environment and neither is ever printed.
 */
import "dotenv/config"

import { Contract, JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers"

const RPC_URL = process.env.CREDITCOIN_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network"
const EXPLORER = "https://creditcoin-testnet.blockscout.com"
const STAKE = parseEther("5")

const ARENA_ABI = [
  "function challenge(address opponent, uint256 stake) returns (uint256)",
  "function accept(uint256 challengeId)",
  "function resolve(uint256 challengeId)",
  "function voidDuel(uint256 challengeId)",
  "function seedOf(uint256 challengeId) view returns (bytes32)",
  "function preview(address challenger, address opponent, bytes32 seed) view returns (address winner, bytes rounds)",
  "function challenges(uint256) view returns (address challenger, address opponent, uint256 stake, uint64 openedAtBlock, uint64 acceptedAtBlock, uint64 seedBlock, uint8 status, address winner)",
  "function nextChallengeId() view returns (uint256)",
  "function statsOf(address player) view returns (uint32 level, uint16 strength, uint16 agility, uint16 intellect)",
  "function SEED_DELAY_BLOCKS() view returns (uint64)",
  "function RESOLVE_WINDOW_BLOCKS() view returns (uint64)",
  "event ArenaAccepted(uint256 indexed challengeId, address indexed opponent, uint64 acceptedAtBlock, uint64 seedBlock)",
  "event ArenaResolved(uint256 indexed challengeId, address indexed winner, address indexed loser, uint256 payout, uint256 burned, bytes32 seed, bytes rounds)",
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]

function need(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function stamp() {
  return new Date().toISOString().slice(11, 19)
}

function log(message: string) {
  console.log(`[${stamp()}] ${message}`)
}

async function main() {
  const provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true })
  const deployer = new Wallet(need("DEPLOYER_PRIVATE_KEY"), provider)
  const player2 = new Wallet(need("PLAYER2_PRIVATE_KEY"), provider)

  const arenaAddress = need("ARENA_ADDRESS")
  const arena = new Contract(arenaAddress, ARENA_ABI, deployer)
  const arenaAsPlayer2 = new Contract(arenaAddress, ARENA_ABI, player2)
  const token = new Contract(need("VAEL_TOKEN_ADDRESS"), ERC20_ABI, deployer)

  const seedDelay = Number(await arena.getFunction("SEED_DELAY_BLOCKS").staticCall())
  const window = Number(await arena.getFunction("RESOLVE_WINDOW_BLOCKS").staticCall())
  log(`Arena ${arenaAddress}`)
  log(`  seed delay ${seedDelay} blocks, resolve window ${window} blocks`)

  const you = await arena.getFunction("statsOf").staticCall(deployer.address)
  const them = await arena.getFunction("statsOf").staticCall(player2.address)
  log(`  deployer L${you[0]} ${you[1]}/${you[2]}/${you[3]}, player2 L${them[0]} ${them[1]}/${them[2]}/${them[3]}`)

  // ---------------------------------------------------------------- stakes

  for (const [who, wallet] of [
    ["deployer", deployer],
    ["player2", player2],
  ] as const) {
    const erc20 = new Contract(await token.getAddress(), ERC20_ABI, wallet)
    const allowance: bigint = await erc20.getFunction("allowance").staticCall(wallet.address, arenaAddress)
    if (allowance < STAKE) {
      const tx = await erc20.getFunction("approve")(arenaAddress, STAKE * 10n)
      await tx.wait(1)
      log(`  ${who} approved the arena  ${tx.hash}`)
    }
  }

  // ---------------------------------------------------------------- the duel

  const challengeId: bigint = await arena.getFunction("nextChallengeId").staticCall()

  const challengeTx = await arena.getFunction("challenge")(player2.address, STAKE)
  const challengeReceipt = await challengeTx.wait(1)
  log(`1. challenge ${challengeId}  ${EXPLORER}/tx/${challengeTx.hash}  gas ${challengeReceipt.gasUsed}`)

  const acceptTx = await arenaAsPlayer2.getFunction("accept")(challengeId)
  const acceptReceipt = await acceptTx.wait(1)
  const duel = await arena.getFunction("challenges").staticCall(challengeId)
  const seedBlock = Number(duel[5])
  log(`2. accept  ${EXPLORER}/tx/${acceptTx.hash}  gas ${acceptReceipt.gasUsed}`)
  log(`   accepted in block ${acceptReceipt.blockNumber}, seed committed to block ${seedBlock}`)
  if (seedBlock !== acceptReceipt.blockNumber + seedDelay) {
    throw new Error(`seed block ${seedBlock} is not ${seedDelay} past acceptance`)
  }

  const beforeSeed = await arena.getFunction("seedOf").staticCall(challengeId)
  if (beforeSeed !== "0x" + "0".repeat(64)) {
    throw new Error("a seed was readable before its block was produced")
  }
  log(`3. seedOf is zero while block ${seedBlock} does not exist yet`)

  // Wait for the seed block, then read the seed and the fight it produces.
  await waitForBlock(provider, seedBlock + 1)
  const firstSeed: string = await arena.getFunction("seedOf").staticCall(challengeId)
  const firstPreview = await arena
    .getFunction("preview")
    .staticCall(deployer.address, player2.address, firstSeed)
  log(`4. seed ${firstSeed}`)
  log(`   preview says ${firstPreview[0]} wins in ${(firstPreview[1].length - 2) / 6} swings`)

  // Now wait several more blocks and read it again. This is the property: waiting changes nothing.
  const later = (await provider.getBlockNumber()) + 5
  await waitForBlock(provider, later)
  const secondSeed: string = await arena.getFunction("seedOf").staticCall(challengeId)
  const secondPreview = await arena
    .getFunction("preview")
    .staticCall(deployer.address, player2.address, secondSeed)
  log(`5. ${later - seedBlock} blocks past the seed block, seed ${secondSeed}`)

  if (firstSeed !== secondSeed) throw new Error("the seed changed with the block it was read in")
  if (firstPreview[0] !== secondPreview[0]) throw new Error("the winner changed with the block")
  log("   identical: waiting does not change the fight")

  const resolveTx = await arenaAsPlayer2.getFunction("resolve")(challengeId)
  const resolveReceipt = await resolveTx.wait(1)
  log(`6. resolve  ${EXPLORER}/tx/${resolveTx.hash}  gas ${resolveReceipt.gasUsed}`)

  const after = await arena.getFunction("challenges").staticCall(challengeId)
  if (Number(after[6]) !== 3) throw new Error(`duel did not reach Resolved (status ${after[6]})`)

  const resolved = resolveReceipt.logs
    .map((entry: { topics: string[]; data: string }) => {
      try {
        return arena.interface.parseLog({ topics: [...entry.topics], data: entry.data })
      } catch {
        return null
      }
    })
    .find((parsed: { name: string } | null) => parsed?.name === "ArenaResolved")

  const emittedSeed = resolved ? String((resolved as unknown as { args: { seed: string } }).args.seed) : ""
  if (emittedSeed !== firstSeed) {
    throw new Error(`resolve used ${emittedSeed}, not the committed ${firstSeed}`)
  }
  if (String(after[7]).toLowerCase() !== String(firstPreview[0]).toLowerCase()) {
    throw new Error(`resolve produced ${after[7]}, the preview said ${firstPreview[0]}`)
  }

  const args = resolved as unknown as { args: { payout: bigint; burned: bigint; rounds: string } }
  console.log("")
  console.log("=== one duel on Arena v3, seed committed at acceptance ===")
  console.log(`  arena              ${arenaAddress}`)
  console.log(`  challenge          ${challengeTx.hash}`)
  console.log(`  accept             ${acceptTx.hash}`)
  console.log(`  resolve            ${resolveTx.hash}`)
  console.log(`  accepted in block  ${acceptReceipt.blockNumber}`)
  console.log(`  seed block         ${seedBlock}`)
  console.log(`  resolved in block  ${resolveReceipt.blockNumber}, ${resolveReceipt.blockNumber - seedBlock} past the seed`)
  console.log(`  seed               ${firstSeed}`)
  console.log(`  read again ${later - seedBlock} blocks later: identical`)
  console.log(`  winner             ${after[7]}`)
  console.log(`  payout             ${formatEther(args.args.payout)} VAEL, burned ${formatEther(args.args.burned)} VAEL`)
  console.log(`  swings             ${(args.args.rounds.length - 2) / 6}`)
}

/** Poll until the chain reaches a height. Creditcoin blocks are about 15 seconds apart. */
async function waitForBlock(provider: JsonRpcProvider, target: number) {
  for (;;) {
    const head = await provider.getBlockNumber()
    if (head >= target) return
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
