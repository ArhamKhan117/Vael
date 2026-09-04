# Final deployment evidence

Screenshots taken on 2026-09-10 against the production web build (`next start -p 3101`) on the
deployment in the current table of [`../ADDRESSES.md`](../ADDRESSES.md). Every number on every page
is read from Creditcoin, either from a contract or from the index the indexer builds from its
events.

Numbers 01 to 05 are the wallet-driven run: one wallet, driven through the real pages by
`apps/web/scripts/final-flow.mjs`, completing a quest from the browser with **the proof worker
stopped**. The rest are the same session touring the app.

| File | What it shows |
|---|---|
| `01-quests-before-connect.png` | the quest board with no wallet: every quest on chain |
| `02-quests-connected.png` | the same board filtered to the connected wallet |
| `03-quest-detail.png` | quest 11 before accepting, with the rule the chain will check |
| `04-quest-accepted.png` | accepted on Creditcoin from the browser |
| `05-quest-awaiting-proof.png` | the honest early failure: the attestors have not covered the block yet |
| `03-quest-before-self-claim.png` | the same quest once the block is attested |
| `04-quest-hash-entered.png` | the Sepolia transaction typed into the self-claim box |
| `05-quest-self-claimed.png` | claimed from the player's own wallet, with the Creditcoin transaction |
| `06-campaigns.png` | partner pools, read from CampaignEscrow |
| `07-hero.png` | the hero after the self-claim: XP, streak, inventory, and the wallet up 75 VAEL |
| `08-raid.png` | season 1 defeated, with the four real damage events |
| `09-arena.png` | two duels, replayed from the round log the contract emitted |
| `10-market.png` | the marketplace |
| `11-studio.png` | the partner studio as a wallet that has funded nothing |
| `12-studio-partner.png` | the partner flow |
| `13-profile.png` | the profile, assembled from verified actions |
| `14-leaderboard.png` | heroes and raid damage, both from proofs |
| `15-quest-board-final.png` | the finished board: eleven quests, two AI-generated, one partner |
| `run-state.json` | what the two halves of the wallet run passed between them |
| `pre-redeploy-state.json` (in `../`) | the state the redeploy had to carry, exported before it |

The transaction hashes behind all of it are in [`../E2E_LOG.md`](../E2E_LOG.md) under
"Final deployment".
