"use client"

import { ShieldCheck, Sword, TrendingUp, Users, Wallet } from "lucide-react"

import { formatVael, useStats } from "@/hooks/useStats"

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="relative overflow-hidden rounded border border-[#1A1A1A] bg-black p-5">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/5 via-black to-black" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </div>
          <div className="text-2xl font-semibold text-white">{value}</div>
        </div>
        <span
          className={`grid h-10 w-10 place-items-center rounded border border-[#1A1A1A] bg-[#18181B] ${accent}`}
        >
          {icon}
        </span>
      </div>
    </div>
  )
}

/**
 * Five numbers, none of them invented.
 *
 * Heroes, XP, and proofs are counted from Creditcoin's own events; raid damage is read from the
 * boss contract; VAEL released is the sum of what the vault actually paid out. A new deployment
 * shows zeros here, which is the point: the strip is a record, not a brochure.
 */
export function NetworkStats() {
  const { stats, loading } = useStats()
  const show = (value: string) => (loading && !stats ? "—" : value)

  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Hero XP earned"
          value={show(stats ? Number(stats.totalHeroXp).toLocaleString() : "0")}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="text-zinc-200"
        />
        <Stat
          label="Heroes minted"
          value={show(stats ? stats.heroesMinted.toLocaleString() : "0")}
          icon={<Users className="h-4 w-4" />}
          accent="text-sky-200"
        />
        <Stat
          label={
            stats?.season.seasonId
              ? `Raid damage · season ${stats.season.seasonId}`
              : "Raid damage"
          }
          value={show(stats ? Number(stats.season.totalDamage).toLocaleString() : "0")}
          icon={<Sword className="h-4 w-4" />}
          accent="text-red-200"
        />
        <Stat
          label="VAEL released"
          value={show(stats ? formatVael(stats.vaelReleased) : "0")}
          icon={<Wallet className="h-4 w-4" />}
          accent="text-emerald-200"
        />
        <Stat
          label="Proofs verified"
          value={show(stats ? stats.proofsVerified.toLocaleString() : "0")}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="text-violet-200"
        />
      </div>
      <p className="text-[11px] text-zinc-600">
        Counted from Creditcoin events through block{" "}
        {stats?.indexedThrough ? stats.indexedThrough.toLocaleString() : "—"}. Nothing here is
        estimated or seeded.
      </p>
    </div>
  )
}
