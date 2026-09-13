import { Contract } from "ethers"

import { creditcoinProvider } from "../attestcoin/config"

/**
 * Which protocol a quest's rule targets, and whether the chain agrees it is the real one.
 *
 * "Verified protocol" has to mean something a reader can check, or it is decoration that makes a
 * campaign look official. Here it means exactly one thing: `QuestASC.allowedEmitters` says this
 * contract is accepted for this action type on this chain. Nothing a partner writes, and nothing in
 * this file, can turn the chip on; only the allowlist can.
 *
 * The consequence is worth stating. A campaign can name itself anything, and the name is not
 * checked. The chip is not about the name: it says the quests in that campaign pay out only against
 * a log from a contract the deployment already allowlisted, so a lookalike contract cannot satisfy
 * them.
 */
const QUEST_ASC_ALLOWLIST_ABI = [
  "function allowedEmitters(uint64 chainKey, uint8 actionType, address emitter) view returns (bool)",
]

/** Addresses this deployment knows by name. Recorded in docs/ADDRESSES.md. */
function knownProtocols(): { address: string; name: string; slug: string }[] {
  const entries: { address: string | undefined; name: string; slug: string }[] = [
    { address: process.env.QUEST_PORTAL_ADDRESS, name: "Vael Quest Portal", slug: "vael" },
    { address: process.env.SEPOLIA_POOL_USDC_WETH_500, name: "Uniswap v3", slug: "uniswap" },
    { address: process.env.SEPOLIA_POOL_USDC_WETH_3000, name: "Uniswap v3", slug: "uniswap" },
    { address: process.env.SEPOLIA_AAVE_POOL, name: "Aave v3", slug: "aave" },
    { address: process.env.NATIVE_PORTAL_ADDRESS, name: "PenguinSwap", slug: "penguinswap" },
    { address: process.env.SEPOLIA_WETH9, name: "WETH9", slug: "weth" },
    { address: process.env.SEPOLIA_USDC, name: "USDC", slug: "usdc" },
  ]
  return entries
    .filter((e): e is { address: string; name: string; slug: string } => !!e.address)
    .map((e) => ({ ...e, address: e.address.toLowerCase() }))
}

export interface VerifiedProtocol {
  name: string
  slug: string
  /** True only when QuestASC's own allowlist accepts this emitter for this action type. */
  verified: boolean
}

/** One in-process cache. The allowlist changes only when somebody sends a transaction to change it. */
const cache = new Map<string, boolean>()

async function isAllowlisted(chainKey: number, actionType: number, emitter: string): Promise<boolean> {
  const address = process.env.QUEST_ASC_ADDRESS
  if (!address) return false
  // A native action is not on the allowlist and never will be: NativePortal performs it rather than
  // decoding a log from somewhere else, so there is no emitter to allow. It is verified by being
  // the contract QuestManager names as the only completer for that quest.
  const key = `${chainKey}:${actionType}:${emitter.toLowerCase()}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  try {
    const asc = new Contract(address, QUEST_ASC_ALLOWLIST_ABI, creditcoinProvider())
    const allowed: boolean = await asc
      .getFunction("allowedEmitters")
      .staticCall(chainKey, actionType, emitter)
    cache.set(key, allowed)
    return allowed
  } catch {
    // A chip that cannot be checked is not shown. Failing closed is the only safe direction here.
    return false
  }
}

const FIRST_NATIVE_ACTION = 5

/**
 * Resolve the protocol behind one rule.
 *
 * Returns nothing when the emitter is not a contract this deployment knows by name, which is the
 * honest answer: an unknown address may well be a real protocol, and saying so without being able
 * to check would be the decoration this exists to avoid.
 */
export async function verifiedProtocolFor(
  emitter: string,
  actionType: number,
  sourceChainKey: number
): Promise<VerifiedProtocol | undefined> {
  const known = knownProtocols().find((p) => p.address === emitter.toLowerCase())
  if (!known) return undefined

  if (actionType >= FIRST_NATIVE_ACTION) {
    // NativePortal is the emitter, and it is verified by being the only contract QuestManager will
    // accept a completion from for this quest, which is a stronger statement than an allowlist.
    const isTheCompleter =
      emitter.toLowerCase() === (process.env.NATIVE_PORTAL_ADDRESS ?? "").toLowerCase()
    return { name: known.name, slug: known.slug, verified: isTheCompleter }
  }

  return {
    name: known.name,
    slug: known.slug,
    verified: await isAllowlisted(sourceChainKey, actionType, emitter),
  }
}
