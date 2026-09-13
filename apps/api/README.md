# @vael/api

Vael's backend.
It creates quests as the registered ERC-8004 agent, caches chain state in Supabase, runs the Attestcoin proof worker, and indexes Creditcoin's own events.

It cannot complete a quest.
`QuestManager.recordCompletion` is gated by `onlyQuestASC`, so only the on-chain verifier can release a reward.
The worker's job is to fetch a proof and submit it; the chain decides whether it is valid.

## Getting started

1. **Supabase**
   Create a project, run `database/schema.sql`, then every file in `database/migrations/` in name order.
   Take `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings, API.

2. **Environment**
   Copy `.env.example` to `.env` and fill it in.
   Every variable is documented beside its name in `.env.example`.
   Never commit `.env`.

3. **Install and run**
   ```bash
   pnpm install          # from the repo root
   pnpm --filter @vael/api dev
   ```
   The server listens on `http://localhost:4000`.

## Layout

| Path | What it is |
|---|---|
| `src/config/env.ts` | Zod-validated environment, matching `.env.example` |
| `src/lib/chains.ts` | Creditcoin testnet and Sepolia chain definitions |
| `src/lib/contracts.ts` | viem clients with a fallback transport, batching off, per-request timeout |
| `src/lib/protocols.ts` | Source-chain protocol and emitter registry |
| `src/routes/` | Quest, campaign, AI, and feedback endpoints |
| `src/services/` | Quest lifecycle, campaigns, IPFS, AI generation, Supabase access |
| `src/cron/` | Expiry-driven quest regeneration |
| `src/attestcoin/` | The proof worker: watcher, attestation wait, proof builder client, submitter, state machine |
| `src/indexer/` | The Creditcoin indexer |
| `src/bin/` | The compiled entry points `start:worker` and `start:indexer` run |

## RPC behaviour

Public endpoints reject JSON-RPC batching and cap `eth_getLogs` ranges; the Creditcoin RPC times out `eth_getLogs` after 10 seconds.
Every client therefore sets `batch: false`, a per-request `RPC_TIMEOUT_MS`, `retryCount: 2`, and a fallback list of endpoints.
Every log scan is chunked.

## Tests

```bash
pnpm --filter @vael/api test
```

## The Attestcoin worker

```bash
pnpm --filter @vael/api worker
```

It watches Sepolia for logs from emitters that quests care about, records what it sees **before**
doing any network work, then walks each submission through
`detected → attesting → proving → submitted → verified`, or `failed` with a reason and an attempt
count.

Persisting first is what makes a restart safe: a crash between observing a log and proving it
leaves a row the next start picks up, rather than losing the player's action. State goes to
Supabase when `SUPABASE_URL` is a real URL, otherwise to `apps/api/.state/worker-state.json`, which
is gitignored.

A thrown error during a step is treated as transient by default: an RPC timeout or a rate limit
counts an attempt, keeps the row's stage, and backs off. Terminal failure is reserved for what
retrying cannot fix, such as a rule the action does not satisfy.

The worker is a convenience, never a trust dependency. It can only submit proofs; the chain decides
whether they are valid, and a player can always claim from their own wallet instead.

### Scripts

| Script | What it does |
|---|---|
| `scripts/e2e-portal.ts` | Full portal loop, and `--replay <tx>` to prove a replay is refused |
| `scripts/e2e-actions.ts` | `--action erc20\|swap\|supply\|borrow`, or `--batch a,b` |
| `scripts/e2e-portal.ts` and friends | `e2e:modules`, `e2e:arena`, `e2e:partner`, `e2e:ai-quest`: one live run each of the game modules, a duel, the partner loop, and an AI quest |
| `scripts/make-quest.ts` | Create one quest on chain, assigned to an address, and stop |
| `scripts/reindex.ts` | Rebuild the index from the deployment's first block |
| `scripts/pin-badges.ts`, `scripts/pin-items.ts` | Pin the badge and item metadata documents |
| `scripts/spike-mainnet.ts` | The keyless Ethereum mainnet feasibility measurement behind `docs/MAINNET_SPIKE.md` |
| `scripts/worker.ts`, `scripts/indexer.ts` | The worker and the indexer under `tsx`, for development |

The action scripts capture the exact proof material to `contracts/test/fixtures/`, which
`contracts/test/RealFixtures.t.sol` replays offline.
