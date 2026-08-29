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
  /** Phaser to React: the player pressed something that needs a wallet. */
  RequestMintHero: "request-mint-hero",
  RequestClaimLoot: "request-claim-loot",
  /** React to Phaser: a duel to replay, or null to clear the canvas. */
  ArenaReplay: "arena-replay",
} as const

/** One swing, decoded from the three bytes the chain emitted for it. */
export interface ArenaSwing {
  /** 0 is the challenger, 1 the opponent. */
  attacker: 0 | 1
  crit: boolean
  damage: number
}

export interface ArenaReplayPayload {
  challengeId: number
  challenger: { address: string; affinity: "warrior" | "rogue" | "mage"; hp: number }
  opponent: { address: string; affinity: "warrior" | "rogue" | "mage"; hp: number }
  swings: ArenaSwing[]
  /** Empty for a draw. */
  winner: string
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
  affinity: "warrior" | "rogue" | "mage"
  /** True when the page is showing somebody else's hero, so the canvas offers no mint button. */
  readOnly: boolean
}

export interface RaidStatePayload {
  seasonId: number
  hp: number
  maxHp: number
  defeated: boolean
  recentHits: { player: string; damage: string }[]
}
