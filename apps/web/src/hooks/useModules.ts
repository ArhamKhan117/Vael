"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount, useWriteContract } from "wagmi"

import { CREDITCOIN_CHAIN_ID } from "@/lib/chains"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

// ---------------------------------------------------------------- ABIs

export const arenaAbi = [
  {
    type: "function",
    name: "challenge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "opponent", type: "address" },
      { name: "stake", type: "uint256" },
    ],
    outputs: [{ name: "challengeId", type: "uint256" }],
  },
  {
    type: "function",
    name: "accept",
    stateMutability: "nonpayable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: [],
  },
] as const

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

export const erc1155Abi = [
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "claimRaidLoot",
    stateMutability: "nonpayable",
    inputs: [{ name: "seasonId", type: "uint64" }],
    outputs: [{ name: "itemId", type: "uint256" }],
  },
] as const

export const equipmentAbi = [
  {
    type: "function",
    name: "equip",
    stateMutability: "nonpayable",
    inputs: [
      { name: "heroTokenId", type: "uint256" },
      { name: "slot", type: "uint8" },
      { name: "itemId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "unequip",
    stateMutability: "nonpayable",
    inputs: [
      { name: "heroTokenId", type: "uint256" },
      { name: "slot", type: "uint8" },
    ],
    outputs: [{ name: "itemId", type: "uint256" }],
  },
] as const

export const marketplaceAbi = [
  {
    type: "function",
    name: "list",
    stateMutability: "nonpayable",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
] as const

// ---------------------------------------------------------------- reads

export interface ItemKind {
  itemId: number
  name: string
  slot: number
  slotName: string
  rarity: number
  rarityName: string
  strength: number
  agility: number
  intellect: number
  uri: string
}

export interface Challenge {
  challengeId: number
  challenger: string
  opponent: string
  stake: string
  status: "open" | "accepted" | "resolved" | "drawn" | "expired" | "cancelled"
  winner?: string
  payout?: string
  burned?: string
  seed?: string
  rounds?: string
  openedAtBlock: number
  acceptedAtBlock?: number
  resolvedAtBlock?: number
  updatedAt: string
}

export interface Listing {
  listingId: number
  seller: string
  itemId: number
  amount: number
  price: string
  status: "active" | "sold" | "cancelled"
  buyer?: string
  fee?: string
  item: ItemKind | null
}

export interface Inventory {
  address: string
  heroTokenId: number
  items: (ItemKind & { amount: number })[]
  equipped: { slot: number; slotName: string; itemId: number }[]
  bonuses: { strength: number; agility: number; intellect: number }
  drops: {
    id: string
    itemId: number
    rarity: number
    reason: string
    seasonId?: number
    shareBps?: number
    creditcoinBlock: number
    createdAt: string
  }[]
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

/** Every registered item kind, read by the API from Loot itself. */
export function useItems() {
  const [items, setItems] = useState<ItemKind[]>([])
  useEffect(() => {
    void getJson<{ items: ItemKind[] }>("/items").then((body) => setItems(body?.items ?? []))
  }, [])
  return items
}

export function useChallenges(status = "open", address?: string, refreshMs = 12_000) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const query = new URLSearchParams({ status })
    if (address) query.set("address", address)
    const body = await getJson<{ challenges: Challenge[] }>(`/arena/challenges?${query}`)
    setChallenges(body?.challenges ?? [])
    setLoading(false)
  }, [status, address])

  useEffect(() => {
    void refetch()
    const timer = setInterval(refetch, refreshMs)
    return () => clearInterval(timer)
  }, [refetch, refreshMs])

  return { challenges, loading, refetch }
}

export function useArenaHistory(address?: string, refreshMs = 20_000) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const refetch = useCallback(async () => {
    const query = address ? `?address=${address}` : ""
    const body = await getJson<{ challenges: Challenge[] }>(`/arena/history${query}`)
    setChallenges(body?.challenges ?? [])
  }, [address])

  useEffect(() => {
    void refetch()
    const timer = setInterval(refetch, refreshMs)
    return () => clearInterval(timer)
  }, [refetch, refreshMs])

  return { challenges, refetch }
}

export function useInventory(address?: string, refreshMs = 15_000) {
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!address) {
      setInventory(null)
      return
    }
    setLoading(true)
    setInventory(await getJson<Inventory>(`/inventory/${address}`))
    setLoading(false)
  }, [address])

  useEffect(() => {
    void refetch()
    if (!address) return
    const timer = setInterval(refetch, refreshMs)
    return () => clearInterval(timer)
  }, [refetch, refreshMs, address])

  return { inventory, loading, refetch }
}

export function useListings(status = "active", refreshMs = 15_000) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const body = await getJson<{ listings: Listing[] }>(`/market/listings?status=${status}`)
    setListings(body?.listings ?? [])
    setLoading(false)
  }, [status])

  useEffect(() => {
    void refetch()
    const timer = setInterval(refetch, refreshMs)
    return () => clearInterval(timer)
  }, [refetch, refreshMs])

  return { listings, loading, refetch }
}

