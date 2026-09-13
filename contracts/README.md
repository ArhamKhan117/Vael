# @vael/contracts

Solidity contracts for Vael.
Game and reward logic lives on Creditcoin testnet (chain id 102031); Ethereum Sepolia (11155111) only carries the source actions players perform.

## Layout

| Path | What it is |
|---|---|
| `src/QuestManager.sol` | Quest lifecycle. `recordCompletion` accepts only the completer a quest was filed to |
| `src/QuestASC.sol`, `src/asc/VaelAscBase.sol` | The proof gate: verifies an Attestcoin proof through the Block Prover precompile, decodes the log through an adapter, applies the rule, records the completion |
| `src/adapters/` | Stateless decoders per source event: portal, ERC-20 transfer, Uniswap v3 swap, Aave v3 supply and borrow |
| `src/source/NativePortal.sol` | The second completer: performs a Creditcoin action with the player's tokens and records it in the same transaction |
| `src/source/CampaignPayoutHook.sol` | Pays a campaign quest completed on the native path, as a `NativePortal` hook |
| `src/source/QuestPortal.sol` | Vael's one-event contract on Ethereum Sepolia |
| `src/RewardVault.sol` | Mints and releases VAEL per quest; callable only by QuestManager |
| `src/CampaignEscrow.sol` | Partner-funded reward pools, released only by the releaser set |
| `src/BadgeNFT.sol` | Soul-bound ERC-721 quest badges; callable only by QuestManager |
| `src/game/` | `VaelHero`, `RaidBoss`, `Arena`, `Loot`, `Equipment`, `Marketplace` |
| `src/access/` | `CompleterSet` and `ReleaserSet`: trusted callers changed only on a 24-hour timelock |
| `src/tokens/VaelToken.sol` | VAEL, the ERC-20 reward token |
| `src/erc8004/` | ERC-8004 identity, reputation, and validation registries for quest-creating agents |
| `script/` | One transaction per broadcast script, the keyless `VerifyBaseline` read-back, the verification checkers, and the address tools |
| `test/` | Foundry tests, including replays of captured real-network proof material under `test/fixtures/` |

Until `setQuestASC` is called, no address can complete a quest; once it is, nothing can change it.
The full picture, with the two completion paths and the hook order, is in [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Build and test

```shell
forge build
forge test
```

Foundry is pinned to `solc 0.8.28` on the `shanghai` EVM target, because Creditcoin has no cancun opcodes: no transient storage and no `mcopy`.
`bypass_prevrandao` is on because `block.prevrandao` is 0 on that chain.

`@gluwa/asc-contracts` arrives through pnpm at the repo root and is remapped as `@gluwa/`.
Run `pnpm install` from the root before `forge build` once contracts start importing it.

## Deploying

The Creditcoin RPC returns block objects without `mixHash`, so `forge script --broadcast` fails after the first transaction it sends.
Every script in `script/Deploy.s.sol` therefore broadcasts exactly one transaction and takes its dependencies from environment addresses, and `script/deploy-baseline.sh` runs that sequence for the core with a `cast call` read-back after every write.
Deploy the rest with `forge create`, one contract per command, in dependency order: the adapters, `QuestASC` (which takes `QuestManager`), the game modules, `NativePortal`, and `CampaignPayoutHook`; then bind with one `cast send` per call and read every slot back before moving on.
`QuestManager.setQuestASC` and `setNativePortal` are one-shot, so they come last.
Record the result in `docs/ADDRESSES.md`, run `script/verify-blockscout.sh`, and confirm the wiring keylessly with `script/VerifyBaseline.s.sol`.

Sepolia deployments are ordinary and can use `forge script --broadcast` normally.

Copy `.env.example` to `.env` and fill it in. Never commit `.env`.
