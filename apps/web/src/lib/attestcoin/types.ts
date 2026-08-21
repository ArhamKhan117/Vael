/** The five source-chain actions a quest can be satisfied by. Mirrors VaelTypes.ActionType. */
export enum ActionType {
  Portal = 0,
  UniswapSwap = 1,
  Erc20Transfer = 2,
  AaveSupply = 3,
  AaveBorrow = 4,
}

export const ACTION_LABELS: Record<ActionType, string> = {
  [ActionType.Portal]: "Vael Quest Portal",
  [ActionType.UniswapSwap]: "Uniswap v3 swap",
  [ActionType.Erc20Transfer]: "ERC-20 transfer",
  [ActionType.AaveSupply]: "Aave v3 supply",
  [ActionType.AaveBorrow]: "Aave v3 borrow",
}

/** What a proved log must look like to satisfy a quest. */
export interface VerificationRule {
  actionType: ActionType
  emitter: `0x${string}`
  token: `0x${string}`
  minAmount: bigint
  minSourceBlock: bigint
  maxSourceBlock: bigint
  playerMustMatch: boolean
}

/** Where a submission has got to. Mirrors the worker's state machine. */
export type ProofStage =
  | "not_started"
  | "detected"
  | "attesting"
  | "proving"
  | "submitted"
  | "verified"
  | "failed"

export interface ProofStatus {
  stage: ProofStage
  sourceTxHash?: string
  sourceBlock?: number
  creditcoinTxHash?: string
  replayKey?: string
  error?: string
  /** Attested Sepolia frontier, so the UI can show how far off the proof is. */
  attestedHeight?: number
}

/** Proof material as the Proof Builder REST API returns it. */
export interface SourceTxProof {
  chainKey: number
  blockHeight: number
  txIndex: number
  txHash: string
  encodedTransaction: `0x${string}`
  merkleProof: { root: `0x${string}`; siblings: { hash: `0x${string}`; isLeft: boolean }[] }
  continuityProof: { lowerEndpointDigest: `0x${string}`; roots: `0x${string}`[] }
}
