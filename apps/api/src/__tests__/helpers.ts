import { Express } from "express"
import request from "supertest"

/** Supertest bound to an Express app. */
export function testApp(app: Express) {
  return request(app)
}

/** A wallet address for tests that need one and do not care which. */
export const MOCK_WALLET = "0x1234567890123456789012345678901234567890"

/** A quest id for tests that need one and do not care which. */
export const MOCK_QUEST_ID = 1

/** Quest input with sensible defaults, overridable per test. */
export function createMockQuestInput(overrides?: any) {
  return {
    projectName: "Test Project",
    goal: "Complete a token swap on Uniswap v3",
    chain: "Creditcoin Testnet",
    protocol: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // Uniswap v3 SwapRouter02 on Sepolia
    participant: MOCK_WALLET,
    rewardAmount: "100",
    badgeLevel: 1,
    autoDeploy: false,
    ...overrides,
  }
}

/**
 * Wait, for tests that need a tick to pass.
 */
export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

