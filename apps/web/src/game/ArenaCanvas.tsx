"use client"

import { ArenaReplayScene } from "./scenes/ArenaReplayScene"
import PhaserGame from "./PhaserGame"

/**
 * Client-only wrapper for the arena replay canvas.
 *
 * The scene imports Phaser, which touches `window` at import time, so the page loads this through
 * `next/dynamic` rather than importing the scene itself.
 */
export default function ArenaCanvas({ onReady }: { onReady?: () => void }) {
  return <PhaserGame scene={ArenaReplayScene} {...(onReady ? { onReady: () => onReady() } : {})} />
}
