import { JsonRpcProvider, Wallet } from "ethers"

import { env } from "../config/env"

/**
 * Attestcoin worker configuration.
 *
 * ethers rather than viem here, because `@gluwa/usc-sdk` takes ethers v6 providers directly and
 * translating between the two at every boundary is a place for bugs to hide. The rest of the API
 * stays on viem; the worker is the only ethers island.
 */

export const CREDITCOIN_CHAIN_ID = 102031
export const SEPOLIA_CHAIN_ID = 11155111

/** Attestcoin source chain keys. Sepolia is 1, Ethereum mainnet is 3. */
export const SEPOLIA_CHAIN_KEY = 1

/** Attestation lag measured on the live network: 7 to 8.6 minutes for Sepolia. */
export const ATTESTATION_POLL_INTERVAL_MS = 15_000

/** Proof Builder request timeout. */
export const PROOF_BUILDER_TIMEOUT_MS = 30_000

/** Gas floor for a submission, and the multiplier applied to the estimate. */
export const SUBMIT_GAS_FLOOR = 400_000n
export const SUBMIT_GAS_MULTIPLIER_NUMERATOR = 3n
export const SUBMIT_GAS_MULTIPLIER_DENOMINATOR = 2n

/**
 * Public endpoints reject JSON-RPC batching, so every provider is built with batching disabled.
 * `staticNetwork` also stops ethers re-detecting the chain on every call, which halves the request
 * count against rate-limited endpoints.
 */
export function creditcoinProvider(): JsonRpcProvider {
  return new JsonRpcProvider(
    env.CREDITCOIN_RPC_URL,
    { chainId: CREDITCOIN_CHAIN_ID, name: "creditcoin-testnet" },
    { batchMaxCount: 1, staticNetwork: true, polling: true }
  )
}

export function sepoliaProvider(): JsonRpcProvider {
  return new JsonRpcProvider(
    env.SEPOLIA_RPC_URL,
    { chainId: SEPOLIA_CHAIN_ID, name: "sepolia" },
    { batchMaxCount: 1, staticNetwork: true, polling: true }
  )
}

/** The key that pays CTC gas to submit proofs. It cannot complete a quest on its own. */
export function workerWallet(): Wallet {
  const key = env.WORKER_PRIVATE_KEY.startsWith("0x")
    ? env.WORKER_PRIVATE_KEY
    : `0x${env.WORKER_PRIVATE_KEY}`
  return new Wallet(key, creditcoinProvider())
}

/** A discriminated result, so a caller has to look at the failure before using the value. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const err = <T>(error: string): Result<T> => ({ ok: false, error })
