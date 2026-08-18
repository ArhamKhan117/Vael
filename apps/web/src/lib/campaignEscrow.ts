/**
 * CampaignEscrow contract utilities for frontend.
 * Partner deposit flow: approve the reward token, then CampaignEscrow.deposit(campaignIdBytes32, amount).
 */

import { keccak256, stringToHex, parseUnits } from "viem"
import { CONTRACT_ADDRESSES } from "./contracts"

// Re-export for convenience
export const CAMPAIGN_ESCROW_ADDRESS = CONTRACT_ADDRESSES.CAMPAIGN_ESCROW
export const REWARD_TOKEN_ADDRESS = CONTRACT_ADDRESSES.REWARD_STABLE

/** Reward stablecoin decimals. */
export const REWARD_TOKEN_DECIMALS = 6

/**
 * Convert campaign UUID to bytes32 for contract.
 * Must match backend: campaignEscrowService.campaignIdToBytes32
 */
export function campaignIdToBytes32(campaignId: string): `0x${string}` {
  return keccak256(stringToHex(campaignId))
}

/**
 * Parse a reward token amount into base units for a contract call.
 */
export function parseRewardAmount(amount: number | string): bigint {
  return parseUnits(String(amount), REWARD_TOKEN_DECIMALS)
}

/** CampaignEscrow ABI – functions needed for frontend */
export const CAMPAIGN_ESCROW_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "campaignId", type: "bytes32", internalType: "bytes32" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "campaignBalance",
    inputs: [{ name: "campaignId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDepositAmountForPool",
    inputs: [{ name: "poolAmount", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getFeeAndPoolAmount",
    inputs: [{ name: "depositAmount", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "feeAmount", type: "uint256", internalType: "uint256" },
      { name: "poolAmount", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rewardToken",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IERC20" }],
    stateMutability: "view",
  },
] as const

/** ERC-20 approve, called before deposit. */
export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const
