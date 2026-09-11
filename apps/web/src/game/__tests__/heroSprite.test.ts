import { describe, expect, it } from "vitest"

import { AFFINITIES, AFFINITY_FRAMES, affinityLabel, heroAffinity, heroFrame } from "../heroSprite"

/**
 * A hero is drawn with the frame its affinity names, and a hero with no affinity is a novice, not
 * a blank and not a warrior. The frames are the ones checked against the tile sheet by eye; a
 * change here should be a deliberate change to what a class looks like.
 */
describe("hero sprites by affinity", () => {
  it("maps each affinity to its checked frame", () => {
    expect(heroFrame("novice")).toBe(85)
    expect(heroFrame("warrior")).toBe(96)
    expect(heroFrame("rogue")).toBe(112)
    expect(heroFrame("mage")).toBe(84)
  })

  it("draws a hero with no affinity, or an unknown one, as the novice", () => {
    for (const value of [undefined, null, "", "NOVICE", "paladin", 0, {}]) {
      expect(heroAffinity(value)).toBe("novice")
      expect(heroFrame(value)).toBe(AFFINITY_FRAMES.novice)
      expect(affinityLabel(value)).toBe("Novice")
    }
  })

  it("names every affinity the way a page prints it", () => {
    expect(affinityLabel("novice")).toBe("Novice")
    expect(affinityLabel("warrior")).toBe("Warrior")
    expect(affinityLabel("rogue")).toBe("Rogue")
    expect(affinityLabel("mage")).toBe("Mage")
  })

  it("gives every affinity a distinct frame, so no two classes look alike", () => {
    const frames = AFFINITIES.map((affinity) => AFFINITY_FRAMES[affinity])
    expect(new Set(frames).size).toBe(AFFINITIES.length)
    // Every frame is a tile on the 12 x 11 sheet.
    for (const frame of frames) expect(frame).toBeGreaterThanOrEqual(0)
    for (const frame of frames) expect(frame).toBeLessThan(132)
  })
})
