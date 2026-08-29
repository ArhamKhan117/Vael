"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { Copy, Loader2 } from "lucide-react"

import { EditAvatarDialog } from "@/components/edit-avatar-dialog"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { InventoryPanel } from "@/components/inventory-panel"
import { Button } from "@/components/ui/button"
import { ACADEMY_MODULES } from "@/content/academy"
import { useAcademy } from "@/hooks/useAcademy"
import { useHero, xpToNext } from "@/hooks/useGame"
import { useProfile } from "@/hooks/useProfile"
import {
  RARITY_CLASSES,
  RARITY_NAMES,
  useChainProfile,
} from "@/hooks/useProfileChain"
import { ACTION_LABELS, ActionType } from "@/lib/attestcoin/types"
import { CREDITCOIN_EXPLORER_URL } from "@/lib/chains"

function getDefaultAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${seed}`
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function actionLabel(actionType: number) {
  return ACTION_LABELS[actionType as ActionType] ?? `Action ${actionType}`
}

/** VAEL is 18 decimals. Whole tokens are all this page needs. */
function vael(wei: string) {
  return (BigInt(wei || "0") / 10n ** 18n).toLocaleString()
}

export default function ProfilePage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()

  // Off-chain decoration: a name and an avatar. Absent is fine and the page still works.
  const { stats, refetch } = useProfile(address ?? null)
  // Everything that matters comes from the chain and the index built from its events.
  const { hero, loading: heroLoading } = useHero(address ?? undefined)
  const { actions, badges, loading: chainLoading } = useChainProfile(address ?? undefined)
  const { data: academy } = useAcademy(address ?? undefined)

  useEffect(() => {
    if (!isConnected || !address) router.push("/")
  }, [isConnected, address, router])

  if (!isConnected || !address) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-20 pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </main>
    )
  }

  const avatarUrl = stats?.avatar_url ?? getDefaultAvatar(address)
  const displayName = stats?.name?.trim() || shortAddress(address)

  const level = hero?.level ?? 1
  const xp = Number(hero?.xp ?? 0)
  const needed = xpToNext(level)
  const xpPct = needed === 0 ? 0 : Math.min(100, (xp / needed) * 100)

  const academyDone = ACADEMY_MODULES.filter(
    (module) => academy?.modules[module.slug]?.quizPassed
  ).length

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Identity */}
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <EditAvatarDialog walletAddress={address} stats={stats} onSuccess={refetch}>
              <button type="button" className="relative h-16 w-16 overflow-hidden rounded-full border border-[#1A1A1A]">
                <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
              </button>
            </EditAvatarDialog>
            <div>
              <h1 className="text-xl font-semibold text-white">{displayName}</h1>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(address)}
                className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-zinc-300"
              >
                {shortAddress(address)} <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <EditProfileDialog walletAddress={address} stats={stats} onSuccess={refetch}>
              <Button variant="outline" size="sm" className="rounded border-zinc-700 text-zinc-300">
                Edit profile
              </Button>
            </EditProfileDialog>
            <Button asChild size="sm" className="rounded bg-white text-black hover:bg-white/90">
              <Link href={`/hero?address=${address}`}>Hero sheet</Link>
            </Button>
          </div>
        </section>

        {/* Hero card and level curve */}
        <section className="rounded border border-[#1A1A1A] bg-black p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">Hero</h2>
            <span className="text-[11px] text-zinc-600">
              Levelled only by proofs the chain verified
            </span>
          </div>

          {heroLoading && !hero ? (
            <p className="mt-3 text-xs text-zinc-500">Loading…</p>
          ) : !hero?.hasHero ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-zinc-500">No hero yet. Minting is free.</p>
              <Button asChild size="sm" className="rounded bg-white text-black hover:bg-white/90">
                <Link href="/hero">Mint a hero</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded border border-[#1A1A1A] bg-[#18181B] text-sm font-semibold text-zinc-200">
                  L{level}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="text-zinc-400">
                      Level {level} · {hero.affinity}
                    </span>
                    <span className="text-zinc-500">
                      {xp.toLocaleString()} / {needed.toLocaleString()} XP to level {level + 1}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded bg-[#1A1A1A]">
                    <div className="h-full bg-white" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Strength", hero.strength],
                  ["Agility", hero.agility],
                  ["Intellect", hero.intellect],
                  ["Streak", hero.streak],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded border border-[#1A1A1A] px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</dt>
                    <dd className="mt-0.5 text-sm text-zinc-200">{String(value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11px] text-zinc-600">
                Leaving level L costs 100 + 50 x L XP, so the bar resets each level rather than
                filling once.
              </p>
            </>
          )}
        </section>

        {/* Badges */}
        <section className="rounded border border-[#1A1A1A] bg-black p-5">
          <h2 className="text-sm font-semibold text-white">Badges</h2>
          {chainLoading && badges.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">Loading…</p>
          ) : badges.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              None yet. A badge is minted by QuestASC when it verifies a quest proof.
            </p>
          ) : (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {badges.map((badge) => (
                  <div
                    key={badge.tokenId}
                    className={`rounded border px-3 py-2.5 ${RARITY_CLASSES[badge.rarity] ?? RARITY_CLASSES[0]}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {RARITY_NAMES[badge.rarity] ?? "Common"}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">#{badge.tokenId}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Quest {badge.questId} · level {badge.badgeLevel}
                    </p>
                  </div>
                ))}
              </div>
              {badges.some((badge) => badge.rarityIsDerived) && (
                <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
                  The deployed BadgeNFT does not store a rarity, so the rarities above are computed
                  from each badge&apos;s level by the published rule. The version that records
                  rarity on chain ships with the consolidated redeploy.
                </p>
              )}
            </>
          )}
        </section>

        <InventoryPanel address={address} />

        {/* Academy */}
        <section className="rounded border border-[#1A1A1A] bg-black p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">Academy</h2>
            <Link href="/academy" className="text-[11px] text-zinc-500 hover:text-zinc-300">
              Open academy
            </Link>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            {academyDone} of {ACADEMY_MODULES.length} quizzes passed
          </p>
          <ul className="mt-3 space-y-1.5">
            {ACADEMY_MODULES.map((module) => {
              const progress = academy?.modules[module.slug]
              const read = progress?.lessonsRead.length ?? 0
              return (
                <li
                  key={module.slug}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <Link href={`/academy/${module.slug}`} className="text-zinc-400 hover:text-zinc-200">
                    {module.title}
                  </Link>
                  <span className={progress?.quizPassed ? "text-emerald-400" : "text-zinc-600"}>
                    {read}/{module.lessons.length} lessons ·{" "}
                    {progress?.quizPassed
                      ? `passed ${progress.quizScore}/5`
                      : progress?.quizScore
                        ? `best ${progress.quizScore}/5`
                        : "not taken"}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Verified actions */}
        <section className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
          <header className="border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Verified actions</h2>
            <p className="mt-1 text-[11px] text-zinc-600">
              Every row is one QuestProofApplied event. Creditcoin emitted it after checking a
              Merkle proof and a continuity proof, so nothing here can be added by hand.
            </p>
          </header>

          {chainLoading && actions.length === 0 ? (
            <p className="px-5 py-6 text-xs text-zinc-500">Loading…</p>
          ) : actions.length === 0 ? (
            <p className="px-5 py-6 text-xs text-zinc-500">
              Nothing verified yet. Complete a quest and it appears here.
            </p>
          ) : (
            <ul className="divide-y divide-[#1A1A1A]">
              {actions.map((action) => (
                <li
                  key={action.replayKey}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-zinc-200">{actionLabel(action.actionType)}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      Quest {action.questId} · Sepolia block{" "}
                      {action.sourceBlock.toLocaleString()} ·{" "}
                      {new Date(action.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {action.vaelReleased !== "0" && (
                      <p className="text-emerald-400">{vael(action.vaelReleased)} VAEL</p>
                    )}
                    <a
                      href={`${CREDITCOIN_EXPLORER_URL}/block/${action.creditcoinBlock}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-sky-400 hover:underline"
                    >
                      block {action.creditcoinBlock.toLocaleString()}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-wrap gap-3">
          <Button asChild className="rounded bg-white font-semibold text-black hover:bg-white/80">
            <Link href="/quests">View quests</Link>
          </Button>
          <Button asChild className="rounded bg-white font-semibold text-black hover:bg-white/80">
            <Link href="/leaderboard">View leaderboard</Link>
          </Button>
        </section>
      </div>
    </main>
  )
}
