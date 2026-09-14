# Building an Attestcoin Smart Contract on this base

`VaelAscBase.sol` is the proof gate every Vael reward passes through.
It is written to be reused: the base holds everything that has to be right about verifying an Attestcoin proof, and a consumer contract adds only what its own product means by a completed action.
This page is the guide to building on it.

Three parts make up the kit:

| Part | Where | What it gives you |
|---|---|---|
| The base contract | `VaelAscBase.sol` | Verification through the Block Prover precompile, a log-scoped replay ledger, batch submission, and dispatch derived from the verified log |
| The adapter interface | `../interfaces/IActionAdapter.sol`, with four implementations in `../adapters/` | Stateless decoding of one event shape per adapter, registered per `topics[0]`, so a new protocol is one registration transaction |
| Real-network fixtures | `../../test/fixtures/*.json`, replayed by `../../test/RealFixtures.t.sol` | Offline tests over the exact bytes the block prover delivered for real Sepolia transactions |

The findings that shaped the base, each verified on the live network, are in [`docs/ATTESTCOIN_FINDINGS.md`](../../../docs/ATTESTCOIN_FINDINGS.md).

## Why not inherit `ASCBase`

`@gluwa/asc-contracts` ships `ASCBase`, and the obvious move is to inherit it.
Vael does not, because three properties a reward system needs are not available there, and each one is a security property rather than a convenience.

1. **The replay key is log-scoped, not transaction-scoped.**
   `ASCBase` keys replay per proved transaction, so the first recognised log in a transaction consumes that transaction's only identity and every further recognised log in it becomes permanently unclaimable.
   A Uniswap swap emits two ERC-20 `Transfer` logs beside its `Swap`, so that failure would be routine.
   The key here is `keccak256(chainKey, blockHeight, txIndex, logOrdinal)`.
2. **Dispatch is derived from the verified log, never from the caller.**
   There is no action byte in `SourceTx`.
   A caller-supplied dispatch field sits outside the proof, which means a valid proof of a benign transaction could be aimed at a different interpretation of the same bytes on the code path that releases money.
   Handlers are selected from the emitting address and `topics[0]` of a log that has already been proved.
3. **Every batch member carries its own continuity proof.**
   One continuity proof proves exactly one height: the precompile treats the proof's first root as the transaction-trie root of the height under proof, so a proof built to span a batch verifies only the lowest height and reverts `Merkle root mismatch` at every other one.
   Carrying the proof inside `SourceTx` makes the wrong pairing unexpressible.

The transaction index is recovered from the proof's sibling laterality through `calculateTxIndex`, never accepted from the caller, because it is one of the four fields of the replay key.

## What the base does on every submission

`submit(sourceTx, questIdHint)` and `submitBatch(sourceTxs, questIdHints)` both run `_verifyAndIngest` per transaction:

1. Reject an unsupported chain key (`_isSupportedChainKey`, yours to define).
2. Call the Block Prover precompile at `0x…0FD2` with the encoded transaction, the receipt, the Merkle proof and the continuity proof. The precompile reverts with `Error(string)` on a bad proof rather than returning false, and the base lets that revert surface.
3. Recover the transaction index from the proof itself (`calculateTxIndex`), then reject an unsupported transaction type.
4. Require `receiptStatus == 1`. The precompile proves inclusion, not success, and a reverted source transaction moved no value.
5. Walk the receipt's logs in order. For each one, ask `_isRecognised` (your allowlist and adapter registry) and, if recognised, `_handleRecognisedLog` (your rule).
6. Burn the replay key of the log that satisfied the claim. A log that is recognised but belongs to a different claim is declined and its key released, so a second quest in the same source transaction stays claimable.

Batches are bounded: at most ten transactions and a span of at most a thousand source blocks, so the cost of a submission is predictable from its size alone.

## What a consumer adds

A contract inheriting the base implements three functions:

| Function | What it decides |
|---|---|
| `_isSupportedChainKey(chainKey)` | Which attested chains you accept. Vael accepts Sepolia (1) and has Ethereum mainnet (3) registered |
| `_isRecognised(chainKey, logEntry)` | Whether the emitting address is on your allowlist and an adapter is registered for `topics[0]` |
| `_handleRecognisedLog(...)` | What a decoded action means to you: check it against your rule, then pay, mint, credit, or decline |

`QuestASC.sol` is the worked example.
It keeps the emitter allowlist, the adapter registry, the quest rules, the campaign payout and the completion hooks; the adapters hold no privilege and cannot widen what is accepted.

The order of checks in `QuestASC` is deliberate and worth copying: emitter first, because a log from an unregistered contract is somebody else's event and must not reach any product logic; then the claim's context; then the player binding, always from an indexed topic and never from the transaction sender; then the amount; then the block window.
Each is a separate named revert, so a failed submission says which rule it broke, and a keyless `eth_call` preflight of `submit` tells a replay from a mismatch before any gas is spent.

## Writing an adapter

An adapter implements one function:

```solidity
function decode(uint64 chainKey, EvmV1Decoder.LogEntry memory logEntry)
    external view
    returns (bool recognised, VaelTypes.ActionType actionType, address player, address token, uint256 amount, uint256 questIdFromEvent);
```

Rules that keep it safe:

- Return `recognised = false` for any shape you do not handle. The base skips the log; it never reverts on a foreign log.
- Take `player` from an indexed topic. Behind routers, relayers and smart accounts the gas payer is not the actor.
- Hold no state that a caller can influence. An adapter is handed a log the precompile has already verified and says what it means; that is all.
- Set `questIdFromEvent` only when the event itself names a claim, as Vael's own `QuestPortal` event does. A third-party protocol's event cannot, and the submitter supplies a hint that can only narrow what is accepted.

The four shipped adapters cover a portal check-in, an ERC-20 `Transfer`, a Uniswap v3 `Swap` (reading whichever token flowed in), and Aave v3 `Supply` and `Borrow`.

## Testing against what the network actually produced

Hand-written fixtures test the shape you imagined.
Real receipts carry extra logs, unusual orderings and amounts a fixture author would never think of.
`test/fixtures/*.json` holds the exact encoded transaction, receipt and proof material the Attestcoin block prover delivered for transactions that were mined on Sepolia and verified on Creditcoin, captured during live runs.
`test/RealFixtures.t.sol` replays those bytes through the real adapters offline, so decoding is regression-tested against the network rather than against an assumption.

Capture your own the same way: perform the action, fetch the proof material right before submission, write the `SourceTx` fields to a JSON file, and replay it in Foundry.

## Two proof sources

The base does not care where a proof came from; only that the precompile accepts it.
Vael's worker and browser fetch from two independent builders, the hosted Proof Builder and a raw builder over an ordinary Ethereum RPC, and re-derive the Merkle root locally before submitting.
Both produce interchangeable material, and the second is what kept the worker running when the first did not answer.
Fetch immediately before submitting: proof material perishes as the attested frontier moves.
