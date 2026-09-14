# How Vael uses the Attestcoin Protocol

Vael is a quest game whose rewards are released by a contract that has verified, on chain, that the
player really did the thing.
There is no trusted backend key anywhere in the completion path.
This document describes exactly how that works, with the deployed addresses and the live evidence.

Status: **complete and deployed.** All five action types are decoded end to end on the live
networks: a Vael portal check-in, an ERC-20 transfer, a Uniswap v3 swap, an Aave v3 supply, and an
Aave v3 borrow. Every one has a real Sepolia transaction and a real Creditcoin verification, listed
in section 6, along with a batch submission, a browser self-claim performed with the worker
stopped, and a proof-gated partner payout.

Nothing described here is written but undeployed. Everything this document claims is on the
addresses in section 2, all of which are source-verified on Blockscout. What Vael does **not** do
is in section 8, which is not a short list.

---

## 1. The claim, and how to check it

`QuestManager.recordCompletion` accepts only the completer that the quest's own action type names,
and reverts with `QuestManager__WrongCompleter` for anybody else. Both bindings are one-shot:
`setQuestASC` and `setNativePortal` each revert if called a second time.

For every quest whose action happens on Ethereum, that completer is `QuestASC`, and `QuestASC`
reaches `recordCompletion` only after the Attestcoin block prover precompile has returned true for a
Merkle and continuity proof of the player's source transaction.

Quests whose action happens on Creditcoin go to `NativePortal` instead, which carries no proof
because it performs the action itself inside the completing transaction. Section 6d is what that
means and why it is not a weaker claim; the two paths cannot be swapped for one another.

You can check both facts without trusting this document:

```bash
cd contracts
set -a; source .env; set +a
set -a; eval "$(grep -E '^[A-Z0-9_]+=0x' ../docs/ADDRESSES.md | grep -vE '_TX=|_BLOCK=')"; set +a

# 95 keyless assertions over the live deployment, sends nothing:
forge script script/VerifyBaseline.s.sol:VerifyBaseline --rpc-url creditcoin

# The deployer is not QuestASC, so this reverts:
cast call $QUEST_MANAGER_ADDRESS \
  "recordCompletion(uint256,address,bytes32,bytes32)" \
  1 $DEPLOYER_ADDRESS $(cast keccak x) $(cast keccak y) \
  --from $DEPLOYER_ADDRESS --rpc-url creditcoin
```

## 2. Deployed pieces

