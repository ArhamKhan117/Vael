"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

interface RaidSummary {
  seasonId: number
  hp?: string
  maxHp?: string
  defeated?: boolean
  totalDamage?: string
}

/**
 * The live boss HP on the landing page.
 *
 * It renders nothing at all when there is no season or the API is unreachable, rather than showing
 * a zeroed bar: an empty space is honest, a bar at 0/0 looks like a defeated boss.
 */
export function LiveRaidBanner() {
  const [raid, setRaid] = useState<RaidSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/raid/current`)
        if (!response.ok) return
        const body = (await response.json()) as RaidSummary
        if (!cancelled) setRaid(body)
      } catch {
        /* stay hidden */
      }
    }
    void load()
    const timer = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  if (!raid || raid.seasonId === 0 || !raid.maxHp) return null

  const hp = Number(raid.hp ?? 0)
  const maxHp = Number(raid.maxHp)
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0

  return (
    <Link
      href="/raid"
      className="block border border-[#1A1A1A] bg-black p-5 transition hover:border-zinc-700 md:p-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Live raid · season {raid.seasonId}
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {raid.defeated ? "Boss defeated" : `${hp.toLocaleString()} HP remaining`}
          </p>
        </div>
        <span className="text-xs text-zinc-500">
          {raid.defeated ? "Loot is claimable" : `of ${maxHp.toLocaleString()}`}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded bg-[#1A1A1A]">
        <div
          className={raid.defeated ? "h-full bg-zinc-600" : "h-full bg-red-500"}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-zinc-600">
        Every point of damage is a real DeFi action on Ethereum, proved on Creditcoin.
      </p>
    </Link>
  )
}
