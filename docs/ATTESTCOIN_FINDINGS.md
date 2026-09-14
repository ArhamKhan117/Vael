# Attestcoin findings from the live network

Everything below was found by running Vael against Creditcoin testnet and Ethereum Sepolia, not by reading documentation.
Each entry states what was observed, how to reproduce it, and what Vael does about it, so that any of them can be filed as an issue or a documentation note on the protocol's repositories as written.
The code that acts on them is described in [`contracts/src/asc/README.md`](../contracts/src/asc/README.md).

## 1. One continuity proof proves exactly one height

**Observed.** A batch of proofs built to share one continuity proof across several source heights verifies only the lowest height.
The precompile treats the proof's first root as the transaction-trie root of the height under proof, so every other member reverts with `Merkle root mismatch`.

**Reproduce.** Build one continuity proof for height H and submit transactions from H and H+4 against it through `verifyAndEmit`; the second reverts.

**What Vael does.** Every `SourceTx` carries its own continuity proof, so the wrong pairing cannot be expressed.
A batch of two transactions four blocks apart carried ten roots for the first member and six for the second and verified in one receipt for 1,194,636 gas.
Batching saves the fixed cost of a second Creditcoin transaction, not the proof material.

**Suggestion.** State in the Proof Builder and precompile documentation that continuity proofs are per height, and that a batch is a list of independent proofs.

## 2. Attestation coverage is not the same as provability

**Observed.** A proof for height H cannot be built when the attested frontier has merely reached H.
The Proof Builder answers `Cannot build continuity proof for height H without both lower and upper continuity bounds`: a continuity proof runs between two attested endpoints that bracket the block, so an endpoint at or below H is not enough.

**Reproduce.** Wait for `get_latest_attestation_height_and_hash` to return H, then request a proof for H.

**What Vael does.** The worker waits for the frontier to pass the block, and retries the proof fetch for a few intervals afterwards, because both proof sources can still answer "not ready" for a moment after the frontier moves.

**Suggestion.** Document "provable" as strictly above the attested frontier, and expose it as a single call.

## 3. The precompile reverts with `Error(string)` rather than returning false

**Observed.** `verifyAndEmit` does not return `false` for a bad proof; it reverts with a string reason such as `Merkle root mismatch`.

**What Vael does.** The base contract lets the revert surface, and the worker preflights every submission with a keyless `eth_call` so a bad proof costs no gas.
Application-level rejections are separate named custom errors, so a failed submission says whether the proof or the rule was the problem.

**Suggestion.** Document the revert shape, so integrators do not write `if (!verified)` branches that can never run.

## 4. Proof material perishes

**Observed.** A proof fetched and held while the attested frontier moves can stop verifying.

**What Vael does.** Proofs are fetched immediately before submission and never cached, in the worker and in the browser.

**Suggestion.** State the validity window of a built proof, if it has one, in the Proof Builder documentation.

## 5. The hosted Proof Builder is not reliable enough alone

**Observed.** The hosted Proof Builder failed to return a proof on the first live portal run and on three of five live runs of the other action types.

**What Vael does.** A second, independent source: `RawProofBuilder` from `@gluwa/usc-sdk` over an ordinary Sepolia RPC.
The Merkle root is re-derived locally before submission, and material from either source verifies identically through the same precompile.
The raw builder is what kept the worker running when the hosted one did not answer.

**Suggestion.** Publish the hosted builder's availability expectations, and recommend the raw builder as a fallback in the SDK documentation.

## 6. Attestation latency on Sepolia is seven to nine minutes

**Observed.** Measured across every live run: 522 seconds over 33 polls in one partner run, about nine minutes in the last worker run, never under seven.
On Ethereum mainnet the frontier lag measured 33 to 36 blocks, about seven minutes.

**What Vael does.** The product is built around it: a quest shows its proof state, the worker resumes across restarts from persisted cursors, and a player who acts too early is told the block is not attested yet rather than shown an error.

**Suggestion.** Publish the expected lag per chain; integrators design very different products for seven minutes than for seven seconds.

