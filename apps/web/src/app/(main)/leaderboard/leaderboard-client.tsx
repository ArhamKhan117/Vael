"use client"

import { useEffect, useState } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

interface LeaderboardData {
  byXp: {
    address: string
    level: number
    xp: string
    strength: number
    agility: number
    intellect: number
  }[]
  raid: { seasonId: number; byDamage: { address: string; damage: string }[] }
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Two rankings, both derived from verified proofs.
 *
 * Worth stating plainly on the page: a leaderboard is only interesting if the numbers cannot be
 * manufactured, and here every one traces back to a transaction the chain proved.
 */
export function LeaderboardTables() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/leaderboard`)
        if (!response.ok) return
        const body = (await response.json()) as LeaderboardData
        if (!cancelled) setData(body)
      } catch {
        /* leave the tables empty rather than erroring the page */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = setInterval(load, 20_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded border border-[#1A1A1A] bg-black">
        <header className="border-b border-[#1A1A1A] px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Heroes by level</h2>
          <p className="mt-1 text-[11px] text-zinc-500">Every point of XP came from a proof.</p>
        </header>
        {loading ? (
          <p className="px-4 py-6 text-xs text-zinc-500">Loading…</p>
        ) : (data?.byXp.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-500">No heroes yet.</p>
        ) : (
          <ol className="divide-y divide-[#1A1A1A]">
            {data?.byXp.map((row, i) => (
              <li key={row.address} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="text-zinc-500">
                  {i + 1}. <span className="font-mono text-zinc-300">{short(row.address)}</span>
                </span>
                <span className="text-zinc-400">
                  L{row.level} · {row.xp} XP · {row.strength}/{row.agility}/{row.intellect}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded border border-[#1A1A1A] bg-black">
        <header className="border-b border-[#1A1A1A] px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            Raid damage{data?.raid.seasonId ? ` · season ${data.raid.seasonId}` : ""}
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">Damage is real DeFi, proved on-chain.</p>
        </header>
        {loading ? (
          <p className="px-4 py-6 text-xs text-zinc-500">Loading…</p>
        ) : (data?.raid.byDamage.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-500">No damage this season yet.</p>
        ) : (
          <ol className="divide-y divide-[#1A1A1A]">
            {data?.raid.byDamage.map((row, i) => (
              <li key={row.address} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="text-zinc-500">
                  {i + 1}. <span className="font-mono text-zinc-300">{short(row.address)}</span>
                </span>
                <span className="text-zinc-400">{row.damage}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
