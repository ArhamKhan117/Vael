/**
 * Create one quest on chain, assigned to an address, and stop.
 *
 *   PARTICIPANT=0x… pnpm --filter @vael/api make-quest
 *   PARTICIPANT=0x… ACTION=portal MIN=0.001 REWARD=75 pnpm --filter @vael/api make-quest
 *
 * The quest is created by the registered ERC-8004 agent, which is the only thing that can create
 * one. It is deliberately left unaccepted: accepting is the player's transaction, and the
 * wallet-driven UI run in apps/web/scripts/final-flow.mjs does it through the real page.
 *
 * This exists because every other script in here creates a quest and then immediately drives it,
 * which is no use when the driving is meant to happen in a browser.
 */
import "dotenv/config"

import { parseEther, parseUnits } from "ethers"

import { ACTION_TYPES, createQuests, readQuest } from "../src/services/campaignQuests"

const ACTIONS: Record<string, { actionType: number; token: string; decimals: number; emitterEnv: string }> = {
  portal: {
    actionType: ACTION_TYPES.portal,
    token: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    emitterEnv: "QUEST_PORTAL_ADDRESS",
  },
  swap: {
    actionType: ACTION_TYPES.uniswapSwap,
    token: "",
    decimals: 6,
    emitterEnv: "SEPOLIA_POOL_USDC_WETH_500",
  },
}

function need(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

async function main() {
  const participant = need("PARTICIPANT")
  const actionName = process.env.ACTION ?? "portal"
  const action = ACTIONS[actionName]
  if (!action) throw new Error(`unknown ACTION ${actionName}; try portal or swap`)

  const emitter = need(action.emitterEnv)
  const token = action.token || need("SEPOLIA_USDC")
  const min = process.env.MIN ?? "0.001"
  const reward = process.env.REWARD ?? "75"
  const minAmount =
    action.decimals === 18 ? parseEther(min).toString() : parseUnits(min, action.decimals).toString()

  const [created] = await createQuests(0n, participant, [
    {
      actionType: action.actionType,
      emitter,
      token,
      minAmount,
      rewardPerParticipant: parseEther(reward).toString(),
      badgeLevel: 1,
      playerMustMatch: true,
      category: 0,
      metadataURI: process.env.METADATA_URI ?? "ipfs://placeholder",
      sourceChainKey: 1,
    },
  ])
  if (!created) throw new Error("createQuest returned nothing")

  const back = await readQuest(created.questId)
  console.log(`quest ${created.questId} created for ${participant}`)
  console.log(`  tx        ${created.txHash}`)
  console.log(`  block     ${created.blockNumber}  gas ${created.gasUsed}`)
  console.log(`  action    ${actionName}, emitter ${emitter}, min ${min}`)
  console.log(`  reward    ${reward} VAEL`)
  console.log(`  read back assigned ${back.assignedParticipant}, status ${back.status}, campaignId ${back.campaignId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
