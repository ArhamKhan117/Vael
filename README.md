# Vael

Do real DeFi on Ethereum.
Prove it on Creditcoin with Attestcoin.
Earn rewards no backend can fake.

Vael is a cross-chain quest game on Creditcoin.
Players complete real DeFi actions on Ethereum Sepolia, the Attestcoin Protocol proves that transaction on Creditcoin, and `QuestASC` verifies the proof on-chain before releasing anything.
Rewards, badges, hero XP, and raid damage are all released by a contract that has verified the proof itself.

No backend key can complete a quest.
`QuestManager.recordCompletion` accepts only the completer the quest's action type names, and nobody else: `QuestASC` for a quest whose action was on Ethereum, `NativePortal` for one whose action is on Creditcoin and which it performs itself in the same transaction.
Hero XP, raid damage, badges and campaign escrow payouts are all behind the same wall.
If our servers go offline, a player can still build the proof in their browser and submit it from their own wallet.

Author: Arham Khan.
Hackathon: BUIDL CTC 2026 Fall, Gaming track.

---

## Why it matters

Quest platforms verify tasks with a centralized indexer and a trusted backend key.
That key is the whole security model: whoever holds it can mint rewards for actions that never happened.

Vael replaces it with a cryptographic proof that an EVM contract checks itself.
The Attestcoin block prover precompile verifies a Merkle proof of the source transaction against an attested Sepolia block header, and `QuestASC` then decodes the receipt, checks the emitting contract against an allowlist, binds the player to the indexed log address, and enforces the amount and block window.
A quest completes because the chain agreed it did.

## The removal test

The claim is that no key can complete a quest. Here is how to check it, in one command, without a
private key and without sending a transaction:

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
Error: execution reverted: QuestManager__OnlyQuestASC(0x017DFB929979AC1b7e1a080c88Db56Bee45846d2)
```

That address is the deployer, which owns every contract in the system, and the selector is
`0xe2a34f59`. The same holds for the two game modules and the partner escrow:

```bash
# VaelHero__OnlyQuestASC(0x017DFB92…) — hero XP arrives only as a hook from QuestASC
cast call 0x6Da74d3F37973FA99eDF8153D2155a9F70235b77 \
  'onQuestCompleted(uint64,uint256,address,uint8,address,uint256,uint8,uint64,bytes32)' \
  1 1 0x017DFB929979AC1b7e1a080c88Db56Bee45846d2 0 \
  0x0000000000000000000000000000000000000000 0 1 0 \
  0x0000000000000000000000000000000000000000000000000000000000000001 \
  --from 0x017DFB929979AC1b7e1a080c88Db56Bee45846d2 \
  --rpc-url https://rpc.cc3-testnet.creditcoin.network
```

`RaidBoss.onQuestCompleted` and `CampaignEscrow.releaseReward` refuse the same way. The only caller
each accepts is `QuestASC`, and the only thing `QuestASC` accepts is a proof the Block Prover
precompile has verified.

`contracts/script/smoke-baseline.sh` runs the whole check, and
`forge script script/VerifyBaseline.s.sol:VerifyBaseline` asserts 95 of these bindings keylessly
against the live deployment.

There is deliberately no completion endpoint in the API. There is no admin function that mints a
badge, no oracle path, and no owner override. The one privileged write in the system was the
migration window that carried heroes and badges onto the redeployed contracts, and both halves of
it are closed and asserted closed.

## Architecture

```mermaid
graph LR
  subgraph Sepolia["Sepolia (source chain, chainKey 1)"]
    QP["QuestPortal.sol<br/>QuestActionPerformed"]
    UNI["Uniswap v3 pools<br/>Swap"]
    AAVE["Aave v3 Pool<br/>Supply / Borrow"]
    ERC["ERC-20 tokens<br/>Transfer"]
  end

  subgraph Attest["Attestcoin Protocol"]
    ATT["Attestors<br/>attest Sepolia blocks"]
    PB["Proof Builder API<br/>merkle + continuity proofs"]
  end

  subgraph CC["Creditcoin testnet (102031)"]
    ASC["QuestASC.sol (VaelAscBase)<br/>verifyAndEmit → decode → rules"]
    QM["QuestManager.sol"]
    RV["RewardVault.sol / CampaignEscrow.sol"]
    BN["BadgeNFT.sol (soul-bound)"]
    HERO["VaelHero.sol"]
    RAID["RaidBoss.sol"]
    PRE["Block Prover precompile 0x0FD2<br/>ChainInfo precompile 0x0FD3"]
  end

  subgraph Off["Off-chain"]
    W["Worker (apps/api)<br/>watch → attest → prove → submit"]
    WEB["Next.js app + Phaser client"]
    DB["Supabase (cache, indexer, academy)"]
    AI["Groq quest generator"]
  end

  QP & UNI & AAVE & ERC -->|events| W
  ATT --> PB
  W -->|getProof| PB
  W -->|submit(proof)| ASC
  WEB -->|self-claim (SDK in browser)| ASC
  ASC --> PRE
  ASC --> QM --> RV & BN
  ASC --> HERO & RAID
  WEB --> QM
  WEB --> DB
  AI --> QM
