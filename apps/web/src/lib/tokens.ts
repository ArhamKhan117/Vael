/**
 * Source-chain tokens a verification rule can name.
 *
 * A rule's minimum is stored in the token's own units, so 200000 is 0.2 USDC and a two-trillionth
 * of anything with eighteen decimals. Showing it against the wrong token is worse than showing the
 * raw integer, because it looks like an answer. This table mirrors `SEPOLIA_TOKENS` and
 * `TOKEN_INFO` in `apps/api/src/lib/protocols.ts`.
 */

const SEPOLIA_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": { symbol: "WETH", decimals: 18 },
  "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238": { symbol: "USDC", decimals: 6 },
  "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8": { symbol: "aUSDC", decimals: 6 },
  "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357": { symbol: "aDAI", decimals: 18 },
  "0xc558dbdd856501fcd9aaf1e62eae57a9f0629a3c": { symbol: "aWETH", decimals: 18 },
  "0xf8fb3713d459d7c1018bd0a49d19b4c44290ebe5": { symbol: "aLINK", decimals: 18 },
}

/** Mirrors VaelTypes.ActionType. A portal check-in's amount is the ether the player sent. */
const PORTAL = 0

export interface RuleAmountUnit {
  symbol: string
  decimals: number
  /** False when neither the token nor the action tells us what the units are. */
  known: boolean
}

/**
 * What the units of a rule's `minAmount` are.
 *
 * A named token settles it. A portal quest has no token to name because the amount it checks is
 * ether. Anything else is unknown, and saying so beats guessing.
 */
export function ruleAmountUnit(token: string, actionType: number): RuleAmountUnit {
  const known = SEPOLIA_TOKENS[token.toLowerCase()]
  if (known) return { ...known, known: true }
  if (actionType === PORTAL) return { symbol: "ETH", decimals: 18, known: true }
  return { symbol: "units", decimals: 0, known: false }
}
