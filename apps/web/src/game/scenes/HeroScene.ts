// Phaser ships no ESM default export, so it is imported as a namespace.
import * as Phaser from "phaser"

import { EventBus, GameEvents, HeroStatePayload } from "../EventBus"

/**
 * The hero card.
 *
 * Renders whatever React hands it and nothing else. There is no fetch here and no wallet: the mint
 * button emits a request and React decides what to do about it.
 */
export class HeroScene extends Phaser.Scene {
  private state?: HeroStatePayload
  private sprite?: Phaser.GameObjects.Image
  private levelText?: Phaser.GameObjects.Text
  private statsText?: Phaser.GameObjects.Text
  private xpBar?: Phaser.GameObjects.Graphics
  private xpLabel?: Phaser.GameObjects.Text
  private mintButton?: Phaser.GameObjects.Container

  constructor() {
    super("HeroScene")
  }

  preload() {
    this.load.image("dungeon-tiles", "/game/kenney-tiny-dungeon/tilemap_packed.png")
  }

  create() {
    const { width, height } = this.scale

    this.add.rectangle(0, 0, width, height, 0x07070a).setOrigin(0)
    this.drawFloor()

    this.levelText = this.add
      .text(width / 2, 24, "", { fontFamily: "monospace", fontSize: "18px", color: "#ffffff" })
      .setOrigin(0.5)

    this.statsText = this.add
      .text(width / 2, height - 52, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#a1a1aa",
        align: "center",
      })
      .setOrigin(0.5)

    this.xpBar = this.add.graphics()
    this.xpLabel = this.add
      .text(width / 2, height - 20, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#71717a",
      })
      .setOrigin(0.5)

    EventBus.on(GameEvents.HeroState, this.onHeroState, this)
    EventBus.emit(GameEvents.SceneReady, "HeroScene")

    this.events.once("shutdown", () => EventBus.off(GameEvents.HeroState, this.onHeroState))
  }

  /** A simple tiled floor from the Kenney sheet, so the hero has somewhere to stand. */
  private drawFloor() {
    const { width, height } = this.scale
    const tile = 16
    const scale = 2
    for (let x = 0; x < width; x += tile * scale) {
      for (let y = height / 2; y < height; y += tile * scale) {
        this.add
          .image(x, y, "dungeon-tiles")
          .setOrigin(0)
          .setScale(scale)
          .setCrop(0, 0, tile, tile)
          .setAlpha(0.25)
      }
    }
  }

  private onHeroState(state: HeroStatePayload) {
    this.state = state
    this.render()
  }

  private render() {
    const state = this.state
    if (!state) return
    const { width, height } = this.scale

    this.sprite?.destroy()
    this.mintButton?.destroy()
    this.xpBar?.clear()

    if (!state.hasHero) {
      this.levelText?.setText("No hero yet")
      this.statsText?.setText("Mint one. It is free, soul-bound, and one per wallet.")
      this.xpLabel?.setText("")
      this.mintButton = this.buildMintButton(width / 2, height / 2)
      return
    }

    // The sprite is chosen by dominant affinity, which is itself a record of what the player did.
    const frame = { warrior: 84, rogue: 85, mage: 88 }[state.affinity] ?? 84
    this.sprite = this.add
      .image(width / 2, height / 2 - 10, "dungeon-tiles")
      .setScale(4)
      .setCrop((frame % 12) * 16, Math.floor(frame / 12) * 16, 16, 16)

    this.levelText?.setText(`Level ${state.level}  ${state.affinity}`)
    this.statsText?.setText(
      `STR ${state.strength}   AGI ${state.agility}   INT ${state.intellect}   streak ${state.streak}`
    )

    const barWidth = Math.min(320, width - 64)
    const barX = (width - barWidth) / 2
    const barY = height - 36
    const ratio = state.xpToNext > 0 ? Math.min(1, state.xp / state.xpToNext) : 0

    this.xpBar?.fillStyle(0x1a1a1a).fillRect(barX, barY, barWidth, 8)
    this.xpBar?.fillStyle(0x38bdf8).fillRect(barX, barY, barWidth * ratio, 8)
    this.xpLabel?.setText(`${state.xp} / ${state.xpToNext} XP`)
  }

  private buildMintButton(x: number, y: number) {
    const container = this.add.container(x, y)
    const bg = this.add.rectangle(0, 0, 180, 40, 0xffffff).setInteractive({ useHandCursor: true })
    const label = this.add
      .text(0, 0, "Mint hero", { fontFamily: "monospace", fontSize: "14px", color: "#000000" })
      .setOrigin(0.5)
    container.add([bg, label])
    // The scene asks; React signs. Phaser never touches a wallet.
    bg.on("pointerup", () => EventBus.emit(GameEvents.RequestMintHero))
    return container
  }
}
