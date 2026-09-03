/**
 * Complete one AI-generated quest through the ordinary proof path.
 *
 *   QUEST_ID=10 pnpm --filter @vael/api e2e:ai-quest
 *
 * It performs whichever action the rule on chain asks for, a Uniswap swap or an Aave supply. Which
 * one that is was decided by the model from the player's verified history at generation time.
 *
 * The point is that a generated quest is not special. Its rule went on chain at creation, the
 * player performs the action on Ethereum, and QuestASC verifies it exactly as it would verify a
 * quest written by hand. The generator has no privilege over completion at all: it created the
 * quest and then had nothing more to do with it.
 */
import "dotenv/config"

import { Contract, JsonRpcProvider, Wallet, formatUnits } from "ethers"

import { creditcoinProvider, sepoliaProvider } from "../src/attestcoin/config"
import { CC_EXPLORER, SEPOLIA_EXPLORER, log, runPipeline } from "./lib/pipeline"

const QUEST_MANAGER_ABI = [
  "function acceptQuest(uint256 questId)",
  "function acceptedAtSourceHeight(uint256 questId, address participant) view returns (uint64)",
  "function hasAccepted(uint256 questId, address participant) view returns (bool)",
  "function getQuest(uint256 questId) view returns ((uint256 agentId,address agentController,uint8 category,address protocol,bytes32 parametersHash,string metadataURI,address rewardToken,uint256 rewardPerParticipant,uint256 badgeLevel,address assignedParticipant,uint32 acceptedCount,uint32 completedCount,uint64 expiry,uint8 status,uint64 createdAt,uint64 sourceChainKey,uint256 campaignId))",
]

const QUEST_ASC_ABI = [
  "function rules(uint256 questId) view returns (uint8 actionType, address emitter, address token, uint256 minAmount, uint64 minSourceBlock, uint64 maxSourceBlock, bool playerMustMatch)",
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256)",
]

const AAVE_POOL_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
]

/** Mirrors VaelTypes.ActionType for the two the generator can pick that this script can perform. */
const UNISWAP_SWAP = 1
const AAVE_SUPPLY = 3

const TOKEN_ABI = ["function balanceOf(address) view returns (uint256)"]

