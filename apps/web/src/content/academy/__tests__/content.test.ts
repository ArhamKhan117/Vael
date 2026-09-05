import { describe, expect, it } from "vitest"

import { ACADEMY_MODULES, QUIZ_PASS_MARK, academyModule } from ".."

/**
 * The academy is hand-written content, and a typo in it is invisible until somebody takes the quiz
 * and finds the right answer marked wrong. These checks are the cheap half of proofreading.
 */
describe("Academy content", () => {
  it("ships the four modules the spec names", () => {
    expect(ACADEMY_MODULES.map((module) => module.slug)).toEqual([
      "attestcoin-proofs",
      "uniswap-swaps",
      "aave-supply-borrow",
      "penguinswap-creditcoin",
    ])
  })

  it("passes at 4 of 5, the same mark the API applies", () => {
    expect(QUIZ_PASS_MARK).toBe(4)
  })

  it.each(ACADEMY_MODULES)("$slug has three lessons and five questions", (module) => {
    expect(module.lessons).toHaveLength(3)
    expect(module.quiz).toHaveLength(5)
  })

  it.each(ACADEMY_MODULES)("$slug has a usable quiz", (module) => {
    for (const question of module.quiz) {
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(question.answer).toBeGreaterThanOrEqual(0)
      expect(question.answer).toBeLessThan(question.options.length)
      expect(question.why.length).toBeGreaterThan(0)
      // A duplicated option means two answers are correct and one is marked wrong.
      expect(new Set(question.options).size).toBe(question.options.length)
    }
  })

  it.each(ACADEMY_MODULES)("$slug has non-empty lesson text", (module) => {
    for (const lesson of module.lessons) {
      expect(lesson.title.length).toBeGreaterThan(0)
      expect(lesson.body.length).toBeGreaterThan(0)
      for (const paragraph of lesson.body) expect(paragraph.length).toBeGreaterThan(40)
    }
  })

  it("either links a verifiable action or says plainly that it cannot", () => {
    for (const module of ACADEMY_MODULES) {
      if (module.doQuest.available) {
        // Mirrors VaelTypes.ActionType: Portal, UniswapSwap, Erc20Transfer, AaveSupply,
        // AaveBorrow, PenguinSwapSwap, WrapNative.
        expect(module.doQuest.actionType).toBeGreaterThanOrEqual(0)
        expect(module.doQuest.actionType).toBeLessThanOrEqual(6)
        expect(module.doQuest.steps.length).toBeGreaterThanOrEqual(2)
      } else {
        expect(module.doQuest.unavailableReason.length).toBeGreaterThan(40)
      }
    }
  })

  // The point of the Academy is that every module ends somewhere the chain can see. A module that
  // teaches and then has nothing to do is half a module, and this is the assertion that says so.
  it("every module ends in an action that is actually available", () => {
    for (const module of ACADEMY_MODULES) {
      expect(module.doQuest.available).toBe(true)
    }
  })

  it("resolves a module by slug and nothing by a wrong one", () => {
    expect(academyModule("uniswap-swaps")?.title).toBe("Uniswap swaps")
    expect(academyModule("uniswap")).toBeUndefined()
  })
})
