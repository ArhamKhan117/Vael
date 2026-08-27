# Deployed addresses

All Vael game state lives on Creditcoin testnet (chain id 102031).
Ethereum Sepolia (11155111) carries the source actions players prove, plus `QuestPortal`.

Every address below was read back from the chain with `cast call` at the block its write landed in.
Re-assert the whole wiring at any time, keylessly and without sending a transaction:

```bash
cd contracts
set -a; source .env; set +a
set -a; eval "$(grep -E '^[A-Z0-9_]+=0x' ../docs/ADDRESSES.md | grep -vE '_TX=|_BLOCK=')"; set +a
forge script script/VerifyBaseline.s.sol:VerifyBaseline --rpc-url creditcoin
```

Deployer, worker, and ERC-8004 agent controller are currently one testnet key.
Its public address is [`0x017DFB929979AC1b7e1a080c88Db56Bee45846d2`](https://creditcoin-testnet.blockscout.com/address/0x017DFB929979AC1b7e1a080c88Db56Bee45846d2), recorded as `DEPLOYER_ADDRESS` in the local `.env` files.

## Creditcoin testnet (102031)

| Contract | Address | Deploy tx | Block | Source |
|---|---|---|---|---|
| `VaelToken` | [`0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf`](https://creditcoin-testnet.blockscout.com/address/0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf) | [`0xd54ad8a7…e9109b`](https://creditcoin-testnet.blockscout.com/tx/0xd54ad8a7214211bb7885bf92306668f95d5ba98141354971a2a6886a85e9109b) | 5455359 | verified |
| `RewardVault` | [`0x89aE45f3B75E20af549715294754292eFf25b89C`](https://creditcoin-testnet.blockscout.com/address/0x89aE45f3B75E20af549715294754292eFf25b89C) | [`0x8ad7d74e…a70268`](https://creditcoin-testnet.blockscout.com/tx/0x8ad7d74eed4b3adb8a156814ff088fa86702c45a84a747fd4cd159b56ea70268) | 5455574 | verified |
| `BadgeNFT` | [`0xC3FF8f522408fF5FB2192519E70b875a9754aa94`](https://creditcoin-testnet.blockscout.com/address/0xC3FF8f522408fF5FB2192519E70b875a9754aa94) | [`0x0d043ac4…d1fa85`](https://creditcoin-testnet.blockscout.com/tx/0x0d043ac4248c7d17fd393ed3c67f9beacab83dd557cf9b534f7e248b96d1fa85) | 5459459 | verified |
| `QuestManager` | [`0xD701A48cc22224Ca4679178db7a749dC68725EFD`](https://creditcoin-testnet.blockscout.com/address/0xD701A48cc22224Ca4679178db7a749dC68725EFD) | [`0x7a1251b5…2f6720`](https://creditcoin-testnet.blockscout.com/tx/0x7a1251b5c9a70bd6140192510aa7fd27a0120eaf13badb5e5858267c9f2f6720) | 5459463 | verified |
| `QuestASC` | [`0x929eabBe43d498e7BA47BB69e8C9432703e969Aa`](https://creditcoin-testnet.blockscout.com/address/0x929eabBe43d498e7BA47BB69e8C9432703e969Aa) | [`0x4c7317c9…2c39ad`](https://creditcoin-testnet.blockscout.com/tx/0x4c7317c91235fd131e300b3e542e34d46cd2e55e9df44587a81a15ab012c39ad) | 5459464 | verified |
| `PortalAdapter` | [`0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F`](https://creditcoin-testnet.blockscout.com/address/0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F) | [`0xf9596fbd…8fe7c94`](https://creditcoin-testnet.blockscout.com/tx/0xf9596fbdf6e1aa693d251cbe6bc5f24294683992c4d5cef596a78ee828fe7c94) | 5458012 | verified |
| `Erc20TransferAdapter` | [`0x3832FEA301b9206F4415409636cf2A08B68aE2aE`](https://creditcoin-testnet.blockscout.com/address/0x3832FEA301b9206F4415409636cf2A08B68aE2aE) | [`0xef8b6a28…b0df12`](https://creditcoin-testnet.blockscout.com/tx/0xef8b6a28941cd98ca273add4a12180558bdaca6d60e63a645d99235aabb0df12) | 5458014 | verified |
| `UniswapV3SwapAdapter` | [`0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7`](https://creditcoin-testnet.blockscout.com/address/0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7) | [`0xcf9eb35e…c05952`](https://creditcoin-testnet.blockscout.com/tx/0xcf9eb35e244a609eabe19340ced2d592c926a83160b5c27ec5c67810dbc05952) | 5458010 | verified |
| `AaveV3Adapter` | [`0xFD1fafD1BAa976D67373F745F8c46287b5D6692B`](https://creditcoin-testnet.blockscout.com/address/0xFD1fafD1BAa976D67373F745F8c46287b5D6692B) | [`0xe5a85953…49d5a9`](https://creditcoin-testnet.blockscout.com/tx/0xe5a859535f8771140b58fc7c4b2f43f42d1c1d95823dfd7db1334c030e49d5a9) | 5458016 | verified |
| `CampaignEscrow` | [`0xcF675302d19967788009592423E4E66bd69EA32b`](https://creditcoin-testnet.blockscout.com/address/0xcF675302d19967788009592423E4E66bd69EA32b) | [`0x29615203…c952f6`](https://creditcoin-testnet.blockscout.com/tx/0x29615203d1eec38c099ba3aa4f30bf0389a64eee783eed0fbc6be62137c952f6) | 5455363 | verified |
| `VaelHero` | [`0x8bE97BeBB253d7F660529e23e093F18645Fc974b`](https://creditcoin-testnet.blockscout.com/address/0x8bE97BeBB253d7F660529e23e093F18645Fc974b) | [`0xcc5bc0cd…515987`](https://creditcoin-testnet.blockscout.com/tx/0xcc5bc0cdf2bb45bf482f724e3f6bead4711d29afdc632bff8548637790515987) | 5459460 | verified |
| `RaidBoss` | [`0xE9BB305bCe2466f2Ee2739D499cb18f8721415F6`](https://creditcoin-testnet.blockscout.com/address/0xE9BB305bCe2466f2Ee2739D499cb18f8721415F6) | [`0x9ad78bf5…bc989d`](https://creditcoin-testnet.blockscout.com/tx/0x9ad78bf5d060aefa85c963c91c47a74bf184ce6689ea5d09910aa8223cbc989d) | 5459462 | verified |
| `IdentityRegistry` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://creditcoin-testnet.blockscout.com/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) | [`0x6f86014b…dfb2b1`](https://creditcoin-testnet.blockscout.com/tx/0x6f86014bc5cc229dd6fff10e995351ae976836753f4853c5e646c9ac53dfb2b1) | 5455348 | verified |
| `ReputationRegistry` | [`0x87BC59dC9d6967Aec15A415ce5E1Ffd4CdFDaA2a`](https://creditcoin-testnet.blockscout.com/address/0x87BC59dC9d6967Aec15A415ce5E1Ffd4CdFDaA2a) | [`0xa8ba9347…fadc03`](https://creditcoin-testnet.blockscout.com/tx/0xa8ba9347d0031a1de20c80000afdbafe8d67a035ab59b1afe6b29f8d10fadc03) | 5455356 | verified |
| `ValidationRegistry` | [`0x9BE39f19b55792285D495302D872160dB2285a65`](https://creditcoin-testnet.blockscout.com/address/0x9BE39f19b55792285D495302D872160dB2285a65) | [`0x0e56c603…6bd9ca`](https://creditcoin-testnet.blockscout.com/tx/0x0e56c603808ddc5724251ecbf0fd29dbc31fa156b2f8e89617e25ac1326bd9ca) | 5455357 | verified |
| `AgentRegistryAdapter` | [`0xfac6a1D56F8C24687973cd505A4cb7c7ffB0cc8d`](https://creditcoin-testnet.blockscout.com/address/0xfac6a1D56F8C24687973cd505A4cb7c7ffB0cc8d) | [`0x8f77ab8f…11d4f4`](https://creditcoin-testnet.blockscout.com/tx/0x8f77ab8f6ffa44bfdd2a5e06456ee84b046da6f19a9b2ec100a07bcc5711d4f4) | 5455358 | verified |

Every contract is source-verified on Blockscout. Re-check with
`contracts/script/check-verification.sh`, which asks the explorer what it actually holds rather
than trusting the `OK` that `forge verify-contract` prints on submission. That distinction matters:
QuestASC v3 was submitted successfully and stayed unverified for a day, and the submit output gave
no hint. `verify-blockscout.sh` now ends by running the checker.

### Adapters

Decoding lives outside the core so that adding a protocol costs one `setAdapter` transaction rather
than a redeploy of QuestASC, QuestManager, and the escrow together. An adapter is a pure decoder
over an already-proved log: it holds no privilege and cannot widen what is accepted.

| Adapter | Event | Registered for |
|---|---|---|
| `PortalAdapter` | `QuestActionPerformed` | chainKey 1 |
| `Erc20TransferAdapter` | `Transfer` | chainKey 1 |
| `UniswapV3SwapAdapter` | `Swap` | chainKey 1, holds the pool token pairs |
| `AaveV3Adapter` | `Supply` and `Borrow` | chainKey 1 |

### Sepolia emitters allowlisted

| Action | Emitters |
|---|---|
| Portal | `QuestPortal` |
| Erc20Transfer | WETH9, Circle USDC, Aave test USDC, DAI, WETH, LINK |
| UniswapSwap | USDC/WETH 0.05% `0x3289680d…AEfF1`, USDC/WETH 0.3% `0x6Ce0896e…9b50` |
| AaveSupply, AaveBorrow | Aave v3 Pool `0x6Ae43d32…8951` |

### What each one is

- **`VaelToken`** — ERC-20 reward token, VAEL, 18 decimals
- **`RewardVault`** — Mints and releases VAEL per quest. Callable only by QuestManager
- **`BadgeNFT`** — ERC-721 quest badges. Mintable only by QuestManager and RaidBoss. The **deployed v2 is transferable and carries no rarity**; the soul-bound v3 with a `Rarity` enum is written and tested but not deployed, see SPEC §17.1
- **`QuestManager`** — Quest lifecycle. `recordCompletion` is `onlyQuestASC`
- **`CampaignEscrow`** — Partner-funded campaign pools
- **`VaelHero`** — Soul-bound hero. `grantXP` is `onlyQuestASC`
- **`RaidBoss`** — Season boss. `dealDamage` is `onlyQuestASC`
- **`IdentityRegistry`** — ERC-8004 agent identity
- **`ReputationRegistry`** — ERC-8004 agent reputation
- **`ValidationRegistry`** — ERC-8004 validation records. QuestManager's authorization here was granted then revoked: it holds the registry as an immutable but calls nothing on it, so the privilege was unused
- **`AgentRegistryAdapter`** — Resolves a controller to a live agent id

## Wiring transactions

One transaction per call, each slot read back at the block it landed in.

| Call | Tx |
|---|---|
| `RewardVault.setVaelToken(VaelToken)` | [`0xe6fdb24b…2b16c2`](https://creditcoin-testnet.blockscout.com/tx/0xe6fdb24b0de342454eb6135e712b3235352016cd84e1619d8630b3e3c82b16c2) |
| `RewardVault.setQuestManager(QuestManager)` | [`0x3b62bee1…570bc4`](https://creditcoin-testnet.blockscout.com/tx/0x3b62bee1c53b70f0280f2db1b467b7abad3f2b09cb3880973c0bd8fa72570bc4) |
| `BadgeNFT.setQuestManager(QuestManager)` | [`0x3a101f64…cb8349`](https://creditcoin-testnet.blockscout.com/tx/0x3a101f64c4865dde5918023216dbc162535909d0ebca9e97fef4cd6356cb8349) |
| `VaelToken.grantMinterRole(RewardVault)` | [`0x601f3424…d025f7`](https://creditcoin-testnet.blockscout.com/tx/0x601f3424293d87fc3d492c313c1d81cb31daed5b021839919fadf799b2d025f7) |
| `ReputationRegistry.setReviewerAuthorization(QuestManager)` | [`0x40f5f0fa…93d0b4`](https://creditcoin-testnet.blockscout.com/tx/0x40f5f0fa5e00c6b6fa36233ef12b7660a7baeac37da057d3c7f2b474ee93d0b4) |
| `ValidationRegistry.setValidatorAuthorization(QuestManager)` | [`0x68929e50…88295f`](https://creditcoin-testnet.blockscout.com/tx/0x68929e5051bd15629a6a044da0bf23cb7bf8d66b616bd433bb4237952d88295f) |
| `CampaignEscrow.setRewardToken(VaelToken)` | [`0x9fdf11b1…8c18aa`](https://creditcoin-testnet.blockscout.com/tx/0x9fdf11b1a40649857a02ab4bee2d6521f16b4590088965e89a104d2f208c18aa) |
| `VaelToken.mint(deployer, 1,000,000 VAEL)` | [`0x0021b591…f9e796`](https://creditcoin-testnet.blockscout.com/tx/0x0021b591d391916b0face99ef023d190947fea7003d6f24f8df4265370f9e796) |
| `VaelToken.transfer(RewardVault, 100,000 VAEL)` | [`0xbdb9d581…c98789`](https://creditcoin-testnet.blockscout.com/tx/0xbdb9d581c6c6bf598c2002e60dd62d657977e2ac251204900b14d99c4cc98789) |
| `ValidationRegistry.setValidatorAuthorization(QuestManager, false)` | [`0x204728a3…ad5975`](https://creditcoin-testnet.blockscout.com/tx/0x204728a3dc8ac135a682c610f75b3fbd03cadf5f095a9ad5df946a060dad5975) |
| `IdentityRegistry.registerAgent(deployer)` | [`0x54ddff5b…e21528`](https://creditcoin-testnet.blockscout.com/tx/0x54ddff5bd848f0050efaea29c2a779cc6bc9098b0ed54758e23e6606cce21528) |

ERC-8004 agent id for the deployer: **1**.

Badge URIs for levels 1 to 10 are set to the literal placeholder `ipfs://placeholder` until Pinata is wired up in a later phase.

| Badge level | Tx |
|---|---|
| 1 | [`0xa985d5ef…46530c`](https://creditcoin-testnet.blockscout.com/tx/0xa985d5efd234fb3a128ef70b8ca47307b7508c57d15601d75b33d8373c46530c) |
| 2 | [`0xc8f29ac9…03014e`](https://creditcoin-testnet.blockscout.com/tx/0xc8f29ac9e353483ff216e2dca34873fe33fcb88469d25b581a105acb3103014e) |
| 3 | [`0xa0559fa0…5e12e6`](https://creditcoin-testnet.blockscout.com/tx/0xa0559fa06a43d82affb147cf2bbc65ccae0165c0860ca75c6de6a289f75e12e6) |
| 4 | [`0x8d65130a…4691cc`](https://creditcoin-testnet.blockscout.com/tx/0x8d65130abe57675384dc176ce7829f0194bb64debebf4df72a9982c70b4691cc) |
| 5 | [`0x19cc9663…6c290d`](https://creditcoin-testnet.blockscout.com/tx/0x19cc966302f0943f16a44a4ccfc04f2551fa47c9106f61623ed19461006c290d) |
| 6 | [`0x11fd6f83…6f80b4`](https://creditcoin-testnet.blockscout.com/tx/0x11fd6f83ef7bfbe4374e71110fa72caacbca4e5ae2e02345f6f7869ebd6f80b4) |
| 7 | [`0xe09290bf…2dab65`](https://creditcoin-testnet.blockscout.com/tx/0xe09290bf32f76a491cee2930351263eb6705f2a02d518085343ba16eea2dab65) |
| 8 | [`0x897065b9…1026e2`](https://creditcoin-testnet.blockscout.com/tx/0x897065b93f0885184fde92c97666909e3f0e8bda2922bfb1070e05ed691026e2) |
| 9 | [`0xd16fb457…835135`](https://creditcoin-testnet.blockscout.com/tx/0xd16fb45762d0001fcc3da9a04ed38adef63f69bb06bf13adfd69d54069835135) |
| 10 | [`0x79720886…45fc49`](https://creditcoin-testnet.blockscout.com/tx/0x79720886970584d390d009f0095b69cba3ec754bc352de6834b9973f3045fc49) |

## Superseded deployments

Redeployment during milestone 3 left three contracts behind. They are recorded so an explorer link from
an old transaction still resolves, and so nobody wires against them by accident. None of them holds
a privilege: the reviewer grant on each superseded QuestManager was explicitly revoked.

| Contract | Address | Why superseded |
|---|---|---|
| `QuestManager` v1 | `0x7d8f5f0D5F4523Fb3C8F62a560C00f286CAbed9F` | milestone 2 baseline, before verification rules and the source-height anchor |
| `QuestManager` v2 | `0xE2b5e65F55D90BD096CB93A6aD4BC44048a9c6CA` | Constructed against the v1 RewardVault, whose ledger already held quest ids 1 and 2 |
| `QuestManager` v3 | `0x8E42A111295F72c93d3A23181C4C3E13eCbeF220` | Predates adapter-based decoding |
| `QuestManager` v4 | `0x68B609a29cC6B0635d6A3A6A1eDa5a1bBCCEdE24` | Predates declining handlers; see below |
| `QuestASC` v2 | `0x93866c63CE38936aB832b4635d9B706FC17FD735` | Bound immutably to QuestManager v2 |
| `QuestASC` v3 | `0xB7D7Bf8e3BEBB1321620C3F5D81E2854B1df9776` | Reverted on a recognised log belonging to another quest |
| `RewardVault` v1 | `0x4cDa11850a3697940329975EA3943f166Ba6FFf8` | Ledger keyed by questId alone; see below |


### Why the core was redeployed twice more in milestone 3b

`QuestManager.setQuestASC` is one-shot, so every QuestASC replacement forces a QuestManager
replacement. That happened twice: once to move decoding into adapters, and once to let a handler
decline a log rather than revert on it. The second was found by the live network, not by review: a
Uniswap swap emits ERC-20 `Transfer` logs beside its `Swap`, and the first recognised log killed
the whole submission. The adapter split is precisely what stops the *next* protocol from costing a
redeploy.

`CampaignEscrow.setRewardReleaser` is plain `onlyOwner`, not one-shot, so the escrow has never
needed redeploying; it is re-pointed with a single transaction.

### Why the vault was redeployed

`RewardVault` keyed its funding ledger by `questId` alone. Quest ids are a per-manager counter that
restarts at 1, so the first `createQuest` on QuestManager v2 reverted
`RewardVault__QuestAlreadyFunded(1)` against ids the v1 manager had already funded — and because the
id counter only advances on a successful create, the manager was permanently stuck.

This was found by the live E2E run, not in review. The ledger is now keyed by
`keccak256(questManager, questId)`, so a manager redeploy is safe without touching the vault again.
`test/RewardVault.t.sol` covers it. `QuestManager.REWARD_VAULT` and `QuestASC.QUEST_MANAGER` are
both immutable, which is why fixing the vault required redeploying all three.

## One-shot bindings, now closed

- `QuestManager.setQuestASC` → `QuestASC`. Irreversible. Only that contract can complete a quest.
- `CampaignEscrow.setRewardReleaser` → `QuestASC`. Campaign payouts are proof-gated.

`VerifyBaseline` asserts both, so a future rewiring away from QuestASC fails the check.

## EvmV1Decoder

A copy of `EvmV1Decoder` from `@gluwa/asc-contracts@0.2.1` was deployed at
[`0xf46cFB693202B56b7C9D9242FE12acdf29c8A344`](https://creditcoin-testnet.blockscout.com/address/0xf46cFB693202B56b7C9D9242FE12acdf29c8A344)
in block 5455497.

**Nothing links against it, and nothing needs to.** Every function in that version of the decoder
is `internal` or `private`, so solc inlines it: `QuestASC`, `QuestManager`, and `QuestPortal` all
compile to `linkReferences: {}` with no `__$` placeholder. The deployed copy is a 28-byte stub, the
normal artefact of deploying an all-internal library. It is recorded here for completeness and as
the address to link against if a future package version reintroduces a public function.

## Smoke test

`contracts/script/smoke-baseline.sh` runs against this deployment with `cast` alone, no API
and no web app. It creates a quest as the registered agent, checks the RewardVault actually
minted the reward, accepts it as the assigned participant, finds `QuestAccepted` in the
receipt, and then asserts that `recordCompletion` from the deployer reverts with
`QuestManager__OnlyQuestASC` (`0xe2a34f59`).

That last assertion is the security claim of the whole project. If it ever stops reverting,
a backend key can pay itself.

| Step | Gas used / limit |
|---|---|
| `createQuest` | 323,527 / 347,417 (93%) |
| `acceptQuest` | 105,476 / 108,705 (97%) |
| `recordCompletion` | reverts, `eth_call`, no gas spent |

Quest ids 1 and 2 on this deployment were created by smoke runs.

## Ethereum Sepolia (11155111)

| Contract | Address | Deploy tx | Source |
|---|---|---|---|
| `QuestPortal` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://sepolia.etherscan.io/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) | [`0x0f26d55b…ba61dd`](https://sepolia.etherscan.io/tx/0x0f26d55bfdb197c3f7f4ea88f8fdbb27470992b5be42d2e70e2f1c67c9ba61dd) | verified on Etherscan and Blockscout |

Verified on both [Etherscan](https://sepolia.etherscan.io/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1#code)
and [eth-sepolia.blockscout.com](https://eth-sepolia.blockscout.com/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1).
Constructor arguments are `(owner, treasury)`, both the deployer address, read back off the live contract before submitting.
Confirmed through the Etherscan API rather than the submit output: `getsourcecode` returns `QuestPortal`, solc `v0.8.28+commit.7893614a`, optimizer on at 200 runs, and 29,488 bytes of source.

Note that this address is identical to `IdentityRegistry` on Creditcoin. Same deployer, same nonce,
different chain. It is a live illustration of why `QuestASC` scopes every emitter check by
`chainKey` rather than by address alone.

## Badge metadata

Every badge level points at a metadata document pinned to IPFS.
Before this, all ten levels held `ipfs://placeholder`, so a badge a player earned resolved to nothing.
Regenerate the art with `node apps/web/scripts/make-badges.mjs`, re-pin with `pnpm --filter @vael/api pin-badges`, and re-wire with `contracts/script/set-badge-uris.sh`.
The manifest lives at `apps/api/scripts/badge-cids.json`.

| Level | Name | Rarity | Metadata CID | Image CID |
|---|---|---|---|---|
| 1 | Initiate | Common | `QmfDNGL7khGCv8yd1zzNN93oVmp9YcSbPcndrY8obY82qb` | `QmZh3ix5CHposdiJfDt8FD2WXCYsvZQQL35nTfNZTL5pAn` |
| 2 | Apprentice | Uncommon | `QmPrqxiuEbAPPAdcrAP9r5hg2Wkmqz26S5HNREFcZKkxjC` | `QmPU7Gcuk3ZKZxrkLv6vzHm6vybXEUeVJjRNYoAW9tx5z5` |
| 3 | Adept | Rare | `QmcGif83wh4x99fwK248uk94DE9S8diCtzxzpi1iZiFTot` | `QmbTKV6WyYFfbJkvy98EPrSLWohpbRD8yRtPYcgKNCeCeY` |
| 4 | Veteran | Epic | `QmVG8QcCB2Vtqdnj1PJ98b5E5JdfS5ofP6kNtVUndRQoGc` | `Qmba8MNBQAsjoLQEtHU6TcUW8B7pSQrpkWPYXbrUY43msB` |
| 5 | Champion | Legendary | `QmVMRvs9Bf1v9sHupLwkRRmSSf784LFy2WhoQWexBc6LgQ` | `QmbX4heuZSBqVsGoMaacjyssB6uqk4fEjM3EKEstCLPBfm` |
| 6 | Warden | Legendary | `QmXqTH6edmgFoyGqJTZAsar4b4W1tc5wHPqXpgEyLbcEjF` | `QmWXVpK4DUdANUjTLqWeXDxo9yYo3XPsvx8x8FUdQc1vDT` |
| 7 | Sentinel | Legendary | `QmSRjPS8utVrz348MxjG1Cub6kSHxdpgnjPcEJ7oWnA38h` | `QmXYcq1Nh3uakpMAT8VHAErTbtpbzEMTnaRWtYEv23gSoq` |
| 8 | Archon | Legendary | `QmUtNCx3MhLk33VvMTos9FCzXuFxmutXVaEFW556UrViT6` | `QmbcXLZtgAQErDoZsf4VxRXKktGUTemrcgU9JEZmeXfGN5` |
| 9 | Paragon | Legendary | `QmNm79zvrR4TjfWT379kB7NP3ZRgP81t1qeNpbJfYBBAnk` | `QmTnnce2P9JMmGCkazEFMgowCqvSSKbb6vxG6PYig4jpUU` |
| 10 | Ascendant | Legendary | `QmWuvFHfFCK6M1nbLYQWK2z6xbxjrTGHQTaRWStWmDKgzu` | `QmSX7Pd5m8rJNzwkVcrVbrAefoU5nwmDpNm9F2fL1Td5Ne` |

Rarity follows BadgeNFT v3's rule, 1 Common through 5 and above Legendary, so the metadata already reads the way the deployed contract will once v3 ships.

**The seven badges minted before this wiring still resolve to `ipfs://placeholder`.**
BadgeNFT v2 stores a token's URI at mint through `ERC721URIStorage` and offers no way to change it afterwards, so `setBadgeURI` only affects future mints.
BadgeNFT v3 builds `tokenURI` on demand from the level's URI, which removes the problem by construction; see SPEC §17.1.

## Machine-readable

Consumed by `deploy-baseline.sh` for idempotency and by `VerifyBaseline.s.sol` via the environment.
Do not reformat.

```
IDENTITY_REGISTRY_ADDRESS=0x62d937DC3410C9C79078A521dA254E6fD53936F1
IDENTITY_REGISTRY_ADDRESS_TX=0x6f86014bc5cc229dd6fff10e995351ae976836753f4853c5e646c9ac53dfb2b1
IDENTITY_REGISTRY_ADDRESS_BLOCK=5455348
REPUTATION_REGISTRY_ADDRESS=0x87BC59dC9d6967Aec15A415ce5E1Ffd4CdFDaA2a
REPUTATION_REGISTRY_ADDRESS_TX=0xa8ba9347d0031a1de20c80000afdbafe8d67a035ab59b1afe6b29f8d10fadc03
REPUTATION_REGISTRY_ADDRESS_BLOCK=5455356
VALIDATION_REGISTRY_ADDRESS=0x9BE39f19b55792285D495302D872160dB2285a65
VALIDATION_REGISTRY_ADDRESS_TX=0x0e56c603808ddc5724251ecbf0fd29dbc31fa156b2f8e89617e25ac1326bd9ca
VALIDATION_REGISTRY_ADDRESS_BLOCK=5455357
AGENT_REGISTRY_ADAPTER_ADDRESS=0xfac6a1D56F8C24687973cd505A4cb7c7ffB0cc8d
AGENT_REGISTRY_ADAPTER_ADDRESS_TX=0x8f77ab8f6ffa44bfdd2a5e06456ee84b046da6f19a9b2ec100a07bcc5711d4f4
AGENT_REGISTRY_ADAPTER_ADDRESS_BLOCK=5455358
VAEL_TOKEN_ADDRESS=0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf
VAEL_TOKEN_ADDRESS_TX=0xd54ad8a7214211bb7885bf92306668f95d5ba98141354971a2a6886a85e9109b
VAEL_TOKEN_ADDRESS_BLOCK=5455359
REWARD_VAULT_ADDRESS=0x89aE45f3B75E20af549715294754292eFf25b89C
REWARD_VAULT_ADDRESS_TX=0x8ad7d74eed4b3adb8a156814ff088fa86702c45a84a747fd4cd159b56ea70268
REWARD_VAULT_ADDRESS_BLOCK=5455360
BADGE_NFT_ADDRESS=0xC3FF8f522408fF5FB2192519E70b875a9754aa94
BADGE_NFT_ADDRESS_TX=0x0d043ac4248c7d17fd393ed3c67f9beacab83dd557cf9b534f7e248b96d1fa85
BADGE_NFT_ADDRESS_BLOCK=5459459
QUEST_MANAGER_ADDRESS=0xD701A48cc22224Ca4679178db7a749dC68725EFD
QUEST_MANAGER_ADDRESS_TX=0x7a1251b5c9a70bd6140192510aa7fd27a0120eaf13badb5e5858267c9f2f6720
QUEST_MANAGER_ADDRESS_BLOCK=5459463
CAMPAIGN_ESCROW_ADDRESS=0xcF675302d19967788009592423E4E66bd69EA32b
CAMPAIGN_ESCROW_ADDRESS_TX=0x29615203d1eec38c099ba3aa4f30bf0389a64eee783eed0fbc6be62137c952f6
CAMPAIGN_ESCROW_ADDRESS_BLOCK=5455363
WIRE_VAULT_TOKEN_TX=0xe6fdb24b0de342454eb6135e712b3235352016cd84e1619d8630b3e3c82b16c2
WIRE_VAULT_MANAGER_TX=0x3b62bee1c53b70f0280f2db1b467b7abad3f2b09cb3880973c0bd8fa72570bc4
WIRE_BADGE_MANAGER_TX=0x3a101f64c4865dde5918023216dbc162535909d0ebca9e97fef4cd6356cb8349
WIRE_MINTER_ROLE_TX=0x601f3424293d87fc3d492c313c1d81cb31daed5b021839919fadf799b2d025f7
WIRE_REPUTATION_AUTH_TX=0x40f5f0fa5e00c6b6fa36233ef12b7660a7baeac37da057d3c7f2b474ee93d0b4
WIRE_VALIDATION_AUTH_TX=0x68929e5051bd15629a6a044da0bf23cb7bf8d66b616bd433bb4237952d88295f
WIRE_ESCROW_TOKEN_TX=0x9fdf11b1a40649857a02ab4bee2d6521f16b4590088965e89a104d2f208c18aa
WIRE_BADGE_URI_1_TX=0xa985d5efd234fb3a128ef70b8ca47307b7508c57d15601d75b33d8373c46530c
WIRE_BADGE_URI_2_TX=0xc8f29ac9e353483ff216e2dca34873fe33fcb88469d25b581a105acb3103014e
WIRE_BADGE_URI_3_TX=0xa0559fa06a43d82affb147cf2bbc65ccae0165c0860ca75c6de6a289f75e12e6
WIRE_BADGE_URI_4_TX=0x8d65130abe57675384dc176ce7829f0194bb64debebf4df72a9982c70b4691cc
WIRE_BADGE_URI_5_TX=0x19cc966302f0943f16a44a4ccfc04f2551fa47c9106f61623ed19461006c290d
WIRE_BADGE_URI_6_TX=0x11fd6f83ef7bfbe4374e71110fa72caacbca4e5ae2e02345f6f7869ebd6f80b4
WIRE_BADGE_URI_7_TX=0xe09290bf32f76a491cee2930351263eb6705f2a02d518085343ba16eea2dab65
WIRE_BADGE_URI_8_TX=0x897065b93f0885184fde92c97666909e3f0e8bda2922bfb1070e05ed691026e2
WIRE_BADGE_URI_9_TX=0xd16fb45762d0001fcc3da9a04ed38adef63f69bb06bf13adfd69d54069835135
WIRE_BADGE_URI_10_TX=0x79720886970584d390d009f0095b69cba3ec754bc352de6834b9973f3045fc49
MINT_INITIAL_SUPPLY_TX=0x0021b591d391916b0face99ef023d190947fea7003d6f24f8df4265370f9e796
FUND_VAULT_TX=0xbdb9d581c6c6bf598c2002e60dd62d657977e2ac251204900b14d99c4cc98789
REVOKE_VALIDATION_AUTH_TX=0x204728a3dc8ac135a682c610f75b3fbd03cadf5f095a9ad5df946a060dad5975
REGISTER_AGENT_TX=0x54ddff5bd848f0050efaea29c2a779cc6bc9098b0ed54758e23e6606cce21528
AGENT_ID=1
```
EVM_V1_DECODER_LIBRARY_ADDRESS=0xf46cFB693202B56b7C9D9242FE12acdf29c8A344
EVM_V1_DECODER_LIBRARY_ADDRESS_TX=0xbbf7c45a491b8e0ca60fcc7e1421e5dda99e27f709c8fdcbe0796a703036d187
EVM_V1_DECODER_LIBRARY_ADDRESS_BLOCK=5455497
QUEST_MANAGER_V1_ADDRESS=0x7d8f5f0D5F4523Fb3C8F62a560C00f286CAbed9F
QUEST_MANAGER_V1_ADDRESS_TX=0xe76b6cf78e828e5945fd36083f21c7658c56309ee45aa02ce2a7d2bbb2944e90
QUEST_MANAGER_V2_ADDRESS=0xE2b5e65F55D90BD096CB93A6aD4BC44048a9c6CA
QUEST_MANAGER_V2_ADDRESS_TX=0xcbb1c3f0bc3104c0e417cd33317c99372b7ca546e9a9f6b06f1a679adc5d3b3a
QUEST_ASC_ADDRESS=0x929eabBe43d498e7BA47BB69e8C9432703e969Aa
QUEST_ASC_ADDRESS_TX=0x4c7317c91235fd131e300b3e542e34d46cd2e55e9df44587a81a15ab012c39ad
QUEST_PORTAL_ADDRESS=0x62d937DC3410C9C79078A521dA254E6fD53936F1
QUEST_PORTAL_ADDRESS_TX=0x0f26d55bfdb197c3f7f4ea88f8fdbb27470992b5be42d2e70e2f1c67c9ba61dd
WIRE_V2_VAULT_MANAGER_TX=0x9f08f9363f4cdd315dd3f43132b42633f93ba3163b3528084a9173beebbb4cd3
WIRE_V2_BADGE_MANAGER_TX=0x10d94c2343c6c2577a438229124472475caf9b3ded932242236ab1f87110ca9f
WIRE_V2_REPUTATION_AUTH_TX=0x532c1d8c53c18f25323deb8219a57eaf653dc9ec55c2490390a58dc9ef1bfa37
WIRE_V1_REPUTATION_REVOKE_TX=0x87dde15dd491139bf35d9b9f8131f58c9d931702513c4f82b6a971c0fec0782c
WIRE_SET_QUEST_ASC_TX=0xd672692d9c45876c54d6ef238d569947d7d318df80d6991ebf0b1157ff853f86
WIRE_ESCROW_RELEASER_TX=0xdc01c19f64190b0f38100402369845a161a548d5d59a3446a4bbd88e28d5cd2b
WIRE_ASC_ESCROW_TX=0x05499a9c0ef4328514e8c9c75fb8ede968a198f928f2fce310df33d02e641e4e
WIRE_ASC_PORTAL_TX=0xb58839d42e4ddbbd4b83330ab591549db355e3de23ae9a725aaea0dcb277c961
QUEST_MANAGER_V3_ADDRESS=0x8E42A111295F72c93d3A23181C4C3E13eCbeF220
REWARD_VAULT_V1_ADDRESS=0x4cDa11850a3697940329975EA3943f166Ba6FFf8
REWARD_VAULT_V2_ADDRESS=0x89aE45f3B75E20af549715294754292eFf25b89C
QUEST_ASC_V1_ADDRESS=0x93866c63CE38936aB832b4635d9B706FC17FD735
QUEST_ASC_V2_ADDRESS=0x983cFa52747708Fe86d125DdFB1Bf67E052793cb
WIRE_V3_VAULT_TOKEN_TX=0x741ef444b7f0d5e07e2de09e61132010ff20aaa59ed1c73a3418161fe47463a7
WIRE_V3_MINTER_ROLE_TX=0x7bc20a1b4526e4b3c7ba1d8e7669a143951d2c641b05f688997242630b8e1ffa
WIRE_V3_VAULT_MANAGER_TX=0x4d6e9ff5a69ef30f1f7ae5d90bf60605fba10e0de8f87863827b8836773b2b9a
WIRE_V3_BADGE_MANAGER_TX=0xdcdc33b1dc5b2067baf8c2cbbfd97d2ece255fefaab7f9be3df4cd6043c92429
WIRE_V3_REPUTATION_AUTH_TX=0x5ea9ebf25eb8e4ed78ffea7c48fb5149fdc53ad80f33e8e94d4cd6412421a8de
WIRE_V3_REPUTATION_REVOKE_OLD_TX=0xd299630ef7c134a8b0856acba7fc9dc6b8d5c971476c3f10522a40ce4823ab45
WIRE_V3_SET_QUEST_ASC_TX=0x3b03d0e3aeabafc44eb621ac218531cc72eabb2b9381b6f89f2aa724ab3d93fb
WIRE_V3_ESCROW_RELEASER_TX=0x172eb8a41bb09242422c1f67d932d9536ee85f4b5705774314923f09e041e3b0
WIRE_V3_ASC_ESCROW_TX=0x63a90f119e0fc55d9d9df30e6256efd300ca70af15e04ec634fdbdc09c999dcd
WIRE_V3_ASC_PORTAL_TX=0x129de10ac7f867babefdb451d0ac2ef0b6b0160522393ad5dad66513b209da5e
FUND_VAULT_V2_TX=0x7072b3a395ec557e161453313c94da5f65259c2bb8acab873f37e7d095a67577
QUEST_MANAGER_V4_ADDRESS=0x68B609a29cC6B0635d6A3A6A1eDa5a1bBCCEdE24
QUEST_ASC_V3_ADDRESS=0xB7D7Bf8e3BEBB1321620C3F5D81E2854B1df9776
PORTAL_ADAPTER_ADDRESS=0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F
PORTAL_ADAPTER_ADDRESS_TX=0xf9596fbdf6e1aa693d251cbe6bc5f24294683992c4d5cef596a78ee828fe7c94
ERC20_TRANSFER_ADAPTER_ADDRESS=0x3832FEA301b9206F4415409636cf2A08B68aE2aE
ERC20_TRANSFER_ADAPTER_ADDRESS_TX=0xef8b6a28941cd98ca273add4a12180558bdaca6d60e63a645d99235aabb0df12
UNISWAP_V3_ADAPTER_ADDRESS=0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7
UNISWAP_V3_ADAPTER_ADDRESS_TX=0xcf9eb35e244a609eabe19340ced2d592c926a83160b5c27ec5c67810dbc05952
AAVE_V3_ADAPTER_ADDRESS=0xFD1fafD1BAa976D67373F745F8c46287b5D6692B
AAVE_V3_ADAPTER_ADDRESS_TX=0xe5a859535f8771140b58fc7c4b2f43f42d1c1d95823dfd7db1334c030e49d5a9
SEPOLIA_WETH9=0xfff9976782d46cc05630d1f6ebab18b2324d6b14
SEPOLIA_USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
SEPOLIA_AAVE_USDC=0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
SEPOLIA_AAVE_DAI=0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357
SEPOLIA_AAVE_WETH=0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c
SEPOLIA_AAVE_LINK=0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5
SEPOLIA_AAVE_POOL=0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
SEPOLIA_AAVE_FAUCET=0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D
SEPOLIA_UNISWAP_ROUTER=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
SEPOLIA_POOL_USDC_WETH_500=0x3289680dD4d6C10bb19b899729cda5eEF58AEfF1
SEPOLIA_POOL_USDC_WETH_3000=0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50
W3B_VAULT_MANAGER_TX=0xfa55dd950f35f27a638e374e383412edb57d6a8e8e033151ebe72a4eee9f5c39
W3B_BADGE_MANAGER_TX=0xb9f82d0517b1ef66945c0bdb4f1e5181b0778d3e34f8e9f9cdb74fb33c864d3c
W3B_REPUTATION_AUTH_TX=0x8b7d5238dd3a702c65efe2bb2c9c3e9b5f77cf425708eaa69df804b2b3542712
W3B_REPUTATION_REVOKE_TX=0x3392919be7f05379a239baeb88e0e78b977e15ce580dd7d63506731f71de917a
W3B_SET_QUEST_ASC_TX=0xf0a5b942e4ee9a809e449dd410ba967a0853132e3760432cc992847d25b6c3bc
W3B_ESCROW_RELEASER_TX=0xaffebed577f4cd8b79f9e15eb2eae6f4787c3d448f078d78a9d8e1038aae592b
W3B_ASC_ESCROW_TX=0x8e72464c431a8f7f70b96e23c8017ad5e3d075dbf9cb4929fdee754fb1e55b04
W3B_ASC_PORTAL_TX=0xb0e5a64030d28725bcead2d49bd2cc9099e6588ea4e68ea622a795d00ba89887
W3B_ADAPTER_PORTAL_TX=0x3db67aa0366b2c325211fc353339012ac8d3ecbaddd26450a104fcc1c5c886c0
W3B_ADAPTER_ERC20_TX=0xbcf5e193b89e9605682b5065b7bb3f0fdf79095cd8cc29e270ca5fe7836e732a
W3B_ADAPTER_SWAP_TX=0xfd4e681d27ff5b46603b88e61a6eb8640f3941a144531e53be3607b97803aa38
W3B_ADAPTER_SUPPLY_TX=0xa107f0edc47a9ed0e1a25dfb4fe0ea9f894fa5906b0a05032ccbcdab9cd59ac3
W3B_ADAPTER_BORROW_TX=0xabdad14e6793508334dcfc9f973419b3f8cd08af05c526f498abb56b011348b9
W3B_ALLOW_ERC20_WETH_TX=0xc6c38d974b28bfe756d8c0472c43f8f1be48d4a963dbe0696730669b77474bd3
W3B_ALLOW_ERC20_USDC_TX=0x47db22c27222ebef4b7aec0299e473ce936c3af63a6da60a0e4b0cc55e6f8940
W3B_ALLOW_ERC20_AUSDC_TX=0x374d740f74510fe7d75a7fa26c8ba6c7792202cb83e370c08dbaa8158e0e01aa
W3B_ALLOW_ERC20_ADAI_TX=0x874cc179cfdbcc12950a25ad7d7a52c5fbbd059a0757845ae6d84bbf0216716a
W3B_ALLOW_ERC20_AWETH_TX=0x79f21f03a7c51e4415dee4f34f043354a4dd3d99a51005d5aad63f716b14213e
W3B_ALLOW_ERC20_ALINK_TX=0x21d30971f557d3135654af11144d3d8a845196777fa71160259d696ae5ea92fa
W3B_ALLOW_SWAP_P500_TX=0x9b571d57d5273a329da1b4be68ada8b1d992bfb31d2334908795ce2874b32aa9
W3B_ALLOW_SWAP_P3000_TX=0xfde6500da0d478de5c4cadd620cfa548823598b6122e5160646efa7a12ced22e
W3B_ALLOW_AAVE_SUPPLY_TX=0x19a0249fc2380879ae0ea5b170510d2769039c58ca2e72fb74b3d3d3bf4e72e1
W3B_ALLOW_AAVE_BORROW_TX=0x19a09cd5db5bb47cb91b12d983ca24ac69de73969e17838204d9b17efe688ebd
W3B_POOL500_TX=0x7e39d37e65610f134ae70f88808bc76a9cd45304f979cfc1abf9c7ff7deeac91
W3B_POOL3000_TX=0x40ff70c54913505030193b97ef9cb8291a26f014845532033f7642cc95c2f756
QUEST_MANAGER_V5_ADDRESS=0x152BcBCE43EC8a3Ef1a96485A28967AbEEe95377
QUEST_ASC_V4_ADDRESS=0x467bF17dcf7A5988dC96b2F8e3Af571169176780
W3B2_VAULT_MANAGER_TX=0xd34580dea162374a9617e2cc6a1ca5f7aad123d7b67a635c712a7a52470985e2
W3B2_BADGE_MANAGER_TX=0x5eed3a1a45e635882575be1d6eb9a36751d837a57b9e361e501786df521a1e6c
W3B2_REPUTATION_AUTH_TX=0xa3285fbc282e52feca392236a2c71f81c551744ed584b5226e2174c6acdb5414
W3B2_REPUTATION_REVOKE_TX=0x7802a9bb8d8fafa7276b4ef937ca8804a053a5c8dd42a0a8bd7158f28f196dc0
W3B2_SET_QUEST_ASC_TX=0x49a271b270411a0383fbf6ca1603c733377521884d80c28a2a3e0b297e03d732
W3B2_ESCROW_RELEASER_TX=0xd50640bdc1e852f9409b0f16756e04f23045d1c02946cc8f720096ec4527b83d
W3B2_ASC_ESCROW_TX=0x596c0feaa7cbadbace560d2ce3d61d6191ac09868979b56e65fd1816b30e307e
W3B2_ASC_PORTAL_TX=0x1331bd4b11525429d1f09cec121d52fee663186b0118f4dee9bbe3358ac86e04
W3B2_ADAPTER_PORTAL_TX=0x0f1269212e802761ef95a1bf4d299aaec415cedb5d0ca2d66dbbbfcf6a54a3a5
W3B2_ADAPTER_ERC20_TX=0xe21915f966a80c58fb637288070ccb7da620a9d61dd7ee5166a7378334ba8609
W3B2_ADAPTER_SWAP_TX=0x68e6835c2d2d3c8cd57499b242434e8b825afa16fde32f147295c07ddea500f6
W3B2_ADAPTER_SUPPLY_TX=0xaa05d58ec13bae2d5a00d31e12287e80c40a23a44122fbf55bbfca5c3f36f70f
W3B2_ADAPTER_BORROW_TX=0xcb6cbbcc3b8d119ef2b9cbe1994bf6312a00350f48252c597768bc96c201d2e8
W3B2_ALLOW_ERC20_WETH_TX=0x749c80567b1214fb734dcf8ed82b2404e5a25f965b2face855cdfcf77cd32c7d
W3B2_ALLOW_ERC20_USDC_TX=0xbd52929e3aef33975a29e96600b049f5872d2a5a8e1d5891a77f093fa4cbdfc3
W3B2_ALLOW_ERC20_AUSDC_TX=0x8af6d32baf0c9c9186c82a08eedfae68bf83013068cdeec57cf791a7c9532ce6
W3B2_ALLOW_ERC20_ADAI_TX=0x5cf05628dab054eb69d00f2d52f2ac63ae20033dce953efff158ab764a1d5828
W3B2_ALLOW_ERC20_AWETH_TX=0x4ab67466f4407737709cbff63919928e67e854a99df0aaa10017c67691c39556
W3B2_ALLOW_ERC20_ALINK_TX=0xceb16d16fc68c101bac31a65e8258d33f026ed401e267807b8228bc48a8785ed
W3B2_ALLOW_SWAP_P500_TX=0x2c67d783c67bcf27d0bfed0d51827d65fc799c6e57b941145d71a7fc9b0cf590
W3B2_ALLOW_SWAP_P3000_TX=0xe0cf30c00f94b9e3fb9465312e6b813c91842866cecfd87b355658db6087192c
W3B2_ALLOW_AAVE_SUPPLY_TX=0xa8eb289f16135e65234b054985dcb95250dd759e3aad550b743f4a0b862021a9
W3B2_ALLOW_AAVE_BORROW_TX=0x0e134311d9d893fe39dbeba4100a9398f2884416c7e3ae442d781bf94a864f7d
W3B2_POOL500_TX=0x8a54d1e108f3ca5dc112b8ae1858c60c3b9ce1c76b493b1fe4ea54b189dd2586
W3B2_POOL3000_TX=0xf0dcfd5422fa5a4c2ed48a94e4d419190f8259a9e0f3742ebb40a85fac9e6892
BADGE_NFT_V1_ADDRESS=0xcA9ef3CCD228223fDa3D3080eFaA8d5F2A8232d3
BADGE_NFT_V2_ADDRESS=0xC3FF8f522408fF5FB2192519E70b875a9754aa94
QUEST_MANAGER_V6_ADDRESS=0xD701A48cc22224Ca4679178db7a749dC68725EFD
QUEST_ASC_V5_ADDRESS=0x929eabBe43d498e7BA47BB69e8C9432703e969Aa
VAEL_HERO_ADDRESS=0x8bE97BeBB253d7F660529e23e093F18645Fc974b
VAEL_HERO_ADDRESS_TX=0xcc5bc0cdf2bb45bf482f724e3f6bead4711d29afdc632bff8548637790515987
RAID_BOSS_ADDRESS=0xE9BB305bCe2466f2Ee2739D499cb18f8721415F6
RAID_BOSS_ADDRESS_TX=0x9ad78bf5d060aefa85c963c91c47a74bf184ce6689ea5d09910aa8223cbc989d
W4_VAULT_MANAGER_TX=0xda7c32155d6d9d3d88895a13be1275b72c2f0830a18218cd15828742cbe4ddc5
W4_BADGE_MANAGER_TX=0xbe0eca253ba0850d4e49d072016eed003e4c2812ce9b7bb9776c5c1572242ac7
W4_REPUTATION_AUTH_TX=0xd0e18023ab4f3a6c240b7575d6f3d93845c88793ba154ec8a72442518744fc9c
W4_REPUTATION_REVOKE_TX=0x7daa341d5d0c01441d47779e10dc85b78bd0f9470d594330566b1ba08c993cc2
W4_SET_QUEST_ASC_TX=0xc78b0665d775c8466aa88c4dfd0b3c06b02a649f818d0ebc54ea31f775967dfc
W4_ESCROW_RELEASER_TX=0xf284f980d3a8e32d2ef6f8eead1a1813cec8aa6de07a7de8da3dd21bd04557da
W4_ASC_ESCROW_TX=0x0dd5a7d10308cab222a374ca687a80a99d684257d23f3f8528cc54cbb284497b
W4_ASC_PORTAL_TX=0xc00e90d5feb41c91d0f91fd35c9a4bc05ccff0b87c89805b89d5d2f1d901320f
W4_ADAPTER_PORTAL_TX=0xa8fc021b5fba21e4b42708ba91bf6056cd14db8203f2d7da68cd28a622854745
W4_ADAPTER_ERC20_TX=0x8404a328d8712bb4402ad22259756fd8489cedae6ae39913807c1b89f9d379f2
W4_ADAPTER_SWAP_TX=0x20facfad342875567c5b64b7e0b15534adaccadabd38ce12bed214f3665366c2
W4_ADAPTER_SUPPLY_TX=0xd77e8ef32bf8e3f2a7fab48860eb143e9778f1b98f98571c2fc7d246bbde5064
W4_ADAPTER_BORROW_TX=0x3b4d3a8f1c29a4374e60b51c8fd1e10085d8870707e1c6888736050b63120c50
W4_ALLOW_ERC20_WETH_TX=0x16db3bf30a96d729acb68409319f7431d72769d482f933536e49842acf52b461
W4_ALLOW_ERC20_USDC_TX=0x63807f93abbd1e51e6c0a81592da0b8ccd354113f67949fe0c604f8c0ef4c5ac
W4_ALLOW_ERC20_AUSDC_TX=0x15520a009c7bdef526c2007b60ffc083a8ac020f2a10fe69111bca55cb87908f
W4_ALLOW_ERC20_ADAI_TX=0xfc744cb45602fb689d21ada354b737d6e1a1119c98edfb8b18b90954345b7113
W4_ALLOW_ERC20_AWETH_TX=0x55899c09dc209956beb85735036bb97c6610c0c79a32a5fbe6629556cc57a4e6
W4_ALLOW_ERC20_ALINK_TX=0x74a4ae095f9fca6594178be16cc20118a3fa3ee4cfb29f2836fd4b1a5307fb04
W4_ALLOW_SWAP_P500_TX=0xc8acf4433d196bd71d1d8f9c3620c9e50e91fea0464ca284036cef54218373a6
W4_ALLOW_SWAP_P3000_TX=0x188e8a334d17397eced8d178429c2f5cb1b56f5bd2e93133d9959f5cbf9e3f02
W4_ALLOW_AAVE_SUPPLY_TX=0x19db4d0a167e9623688fb1d8254107b66e76fdf3c20582f96c9f223ffa5acb0a
W4_ALLOW_AAVE_BORROW_TX=0x44b1c93f425534acf60ed6f80bf5bc1c0ed27b634c77434275d66437a9aab58b
W4_POOL500_TX=0xcc4a7ee039bc9080afb8c017b32c368c28334e403c9a88f8f358bacbda1114c7
W4_POOL3000_TX=0x50457e26b6e66d280a786ccc12bc707ab9c01f8a670123ececbaff42ff9965af
W4_BADGE_URI_1_TX=0xe9ad85a1c8075e091d7b2e423196cc1bc7f882c6275165cfa43700f60383c1db
W4_BADGE_URI_2_TX=0xf193016bfcff57cf836678f0f1d7d64fe8138263367bcc11fbb5c0ee2980b95b
W4_BADGE_URI_3_TX=0x980a4526a31b352f5359e08007ccbe48f30fee5a7fe6e15ea588bcfad5735a53
W4_BADGE_URI_4_TX=0xe10e29edce616d02b325d6a668f5cbc2d897d0d69fca580ff1aded8e6b379998
W4_BADGE_URI_5_TX=0x3ef16afb41916ad8e39b244b2b0967cc5a2701b678b1b80f81b21fee1897ae6d
W4_BADGE_URI_6_TX=0xcf5603a7552d3d8094b0fd2b873f12ed1a2193fd9f6d21f2fcaf06af27a89526
W4_BADGE_URI_7_TX=0xe546879fbb0993cfad2be00522f3f0787258dbcce19ad4f16b438cf2c0facb6f
W4_BADGE_URI_8_TX=0x79b7b867db5f6a12acf6ff59548c776f93efc57e8604104ff5469f3836654054
W4_BADGE_URI_9_TX=0x9d55a6849687f31ead1851e93a72b675ef68927501a78e39c9171e08d6515acc
W4_BADGE_URI_10_TX=0xec546c4199598c22a21de523aa68617be06bc2afffa2e0acc91e4650e2eaf95e
W4_HERO_ASC_TX=0x2112f459c061ff37ff8b0d8e04c518eb1f9c2ff885b85f9292c50274f6d975be
W4_RAID_ASC_TX=0x40ae6bf426b0a53ce05d8d0e9e1b8fad41000ca57ee6c290408bf559c99e6b93
W4_HOOK_HERO_TX=0x7ff2bc1f5ec0c1f6d0e8299ae35e159e6de8e8ca9bc919c6345f59c959e4cd79
W4_HOOK_RAID_TX=0x3e7c1229e8dedb8ea60812462d741ac6598f1ccbbddcacdf86efb76b18100965
W4_BADGE_MINTER_TX=0xea1a7cfdf01fd836a65a02039b74e5724813ffa8c722ad96bebc0f660964ebad