## 7. `get_attestation_genesis_height` returns 0 for supported chains

**Observed.** `get_attestation_genesis_height(3)` returns 0 for Ethereum mainnet, which is attested at least 694 days back.
Zero is also the answer for a chain with no configured genesis, so the value cannot be used to tell supported depth.

**Reproduce.** Call it for chain key 3, then call `get_attestation_bounds(3, height)` at increasing depth; the bounds are returned all the way down.

**What Vael does.** Depth is measured by asking about real historical heights instead.
The stride is also worth knowing: near the frontier attestations are ten blocks apart, a thousand blocks back a hundred apart, a million back a thousand apart, so a continuity proof for an old height has further to walk.

**Suggestion.** Return the real genesis, or document that the call is not an indicator of coverage.

## 8. The canonical source transaction hash is not recoverable on chain

**Observed.** The prover's encoding does not let a contract recover the Ethereum transaction hash of what it verified.

**What Vael does.** `recordCompletion` receives `keccak256(chainKey, blockHeight, replayKey)` as the source transaction identifier.
It is unforgeable for the same reason the replay key is, and it is not the Ethereum hash; the worker records the real hash off chain and the interface links to it.

**Suggestion.** Expose the transaction hash from the decoder, or document the recommended identifier.

## 9. `ChainInfo` method names are snake_case

**Observed.** `get_latest_attestation_height_and_hash`, `get_attestation_bounds`, `get_chain_by_key` and the rest are snake_case, unlike every other Solidity interface a consumer will hold.

**What Vael does.** `contracts/src/interfaces/IChainInfo.sol` declares them as they are, with the reasons each one is read.

**Suggestion.** A note in the documentation saves every integrator one failed call.

## 10. Transaction-scoped replay keys strand real transactions

**Observed.** A Uniswap v3 swap emits two ERC-20 `Transfer` logs beside its `Swap`.
With a replay ledger keyed per proved transaction, the first recognised log consumes the transaction's only identity and every further log in it becomes permanently unclaimable.
Vael's first live swap run reverted with `ActionNotYetSupported(1)` for exactly this reason: the first recognised log was a `Transfer` that no quest was claiming.

**What Vael does.** `VaelAscBase` keys replay per log, `keccak256(chainKey, blockHeight, txIndex, logOrdinal)`, with the transaction index recovered from the proof's sibling laterality rather than accepted from the caller.
A recognised log that does not belong to the claim being made is declined and its key released, so a second claim in the same transaction stays possible.

**Suggestion.** Offer a log-scoped replay key in `ASCBase`, or document the limitation of the per-transaction one.

## 11. A caller-supplied dispatch field sits outside the proof

**Observed.** An ASC that takes an action type from the submitter can be handed a valid proof of a benign transaction aimed at a different interpretation of the same bytes, on the code path that releases money.

**What Vael does.** There is no action byte in `SourceTx`; handlers are selected from the emitting address and `topics[0]` of a log that has already been proved, and player identity always comes from an indexed topic, never from the transaction sender.

**Suggestion.** Recommend log-derived dispatch in the ASC guidance.

## Also verified, outside the protocol itself

- The Creditcoin RPC times out `eth_getLogs` after ten seconds; every scan is chunked.
- The RPC returns block objects without `mixHash`, so `forge script --broadcast` cannot send more than one transaction; deployments here are `forge create` and `cast send`, one transaction each, with every slot read back at the block it landed in.
- The EVM target is `shanghai`: no transient storage, no `mcopy`. `block.prevrandao` is 0.
- `finalized` lags `latest`, and an exhausted gas limit looks like a revert.
- Aave v3 on Sepolia refuses USDC and DAI supplies with error 51, `SUPPLY_CAP_EXCEEDED`; the live runs use LINK.

The transactions behind each entry are in [`EVIDENCE.md`](./EVIDENCE.md) and [`ATTESTCOIN_INTEGRATION.md`](./ATTESTCOIN_INTEGRATION.md); the mainnet measurements are in [`MAINNET_SPIKE.md`](./MAINNET_SPIKE.md).