| Where | Contract | Address |
|---|---|---|
| Creditcoin 102031 | `QuestASC` | [`0x05958dD789EaC1de84e864d6b3956C90d3e90d0f`](https://creditcoin-testnet.blockscout.com/address/0x05958dD789EaC1de84e864d6b3956C90d3e90d0f) |
| Creditcoin 102031 | `QuestManager` | [`0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7`](https://creditcoin-testnet.blockscout.com/address/0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7) |
| Creditcoin 102031 | `PortalAdapter` | [`0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F`](https://creditcoin-testnet.blockscout.com/address/0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F) |
| Creditcoin 102031 | `Erc20TransferAdapter` | [`0x3832FEA301b9206F4415409636cf2A08B68aE2aE`](https://creditcoin-testnet.blockscout.com/address/0x3832FEA301b9206F4415409636cf2A08B68aE2aE) |
| Creditcoin 102031 | `UniswapV3SwapAdapter` | [`0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7`](https://creditcoin-testnet.blockscout.com/address/0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7) |
| Creditcoin 102031 | `AaveV3Adapter` | [`0xFD1fafD1BAa976D67373F745F8c46287b5D6692B`](https://creditcoin-testnet.blockscout.com/address/0xFD1fafD1BAa976D67373F745F8c46287b5D6692B) |
| Creditcoin 102031 | `VaelHero` | [`0x74befcC907073f5F0125813FEF3A2A22406d3024`](https://creditcoin-testnet.blockscout.com/address/0x74befcC907073f5F0125813FEF3A2A22406d3024) |
| Creditcoin 102031 | `RaidBoss` | [`0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B`](https://creditcoin-testnet.blockscout.com/address/0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B) |
| Creditcoin 102031 | `CampaignEscrow` | [`0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28`](https://creditcoin-testnet.blockscout.com/address/0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28) |
| Sepolia 11155111 | `QuestPortal` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://eth-sepolia.blockscout.com/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) |

Full table, including every superseded deployment and the reason it was replaced, in
[ADDRESSES.md](./ADDRESSES.md). Nine of these contracts have been replaced together, following the
immutable graph that document describes; the four adapters never were, which is the point of
putting decoding outside the core.

### Protocol addresses used

| Item | Address |
|---|---|
| Block prover precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fD3` |
| Proof Builder API | `https://prover.cc3-testnet.creditcoin.network` |
| Source chain key | Sepolia = `1`, Ethereum mainnet = `3` |

## 3. The flow

1. **Create.** The registered ERC-8004 agent calls `QuestManager.createQuest` with a
   `VerificationRule`. `QuestManager` forwards it to `QuestASC.setRule`, which is write-once per
   quest, so the terms cannot change after a player accepts.

2. **Accept.** `QuestManager.acceptQuest` calls
   `IChainInfo(0x…0fD3).get_latest_attestation_height_and_hash(sourceChainKey)` and stores the
   returned height as `acceptedAtSourceHeight`. This is the time anchor: the proved action must sit
   **strictly above** it, so a player cannot accept a quest and then claim a transaction they
   already made.

3. **Act.** The player calls `QuestPortal.checkIn(questId)` on Sepolia with ETH. The contract emits
   one event and forwards the value; it holds no quest state and decides nothing.

4. **Attest.** Attestors observe Sepolia and record attestations on Creditcoin, roughly every 10
   source blocks. Measured lag on the live network: **534 seconds**. `attest.ts` polls
   `get_latest_attestation_height_and_hash` every 15 seconds up to a 20 minute ceiling. It does not
   use the SDK's precompile-backed wait, whose 60 second default would fail on essentially every
   real transaction.

5. **Prove.** `prove.ts` fetches the proof **immediately before submitting**, because proof material
   perishes: the continuity chain a proof needs grows as attestations advance. The hosted Proof
   Builder is primary and `RawProofBuilder` over a Sepolia RPC is an independent second source. The
   Merkle root is re-derived locally from the transaction and its sibling path, using the
   domain-separated tree (`keccak(0x00 ‖ leaf)`, `keccak(0x01 ‖ left ‖ right)`), and compared with
   the root the provider returned before a single unit of gas is spent.

6. **Submit.** `submit.ts` preflights with `staticCall`, which is free and cannot change state, then
   sends with an explicit gas limit of estimate × 1.5 floored at 400,000. The receipt is confirmed
   at its own block, and `gasUsed` is compared with `gasLimit`, because on Creditcoin an exhausted
   limit is indistinguishable from a revert.

7. **Verify and apply.** Inside `QuestASC.submit`, in this fixed order.

## 4. What the base contract guarantees

`contracts/src/asc/VaelAscBase.sol`. Vael does **not** inherit `ASCBase` from
`@gluwa/asc-contracts`; the reasons are security properties, recorded at the top of that file.

| Property | How |
|---|---|
| Proof before state | `verifyAndEmit` is called first. No storage this contract or its hooks own is written before it returns true. |
| Index from the proof | `txIndex` comes from `calculateTxIndex` over the sibling laterality, never from the caller. It is one field of the replay key, so a caller-supplied index would let one log be claimed under many identities. |
| Success required | `receiptStatus` must be 1. The precompile proves inclusion, not success; a reverted source transaction moved no value. |
| Replay keyed per log | `keccak256(chainKey, blockHeight, txIndex, logOrdinal)`. A transaction-scoped key would strand every quest log after the first in the same transaction. |
| Dispatch from the proof | Handlers are chosen from the verified log's emitter and `topics[0]`. There is no action byte in `SourceTx`. |
| Chain-scoped emitters | `chainKey` is threaded into every hook. The same address exists on more than one chain - our own Sepolia `QuestPortal` happens to share an address with a Creditcoin contract, which is exactly the collision this prevents. |
| Batching is honest | `submitBatch` takes ≤10 members within a 1000 block span, each carrying **its own** continuity proof, verified sequentially, all-or-nothing. One continuity proof proves exactly one height. |

## 5. Decoding

### The adapter design

Decoding lives in stateless contracts implementing `IActionAdapter`, registered per
`(chainKey, topics[0])`:

```solidity
function decode(uint64 chainKey, EvmV1Decoder.LogEntry memory logEntry)
    external view
    returns (bool recognised, uint8 actionType, address player,
             address token, uint256 amount, uint256 questIdFromEvent);
```

An adapter is handed a log the block prover has **already verified** and says what it means. It
holds no privilege, cannot widen what is accepted, and must never revert on a malformed log; it
returns `recognised = false`, because a revert would strand every quest log beside it in the same
transaction.

The split exists because `QuestManager.setQuestASC` is one-shot: replacing QuestASC means
replacing the manager too. Adding a protocol now costs one `setAdapter` transaction instead of a
multi-contract redeploy.

`QuestASC` retains everything that matters. In `_handleRecognisedLog` the order is: find the
adapter, decode, resolve the quest id, check the rule's action type, then apply. The **emitter
allowlist is checked in `_isRecognised`**, before the base contract claims a replay key, so a log
from an impostor contract is never consumed. Which allowlist applies depends on what the adapter
decided the log is, which is why the decode happens first.

### The five actions

| Action | Event | Emitter check | player | token | amount | Names a quest? |
|---|---|---|---|---|---|---|
| Portal | `QuestActionPerformed` | the registered `questPortal[chainKey]` | `topics[2]` | `data[0]` | `data[1]` | yes, `topics[1]` |
| Erc20Transfer | `Transfer` | allowlisted token | `topics[1]` (`from`) | the emitter | `data[0]` | no |
| UniswapSwap | `Swap` | allowlisted v3 pool | `topics[2]` (`recipient`) | pool's token0/token1 for the positive side | the **positive** amount | no |
| AaveSupply | `Supply` | Aave v3 Pool | `topics[2]` (`onBehalfOf`) | `topics[1]` (reserve) | `data[1]` | no |
| AaveBorrow | `Borrow` | Aave v3 Pool | `topics[2]` (`onBehalfOf`) | `topics[1]` (reserve) | `data[1]` | no |

Only Vael's own portal event can name a quest, because Vael wrote it. Every third-party protocol
emits events that know nothing about Vael, so those submissions must carry a `questIdHint`.

Three of these are decisions that a careless implementation gets wrong:

- **Uniswap: the input side is the positive amount.** A v3 `Swap` reports both amounts from the
  pool's point of view, so positive is what the pool received. That is the side the player
  committed. Reading the negative side would let a favourable price satisfy a "swap at least X"
  quest without the player ever putting up X. The player is `recipient`, never `sender`, which
  behind a router is the router.
- **Aave: the player is `onBehalfOf`, not `user`.** `user` is whoever called the Pool, which behind
  a gateway is a contract. `onBehalfOf` owns the position that changed. Crediting `user` would let
  a gateway satisfy every quest.
- **ERC-20: a four-topic `Transfer` is rejected.** ERC-721 emits a `Transfer` with the same
  signature hash and the token id as a fourth indexed topic. Decoding it would read an NFT id as a
  token amount.

### One transaction, several logs

A real transaction carries several recognised logs: a Uniswap swap emits two ERC-20 `Transfer`s
beside its `Swap`. `_handleRecognisedLog` returns a boolean, and a log that is recognised but does
not belong to the quest being claimed is **declined**, with its replay key released rather than
burned. Already-claimed logs are skipped for the same reason, so a second quest in the same source
transaction stays claimable after the first is proved. If nothing applies and a claimed log was the
obstacle, the revert is still `AlreadyClaimed`, so a preflight can tell a replay from a mismatch.

## 5a. Security checklist, as implemented

| Requirement | Where it is enforced | Test |
|---|---|---|
| Proof before any state change | `VaelAscBase._verifyAndIngest` step 1 | `test_NoStateWrittenWhenProofFails` |
| Transaction index from the proof, not the caller | `calculateTxIndex` over sibling laterality | replay key tests |
| Receipt status must be 1 | step 4, before any log is read | `test_ReceiptStatusZeroRejected` |
| Replay, per log | `claimedLog[keccak(chainKey, height, txIndex, logOrdinal)]` | `test_Replay_SameLogRejected`, `test_SecondLogInSameTxHasItsOwnKey` |
| Emitter allowlisted, per chain and action | `QuestASC._isRecognised` | `test_UnallowlistedEmitterIsNotRecognised` |
| Same address on another chain does not count | `chainKey` in every lookup | `test_SameAddressOnAnotherChainDoesNotCount` |
| Player binding | rule `playerMustMatch` against the accepting participant | `test_PlayerMismatchRejected` |
| Player never from the transaction sender | indexed topic in every adapter | `test_Portal_PlayerComesFromIndexedTopicNotFrom` |
| Amount at or above the minimum | `_applyCompletion` | `test_AmountBelowMinimumRejected` |
| Action after acceptance | strictly above `acceptedAtSourceHeight` | `test_BlockAtAcceptedHeightRejected` |
| Batch all-or-nothing | `submitBatch` reverts as a whole | `test_Batch_AllOrNothing` |
| Adapters never revert | fuzzed over arbitrary logs | `testFuzz_AdaptersNeverRevertOnArbitraryLogs` |
| Only QuestASC completes a proof quest | dispatch on the action type, one-shot binding | `test_RecordCompletion_RevertIf_NotTheQuestsCompleter` |
| NativePortal cannot complete a proof quest | same dispatch, from the other side | `test_TheNativePortalCannotCompleteAProvedQuest` |
| QuestASC cannot complete a native quest | `QuestManager__WrongCompleter` | `test_QuestASCCannotCompleteANativeQuest` |

## 5b. Two proof sources

The hosted Proof Builder is primary; `RawProofBuilder` over a Sepolia RPC is an independent second
source. This is not theoretical redundancy: the hosted service failed on the very first live portal
run and on three of the five wild-action runs, and the raw builder produced the proof that verified
each time. Either source's material verifies identically on chain, which is the point.

Before any gas is spent, the Merkle root is re-derived locally from the transaction and its sibling
path using the domain-separated tree (`keccak(0x00 ‖ leaf)`, `keccak(0x01 ‖ left ‖ right)`) and
compared with the root the provider returned.

## 6. Live evidence

Every transaction, with block and gas, in [EVIDENCE.md](./EVIDENCE.md).

Everything in this section was performed against processes built for production rather than run
with `tsx`, on the deployment that was current at the time; the superseded addresses are in
`ADDRESSES.md`, and the same paths exercised on the current deployment are tabulated in
`EVIDENCE.md`.

### The five action types

Each of the five was proved live on the current deployment or the one before it. The Aave borrow
is the oldest of them, proved through the same adapter and the same code path against the same
emitter as the supply.

| Action | Sepolia tx | Creditcoin tx | Attest wait |
|---|---|---|---|
| Portal check-in | [`0x4a9dfaf5…9fd38b`](https://sepolia.etherscan.io/tx/0x4a9dfaf51f7da7ce068243b7dcda1312a202ce67122b7fed1df110ca2b9fd38b) | [`0x5fea44b8…7df3c0`](https://creditcoin-testnet.blockscout.com/tx/0x5fea44b8aebebc8c8bd5dc1c0802a304bab3cb315058081a498ea606bf7df3c0) | 504 s |
| ERC-20 transfer | [`0x13751dbf…95a5aa`](https://sepolia.etherscan.io/tx/0x13751dbf6774b0440464876c5972c3628a55dddb9c82a8b56ff9a2c04295a5aa) | [`0xb4dc2664…58fa0a`](https://creditcoin-testnet.blockscout.com/tx/0xb4dc2664afe75739ddbd20c8cbe6bdce2ef1fec4989cf576bee562144358fa0a) | 439 s, batched |
| Uniswap v3 swap | [`0x33ff996f…6a5d4d`](https://sepolia.etherscan.io/tx/0x33ff996f282662b63476a8a41013c69c9dcb4e09fee0a2ecb8660b92cc6a5d4d) | [`0xb4dc2664…58fa0a`](https://creditcoin-testnet.blockscout.com/tx/0xb4dc2664afe75739ddbd20c8cbe6bdce2ef1fec4989cf576bee562144358fa0a) | 439 s, batched |
| Aave v3 supply | [`0x3a2337ba…affffb`](https://sepolia.etherscan.io/tx/0x3a2337ba867cf5ff9dc094124ffda80ed25e636ec9b0981c905d658a8caffffb) | [`0x1080c5a7…9ea18e`](https://creditcoin-testnet.blockscout.com/tx/0x1080c5a7eb78fe70b381715c426b834061966d23ca255a43b292dd359e9ea18e) | 471 s |
| Aave v3 borrow | [`0xf8458f11…05d027`](https://sepolia.etherscan.io/tx/0xf8458f11bdb1b5a0b8d293ba55bda5d4bbdb07b86e94833874c01cd44205d027) | [`0x492de6e7…8c851a`](https://creditcoin-testnet.blockscout.com/tx/0x492de6e7487ee9c7c1bbc062ef5989167ed2c6e0b92f6c71a97de78ee98c851a) | 518 s, on QuestASC v3 |

Every run released exactly the quest's reward, minted a badge, and burned the replay key.

### Batching

`submitBatch` carried the ERC-20 transfer and the Uniswap swap above in one Creditcoin transaction,
[`0xb4dc2664…58fa0a`](https://creditcoin-testnet.blockscout.com/tx/0xb4dc2664afe75739ddbd20c8cbe6bdce2ef1fec4989cf576bee562144358fa0a), four Sepolia blocks
apart, for **1,194,636 gas**. It carried **two** continuity proofs, ten roots and six: one
continuity proof proves exactly one source height, so batching saves the second Creditcoin
transaction rather than the proof material.

The two members came from **different proof sources**, the raw block and the Proof Builder API, and
verified identically through the same precompile.

### Replay is refused, and it costs nothing

The worker had detected the ERC-20 transfer before the batch claimed it. On restart it tried:

```
failed 0x13751dbf…95a5aa: AlreadyClaimed(0xa303f091192e90c4ba9f638f412d0b6a93c8e494db763f9dbecddf5703b6af0f)
failed 0x2a874aff…55ad83: NothingRecognised(1, 11675334, 79)
```

Both at preflight, through `eth_call`, so neither cost gas. The second is the worker guessing wrong
about which quest a nearby `Transfer` belonged to and being refused, which is the intended shape:
the worker narrows, QuestASC decides.

### The proof path without the worker

Quest 11 was accepted in the browser, acted on Sepolia, and completed by the player's own wallet
fetching the proof from the Proof Builder and calling `verifyAndEmit`:
[`0x1dab0174…913912`](https://creditcoin-testnet.blockscout.com/tx/0x1dab017412f69afaa9e506b91507dd2828068e9b05dd3b0e994f502e96913912). **The worker was
stopped for the whole of it.**

### Proof-gated partner payouts

A partner funded a 995 VAEL pool, published a quest against it, and the escrow released **exactly
the quest's reward, 250 VAEL**, in the same receipt as the proof:
[`0xfa37db6f…a4f273`](https://creditcoin-testnet.blockscout.com/tx/0xfa37db6f50688a559710c456c937f0dd68d47433ec5f73d38c47cf429fa4f273). The cancelled
campaign's remaining 745 VAEL was returned through `QuestASC.refundCampaign`:
[`0xf2c62f9e…0d7399`](https://creditcoin-testnet.blockscout.com/tx/0xf2c62f9e8e25d5d1f123d961a0b0b08bbce05fd0b47818284ec054a3f30d7399).

`CampaignEscrow.releaseReward` accepts only its releaser set: QuestASC, which reaches it only after
the precompile has verified a Merkle proof and a continuity proof, and `CampaignPayoutHook`, which
reaches it only inside a completion `NativePortal` has just performed. A partner's money cannot
leave the escrow except behind a real transaction.

### Fixtures

The exact proof material for four earlier runs is committed under `contracts/test/fixtures/`, and
`contracts/test/RealFixtures.t.sol` replays those bytes through the real adapters offline, so the
decoding is regression-tested against what the network actually produced rather than against
hand-written shapes.

## 6a. Game state changes only through verified proofs

Hero XP and raid damage are not awarded by a backend, a cron job, or an owner function. They arrive
as `ICompletionHook` callbacks from `QuestASC`, after it has verified an Attestcoin proof, and each
module rejects any caller that is not QuestASC:

```solidity
// VaelHero.onQuestCompleted and RaidBoss.onQuestCompleted both begin
if (msg.sender != questASC) revert ...OnlyQuestASC(msg.sender);
```

`setQuestASC` is one-shot on both, so no later owner action can point them at something that has
not verified a proof. Neither module has any other externally reachable way to write hero XP or
boss damage.

You can check that without trusting this document:

```bash
# Reverts: the deployer is not QuestASC.
cast call $VAEL_HERO_ADDRESS "onQuestCompleted(uint64,uint256,address,uint8,address,uint256,uint8,uint64,bytes32)" \
  1 1 $DEPLOYER_ADDRESS 0 0x0000000000000000000000000000000000000000 0 1 0 $(cast keccak x) \
  --from $DEPLOYER_ADDRESS --rpc-url creditcoin
```

### The receipts

One Creditcoin transaction carries the proof, the payout, and both game modules' reactions:

| Transaction | Events |
|---|---|
| [`0x5fea44b8…7df3c0`](https://creditcoin-testnet.blockscout.com/tx/0x5fea44b8aebebc8c8bd5dc1c0802a304bab3cb315058081a498ea606bf7df3c0) | `QuestCompleted`, `QuestProofApplied`, `RewardReleased`, `BadgeMinted`, `HeroXPGranted`, `RaidDamage` |
| [`0xef665faf…7d37d3`](https://creditcoin-testnet.blockscout.com/tx/0xef665faf2a5fb0a4a738993f3fc3a96618d85ef039009692f4f1ca03f97d37d3) | the same, plus `RaidDefeated` |

Five verified portal actions on the current deployment took a hero from level 3 to level 4, took a
500 HP boss to zero, and paid a 1,000 VAEL loot pool to its single contributor.

**The streak multiplier is visible in that run.** A portal action is worth 50 base XP, and the five
were worth 90, 95, 100, 100 and 100 because the hero's streak ran from 8 to 12: the multiplier is
`1 + 0.1` per consecutive day of proved activity, capped at double. 485 XP rather than 250. The
streak is settled against the source block of the proved action, not against wall-clock time, so it
cannot be moved by a clock.

Every number is reproducible from the formulas and the proofs in `docs/EVIDENCE.md`.

### Hooks cannot hold a reward hostage

Each hook runs after the payout, inside `try/catch`, with a 400,000 gas cap. A hook that reverts or
runs out of gas produces a `HookFailed` event and nothing else: the player still has their VAEL and
their badge. Covered by tests that register a deliberately reverting hook and a deliberately
gas-burning one and assert the reward lands anyway.

This is also why a defeated boss is harmless rather than an error. `RaidBoss.onQuestCompleted`
returns early when the season is over, so a quest completing between seasons still pays.

## 6b. AI quests, generated from verified data only

Vael generates personal quests with a language model. The interesting part is not that it does, but
what it is allowed to see and what it is allowed to decide.

**The model is given only what the chain has verified.**
Its input is the verified-action index, every row of which exists because Creditcoin emitted
`QuestProofApplied` after checking a Merkle proof and a continuity proof, plus the player's hero read
from `VaelHero`.
It never sees a raw wallet feed, so it cannot reason about a transaction nobody proved.
`GET /ai/profile/:address` returns exactly that input and nothing else, so a generated quest can be
audited against the same facts that produced it.

**The model does not choose a contract address.**
It picks an action type from a fixed list and a difficulty; the server maps that to the emitter and
token from its own configuration, which are the same addresses QuestASC's allowlist already holds.
A model that could name an address could name one it invented, and a hallucinated emitter inside a
`VerificationRule` is a quest that accepts the wrong log.
Amounts and rewards are clamped to a band the server sets, so a hallucinated `rewardVael` of a
million cannot drain the vault.

**The output is validated before it reaches the chain.**
A Zod schema rejects anything outside the bands, and the quest is created through the ordinary
`QuestManager.createQuest` path from the ERC-8004 registered agent, so its reputation accrues to
the generator exactly as it would for a human-authored quest.
Metadata is pinned to IPFS first and the quest carries the CID.

| | |
|---|---|
| Model | `openai/gpt-oss-20b` via Groq |
| Temperature | 0.2 |
| Validation | Zod, `draftSchema` in `apps/api/src/services/personalQuest.ts` |
| Cadence | daily at 09:00 and weekly on Monday at 10:00, plus `POST /ai/personal-quest` |
| Recipients | every address the index shows has minted a hero |

### The prompt, verbatim

A generated quest is only auditable if the instruction that produced it is written down.

```
You design one quest for one player of Vael, a game where every reward is released by an on-chain
proof of a real DeFi action on Ethereum Sepolia.

You are given only what the chain has verified about this player. Nothing here is self-reported.

Player: {address}
Hero: {heroLine}
Verified actions so far: {totalProved}
By type: {byType}
Most recent: {recent}

Pick ONE action type for their next quest from exactly this list: portal, uniswapSwap,
erc20Transfer, aaveSupply, aaveBorrow.

Rules you must follow:
- Choose an action that moves this player forward. A player with nothing proved should be given
  "portal", the simplest action. A player who has only ever done one type should be nudged towards
  a different one.
- "difficulty" is a multiplier on the action's base minimum, from 1 to 50. Keep it near 1 for a new
  player and raise it for a player with many verified actions.
- "rewardVael" is between 10 and 500 and should scale with difficulty.
- "badgeLevel" is 1 to 5 and should scale with difficulty.
- "reasoning" must cite what the player has actually proved. Do not invent history.
- Never name a contract address. The server chooses those.

{formatInstructions}
```

`{formatInstructions}` asks for a bare JSON object with `title`, `summary`, `action`, `difficulty`,
`rewardVael`, `badgeLevel` and `reasoning`, and the parser strips a code fence if the model adds one
anyway.

### What it produced, live

On the current deployment the generator was asked for a daily quest for each test wallet. Both were
created on chain with their metadata pinned, and both cite a history the index built from
`QuestProofApplied` alone.

| | Deployer, daily | player2, daily |
|---|---|---|
| Quest | 10 | 9 |
| Title | Lending Basics | Swap Your Way Forward |
| Action | `aaveSupply` | `uniswapSwap` |
| Difficulty | 3 | 2 |
| Reward | 120 VAEL | 50 VAEL |
| Metadata | `ipfs://QmY9ZNCbLrRKfXpzcXAv731ptR2qJd6HyfQQVU9NQWjWMW` | `ipfs://QmNfVEfsbTUTgqgdrqX3pxj3nb43qbfNPEEmjCess6E4Zn` |

The deployer's profile at that moment was `portal 5, uniswapSwap 1, erc20Transfer 1, aaveSupply 0,
aaveBorrow 0`, every one of those counts a verified proof from the same afternoon, and the model
said:

> The player has verified portal, uniswapSwap, and erc20Transfer actions but has not yet performed
> any Aave interactions. Introducing an aaveSupply quest will diversify their DeFi experience and
> encourage them to explore lending protocols.

player2's profile was a single portal proof, and it got a Uniswap swap at a lower difficulty for a
smaller reward. The difficulty and the reward differ between the two for that reason, which is the
behaviour the profile exists to produce.

**The model chose the action type and the difficulty. The server chose the emitter and the token**,
from its own allowlist. That is why quest 10's rule names aLINK rather than the USDC a model might
prefer: the public Aave test market's USDC and DAI supply caps are full, and the server knows that
and the model does not. A model that could name an emitter could name any contract, so it never
gets to.

Quest 10 was then completed through the ordinary path with no further involvement from the
generator: a real Aave v3 supply on Sepolia, an Attestcoin proof, and 120 VAEL released by QuestASC
in [`0x1080c5a7…9ea18e`](https://creditcoin-testnet.blockscout.com/tx/0x1080c5a7eb78fe70b381715c426b834061966d23ca255a43b292dd359e9ea18e).

## 6c. Writability: what changes, and what does not

Attestcoin today proves one direction. A transaction on Ethereum becomes a fact Creditcoin can
verify, and Vael is built entirely on that. Writability is the return leg, letting Creditcoin state
become a fact Ethereum can verify. It is **not live**, and Vael implements nothing for it.

`contracts/src/interfaces/IVaelOutbound.sol` declares what Vael would publish, with exact arguments
and zero implementation. Writing it now is not speculation for its own sake: it pins down what Vael
would say, so the shape of the game does not quietly drift into something that cannot be published.

### The two publications

| | What it says | What it is not |
|---|---|---|
| `publishRewardClaim` | This player completed this quest and earned this much, and here is the replay key of the proof that settled it | Not an instruction to pay. The redeeming side verifies the publication; it does not trust a message |
| `publishBadgeAttestation` | This address holds this badge, at this level and rarity | Not a transferable token. Badges are soul-bound here, and the attestation says only that somebody holds one |

Every argument is derived from state the chain already holds: the reward comes from QuestManager,
the replay key from the inbound proof QuestASC burned, the badge fields from BadgeNFT. There is no
argument a caller supplies that the chain has not already agreed to. That is the same rule that
governs the inbound direction, and for the same reason: a caller-supplied field sitting outside the
proof is exactly how a valid proof gets aimed at the wrong interpretation.

### What does not change

- **Quest completion stays inbound-only.** Nothing outbound can complete a quest, and nothing
  outbound is a second way to be paid. The only path to a reward remains a verified proof through
  `QuestASC`.
- **The replay ledger stays log-scoped.** An outbound publication carries the same `replayKey` the
  inbound proof burned, so the two directions reconcile against one identifier rather than two.
- **Nothing becomes transferable.** A soul-bound badge published elsewhere is still soul-bound; the
  publication is a statement, not a copy.

### What would change

- A new contract implementing `IVaelOutbound` would be deployed and given the right to read
  QuestManager and BadgeNFT. It would hold no privilege over either.
- The Studio and the profile page would gain a "redeem on Ethereum" affordance, which is a UI
  change on top of an unchanged completion path.
- `docs/ADDRESSES.md` would gain one address. No existing contract needs replacing, because the
  outbound contract reads state rather than mutating it, which is why it is declared as a separate
  interface rather than as methods bolted onto QuestASC.

## 6d. Native quests, and the line they do not cross

Every quest described above happens on Ethereum and is settled on Creditcoin against an Attestcoin
proof.
There is a second kind: a quest whose action happens on Creditcoin itself, through PenguinSwap.
These are not Attestcoin-verified, and the reason is worth stating plainly rather than burying.

### Why they carry no proof

Attestcoin proves that something happened on a chain Creditcoin cannot see.
A PenguinSwap swap happens on Creditcoin, in a block Creditcoin produced, in a transaction the EVM
is executing right now.
Asking the Block Prover to prove it would mean asking Creditcoin to prove Creditcoin to itself, and
waiting several minutes for an attestation of a block it already has.
That is not extra security. It is a longer path to the same certainty, and dressing it up as
verification would make the word mean less everywhere else in this document.

### What replaces the proof

Nothing replaces it, because nothing needs to.

`NativePortal` does not observe the action and then attest to it.
It **performs** the action, inside the completing transaction, out of the player's own balance:

```
player -> NativePortal.swapViaPenguinSwap(questId, tokenIn, tokenOut, fee, amountIn, minOut)
            safeTransferFrom(msg.sender, ...)          the player's tokens, or it reverts
            ISwapRouter.exactInputSingle(recipient: msg.sender)
            QuestManager.recordCompletion(...)         same transaction, or none of it happened
```

There is no window between the action and the completion in which a claim about the action could be
made.
If the swap reverts, the completion reverts with it.
If the player has not accepted the quest, is not the assigned participant, or sends less than the
rule's minimum, `_checkedRule` reverts before any token moves.

The replay key is `keccak256(chainid, block.number, questId, player)`, which is the completion's own
position rather than a foreign log's.
It is not comparable to a proof-path key and is not meant to be: it is unforgeable for the same
reason the transaction is.

### The two paths cannot be confused for one another

This is enforced in four places, not by convention:

| | Proof path | Native path |
|---|---|---|
| Completing contract | `QuestASC` | `NativePortal` |
| Action types | `Portal`, `UniswapSwap`, `Erc20Transfer`, `AaveSupply`, `AaveBorrow` | `PenguinSwapSwap`, `WrapNative` |
| Event | `QuestProofApplied` | `NativeActionApplied` |
| Chain key in the hook call | the source chain, 1 or 3 | `0` |

`QuestManager.createQuest` reads the rule's action type and files the quest into exactly one of the
two, at creation, permanently: an action type at or above `FIRST_NATIVE_ACTION` becomes a native
quest and its rule never reaches `QuestASC`; anything below it registers a rule on `QuestASC` and
`NativePortal` will refuse it with `NativePortal__NotNativeQuest`.
`recordCompletion` then dispatches on that same flag and reverts with `QuestManager__WrongCompleter`
if the wrong contract calls.
So `NativePortal` cannot complete a Sepolia quest even if it wanted to, and `QuestASC` cannot
complete a PenguinSwap quest.

The event names differ deliberately.
An indexer that treated `NativeActionApplied` as a proof would be reporting something false, and
naming both events the same thing would have made that mistake easy.

### Why this is honest rather than a shortcut

The thing this project refuses is a **trusted key**: a backend that watches a chain, decides a
player did something, and calls `recordCompletion`.
That is what the whole proof path exists to avoid, and the native path does not reintroduce it:

- `NativePortal` has no privilege to say an action happened. It only has the ability to make one
  happen, with the player's own tokens, at the player's own instruction.
- The player is `msg.sender` throughout. Nobody can perform a native quest on somebody else's
  behalf, because the tokens come out of the caller and the quest is checked against the caller.
- The deployer cannot complete a native quest any more than it can complete a proved one. Calling
  `recordCompletion` directly still reverts, and `swapViaPenguinSwap` on somebody else's quest
  reverts with `NativePortal__NotTheParticipant`.
- The rewards are the same rewards, released by the same `RewardVault` under the same
  `onlyQuestManager` gate, through the same two hooks in the same order.

The honest summary is: a native quest is proved by being executed, and a Sepolia quest is proved by
Attestcoin, and the difference is which chain the action was on rather than how much trust it takes.

### What it costs

A native quest is one transaction and roughly ten seconds, against a Sepolia quest's two
transactions and several minutes of waiting for attestation coverage.
That is the point of it for a new player: the first quest anyone does should not begin with
bridging test ETH and end with a five-minute wait.
It is not the point of the project, and the campaign quests, the partner payouts and the raid all
still run on proofs.

## 7. Setup

Contracts, tests, and deployment: `contracts/README.md`.
Worker configuration: `apps/api/README.md` and `apps/api/.env.example`.
The Attestcoin worker needs only `CREDITCOIN_RPC_URL`, `SEPOLIA_RPC_URL`, `WORKER_PRIVATE_KEY`,
`PROOF_BUILDER_URL`, and the contract addresses; it does not need the Supabase, Groq, or Pinata
credentials, which are validated lazily and only where they are used.

## 8. Known limits

Each protocol-level entry below is also written up as a filable issue, with a reproduction and a
suggestion, in [ATTESTCOIN_FINDINGS.md](./ATTESTCOIN_FINDINGS.md); the base contract that acts on
them is documented for reuse in [`contracts/src/asc/README.md`](../contracts/src/asc/README.md).

Everything here is true of the live deployment. Nothing in this document describes a feature that
is written but not deployed; anything that once was is now either deployed or listed below.

### Attestcoin and the proof path

- The canonical Ethereum transaction hash is not recoverable from the prover's encoding, so
  `recordCompletion` receives `keccak256(chainKey, blockHeight, replayKey)` as the source
  transaction identifier. It is unforgeable for the same reason the replay key is, but it is not the
  Ethereum tx hash. The worker records the real hash off chain.
- Attestation latency is seven to nine minutes on Sepolia, measured at 522 seconds over 33 polls in
  one partner run. Nothing in Vael can shorten it. The product is built around it: a quest
  shows its proof state, the worker resumes across restarts, and a demo has to pre-record the wait.
- One continuity proof proves exactly one source height, so a batch submission still costs one
  continuity proof per distinct block. Batching helps when several actions land in the same block
  or the same attestation pass.
- Proof material perishes. It is fetched immediately before submission, never cached.
- Writability is not live on the protocol and is out of scope. Vael uses readability only.
  `IVaelOutbound` declares the two publications Vael would make, and nothing implements it.
- Ethereum mainnet, chainKey 3, is registered on QuestASC with one allowlisted emitter and is
  provable, and **no quest is open against it**. `docs/MAINNET_SPIKE.md` returns go conditionally
  on a keyed mainnet RPC endpoint, and the submission does not assume one.
- A third-party protocol's event cannot name a quest, so the worker narrows a log to one of the
  player's open quests. The narrowing is a filter, not a decision: a wrong guess is refused by
  QuestASC. Self-claim does not have the question at all.
- Supplying USDC or DAI to Aave on Sepolia reverts with error `51`, `SUPPLY_CAP_EXCEEDED`. The
  public test market is full; the live runs use LINK.

### The game modules

- **The arena seed still has a validator-shaped residual.** `accept` commits
  `seedBlock = block.number + 2` and `resolve` uses `blockhash(seedBlock)`, so there is exactly one
  seed per duel and a resolver cannot shop for a better one by waiting; that was the exploitable
  part and it is gone. What remains is that whoever produces `seedBlock` influences its hash, which
  every blockhash scheme carries and only a VRF removes.
- **A duel must be resolved within 250 blocks of its seed block**, because `blockhash` reaches back
  256. One that is not can be voided by either player, returning both stakes with nothing burned,
  so no money is trapped; but it is a duel that never happened rather than a result.
- The arena and the marketplace are pure Creditcoin systems. They spend and move what proofs
  earned, and no proof is involved in a duel or a sale. Only the stats a duel reads and the items a
  sale moves came from verified proofs.

### The badge and hero migration

When nine contracts were replaced together, three kinds of state did not come with them, and the
old contracts remain readable at the addresses in `docs/ADDRESSES.md`:

- **Loot balances already dropped to players.** `Loot` has no owner mint, by design, and adding one
  to migrate a testnet balance would have put a privileged mint beside a system whose whole claim is
  that drops are earned. The item registry was re-registered; the balances were not.
- **Quest ids and raid seasons restart at 1.** Every completed quest and burnt replay key from
  before the redeploy is readable on QuestManager v6 and QuestASC v5. The first season on RaidBoss
  v2 is the second season Vael has run.
- **Badge history before the redeploy.** All ten badges were re-minted onto BadgeNFT v3 at their
  original token ids and to their original owners, so an old link resolves, but the mint
  transactions are the migration's, not the original completions'. The original `BadgeMinted` events
  are on BadgeNFT v2.

Re-minting needed the deployer to be a badge minter for the length of the migration, and importing
heroes needed an owner-writable window on VaelHero. Both are closed, irreversibly in the hero's
case, and `VerifyBaseline` asserts both.

### Elsewhere

- `Quest.rewardToken` is filled from `RewardVault.vaelToken()` for every quest, so on a campaign
  quest it names the protocol's token rather than whatever `CampaignEscrow.rewardToken()` is. Both
  are VAEL today. Changing the field needs a core redeploy, so the product does not read it for
  this: the API derives who pays from the quest's `campaignId`, and every card, quest page and
  studio row says "campaign escrow" or "reward vault" from that instead. A partner paying in a
  different token would still need the field itself to come from the escrow.
- The deployer, the worker, and the ERC-8004 agent controller are one testnet key. Nothing in the
  design requires that; it is a convenience of a single-operator testnet deployment, and the removal
  test is what makes it harmless.
