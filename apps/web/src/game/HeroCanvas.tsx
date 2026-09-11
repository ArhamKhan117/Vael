"use client"

import { HeroStatePayload } from "./EventBus"
import { affinityLabel } from "./heroSprite"
import { HERO_FLOOR_FRACTION, HeroScene } from "./scenes/HeroScene"
import PhaserGame from "./PhaserGame"

/**
 * Client-only wrapper for the hero canvas.
 *
 * The scene class itself imports Phaser, which touches `window` at import time, so the page must
 * load *this* through `next/dynamic` rather than only the game component. Importing a scene at
 * module scope from a page is enough to break prerendering.
 *
 * Everything readable is DOM here rather than Phaser text. The canvas is a fixed 640x360 scaled up
 * to the page with smoothing off, which is right for a 16x16 sprite and turns a glyph to mush; the
 * browser draws DOM at the device's real pixel ratio, so these labels are sharp on a 1x monitor and
 * on a 2x phone alike. Mint is a real `<button>`, which also means it is reachable by keyboard.
 */
export default function HeroCanvas({
  state,
  onReady,
  onMint,
  minting = false,
}: {
  state: HeroStatePayload
  onReady?: () => void
  onMint?: () => void
  minting?: boolean
}) {
  const ratio = state.xpToNext > 0 ? Math.min(1, state.xp / state.xpToNext) : 0

  const overlay = (
    // The bottom padding clears the dirt floor the scene paints, so nothing readable lands on it.
    <div
      className="flex h-full flex-col justify-between p-4 text-center"
      style={{ paddingBottom: `calc(${(HERO_FLOOR_FRACTION * 100).toFixed(2)}% + 0.75rem)` }}
    >
      <p className="text-sm font-semibold text-white sm:text-lg">
        {state.hasHero ? `Level ${state.level}  ${affinityLabel(state.affinity)}` : "No hero yet"}
      </p>

      {!state.hasHero && (
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-xs text-xs leading-relaxed text-zinc-400">
            {state.readOnly
              ? "This address has not minted a hero."
              : "Mint one. It is free, soul-bound, and one per wallet."}
          </p>
          {!state.readOnly && (
            <button
              type="button"
              onClick={onMint}
              disabled={minting}
              className="pointer-events-auto rounded bg-white px-6 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              {minting ? "Confirm in your wallet…" : "Mint hero"}
            </button>
          )}
        </div>
      )}

      {state.hasHero ? (
        <div className="space-y-2">
          {/* Smaller on a phone: the canvas is a sixteen by nine box, so at 390px wide it is under
              200px tall and desktop type would fill it. */}
          <p className="text-[10px] text-zinc-400 sm:text-sm">
            STR {state.strength} &nbsp; AGI {state.agility} &nbsp; INT {state.intellect} &nbsp;
            streak {state.streak}
          </p>
          <div className="mx-auto w-full max-w-xs">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[#1A1A1A]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={state.xpToNext}
              aria-valuenow={state.xp}
              aria-label="Experience toward the next level"
            >
              <div className="h-full bg-sky-400 transition-[width]" style={{ width: `${ratio * 100}%` }} />
            </div>
            <p className="mt-1 text-[9px] text-zinc-500 sm:mt-1.5 sm:text-[11px]">
              {state.xp} / {state.xpToNext} XP
            </p>
          </div>
        </div>
      ) : (
        <div />
      )}
    </div>
  )

  return (
    <PhaserGame
      scene={HeroScene}
      overlay={overlay}
      {...(onReady ? { onReady: () => onReady() } : {})}
    />
  )
}
