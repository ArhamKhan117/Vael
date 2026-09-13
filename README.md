![Vael](apps/web/public/readme/hero-dark.png#gh-dark-mode-only)
![Vael](apps/web/public/readme/hero-light.png#gh-light-mode-only)

[![BUIDL CTC 2026 Fall](https://img.shields.io/badge/BUIDL%20CTC%202026%20Fall-Gaming%20and%20DeFi%20tracks-000000)](https://github.com/ArhamKhan117/Vael)
![Creditcoin testnet](https://img.shields.io/badge/Creditcoin-testnet%20102031-38BDF8)
![Attestcoin Protocol](https://img.shields.io/badge/Attestcoin-Block%20Prover%20precompile-38BDF8)
![Solidity 0.8.28](https://img.shields.io/badge/Solidity-0.8.28-363636)
![Foundry](https://img.shields.io/badge/Foundry-forge%20test-363636)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000000)
![Tests](https://img.shields.io/badge/tests-349%20passing-2EA043)
![Keyless checks](https://img.shields.io/badge/keyless%20checks-141%20passing-2EA043)
![Contracts verified](https://img.shields.io/badge/contracts-23%20source--verified-FBBF24)
[![Pitch deck](https://img.shields.io/badge/pitch%20deck-PDF-FF4D6D)](https://drive.google.com/file/d/1TTU7AZMM-yirHTD0JFR-vBoYg3fJFHiy/view?usp=sharing)
[![Whitepaper](https://img.shields.io/badge/whitepaper-read-38BDF8)](https://github.com/ArhamKhan117/Vael/blob/main/docs/WHITEPAPER.md)
[![License MIT](https://img.shields.io/badge/license-MIT-lightgrey)](./LICENSE)

**Vael is a quest game on Creditcoin where no key can hand out a reward.**
Players do real DeFi on Ethereum; the Attestcoin Protocol proves the transaction to Creditcoin; a contract verifies the proof itself and only then pays, mints the badge, grants the XP and deals the raid damage.

Built for BUIDL CTC 2026 Fall, Gaming track and DeFi track, by Arham Khan.
[Pitch deck](https://drive.google.com/file/d/1TTU7AZMM-yirHTD0JFR-vBoYg3fJFHiy/view?usp=sharing) · [Whitepaper](https://github.com/ArhamKhan117/Vael/blob/main/docs/WHITEPAPER.md) · [GitHub](https://github.com/ArhamKhan117/Vael)

---

## What Vael is

Vael is a quest platform with a game economy on top of it, and all of it lives on Creditcoin.
A quest asks for one real action: a Uniswap v3 swap, an Aave v3 supply or borrow, an ERC-20 transfer, or a check-in through Vael's own portal contract, on Ethereum Sepolia; or a PenguinSwap swap or a CTC wrap on Creditcoin itself.
The player does it with their own wallet.
When the action is verified, the quest pays VAEL, mints a soul-bound badge, grants XP to the player's hero, and deals damage to the season's raid boss, all in the same transaction.

Around that one verified completion sits a game.
Every wallet can mint one soul-bound hero whose stats are earned, never bought.
Raid bosses fall to the whole community's verified actions and drop loot by share of damage.
Heroes duel in the arena for staked VAEL, resolved deterministically on chain from a seed committed at acceptance.
Loot is ERC-1155, exists only because somebody defeated a boss or won a duel, equips for bonuses, and trades on an escrowed market.
An Academy teaches what a swap, a supply and a proof are, in four modules that each end in a real quest.
Daily and weekly quests are generated from a player's proved history by an AI agent registered under ERC-8004; the model chooses the quest, the chain decides the completion.
Partners fund campaign pools through the Studio and pay only for verified actions.

The rule that makes it different is a small one.
Rewards are released by contracts, inside the receipt of the transaction that verified the proof.
There is no owner function, no backend key and no agent key that can complete a quest, and if Vael's own servers disappear, a player can build the proof in the browser and submit it from their own wallet.

| For | What Vael gives them |
|---|---|
| Players | Earn on Creditcoin for what they already do on Ethereum, and a hero whose every stat is a proved action |
| Partners | Proof-gated campaign budgets: the pool releases inside the verified completion, never on a claim, and refunds any time |
| Creditcoin | A user funnel from Ethereum with no bridge and no oracle operator; CTC pays every gas fee |
| Builders | Attestcoin as a game-engine primitive: adapters and hooks turn any verified event into quests, raids, duels, loot and seasons. MIT licensed |

## Contents

1. [The case for Vael](#the-case-for-vael)
2. [How one quest works](#how-one-quest-works)
3. [Creditcoin and Attestcoin, surface by surface](#creditcoin-and-attestcoin-surface-by-surface)
4. [The game layer](#the-game-layer)
5. [The two completion paths](#the-two-completion-paths)
6. [What is deployed](#what-is-deployed)
7. [Run it locally](#run-it-locally)
8. [No key can pay a player](#no-key-can-pay-a-player)
9. [Evidence](#evidence)
10. [Limitations](#limitations)
11. [Links](#links)

## The case for Vael

### The problem

Quest platforms run on trust, not proof.
Galxe, Layer3, Zealy and every quest site verify tasks with a centralized indexer: a server says done, a key signs the reward, and nothing on chain checked anything.
Partners buy engagement they cannot audit, so sybil farms and bots collect, and the loyalty data is neither portable nor provable.
A new L1 like Creditcoin needs a funnel from where the users are, on Ethereum, without a bridge and without an oracle operator.

### The solution

A completion in Vael is a cryptographic proof of a real Ethereum transaction, verified on Creditcoin by the Block Prover precompile of the Attestcoin Protocol.
Rewards, badges, hero XP, raid damage and partner payouts are released by that verification, in the same transaction.
Actions that happen on Creditcoin itself, which Attestcoin cannot attest, are performed by a contract instead of reported by one.
Take the precompile away and no path remains from an Ethereum action to a reward: not for the operator, not for an admin, not for anyone.

### What it unlocks

A partner campaign, start to finish:

1. **Fund the escrow.** Deposit VAEL; a 0.5% fee is taken and the rest is the pool.
2. **Publish the rule.** Action, contract, minimum amount and reward go on chain with the quest.
3. **Players act** with their own keys, on Ethereum or on Creditcoin.
4. **The pool pays** inside the verified completion, exactly the reward, in the same receipt.
5. **Cancel any time.** Whatever was not earned comes back.

### How it compares

| | Galxe / Layer3 / Zealy | Vael |
|---|---|---|
| Task verification | Centralized indexer and backend rules | Cryptographic proof verified by a precompile on chain |
| Who releases the reward | A company-held key | The contract, inside the receipt of the proof |
| Partner budgets | Paid on claims the partner cannot audit | Escrow releases only on verified actions; refundable |
| Sybil cost | Free accounts, social tasks | Every action is a real gas-paid transaction |
| If the servers go down | Nothing works | Players self-claim from the browser |
| Reputation | Points in a database | Soul-bound hero and badges built from proofs |
| Game economy | Points and raffles | Raids, duels, loot and a market fed only by verified play |

### The market

Quests are the growth engine of web3, and verification is the missing piece.
Galxe alone recorded 184M quest participations in 2025, from 36M+ registered users and about 1.9M unique participant addresses a month, for 7,770 partner projects buying campaigns.
Creditcoin has a community of 60K+ with a live DEX, a launchpad and a wallet, and every project launching on it needs a verified way to acquire and reward users.
Vael is the native quest layer for that ecosystem first, then for every chain Attestcoin attests: Ethereum mainnet is already registered and proved feasible, and each new attested chain is one adapter away.

Sources: Galxe 2025 Year in Review; Messari, Galxe: The Web3 Growth Engine; Creditcoin BUIDL CTC kickoff.

### Business model

Fees on verified value, already in the contracts:

| Fee | Where | Status |
|---|---|---|
| 0.5% campaign escrow fee, adjustable up to 10% by governance | Every partner deposit into `CampaignEscrow` | Live |
| 2% marketplace fee | Every loot sale on `Marketplace` | Live |
| Arena burn | A slice of every resolved duel's stake | Live |
| Studio Pro: targeting by verified history, analytics, featured placement, campaign API | Partners | Next |
| Seasons and cosmetics: season passes, boss skins, hero cosmetics sold for VAEL | Players | Next |
| Verification as a service: the adapters and the worker for other Creditcoin apps | Builders | Next |

### Roadmap

| Stage | What |
|---|---|
| Done | Testnet end to end: five action types, the native path, hero, raid, arena, loot, market, Academy, partner Studio, AI quests, every contract source-verified |
| Q4 2026 | Creditcoin mainnet, VAEL launch through PenguinBase, Credit Wallet integration, first partner campaigns with real budgets |
| H1 2027 | Ethereum mainnet veteran quests; more adapters: Lido, Curve, bridges, NFT mints; guilds and seasons |
| With Attestcoin writability | Claim VAEL rewards and badge attestations back on the source chain; the interface is already declared |

## How one quest works

![How one quest works: accept on Creditcoin, act on Ethereum, the block is attested, a proof is built from public data, QuestASC verifies it at the precompile and pays](apps/web/public/readme/quest-flow.png)

1. **Accept.** `QuestManager.acceptQuest` records the latest Ethereum height Creditcoin has attested. The action has to land after it, so a player cannot claim a transaction they made before taking the quest.
2. **Do the thing.** A Uniswap v3 swap, an Aave v3 supply or borrow, an ERC-20 transfer, or a check-in through Vael's own portal contract, on Ethereum Sepolia, with the player's own wallet.
3. **Attest.** Creditcoin's validators attest the Ethereum block that holds the log. Until they do, no proof of it exists.
4. **Prove.** A Merkle proof of the receipt and a continuity proof of the block, built from public data by Vael's worker or by the player's browser; nothing in either is signed by Vael.
5. **Verify and pay.** `QuestASC` hands the proof to the Block Prover precompile at `0x…0FD2`, then checks the receipt status, the emitting contract against an allowlist, the player against the log's own indexed address, the amount against the rule's minimum, and the block against the window recorded at acceptance. Only then does it record the completion, and the reward, the badge, the XP and the raid damage all follow from that one call.

Every live run, from the Ethereum action to the Creditcoin payout, with every hash: [`docs/EVIDENCE.md`](./docs/EVIDENCE.md).
How each Attestcoin surface is used, with measurements: [`docs/ATTESTCOIN_INTEGRATION.md`](./docs/ATTESTCOIN_INTEGRATION.md).

## Creditcoin and Attestcoin, surface by surface

Vael is built on the protocol, not next to it.

| Surface | How Vael uses it |
|---|---|
| Block Prover precompile `0x…0FD2` | `verifyAndEmit` per proved transaction; a keyless `verify` preflight before any gas is spent |
| ChainInfo precompile `0x…0FD3` | The attested height is anchored at quest acceptance; attestation bounds drive the worker's wait |
| `EvmV1Decoder` | Receipt status, logs and fields decoded on chain; five action types through stateless adapters |
| Proof Builder and a raw builder | Two independent proof sources; the Merkle root is re-derived locally before submission |
| Batch proofs | Up to ten transactions per submission, each carrying its own continuity proof |
| Chain keys 1 and 3 | Sepolia live; Ethereum mainnet registered and proved feasible for veteran quests |

Measured on the live network: a Sepolia attestation takes 7 to 9 minutes; one verified proof with its payout, XP and damage costs about 1.0M gas; two proofs verified in one receipt cost 1.19M.
Replay keys are per log, not per transaction, and player identity always comes from the log's indexed topics, never from the transaction sender.

## The game layer

![The game layer: one verified completion feeds the hero, the raid boss, the arena, loot and the market, badges and VAEL](apps/web/public/readme/game-layer.png)

Every module reads the same completion, and none of them can be paid, damaged or minted any other way.
A hero is soul-bound and earns XP by action type; its streak is measured in Ethereum source blocks, so it cannot be faked with Creditcoin time.
The raid boss takes damage equal to the proof's tier, loot drops by share of damage, and the last hit is on chain.
Duels are a pure function of two heroes' earned stats and a seed committed at acceptance; the round log is emitted by the contract and the replay draws it.
Loot has no owner mint: every item exists because somebody defeated a boss or won a duel, and it is escrowed the moment it is listed.

Game truth lives on Creditcoin.
The Phaser client renders and replays; it never decides an outcome.

## The two completion paths

![Two completion paths: proved through QuestASC after an Attestcoin proof, or native through NativePortal, which performs the Creditcoin action itself](apps/web/public/readme/two-paths.png)

Attestcoin attests other chains to Creditcoin; it does not attest Creditcoin to itself, so a PenguinSwap swap on Creditcoin has no proof to carry.
Rather than add a trusted reporter, Vael has a second contract, `NativePortal`, that **performs** the action: it pulls the player's tokens, calls PenguinSwap's router or wraps CTC, reads what came back, checks it against the quest's rule, and records the completion in the same transaction.
If the swap does not happen, nothing completes.

A quest is filed to one path at creation by its action type, and `QuestManager.recordCompletion` accepts nobody but the path the quest was filed to.
Both release exactly the quest's own reward: from `RewardVault` for an open quest, from the partner's `CampaignEscrow` pool for a campaign quest, whose releasers are a set that changes only after a day's public notice.
The one honest difference between the two paths is written down in [`docs/ATTESTCOIN_INTEGRATION.md`](./docs/ATTESTCOIN_INTEGRATION.md#6d-native-quests-and-the-line-they-do-not-cross), section 6d.

## What is deployed

Twenty-two contracts on Creditcoin testnet and one on Ethereum Sepolia, all source-verified, with deploy transactions, blocks, wiring, and every superseded deployment and the reason it was replaced: [`docs/ADDRESSES.md`](./docs/ADDRESSES.md).

| Contract | Creditcoin testnet (102031) |
|---|---|
| `QuestASC` | [`0x05958dD789EaC1de84e864d6b3956C90d3e90d0f`](https://creditcoin-testnet.blockscout.com/address/0x05958dD789EaC1de84e864d6b3956C90d3e90d0f) |
| `QuestManager` | [`0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7`](https://creditcoin-testnet.blockscout.com/address/0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7) |
| `NativePortal` | [`0xa512544f721230Fa04560078D0dC214423FE2970`](https://creditcoin-testnet.blockscout.com/address/0xa512544f721230Fa04560078D0dC214423FE2970) |
| `CampaignEscrow` | [`0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28`](https://creditcoin-testnet.blockscout.com/address/0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28) |
| `CampaignPayoutHook` | [`0xeeB8A2EEf0D8b4B28D50ce130E7a70b871F621b1`](https://creditcoin-testnet.blockscout.com/address/0xeeB8A2EEf0D8b4B28D50ce130E7a70b871F621b1) |
| `RewardVault` | [`0x89aE45f3B75E20af549715294754292eFf25b89C`](https://creditcoin-testnet.blockscout.com/address/0x89aE45f3B75E20af549715294754292eFf25b89C) |
| `VaelToken` | [`0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf`](https://creditcoin-testnet.blockscout.com/address/0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf) |
| `BadgeNFT` | [`0x6b57F8a913FBC175ff46B53542F23D362e46d8f2`](https://creditcoin-testnet.blockscout.com/address/0x6b57F8a913FBC175ff46B53542F23D362e46d8f2) |
| `VaelHero` | [`0x74befcC907073f5F0125813FEF3A2A22406d3024`](https://creditcoin-testnet.blockscout.com/address/0x74befcC907073f5F0125813FEF3A2A22406d3024) |
| `RaidBoss` | [`0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B`](https://creditcoin-testnet.blockscout.com/address/0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B) |
| `Arena` | [`0xa98672b481c35f76d09612849E75A2c7A1a976d9`](https://creditcoin-testnet.blockscout.com/address/0xa98672b481c35f76d09612849E75A2c7A1a976d9) |
| `Loot` | [`0xFf0271fb151F25cf909d1d8b16017Af54FBb9938`](https://creditcoin-testnet.blockscout.com/address/0xFf0271fb151F25cf909d1d8b16017Af54FBb9938) |
| `Marketplace` | [`0x868Bb518122B670Cd02b93dEeDc6B53DcFA36374`](https://creditcoin-testnet.blockscout.com/address/0x868Bb518122B670Cd02b93dEeDc6B53DcFA36374) |
| `QuestPortal` (Sepolia) | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://sepolia.etherscan.io/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) |

What the deployment holds, read from the chain and the index at Creditcoin block 5479941:

| | |
|---|---|
| Quests on the current `QuestManager` | 44, of which 19 completed |
| Completions proved through Attestcoin | 13 |
| Completions performed by `NativePortal` | 6 |
| Heroes minted | 6 |
| Badges minted | 45 |
| Raid seasons fought | 3, all defeated, 2,900 damage in 16 hits |
| Duels fought | 22, of which 21 resolved and 1 voided |
| Loot dropped | 27 items |
| Market | 13 listed, 4 sold, 86 VAEL of volume |
| Partner pools | 4 funded, holding 1,629.2 VAEL, 770 VAEL released to players |
| VAEL released in all | 2,675 |

## Run it locally

```bash
pnpm install
git submodule update --init --recursive
cd contracts && forge build && forge test && cd ..
```

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then fill them in; every variable is explained in the example files, and `python3 contracts/script/sync-env.py --write` fills the contract addresses from `docs/ADDRESSES.md`.
Real env files are ignored and must never be committed.

Build everything once, then start the four processes against the live Creditcoin testnet deployment:

```bash
pnpm build
pnpm --filter @vael/api start
pnpm --filter @vael/api start:worker
pnpm --filter @vael/api start:indexer
pnpm --filter @vael/web exec next start -p 3101
```

| | |
|---|---|
| App | http://localhost:3101 |
| API health | http://localhost:4000/health |

| Process | What it does |
|---|---|
| API | quest catalogue, campaigns, the Studio's pinning and publishing, the AI quest scheduler |
| Proof worker | watches Ethereum for accepted quests' actions, builds and submits proofs |
| Creditcoin indexer | reads every contract's events into the store the site reads from |
| Web | the Next.js app: board, campaigns, Academy, hero, raid, arena, market, Studio |

The worker and the indexer need no private key that can complete anything: the worker pays gas to submit proofs, and a proof is either valid or it is not.

For development, `pnpm dev:web` serves the app on :3001 and `pnpm dev:api` the API on :4000.

## No key can pay a player

Every quest platform has a key somewhere that a reward contract obeys.
Whoever holds it can pay for an action that never happened, through the intended interface.
Vael's claim is that it has no such key, and the claim is checkable in commands that send nothing and need no key of their own.

The address below is the deployer, which owns every contract in the system.
Asked to complete quest 1, `QuestManager` refuses it and names the only address it would accept:

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

The address it names is `QuestASC`, which completes a quest only inside a call that has just verified an Attestcoin proof at the block prover precompile.
The same wall stands in front of everything a completion produces.
Each of these was run against the live deployment the day this README was written:

| Ask the owner's key to | Contract | Answer |
|---|---|---|
| grant hero XP | `VaelHero.onQuestCompleted` | `VaelHero__OnlyQuestASC(0x017DFB92…)` |
| release VAEL from the vault | `RewardVault.releaseReward` | `RewardVault__OnlyQuestManager` |
| release VAEL from a partner pool | `CampaignEscrow.releaseReward` | `ReleaserSet__NotAReleaser(0x017DFB92…)` |

Remove Vael's worker and a player can build the same proof in the browser and submit it from their own wallet.
Remove the precompile and nothing can complete a quest at all.
There is no address that can be told a swap happened.

## Evidence

| What | Where |
|---|---|
| Every live end-to-end run, with hashes, gas, and timings | [`docs/EVIDENCE.md`](./docs/EVIDENCE.md) |
| How Vael uses Attestcoin, surface by surface, with measurements | [`docs/ATTESTCOIN_INTEGRATION.md`](./docs/ATTESTCOIN_INTEGRATION.md) |
| The architecture as deployed: contracts, adapters, hooks, the agent, the API, the web app | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Deployed addresses, wiring, and the full supersession history | [`docs/ADDRESSES.md`](./docs/ADDRESSES.md) |
| The whitepaper: the argument, the threat model, the measurements | [`docs/WHITEPAPER.md`](./docs/WHITEPAPER.md) |
| Ethereum mainnet feasibility spike, keyless, with its conditions | [`docs/MAINNET_SPIKE.md`](./docs/MAINNET_SPIKE.md) |

Tests: 265 in Foundry, 39 in Jest, 45 in Vitest, and `contracts/script/VerifyBaseline.s.sol` runs 141 keyless checks against the live deployment.

## Limitations

- **Testnet only.** Creditcoin testnet and Ethereum Sepolia. The mainnet spike shows the Ethereum side is feasible without a key; nothing is deployed there.
- **Not hosted yet.** Every number above came from running the app locally against the public deployment; the addresses and hashes can be checked without running anything.
- **A native campaign quest's payout is a hook, not a revert.** `NativePortal` cannot be replaced without a full redeploy, so its payout runs as a hook it calls: an underfunded pool is skipped and said, where `QuestASC` would revert the whole completion. Two early native completions (quests 16 and 29) were made before that hook existed and stay unpaid, because paying them by hand would be the privileged path the escrow refuses to have.
- **A quest's document is fixed at creation.** `QuestManager` has no metadata setter, so a pinned picture or title cannot be changed afterwards; a pool's own document can, through the Studio.
- **Public gateways rate-limit.** Pinned pictures load through public IPFS gateways and sometimes do not; every card falls back to the action's own artwork.
- **The AI scheduler writes to chain.** Daily and weekly quests are generated from a player's proved history by a registered ERC-8004 agent; the model chooses the quest, and the chain still decides the completion.

## Links

| | |
|---|---|
| Pitch deck | [Vael pitch deck (PDF)](https://drive.google.com/file/d/1TTU7AZMM-yirHTD0JFR-vBoYg3fJFHiy/view?usp=sharing) |
| Whitepaper | [docs/WHITEPAPER.md on GitHub](https://github.com/ArhamKhan117/Vael/blob/main/docs/WHITEPAPER.md), also rendered in the app at `/whitepaper` |
| GitHub | [github.com/ArhamKhan117/Vael](https://github.com/ArhamKhan117/Vael) |
| Documentation | [docs/ on GitHub](https://github.com/ArhamKhan117/Vael/tree/main/docs), the README rendered in the app at `/readme` |
| Live website | pending |
| Demo video | pending |
| DoraHacks submission | pending |
| Contact | Arham Khan, [arhamkhansab78616@gmail.com](mailto:arhamkhansab78616@gmail.com) |

## License

MIT. See [LICENSE](./LICENSE).
