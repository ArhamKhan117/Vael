/**
 * The single channel between React and Phaser.
 *
 * React owns the wallet, the data, and every write to the chain. Phaser owns pixels and nothing
 * else: it never fetches, never signs, and never decides an outcome. Anything a scene needs
 * arrives as an event on this bus, and anything a scene wants done goes back the same way.
 *
 * This is the official Phaser Next.js template pattern, and the separation is not just tidiness:
 * game truth lives on Creditcoin, so a renderer that could decide things would be a second,
 * untrustworthy source of it.
 */
type Handler = (...args: never[]) => void

/**
 * A tiny emitter rather than Phaser's.
 *
 * Deliberately Phaser-free: this module is imported by pages that render on the server, and
 * Phaser touches `window` at import time. Reaching for `Phaser.Events.EventEmitter` here breaks
 * the build during static generation, which is exactly what it did the first time.
 */
class TinyEmitter {
  private readonly listeners = new Map<string, Set<Handler>>()

  on(event: string, handler: Handler, context?: unknown): this {
    const bound = (context ? handler.bind(context) : handler) as Handler
    // Remember the original and the context so `off` can find this exact subscription again.
    boundOriginals.set(bound, { handler, context })
    const set = this.listeners.get(event) ?? new Set<Handler>()
    set.add(bound)
    this.listeners.set(event, set)
    return this
  }

  /**
   * Remove a subscription.
   *
   * The context matters. Two Phaser scenes of the same class register the *same* prototype method,
   * so matching on the function alone made one scene's teardown unsubscribe the other's, and a
   * live canvas silently stopped receiving state. Pass the same context that `on` was given.
   */
  off(event: string, handler?: Handler, context?: unknown): this {
    const set = this.listeners.get(event)
    if (!set) return this
    if (!handler) {
      this.listeners.delete(event)
      return this
    }
    for (const registered of set) {
      if (registered === handler) {
        set.delete(registered)
        continue
      }
      const origin = boundOriginals.get(registered)
      if (!origin || origin.handler !== handler) continue
      if (context === undefined || origin.context === context) set.delete(registered)
    }
    return this
  }

  emit(event: string, ...args: unknown[]): boolean {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return false
    for (const handler of [...set]) (handler as (...a: unknown[]) => void)(...args)
    return true
  }
}

const boundOriginals = new WeakMap<Handler, { handler: Handler; context?: unknown }>()

export const EventBus = new TinyEmitter()

export const GameEvents = {
  /** Phaser to React: a scene is mounted and ready for data. */
  SceneReady: "scene-ready",
  /** React to Phaser: new hero state. */
  HeroState: "hero-state",
  /** React to Phaser: new raid state. */
  RaidState: "raid-state",
  // There is deliberately no "Phaser asked React to sign" event any more. Every control that needs
  // a wallet is a real DOM button in the overlay, which is crisper, reachable by keyboard, and one
  // fewer indirection between a click and a signature.
  /** React to Phaser: a duel to replay, or null to clear the canvas. */
  ArenaReplay: "arena-replay",
  /**
   * Phaser to React: the replay's readable state, so the DOM overlay can draw it.
   *
   * The scene owns the timing of a replay, because it owns the tweens and the camera shake, but
   * every glyph belongs in DOM. So the scene says what the numbers are and React draws them.
   */
  ArenaFrame: "arena-frame",
  /** Phaser to React: one landed hit, to float above the fighter that took it. */
  ArenaHit: "arena-hit",
} as const

import type { Affinity } from "./heroSprite"

export type { Affinity } from "./heroSprite"
export { AFFINITY_LABELS } from "./heroSprite"

/** One swing, decoded from the three bytes the chain emitted for it. */
export interface ArenaSwing {
  /** 0 is the challenger, 1 the opponent. */
  attacker: 0 | 1
  crit: boolean
  damage: number
}

export interface ArenaReplayPayload {
  challengeId: number
  challenger: { address: string; affinity: Affinity; hp: number }
  opponent: { address: string; affinity: Affinity; hp: number }
  swings: ArenaSwing[]
  /** Empty for a draw. */
  winner: string
}

/** Everything readable about a replay in progress. Drawn as DOM over the canvas. */
export interface ArenaFramePayload {
  status: string
  /** True before a duel is picked, when the canvas is an empty arena. */
  hint: boolean
  fighters: { name: string; hp: number; maxHp: number }[]
}

/** One landed hit, floated above the fighter that took it and then forgotten. */
export interface ArenaHitPayload {
  /** 0 is the challenger, 1 the opponent. The one that *took* the hit. */
  slot: 0 | 1
  damage: number
  crit: boolean
  /** Unique per hit, so React can key a list of them without two colliding. */
  id: number
}

export interface HeroStatePayload {
  hasHero: boolean
  level: number
  xp: number
  xpToNext: number
  strength: number
  agility: number
  intellect: number
  streak: number
  affinity: Affinity
  /** True when the page is showing somebody else's hero, so the overlay offers no mint button. */
  readOnly: boolean
}

export interface RaidStatePayload {
  seasonId: number
  hp: number
  maxHp: number
  defeated: boolean
  recentHits: { player: string; damage: string }[]
}
