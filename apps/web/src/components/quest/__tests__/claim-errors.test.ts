import { describe, expect, it } from "vitest"
import { BaseError, ContractFunctionRevertedError } from "viem"

import { describeClaimError } from "../self-claim-button"
import { ProofNotReadyError } from "@/lib/attestcoin/proofBuilder"
import { ActionType } from "@/lib/attestcoin/types"
import { actionDeepLink } from "../rule-card"
import { stageIndex } from "../proof-timeline"

/** Build the error shape viem produces for a reverted contract call. */
function reverted(errorName: string): BaseError {
  const inner = new ContractFunctionRevertedError({
    abi: [{ type: "error", name: errorName, inputs: [] }],
    data: `0x00000000`,
    functionName: "submit",
  })
  // viem populates `data` from the ABI lookup; set it directly so the test does not depend on
  // selector computation, which is not what is under test here.
  ;(inner as unknown as { data: { errorName: string } }).data = { errorName }
  const outer = new BaseError("execution reverted")
  ;(outer as unknown as { walk: (fn: (e: unknown) => boolean) => unknown }).walk = () => inner
  return outer
}

describe("describeClaimError", () => {
  it("explains a replay in terms a player understands", () => {
    expect(describeClaimError(reverted("AlreadyClaimed"))).toMatch(/already been proved/i)
  })

  it("distinguishes a too-early action from a replay", () => {
    const message = describeClaimError(reverted("SourceBlockTooEarly"))
    expect(message).toMatch(/before you accepted/i)
    expect(message).not.toMatch(/already/i)
  })

  it("explains an amount below the minimum", () => {
    expect(describeClaimError(reverted("AmountBelowMinimum"))).toMatch(/below the quest's minimum/i)
  })

  it("explains a player mismatch without blaming the gas payer", () => {
    expect(describeClaimError(reverted("PlayerMismatch"))).toMatch(/not the wallet assigned/i)
  })

  it("explains that no log matched", () => {
    expect(describeClaimError(reverted("NothingRecognised"))).toMatch(/no log/i)
  })

  it("names an unmapped custom error rather than hiding it", () => {
    expect(describeClaimError(reverted("SomeNewError"))).toMatch(/SomeNewError/)
  })

  it("passes a not-ready proof through as its own message", () => {
    const error = new ProofNotReadyError("not covered yet")
    expect(describeClaimError(error)).toBe("not covered yet")
  })

  it("falls back to the message for an ordinary error", () => {
    expect(describeClaimError(new Error("wallet closed"))).toBe("wallet closed")
  })
})

describe("actionDeepLink", () => {
  it("sends a swap quest to Uniswap on Sepolia", () => {
    expect(actionDeepLink(ActionType.UniswapSwap)?.href).toMatch(/uniswap.*sepolia/i)
  })

  it("sends both Aave actions to the Sepolia market", () => {
    expect(actionDeepLink(ActionType.AaveSupply)?.href).toMatch(/aave.*sepolia/i)
    expect(actionDeepLink(ActionType.AaveBorrow)?.href).toMatch(/aave.*sepolia/i)
  })

  it("has no deep link for the portal, which has its own button", () => {
    expect(actionDeepLink(ActionType.Portal)).toBeNull()
  })
})

describe("stageIndex", () => {
  it("orders the pipeline so the timeline can mark earlier steps done", () => {
    expect(stageIndex("detected")).toBeLessThan(stageIndex("attesting"))
    expect(stageIndex("attesting")).toBeLessThan(stageIndex("proving"))
    expect(stageIndex("proving")).toBeLessThan(stageIndex("submitted"))
    expect(stageIndex("submitted")).toBeLessThan(stageIndex("verified"))
  })

  it("returns -1 for stages that are not on the happy path", () => {
    expect(stageIndex("not_started")).toBe(-1)
    expect(stageIndex("failed")).toBe(-1)
  })
})