```

The design principle is **source chain minimal, Creditcoin maximal**.
Sepolia contracts only move assets and emit unambiguous events.
All business logic, rewards, and game state live on Creditcoin.

## The quest loop

1. Browse a quest and accept it on Creditcoin. Acceptance records the latest attested Sepolia height, so only an action taken afterwards can satisfy it.
2. Switch to Ethereum Sepolia and perform the action: a portal check-in, a Uniswap v3 swap, an ERC-20 transfer, or an Aave v3 supply or borrow.
3. Attestors attest the Sepolia block on Creditcoin. In practice this takes about eight minutes.
4. A proof is built for that exact transaction and submitted to `QuestASC`, either by the worker or by the player's own wallet.
5. `QuestASC` verifies the proof through the block prover precompile, decodes the receipt, applies the rule, and releases VAEL, a soul-bound badge, hero XP, and raid damage in one transaction.

## The game

Verified actions do more than pay out. Two modules attach to `QuestASC` as completion hooks and
react to every proof it accepts:

- **`VaelHero`** — a soul-bound ERC-721, one per wallet, free to mint. Each verified action grants
  XP by type (portal 50, transfer 60, swap 100, supply 120, borrow 150), scaled 1.5x at five times
  the quest minimum and 2x at twenty-five, then multiplied by a streak: acting again within about a
  day of the last proved action adds 10% per consecutive day, capped at double. The streak is
  settled against the source block of the proved action, not against wall-clock time, so it cannot
  be gamed by a clock. There is no function that grants XP by hand.
- **`RaidBoss`** — one community boss per season. Damage is `base(action) * (10 + heroLevel) / 10 *
  tier`, so levelling your hero makes you matter more in the raid. When the boss dies the loot pool
  splits by damage share, the last hitter takes a reserved 5%, and every contributor can claim a
  RaidVictory badge.

Both reject any caller that is not `QuestASC`, and both bind to it one-shot. Hooks run after the
reward is paid, inside `try/catch` with a gas cap, so a broken game module can never cost a player
their reward.

Four more modules spend and move what proofs earned, and hold no privilege over the core:

- **`Arena`** — duels for VAEL stakes, fought on chain with the stats a hero earned through proofs.
  The contract writes the whole fight into the event as three bytes per swing and the client
  replays it, so pressing replay twice gives the same fight. Winner takes both stakes less a 2%
  burn.
- **`Loot`** and **`Equipment`** — ERC-1155 items in four slots per hero, escrowed while equipped.
  A raid drop's rarity is a pure function of damage share, so it is earned; only the arena's drop
  table rolls.
- **`Marketplace`** — fixed-price loot sales for VAEL, items escrowed at listing, 2% to the
  treasury.

Adding all four cost no redeploy of the core, and `VerifyBaseline` asserts that none of them is a
hook, a badge minter, or anything QuestASC calls.

`/hero` and `/raid` render with Phaser 3. React owns the wallet, the data, and every write; Phaser
only draws.

`/academy` teaches what a swap, a supply, and a proof actually do: four modules of three lessons and
a five-question quiz, each ending in an action to go and perform for real.
Progress is a bookmark and grants nothing; a module's badge comes from its quest, which QuestASC
mints after verifying a proof like any other.

Every figure on the site is counted from a Creditcoin event or read from a contract.
An empty network shows zeros rather than a placeholder.

## Running the worker and the indexer

Two long-lived processes, deliberately separable.

```bash
pnpm --filter @vael/api worker     # watches Sepolia, proves, submits; also indexes each tick
pnpm --filter @vael/api indexer    # indexes Creditcoin only, signs nothing
```

Both of those run under `tsx`, which is the development shape. The production shape is compiled:

```bash
pnpm --filter @vael/api build
pnpm --filter @vael/api start           # API on :4000, from dist/index.js
pnpm --filter @vael/api start:worker    # dist/bin/worker.js
pnpm --filter @vael/api start:indexer   # dist/bin/indexer.js
```

| | Worker | Indexer |
|---|---|---|
| What it does | Watches allowlisted Sepolia emitters, waits for attestation, fetches a proof, submits it to QuestASC | Reads Creditcoin's own events into the store |
| Signs transactions | yes | **no** |
| Needs `WORKER_PRIVATE_KEY` | yes | no |
| Needs `CREDITCOIN_RPC_URL` | yes | yes |
| Needs `SEPOLIA_RPC_URL` and fallbacks | yes | no |
| Needs `WORKER_STORE` and its credentials | yes | yes |
| Needs the contract addresses | `QUEST_ASC_ADDRESS`, `QUEST_MANAGER_ADDRESS`, `QUEST_PORTAL_ADDRESS`, the adapters | `QUEST_MANAGER_ADDRESS`, `QUEST_ASC_ADDRESS`, `VAEL_HERO_ADDRESS`, `RAID_BOSS_ADDRESS`, `REWARD_VAULT_ADDRESS`, `BADGE_NFT_ADDRESS`, `ARENA_ADDRESS`, `LOOT_ADDRESS`, `EQUIPMENT_ADDRESS`, `MARKETPLACE_ADDRESS` |

The worker indexes as part of each tick, so running both is only needed when you want the read
paths current at a faster cadence than the worker's 30 second poll, or when you want an indexer on a
host that holds no key. Running both is safe: the cursor advances only on a successful scan and
every indexed table is keyed so a replay is idempotent.

`pnpm --filter @vael/api reindex [fromBlock] [--scan]` rewinds the cursor when a new event handler
is added, because the cursor has already passed those blocks and nothing goes back for them
otherwise.

Neither process can complete a quest by itself. The worker submits proofs; `QuestASC` decides
whether they verify.

## Repository

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 app: quests, campaigns, Studio, hero, raid, academy, profile, leaderboard |
| `apps/api` | Express backend: quest agent, Creditcoin indexer, Attestcoin proof worker |
| `contracts` | Foundry project for Creditcoin and Sepolia |
| `docs/SPEC.md` | Source of truth for architecture, contracts, constants, and phases |
| `docs/HACKATHON_REQUIREMENTS.md` | Requirement checklist |

## Stack

- **Web**: Next.js 16, React 19, Tailwind 4, Wagmi 2, Reown AppKit, TanStack Query
- **API**: Express 5, TypeScript, Supabase, Groq via LangChain, viem
- **Contracts**: Foundry, Solidity 0.8.28, OpenZeppelin 5.4
- **Chains**: Creditcoin testnet 102031 for all logic, Ethereum Sepolia 11155111 for source actions

## Running it

```bash
pnpm install
git submodule update --init --recursive

