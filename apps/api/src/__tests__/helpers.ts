import { Express } from "express"
import request from "supertest"

/**
 * Helper untuk test API endpoints
 */
export function testApp(app: Express) {
  return request(app)
}

/**
 * Mock wallet address untuk testing
 */
export const MOCK_WALLET = "0x1234567890123456789012345678901234567890"

/**
 * Mock quest ID untuk testing
 */
export const MOCK_QUEST_ID = 1

/**
 * Helper untuk create mock quest data
 */
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
 * Helper untuk wait async operations
 */
export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

