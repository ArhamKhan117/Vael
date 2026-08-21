/**
 * Live end-to-end runs for the four wild action types.
 *
 *   pnpm --filter @vael/api exec tsx scripts/e2e-actions.ts --action erc20
 *   pnpm --filter @vael/api exec tsx scripts/e2e-actions.ts --action swap
 *   pnpm --filter @vael/api exec tsx scripts/e2e-actions.ts --action supply
 *   pnpm --filter @vael/api exec tsx scripts/e2e-actions.ts --action borrow
 *   pnpm --filter @vael/api exec tsx scripts/e2e-actions.ts --batch erc20,swap
 *
 * Each run creates a quest with a rule the action satisfies, accepts it (which anchors the
 * attested Sepolia frontier), performs the real action on Sepolia, then proves and submits.
 * The exact proof material is written to contracts/test/fixtures/<action>.json so a forge test
 * can replay it through the real adapter offline.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { Contract, JsonRpcProvider, TransactionReceipt, Wallet, formatUnits, parseEther, parseUnits } from "ethers"

import { SEPOLIA_CHAIN_KEY, creditcoinProvider, sepoliaProvider, workerWallet } from "../src/attestcoin/config"
import { QUEST_ASC_ABI, QUEST_MANAGER_ABI } from "../src/attestcoin/questAscAbi"
import { SourceTxProof, fetchProof, verifyMerkleRootLocally } from "../src/attestcoin/prove"
import { preflight, submitProof } from "../src/attestcoin/submit"
import { waitUntilProvable } from "../src/attestcoin/attest"
import { CC_EXPLORER, SEPOLIA_EXPLORER, fixtureFor, log, runPipeline } from "./lib/pipeline"
import { AAVE_FAUCET_ABI, AAVE_POOL_ABI, ERC20_ABI, SWAP_ROUTER_02_ABI, WETH9_ABI } from "./lib/sepoliaAbi"

const FIXTURE_DIR = join(__dirname, "../../../contracts/test/fixtures")

/** ActionType as QuestASC sees it. */
const ACTION = { Portal: 0, UniswapSwap: 1, Erc20Transfer: 2, AaveSupply: 3, AaveBorrow: 4 } as const

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function required<T>(value: T | null, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} produced no receipt`)
  return value
}

interface ActionOutcome {
  receipt: TransactionReceipt
  /** The amount the rule's minAmount will be compared against. */
  amount: bigint
  token: string
  emitter: string
  actionType: number
  label: string
}

async function main() {
  const argv = process.argv
  const actionArg = argv[argv.indexOf("--action") + 1]
  const batchArg = argv.includes("--batch") ? argv[argv.indexOf("--batch") + 1] : undefined

  const cc = creditcoinProvider()
  const sepolia = sepoliaProvider()
  const wallet = workerWallet()
  const sepoliaWallet = new Wallet(wallet.privateKey, sepolia)
  const player = await wallet.getAddress()

  const questManagerAddress = env("QUEST_MANAGER_ADDRESS")
  const questAscAddress = env("QUEST_ASC_ADDRESS")
  const questManager = new Contract(questManagerAddress, QUEST_MANAGER_ABI, wallet)
  const questASC = new Contract(questAscAddress, QUEST_ASC_ABI, wallet)

  log("player      ", player)
  log("QuestManager", questManagerAddress)
  log("QuestASC    ", questAscAddress)

  if (batchArg) {
    await runBatch(batchArg.split(","), { cc, sepolia, wallet, sepoliaWallet, player, questManager, questASC, questAscAddress })
    return
  }
  if (!actionArg) throw new Error("pass --action erc20|swap|supply|borrow or --batch a,b")

  await runOne(actionArg, { cc, sepolia, wallet, sepoliaWallet, player, questManager, questASC, questAscAddress })
}

interface Ctx {
  cc: JsonRpcProvider
  sepolia: JsonRpcProvider
  wallet: Wallet
  sepoliaWallet: Wallet
  player: string
  questManager: Contract
  questASC: Contract
  questAscAddress: string
}

// ---------------------------------------------------------------- the four actions

/**
 * Wrap ETH and transfer WETH. The quest is satisfied by the Transfer log, whose `from` is the
 * player and whose emitter is the token.
 */
async function actErc20(ctx: Ctx): Promise<ActionOutcome> {
  const weth = new Contract(env("SEPOLIA_WETH9"), WETH9_ABI, ctx.sepoliaWallet)
  const amount = parseEther("0.005")

  const held: bigint = await weth.getFunction("balanceOf").staticCall(ctx.player)
  if (held < amount) {
    log("   wrapping 0.01 ETH into WETH9")
    const wrap = required(await (await weth.getFunction("deposit").send({ value: parseEther("0.01") })).wait(1), "deposit")
    log("   wrap tx", `${SEPOLIA_EXPLORER}/tx/${wrap.hash}`)
  }

  log("   transferring 0.005 WETH")
  const receipt = required(
    await (await weth.getFunction("transfer").send(env("DEPLOYER_ADDRESS"), amount)).wait(1),
    "transfer"
  )
  return {
    receipt,
    amount,
    token: env("SEPOLIA_WETH9"),
    emitter: env("SEPOLIA_WETH9"),
    actionType: ACTION.Erc20Transfer,
    label: "erc20-transfer",
  }
}

/**
 * Swap WETH for USDC through SwapRouter02. The pool emits the Swap, and the player is the
 * recipient, not the router that called the pool.
 */
async function actSwap(ctx: Ctx): Promise<ActionOutcome> {
  const wethAddress = env("SEPOLIA_WETH9")
  const usdcAddress = env("SEPOLIA_USDC")
  const routerAddress = env("SEPOLIA_UNISWAP_ROUTER")
  const weth = new Contract(wethAddress, WETH9_ABI, ctx.sepoliaWallet)
  const router = new Contract(routerAddress, SWAP_ROUTER_02_ABI, ctx.sepoliaWallet)
  const amountIn = parseEther("0.002")

  const held: bigint = await weth.getFunction("balanceOf").staticCall(ctx.player)
  if (held < amountIn) {
    log("   wrapping 0.01 ETH into WETH9")
    await (await weth.getFunction("deposit").send({ value: parseEther("0.01") })).wait(1)
  }
  log("   approving the router")
  await (await weth.getFunction("approve").send(routerAddress, amountIn)).wait(1)

  log("   swapping 0.002 WETH for USDC on the 0.05% pool")
  const receipt = required(
    await (
      await router.getFunction("exactInputSingle").send({
        tokenIn: wethAddress,
        tokenOut: usdcAddress,
        fee: 500,
        recipient: ctx.player,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      })
    ).wait(1),
    "exactInputSingle"
  )
  return {
    receipt,
    amount: amountIn,
    token: wethAddress,
    emitter: env("SEPOLIA_POOL_USDC_WETH_500"),
    actionType: ACTION.UniswapSwap,
    label: "uniswap-swap",
  }
}

/**
 * Mint an Aave test asset from the faucet and supply it to the Pool.
 *
 * LINK rather than USDC: the shared Sepolia test pool has USDC and DAI at their supply cap, so a
 * supply of either reverts with Aave error 51, SUPPLY_CAP_EXCEEDED. LINK still has room. Nothing
 * about the decoding differs; the Supply event is identical whichever reserve it names.
 */
async function actSupply(ctx: Ctx): Promise<ActionOutcome> {
  const assetAddress = env("SEPOLIA_AAVE_LINK")
  const poolAddress = env("SEPOLIA_AAVE_POOL")
  const asset = new Contract(assetAddress, ERC20_ABI, ctx.sepoliaWallet)
  const pool = new Contract(poolAddress, AAVE_POOL_ABI, ctx.sepoliaWallet)
  const faucet = new Contract(env("SEPOLIA_AAVE_FAUCET"), AAVE_FAUCET_ABI, ctx.sepoliaWallet)
  const amount = parseUnits("100", 18)

  const held: bigint = await asset.getFunction("balanceOf").staticCall(ctx.player)
  if (held < amount) {
    log("   minting 1000 test LINK from the Aave faucet")
    await (await faucet.getFunction("mint").send(assetAddress, ctx.player, parseUnits("1000", 18))).wait(1)
  }
  log("   approving the Aave Pool")
  await (await asset.getFunction("approve").send(poolAddress, amount)).wait(1)

  log("   supplying 100 LINK")
  const receipt = required(
    await (await pool.getFunction("supply").send(assetAddress, amount, ctx.player, 0)).wait(1),
    "supply"
  )
  return { receipt, amount, token: assetAddress, emitter: poolAddress, actionType: ACTION.AaveSupply, label: "aave-supply" }
}

/** Borrow a second asset against the supplied collateral. */
async function actBorrow(ctx: Ctx): Promise<ActionOutcome> {
  const assetAddress = env("SEPOLIA_AAVE_DAI")
  const poolAddress = env("SEPOLIA_AAVE_POOL")
  const pool = new Contract(poolAddress, AAVE_POOL_ABI, ctx.sepoliaWallet)
  const amount = parseUnits("10", 18)

  const account = await pool.getFunction("getUserAccountData").staticCall(ctx.player)
  log("   collateral base", formatUnits(account[0], 8))
  log("   available to borrow base", formatUnits(account[2], 8))
  if (account[2] === 0n) {
    throw new Error("no borrowing power; run --action supply first")
  }

  log("   borrowing 10 DAI at variable rate")
  const receipt = required(
    await (await pool.getFunction("borrow").send(assetAddress, amount, 2, 0, ctx.player)).wait(1),
    "borrow"
  )
  return { receipt, amount, token: assetAddress, emitter: poolAddress, actionType: ACTION.AaveBorrow, label: "aave-borrow" }
}

const ACTIONS: Record<string, (ctx: Ctx) => Promise<ActionOutcome>> = {
  erc20: actErc20,
  swap: actSwap,
  supply: actSupply,
  borrow: actBorrow,
}

// ---------------------------------------------------------------- quest plumbing

/**
 * Create a quest whose rule the given action satisfies, then accept it.
 *
 * Accepting before acting is not optional: acceptance records the attested frontier, and the
 * proved action must sit strictly above it.
 */
async function createAndAccept(
  ctx: Ctx,
  actionType: number,
  emitter: string,
  token: string,
  minAmount: bigint
): Promise<{ questId: bigint; anchored: bigint }> {
  const createTx = await ctx.questManager.getFunction("createQuest").send({
    category: 0,
    protocol: emitter,
    parametersHash: "0x" + "22".repeat(32),
    metadataURI: "ipfs://placeholder",
    rewardPerParticipant: parseEther("100"),
    expiry: 0,
    badgeLevel: 1,
    participant: ctx.player,
    sourceChainKey: SEPOLIA_CHAIN_KEY,
    campaignId: 0,
    rule: {
      actionType,
      emitter,
      token,
      minAmount,
      minSourceBlock: 0,
      maxSourceBlock: 0,
      playerMustMatch: true,
    },
  })
  const createReceipt = required(await createTx.wait(1), "createQuest")
  const questId = readQuestId(createReceipt, await ctx.questManager.getAddress())

  const acceptReceipt = required(
    await (await ctx.questManager.getFunction("acceptQuest").send(questId)).wait(1),
    "acceptQuest"
  )
  const anchored: bigint = await ctx.questManager
    .getFunction("acceptedAtSourceHeight")
    .staticCall(questId, ctx.player)

  log("   questId", questId.toString())
  log("   create tx", `${CC_EXPLORER}/tx/${createReceipt.hash}`)
  log("   accept tx", `${CC_EXPLORER}/tx/${acceptReceipt.hash}`)
  log("   anchored at Sepolia height", anchored.toString())
  return { questId, anchored }
}

function readQuestId(receipt: TransactionReceipt, questManagerAddress: string): bigint {
  const iface = new Contract(questManagerAddress, QUEST_MANAGER_ABI).interface
  for (const entry of receipt.logs) {
    if (entry.address.toLowerCase() !== questManagerAddress.toLowerCase()) continue
    try {
      const parsed = iface.parseLog({ topics: [...entry.topics], data: entry.data })
      if (parsed?.name === "QuestCreated") return parsed.args.questId as bigint
    } catch {
      /* not ours */
    }
  }
  throw new Error("QuestCreated not found")
}

function saveFixture(label: string, proof: SourceTxProof, extra: Record<string, unknown>) {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  const path = join(FIXTURE_DIR, `${label}.json`)
  writeFileSync(path, JSON.stringify(fixtureFor(label, proof, extra), null, 2) + "\n")
  log("   fixture", path)
}

// ---------------------------------------------------------------- runners

async function runOne(name: string, ctx: Ctx) {
  const act = ACTIONS[name]
  if (!act) throw new Error(`unknown action ${name}`)

  log(`=== ${name} ===`)

  // The action runs once first so we know the emitter and amount, but the quest must exist and be
  // accepted before the action that satisfies it. So: probe values, create, accept, then act.
  const probe = PROBE[name]
  if (!probe) throw new Error(`no rule template for ${name}`)
  const { questId } = await createAndAccept(ctx, probe.actionType, probe.emitter(), probe.token(), probe.minAmount)

  const outcome = await act(ctx)
  const sourceBlock = BigInt(outcome.receipt.blockNumber)
  log("   sepolia tx", `${SEPOLIA_EXPLORER}/tx/${outcome.receipt.hash}`)
  log("   sepolia block", sourceBlock.toString())

  const result = await runPipeline(
    ctx.cc, ctx.sepolia, ctx.wallet, ctx.questAscAddress,
    outcome.receipt.hash, sourceBlock, questId
  )

  await assertCompleted(ctx, questId, result.blockNumber)
  saveFixture(outcome.label, result.proof, {
    questId: questId.toString(),
    actionType: outcome.actionType,
    emitter: outcome.emitter,
    token: outcome.token,
    amount: outcome.amount.toString(),
    player: ctx.player,
    creditcoinTx: result.txHash,
    submitGasUsed: result.gasUsed.toString(),
    submitGasLimit: result.gasLimit.toString(),
    attestationWaitSeconds: Math.round(result.attestationWaitMs / 1000),
    proofSource: result.proofSource,
  })

  console.log("")
  console.log(`${name.toUpperCase()} PASSED`)
  console.log(`  questId          ${questId}`)
  console.log(`  sepolia tx       ${outcome.receipt.hash}`)
  console.log(`  sepolia block    ${sourceBlock}`)
  console.log(`  attestation wait ${Math.round(result.attestationWaitMs / 1000)}s`)
  console.log(`  creditcoin tx    ${result.txHash}`)
  console.log(`  submit gas       ${result.gasUsed} / ${result.gasLimit}`)
  console.log(`  proof source     ${result.proofSource}`)
}

/** Values needed to write the rule before the action has run. */
const PROBE: Record<string, { actionType: number; emitter: () => string; token: () => string; minAmount: bigint }> = {
  erc20: { actionType: ACTION.Erc20Transfer, emitter: () => env("SEPOLIA_WETH9"), token: () => env("SEPOLIA_WETH9"), minAmount: parseEther("0.001") },
  swap: { actionType: ACTION.UniswapSwap, emitter: () => env("SEPOLIA_POOL_USDC_WETH_500"), token: () => env("SEPOLIA_WETH9"), minAmount: parseEther("0.001") },
  supply: { actionType: ACTION.AaveSupply, emitter: () => env("SEPOLIA_AAVE_POOL"), token: () => env("SEPOLIA_AAVE_LINK"), minAmount: parseUnits("50", 18) },
  borrow: { actionType: ACTION.AaveBorrow, emitter: () => env("SEPOLIA_AAVE_POOL"), token: () => env("SEPOLIA_AAVE_DAI"), minAmount: parseUnits("5", 18) },
}

async function assertCompleted(ctx: Ctx, questId: bigint, atBlock: number) {
  const vael = new Contract(env("VAEL_TOKEN_ADDRESS"), ERC20_ABI, ctx.cc)
  const badge = new Contract(env("BADGE_NFT_ADDRESS"), ERC20_ABI, ctx.cc)
  const balance: bigint = await vael.getFunction("balanceOf").staticCall(ctx.player, { blockTag: atBlock })
  const badges: bigint = await badge.getFunction("balanceOf").staticCall(ctx.player, { blockTag: atBlock })
  log("   VAEL balance", balance.toString())
  log("   badge balance", badges.toString())
  const accepted: boolean = await ctx.questManager
    .getFunction("hasAccepted")
    .staticCall(questId, ctx.player, { blockTag: atBlock })
  if (!accepted) throw new Error("participant acceptance vanished")
}

/**
 * Two source transactions proved in one Creditcoin transaction, each with its own continuity
 * proof. All or nothing: if any member fails, none is credited.
 */
async function runBatch(names: string[], ctx: Ctx) {
  if (names.length !== 2) throw new Error("--batch takes exactly two action names")
  log(`=== batch ${names.join(" + ")} ===`)

  const prepared: { questId: bigint; hash: string; block: bigint; label: string }[] = []
  for (const name of names) {
    const probe = PROBE[name]
    if (!probe) throw new Error(`unknown action ${name}`)
    const { questId } = await createAndAccept(ctx, probe.actionType, probe.emitter(), probe.token(), probe.minAmount)
    const outcome = await ACTIONS[name]!(ctx)
    log(`   ${name} sepolia tx`, `${SEPOLIA_EXPLORER}/tx/${outcome.receipt.hash}`)
    prepared.push({ questId, hash: outcome.receipt.hash, block: BigInt(outcome.receipt.blockNumber), label: outcome.label })
  }

  const highest = prepared.reduce((max, p) => (p.block > max ? p.block : max), 0n)
  log("   waiting for attestation of the highest member", highest.toString())
  const waited = await waitUntilProvable(ctx.cc, SEPOLIA_CHAIN_KEY, highest, {
    onPoll: ({ attestedHeight, elapsedMs }) =>
      log("     frontier", `${attestedHeight}, ${Math.round(elapsedMs / 1000)}s`),
  })
  if (!waited.ok) throw new Error(waited.error)

  // Each member carries its own continuity proof. A shared proof verifies only the lowest height.
  const proofs: SourceTxProof[] = []
  for (const p of prepared) {
    const proof = await fetchProof(SEPOLIA_CHAIN_KEY, p.hash, ctx.sepolia)
    if (!proof.ok) throw new Error(proof.error)
    const local = await verifyMerkleRootLocally(proof.value)
    if (!local.ok) throw new Error(local.error)
    log(`   proof ${p.label}`, `${proof.value.source}, ${proof.value.continuityProof.roots.length} roots`)
    proofs.push(proof.value)
  }

  const span = Number(highest - prepared.reduce((min, p) => (p.block < min ? p.block : min), highest))
  log("   batch span", `${span} blocks`)

  const tuples = proofs.map((proof) => ({
    chainKey: proof.chainKey,
    blockHeight: proof.blockHeight,
    encodedTransaction: proof.encodedTransaction,
    merkleProof: proof.merkleProof,
    continuityProof: proof.continuityProof,
  }))
  const hints = prepared.map((p) => p.questId)

  const handled: bigint = await ctx.questASC.getFunction("submitBatch").staticCall(tuples, hints)
  log("   preflight", `would handle ${handled} log(s)`)

  const estimate: bigint = await ctx.questASC.getFunction("submitBatch").estimateGas(tuples, hints)
  const gasLimit = (estimate * 3n) / 2n
  const tx = await ctx.questASC.getFunction("submitBatch").send(tuples, hints, { gasLimit })
  const receipt = required(await tx.wait(1), "submitBatch")
  if (receipt.status !== 1) throw new Error("batch reverted")
  if (receipt.gasUsed >= gasLimit) throw new Error("batch exhausted its gas limit")

  console.log("")
  console.log("BATCH PASSED")
  console.log(`  members          ${names.join(", ")}`)
  console.log(`  quest ids        ${hints.join(", ")}`)
  for (const p of prepared) console.log(`  sepolia tx       ${p.hash} (block ${p.block})`)
  console.log(`  span             ${span} blocks`)
  console.log(`  creditcoin tx    ${receipt.hash}`)
  console.log(`  batch gas        ${receipt.gasUsed} / ${gasLimit}`)
  console.log(`  logs handled     ${handled}`)
}

main().catch((error) => {
  console.error("\nFAILED")
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
