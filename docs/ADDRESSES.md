# Deployed addresses

All Vael game state lives on Creditcoin testnet (chain id 102031).
Ethereum Sepolia (11155111) carries only the source actions players prove; nothing is deployed there yet.

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
| `BadgeNFT` | [`0xcA9ef3CCD228223fDa3D3080eFaA8d5F2A8232d3`](https://creditcoin-testnet.blockscout.com/address/0xcA9ef3CCD228223fDa3D3080eFaA8d5F2A8232d3) | [`0xe0381fdc…0b1430`](https://creditcoin-testnet.blockscout.com/tx/0xe0381fdcf2941dfffa0ec900332a0668f96e0465d80def5a0df4716f1c0b1430) | 5455361 | verified |
| `QuestManager` | [`0x8E42A111295F72c93d3A23181C4C3E13eCbeF220`](https://creditcoin-testnet.blockscout.com/address/0x8E42A111295F72c93d3A23181C4C3E13eCbeF220) | [`0xb4d1ef39…b292db`](https://creditcoin-testnet.blockscout.com/tx/0xb4d1ef394883d6b544149ec42b93be0372f1555d33585838cffc58980bb292db) | 5455576 | verified |
| `QuestASC` | [`0x983cFa52747708Fe86d125DdFB1Bf67E052793cb`](https://creditcoin-testnet.blockscout.com/address/0x983cFa52747708Fe86d125DdFB1Bf67E052793cb) | [`0x544820f7…6d89fd`](https://creditcoin-testnet.blockscout.com/tx/0x544820f7c8b670ab68e2fa2d79bc517e81506b1deb7e96a8ab3f128b296d89fd) | 5455578 | verified |
| `CampaignEscrow` | [`0xcF675302d19967788009592423E4E66bd69EA32b`](https://creditcoin-testnet.blockscout.com/address/0xcF675302d19967788009592423E4E66bd69EA32b) | [`0x29615203…c952f6`](https://creditcoin-testnet.blockscout.com/tx/0x29615203d1eec38c099ba3aa4f30bf0389a64eee783eed0fbc6be62137c952f6) | 5455363 | verified |
| `IdentityRegistry` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://creditcoin-testnet.blockscout.com/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) | [`0x6f86014b…dfb2b1`](https://creditcoin-testnet.blockscout.com/tx/0x6f86014bc5cc229dd6fff10e995351ae976836753f4853c5e646c9ac53dfb2b1) | 5455348 | verified |
| `ReputationRegistry` | [`0x87BC59dC9d6967Aec15A415ce5E1Ffd4CdFDaA2a`](https://creditcoin-testnet.blockscout.com/address/0x87BC59dC9d6967Aec15A415ce5E1Ffd4CdFDaA2a) | [`0xa8ba9347…fadc03`](https://creditcoin-testnet.blockscout.com/tx/0xa8ba9347d0031a1de20c80000afdbafe8d67a035ab59b1afe6b29f8d10fadc03) | 5455356 | verified |
| `ValidationRegistry` | [`0x9BE39f19b55792285D495302D872160dB2285a65`](https://creditcoin-testnet.blockscout.com/address/0x9BE39f19b55792285D495302D872160dB2285a65) | [`0x0e56c603…6bd9ca`](https://creditcoin-testnet.blockscout.com/tx/0x0e56c603808ddc5724251ecbf0fd29dbc31fa156b2f8e89617e25ac1326bd9ca) | 5455357 | verified |
| `AgentRegistryAdapter` | [`0xfac6a1D56F8C24687973cd505A4cb7c7ffB0cc8d`](https://creditcoin-testnet.blockscout.com/address/0xfac6a1D56F8C24687973cd505A4cb7c7ffB0cc8d) | [`0x8f77ab8f…11d4f4`](https://creditcoin-testnet.blockscout.com/tx/0x8f77ab8f6ffa44bfdd2a5e06456ee84b046da6f19a9b2ec100a07bcc5711d4f4) | 5455358 | verified |

All nine are source-verified on Blockscout. Re-check with `contracts/script/check-verification.sh`.

### What each one is

- **`VaelToken`** — ERC-20 reward token, VAEL, 18 decimals
- **`RewardVault`** — Mints and releases VAEL per quest. Callable only by QuestManager
- **`BadgeNFT`** — Soul-bound ERC-721 quest badges. Callable only by QuestManager
- **`QuestManager`** — Quest lifecycle. `recordCompletion` is `onlyQuestASC`
- **`CampaignEscrow`** — Partner-funded campaign pools
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
| `RewardVault` v1 | `0x4cDa11850a3697940329975EA3943f166Ba6FFf8` | Ledger keyed by questId alone; see below |
| `QuestASC` v1 | `0x93866c63CE38936aB832b4635d9B706FC17FD735` | Bound immutably to QuestManager v2 |

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
| `QuestPortal` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://eth-sepolia.blockscout.com/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) | [`0x0f26d55b…ba61dd`](https://sepolia.etherscan.io/tx/0x0f26d55bfdb197c3f7f4ea88f8fdbb27470992b5be42d2e70e2f1c67c9ba61dd) | verified on Blockscout |

Verified on [eth-sepolia.blockscout.com](https://eth-sepolia.blockscout.com), not Etherscan: no
Etherscan API key is configured in `contracts/.env`.

Note that this address is identical to `IdentityRegistry` on Creditcoin. Same deployer, same nonce,
different chain. It is a live illustration of why `QuestASC` scopes every emitter check by
`chainKey` rather than by address alone.

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
BADGE_NFT_ADDRESS=0xcA9ef3CCD228223fDa3D3080eFaA8d5F2A8232d3
BADGE_NFT_ADDRESS_TX=0xe0381fdcf2941dfffa0ec900332a0668f96e0465d80def5a0df4716f1c0b1430
BADGE_NFT_ADDRESS_BLOCK=5455361
QUEST_MANAGER_ADDRESS=0x8E42A111295F72c93d3A23181C4C3E13eCbeF220
QUEST_MANAGER_ADDRESS_TX=0xb4d1ef394883d6b544149ec42b93be0372f1555d33585838cffc58980bb292db
QUEST_MANAGER_ADDRESS_BLOCK=5455504
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
QUEST_ASC_ADDRESS=0x983cFa52747708Fe86d125DdFB1Bf67E052793cb
QUEST_ASC_ADDRESS_TX=0x544820f7c8b670ab68e2fa2d79bc517e81506b1deb7e96a8ab3f128b296d89fd
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
