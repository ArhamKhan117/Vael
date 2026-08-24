"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount, useWriteContract } from "wagmi"

import { CREDITCOIN_CHAIN_ID } from "@/lib/chains"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export const vaelHeroAbi = [
  {
    type: "function",
    name: "mintHero",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasHero",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

export const raidBossAbi = [
  {
    type: "function",
    name: "claimLoot",
    stateMutability: "nonpayable",
    inputs: [{ name: "seasonId", type: "uint64" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

export interface HeroApi {
  address: string
  hasHero: boolean
  tokenId?: number
  level?: number
  xp?: string
  strength?: number
  agility?: number
  intellect?: number
  affinity?: "warrior" | "rogue" | "mage"
  streak?: number
}

export interface RaidApi {
  seasonId: number
  active: boolean
  maxHp?: string
  hp?: string
  lootPool?: string
  defeated?: boolean
  totalDamage?: string
  topDamage?: { player: string; damage: string }[]
  recentHits?: { player: string; damage: string; at: string }[]
}

/** XP needed to leave a level, matching VaelHero.xpToNext exactly. */
export function xpToNext(level: number): number {
  return 100 + 50 * level
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    // The game degrades to "no data" rather than an error page when the API is down.
    return null
  }
}

export function useHero(address?: string, refreshMs = 15_000) {
  const [hero, setHero] = useState<HeroApi | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!address) {
      setHero(null)
      setLoading(false)
      return
    }
    const data = await getJson<HeroApi>(`/hero/${address}`)
    setHero(data)
    setLoading(false)
  }, [address])

  useEffect(() => {
    void refetch()
    const timer = setInterval(refetch, refreshMs)
    return () => clearInterval(timer)
  }, [refetch, refreshMs])

  return { hero, loading, refetch }
}

export function useRaid(refreshMs = 12_000) {
  const [raid, setRaid] = useState<RaidApi | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const data = await getJson<RaidApi>("/raid/current")
    setRaid(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
    const timer = setInterval(refetch, refreshMs)
    return () => clearInterval(timer)
  }, [refetch, refreshMs])

  return { raid, loading, refetch }
}

/** Mint a hero from the player's own wallet. */
export function useMintHero() {
  const { writeContractAsync } = useWriteContract()
  const { isConnected } = useAccount()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mint = useCallback(async () => {
    setError(null)
    if (!isConnected) {
      setError("Connect your wallet first.")
      return null
    }
    setPending(true)
    try {
      return await writeContractAsync({
        abi: vaelHeroAbi,
        address: CONTRACT_ADDRESSES.VAEL_HERO,
        functionName: "mintHero",
        chainId: CREDITCOIN_CHAIN_ID,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      return null
    } finally {
      setPending(false)
    }
  }, [isConnected, writeContractAsync])

  return { mint, pending, error }
}

/** Claim a defeated season's loot. */
export function useClaimLoot() {
  const { writeContractAsync } = useWriteContract()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claim = useCallback(
    async (seasonId: number) => {
      setError(null)
      setPending(true)
      try {
        return await writeContractAsync({
          abi: raidBossAbi,
          address: CONTRACT_ADDRESSES.RAID_BOSS,
          functionName: "claimLoot",
          args: [BigInt(seasonId)],
          chainId: CREDITCOIN_CHAIN_ID,
        })
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
        return null
      } finally {
        setPending(false)
      }
    },
    [writeContractAsync]
  )

  return { claim, pending, error }
}
