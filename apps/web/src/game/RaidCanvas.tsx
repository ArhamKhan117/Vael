"use client"

import { RaidScene } from "./scenes/RaidScene"
import PhaserGame from "./PhaserGame"

/** Client-only wrapper for the raid canvas. See HeroCanvas for why this indirection exists. */
export default function RaidCanvas({ onReady }: { onReady?: () => void }) {
  return <PhaserGame scene={RaidScene} {...(onReady ? { onReady: () => onReady() } : {})} />
}
