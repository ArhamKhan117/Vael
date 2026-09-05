/**
 * The action types a quest rule can name, and which completion path each one belongs to.
 *
 * Mirrors `VaelTypes.ActionType` in `contracts/src/interfaces/IVaelTypes.sol`. The order is the
 * on-chain order and the numbers are stored on chain, so nothing here may be reordered.
 */
export const ActionType = {
  Portal: 0,
  UniswapSwap: 1,
  Erc20Transfer: 2,
  AaveSupply: 3,
  AaveBorrow: 4,
  PenguinSwapSwap: 5,
  WrapNative: 6,
} as const

export type ActionTypeId = (typeof ActionType)[keyof typeof ActionType]

/**
 * The boundary between the two completion paths, mirroring `VaelTypes.FIRST_NATIVE_ACTION`.
 *
 * Below it, the action happens on Ethereum and is settled by `QuestASC` against an Attestcoin
 * proof. At or above it, the action happens on Creditcoin and is performed and settled by
 * `NativePortal` in one transaction. A quest is filed to one side at creation and cannot move.
 */
export const FIRST_NATIVE_ACTION = ActionType.PenguinSwapSwap

export function isNativeAction(actionType: number): boolean {
  return actionType >= FIRST_NATIVE_ACTION
}

/** Short label for an action type, for chips and card headers. */
export function actionLabel(actionType: number): string {
  switch (actionType) {
    case ActionType.Portal:
      return "Portal check-in"
    case ActionType.UniswapSwap:
      return "Uniswap swap"
    case ActionType.Erc20Transfer:
      return "ERC-20 transfer"
    case ActionType.AaveSupply:
      return "Aave supply"
    case ActionType.AaveBorrow:
      return "Aave borrow"
    case ActionType.PenguinSwapSwap:
      return "PenguinSwap swap"
    case ActionType.WrapNative:
      return "Wrap CTC"
    default:
      return "Unknown action"
  }
}

/** Which chain the action itself happens on. Not where the quest is settled: that is always here. */
export function actionChainName(actionType: number): string {
  return isNativeAction(actionType) ? "Creditcoin" : "Ethereum Sepolia"
}

/** How the completion is settled, in the words the rest of the site uses. */
export function settlementLabel(actionType: number): string {
  return isNativeAction(actionType) ? "Performed on Creditcoin" : "Attestcoin proof"
}
