/**
 * Complete one AI-generated quest through the ordinary proof path.
 *
 *   QUEST_ID=10 pnpm --filter @vael/api e2e:ai-quest
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
  if (Number(rule[0]) !== 1) {
    throw new Error(`this script performs a Uniswap swap; quest ${questId} wants action ${rule[0]}`)
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

  const tokenIn = rule[2] as string
  const usdc = new Contract(tokenIn, ERC20_ABI, playerSepolia)
  const decimals = Number(await usdc.getFunction("decimals").staticCall())
  // Comfortably above the rule's minimum, so a rounding difference in the pool cannot fail it.
  const amountIn = (BigInt(rule[3]) * 3n) / 2n + 10n ** BigInt(decimals) / 10n

  const held: bigint = await usdc.getFunction("balanceOf").staticCall(player.address)
  log("2. swapping on Uniswap v3")
  log("   holding       ", `${formatUnits(held, decimals)} of the input token`)
  if (held < amountIn) throw new Error("not enough of the input token to clear the minimum")

  const routerAddress = need("SEPOLIA_UNISWAP_ROUTER")
  const wethAddress = need("SEPOLIA_WETH9")
  await (await usdc.getFunction("approve")(routerAddress, amountIn)).wait(1)

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
  const swapReceipt = await swapTx.wait(1)
  const sourceBlock = BigInt(swapReceipt.blockNumber)
  log("   swap tx       ", `${SEPOLIA_EXPLORER}/tx/${swapReceipt.hash}`)
  log("   amount in     ", `${formatUnits(amountIn, decimals)} against a minimum of ${formatUnits(rule[3], decimals)}`)
  log("   sepolia block ", sourceBlock.toString())

  // ------------------------------------------------------------ the proof

  log("3. proving it")
  const vael = new Contract(need("VAEL_TOKEN_ADDRESS"), TOKEN_ABI, cc)
  const before: bigint = await vael.getFunction("balanceOf").staticCall(player.address)

  const result = await runPipeline(cc, sepolia, player, ascAddress, swapReceipt.hash, sourceBlock, questId)

  const after: bigint = await vael.getFunction("balanceOf").staticCall(player.address)
  const questAfter = await manager.getFunction("getQuest").staticCall(questId)

  console.log("")
  console.log("=== an AI-generated quest, completed through the ordinary proof path ===")
  console.log(`  quest              ${questId}`)
  console.log(`  metadata           ${quest[5]}`)
  console.log(`  sepolia swap       ${swapReceipt.hash}`)
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
