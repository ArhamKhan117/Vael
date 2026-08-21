# How Vael uses the Attestcoin Protocol

Vael is a quest game whose rewards are released by a contract that has verified, on chain, that the
player really did the thing.
There is no trusted backend key anywhere in the completion path.
This document describes exactly how that works, with the deployed addresses and the live evidence.

Status: **milestone 3b complete.** All five action types are decoded end to end on the live networks:
a Vael portal check-in, an ERC-20 transfer, a Uniswap v3 swap, an Aave v3 supply, and an Aave v3
borrow. Every one has a real Sepolia transaction and a real Creditcoin verification, listed in
section 6.

---

## 1. The claim, and how to check it

`QuestManager.recordCompletion` is gated by `onlyQuestASC`, and `QuestManager.setQuestASC` is
one-shot: it reverts if called a second time.
`QuestASC` reaches `recordCompletion` only after the Attestcoin block prover precompile has
returned true for a Merkle and continuity proof of the player's source transaction.

You can check both facts without trusting this document:

```bash
cd contracts
set -a; source .env; set +a
set -a; eval "$(grep -E '^[A-Z0-9_]+=0x' ../docs/ADDRESSES.md | grep -vE '_TX=|_BLOCK=')"; set +a

# 41 keyless assertions over the live deployment, sends nothing:
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
| Creditcoin 102031 | `QuestASC` | [`0x467bF17dcf7A5988dC96b2F8e3Af571169176780`](https://creditcoin-testnet.blockscout.com/address/0x467bF17dcf7A5988dC96b2F8e3Af571169176780) |
| Creditcoin 102031 | `QuestManager` | [`0x152BcBCE43EC8a3Ef1a96485A28967AbEEe95377`](https://creditcoin-testnet.blockscout.com/address/0x152BcBCE43EC8a3Ef1a96485A28967AbEEe95377) |
| Creditcoin 102031 | `PortalAdapter` | [`0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F`](https://creditcoin-testnet.blockscout.com/address/0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F) |
| Creditcoin 102031 | `Erc20TransferAdapter` | [`0x3832FEA301b9206F4415409636cf2A08B68aE2aE`](https://creditcoin-testnet.blockscout.com/address/0x3832FEA301b9206F4415409636cf2A08B68aE2aE) |
| Creditcoin 102031 | `UniswapV3SwapAdapter` | [`0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7`](https://creditcoin-testnet.blockscout.com/address/0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7) |
| Creditcoin 102031 | `AaveV3Adapter` | [`0xFD1fafD1BAa976D67373F745F8c46287b5D6692B`](https://creditcoin-testnet.blockscout.com/address/0xFD1fafD1BAa976D67373F745F8c46287b5D6692B) |
| Sepolia 11155111 | `QuestPortal` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://eth-sepolia.blockscout.com/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) |

Full table, including the superseded deployments, in [ADDRESSES.md](./ADDRESSES.md).

### Protocol addresses used

| Item | Address |
|---|---|
| Block prover precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fD3` |
| Proof Builder API | `https://prover.cc3-testnet.creditcoin.network` |
| Source chain key | Sepolia = `1` |

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
`@gluwa/asc-contracts`; the reasons are security properties, recorded in `SPEC.md` §4.1.

| Property | How |
|---|---|
| Proof before state | `verifyAndEmit` is called first. No storage this contract or its hooks own is written before it returns true. |
| Index from the proof | `txIndex` comes from `calculateTxIndex` over the sibling laterality, never from the caller. It is one field of the replay key, so a caller-supplied index would let one log be claimed under many identities. |
| Success required | `receiptStatus` must be 1. The precompile proves inclusion, not success; a reverted source transaction moved no value. |
| Replay keyed per log | `keccak256(chainKey, blockHeight, txIndex, logOrdinal)`. A transaction-scoped key would strand every quest log after the first in the same transaction. |
| Dispatch from the proof | Handlers are chosen from the verified log's emitter and `topics[0]`. There is no action byte in `SourceTx`. |
| Chain-scoped emitters | `chainKey` is threaded into every hook. The same address exists on more than one chain — our own Sepolia `QuestPortal` happens to share an address with a Creditcoin contract, which is exactly the collision this prevents. |
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
| Only QuestASC completes a quest | `onlyQuestASC`, one-shot binding | `test_RecordCompletion_RevertIf_NotQuestASC` |

## 5b. Two proof sources

The hosted Proof Builder is primary; `RawProofBuilder` over a Sepolia RPC is an independent second
source. This is not theoretical redundancy: the hosted service failed on the very first live portal
run and on three of the five wild-action runs, and the raw builder produced the proof that verified
each time. Either source's material verifies identically on chain, which is the point.

