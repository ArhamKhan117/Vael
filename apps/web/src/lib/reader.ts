import { createPublicClient, fallback, http, type PublicClient } from "viem"

import { CREDITCOIN_RPC_URLS, creditcoinTestnet } from "./chains"

/**
 * A plain viem client for reads and receipt waits, built on first use.
 *
 * Deliberately not wagmi's `usePublicClient`: that returns whatever the connector's config happens
 * to provide, and when it came back without a usable client an allowance check silently fell
 * through to approving every time.
 *
 * Never constructed at module scope. `createPublicClient` throws when a transport has no URL, and a
 * page that builds one while being prerendered fails the build rather than the request.
 */
let client: PublicClient | null = null

export function creditcoinReader(): PublicClient | null {
  if (client) return client
  const urls = CREDITCOIN_RPC_URLS.filter((url): url is string => Boolean(url))
  if (urls.length === 0) return null
  client = createPublicClient({
    chain: creditcoinTestnet,
    transport: fallback(urls.map((url) => http(url))),
  }) as PublicClient
  return client
}

/**
 * Wait for a transaction to be mined.
 *
 * `writeContractAsync` resolves when a transaction is *sent*, not when it lands. A page that
 * approves and then immediately deposits estimates gas against an allowance that is still zero and
 * the deposit reverts before it is ever signed.
 */
export async function waitForReceipt(hash: `0x${string}`) {
  const reader = creditcoinReader()
  if (!reader) return null
  return reader.waitForTransactionReceipt({ hash, timeout: 120_000 })
}
