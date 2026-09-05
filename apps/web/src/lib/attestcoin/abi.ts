/** The slice of QuestASC the browser calls for self-claim. */
export const questAscAbi = [
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "sourceTx",
        type: "tuple",
        components: [
          { name: "chainKey", type: "uint64" },
          { name: "blockHeight", type: "uint64" },
          { name: "encodedTransaction", type: "bytes" },
          {
            name: "merkleProof",
            type: "tuple",
            components: [
              { name: "root", type: "bytes32" },
              {
                name: "siblings",
                type: "tuple[]",
                components: [
                  { name: "hash", type: "bytes32" },
                  { name: "isLeft", type: "bool" },
                ],
              },
            ],
          },
          {
            name: "continuityProof",
            type: "tuple",
            components: [
              { name: "lowerEndpointDigest", type: "bytes32" },
              { name: "roots", type: "bytes32[]" },
            ],
          },
        ],
      },
      { name: "questIdHint", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimedLog",
    stateMutability: "view",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "replayKey",
    stateMutability: "view",
    inputs: [
      { name: "chainKey", type: "uint64" },
      { name: "blockHeight", type: "uint64" },
      { name: "txIndex", type: "uint64" },
      { name: "logOrdinal", type: "uint64" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  { type: "error", name: "AlreadyClaimed", inputs: [{ name: "key", type: "bytes32" }] },
  {
    type: "error",
    name: "NothingRecognised",
    inputs: [
      { name: "chainKey", type: "uint64" },
      { name: "blockHeight", type: "uint64" },
      { name: "txIndex", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "SourceBlockTooEarly",
    inputs: [
      { name: "provided", type: "uint64" },
      { name: "mustExceed", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "AmountBelowMinimum",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "provided", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "PlayerMismatch",
    inputs: [
      { name: "expected", type: "address" },
      { name: "decoded", type: "address" },
    ],
  },
] as const

/** QuestPortal on Sepolia, for the "do it" button on portal quests. */
export const questPortalAbi = [
  {
    type: "function",
    name: "checkIn",
    stateMutability: "payable",
    inputs: [{ name: "questId", type: "uint256" }],
    outputs: [],
  },
] as const

/**
 * NativePortal on Creditcoin, the second completion path.
 *
 * It performs the action rather than verifying a claim about one, so there is no proof argument
 * here and no submission step afterwards. Both calls complete the quest in the same transaction.
 */
export const nativePortalAbi = [
  {
    type: "function",
    name: "swapViaPenguinSwap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "questId", type: "uint256" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "wrapNative",
    stateMutability: "payable",
    inputs: [{ name: "questId", type: "uint256" }],
    outputs: [{ name: "wrapped", type: "uint256" }],
  },
] as const

/** The two ERC-20 calls the swap panel needs: a balance, an allowance, and an approval. */
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

/** Uniswap v3 pool, read-only. Used to price a swap without deploying or trusting a quoter. */
export const uniswapV3PoolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const
