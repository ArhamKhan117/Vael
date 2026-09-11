/**
 * What a hero looks like, and what it is called, by affinity.
 *
 * One table for every place a hero is drawn or named: the hero page, the arena replay, the
 * profile. Three copies of it had drifted apart before, two frame maps and two label maps, and
 * a hero that reads "Novice" on one page and draws as a warrior on another is a bug nothing
 * would have caught.
 *
 * Affinity is a record of what the player did: the dominant stat, which only proved actions can
 * raise. A hero with no stats has done nothing yet, so it is a novice, and anything that is not
 * one of the four names, absent, misspelt, or from an older API, is drawn and labelled as one
 * too: an armoured knight for somebody who has never made a transaction is a claim the chain does
 * not support, and a blank is worse.
 *
 * The frames index the Kenney Tiny Dungeon sheet, 16 px tiles, 12 per row, and were checked by eye
 * against a labelled contact sheet of all 132: 84 is the wizard, 85 an unarmoured villager, 96 full
 * plate with a closed helm, 112 a green hood and headband. Guessing them is how they were wrong for
 * a whole phase.
 */
export type Affinity = "novice" | "warrior" | "rogue" | "mage"

export const AFFINITIES: readonly Affinity[] = ["novice", "warrior", "rogue", "mage"]

export const AFFINITY_FRAMES: Record<Affinity, number> = {
  novice: 85,
  warrior: 96,
  rogue: 112,
  mage: 84,
}

export const AFFINITY_LABELS: Record<Affinity, string> = {
  novice: "Novice",
  warrior: "Warrior",
  rogue: "Rogue",
  mage: "Mage",
}

export function isAffinity(value: unknown): value is Affinity {
  return typeof value === "string" && (AFFINITIES as readonly string[]).includes(value)
}

/** The affinity a hero is drawn and named with: what it says, or novice when it says nothing. */
export function heroAffinity(value: unknown): Affinity {
  return isAffinity(value) ? value : "novice"
}

/** The sheet frame a hero is drawn with. */
export function heroFrame(affinity: unknown): number {
  return AFFINITY_FRAMES[heroAffinity(affinity)]
}

/** The name a page prints for a hero. */
export function affinityLabel(affinity: unknown): string {
  return AFFINITY_LABELS[heroAffinity(affinity)]
}
