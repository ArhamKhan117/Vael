"use client"

import { useEffect, useState } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export interface VerifiedAction {
  replayKey: string
  questId: number
  player: string
  actionType: number
  sourceBlock: number
  amount: string
  creditcoinBlock: number
  createdAt: string
  vaelReleased: string
}

export interface OwnedBadge {
  tokenId: number
  player: string
  questId: number
  badgeLevel: number
  /** 0 Common through 4 Legendary. */
  rarity: number
  /** True when the rarity was computed from the badge level rather than stated on chain. */
  rarityIsDerived: boolean
  creditcoinBlock: number
  createdAt: string
}

export const RARITY_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const

/** Rarity colours, dullest to brightest, so the badge grid reads at a glance. */
export const RARITY_CLASSES = [
  "border-zinc-700 text-zinc-300",
  "border-emerald-600/50 text-emerald-300",
  "border-sky-600/50 text-sky-300",
  "border-violet-600/50 text-violet-300",
  "border-amber-500/50 text-amber-300",
] as const

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

/**
 * The parts of a profile that come from the chain.
 *
 * Everything here traces to a Creditcoin event: an action was verified, or a badge was minted. It
 * is deliberately separate from the off-chain profile (name, avatar), which is decoration and can
 * be absent without the page losing its point.
 */
export function useChainProfile(address?: string) {
  const [actions, setActions] = useState<VerifiedAction[]>([])
  const [badges, setBadges] = useState<OwnedBadge[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setActions([])
      setBadges([])
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [actionBody, badgeBody] = await Promise.all([
        getJson<{ actions: VerifiedAction[] }>(`/actions/${address}`),
        getJson<{ badges: OwnedBadge[] }>(`/badges/${address}`),
      ])
      if (cancelled) return
      setActions(actionBody?.actions ?? [])
      setBadges(badgeBody?.badges ?? [])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [address])

  return { actions, badges, loading }
}
