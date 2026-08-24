"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { formatUnits } from "viem"

import { Button } from "@/components/ui/button"
import { useReownWallet } from "@/hooks/useReownWallet"
import { useHero, useMintHero, xpToNext } from "@/hooks/useGame"
import { EventBus, GameEvents } from "@/game/EventBus"
import { CREDITCOIN_EXPLORER_URL } from "@/lib/chains"

// Phaser reaches for `window` at import time, and so does any module importing a scene, so the
// whole canvas including the scene class is loaded client-side only.
const HeroCanvas = dynamic(() => import("@/game/HeroCanvas"), { ssr: false })

export default function HeroPage() {
  const { wallet, isCreditcoinNetwork, switchToCreditcoin } = useReownWallet()
  const address = wallet.address ?? undefined
  const { hero, loading, refetch } = useHero(address)
  const { mint, pending, error } = useMintHero()
  const [txHash, setTxHash] = useState<string | null>(null)

  const payload = useMemo(() => {
    const level = hero?.level ?? 1
    return {
      hasHero: Boolean(hero?.hasHero),
      level,
      xp: Number(hero?.xp ?? 0),
      xpToNext: xpToNext(level),
      strength: hero?.strength ?? 0,
      agility: hero?.agility ?? 0,
      intellect: hero?.intellect ?? 0,
      streak: hero?.streak ?? 0,
      affinity: hero?.affinity ?? ("warrior" as const),
    }
  }, [hero])

  // React holds the data and pushes it in; the scene never fetches.
  useEffect(() => {
    EventBus.emit(GameEvents.HeroState, payload)
  }, [payload])

  const handleMint = useCallback(async () => {
    if (!isCreditcoinNetwork) await switchToCreditcoin()
    const hash = await mint()
    if (hash) {
      setTxHash(hash)
      setTimeout(refetch, 4000)
    }
  }, [isCreditcoinNetwork, mint, refetch, switchToCreditcoin])

  // The mint button inside the canvas asks React to sign.
  useEffect(() => {
    EventBus.on(GameEvents.RequestMintHero, handleMint)
    return () => {
      EventBus.off(GameEvents.RequestMintHero, handleMint)
    }
  }, [handleMint])

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Your hero</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Soul-bound, one per wallet. Every point of XP came from a proof this chain verified
          itself, so the sheet below is a record of what you actually did on Ethereum.
        </p>
      </header>

      <HeroCanvas onReady={() => EventBus.emit(GameEvents.HeroState, payload)} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-[#1A1A1A] bg-black p-4">
          <h2 className="text-sm font-semibold text-white">Stats</h2>
          {!address ? (
            <p className="mt-2 text-xs text-zinc-500">Connect a wallet to see your hero.</p>
          ) : loading ? (
            <p className="mt-2 text-xs text-zinc-500">Loading…</p>
          ) : !hero?.hasHero ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-zinc-500">
                You have no hero yet. Minting is free and costs only Creditcoin gas.
              </p>
              <Button
                onClick={handleMint}
                disabled={pending}
                className="w-full rounded bg-white text-black hover:bg-white/90"
              >
                {pending ? "Confirm in your wallet…" : "Mint hero"}
              </Button>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          ) : (
            <dl className="mt-3 space-y-2 text-xs">
              {[
                ["Level", String(hero.level)],
                ["XP", `${hero.xp} / ${xpToNext(hero.level ?? 1)}`],
                ["Strength", String(hero.strength)],
                ["Agility", String(hero.agility)],
                ["Intellect", String(hero.intellect)],
                ["Streak", String(hero.streak)],
                ["Affinity", String(hero.affinity)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="text-zinc-200">{value}</dd>
                </div>
              ))}
            </dl>
          )}
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
          <h2 className="text-sm font-semibold text-white">How XP works</h2>
          <ul className="mt-3 space-y-1.5 text-xs text-zinc-500">
            <li>Portal check-in: 50 XP, strength</li>
            <li>ERC-20 transfer: 60 XP, strength</li>
            <li>Uniswap v3 swap: 100 XP, agility</li>
            <li>Aave v3 supply: 120 XP, intellect</li>
            <li>Aave v3 borrow: 150 XP, intellect</li>
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            An action five times the quest minimum is worth 1.5x, twenty-five times is worth 2x.
            Nothing here can be granted by hand: XP arrives only through a verified proof.
          </p>
        </div>
      </section>
    </main>
  )
}
