"use client"

import { useEffect, useState } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

/**
 * The network's headline numbers, as the chain reports them.
 *
 * Every field is a sum over events Creditcoin emitted or a read of the boss contract. There is no
 * seeded or illustrative figure in here, so a fresh deployment reads zero across the board, and
 * zero is the honest answer.
 */
export interface NetworkStats {
  heroesMinted: number
  totalHeroXp: string
  proofsVerified: number
  vaelReleased: string
  season: { seasonId: number; active: boolean; totalDamage: string }
  indexedThrough: number
}

export function useStats(pollMs = 30_000) {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/stats`)
        if (!response.ok) return
        const body = (await response.json()) as NetworkStats
        if (!cancelled) setStats(body)
      } catch {
        // Leave the last good numbers on screen rather than replacing them with an error.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = setInterval(load, pollMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pollMs])

  return { stats, loading }
}

/** VAEL is 18 decimals; the strip wants a short readable figure, not full precision. */
export function formatVael(wei: string): string {
  const value = BigInt(wei || "0")
  const whole = value / 10n ** 18n
  if (whole >= 1_000_000n) return `${(Number(whole) / 1_000_000).toFixed(1)}M`
  if (whole >= 1_000n) return `${(Number(whole) / 1_000).toFixed(1)}K`
  return whole.toString()
}
