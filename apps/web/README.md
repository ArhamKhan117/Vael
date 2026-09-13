# @vael/web

Vael's web app.
Next.js 16 App Router, React 19, Tailwind 4, Wagmi 2 with Reown AppKit.

Creditcoin testnet (102031) is the default network: quests, rewards, hero, and raid state live there.
Sepolia (11155111) is the second configured network, because that is where players perform the source action they prove.

## Run

```bash
pnpm install          # from the repo root
pnpm --filter @vael/web dev
```

Opens on `http://localhost:3001`.

Copy `.env.example` to `.env.local` and fill it in.
Every variable is documented beside its name in `.env.example`.
Never commit `.env.local`.

## Layout

| Path | What it is |
|---|---|
| `src/lib/chains.ts` | Creditcoin and Sepolia chain definitions, RPC fallback lists, explorer links |
| `src/lib/reownConfig.ts` | AppKit and Wagmi setup, batching off, fallback transports |
| `src/lib/contracts.ts` | Deployed contract addresses from `NEXT_PUBLIC_*` |
| `src/app/(main)/` | Landing, quests, campaigns, academy, hero, raid, arena, market, leaderboard, profile, feedback, and the rendered README and whitepaper |
| `src/app/dashboard/studio/` | Partner Studio |
| `src/components/` | Shared UI |
| `src/game/` | Phaser scenes for the hero, the raid, and duel replays; they render and never decide |
| `scripts/` | The asset pipeline: `pack-art.mjs` packs the artwork masters into WebP, `make-badges.mjs` and `make-items.mjs` draw the badges and the item catalogue |

## Explorers

Creditcoin links go to Blockscout at `https://creditcoin-testnet.blockscout.com`.
Sepolia links go to `https://sepolia.etherscan.io`.
Both are built by `explorerTxUrl` and `explorerAddressUrl` in `src/lib/chains.ts`.
