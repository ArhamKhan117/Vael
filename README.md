# Vael

Do real DeFi on Ethereum.
Prove it on Creditcoin with Attestcoin.
Earn rewards no backend can fake.

Vael is a cross-chain quest game on Creditcoin.
Players complete real DeFi actions on Ethereum Sepolia, the Attestcoin Protocol proves that transaction on Creditcoin, and `QuestASC` verifies the proof on-chain before releasing anything.
Rewards, badges, hero XP, and raid damage are all released by a contract that has verified the proof itself.

No backend key can complete a quest.
`QuestManager.recordCompletion` is gated by `onlyQuestASC`, and the same is true for hero XP, raid damage, and campaign escrow payouts.
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
  the quest minimum and 2x at twenty-five, and feeds one of strength, agility, or intellect. There
  is no function that grants XP by hand.
- **`RaidBoss`** — one community boss per season. Damage is `base(action) * (10 + heroLevel) / 10 *
  tier`, so levelling your hero makes you matter more in the raid. When the boss dies the loot pool
  splits by damage share, the last hitter takes a reserved 5%, and every contributor can claim a
  RaidVictory badge.

Both reject any caller that is not `QuestASC`, and both bind to it one-shot. Hooks run after the
reward is paid, inside `try/catch` with a gas cap, so a broken game module can never cost a player
their reward.

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

Copy each `.env.example` to its real counterpart and fill it in.
Every variable is documented in `docs/SPEC.md` section 13.
Real env files are ignored and must never be committed.

## Status

Deployed addresses land in `docs/ADDRESSES.md` as each phase ships.
The phase plan and definition of done live in `docs/SPEC.md` section 17.

## License

MIT. See [LICENSE](./LICENSE).