pnpm --filter @vael/web dev     # http://localhost:3001
pnpm --filter @vael/api dev     # http://localhost:4000

cd contracts && forge build && forge test
```

## Run it locally

Two commands. The first builds everything for production and starts all four processes against the
live Creditcoin testnet deployment; the second stops them.

```bash
./scripts/run-local.sh
./scripts/stop-local.sh
```

Then open, from Windows as well as from WSL, because WSL2 forwards localhost:

| | |
|---|---|
| App | **http://localhost:3101** |
| API health | **http://localhost:4000/health** |

It starts four processes, all compiled rather than run through `tsx` or `next dev`, which is the
shape the submission run in `docs/E2E_LOG.md` was recorded in:

| Process | Command | Log |
|---|---|---|
| API | `node dist/index.js` on :4000 | `.logs/api.log` |
| Proof worker | `node dist/bin/worker.js` | `.logs/worker.log` |
| Creditcoin indexer | `node dist/bin/indexer.js` | `.logs/indexer.log` |
| Web | `next start -p 3101` | `.logs/web.log` |

`.logs/` is gitignored. `run-local.sh` refuses to start if either port is already in use, because
two indexers writing the same cursors is worse than an error message, and it waits for both the API
and the web app to actually answer before it claims to have started anything.

Before the first run, copy `apps/api/.env.example` and `apps/web/.env.example` to their real
counterparts and fill them in; every variable is documented in `docs/SPEC.md` section 13. The web
app bakes its contract addresses in at build time, so
`python3 contracts/script/sync-env.py --write` fills them from `docs/ADDRESSES.md` and the build
picks them up.

To run the pieces by hand instead:

```bash
pnpm --filter @vael/api build && pnpm --filter @vael/web build

