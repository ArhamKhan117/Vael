import { keccak256, stringToHex, parseUnits } from "viem"

import {
  publicClient,
  workerWalletClient,
  campaignEscrowAddress,
  campaignEscrowAbi,
} from "../lib/contracts"

/**
 * Convert campaign UUID to bytes32 for contract.
 */
export function campaignIdToBytes32(campaignId: string): `0x${string}` {
  return keccak256(stringToHex(campaignId))
}

/**
 * Get campaign balance from escrow (raw wei, USDC 6 decimals).
 */
export async function getCampaignBalance(campaignId: string): Promise<bigint> {
  if (!campaignEscrowAddress) {
    throw new Error("CAMPAIGN_ESCROW_ADDRESS not configured")
  }

  const campaignIdBytes = campaignIdToBytes32(campaignId)
  const result = await publicClient.readContract({
    address: campaignEscrowAddress,
    abi: campaignEscrowAbi,
    functionName: "campaignBalance",
    args: [campaignIdBytes],
  })
  return result as bigint
}

/**
 * Refund the unspent campaign pool to the partner. Signed by the worker key, which is the
 * configured reward releaser until QuestASC takes that role in milestone 3.
 * USDC uses 6 decimals.
 */
export async function refundToPartner(
  campaignId: string,
  recipient: string,
  amountUsdc: number | string
): Promise<string> {
  if (!campaignEscrowAddress) {
    throw new Error("CAMPAIGN_ESCROW_ADDRESS not configured")
  }

  const amount = parseUnits(String(amountUsdc), 6)
  const campaignIdBytes = campaignIdToBytes32(campaignId)

  const { request } = await publicClient.simulateContract({
    account: workerWalletClient!.account!,
    address: campaignEscrowAddress,
    abi: campaignEscrowAbi,
    functionName: "refundToPartner",
    args: [campaignIdBytes, recipient as `0x${string}`, amount],
  })

  const hash = await workerWalletClient!.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return receipt.transactionHash
}

/**
 * Refund excess pool to partner. Uses raw amount (6 decimals) for precision.
 */
export async function refundToPartnerRaw(
  campaignId: string,
  recipient: string,
  amountRaw: bigint
): Promise<string> {
  if (!campaignEscrowAddress) {
    throw new Error("CAMPAIGN_ESCROW_ADDRESS not configured")
  }
  if (amountRaw <= 0n) {
    throw new Error("Refund amount must be positive")
  }

  const campaignIdBytes = campaignIdToBytes32(campaignId)

  const { request } = await publicClient.simulateContract({
    account: workerWalletClient!.account!,
    address: campaignEscrowAddress,
    abi: campaignEscrowAbi,
    functionName: "refundToPartner",
    args: [campaignIdBytes, recipient as `0x${string}`, amountRaw],
  })

  const hash = await workerWalletClient!.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return receipt.transactionHash
}

/**
 * Release USDC reward from CampaignEscrow to participant.
 * USDC uses 6 decimals.
 */
export async function releaseCampaignReward(
  campaignId: string,
  recipient: string,
  amountUsdc: number | string
): Promise<string> {
  if (!campaignEscrowAddress) {
    throw new Error("CAMPAIGN_ESCROW_ADDRESS not configured")
  }

  const amount = parseUnits(String(amountUsdc), 6) // USDC 6 decimals
  const campaignIdBytes = campaignIdToBytes32(campaignId)

  const { request } = await publicClient.simulateContract({
    account: workerWalletClient!.account!,
    address: campaignEscrowAddress,
    abi: campaignEscrowAbi,
    functionName: "releaseReward",
    args: [campaignIdBytes, recipient as `0x${string}`, amount],
  })

  const hash = await workerWalletClient!.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return receipt.transactionHash
}
