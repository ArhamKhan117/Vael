# @vael/api

Vael's backend.
It creates quests as the registered ERC-8004 agent, caches chain state in Supabase, and, from milestone 3, runs the Attestcoin proof worker.

It cannot complete a quest.
`QuestManager.recordCompletion` is gated by `onlyQuestASC`, so only the on-chain verifier can release a reward.
The worker's job is to fetch a proof and submit it; the chain decides whether it is valid.

## Getting started

1. **Supabase**
   Create a project, run `database/schema.sql`, then every file in `database/migrations/` in name order.
   Take `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings, API.

2. **Environment**
   Copy `.env.example` to `.env` and fill it in.
   Every variable is documented in `docs/SPEC.md` section 13.
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
| `src/config/env.ts` | Zod-validated environment, matching `docs/SPEC.md` section 13 |
| `src/lib/chains.ts` | Creditcoin testnet and Sepolia chain definitions |
| `src/lib/contracts.ts` | viem clients with a fallback transport, batching off, per-request timeout |
| `src/lib/protocols.ts` | Source-chain protocol and emitter registry |
| `src/routes/` | Quest, campaign, AI, and feedback endpoints |
| `src/services/` | Quest lifecycle, campaigns, IPFS, AI generation, Supabase access |
| `src/polling/` | Creditcoin event mirroring |
| `src/cron/` | Expiry-driven quest regeneration |

`src/attestcoin/` lands in milestone 3: watcher, attestation wait, proof builder client, submitter, state machine, indexer.

## RPC behaviour

Public endpoints reject JSON-RPC batching and cap `eth_getLogs` ranges; the Creditcoin RPC times out `eth_getLogs` after 10 seconds.
Every client therefore sets `batch: false`, a per-request `RPC_TIMEOUT_MS`, `retryCount: 2`, and a fallback list of endpoints.
Every log scan is chunked.

## Tests

```bash
pnpm --filter @vael/api test
```
