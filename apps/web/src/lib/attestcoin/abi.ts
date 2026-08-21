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
