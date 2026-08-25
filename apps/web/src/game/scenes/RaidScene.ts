// Phaser ships no ESM default export, so it is imported as a namespace.
import * as Phaser from "phaser"

import { EventBus, GameEvents, RaidStatePayload } from "../EventBus"

/** Part families available in the Kenney Monster Builder atlas. */
const COLOURS = ["red", "green", "blue", "yellow", "dark", "white"] as const
const BODY_LETTERS = ["A", "B", "C", "D", "E", "F"] as const
const ARM_LETTERS = ["A", "B", "C", "D", "E"] as const
const MOUTHS = ["mouthA", "mouthB", "mouthC", "mouthF", "mouthG", "mouth_closed_fangs"] as const
const EYES = ["eye_angry_red", "eye_angry_green", "eye_psycho_light", "eye_red", "eye_yellow"] as const
const CROWNS = ["horn_large", "horn_small", "ear", "ear_round", "antenna_large"] as const

/** How tall the assembled boss should stand in the 640x360 logical canvas. */
const TARGET_HEIGHT = 220

/**
 * Deterministic per-season shuffle.
 *
 * Season 1 and season 2 must look like different monsters, and the same season must look identical
 * to everyone. A hash of the season id gives both without storing anything.
 */
function pick<T>(list: readonly T[], seasonId: number, salt: number): T {
  let h = (seasonId + 1) * 2654435761 + salt * 40503
  h ^= h >>> 13
  h = Math.abs(h)
  return list[h % list.length] as T
}

/**
 * The boss, its HP, and the damage feed.
 *
 * The boss is assembled from Monster Builder parts rather than drawn as one sprite: a lone
 * `body_redE` is 132x250 px, which at any readable scale is a capsule filling the canvas. Parts are
 * chosen from the season id, so each season is visibly a different creature.
 *
 * Nothing here simulates a fight. Every point of damage on screen already happened, as a real DeFi
 * action somebody proved.
 */
export class RaidScene extends Phaser.Scene {
  private state?: RaidStatePayload
  private boss?: Phaser.GameObjects.Container
  private bodyImage?: Phaser.GameObjects.Image
  private builtForSeason = -1
  private hpBar?: Phaser.GameObjects.Graphics
  private hpLabel?: Phaser.GameObjects.Text
  private feed?: Phaser.GameObjects.Text
  private title?: Phaser.GameObjects.Text
  private idleTween?: Phaser.Tweens.Tween

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
      .text(width / 2, 18, "", { fontFamily: "monospace", fontSize: "14px", color: "#ffffff" })
      .setOrigin(0.5)

    this.hpBar = this.add.graphics()
    this.hpLabel = this.add
      .text(width / 2, 58, "", { fontFamily: "monospace", fontSize: "11px", color: "#a1a1aa" })
      .setOrigin(0.5)

