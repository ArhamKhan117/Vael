# How Vael uses the Attestcoin Protocol

Vael is a quest game whose rewards are released by a contract that has verified, on chain, that the
player really did the thing.
There is no trusted backend key anywhere in the completion path.
This document describes exactly how that works, with the deployed addresses and the live evidence.

Status: **milestone 3a complete.** The Portal action is decoded end to end on the live networks.
Uniswap swaps, ERC-20 transfers, and Aave supply and borrow are milestone 3b and are marked pending
below.

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
| Creditcoin 102031 | `QuestASC` | [`0x983cFa52747708Fe86d125DdFB1Bf67E052793cb`](https://creditcoin-testnet.blockscout.com/address/0x983cFa52747708Fe86d125DdFB1Bf67E052793cb) |
| Creditcoin 102031 | `QuestManager` | [`0x8E42A111295F72c93d3A23181C4C3E13eCbeF220`](https://creditcoin-testnet.blockscout.com/address/0x8E42A111295F72c93d3A23181C4C3E13eCbeF220) |
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

### Portal — live

`QuestActionPerformed(uint256 indexed questId, address indexed player, uint8 indexed actionType,
address token, uint256 amount)`, topic0 `0x3ffa602a…d9d8022`.

| Field | Source |
|---|---|
| emitter | must equal `questPortal[chainKey]`; checked in the recogniser and again in the handler |
| questId | `topics[1]`, compared against the caller's hint, which can only narrow |
| player | `topics[2]` — never the transaction `from` field, which is the gas payer and differs behind routers and smart accounts |
| token | `data` word 0 |
| amount | `data` word 1 |

Then, in order: rule exists → action type matches → chain key matches the quest → quest exists and
is active → player binding → participant has accepted → token → `amount >= minAmount` →
`blockHeight > acceptedAtSourceHeight` → `blockHeight <= maxSourceBlock`.
Each is a separate named revert, so a failure says which rule it broke.

### Pending, milestone 3b

Uniswap v3 `Swap`, ERC-20 `Transfer`, Aave v3 `Supply` and `Borrow`.
The action types exist in the enum today and `QuestASC.isActionSupported` returns false for them, so
a quest created against one fails with `ActionNotYetSupported` rather than silently misbehaving.
The decoding table for all five is in `SPEC.md` §5.3.

## 6. Live evidence

Full detail in [E2E_LOG.md](./E2E_LOG.md).

| | |
|---|---|
| Sepolia check-in | [`0x09b24411…913de21d`](https://sepolia.etherscan.io/tx/0x09b244110dd08eb4dd7c755128e4ac4395a0d262835f511dd96cb226913de21d) |
| Creditcoin verification | [`0xe8d5950d…cb468e9f`](https://creditcoin-testnet.blockscout.com/tx/0xe8d5950d5545028c5f9695b255b628d5282778e397f3166a9fa6f095cb468e9f) |
| Attestation wait | 534 s |
| Submit gas | 686,028 / 1,081,870 |
| Outcome | 100 VAEL released, badge minted, replay key claimed |
| Replay attempt | refused at preflight with `AlreadyClaimed`, no gas spent |

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
- State in the milestone 3a worker is in memory. Persistence to `proof_submissions` is milestone 3b.
