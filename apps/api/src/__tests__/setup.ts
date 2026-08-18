// Global test setup
import { config } from "dotenv"

// Load test environment variables
config({ path: ".env.test" })

// Set test environment variables if not provided
process.env.NODE_ENV = process.env.NODE_ENV || "test"
process.env.PORT = process.env.PORT || "4001"

// Mock console methods to reduce noise in tests (optional - comment out if you want to see logs)
// Note: jest is available globally in test environment
if (typeof jest !== "undefined") {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as typeof console
}

