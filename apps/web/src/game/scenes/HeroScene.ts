// Phaser ships no ESM default export, so it is imported as a namespace.
import * as Phaser from "phaser"

import { EventBus, GameEvents, HeroStatePayload } from "../EventBus"

const TILE = 16

/**
 * Frames in `tilemap_packed.png`, a 12x11 grid of 16x16 tiles indexed row-major.
 *
 * These were checked by eye against a labelled contact sheet of all 132 tiles, because the first
 * guesses were all wrong in a way nothing would have caught: 84 is the wizard, not a warrior; 85 is
 * an unarmoured villager; 88 is a bare-chested barbarian. A hero page showing the wrong class for
 * everyone is the kind of bug that survives every test suite.
 */
const AFFINITY_FRAMES = {
  warrior: 96, // full plate, closed helm
  rogue: 112, // green hood and headband
  mage: 84, // purple robe, pointed hat, white beard
} as const

/** Plain stone floor tile. */
/**
 * Frame 49 is sandy floor with visible grit. Frame 40, which this used, is a grey brick *wall*, and
 * tiling it across the bottom half of the canvas made the hero look like they were standing in
 * front of a wall. Frame 48 is the same floor without the grit, which at low opacity reads as a
 * plain brown bar. Verified against a labelled contact sheet of the tilemap.
 */
const FLOOR_FRAME = 49

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
    // A spritesheet, not an image. `setCrop` on a plain image trims what is drawn but leaves the
    // object's size and origin those of the whole 192x176 sheet, so the sprite lands off-centre and
    // scaled wrong. Loading frames properly is the only way to address one 16x16 tile.
    this.load.spritesheet("dungeon-tiles", "/game/kenney-tiny-dungeon/tilemap_packed.png", {
      frameWidth: TILE,
      frameHeight: TILE,
    })
  }

  create() {
    const { width, height } = this.scale

    this.add.rectangle(0, 0, width, height, 0x07070a).setOrigin(0)
    this.drawFloor()

    this.levelText = this.add
      .text(width / 2, 24, "", { fontFamily: "monospace", fontSize: "18px", color: "#ffffff" })
      .setOrigin(0.5)

    this.statsText = this.add
      .text(width / 2, height - 100, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#a1a1aa",
        align: "center",
      })
      .setOrigin(0.5)

    this.xpBar = this.add.graphics()
    this.xpLabel = this.add
      .text(width / 2, height - 62, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#71717a",
      })
      .setOrigin(0.5)

    EventBus.on(GameEvents.HeroState, this.onHeroState, this)
    EventBus.emit(GameEvents.SceneReady, "HeroScene")

    this.events.once("shutdown", () => EventBus.off(GameEvents.HeroState, this.onHeroState, this))
  }

  /** One row of floor under the hero's feet, not a wall behind them. */
  private drawFloor() {
    const { width, height } = this.scale
    const scale = 3
    const top = height - TILE * scale
    for (let x = 0; x < width; x += TILE * scale) {
      this.add.image(x, top, "dungeon-tiles", FLOOR_FRAME).setOrigin(0).setScale(scale).setAlpha(0.55)
    }
  }

  private onHeroState(state: HeroStatePayload) {
    // A scene being torn down can still hold a subscription for a moment, and drawing into it
    // throws because Phaser has already dropped its display list. Test that directly rather
    // than asking `scene.isActive()`: the first state arrives during `create()`, when the
    // scene is CREATING rather than RUNNING, and isActive() would refuse the only render that
    // matters.
    if (!this.sys?.displayList) return
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
      this.xpLabel?.setText("")
      if (state.readOnly) {
        this.statsText?.setText("This address has not minted a hero.")
      } else {
        this.statsText?.setText("Mint one. It is free, soul-bound, and one per wallet.")
        this.mintButton = this.buildMintButton(width / 2, height / 2)
      }
      return
    }

    // The sprite is chosen by dominant affinity, which is itself a record of what the player did.
    this.sprite = this.add
      .image(width / 2, height / 2 - 10, "dungeon-tiles", AFFINITY_FRAMES[state.affinity])
      .setScale(4)

    this.levelText?.setText(`Level ${state.level}  ${state.affinity}`)
    this.statsText?.setText(
      `STR ${state.strength}   AGI ${state.agility}   INT ${state.intellect}   streak ${state.streak}`
    )

    const barWidth = Math.min(320, width - 64)
    const barX = (width - barWidth) / 2
    const barY = height - 82
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