// ---------------------------------------------------------------- writes

/**
 * One hook for every module write.
 *
 * They all share the same shape: a wallet signature on Creditcoin, one pending flag, and the last
 * error in plain text. Splitting them into eight near-identical hooks would only spread the same
 * five lines across eight files.
 */
export function useModuleWrites() {
  const { writeContractAsync } = useWriteContract()
  const { isConnected } = useAccount()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (label: string, call: () => Promise<`0x${string}`>) => {
      setError(null)
      if (!isConnected) {
        setError("Connect your wallet first.")
        return null
      }
      setPending(label)
      try {
        return await call()
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        // Wallet rejections are the common case and their raw text is unreadable.
        setError(/User rejected|denied/i.test(message) ? "Rejected in the wallet." : message)
        return null
      } finally {
        setPending(null)
      }
    },
    [isConnected]
  )

  const approveVael = useCallback(
    (spender: `0x${string}`, amount: bigint) =>
      run("approve", () =>
        writeContractAsync({
          abi: erc20Abi,
          address: CONTRACT_ADDRESSES.VAEL_TOKEN,
          functionName: "approve",
          args: [spender, amount],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const approveLoot = useCallback(
    (operator: `0x${string}`) =>
      run("approve-items", () =>
        writeContractAsync({
          abi: erc1155Abi,
          address: CONTRACT_ADDRESSES.LOOT,
          functionName: "setApprovalForAll",
          args: [operator, true],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const challenge = useCallback(
    (opponent: `0x${string}`, stake: bigint) =>
      run("challenge", () =>
        writeContractAsync({
          abi: arenaAbi,
          address: CONTRACT_ADDRESSES.ARENA,
          functionName: "challenge",
          args: [opponent, stake],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const acceptChallenge = useCallback(
    (challengeId: number) =>
      run(`accept-${challengeId}`, () =>
        writeContractAsync({
          abi: arenaAbi,
          address: CONTRACT_ADDRESSES.ARENA,
          functionName: "accept",
          args: [BigInt(challengeId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const resolveChallenge = useCallback(
    (challengeId: number) =>
      run(`resolve-${challengeId}`, () =>
        writeContractAsync({
          abi: arenaAbi,
          address: CONTRACT_ADDRESSES.ARENA,
          functionName: "resolve",
          args: [BigInt(challengeId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const cancelChallenge = useCallback(
    (challengeId: number) =>
      run(`cancel-${challengeId}`, () =>
        writeContractAsync({
          abi: arenaAbi,
          address: CONTRACT_ADDRESSES.ARENA,
          functionName: "cancel",
          args: [BigInt(challengeId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const claimRaidLoot = useCallback(
    (seasonId: number) =>
      run("claim-loot", () =>
        writeContractAsync({
          abi: erc1155Abi,
          address: CONTRACT_ADDRESSES.LOOT,
          functionName: "claimRaidLoot",
          args: [BigInt(seasonId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const equip = useCallback(
    (heroTokenId: number, slot: number, itemId: number) =>
      run(`equip-${slot}`, () =>
        writeContractAsync({
          abi: equipmentAbi,
          address: CONTRACT_ADDRESSES.EQUIPMENT,
          functionName: "equip",
          args: [BigInt(heroTokenId), slot, BigInt(itemId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const unequip = useCallback(
    (heroTokenId: number, slot: number) =>
      run(`unequip-${slot}`, () =>
        writeContractAsync({
          abi: equipmentAbi,
          address: CONTRACT_ADDRESSES.EQUIPMENT,
          functionName: "unequip",
          args: [BigInt(heroTokenId), slot],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const listItem = useCallback(
    (itemId: number, amount: number, price: bigint) =>
      run("list", () =>
        writeContractAsync({
          abi: marketplaceAbi,
          address: CONTRACT_ADDRESSES.MARKETPLACE,
          functionName: "list",
          args: [BigInt(itemId), BigInt(amount), price],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const buyListing = useCallback(
    (listingId: number) =>
      run(`buy-${listingId}`, () =>
        writeContractAsync({
          abi: marketplaceAbi,
          address: CONTRACT_ADDRESSES.MARKETPLACE,
          functionName: "buy",
          args: [BigInt(listingId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  const cancelListing = useCallback(
    (listingId: number) =>
      run(`cancel-listing-${listingId}`, () =>
        writeContractAsync({
          abi: marketplaceAbi,
          address: CONTRACT_ADDRESSES.MARKETPLACE,
          functionName: "cancel",
          args: [BigInt(listingId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      ),
    [run, writeContractAsync]
  )

  return {
    pending,
    error,
    approveVael,
    approveLoot,
    challenge,
    acceptChallenge,
    resolveChallenge,
    cancelChallenge,
    claimRaidLoot,
    equip,
    unequip,
    listItem,
    buyListing,
    cancelListing,
  }
}
