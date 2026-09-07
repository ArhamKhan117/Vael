import * as Phaser from "phaser"

import { ArenaReplayPayload, EventBus, GameEvents } from "../EventBus"

const TILE = 16

/**
 * Verified by eye against a labelled contact sheet of the whole tilemap, the same frames HeroScene
 * uses. Guessing these is how they were wrong for a whole phase.
 */
const AFFINITY_FRAMES = {
  novice: 85, // an unarmoured villager, for a hero that has yet to prove anything
  warrior: 96,
  rogue: 112,
  mage: 84,
} as const

/** Sandy floor with grit. Frame 40 is a wall and 48 is featureless; see HeroScene. */
const FLOOR_FRAME = 49
const SWING_MS = 620

/**
 * Replays a duel from the round log the chain emitted.
 *
 * The scene decides nothing. It is handed the swings QuestASC's sibling contract already recorded
 * on Creditcoin, in order, and animates them; the winner, the damage, and the crits were all
 * settled by `Arena.resolve` before this canvas ever saw them. Nothing here can show a fight that
 * did not happen, which is the only reason a replay is worth watching.
 */
export class ArenaReplayScene extends Phaser.Scene {
  private replay?: ArenaReplayPayload
  private fighters: (Phaser.GameObjects.Image | undefined)[] = []
  private hp: number[] = [0, 0]
  private maxHp: number[] = [1, 1]
  private names: string[] = ["", ""]
  private timer?: Phaser.Time.TimerEvent
  private step = 0
  private hitId = 0

  constructor() {
    super("ArenaReplayScene")
  }

  preload() {
    this.load.spritesheet("dungeon-tiles", "/game/kenney-tiny-dungeon/tilemap_packed.png", {
      frameWidth: TILE,
      frameHeight: TILE,
    })
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor("#0b0b0f")

    for (let x = 0; x < width + TILE * 3; x += TILE * 3) {
      this.add
        .image(x, height - TILE * 3, "dungeon-tiles", FLOOR_FRAME)
        .setOrigin(0)
        .setScale(3)
        .setAlpha(0.5)
    }

    EventBus.on(GameEvents.ArenaReplay, this.onReplay, this)
    this.events.once("shutdown", () => {
      EventBus.off(GameEvents.ArenaReplay, this.onReplay, this)
      this.timer?.remove()
    })
    EventBus.emit(GameEvents.SceneReady, "ArenaReplayScene")
  }

  private onReplay(payload: ArenaReplayPayload | null) {
    // See HeroScene: a scene mid-teardown can still receive one last event.
    if (!this.sys?.displayList) return
    this.timer?.remove()
    this.step = 0
    this.replay = payload ?? undefined

    this.fighters.forEach((f) => f?.destroy())
    this.fighters = []

    if (!payload) {
      this.emitFrame("No duel selected", true)
      return
    }

    const { width, height } = this.scale
    const sides = [payload.challenger, payload.opponent]
    this.hp = [payload.challenger.hp, payload.opponent.hp]
    this.maxHp = [payload.challenger.hp || 1, payload.opponent.hp || 1]

    sides.forEach((side, slot) => {
      const x = slot === 0 ? width * 0.28 : width * 0.72
      const sprite = this.add
        .image(x, height / 2, "dungeon-tiles", AFFINITY_FRAMES[side.affinity])
        .setScale(5)
      if (slot === 1) sprite.setFlipX(true)
      this.fighters[slot] = sprite
    })

    this.names = [short(payload.challenger.address), short(payload.opponent.address)]

    if (payload.swings.length === 0) {
      this.emitFrame(`Duel #${payload.challengeId}: neither fighter could land a hit`)
      return
    }
    this.emitFrame(`Duel #${payload.challengeId}`)

    this.timer = this.time.addEvent({
      delay: SWING_MS,
      repeat: payload.swings.length - 1,
      callback: () => this.playSwing(),
    })
  }

  private playSwing() {
    const payload = this.replay
    const swing = payload?.swings[this.step]
    if (!payload || !swing) return
    this.step += 1

    const attacker = swing.attacker
    const defender = attacker === 0 ? 1 : 0
    const attackerSprite = this.fighters[attacker]
    const defenderSprite = this.fighters[defender]
    if (!attackerSprite || !defenderSprite) return

    const lunge = attacker === 0 ? 26 : -26
    this.tweens.add({
      targets: attackerSprite,
      x: attackerSprite.x + lunge,
      duration: SWING_MS * 0.28,
      yoyo: true,
      ease: "Quad.easeOut",
    })

    this.hp[defender] = Math.max(0, this.hp[defender]! - swing.damage)

    defenderSprite.setTintFill(swing.crit ? 0xffdd55 : 0xffffff)
    this.time.delayedCall(110, () => defenderSprite.clearTint())
    this.cameras.main.shake(swing.crit ? 160 : 80, swing.crit ? 0.006 : 0.003)

    // The damage number is DOM. It floats and fades in CSS over the fighter that took it.
    this.hitId += 1
    EventBus.emit(GameEvents.ArenaHit, {
      slot: defender as 0 | 1,
      damage: swing.damage,
      crit: swing.crit,
      id: this.hitId,
    })
    this.emitFrame(`Duel #${payload.challengeId}`)

    if (this.hp[defender] === 0) {
      this.timer?.remove()
      this.tweens.add({
        targets: defenderSprite,
        angle: attacker === 0 ? 80 : -80,
        y: defenderSprite.y + 20,
        duration: 420,
        ease: "Bounce.easeOut",
      })
      const winner = payload.winner
      this.emitFrame(
        winner ? `Duel #${payload.challengeId}: ${short(winner)} wins` : `Duel #${payload.challengeId}`
      )
      return
    }

    if (this.step >= payload.swings.length) {
      this.emitFrame(
        payload.winner
          ? `Duel #${payload.challengeId}: ${short(payload.winner)} wins`
          : `Duel #${payload.challengeId}: a draw after twenty rounds`
      )
    }
  }

  /** Hand the overlay everything readable. The scene keeps the pixels and none of the glyphs. */
  private emitFrame(status: string, hint = false) {
    EventBus.emit(GameEvents.ArenaFrame, {
      status,
      hint,
      fighters: hint
        ? []
        : [0, 1].map((slot) => ({
            name: this.names[slot] ?? "",
            hp: this.hp[slot] ?? 0,
            maxHp: this.maxHp[slot] ?? 1,
          })),
    })
  }
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
