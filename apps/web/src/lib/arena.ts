import type { ArenaSwing } from "@/game/EventBus"

/**
 * Duel arithmetic, kept away from Phaser.
 *
 * The replay scene imports Phaser, which touches `window` at import time, so anything a page needs
 * has to live somewhere a server bundle can safely reach.
 */

/** Decode the chain's round log: three bytes per swing, big-endian damage. */
export function decodeRounds(rounds?: string): ArenaSwing[] {
  if (!rounds) return []
  const hex = rounds.replace(/^0x/, "")
  const swings: ArenaSwing[] = []
  for (let i = 0; i + 6 <= hex.length; i += 6) {
    const header = parseInt(hex.slice(i, i + 2), 16)
    swings.push({
      attacker: (header & 1) as 0 | 1,
      crit: (header & 2) === 2,
      damage: parseInt(hex.slice(i + 2, i + 6), 16),
    })
  }
  return swings
}

/** Mirrors Arena.hitPoints. */
export function hitPoints(level: number, intellect: number): number {
  return 100 + 10 * level + 3 * intellect
}

/**
 * Mirrors Arena.baseDamage.
 *
 * Level is in here because it is in the contract: without it a level-1 hero had 110 hit points and
 * dealt two damage a swing, so forty swings came to eighty and two new players drew every duel.
 */
export function baseDamage(level: number, strength: number, agility: number): number {
  return 2 + 2 * level + 2 * strength + agility
}

/** Affinity names as a page should print them. "novice" means no verified action yet. */
export const AFFINITY_LABELS: Record<string, string> = {
  novice: "Novice",
  warrior: "Warrior",
  rogue: "Rogue",
  mage: "Mage",
}

export function affinityLabel(affinity: string | undefined): string {
  return AFFINITY_LABELS[affinity ?? "novice"] ?? "Novice"
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
