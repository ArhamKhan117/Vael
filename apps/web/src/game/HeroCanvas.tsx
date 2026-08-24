"use client"

import { HeroScene } from "./scenes/HeroScene"
import PhaserGame from "./PhaserGame"

/**
 * Client-only wrapper for the hero canvas.
 *
 * The scene class itself imports Phaser, which touches `window` at import time, so the page must
 * load *this* through `next/dynamic` rather than only the game component. Importing a scene at
 * module scope from a page is enough to break prerendering.
 */
export default function HeroCanvas({ onReady }: { onReady?: () => void }) {
  return <PhaserGame scene={HeroScene} {...(onReady ? { onReady: () => onReady() } : {})} />
}