Before any gas is spent, the Merkle root is re-derived locally from the transaction and its sibling
path using the domain-separated tree (`keccak(0x00 ‖ leaf)`, `keccak(0x01 ‖ left ‖ right)`) and
compared with the root the provider returned.

## 6. Live evidence

Full detail in [E2E_LOG.md](./E2E_LOG.md).

| Action | Sepolia tx | Creditcoin tx | Attest wait | Submit gas |
|---|---|---|---|---|
| Portal check-in | [`0x09b24411…13de21d`](https://sepolia.etherscan.io/tx/0x09b244110dd08eb4dd7c755128e4ac4395a0d262835f511dd96cb226913de21d) | [`0xe8d5950d…468e9f`](https://creditcoin-testnet.blockscout.com/tx/0xe8d5950d5545028c5f9695b255b628d5282778e397f3166a9fa6f095cb468e9f) | 534 s | 686,028 |
| ERC-20 transfer | [`0x491881cf…016197`](https://sepolia.etherscan.io/tx/0x491881cf3ccedfb68f086162e83458bc5c9fda4670a08af0690cf6aa55016197) | [`0xf19c66a1…6e0de1`](https://creditcoin-testnet.blockscout.com/tx/0xf19c66a1fc087b84946c271bd2d3160fe044a6bbfcb0478badd43c0dfb6e0de1) | 408 s | 715,526 |
| Uniswap v3 swap | [`0x12131f6e…4601ac`](https://sepolia.etherscan.io/tx/0x12131f6e2e39d4a9d758db142b6f5c0b9bb356074c76ed9ec48e563d014601ac) | [`0xc81c3a1c…6fedbc`](https://creditcoin-testnet.blockscout.com/tx/0xc81c3a1c774d4b56412213418259de0099955f15b218e4915a64bd3636fedcbc) | 473 s | 779,716 |
| Aave v3 supply | [`0xc287d946…1a1c61`](https://sepolia.etherscan.io/tx/0xc287d946fdba4e0a239e8d837d4625c3f596bbcac4c7c6a9695702a4c91a1c61) | [`0x990f8e66…3c10b4`](https://creditcoin-testnet.blockscout.com/tx/0x990f8e66a3c343c1f6832639e3e2ee72f4dcba1dc277cf63ccf8396ea73c10b4) | 502 s | 784,924 |
| Aave v3 borrow | [`0xf8458f11…05d027`](https://sepolia.etherscan.io/tx/0xf8458f11bdb1b5a0b8d293ba55bda5d4bbdb07b86e94833874c01cd44205d027) | [`0x492de6e7…8c851a`](https://creditcoin-testnet.blockscout.com/tx/0x492de6e7487ee9c7c1bbc062ef5989167ed2c6e0b92f6c71a97de78ee98c851a) | 518 s | 774,956 |

Every run released exactly the quest reward, minted a badge, and claimed the replay key. A replay of
the portal transaction was refused at preflight with `AlreadyClaimed` and cost no gas.

The exact proof material for four of these is committed under `contracts/test/fixtures/`, and
`contracts/test/RealFixtures.t.sol` replays those bytes through the real adapters offline, so the
decoding is regression-tested against what the network actually produced rather than against
hand-written shapes.

## 7. Setup

Contracts, tests, and deployment: `contracts/README.md`.
Worker configuration: `apps/api/README.md` and `SPEC.md` §13.
The Attestcoin worker needs only `CREDITCOIN_RPC_URL`, `SEPOLIA_RPC_URL`, `WORKER_PRIVATE_KEY`,
`PROOF_BUILDER_URL`, and the contract addresses; it does not need the Supabase, Groq, or Pinata
credentials, which are validated lazily and only where they are used.

## 8. Known limits

- The canonical Ethereum transaction hash is not recoverable from the prover's encoding, so
  `recordCompletion` receives `keccak256(chainKey, blockHeight, replayKey)` as the source
  transaction identifier. It is unforgeable for the same reason the replay key is, but it is not the
  Ethereum tx hash. The worker records the real hash off chain.
- Writability is not live on the protocol and is out of scope. Vael uses readability only.
- The worker resolves which quest a third-party log belongs to from an operator-supplied mapping.
  A third-party protocol's event cannot name a quest, so until accepted quests are indexed off
  chain the worker needs to be told. Self-claim does not have this limitation: the player supplies
  the quest id.
- Supplying USDC or DAI to Aave on Sepolia reverts with error `51`, `SUPPLY_CAP_EXCEEDED`. The
  public test market is full; the live runs use LINK.
