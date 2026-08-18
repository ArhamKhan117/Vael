# @vael/contracts

Solidity contracts for Vael.
Game and reward logic lives on Creditcoin testnet (chain id 102031); Ethereum Sepolia (11155111) only carries the source actions players perform.

## Layout

| Path | What it is |
|---|---|
| `src/tokens/VaelToken.sol` | VAEL, the ERC-20 reward token |
| `src/RewardVault.sol` | Mints and releases VAEL per quest; callable only by QuestManager |
| `src/BadgeNFT.sol` | Soul-bound ERC-721 quest badges; callable only by QuestManager |
| `src/QuestManager.sol` | Quest lifecycle. `recordCompletion` is callable only by QuestASC |
| `src/CampaignEscrow.sol` | Partner-funded ERC-20 campaign pools |
| `src/erc8004/` | ERC-8004 identity, reputation, and validation registries for quest-creating agents |
| `script/` | One broadcast per script (see below) |
| `test/` | Foundry tests |

`QuestASC`, `QuestPortal`, `VaelHero`, and `RaidBoss` land in milestone 3 and milestone 4.
Until `setQuestASC` is called, no address can complete a quest.

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
Every script in `script/Deploy.s.sol` therefore broadcasts exactly one transaction and takes its dependencies from environment addresses.
Deploy in the order listed at the top of that file, wire with one `cast send` per call, and read every slot back with `cast call` before moving on.
Record the result in `docs/ADDRESSES.md`.

Sepolia deployments are ordinary and can use `forge script --broadcast` normally.

Copy `.env.example` to `.env` and fill it in. Never commit `.env`.
