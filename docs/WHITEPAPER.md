# Vael

**A quest game where no key can hand out a reward.**

Arham Khan.
BUIDL CTC 2026 Fall, Gaming track.
Creditcoin testnet 102031, Ethereum Sepolia 11155111.
Version 1.3.0, September 2026.

---

## Contents

1. [Abstract](#1-abstract)
2. [The problem](#2-the-problem)
3. [Background: Creditcoin and the Attestcoin Protocol](#3-background-creditcoin-and-the-attestcoin-protocol)
4. [No key can pay a player](#4-no-key-can-pay-a-player)
5. [System design](#5-system-design)
6. [The two completion paths](#6-the-two-completion-paths)
7. [The game economy and VAEL](#7-the-game-economy-and-vael)
8. [Security model and threat notes](#8-security-model-and-threat-notes)
9. [Measurements from the live network](#9-measurements-from-the-live-network)
10. [Limitations](#10-limitations)
11. [Roadmap](#11-roadmap)
12. [References](#12-references)

## 1. Abstract

Vael is a cross-chain quest game.
A player does something real on Ethereum, a Uniswap swap, an Aave supply, an ERC-20 transfer, and a contract on Creditcoin pays them for it: a reward in VAEL, a soul-bound badge, experience for a hero, damage against a raid boss.
What is unusual is not the reward but who is allowed to say the action happened.
Nobody is.
The contract that pays has itself verified a cryptographic proof of the Ethereum transaction through the Attestcoin Protocol's block prover, and it accepts no other evidence and no other caller.
For actions that happen on Creditcoin, where there is nothing to prove, a second contract performs the action with the player's own tokens and records the completion in the same transaction, so that again nobody makes a claim.

The document states that claim, explains what enforces it, shows how a reader can check it without a private key, and reports what the live deployment has done: at Creditcoin block 5479941, 44 quests, 19 completed, 13 by proof and 6 by performance, 2,675 VAEL released, 45 badges, 3 raid seasons defeated, 22 duels, 27 items dropped, and not one of those numbers produced by a key.

## 2. The problem

Every quest platform in DeFi works the same way underneath.
A backend watches a chain, decides that a wallet did the thing, and calls a contract to pay out.
The contract trusts that backend, because it has no way to check for itself what happened on another chain.

The indexer is not the weak point.
Indexers can be open source, redundant and reproducible.
The weak point is the key at the end of it: a single address that the reward contract obeys.
Whoever holds that key can pay a reward for an action that never happened, not through a bug but through the intended interface.
Everything else about the platform, the audits, the multisig, the dashboard of verified transactions, sits on top of one address that can simply say a thing is true.

That is the property Vael removes.

## 3. Background: Creditcoin and the Attestcoin Protocol

Creditcoin is an EVM chain.
Its validators attest to the block headers of other chains, and the chain exposes that attestation to contracts through two precompiles.

`ChainInfo` at `0x…0fD3` reports, for a source chain key, the latest height and hash the validators have attested.
The Block Prover at `0x…0FD2` verifies, on chain, that a transaction and its receipt belong to an attested block: given a Merkle proof of the receipt in the block's receipt trie and a continuity proof linking that block to a header the attestors have covered, it returns the receipt's contents or reverts.

Three properties of this matter to the design, and each was measured rather than read:

- **One continuity proof proves one height.** There is no shared batch proof; a batch of ten submissions carries ten continuity proofs. `submitBatch` therefore saves a Creditcoin transaction, not proof material.
- **Attestation lags.** The attested Sepolia frontier advances in steps of about ten source blocks and sat seven to nine minutes behind the head in every live run.
- **Proof material perishes.** The public Proof Builder's index lags the ChainInfo frontier and its material must be fetched immediately before submission; a raw builder over any Sepolia RPC produces material that verifies identically, which is what makes the browser path possible.

Nothing in the protocol attests Creditcoin to itself.
A Creditcoin transaction is in a block Creditcoin produced, and asking the prover for it would be asking the chain to prove itself to itself.
Section 6 is what Vael does about that.

## 4. No key can pay a player

The claim is that no key held by Vael, or by anyone else, can complete a quest.
It is meant to be checked rather than believed, and every check below sends nothing and needs no key.

Ask the deployer, which owns every contract in the system, to complete quest 1:

```bash
cast call 0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7 \
  'recordCompletion(uint256,address,bytes32,bytes32)' \
  1 0x017DFB929979AC1b7e1a080c88Db56Bee45846d2 \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  --from 0x017DFB929979AC1b7e1a080c88Db56Bee45846d2 \
  --rpc-url https://rpc.cc3-testnet.creditcoin.network
```

```
Error: execution reverted: QuestManager__WrongCompleter(0x017DFB929979AC1b7e1a080c88Db56Bee45846d2, 0x05958dD789EaC1de84e864d6b3956C90d3e90d0f)
```

The address it names is `QuestASC`.
The same call from any other address reverts identically, because the caller is compared with one stored address rather than checked for a permission that could be granted.
The same wall stands in front of everything a completion produces, and each of these was run against the live deployment the day this was written:

| Ask the owner's key to | Contract | Answer |
|---|---|---|
| grant hero XP | `VaelHero.onQuestCompleted` | `VaelHero__OnlyQuestASC(0x017DFB92…)` |
| release VAEL from the vault | `RewardVault.releaseReward` | `RewardVault__OnlyQuestManager` |
| release VAEL from a partner pool | `CampaignEscrow.releaseReward` | `ReleaserSet__NotAReleaser(0x017DFB92…)` |

The whole wiring can be re-asserted from the address book in one keyless run:

```bash
cd contracts
set -a; source .env; set +a
set -a; eval "$(grep -E '^[A-Z0-9_]+=(0x|[0-9a-fA-Fx,]+$)' ../docs/ADDRESSES.md | grep -vE '_TX=|_BLOCK=')"; set +a
forge script script/VerifyBaseline.s.sol:VerifyBaseline --rpc-url creditcoin
```

141 assertions, each read off the chain, including that every superseded contract kept no privilege.
It fails the run if any slot disagrees with what is recorded, so a silent rewiring or a stale address book cannot pass.

## 5. System design

### 5.1 One quest, end to end

1. **Create.** A registered ERC-8004 agent, or the partner Studio through it, calls `QuestManager.createQuest` with a verification rule: the action type, the contract that must emit the log, the token, the minimum amount, an optional block window, and whether the player must match. The rule is written once and cannot be changed after a player has accepted.
2. **Accept.** `acceptQuest` records the latest Ethereum height Creditcoin has attested, read from `ChainInfo`. The action must land strictly after it, so a transaction from before the player took the quest cannot be reused.
3. **Act.** The player transacts on Ethereum Sepolia with their own wallet. Vael is not in the transaction.
4. **Attest.** Creditcoin's validators attest the block. Until they do, no proof exists.
5. **Prove.** Vael's worker, or the player's browser, builds a Merkle proof of the receipt and a continuity proof of the block from public data. Neither is signed by Vael.
6. **Verify and pay.** `QuestASC.submit` hands the proof to the Block Prover, then decodes the receipt and checks, for each log: the receipt status is success, so a reverted transaction proves nothing; the emitting contract is on an allowlist, so an event of the right shape from a contract anyone can deploy is refused; the player is the address in the log's indexed topic, never the transaction's `from`, so a relayer cannot claim a sponsored transaction; the amount meets the rule's minimum in the rule's token; and the block is inside the window. Only then does it call `QuestManager.recordCompletion`, which is the single function that marks a quest done.

Each proved log burns a replay key of `keccak(chainKey, blockHeight, txIndex, logOrdinal)`, scoped to the log rather than the transaction, so one transaction that satisfies several quests is several completions and no completion can be replayed.

### 5.2 The contracts

Twenty-two contracts on Creditcoin and one on Ethereum Sepolia, all source-verified; `docs/ADDRESSES.md` holds every address, deploy transaction and supersession.

| Contract | Role |
|---|---|
| `QuestManager` | Quest lifecycle. `recordCompletion` accepts exactly the completer the quest's action type names |
| `QuestASC` | Verifies an Attestcoin proof and applies it: the rule, the replay ledger, the payout, the hooks |
| `NativePortal` | Performs a Creditcoin action and records the completion in the same transaction |
| `RewardVault` | Mints and releases VAEL for open quests, for `QuestManager` only |
| `CampaignEscrow` | Partner pools, released and refunded by a releaser set that changes only after a day's notice |
| `CampaignPayoutHook` | How the native path reaches the escrow (section 6.3) |
| `BadgeNFT` | Soul-bound ERC-721 badges, minted by `QuestManager` and `RaidBoss` only |
| `VaelHero`, `RaidBoss` | Game state, written only by the two completion paths through a timelocked completer set |
| `Arena`, `Loot`, `Equipment`, `Marketplace` | Duels, items, equipping, trading |
| Adapters | One decoder per protocol event: portal, ERC-20, Uniswap v3, Aave v3. Pure, revert-free, registered against a log signature |
| ERC-8004 registries | Identity, reputation, validation: who may create quests, and the record of what the agent's quests did |

Adding a protocol is one `setAdapter` transaction; adding a game module is one `addHook`.
Neither touches the core, and neither can widen what the core accepts.

### 5.3 The worker, the indexer, and the browser

The worker watches Ethereum for the actions of accepted quests, waits for attestation, builds the proof and submits it.
It pays Creditcoin gas and nothing else: it holds no key that can complete anything, and a proof it submits is either valid or refused.
The indexer reads every contract's events into a store the site reads from; it decides nothing and can be rebuilt from the chain.
The browser can do the worker's whole job: build the proof from a public RPC and submit it from the player's own wallet.
That has been done live with the worker stopped, and it is recorded as such.

## 6. The two completion paths

### 6.1 Proved, through `QuestASC`

Section 5.1.
Action types: portal check-in, Uniswap v3 swap, ERC-20 transfer, Aave v3 supply, Aave v3 borrow.
Event: `QuestProofApplied`.

### 6.2 Native, through `NativePortal`

A PenguinSwap swap on Creditcoin, or wrapping CTC into WCTC, carries no Attestcoin proof, and it would be dishonest to pretend otherwise.
What replaces the proof is that nobody makes a claim at all.
`NativePortal` does not observe an action and report it.
It performs the action, inside the transaction that completes the quest, out of the player's own balance:

```
player -> NativePortal.swapViaPenguinSwap(questId, tokenIn, tokenOut, fee, amountIn, minOut)
            safeTransferFrom(msg.sender, ...)             the player's tokens, or it reverts
            ISwapRouter.exactInputSingle(recipient: msg.sender)
            QuestManager.recordCompletion(...)            same transaction, or none of it happened
```

There is no window between the action and the completion in which a claim could be made.
If the swap reverts, the completion reverts.
If the caller is not the assigned participant, has not accepted, or sends less than the minimum, it reverts before a token moves.
Event: `NativeActionApplied`, named differently on purpose, so an indexer cannot mistake a performed action for a proved one.

| | Proved | Native |
|---|---|---|
| Completing contract | `QuestASC` | `NativePortal` |
| Evidence | an Attestcoin proof, verified at `0x…0FD2` | the action itself, in the same transaction |
| Source chain in the hook call | 1 | 0 |
| Campaign payout | `QuestASC` releases from the escrow | `CampaignPayoutHook` releases from the escrow |

A quest is filed to one path at creation by its action type, permanently, and `recordCompletion` reverts with `QuestManager__WrongCompleter` if the other contract calls.

### 6.3 How the native path pays a partner pool

`CampaignEscrow` v1 trusted one releaser, `QuestASC`, and `NativePortal` could not reach it: the first two native campaign completions minted their badges and released nothing.
`NativePortal` cannot be taught to release, because `QuestManager.setNativePortal` is one-shot and a new `NativePortal` is a new `QuestManager` and the nine-contract cascade behind it.
What the deployed `NativePortal` does expose is its hook list.
`CampaignPayoutHook` is that hook: called by `NativePortal` after every native completion, it reads the quest off `QuestManager`, and for a campaign quest releases exactly `rewardPerParticipant` from `CampaignEscrow` v2 to the participant `QuestManager` recorded, once.
It trusts `NativePortal` by address and `QuestManager` for the fact of the completion, and cannot pay a vault quest, pay more than the quest promised, or pay anybody but the recorded participant.

The one difference from `QuestASC`, stated rather than glossed: a hook runs inside `NativePortal`'s `try/catch`, so a pool that cannot cover the reward does not block the completion; the hook emits `CampaignRewardSkipped` and the quest completes unpaid, where `QuestASC` would have reverted.
The API refuses to publish a quest a pool cannot cover and only a releaser can lower a pool, so reaching that corner takes an operator's decision.

## 7. The game economy and VAEL

VAEL is an ERC-20 minted by `RewardVault` for `QuestManager` and by nobody else.
It leaves the vault for a quest `QuestManager` has already marked complete, in the amount the quest promised, and it leaves a partner pool the same way.
There is no owner mint, no treasury emission and no faucet: every unit in circulation traces to a completion.

The game never decides anything.
Every module reads the same completion, through a hook, and none can be paid, damaged or minted any other way:

- **Hero.** One soul-bound ERC-721 per wallet. XP arrives only as a hook from a completion, 50 to 150 by action type, scaled by how far the action exceeded the quest's minimum (tier 1, 2 at five times, 3 at twenty-five). Streaks are measured in Ethereum source blocks, so Creditcoin time cannot fake one. Affinity is the dominant stat.
- **Raid.** A season boss with real hit points. Every point of damage is a completed quest, so the boss falls only because a lot of real DeFi happened. Loot drops by share of damage, and the last hit is recorded.
- **Arena.** Duels for VAEL stakes, fought with stats that were earned. The seed is the hash of a block committed at acceptance and not yet mined, so neither player can see it when they commit; the round log is emitted by the contract, and a duel left past its window can be voided with both stakes returned and nothing burned.
- **Loot, equipment and market.** ERC-1155 items from raid claims and arena wins, with no owner mint. An item is escrowed while equipped and the moment it is listed; sales pay 2% to the treasury.
- **Campaigns.** A partner funds a pool and publishes quests against it. What the partner buys is the guarantee that every unit leaving the pool corresponds to a transaction a contract checked against a rule the partner set: this protocol, this token, this minimum, this window. Unspent budget returns through a releaser, never through an owner.
- **Academy.** Four modules that teach what a swap, a supply and a proof do, each ending in a real quest. Passing a quiz mints nothing; the badge comes from the quest.

The Phaser client renders and replays.
Every number it draws was read from Creditcoin.

## 8. Security model and threat notes

### 8.1 What is locked, and by what

| Gate | What it protects |
|---|---|
| `QuestManager.recordCompletion` | Accepts only the completer the quest's action type names; both bindings are one-shot |
| `RewardVault.onlyQuestManager` | VAEL leaves the vault only for a completed quest |
| `CampaignEscrow`'s releaser set | A pool pays and refunds only through `QuestASC` or `CampaignPayoutHook`; bootstrapped once, every change proposed 24 hours in advance, no owner release |
| `BadgeNFT.onlyMinter` | Badges from `QuestManager` and `RaidBoss` only; the deployer's minting right is revoked and asserted revoked |
| `VaelHero` and `RaidBoss` completer sets | XP and damage only from a completion path; bootstrapped once, every change proposed 24 hours in advance |
| `VaelHero.closeImport()` | Irreversible; after a migration the owner can no longer write hero state |
| `QuestASC.allowedEmitters` | Only a listed contract's event can satisfy a rule |

### 8.2 Threats considered

| Threat | Why it fails |
|---|---|
| A forged action | The Block Prover verifies the receipt against an attested header; a receipt that was not in an attested Ethereum block does not verify |
| A real action, claimed by the wrong wallet | The player is the log's indexed address, never `msg.sender` or the transaction's `from` |
| A real action from before the quest | The block must be strictly above the attested height recorded at acceptance |
| The same action claimed twice | The replay key, scoped to the log, is burned on first use |
| An event of the right shape from an attacker's contract | The emitter must be on `QuestASC`'s allowlist for that action type |
| A reverted transaction with a log in its trace | The receipt status must be success |
| The operator paying a friend | No function does it. Section 4 is the proof, and it can be re-run at any time |
| The operator adding a releaser or a completer that pays them | Possible only through a proposal that is public for 24 hours before it can take effect; and a completer can write XP and damage, not money |
| A malicious or broken game module | Hooks run after the payout, inside `try/catch`, with a gas cap; a hook that reverts produces an event and nothing else. A player's reward never depends on a module being healthy |
| Vael's servers down | The browser builds and submits the same proof from the player's own wallet |
| Creditcoin's attestation wrong | Out of scope. Vael trusts the chain it runs on, and only that |

### 8.3 What is trusted

The Creditcoin validators' attestation of Ethereum headers, and the Block Prover's implementation.
That is the whole trusted computing base for a proved completion.
For a native completion, PenguinSwap's router is trusted to swap, and nothing is trusted to report.

## 9. Measurements from the live network

Read from the chain and the index at Creditcoin block 5479941; every transaction behind them is in `docs/EVIDENCE.md`.

| | |
|---|---|
| Quests on the current `QuestManager` | 44, of which 19 completed |
| Completions proved through Attestcoin | 13 |
| Completions performed by `NativePortal` | 6 |
| VAEL released in all | 2,675 |
| Partner pools | 4 funded, holding 1,629.2 VAEL, 770 VAEL released |
| Heroes minted | 6 |
| Badges minted | 45 |
| Raid seasons | 3, all defeated, 2,900 damage in 16 hits |
| Duels | 22, of which 21 resolved and 1 voided |
| Loot dropped | 27 items; 13 listed, 4 sold, 86 VAEL of volume |

| Measured | Value |
|---|---|
| Attestation wait, Sepolia block to provable | 441 s, 522 s and 534 s over three runs (7 to 9 minutes) |
| Attested frontier step | about 10 source blocks |
| One proof verified and applied by `QuestASC` | 977,956 to 1,031,436 gas |
| Two proofs in one `submitBatch` | 1,194,636 gas, carrying two continuity proofs |
| A native campaign completion, swap and payout in one receipt (quest 43) | 1,534,330 gas; the pool fell by exactly the 120 VAEL reward |
| A campaign pool refund through `QuestASC` | 287,406 gas |
| Keyless wiring assertions passing | 141 |
| Tests | 265 Foundry, 39 Jest, 45 Vitest |

## 10. Limitations

- **Testnet.** Creditcoin testnet and Ethereum Sepolia. Ethereum mainnet is registered as a supported source chain and a mainnet USDC emitter is allowlisted, but no quest is opened against it, because that needs a keyed mainnet endpoint; `docs/MAINNET_SPIKE.md` says what would change.
- **One testnet key.** Deployer, worker and agent controller are the same address today. It can create quests, fund the vault and set rules. It cannot complete a quest, mint a badge, grant XP or move a pool, and section 4 shows it being refused.
- **Attestation is a real wait.** Seven to nine minutes in every measured run, and one continuity proof proves one height.
- **The hosted Proof Builder is not reliable enough alone.** It failed on the first live portal run and on three of five wild-action runs; a raw builder over a Sepolia RPC is an independent second source, and either one's material verifies identically.
- **A native campaign payout is a hook, not a revert.** Section 6.3. Two early native completions, quests 16 and 29, predate the hook and stay unpaid, because paying them by hand would be the privileged path the escrow refuses to have.
- **A quest's document is fixed at creation.** `QuestManager` has no metadata setter.
- **Hosted on testnet infrastructure.** The app runs at https://vaelonline.vercel.app against the public Creditcoin testnet deployment; every number here can be checked there or from a local run.
- **Nothing here makes a bad trade good.** Vael verifies that an action happened, at a size, in a window. It has no opinion about whether it was wise.

## 11. Roadmap

- **Writability.** Publishing Creditcoin state back to Ethereum, so that a hero's level or a badge can be read by an Ethereum contract. It is declared in `contracts/src/interfaces/IVaelOutbound.sol` with zero implementation, so the shape of the game cannot drift into something unpublishable. Nothing outbound could complete a quest in any case; the direction of trust does not change.
- **Ethereum mainnet as a source chain**, once a keyed mainnet endpoint is available: the spike shows the proof path is the same.
- **A native path that reverts.** Folding the campaign payout into a `NativePortal` v2 needs a `QuestManager` redeploy; it belongs to the next cascade, if there is one, not to a patch.
- **Hosting**, a demo video and the pitch, in that order.

## 12. References

- The Attestcoin Protocol and the Block Prover precompile: Creditcoin's documentation, and `docs/ATTESTCOIN_INTEGRATION.md` for how each surface is used here, with measurements.
- ERC-8004, trustless agents: the identity, reputation and validation registries the quest agent is registered with.
- Uniswap v3, Aave v3 and the ERC-20 `Transfer` event, as the source of the actions proved.
- Kenney's CC0 packs for the sprites, credited in `apps/web/public/game/CREDITS.md`.
- `docs/ARCHITECTURE.md` for the system as deployed; `docs/ADDRESSES.md` for every address and supersession; `docs/EVIDENCE.md` for every feature exercised on the live network.
