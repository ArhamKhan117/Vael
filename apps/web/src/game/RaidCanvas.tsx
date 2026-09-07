"use client"

import { RaidStatePayload } from "./EventBus"
import { RaidScene } from "./scenes/RaidScene"
import PhaserGame from "./PhaserGame"

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/**
 * Client-only wrapper for the raid canvas. See HeroCanvas for why this indirection exists, and for
 * why every readable thing on it is DOM rather than Phaser text.
 */
export default function RaidCanvas({
  state,
  onReady,
}: {
  state: RaidStatePayload
  onReady?: () => void
}) {
  const ratio = state.maxHp > 0 ? Math.max(0, Math.min(1, state.hp / state.maxHp)) : 0
  const hits = state.recentHits.slice(0, 7)

  const overlay = (
    <div className="flex h-full flex-col p-4">
      <p className="text-center text-sm font-semibold text-white">
        {state.seasonId === 0
          ? "No season yet"
          : state.defeated
            ? `Season ${state.seasonId} - defeated`
            : `Season ${state.seasonId}`}
      </p>

      <div className="mx-auto mt-3 w-full max-w-sm">
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-[#1A1A1A]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={state.maxHp}
          aria-valuenow={state.hp}
          aria-label="Boss hit points remaining"
        >
          <div
            className={`h-full transition-[width] ${state.defeated ? "bg-zinc-600" : "bg-red-500"}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {state.maxHp > 0 && (
          <p className="mt-1.5 text-center text-[11px] text-zinc-400">
            {state.hp} / {state.maxHp} HP
          </p>
        )}
      </div>

      {/* The feed sits bottom-left, clear of the boss. Every line is a real proved action. */}
      <ul className="mt-auto space-y-0.5 text-[11px] leading-relaxed text-zinc-500">
        {hits.length > 0 ? (
          hits.map((hit, index) => (
            <li key={`${hit.player}-${index}`} className="font-mono">
              {short(hit.player)} &nbsp;-{hit.damage}
            </li>
          ))
        ) : (
          <li>No hits yet this season.</li>
        )}
      </ul>
    </div>
  )

  return (
    <PhaserGame
      scene={RaidScene}
      overlay={overlay}
      {...(onReady ? { onReady: () => onReady() } : {})}
    />
  )
}