pnpm --filter @vael/api start           # API,     http://localhost:4000
pnpm --filter @vael/api start:worker    # proof worker
pnpm --filter @vael/api start:indexer   # Creditcoin indexer
pnpm --filter @vael/web start -p 3101   # web,     http://localhost:3101
```

Copy each `.env.example` to its real counterpart and fill it in.
Every variable is documented in `docs/SPEC.md` section 13.
Real env files are ignored and must never be committed.

## Live URLs

**Pending deployment.** The app has not been hosted yet. Every number in this README was produced
by running it locally against the live Creditcoin testnet deployment, which is public and can be
checked without running anything: the addresses below are source-verified on Blockscout and the
transaction hashes in `docs/E2E_LOG.md` resolve in the explorer.

| | URL |
|---|---|
| Web app | pending deployment |
| API | pending deployment |
| Demo video | pending recording |

## Addresses

Twenty-two contracts, all source-verified. The full table with deploy transactions, blocks, the
wiring, and every superseded deployment with the reason it was replaced is in
[`docs/ADDRESSES.md`](./docs/ADDRESSES.md).

| Contract | Creditcoin testnet (102031) |
|---|---|
| `QuestASC` | [`0x05958dD789EaC1de84e864d6b3956C90d3e90d0f`](https://creditcoin-testnet.blockscout.com/address/0x05958dD789EaC1de84e864d6b3956C90d3e90d0f) |
| `QuestManager` | [`0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7`](https://creditcoin-testnet.blockscout.com/address/0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7) |
| `RewardVault` | [`0x89aE45f3B75E20af549715294754292eFf25b89C`](https://creditcoin-testnet.blockscout.com/address/0x89aE45f3B75E20af549715294754292eFf25b89C) |
| `CampaignEscrow` | [`0xcF675302d19967788009592423E4E66bd69EA32b`](https://creditcoin-testnet.blockscout.com/address/0xcF675302d19967788009592423E4E66bd69EA32b) |
| `BadgeNFT` | [`0x6b57F8a913FBC175ff46B53542F23D362e46d8f2`](https://creditcoin-testnet.blockscout.com/address/0x6b57F8a913FBC175ff46B53542F23D362e46d8f2) |
| `VaelHero` | [`0x6Da74d3F37973FA99eDF8153D2155a9F70235b77`](https://creditcoin-testnet.blockscout.com/address/0x6Da74d3F37973FA99eDF8153D2155a9F70235b77) |
| `RaidBoss` | [`0x201Fe44a8E26Ce866A5DB807b29b90710b527c41`](https://creditcoin-testnet.blockscout.com/address/0x201Fe44a8E26Ce866A5DB807b29b90710b527c41) |
| `Arena` | [`0xA8db5D09d539fDa7Cf29707866a72d4B69Cf813B`](https://creditcoin-testnet.blockscout.com/address/0xA8db5D09d539fDa7Cf29707866a72d4B69Cf813B) |
| `Loot` | [`0x2810313DA39b9b8C33a9bc9d4C3bC65AdD8a9072`](https://creditcoin-testnet.blockscout.com/address/0x2810313DA39b9b8C33a9bc9d4C3bC65AdD8a9072) |
| `Marketplace` | [`0x64B80FfE7d54167ACB90D75b73A5459Ea168AbDB`](https://creditcoin-testnet.blockscout.com/address/0x64B80FfE7d54167ACB90D75b73A5459Ea168AbDB) |
| `VaelToken` | [`0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf`](https://creditcoin-testnet.blockscout.com/address/0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf) |
| `QuestPortal` (Sepolia) | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://sepolia.etherscan.io/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) |

## Evidence

| What | Where |
|---|---|
| Every live end-to-end run, with hashes, gas, and timings | [`docs/E2E_LOG.md`](./docs/E2E_LOG.md) |
| How Vael uses Attestcoin, surface by surface, with measurements | [`docs/ATTESTCOIN_INTEGRATION.md`](./docs/ATTESTCOIN_INTEGRATION.md) |
| Deployed addresses, wiring, and the full supersession history | [`docs/ADDRESSES.md`](./docs/ADDRESSES.md) |
| Architecture, contracts, constants, phases, and the decisions not taken | [`docs/SPEC.md`](./docs/SPEC.md) |
| Ethereum mainnet feasibility spike, keyless, with its conditions | [`docs/MAINNET_SPIKE.md`](./docs/MAINNET_SPIKE.md) |
| Requirement checklist with a link per row | [`docs/HACKATHON_REQUIREMENTS.md`](./docs/HACKATHON_REQUIREMENTS.md) |
| Demo script, with the segments that must be pre-recorded and why | [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) |
| Screenshots of every page, taken from the production build | [`docs/evidence/`](./docs/evidence) |

## Status

All contracts are deployed to Creditcoin testnet and source-verified; `docs/ADDRESSES.md` is the
current table. The phase plan and definition of done live in `docs/SPEC.md` section 17.

What is **not** done, stated here rather than left to be discovered: the app is not hosted, the demo
video is not recorded, and the pitch deck is not written.

## License

MIT. See [LICENSE](./LICENSE).
