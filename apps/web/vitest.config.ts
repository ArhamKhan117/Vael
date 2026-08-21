import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

/**
 * Unit tests for the self-claim logic.
 *
 * Deliberately node-environment and component-render-free: the parts of the browser claim path
 * that can silently be wrong are the proof normalisation, the argument shape handed to
 * QuestASC.submit, and the mapping from an on-chain custom error to something a player can act on.
 * Those are pure functions, and testing them needs no DOM.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
})
