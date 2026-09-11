// Phaser ships no ESM default export, so it is imported as a namespace.
import * as Phaser from "phaser"

import { EventBus, GameEvents, HeroStatePayload } from "../EventBus"
import { heroFrame } from "../heroSprite"

const TILE = 16

/**
 * Frame 49 is sandy floor with visible grit. Frame 40, which this used, is a grey brick *wall*, and
 * tiling it across the bottom half of the canvas made the hero look like they were standing in
 * front of a wall. Frame 48 is the same floor without the grit, which at low opacity reads as a
 * plain brown bar. Verified against a labelled contact sheet of the tilemap.
 */
const FLOOR_FRAME = 49

/**
 * How much of the canvas's height the dirt floor takes, as a fraction.
 *
 * Exported because the DOM overlay has to keep clear of it: the stat line and the XP bar used to
 * land on top of the dirt, and the XP label was unreadable against it. A shared constant means
 * moving the floor moves the text with it, instead of leaving a magic number behind in the layout.
 */
export const HERO_FLOOR_FRACTION = (TILE * 3) / 360

/**
 * The hero card, pixels only.
 *
 * Every label, the XP bar and the mint button used to be Phaser objects and are now DOM, drawn
 * over this canvas by HeroCanvas. The canvas is 640x360 scaled up to whatever the page gives it,
 * with `pixelArt: true` turning off smoothing, which is exactly right for a 16x16 sprite and
 * exactly wrong for a glyph. What is left here is the art: the floor, the hero, and the idle bob.
 *
 * Renders whatever React hands it and nothing else. There is no fetch here and no wallet.
 */
export class HeroScene extends Phaser.Scene {
  private state?: HeroStatePayload
  private sprite?: Phaser.GameObjects.Image
  private idleTween?: Phaser.Tweens.Tween

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

    this.idleTween?.remove()
    this.idleTween = undefined
    this.sprite?.destroy()
    this.sprite = undefined

    // No hero is an empty stage. The copy explaining that, and the mint button, are DOM.
    if (!state.hasHero) return

    // The sprite is chosen by dominant affinity, which is itself a record of what the player did.
    // A hero with no stats has done nothing yet, so it is a novice rather than a warrior by
    // default: an armoured knight for somebody who has never made a transaction is a claim the
    // chain does not support.
    // Upper-middle rather than centred. The overlay's stat line and XP bar live in the lower third,
    // and at phone width the canvas is only about 195px tall, so a centred sprite sat directly
    // behind the text. Placed by fraction so it holds at every rendered size.
    this.sprite = this.add
      .image(width / 2, height * 0.36, "dungeon-tiles", heroFrame(state.affinity))
      .setScale(4)

    // A gentle breathing bob so the hero reads as alive rather than as a screenshot.
    // Yoyo rather than a loop back to the start, so there is no jump at the seam.
    this.idleTween = this.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 6,
      duration: 1400,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    })
  }
}