function need(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

async function main() {
  const questId = BigInt(need("QUEST_ID"))
  const cc = creditcoinProvider()
  const sepolia = sepoliaProvider()

  const player = new Wallet(need("DEPLOYER_PRIVATE_KEY"), cc)
  const playerSepolia = new Wallet(need("DEPLOYER_PRIVATE_KEY"), sepolia)

  const managerAddress = need("QUEST_MANAGER_ADDRESS")
  const ascAddress = need("QUEST_ASC_ADDRESS")
  const manager = new Contract(managerAddress, QUEST_MANAGER_ABI, player)
  const asc = new Contract(ascAddress, QUEST_ASC_ABI, cc)

  const quest = await manager.getFunction("getQuest").staticCall(questId)
  const rule = await asc.getFunction("rules").staticCall(questId)

  log("quest            ", questId.toString())
  log("metadata         ", quest[5])
  log("assigned to      ", quest[9])
  log("reward           ", `${formatUnits(quest[7], 18)} VAEL`)
  log("rule             ", `action ${rule[0]}, emitter ${rule[1]}, token ${rule[2]}, min ${rule[3]}`)

  if (quest[9].toLowerCase() !== player.address.toLowerCase()) {
    throw new Error(`quest ${questId} is assigned to ${quest[9]}, not ${player.address}`)
  }
  const actionType = Number(rule[0])
  if (actionType !== UNISWAP_SWAP && actionType !== AAVE_SUPPLY) {
    throw new Error(
      `this script performs a Uniswap swap or an Aave supply; quest ${questId} wants action ${actionType}`
    )
  }

  const already: boolean = await manager.getFunction("hasAccepted").staticCall(questId, player.address)
  if (!already) {
    log("1. accepting")
    const acceptTx = await manager.getFunction("acceptQuest")(questId)
    const acceptReceipt = await acceptTx.wait(1)
    log("   accept tx     ", `${CC_EXPLORER}/tx/${acceptReceipt.hash}`)
  } else {
    log("1. already accepted")
  }
  const anchored: bigint = await manager
    .getFunction("acceptedAtSourceHeight")
    .staticCall(questId, player.address)
  log("   anchored at   ", `Sepolia height ${anchored}`)

  // ------------------------------------------------------------ the action
  //
  // Which action this is was decided by the model at generation time and written into the rule on
  // chain. The script reads the rule and does what it says; it has no say in it.

  const tokenIn = rule[2] as string
  const token = new Contract(tokenIn, ERC20_ABI, playerSepolia)
  const decimals = Number(await token.getFunction("decimals").staticCall())
  // Comfortably above the rule's minimum, so a rounding difference cannot fail it.
  const amountIn = (BigInt(rule[3]) * 3n) / 2n + 10n ** BigInt(decimals) / 10n

  const held: bigint = await token.getFunction("balanceOf").staticCall(player.address)
  log("2. performing the action the rule asks for")
  log("   action        ", actionType === UNISWAP_SWAP ? "Uniswap v3 swap" : "Aave v3 supply")
  log("   holding       ", `${formatUnits(held, decimals)} of the input token`)
  if (held < amountIn) throw new Error("not enough of the input token to clear the minimum")

  let actionReceipt
  if (actionType === UNISWAP_SWAP) {
    const routerAddress = need("SEPOLIA_UNISWAP_ROUTER")
    const wethAddress = need("SEPOLIA_WETH9")
    await (await token.getFunction("approve")(routerAddress, amountIn)).wait(1)

    const router = new Contract(routerAddress, SWAP_ROUTER_ABI, playerSepolia)
    const swapTx = await router.getFunction("exactInputSingle")({
      tokenIn,
      tokenOut: wethAddress,
      fee: 500,
      recipient: player.address,
      amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    })
    actionReceipt = await swapTx.wait(1)
  } else {
    const poolAddress = need("SEPOLIA_AAVE_POOL")
    await (await token.getFunction("approve")(poolAddress, amountIn)).wait(1)

    const pool = new Contract(poolAddress, AAVE_POOL_ABI, playerSepolia)
    const supplyTx = await pool.getFunction("supply")(tokenIn, amountIn, player.address, 0)
    actionReceipt = await supplyTx.wait(1)
  }

  const sourceBlock = BigInt(actionReceipt.blockNumber)
  log("   sepolia tx    ", `${SEPOLIA_EXPLORER}/tx/${actionReceipt.hash}`)
  log("   amount        ", `${formatUnits(amountIn, decimals)} against a minimum of ${formatUnits(rule[3], decimals)}`)
  log("   sepolia block ", sourceBlock.toString())

  // ------------------------------------------------------------ the proof

  log("3. proving it")
  const vael = new Contract(need("VAEL_TOKEN_ADDRESS"), TOKEN_ABI, cc)
  const before: bigint = await vael.getFunction("balanceOf").staticCall(player.address)

  const result = await runPipeline(cc, sepolia, player, ascAddress, actionReceipt.hash, sourceBlock, questId)

  const after: bigint = await vael.getFunction("balanceOf").staticCall(player.address)
  const questAfter = await manager.getFunction("getQuest").staticCall(questId)

  console.log("")
  console.log("=== an AI-generated quest, completed through the ordinary proof path ===")
  console.log(`  quest              ${questId}`)
  console.log(`  metadata           ${quest[5]}`)
  console.log(`  sepolia action     ${actionReceipt.hash}`)
  console.log(`  proof tx           ${CC_EXPLORER}/tx/${result.txHash}`)
  console.log(`  proof gas          ${result.gasUsed} / ${result.gasLimit}`)
  console.log(`  attestation wait   ${Math.round(result.attestationWaitMs / 1000)}s over ${result.attestationPolls} polls`)
  console.log(`  reward paid        ${formatUnits(after - before, 18)} VAEL`)
  console.log(`  quest status       ${Number(questAfter[13]) === 2 ? "Completed" : questAfter[13]}`)

  if (after <= before) throw new Error("no reward was paid")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
