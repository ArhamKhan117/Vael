"use client"

import { useEffect, useRef } from "react"
// Phaser ships no ESM default export, so it is imported as a namespace.
import * as Phaser from "phaser"

import { EventBus, GameEvents } from "./EventBus"

interface PhaserGameProps {
  scene: Phaser.Types.Scenes.SceneType
  width?: number
  height?: number
  onReady?: (sceneKey: string) => void
}

/**
 * Mounts a Phaser game inside React.
 *
 * Loaded through `next/dynamic` with `ssr: false` by every caller, because Phaser reaches for
 * `window` at import time. The game is created once and destroyed on unmount; React never reaches
 * into a scene directly, it only speaks through the EventBus.
 */
export default function PhaserGame({ scene, width = 640, height = 360, onReady }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width,
      height,
      backgroundColor: "#07070a",
      // Pixel art, scaled to fit whatever the page gives us.
      pixelArt: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
    })

    const handleReady = (key: string) => onReady?.(key)
    EventBus.on(GameEvents.SceneReady, handleReady)

    return () => {
      EventBus.off(GameEvents.SceneReady, handleReady)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [scene, width, height, onReady])

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded border border-[#1A1A1A] bg-black"
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  )
}
