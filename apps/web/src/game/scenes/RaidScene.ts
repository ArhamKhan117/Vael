// Phaser ships no ESM default export, so it is imported as a namespace.
import * as Phaser from "phaser"

import { EventBus, GameEvents, RaidStatePayload } from "../EventBus"

/**
 * The boss, its HP, and the damage feed.
 *
 * The HP bar is whatever the chain says it is. Nothing here simulates a fight: every point of
 * damage on screen already happened, as a real DeFi action someone proved.
 */
export class RaidScene extends Phaser.Scene {
  private state?: RaidStatePayload
  private boss?: Phaser.GameObjects.Image
  private hpBar?: Phaser.GameObjects.Graphics
  private hpLabel?: Phaser.GameObjects.Text
  private feed?: Phaser.GameObjects.Text
  private title?: Phaser.GameObjects.Text

  constructor() {
    super("RaidScene")
  }

  preload() {
    this.load.atlasXML(
      "monsters",
      "/game/kenney-monster-builder/spritesheet_default.png",
      "/game/kenney-monster-builder/spritesheet_default.xml"
    )
  }

  create() {
    const { width, height } = this.scale
    this.add.rectangle(0, 0, width, height, 0x07070a).setOrigin(0)

    this.title = this.add
      .text(width / 2, 20, "", { fontFamily: "monospace", fontSize: "14px", color: "#ffffff" })
      .setOrigin(0.5)

    this.hpBar = this.add.graphics()
    this.hpLabel = this.add
      .text(width / 2, 62, "", { fontFamily: "monospace", fontSize: "11px", color: "#a1a1aa" })
      .setOrigin(0.5)

    this.feed = this.add.text(16, height - 120, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#71717a",
      lineSpacing: 3,
    })

    EventBus.on(GameEvents.RaidState, this.onRaidState, this)
    EventBus.emit(GameEvents.SceneReady, "RaidScene")
    this.events.once("shutdown", () => EventBus.off(GameEvents.RaidState, this.onRaidState))
  }

  private onRaidState(state: RaidStatePayload) {
    const previous = this.state
    this.state = state
    this.render()
    // A visible reaction only when the chain actually says the boss took a hit.
    if (previous && state.hp < previous.hp) this.flinch()
  }

  private render() {
    const state = this.state
    if (!state) return
    const { width } = this.scale

    if (!this.boss) {
      this.boss = this.add.image(width / 2, 190, "monsters", "body_redE.png").setScale(1.4)
    }

    this.title?.setText(
      state.defeated ? `Season ${state.seasonId} — defeated` : `Season ${state.seasonId}`
    )

    const barWidth = Math.min(360, width - 48)
    const barX = (width - barWidth) / 2
    const ratio = state.maxHp > 0 ? Math.max(0, state.hp / state.maxHp) : 0

    this.hpBar?.clear()
    this.hpBar?.fillStyle(0x1a1a1a).fillRect(barX, 44, barWidth, 10)
    this.hpBar?.fillStyle(state.defeated ? 0x52525b : 0xef4444).fillRect(barX, 44, barWidth * ratio, 10)
    this.hpLabel?.setText(`${state.hp} / ${state.maxHp} HP`)

    this.boss?.setAlpha(state.defeated ? 0.35 : 1)

    const lines = state.recentHits
      .slice(0, 8)
      .map((hit) => `${hit.player.slice(0, 6)}…${hit.player.slice(-4)}  -${hit.damage}`)
    this.feed?.setText(lines.length > 0 ? lines.join("\n") : "No hits yet this season.")
  }

  private flinch() {
    if (!this.boss) return
    this.tweens.add({
      targets: this.boss,
      x: this.boss.x + 6,
      duration: 60,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.boss?.setX(this.scale.width / 2),
    })
  }
}
