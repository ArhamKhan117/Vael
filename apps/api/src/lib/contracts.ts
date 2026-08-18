import { Abi, createPublicClient, createWalletClient, fallback, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import QuestManagerArtifact from "../abi/QuestManager.json"
import CampaignEscrowArtifact from "../abi/CampaignEscrow.json"
import { env } from "../config/env"
import { CREDITCOIN_RPC_URLS, SEPOLIA_RPC_URLS, creditcoinTestnet, sepoliaChain } from "./chains"

/**
 * Public RPC endpoints reject JSON-RPC batching and rate-limit aggressively, so every
 * client batches nothing, times out per request, and falls through a list of endpoints.
 */
function rpcTransport(urls: string[]) {
  return fallback(
    urls.map((url) =>
      http(url, {
        batch: false,
        timeout: env.RPC_TIMEOUT_MS,
        retryCount: 2,
      })
    )
  )
}

const creditcoinTransport = rpcTransport(CREDITCOIN_RPC_URLS)
const sepoliaTransport = rpcTransport(SEPOLIA_RPC_URLS)

/** Normalize a private key to a 0x-prefixed 32-byte hex string. */
function normalizePrivateKey(privateKey: string): `0x${string}` {
  const trimmed = privateKey.trim()
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Invalid private key format. Expected 64 hex characters, with or without the 0x prefix.")
  }
  return normalized as `0x${string}`
}

/** Creates quests as the registered ERC-8004 agent. */
export const agentControllerAccount = privateKeyToAccount(
  normalizePrivateKey(env.AGENT_CONTROLLER_PRIVATE_KEY)
)

/**
 * Submits Attestcoin proofs and pays CTC gas. It cannot complete a quest on its own:
 * QuestManager.recordCompletion is callable only by QuestASC.
 */
export const workerAccount = privateKeyToAccount(normalizePrivateKey(env.WORKER_PRIVATE_KEY))

export const agentControllerWalletClient = createWalletClient({
  account: agentControllerAccount,
  chain: creditcoinTestnet,
  transport: creditcoinTransport,
})

export const workerWalletClient = createWalletClient({
  account: workerAccount,
  chain: creditcoinTestnet,
  transport: creditcoinTransport,
})

export const publicClient = createPublicClient({
  chain: creditcoinTestnet,
  transport: creditcoinTransport,
})

export const sepoliaPublicClient = createPublicClient({
  chain: sepoliaChain,
  transport: sepoliaTransport,
})

export const questManagerAbi = QuestManagerArtifact.abi as Abi
export const questManagerAddress = env.QUEST_MANAGER_ADDRESS as `0x${string}`

export const campaignEscrowAbi = CampaignEscrowArtifact.abi as Abi
export const campaignEscrowAddress = env.CAMPAIGN_ESCROW_ADDRESS as `0x${string}` | undefined

export function getWalletAddress() {
  return agentControllerAccount.address
}

export function getWorkerAddress() {
  return workerAccount.address
}