    this.feed = this.add.text(12, height - 96, "", {
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

    // React only to what the chain actually reported, never to a local guess.
    if (previous && state.hp < previous.hp) this.hitFlash()
    if (previous && !previous.defeated && state.defeated) this.collapse()
  }

  /** Assemble the monster from parts, sized so the whole figure is TARGET_HEIGHT tall. */
  private buildBoss(seasonId: number) {
    this.boss?.destroy()
    this.idleTween?.remove()

    const { width } = this.scale
    const colour = pick(COLOURS, seasonId, 1)
    const bodyFrame = `body_${colour}${pick(BODY_LETTERS, seasonId, 2)}.png`
    const armFrame = `arm_${colour}${pick(ARM_LETTERS, seasonId, 3)}.png`
    const crownFrame = `detail_${colour}_${pick(CROWNS, seasonId, 4)}.png`
    const eyeFrame = `${pick(EYES, seasonId, 5)}.png`
    const mouthFrame = `${pick(MOUTHS, seasonId, 6)}.png`

    const container = this.add.container(width / 2, 210)
    const body = this.add.image(0, 0, "monsters", bodyFrame).setOrigin(0.5)
    const bodyHeight = body.height || 1
    const bodyWidth = body.width || 1

    // Arms behind the body so they read as limbs rather than stickers.
    const armLeft = this.add.image(-bodyWidth * 0.42, bodyHeight * 0.05, "monsters", armFrame).setOrigin(0.5)
    const armRight = this.add.image(bodyWidth * 0.42, bodyHeight * 0.05, "monsters", armFrame).setOrigin(0.5)
    armRight.setFlipX(true)

    const crownLeft = this.add.image(-bodyWidth * 0.22, -bodyHeight * 0.46, "monsters", crownFrame).setOrigin(0.5)
    const crownRight = this.add.image(bodyWidth * 0.22, -bodyHeight * 0.46, "monsters", crownFrame).setOrigin(0.5)
    crownRight.setFlipX(true)

    const eyeLeft = this.add.image(-bodyWidth * 0.16, -bodyHeight * 0.12, "monsters", eyeFrame).setOrigin(0.5)
    const eyeRight = this.add.image(bodyWidth * 0.16, -bodyHeight * 0.12, "monsters", eyeFrame).setOrigin(0.5)
    eyeRight.setFlipX(true)

    const mouth = this.add.image(0, bodyHeight * 0.1, "monsters", mouthFrame).setOrigin(0.5)

    container.add([crownLeft, crownRight, armLeft, armRight, body, eyeLeft, eyeRight, mouth])

    // Scale from the body's real height, which varies from 141 to 250 px across the atlas, so
    // every season's monster ends up the same size on screen.
    container.setScale(TARGET_HEIGHT / bodyHeight)

    this.boss = container
    this.bodyImage = body
    this.builtForSeason = seasonId

    this.idleTween = this.tweens.add({
      targets: container,
      y: container.y - 6,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    })
  }

  private render() {
    const state = this.state
    if (!state) return
    const { width } = this.scale

    if (state.seasonId > 0 && this.builtForSeason !== state.seasonId) {
      this.buildBoss(state.seasonId)
    }

    this.title?.setText(
      state.seasonId === 0
        ? "No season yet"
        : state.defeated
          ? `Season ${state.seasonId} — defeated`
          : `Season ${state.seasonId}`
    )

    const barWidth = Math.min(360, width - 48)
    const barX = (width - barWidth) / 2
    const ratio = state.maxHp > 0 ? Math.max(0, state.hp / state.maxHp) : 0

    this.hpBar?.clear()
    this.hpBar?.fillStyle(0x1a1a1a).fillRect(barX, 42, barWidth, 10)
    if (state.maxHp > 0) {
      this.hpBar?.fillStyle(state.defeated ? 0x52525b : 0xef4444).fillRect(barX, 42, barWidth * ratio, 10)
    }
    this.hpLabel?.setText(state.maxHp > 0 ? `${state.hp} / ${state.maxHp} HP` : "")

    if (state.defeated && this.boss) {
      this.boss.setAlpha(0.4)
      this.boss.setAngle(12)
      this.idleTween?.remove()
    }

    const lines = state.recentHits
      .slice(0, 7)
      .map((hit) => `${hit.player.slice(0, 6)}…${hit.player.slice(-4)}  -${hit.damage}`)
    this.feed?.setText(lines.length > 0 ? lines.join("\n") : "No hits yet this season.")
  }

  /** A short white flash and shake when the chain reports the boss took a hit. */
  private hitFlash() {
    if (!this.boss || !this.bodyImage) return
    const body = this.bodyImage
    body.setTintFill(0xffffff)
    this.time.delayedCall(90, () => body.clearTint())

    const home = this.scale.width / 2
    this.tweens.add({
      targets: this.boss,
      x: home + 8,
      duration: 55,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.boss?.setX(home),
    })
  }

  /** Topple over when HP reaches zero. */
  private collapse() {
    if (!this.boss) return
    this.idleTween?.remove()
    this.tweens.add({
      targets: this.boss,
      angle: 12,
      y: this.boss.y + 18,
      alpha: 0.4,
      duration: 900,
      ease: "Bounce.easeOut",
    })
  }
}
