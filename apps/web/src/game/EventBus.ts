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
    // Remember the original so `off` can find it again after binding.
    boundOriginals.set(bound, handler)
    const set = this.listeners.get(event) ?? new Set<Handler>()
    set.add(bound)
    this.listeners.set(event, set)
    return this
  }

  off(event: string, handler?: Handler): this {
    const set = this.listeners.get(event)
    if (!set) return this
    if (!handler) {
      this.listeners.delete(event)
      return this
    }
    for (const registered of set) {
      if (registered === handler || boundOriginals.get(registered) === handler) set.delete(registered)
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

const boundOriginals = new WeakMap<Handler, Handler>()

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
} as const

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
}

export interface RaidStatePayload {
  seasonId: number
  hp: number
  maxHp: number
  defeated: boolean
  recentHits: { player: string; damage: string }[]
}
