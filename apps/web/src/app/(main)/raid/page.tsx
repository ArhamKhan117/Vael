"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { formatEther } from "viem"

import { Button } from "@/components/ui/button"
import { useReownWallet } from "@/hooks/useReownWallet"
import { useClaimLoot, useRaid } from "@/hooks/useGame"
import { EventBus, GameEvents } from "@/game/EventBus"
import { CREDITCOIN_EXPLORER_URL } from "@/lib/chains"

const RaidCanvas = dynamic(() => import("@/game/RaidCanvas"), { ssr: false })

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function RaidPage() {
  const { wallet, isCreditcoinNetwork, switchToCreditcoin } = useReownWallet()
  const address = wallet.address ?? undefined
  const { raid, loading, refetch } = useRaid()
  const { claim, pending, error } = useClaimLoot()
  const [txHash, setTxHash] = useState<string | null>(null)
  const [mine, setMine] = useState<{ damage: string; pendingLoot: string } | null>(null)

  const payload = useMemo(
    () => ({
      seasonId: raid?.seasonId ?? 0,
      hp: Number(raid?.hp ?? 0),
      maxHp: Number(raid?.maxHp ?? 0),
      defeated: Boolean(raid?.defeated),
      recentHits: (raid?.recentHits ?? []).map((hit) => ({
        player: hit.player,
        damage: hit.damage,
      })),
    }),
    [raid]
  )

  useEffect(() => {
    EventBus.emit(GameEvents.RaidState, payload)
  }, [payload])

  // Your own damage and pending share come straight from the contract.
  useEffect(() => {
    if (!address || !raid?.seasonId) return
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/raid/${raid.seasonId}/pending/${address}`)
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) setMine({ damage: data.damage, pendingLoot: data.pendingLoot })
      } catch {
        /* the feed simply stays quiet */
      }
    }
    void load()
    const timer = setInterval(load, 12_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [address, raid?.seasonId])

  const handleClaim = useCallback(async () => {
    if (!raid?.seasonId) return
    if (!isCreditcoinNetwork) await switchToCreditcoin()
    const hash = await claim(raid.seasonId)
    if (hash) {
      setTxHash(hash)
      setTimeout(refetch, 4000)
    }
  }, [claim, isCreditcoinNetwork, raid?.seasonId, refetch, switchToCreditcoin])

  const canClaim = Boolean(raid?.defeated && mine && BigInt(mine.pendingLoot) > 0n)

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-20 pt-24 md:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Raid</h1>
        <p className="mt-1 text-sm text-zinc-400">
          One boss, everybody. Every point of damage is somebody&apos;s real DeFi action on
          Ethereum, proved on Creditcoin. Nobody can script this down.
        </p>
      </header>

      <RaidCanvas state={payload} onReady={() => EventBus.emit(GameEvents.RaidState, payload)} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-[#1A1A1A] bg-black p-4">
          <h2 className="text-sm font-semibold text-white">This season</h2>
          {loading ? (
            <p className="mt-2 text-xs text-zinc-500">Loading…</p>
          ) : !raid || raid.seasonId === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">No season has started yet.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-xs">
              {[
                ["Season", String(raid.seasonId)],
                ["HP", `${raid.hp} / ${raid.maxHp}`],
                ["Loot pool", `${formatEther(BigInt(raid.lootPool ?? "0"))} VAEL`],
                ["Total damage", raid.totalDamage ?? "0"],
                ["Status", raid.defeated ? "Defeated" : "Alive"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="text-zinc-200">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {mine && (
            <div className="mt-4 border-t border-[#1A1A1A] pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Your damage</span>
                <span className="text-zinc-200">{mine.damage}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-zinc-500">Your share</span>
                <span className="text-zinc-200">
                  {formatEther(BigInt(mine.pendingLoot))} VAEL
                </span>
              </div>
            </div>
          )}

          {canClaim && (
            <Button
              onClick={handleClaim}
              disabled={pending}
              className="mt-4 w-full rounded bg-sky-500 text-black hover:bg-sky-400"
            >
              {pending ? "Confirm in your wallet…" : "Claim loot"}
            </Button>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          {txHash && (
            <a
              href={`${CREDITCOIN_EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block font-mono text-[11px] text-sky-400 hover:underline"
            >
              {txHash.slice(0, 10)}…{txHash.slice(-6)}
            </a>
          )}
        </div>

        <div className="rounded border border-[#1A1A1A] bg-black p-4">
          <h2 className="text-sm font-semibold text-white">Top damage</h2>
          {(raid?.topDamage ?? []).length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">No hits yet.</p>
          ) : (
            <ol className="mt-3 space-y-1.5 text-xs">
              {(raid?.topDamage ?? []).map((row, i) => (
                <li key={row.player} className="flex justify-between">
                  <span className="text-zinc-500">
                    {i + 1}. <span className="font-mono">{short(row.player)}</span>
                  </span>
                  <span className="text-zinc-200">{row.damage}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  )
}
