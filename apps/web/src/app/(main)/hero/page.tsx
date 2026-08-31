"use client"

import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { formatUnits } from "viem"

import { Button } from "@/components/ui/button"
import { InventoryPanel } from "@/components/inventory-panel"
import { useReownWallet } from "@/hooks/useReownWallet"
import { useHero, useMintHero, xpToNext } from "@/hooks/useGame"
import { EventBus, GameEvents } from "@/game/EventBus"
import { affinityLabel } from "@/lib/arena"
import { CREDITCOIN_EXPLORER_URL } from "@/lib/chains"

// Phaser reaches for `window` at import time, and so does any module importing a scene, so the
// whole canvas including the scene class is loaded client-side only.
const HeroCanvas = dynamic(() => import("@/game/HeroCanvas"), { ssr: false })

export default function HeroPage() {
  return (
    <Suspense fallback={null}>
      <HeroPageInner />
    </Suspense>
  )
}

function HeroPageInner() {
  const { wallet, isCreditcoinNetwork, switchToCreditcoin } = useReownWallet()
  const searchParams = useSearchParams()

  // `?address=0x…` shows any hero read-only, with no wallet at all. Useful for sharing a hero,
  // and useful for checking one without connecting.
  const previewParam = searchParams.get("address")
  const preview =
    previewParam && /^0x[a-fA-F0-9]{40}$/.test(previewParam) ? previewParam : undefined
  const isPreview = Boolean(preview)
  const address = preview ?? wallet.address ?? undefined
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
      affinity: hero?.affinity ?? ("novice" as const),
      readOnly: isPreview,
    }
  }, [hero, isPreview])

  // React holds the data and pushes it in; the scene never fetches.
  useEffect(() => {
    EventBus.emit(GameEvents.HeroState, payload)
  }, [payload])

  const handleMint = useCallback(async () => {
    // Previewing another address must never sign anything.
    if (isPreview) return
    if (!isCreditcoinNetwork) await switchToCreditcoin()
    const hash = await mint()
    if (hash) {
      setTxHash(hash)
      setTimeout(refetch, 4000)
    }
  }, [isCreditcoinNetwork, isPreview, mint, refetch, switchToCreditcoin])

  // The mint button inside the canvas asks React to sign.
  useEffect(() => {
    EventBus.on(GameEvents.RequestMintHero, handleMint)
    return () => {
      EventBus.off(GameEvents.RequestMintHero, handleMint)
    }
  }, [handleMint])

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-20 pt-24 md:px-10">
      {isPreview && (
        <div className="mb-4 rounded border border-sky-500/30 bg-sky-500/10 px-4 py-3">
          <p className="text-xs text-sky-300">
            Viewing{" "}
            <span className="font-mono">
              {preview!.slice(0, 6)}…{preview!.slice(-4)}
            </span>
            , read only. No wallet is connected to this view.
          </p>
        </div>
      )}

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">
          {isPreview ? "Hero" : "Your hero"}
        </h1>
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
            <p className="mt-2 text-xs text-zinc-500">
              Connect a wallet, or open <span className="font-mono">?address=0x…</span> to view any
              hero.
            </p>
          ) : loading ? (
            <p className="mt-2 text-xs text-zinc-500">Loading…</p>
          ) : !hero?.hasHero && isPreview ? (
            <p className="mt-2 text-xs text-zinc-500">This address has not minted a hero.</p>
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
                ["Affinity", affinityLabel(hero.affinity)],
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

      <div className="mt-6">
        <InventoryPanel address={address} readOnly={isPreview} />
      </div>
    </main>
  )
}
