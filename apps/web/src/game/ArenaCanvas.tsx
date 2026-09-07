"use client"

import { useEffect, useState } from "react"

import { ArenaFramePayload, ArenaHitPayload, EventBus, GameEvents } from "./EventBus"
import { ArenaReplayScene } from "./scenes/ArenaReplayScene"
import PhaserGame from "./PhaserGame"

/** How long a floating damage number stays on screen. Matches the fade in globals.css. */
const HIT_MS = 700

const EMPTY: ArenaFramePayload = { status: "No duel selected", hint: true, fighters: [] }

/**
 * Client-only wrapper for the arena replay canvas.
 *
 * The scene imports Phaser, which touches `window` at import time, so the page loads this through
 * `next/dynamic` rather than importing the scene itself.
 *
 * The scene owns the replay's timing, because it owns the tweens and the camera shake. It owns none
 * of the glyphs: it emits what the numbers are and this draws them as DOM, so the fighters' names,
 * their HP and the damage that lands are sharp at any device pixel ratio.
 */
export default function ArenaCanvas({ onReady }: { onReady?: () => void }) {
  const [frame, setFrame] = useState<ArenaFramePayload>(EMPTY)
  const [hits, setHits] = useState<ArenaHitPayload[]>([])

  useEffect(() => {
    const onFrame = (next: ArenaFramePayload) => setFrame(next)
    const onHit = (hit: ArenaHitPayload) => {
      setHits((current) => [...current, hit])
      // Each number removes itself. Keying by id means two hits in the same tick do not collide.
      setTimeout(() => setHits((current) => current.filter((entry) => entry.id !== hit.id)), HIT_MS)
    }
    EventBus.on(GameEvents.ArenaFrame, onFrame as never)
    EventBus.on(GameEvents.ArenaHit, onHit as never)
    return () => {
      EventBus.off(GameEvents.ArenaFrame, onFrame as never)
      EventBus.off(GameEvents.ArenaHit, onHit as never)
    }
  }, [])

  // The fighters stand at 28% and 72% of the canvas width, so their labels and bars line up there.
  const SLOT_X = ["28%", "72%"]

  const overlay = (
    <div className="relative h-full w-full">
      <p className="absolute inset-x-0 top-3 px-4 text-center text-xs text-zinc-400 sm:text-[13px]">
        {frame.status}
      </p>

      {frame.hint && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-zinc-600">
          Pick a finished duel below to watch it replay
        </p>
      )}

      {frame.fighters.map((fighter, slot) => {
        const ratio = fighter.maxHp > 0 ? Math.max(0, Math.min(1, fighter.hp / fighter.maxHp)) : 0
        return (
          <div
            key={`${fighter.name}-${slot}`}
            className="absolute -translate-x-1/2"
            style={{ left: SLOT_X[slot], top: "13%", width: "34%" }}
          >
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1A1A1A]">
              <div
                className={`h-full transition-[width] duration-200 ${slot === 0 ? "bg-blue-400" : "bg-red-400"}`}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            <p className="mt-1 text-center font-mono text-[11px] text-zinc-500">{fighter.name}</p>
          </div>
        )
      })}

      {hits.map((hit) => (
        <span
          key={hit.id}
          className={`arena-hit absolute -translate-x-1/2 font-mono font-semibold ${
            hit.crit ? "text-lg text-amber-400" : "text-sm text-zinc-100"
          }`}
          style={{ left: SLOT_X[hit.slot], top: "34%" }}
        >
          {hit.crit ? "CRIT " : ""}
          {hit.damage}
        </span>
      ))}
    </div>
  )

  return (
    <PhaserGame
      scene={ArenaReplayScene}
      overlay={overlay}
      {...(onReady ? { onReady: () => onReady() } : {})}
    />
  )
}
