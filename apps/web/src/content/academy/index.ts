import aaveSupplyBorrow from "./aave-supply-borrow.json"
import attestcoinProofs from "./attestcoin-proofs.json"
import penguinswapCreditcoin from "./penguinswap-creditcoin.json"
import uniswapSwaps from "./uniswap-swaps.json"

export interface AcademyLesson {
  title: string
  body: string[]
}

export interface AcademyQuizQuestion {
  question: string
  options: string[]
  /** Index into `options`. */
  answer: number
  /** Shown after answering, whether the answer was right or wrong. */
  why: string
}

/**
 * The action a module asks you to actually perform.
 *
 * `available: false` is a real state, not a placeholder. A module whose action Vael cannot verify
 * yet says so and links nothing, because a link to a quest that does not exist would be a
 * fabrication dressed as a feature.
 */
export type AcademyDoQuest =
  | {
      available: true
      /** Mirrors VaelTypes.ActionType. */
      actionType: number
      actionName: string
      title: string
      steps: string[]
    }
  | { available: false; unavailableReason: string }

export interface AcademyModule {
  slug: string
  title: string
  summary: string
  lessons: AcademyLesson[]
  quiz: AcademyQuizQuestion[]
  doQuest: AcademyDoQuest
}

/** A quiz is passed at 4 of 5, matching the API. Both sides state it so neither can drift silently. */
export const QUIZ_PASS_MARK = 4

/** Order is the order they are shown in, and is the order they are meant to be read in. */
export const ACADEMY_MODULES: AcademyModule[] = [
  attestcoinProofs,
  uniswapSwaps,
  aaveSupplyBorrow,
  penguinswapCreditcoin,
] as AcademyModule[]

export function academyModule(slug: string): AcademyModule | undefined {
  return ACADEMY_MODULES.find((module) => module.slug === slug)
}
