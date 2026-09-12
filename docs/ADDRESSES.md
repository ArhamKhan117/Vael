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

## Current deployment, Creditcoin testnet (102031)

Nine of these were deployed together on 2026-09-11 in the final consolidated redeploy described in
`docs/SPEC.md` §17.1a. The rest have been live since milestone 2 or 3 and were re-pointed rather than
replaced.

`BadgeNFT` is one of the survivors this time. It holds no other contract's address immutably, so it
was re-pointed at the new QuestManager instead of being replaced, and the twenty badges players hold
kept their ids and their mint transactions. That also means there was no owner-minting window during
this redeploy: the previous cascade needed one to re-mint badges, and this one did not.

| Contract | Address | Deploy tx | Block | What it is |
|---|---|---|---|---|
| `VaelToken` | [`0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf`](https://creditcoin-testnet.blockscout.com/address/0x7131E59d5068BE6Ecdd1bfED2e81C85Ba2aa90Cf) | [`0xd54ad8a7…e9109b`](https://creditcoin-testnet.blockscout.com/tx/0xd54ad8a7214211bb7885bf92306668f95d5ba98141354971a2a6886a85e9109b) | 5455359 | ERC-20 reward token, VAEL, 18 decimals |
| `RewardVault` | [`0x89aE45f3B75E20af549715294754292eFf25b89C`](https://creditcoin-testnet.blockscout.com/address/0x89aE45f3B75E20af549715294754292eFf25b89C) | [`0x8ad7d74e…a70268`](https://creditcoin-testnet.blockscout.com/tx/0x8ad7d74eed4b3adb8a156814ff088fa86702c45a84a747fd4cd159b56ea70268) | 5455360 | Mints and releases VAEL for non-campaign quests. Callable only by QuestManager |
| `CampaignEscrow` | [`0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28`](https://creditcoin-testnet.blockscout.com/address/0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28) | [`0x29615203…c952f6`](https://creditcoin-testnet.blockscout.com/tx/0x29615203d1eec38c099ba3aa4f30bf0389a64eee783eed0fbc6be62137c952f6) | 5455363 | Partner-funded campaign pools. v2: releases and refunds only through a releaser set that waits a day to change, QuestASC for proved quests and CampaignPayoutHook for native ones |
| `BadgeNFT` | [`0x6b57F8a913FBC175ff46B53542F23D362e46d8f2`](https://creditcoin-testnet.blockscout.com/address/0x6b57F8a913FBC175ff46B53542F23D362e46d8f2) | [`0x3c8142f3…8b99d2`](https://creditcoin-testnet.blockscout.com/tx/0x3c8142f338968e7d28568a6586aca97c4de44df777be85f9100b4bb4f08b99d2) | 5463522 | Soul-bound ERC-721 quest badges with a rarity and on-chain metadata. Mintable only by QuestManager and RaidBoss |
| `VaelHero` | [`0x74befcC907073f5F0125813FEF3A2A22406d3024`](https://creditcoin-testnet.blockscout.com/address/0x74befcC907073f5F0125813FEF3A2A22406d3024) | [`0xbaf58563…aa117b`](https://creditcoin-testnet.blockscout.com/tx/0xbaf585631f6561f09208b8ed34dc0784ad856a02284998acfdf7c12113aa117b) | 5465437 | Soul-bound hero, one per wallet. XP arrives only as a hook from a completion path; the import window is closed and the completer set is timelocked |
| `QuestManager` | [`0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7`](https://creditcoin-testnet.blockscout.com/address/0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7) | [`0x4dd8faf8…c9bcaa`](https://creditcoin-testnet.blockscout.com/tx/0x4dd8faf8c3e157745a8a4ebb0744e7720657be79d80e9934decb6bad51c9bcaa) | 5465161 | Quest lifecycle. `recordCompletion` dispatches on the quest's action type to QuestASC or NativePortal and accepts nobody else. Pays from the vault only when a quest has no campaign |
| `QuestASC` | [`0x05958dD789EaC1de84e864d6b3956C90d3e90d0f`](https://creditcoin-testnet.blockscout.com/address/0x05958dD789EaC1de84e864d6b3956C90d3e90d0f) | [`0xd12cc7c9…cbee36`](https://creditcoin-testnet.blockscout.com/tx/0xd12cc7c9a2e807da9c4a881d4d913c8930667e1a3f4345f9abe6982e71cbee36) | 5465162 | Verifies Attestcoin proofs and applies them. The only contract that can complete a quest whose action was on Ethereum |
| `NativePortal` | [`0xa512544f721230Fa04560078D0dC214423FE2970`](https://creditcoin-testnet.blockscout.com/address/0xa512544f721230Fa04560078D0dC214423FE2970) | [`0x9a9a4287…d2b51a`](https://creditcoin-testnet.blockscout.com/tx/0x9a9a428778c6962ff5d3204d76559416cfc9879abe4f826f0ab630e481d2b51a) | 5465163 | Performs a Creditcoin action and records the completion in the same transaction. The only contract that can complete a native quest |
| `CampaignPayoutHook` | [`0xeeB8A2EEf0D8b4B28D50ce130E7a70b871F621b1`](https://creditcoin-testnet.blockscout.com/address/0xeeB8A2EEf0D8b4B28D50ce130E7a70b871F621b1) | [`0xe6ba49ae…9516a4`](https://creditcoin-testnet.blockscout.com/tx/0xe6ba49ae956aba6be8ebe04ed8a3dd4cc4965ac80e31375b4b676e4f229516a4) | 5478585 | The native completion path's way to the escrow. A hook on NativePortal, trusted by CampaignEscrow as a releaser; releases exactly the quest's reward for a campaign quest NativePortal completed, once, and nothing for a vault quest |
| `RaidBoss` | [`0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B`](https://creditcoin-testnet.blockscout.com/address/0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B) | [`0x7fa0fffe…d52192`](https://creditcoin-testnet.blockscout.com/tx/0x7fa0fffe28f8b2ee69b8dc9d908578ea5c9ddfc46649989fd877ab0bcdd52192) | 5465438 | Season boss. Damage arrives only as a hook from a completion path |
| `Arena` | [`0xa98672b481c35f76d09612849E75A2c7A1a976d9`](https://creditcoin-testnet.blockscout.com/address/0xa98672b481c35f76d09612849E75A2c7A1a976d9) | [`0xf71f4ecd…0dd452`](https://creditcoin-testnet.blockscout.com/tx/0xf71f4ecd057bfcbd62dbd106d5e3783f034fcb36891d51c493df25098f0dd452) | 5465439 | Player versus player duels for VAEL stakes. Reads VaelHero, holds no privilege over it |
| `Loot` | [`0xFf0271fb151F25cf909d1d8b16017Af54FBb9938`](https://creditcoin-testnet.blockscout.com/address/0xFf0271fb151F25cf909d1d8b16017Af54FBb9938) | [`0x94af1c37…87fb6b`](https://creditcoin-testnet.blockscout.com/tx/0x94af1c37fd9b383e76f27d1c34fcb856ec9b7de25e21ec5e1b81359a5487fb6b) | 5465440 | ERC-1155 items. Reads the RaidBoss ledger; RaidBoss does not know it exists |
| `Equipment` | [`0xa04EDa9C22f10960Df6f470e143f7f6a195Dcba6`](https://creditcoin-testnet.blockscout.com/address/0xa04EDa9C22f10960Df6f470e143f7f6a195Dcba6) | [`0xc8c08391…dab131`](https://creditcoin-testnet.blockscout.com/tx/0xc8c08391fb0b239004d5d73e4e7082861a7d916984524bf7759932f387dab131) | 5465441 | Four slots per hero, items escrowed while equipped |
| `Marketplace` | [`0x868Bb518122B670Cd02b93dEeDc6B53DcFA36374`](https://creditcoin-testnet.blockscout.com/address/0x868Bb518122B670Cd02b93dEeDc6B53DcFA36374) | [`0x9d5935b3…cb45c4`](https://creditcoin-testnet.blockscout.com/tx/0x9d5935b310c25fd7fee6085d5c48e60b9a8cd8b72ffac3f880ca89ad23cb45c4) | 5465442 | Fixed-price loot sales for VAEL, 2% to the treasury |
| `PortalAdapter` | [`0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F`](https://creditcoin-testnet.blockscout.com/address/0x06A1A66Fa571Da7CbaE184Bd5A3f4680Ee5c6f6F) | [`0xf9596fbd…fe7c94`](https://creditcoin-testnet.blockscout.com/tx/0xf9596fbdf6e1aa693d251cbe6bc5f24294683992c4d5cef596a78ee828fe7c94) | - | Decodes `QuestActionPerformed` |
| `Erc20TransferAdapter` | [`0x3832FEA301b9206F4415409636cf2A08B68aE2aE`](https://creditcoin-testnet.blockscout.com/address/0x3832FEA301b9206F4415409636cf2A08B68aE2aE) | [`0xef8b6a28…b0df12`](https://creditcoin-testnet.blockscout.com/tx/0xef8b6a28941cd98ca273add4a12180558bdaca6d60e63a645d99235aabb0df12) | - | Decodes `Transfer` |
| `UniswapV3SwapAdapter` | [`0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7`](https://creditcoin-testnet.blockscout.com/address/0xb18dFE3CC5255068217bc85B1672C8D36A90a1b7) | [`0xcf9eb35e…c05952`](https://creditcoin-testnet.blockscout.com/tx/0xcf9eb35e244a609eabe19340ced2d592c926a83160b5c27ec5c67810dbc05952) | - | Decodes `Swap`, holds the pool token pairs |
| `AaveV3Adapter` | [`0xFD1fafD1BAa976D67373F745F8c46287b5D6692B`](https://creditcoin-testnet.blockscout.com/address/0xFD1fafD1BAa976D67373F745F8c46287b5D6692B) | [`0xe5a85953…49d5a9`](https://creditcoin-testnet.blockscout.com/tx/0xe5a859535f8771140b58fc7c4b2f43f42d1c1d95823dfd7db1334c030e49d5a9) | - | Decodes `Supply` and `Borrow` |
| `IdentityRegistry` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://creditcoin-testnet.blockscout.com/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) | [`0x6f86014b…dfb2b1`](https://creditcoin-testnet.blockscout.com/tx/0x6f86014bc5cc229dd6fff10e995351ae976836753f4853c5e646c9ac53dfb2b1) | 5455348 | ERC-8004 agent identity |
| `ReputationRegistry` | [`0x87BC59dC9d6967Aec15A415ce5E1Ffd4CdFDaA2a`](https://creditcoin-testnet.blockscout.com/address/0x87BC59dC9d6967Aec15A415ce5E1Ffd4CdFDaA2a) | [`0xa8ba9347…fadc03`](https://creditcoin-testnet.blockscout.com/tx/0xa8ba9347d0031a1de20c80000afdbafe8d67a035ab59b1afe6b29f8d10fadc03) | 5455356 | ERC-8004 agent reputation |
| `ValidationRegistry` | [`0x9BE39f19b55792285D495302D872160dB2285a65`](https://creditcoin-testnet.blockscout.com/address/0x9BE39f19b55792285D495302D872160dB2285a65) | [`0x0e56c603…6bd9ca`](https://creditcoin-testnet.blockscout.com/tx/0x0e56c603808ddc5724251ecbf0fd29dbc31fa156b2f8e89617e25ac1326bd9ca) | 5455357 | ERC-8004 validation records. QuestManager holds it as an immutable and calls nothing on it |
| `AgentRegistryAdapter` | [`0xfac6a1D56F8C24687973cd505A4cb7c7ffB0cc8d`](https://creditcoin-testnet.blockscout.com/address/0xfac6a1D56F8C24687973cd505A4cb7c7ffB0cc8d) | [`0x8f77ab8f…11d4f4`](https://creditcoin-testnet.blockscout.com/tx/0x8f77ab8f6ffa44bfdd2a5e06456ee84b046da6f19a9b2ec100a07bcc5711d4f4) | 5455358 | Resolves a controller to a live agent id |

Every contract is source-verified on Blockscout. Re-check with
`contracts/script/check-verification.sh`, which asks the explorer what it actually holds rather
than trusting the `OK` that `forge verify-contract` prints on submission. That distinction matters:
QuestASC v3 was submitted successfully and stayed unverified for a day, and the submit output gave
no hint. `verify-blockscout.sh` now ends by running the checker.

## Ethereum Sepolia (11155111)

| Contract | Address | Deploy tx | Source |
|---|---|---|---|
| `QuestPortal` | [`0x62d937DC3410C9C79078A521dA254E6fD53936F1`](https://sepolia.etherscan.io/address/0x62d937DC3410C9C79078A521dA254E6fD53936F1) | [`0x0f26d55b…ba61dd`](https://sepolia.etherscan.io/tx/0x0f26d55bfdb197c3f7f4ea88f8fdbb27470992b5be42d2e70e2f1c67c9ba61dd) | verified on Etherscan and Blockscout |

`QuestPortal` was not touched by the redeploy. It is on the source chain and holds no Creditcoin
address.

## PenguinSwap on Creditcoin testnet

Not ours. `NativePortal` approves the router and the swap panel prices against the pool, so both are
recorded here. How each was found is in `docs/SPEC.md` §3.1a; every one was read off the chain and
checked against the next rather than taken from a blog post.

| Contract | Address | What it is |
|---|---|---|
| `SwapRouter` | [`0x052ffAaAe6e24a1ff9F197c46c29dfdB53Bd61F5`](https://creditcoin-testnet.blockscout.com/address/0x052ffAaAe6e24a1ff9F197c46c29dfdB53Bd61F5) | Uniswap v3 `SwapRouter`, not `SwapRouter02`: `exactInputSingle` takes a `deadline` |
| `UniswapV3Factory` | [`0x7316C24Cb58a49673DdC3EE369d20806083BA48C`](https://creditcoin-testnet.blockscout.com/address/0x7316C24Cb58a49673DdC3EE369d20806083BA48C) | `factory()` on both the router and the position manager |
| `NonfungiblePositionManager` | [`0x74501E231E1e8f505Fed029a1B48122114d1f51F`](https://creditcoin-testnet.blockscout.com/address/0x74501E231E1e8f505Fed029a1B48122114d1f51F) | 51,680 positions minted, which is how the live deployment was told from two lookalikes |
| `WCTC` | [`0x56072113e08015e1c40A3F3f656b1C1Fa78E329E`](https://creditcoin-testnet.blockscout.com/address/0x56072113e08015e1c40A3F3f656b1C1Fa78E329E) | Wrapped native. `NativePortal.wrapNative` deposits here |
| `USD1` | [`0xC5a26b7e112473734d3fE33f65800F615628C021`](https://creditcoin-testnet.blockscout.com/address/0xC5a26b7e112473734d3fE33f65800F615628C021) | 18 decimals, the other side of the only liquid pair |
| WCTC/USD1 0.05% pool | [`0x1CA47Fe8F87774d56ADbf2BA666940Fa760638ff`](https://creditcoin-testnet.blockscout.com/address/0x1CA47Fe8F87774d56ADbf2BA666940Fa760638ff) | About 1.2 million WCTC in range, so Vael seeded no liquidity of its own |

## Adapters

Decoding lives outside the core so that adding a protocol costs one `setAdapter` transaction rather
than a redeploy of QuestASC, QuestManager, and the escrow together. An adapter is a pure decoder
over an already-proved log: it holds no privilege and cannot widen what is accepted. None of the
four was redeployed; all six registrations were made again on QuestASC v5.

| Registration | Tx |
|---|---|
| `PortalAdapter` on chainKey 1 | [`0xb9152140…65d10f`](https://creditcoin-testnet.blockscout.com/tx/0xb9152140e156d9c52d81c3cee6c280084547b27a7fcdf9e26989e4224465d10f) |
| `Erc20TransferAdapter` on chainKey 1 | [`0x02ecd6a0…371d12`](https://creditcoin-testnet.blockscout.com/tx/0x02ecd6a0cfbc8c31ae5213ddbdf1da6dffd86dfa111ce8438e637a388d371d12) |
| `UniswapV3SwapAdapter` on chainKey 1 | [`0xbe91fdb8…412b9b`](https://creditcoin-testnet.blockscout.com/tx/0xbe91fdb8a3128050aa2adc61b9f3d6ed2659cceaf4c18fcdd6a1e2c2db412b9b) |
| `AaveV3Adapter` for `Supply` on chainKey 1 | [`0xb71f9542…41f8d7`](https://creditcoin-testnet.blockscout.com/tx/0xb71f95427cb15e59245c5314d8fd58a1eaee8656788a5202332715cebf41f8d7) |
| `AaveV3Adapter` for `Borrow` on chainKey 1 | [`0xd4d2575e…606dd7`](https://creditcoin-testnet.blockscout.com/tx/0xd4d2575e9b3156ee56c4043c84b09031e71497a66b7425f57a3fa701cb606dd7) |
| `Erc20TransferAdapter` on chainKey 3 | [`0x11018dfe…48b070`](https://creditcoin-testnet.blockscout.com/tx/0x11018dfeb69e8db704b775f18af105fe73decec612b6f21e16a201597c48b070) |

Chain key 3 is Ethereum mainnet. It is registered and provable, with one allowlisted emitter, and
**no quest is open against it**. `docs/MAINNET_SPIKE.md` makes a mainnet quest conditional on a
keyed mainnet endpoint that the submission does not assume.

## Sepolia emitters allowlisted

| Action | Emitters |
|---|---|
| Portal | `QuestPortal`, set by `setQuestPortal` itself |
| Erc20Transfer | WETH9, Circle USDC, Aave test USDC, DAI, WETH, LINK |
| UniswapSwap | USDC/WETH 0.05% `0x3289680d…AEfF1`, USDC/WETH 0.3% `0x6Ce0896e…9b50` |
| AaveSupply, AaveBorrow | Aave v3 Pool `0x6Ae43d32…8951` |

## Ethereum mainnet emitters allowlisted

| Action | Emitter |
|---|---|
| Erc20Transfer | USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

## Wiring transactions, milestone 8

One transaction per call, each slot read back at the block it landed in.

| Call | Tx |
|---|---|
| `VaelHero.importHero(token 1)` | [`0xf3480440…194a73`](https://creditcoin-testnet.blockscout.com/tx/0xf34804404ac46d506b00421e0901dc7ec77587b87012d71e99d9abc4f6194a73) |
| `VaelHero.importHero(token 2)` | [`0x255fdf18…620e2c`](https://creditcoin-testnet.blockscout.com/tx/0x255fdf1889282ace5273779d574d8e854d8d903e9af5fc86d777c14218620e2c) |
| `VaelHero.closeImport()` | [`0x9de7a507…3b6270`](https://creditcoin-testnet.blockscout.com/tx/0x9de7a507807d04daebd88b4813b353a4dc0f2d88eaecd0dc9ea4cd3af13b6270) |
| `BadgeNFT.setMinter(deployer, true)` | [`0xa02ad49d…6846ce`](https://creditcoin-testnet.blockscout.com/tx/0xa02ad49d6af630ca87b47ec836578fc496433a5107b7162ef0cb3acace6846ce) |
| `BadgeNFT.setMinter(deployer, false)` | [`0x0ed3bc98…67649d`](https://creditcoin-testnet.blockscout.com/tx/0x0ed3bc98963a53dd389c2a0fe8ea675a466f427a69e2b47c0b010aec2e67649d) |
| `RewardVault.setQuestManager(QuestManager)` | [`0x6174eed7…caddb6`](https://creditcoin-testnet.blockscout.com/tx/0x6174eed78f2055b7717cae37c18e95e58708de9b433fe2ff47fa9df1c1caddb6) |
| `BadgeNFT.setQuestManager(QuestManager)` | [`0x3da9d8fb…00f604`](https://creditcoin-testnet.blockscout.com/tx/0x3da9d8fbe6d71433166ff7a1683802202293d3e593c43a574d4af6430900f604) |
| `ReputationRegistry.setReviewerAuthorization(QuestManager, true)` | [`0x12b8e06a…6b3108`](https://creditcoin-testnet.blockscout.com/tx/0x12b8e06a46fc1ee7ce8d44504f4d561bf7a17cc7bb6005b1154d7faae06b3108) |
| `ReputationRegistry.setReviewerAuthorization(superseded QuestManager, false)` | [`0x38f46e1e…dbee09`](https://creditcoin-testnet.blockscout.com/tx/0x38f46e1e0beece4c33aa2aceaca6243a074e4049a405965bbc6bc27934dbee09) |
| `CampaignEscrow.setRewardReleaser(QuestASC)` | [`0xf0be6332…432163`](https://creditcoin-testnet.blockscout.com/tx/0xf0be6332a786911022ce6b1c5a68598cf6bb45eee7b5ac0a8ae6139b2e432163) |
| `QuestManager.setQuestASC(QuestASC)` | [`0xc4f92432…f3a094`](https://creditcoin-testnet.blockscout.com/tx/0xc4f924322f70f572afadf277aeba44f1453582499a84f352a84924bbf7f3a094) |
| `VaelHero.setQuestASC(QuestASC)` | [`0x109f31f9…9bb8a0`](https://creditcoin-testnet.blockscout.com/tx/0x109f31f958bfd21fc0a9c8e571e45256e7dc2e29a694eb56597ee862a59bb8a0) |
| `RaidBoss.setQuestASC(QuestASC)` | [`0x47858e8b…66565a`](https://creditcoin-testnet.blockscout.com/tx/0x47858e8b83f0775117eb73d096dc36d58cbdeaab4a758f32bf39ad7c7366565a) |
| `QuestASC.setCampaignEscrow(CampaignEscrow)` | [`0x1cdeea2e…410d99`](https://creditcoin-testnet.blockscout.com/tx/0x1cdeea2e520440171093ada28474d523cf9ee11e048193407b7fd9ad26410d99) |
| `QuestASC.setSupportedChain(1, true)` | [`0xf6095f7f…c213a6`](https://creditcoin-testnet.blockscout.com/tx/0xf6095f7fc287bf858812bb7ea71846f6606c5e130639fe355f894df00ec213a6) |
| `QuestASC.setSupportedChain(3, true)` | [`0x53f2aba3…922f72`](https://creditcoin-testnet.blockscout.com/tx/0x53f2aba3315eed1d2cc6c64eef454c69020462d0305fd1894cca914cd4922f72) |
| `QuestASC.setQuestPortal(1, QuestPortal)` | [`0xc8289eb4…1df407`](https://creditcoin-testnet.blockscout.com/tx/0xc8289eb47764c62cf3655a60cbf636570e23bdf3944ae2be06719439d61df407) |
| `QuestASC.addHook(VaelHero)` | [`0x778f8ffa…bc53da`](https://creditcoin-testnet.blockscout.com/tx/0x778f8ffaf33f4a3ef102a960860a65e93ff9d71d8171ecd33aa827c4ecbc53da) |
| `QuestASC.addHook(RaidBoss)` | [`0xc797fabc…aed814`](https://creditcoin-testnet.blockscout.com/tx/0xc797fabcba1acaf5bd2a849723844db75b164d794b58f54ae881e51ac6aed814) |
| `BadgeNFT.setMinter(RaidBoss, true)` | [`0x21afce02…5ec868`](https://creditcoin-testnet.blockscout.com/tx/0x21afce02aaab1cd127fc4338804e44208915f83f586d1aa509d4aaf5465ec868) |
| `Loot.setArena(Arena)` | [`0x67a5cc69…540cf5`](https://creditcoin-testnet.blockscout.com/tx/0x67a5cc69f6df81af8e51d3ef3bc204941a44fcd4131aec15a6e8f8a33a540cf5) |
| `Arena.setRewards(Loot)` | [`0x1296e73e…d0c123`](https://creditcoin-testnet.blockscout.com/tx/0x1296e73ef23ecb1549a3cd19ba5b378fc90ff560c13987632d44f10687d0c123) |
| `Arena.setEquipment(Equipment)` | [`0x55a4c1b9…167164`](https://creditcoin-testnet.blockscout.com/tx/0x55a4c1b9fbabefd90bdd04cc2532d3d1d5bf24d0b13826b33af6172343167164) |

Ten emitter allowlist entries and two Uniswap pool registrations were sent the same way; their
hashes are in the machine-readable block at the end of this file under `V8_ALLOW_*` and `V8_POOL*`.
Eleven `Loot.registerItem` calls are there under `V8_ITEM_*`.

### Badges re-minted onto BadgeNFT v3

A new ERC-721 holds no tokens, so the ten badges the old contract had minted were minted again in
ascending token-id order, which is why an old explorer link to badge 4 still resolves to badge 4.
`BadgeNFT.mintBadge` is `onlyMinter`, so the deployer was made a minter for the length of the
migration and unmade immediately afterwards. Both transactions are in the table above, and
`VerifyBaseline` asserts the privilege is gone.

| Badge token id | Mint tx |
|---|---|
| 1 | [`0x2a10d4de…17df97`](https://creditcoin-testnet.blockscout.com/tx/0x2a10d4de5f25c41e9de404c6a600bf97c6131d283179a59f59d7b7ccb117df97) |
| 2 | [`0x16806ce1…ca1b44`](https://creditcoin-testnet.blockscout.com/tx/0x16806ce158146a27f9e6d3f9e6f72e75802c44007e40ec36196d45f335ca1b44) |
| 3 | [`0x290c1014…ee097d`](https://creditcoin-testnet.blockscout.com/tx/0x290c101484ea34469dc236339ea6b449786aaad9764ff91f6fd27f24bfee097d) |
| 4 | [`0xef028215…9a317d`](https://creditcoin-testnet.blockscout.com/tx/0xef028215a16b6dabeaf6334959f54a90d164a01dade58f3114422c4d8e9a317d) |
| 5 | [`0x11217b8d…6a77e5`](https://creditcoin-testnet.blockscout.com/tx/0x11217b8d688278f8061fffe0ecdc4b96906f9a0d59ed42a1f558d14fc26a77e5) |
| 6 | [`0xfac4cbcf…b1887e`](https://creditcoin-testnet.blockscout.com/tx/0xfac4cbcfb2a6c800d7db69c738cf437ca24cde74a17ec64d127c7e8a63b1887e) |
| 7 | [`0xf96cfa78…8610b1`](https://creditcoin-testnet.blockscout.com/tx/0xf96cfa787314fd9b1356ad6c6e8c1b58751140734952f7fd0b6cdcae058610b1) |
| 8 | [`0xc15a20df…7a48c7`](https://creditcoin-testnet.blockscout.com/tx/0xc15a20df0d7b8d76204e904d4ad809fac3601aea465b43a93efa0293c57a48c7) |
| 9 | [`0xdc1a8ef5…90bfb8`](https://creditcoin-testnet.blockscout.com/tx/0xdc1a8ef52ba4abeffcd3473c3f1d7cc0e6938b7b48f22da071df07aca990bfb8) |
| 10 | [`0x8bf3e5ff…1103b2`](https://creditcoin-testnet.blockscout.com/tx/0x8bf3e5ffad606ee89e6af42217ec450fff6bb5a0d119b806335e2df8311103b2) |

### Campaign pools refunded

`CampaignEscrow.refundToPartner` is `onlyRewardReleaser` and the releaser is QuestASC, which until
milestone 8 had no function that called it. Three funded pools had therefore been stranded since Phase
7 with no path out at all. `QuestASC.refundCampaign` closed that, and all three were returned to
the partner: **1,989.999 VAEL in total, leaving every pool at zero.**

| Campaign | Tx |
|---|---|


## Superseded deployments

### Superseded in the milestone 13 escrow fix, 2026-09-13

`CampaignEscrow` v1 trusted one releaser, `QuestASC`, and `NativePortal` could not reach it. A
campaign quest completed on the native path minted its badge, credited its hero, and released
nothing: quests 16 and 29 in the PenguinSwap demo pool left the pool untouched at 716.4 VAEL. v1's
`setRewardReleaser` was also plain `onlyOwner`, so the owner could have pointed every pool at any
address in one transaction with nothing announcing it first.

| Contract | Superseded address | Replaced by |
|---|---|---|
| `CampaignEscrow` | `0xcF675302d19967788009592423E4E66bd69EA32b` | `0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28` |

**Two deployments, five wiring transactions, and four pools moved.** v2 holds a releaser set
(`ReleaserSet`, bootstrapped once, every later change proposed a day in advance): `QuestASC` for
proved quests and the new `CampaignPayoutHook` (`0xeeB8A2EEf0D8b4B28D50ce130E7a70b871F621b1`) for
native ones. The hook is how the native path reaches the escrow, because `QuestManager.setNativePortal`
is one-shot and a new `NativePortal` would be a new `QuestManager` and the cascade behind it; what
the deployed `NativePortal` does let its owner add is a hook, and this one releases exactly the
quest's reward for a campaign quest `QuestManager` confirms completed, once. `QuestASC.setCampaignEscrow`
re-pointed the proved path ([`0x22ac66e5…68d183`](https://creditcoin-testnet.blockscout.com/tx/0x22ac66e505505041593d4657dce995bf2f929fe844aa38a6289606bdcd68d183)); `NativePortal.addHook` appended the hook
([`0xdc28f357…204ab5`](https://creditcoin-testnet.blockscout.com/tx/0xdc28f357e12fdfaff4e2f7943b7852f79125e7c2630dd0d4b1167193ba204ab5)); `initialiseReleasers` wrote the set ([`0x0f77bd63…0e70c2`](https://creditcoin-testnet.blockscout.com/tx/0x0f77bd63419ad0e10452dddb425a7510a052b7325d8d769e5a7a07175a0e70c2)).

**Every funded pool was refunded out of v1 through `QuestASC` while it still pointed at v1, then
deposited into v2 from the same partner key** at the amount that lands exactly the old balance
after the 0.5% fee, so each pool holds after what it held before. The pool key is `keccak256` of the
campaign id and does not depend on the escrow, so the names and pictures pinned in milestone 12 carry
over untouched. v1 holds no VAEL.

| Pool | VAEL carried | Refund out of v1 | Deposit into v2 |
|---|---|---|---|
| Creditcoin check-in `0x07e1398c…` | 258.05 | [`0x46053111…ba4886`](https://creditcoin-testnet.blockscout.com/tx/0x46053111b922643fc9897c7dbd25de23490e04eddf50d233cbc7d42ef6ba4886) | [`0x56391e9d…a75da9`](https://creditcoin-testnet.blockscout.com/tx/0x56391e9d3aa3bd5dae02b51c9dbfb3965c0725c8ecb7fd7d4f4607d09aa75da9) |
| PenguinSwap on Creditcoin `0x50c9f717…` | 716.4 | [`0x3a070621…f48b59`](https://creditcoin-testnet.blockscout.com/tx/0x3a070621ab4507117a905956f6c1a17f03aba0e152724069bdba2ef3d2f48b59) | [`0x04a6c1de…da6b4e`](https://creditcoin-testnet.blockscout.com/tx/0x04a6c1de7d821f8fd7465c27430ab4559471b2bca6e553c1c8e113c690da6b4e) |
| First steps `0x6fa8f505…` | 327.75 | [`0xec6aea2a…ddaa95`](https://creditcoin-testnet.blockscout.com/tx/0xec6aea2aea84530caf9410205060838d04b4e74ee747b31c245bc3ff01ddaa95) | [`0xc0f7a27d…bf8301`](https://creditcoin-testnet.blockscout.com/tx/0xc0f7a27d2352e0c5b84715eb065149bed397d43be53c5be28b8db2dcb9bf8301) |
| Swap week `0x4a5d2f43…` | 447 | [`0x4726ef7a…dc6c57`](https://creditcoin-testnet.blockscout.com/tx/0x4726ef7aa171121bddd3ccfa642d3f26ec5b902eac3c81e78c923560cfdc6c57) | [`0xb7c02732…751359`](https://creditcoin-testnet.blockscout.com/tx/0xb7c027329fa4905382ea3154112c2a3196d9652c213222ff9b84b9fa30751359) |

**Quests 16 and 29 stay unpaid.** Nothing on chain can pay them now: a release needs a releaser,
a releaser releases only inside a completion, and both completions are recorded. Paying them would
take an owner release, which is the privileged path the escrow refuses to have, so they are listed
as unpaid in `docs/SPEC.md` section 10.3 rather than paid by hand.

### Superseded in the Phase 10c arena fix, 2026-09-11

Arena damage was `2*strength + agility`, with no level in it. A level-1 hero has 110 hit points and
one point of strength, so it dealt two damage a swing: twenty rounds is forty swings, which comes to
eighty. Two new players could not finish a duel however the seed fell, and every duel between them
was a guaranteed draw. Not an unlucky outcome, arithmetic, and it made the arena unusable for
exactly the people most likely to try it first.

| Contract | Superseded address | Replaced by |
|---|---|---|
| `Arena` | `0xCC29353505b1a8F88FC313ffb22926925198d59b` | `0xa98672b481c35f76d09612849E75A2c7A1a976d9` |

**One deployment and three wiring transactions.** `Loot.setArena` is a setter and `Arena.setRewards`
and `Arena.setEquipment` are too, so nothing else moved: not `VaelHero`, which `Arena` holds
immutably and did not need to change, and not the core. The three duels already fought were refought
on the new contract and produced three winners.

Damage is now `2 + 2*level + 2*strength + agility`, so hit points and damage grow together. A test
walks every level to thirty and asserts no level is a dead zone where a duel cannot end.

### Superseded in the milestone 10b reward-table fix, 2026-09-11

Extending `ActionType` with the two Creditcoin actions left both reward tables ending in a bare
`else`, so wrapping CTC paid 150 XP and hit the raid boss for 300: more than a proved Uniswap swap,
for one local transaction and no wait. The tables live inside `VaelHero` and `RaidBoss`, and four
modules hold one of those immutably, so six contracts moved.

| Contract | Superseded address | Replaced by |
|---|---|---|
| `VaelHero` | `0x6Da74d3F37973FA99eDF8153D2155a9F70235b77` | `0x74befcC907073f5F0125813FEF3A2A22406d3024` |
| `RaidBoss` | `0x201Fe44a8E26Ce866A5DB807b29b90710b527c41` | `0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B` |
| `Arena` | `0x72A9a0eB023A4a903bB541202448919F81E61185` | `0xCC29353505b1a8F88FC313ffb22926925198d59b` |
| `Loot` | `0x2810313DA39b9b8C33a9bc9d4C3bC65AdD8a9072` | `0xFf0271fb151F25cf909d1d8b16017Af54FBb9938` |
| `Equipment` | `0xe3F4DD0A6FbB5E8888a32bE57dC03394cC8302C8` | `0xa04EDa9C22f10960Df6f470e143f7f6a195Dcba6` |
| `Marketplace` | `0x64B80FfE7d54167ACB90D75b73A5459Ea168AbDB` | `0x868Bb518122B670Cd02b93dEeDc6B53DcFA36374` |

**`QuestManager`, `QuestASC`, `NativePortal` and `BadgeNFT` did not move.** That is the timelocked
completer set and the mutable hook list doing their job: the hooks on both completion paths were
re-pointed with four transactions each, and the two new modules were added to their own completer
sets, so a change to a game module no longer drags the core through a cascade. The previous design
would have made this nine deployments instead of six.

Both heroes were imported again with level, XP, stats and streak intact, and the import window was
closed in the next transaction. All eleven loot item definitions were re-registered, and the
superseded `RaidBoss` was revoked as a `BadgeNFT` minter.

`RaidBoss` keeps its season counter in storage, so this deployment starts at season 1 again. The
season seeded afterwards is the second Vael has run and the first on this contract, and it is
recorded as season 1 because that is what the chain says.

### Superseded in the milestone 10 consolidated redeploy, 2026-09-11

`NativePortal` gives `QuestManager` a second completion path. That is a change to `QuestManager`,
and four modules hold `QuestManager` or something downstream of it immutably, so nine contracts
moved together. The map is in `docs/SPEC.md` §17.1a and the runbook that executed it is
`contracts/script/redeploy-phase10.sh`.

| Contract | Superseded address | Replaced by |
|---|---|---|
| `VaelHero` | `0x48C1f60EBf6fE1bE821CE3557818ba24d1589a96` | `0x6Da74d3F37973FA99eDF8153D2155a9F70235b77` |
| `QuestManager` | `0x488dc9C1F6ed0c1d3456E55200C78FACeE7C903e` | `0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7` |
| `QuestASC` | `0x6e457d910285b5a927Da42742bb58218c5CD1885` | `0x05958dD789EaC1de84e864d6b3956C90d3e90d0f` |
| `RaidBoss` | `0x2c01f35B5f3BDD6078af2093AbbB838CfD8C47C7` | `0x201Fe44a8E26Ce866A5DB807b29b90710b527c41` |
| `Arena` | `0xAF6Fe3daC56Fd05dD04a2CdeE97516CD2E90D4DF` | `0x72A9a0eB023A4a903bB541202448919F81E61185` |
| `Loot` | `0x59a40C93A2819B866Fd1495a9d7ce7D7DAc49601` | `0x2810313DA39b9b8C33a9bc9d4C3bC65AdD8a9072` |
| `Equipment` | `0x3924E2AE751d1FE2d84753dC42c3C34708c5Da45` | `0xe3F4DD0A6FbB5E8888a32bE57dC03394cC8302C8` |
| `Marketplace` | `0x33dba17e54b030B3C9A751332513e9a610e76A46` | `0x64B80FfE7d54167ACB90D75b73A5459Ea168AbDB` |

What was carried across, and what was not:

- **Both heroes were imported** with their level, XP, stats, streak and last source height intact,
  and the import window was closed in the next transaction. Token 1 is level 7 on a streak of 15;
  token 2 is level 2 on a streak of 4.
- **All twenty badges stayed where they were.** `BadgeNFT` was not replaced.
- **All eleven loot item definitions were re-registered** on the new `Loot`, with the same slugs,
  stats and IPFS metadata.
- **Three loot NFTs held by players did not survive.** `Loot` is an ERC-1155 with no owner mint: the
  only ways an item exists are a raid claim and an arena reward. Re-issuing them would have needed a
  privilege to mint loot that nothing earned, which is the one thing the design refuses, so they
  were allowed to lapse and are re-earnable through the season-2 raid and the arena. The three were
  Rusted Blade to the deployer and to player 2, and Blessed Blade to the deployer.
- **No campaign pool needed refunding.** All four pools already read zero, and the script refuses to
  run if any of them does not.
- **The superseded `QuestManager` was revoked** on `ReputationRegistry` and the superseded
  `RaidBoss` was revoked as a `BadgeNFT` minter, so neither can still write anything.

This is the last cascade of its kind. `VaelHero` and `RaidBoss` no longer take a one-shot completion
binding: they hold a completer set, and changing it needs a proposal that sits for 24 hours before it
can be accepted. A future completion path is a proposal and a wait, not nine deployments.


Recorded so an explorer link from an old transaction still resolves, and so nobody wires against
one by accident. None of them holds a privilege that matters: the reviewer grant on each superseded
QuestManager was explicitly revoked, and the escrow, the vault, and the token were re-pointed at the
new core rather than replaced.

### Superseded in the milestone 8 consolidated redeploy, 2026-09-10

The cascade is the immutable map in `docs/SPEC.md` §17.1: BadgeNFT v3 and VaelHero v2 were the two
changed contracts, and seven more hold one of them, or something that holds one of them, in an
`immutable`.

| Contract | Address | Why superseded |
|---|---|---|
| `BadgeNFT` v2 | `0xC3FF8f522408fF5FB2192519E70b875a9754aa94` | Transferable, no rarity, off-chain metadata. v3 is soul-bound with a rarity and on-chain base64 metadata |
| `VaelHero` v1 | `0x8bE97BeBB253d7F660529e23e093F18645Fc974b` | No streak multiplier on XP and no import path. Both heroes were imported to v2 by token id |
| `QuestManager` v6 | `0xD701A48cc22224Ca4679178db7a749dC68725EFD` | Holds `BADGE_NFT` immutably. v7 also stops funding the vault for a campaign quest, which was paying the player twice |
| `QuestASC` v5 | `0x929eabBe43d498e7BA47BB69e8C9432703e969Aa` | Holds `QUEST_MANAGER` immutably. v6 releases the quest's reward rather than the decoded action amount, and adds `refundCampaign` |
| `RaidBoss` v1 | `0xE9BB305bCe2466f2Ee2739D499cb18f8721415F6` | Holds both `HERO` and `BADGE` immutably. Season 1, defeated, stays readable on it |
| `Arena` v1 | `0xe3A14E7D140AA38A7c6Ebe6B7C3639539789f6be` | Holds `HERO` immutably |
| `Loot` v1 | `0xD7eA8ca568b0E8BfECC74e88CcC71A438f581D86` | Holds `RAID` immutably. A Loot pointing at the old boss could not see the new boss's damage |
| `Equipment` v1 | `0x983f2510EdA82260b32dB7EAdBcc578e67Ec4517` | Holds both `HERO` and `LOOT` immutably |
| `Marketplace` v1 | `0x5d816890b23593E997f66292b7B446E5a8379D56` | Holds `LOOT` immutably |

### Superseded in milestone 9, 2026-09-10

| Contract | Address | Why superseded |
|---|---|---|
| `Arena` v2 | `0xA8db5D09d539fDa7Cf29707866a72d4B69Cf813B` | Seeded a duel from `blockhash(block.number - 1)` at resolution, so a resolver could wait for a block they liked. v3 commits `seedBlock` at acceptance and bounds resolution to a window, with a void path for a duel that misses it |

Nothing held the Arena address immutably, so this replaced one contract and re-pointed one slot.
`Loot.arena` is both the address Loot trusts and the minter role for arena drops, so setting it to
the new Arena granted the new one and revoked the old one in the same transaction; it was read back
afterwards. The old Arena escrowed nothing at the time, which the redeploy script checks before it
will proceed, because a duel still holding stake would have been stranded.

**What did not carry across, stated plainly.** Heroes, badges, and the loot item registry were
migrated. ERC-1155 loot balances already dropped to players were not: Loot has no owner mint, by
design, and adding one to migrate a testnet balance would have put a privileged mint next to a
system whose whole claim is that drops are earned. Quest ids restart at 1, and the raid season
counter restarts at 1, so the first season on RaidBoss v2 is the second season Vael has run. Every
completed quest, burnt replay key, and old drop stays readable on the superseded contracts above.

### Superseded earlier

Reconstructed from the git history of this file, which is the only complete record of what was
canonical when. Earlier prose in this repository numbered the QuestASC deployments from two rather
than one, so a document written before milestone 8 may call `0x929eabBe…` "v4"; it is the fifth
QuestASC, and the one deployed in milestone 8 is the sixth.

| Contract | Address | Why superseded |
|---|---|---|
| `BadgeNFT` v1 | `0xcA9ef3CCD228223fDa3D3080eFaA8d5F2A8232d3` | milestone 2 baseline, replaced when the badge metadata and minter set changed |
| `QuestManager` v1 | `0x7d8f5f0D5F4523Fb3C8F62a560C00f286CAbed9F` | milestone 2 baseline, before verification rules and the source-height anchor |
| `QuestManager` v2 | `0xE2b5e65F55D90BD096CB93A6aD4BC44048a9c6CA` | Constructed against the v1 RewardVault, whose ledger already held quest ids 1 and 2, which bricked it on its first create |
| `QuestManager` v3 | `0x8E42A111295F72c93d3A23181C4C3E13eCbeF220` | Predates adapter-based decoding |
| `QuestManager` v4 | `0x68B609a29cC6B0635d6A3A6A1eDa5a1bBCCEdE24` | Predates declining handlers |
| `QuestManager` v5 | `0x152BcBCE43EC8a3Ef1a96485A28967AbEEe95377` | Replaced when the milestone 4 hero and raid hooks needed a QuestASC that knew about them |
| `QuestASC` v1 | `0x93866c63CE38936aB832b4635d9B706FC17FD735` | Bound immutably to QuestManager v2 |
| `QuestASC` v2 | `0x983cFa52747708Fe86d125DdFB1Bf67E052793cb` | Bound immutably to QuestManager v3, before adapter-based decoding |
| `QuestASC` v3 | `0xB7D7Bf8e3BEBB1321620C3F5D81E2854B1df9776` | Reverted on a recognised log belonging to another quest, so a Uniswap swap could never complete |
| `QuestASC` v4 | `0x467bF17dcf7A5988dC96b2F8e3Af571169176780` | Bound immutably to QuestManager v5 |
| `RewardVault` v1 | `0x4cDa11850a3697940329975EA3943f166Ba6FFf8` | Ledger keyed by questId alone, so a manager redeploy bricked it |

#### Why the core was redeployed twice in milestone 3b

`QuestManager.setQuestASC` is one-shot, so every QuestASC replacement forces a QuestManager
replacement. That happened twice: once to move decoding into adapters, and once to let a handler
decline a log rather than revert on it. The second was found by the live network, not by review: a
Uniswap swap emits ERC-20 `Transfer` logs beside its `Swap`, and the first recognised log killed
the whole submission. The adapter split is precisely what stops the *next* protocol from costing a
redeploy, which is why all four adapters survived milestone 8 untouched.

`CampaignEscrow.setRewardReleaser` is plain `onlyOwner`, not one-shot, so the escrow has never
needed redeploying; it is re-pointed with a single transaction. That is the only reason the three
stranded pools could be refunded at all rather than being lost with a replaced escrow.

#### Why the vault was redeployed

`RewardVault` keyed its funding ledger by `questId` alone. Quest ids are a per-manager counter that
restarts at 1, so the first `createQuest` on QuestManager v2 reverted
`RewardVault__QuestAlreadyFunded(1)` against ids the v1 manager had already funded, and because the
id counter only advances on a successful create, the manager was permanently stuck.

This was found by the live E2E run, not in review. The ledger is now keyed by
`keccak256(questManager, questId)`, so a manager redeploy is safe without touching the vault again.
`test/RewardVault.t.sol` covers it, and milestone 8 proved it: QuestManager v7 funds quest id 1 on a
vault that already holds six managers' worth of history.

## Bindings that cannot be quietly changed

Irreversible, set once and never again:

- `QuestManager.setQuestASC` → `QuestASC`. Only that contract can complete a proof quest.
- `QuestManager.setNativePortal` → `NativePortal`. Only that contract can complete a native quest.
  `recordCompletion` picks between the two by the quest's own action type and accepts nobody else.
- `VaelHero.closeImport()`. The owner can no longer write hero state.

Changeable, but only slowly and in the open:

- `VaelHero.completers` and `RaidBoss.completers` were seeded once with `QuestASC` and
  `NativePortal`. Every change after that is `proposeCompleter`, then a 24-hour wait, then
  `acceptCompleter`, and the proposal is public the whole time. This replaced a one-shot binding so
  that adding a third completion path costs a proposal and a wait rather than nine deployments.
  A completer can write hero XP and raid damage and nothing else: VAEL sits behind
  `RewardVault.onlyQuestManager`, badges behind `BadgeNFT.onlyMinter`, and quest status behind
  QuestManager's own check.

`CampaignEscrow.setRewardReleaser` is deliberately not one-shot, and `BadgeNFT.setMinter` is
revocable. `VerifyBaseline` asserts every one of these, including that the deployer is no longer a
badge minter and that neither module has a completer change in flight, so a rewiring fails the
check.

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

`contracts/script/smoke-baseline.sh` runs against this deployment with `cast` alone, no API and no
web app. It creates a quest as the registered agent, checks the RewardVault actually minted the
reward, accepts it as the assigned participant, finds `QuestAccepted` in the receipt, and then
asserts that `recordCompletion` from the deployer reverts with `QuestManager__OnlyQuestASC`
(`0xe2a34f59`).

That last assertion is the security claim of the whole project. If it ever stops reverting, a
backend key can pay itself.

---

<!-- Machine-readable address book. Read by the deployment, wiring, and verification scripts, and
     by VerifyBaseline through the eval at the top of this file. One line per key. -->

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
BADGE_NFT_ADDRESS=0x6b57F8a913FBC175ff46B53542F23D362e46d8f2
BADGE_NFT_ADDRESS_TX=0x3c8142f338968e7d28568a6586aca97c4de44df777be85f9100b4bb4f08b99d2
BADGE_NFT_ADDRESS_BLOCK=5463522
QUEST_MANAGER_ADDRESS=0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7
QUEST_MANAGER_ADDRESS_TX=0xec01d72916512f1839543e64d8e0d5cd67ffce13c7327458539940f924a12281
QUEST_MANAGER_ADDRESS_BLOCK=5463524
CAMPAIGN_ESCROW_ADDRESS=0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28
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
EVM_V1_DECODER_LIBRARY_ADDRESS=0xf46cFB693202B56b7C9D9242FE12acdf29c8A344
EVM_V1_DECODER_LIBRARY_ADDRESS_TX=0xbbf7c45a491b8e0ca60fcc7e1421e5dda99e27f709c8fdcbe0796a703036d187
EVM_V1_DECODER_LIBRARY_ADDRESS_BLOCK=5455497
QUEST_MANAGER_V1_ADDRESS=0x7d8f5f0D5F4523Fb3C8F62a560C00f286CAbed9F
QUEST_MANAGER_V1_ADDRESS_TX=0xe76b6cf78e828e5945fd36083f21c7658c56309ee45aa02ce2a7d2bbb2944e90
QUEST_MANAGER_V2_ADDRESS=0xE2b5e65F55D90BD096CB93A6aD4BC44048a9c6CA
QUEST_MANAGER_V2_ADDRESS_TX=0xcbb1c3f0bc3104c0e417cd33317c99372b7ca546e9a9f6b06f1a679adc5d3b3a
QUEST_ASC_ADDRESS=0x05958dD789EaC1de84e864d6b3956C90d3e90d0f
NATIVE_PORTAL_ADDRESS=0xa512544f721230Fa04560078D0dC214423FE2970
QUEST_ASC_ADDRESS_TX=0x705a77dfd05df01502197de370d2ead88e9e083fe709b5b34761053e0016a5cb
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
PENGUINSWAP_ROUTER_ADDRESS=0x052ffAaAe6e24a1ff9F197c46c29dfdB53Bd61F5
PENGUINSWAP_FACTORY_ADDRESS=0x7316C24Cb58a49673DdC3EE369d20806083BA48C
PENGUINSWAP_POSITION_MANAGER_ADDRESS=0x74501E231E1e8f505Fed029a1B48122114d1f51F
PENGUINSWAP_WCTC_ADDRESS=0x56072113e08015e1c40A3F3f656b1C1Fa78E329E
PENGUINSWAP_USD1_ADDRESS=0xC5a26b7e112473734d3fE33f65800F615628C021
PENGUINSWAP_POOL_WCTC_USD1_500=0x1CA47Fe8F87774d56ADbf2BA666940Fa760638ff
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
VAEL_HERO_ADDRESS=0x74befcC907073f5F0125813FEF3A2A22406d3024
VAEL_HERO_ADDRESS_TX=0xe3eec7759a0ad92a7cbc37f99c8a23a8c3ece5eab4ca2e817170c9c54b3876f8
RAID_BOSS_ADDRESS=0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B
RAID_BOSS_ADDRESS_TX=0x9f4e1268ac09730ac2291a7947d9cef541ba9c7580ea1f1cbe7594a3dafd1b9f
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
ARENA_ADDRESS=0xa98672b481c35f76d09612849E75A2c7A1a976d9
ARENA_ADDRESS_TX=0x943673fd335450ba87c7eb2fbc2ecfa6340df62ef0f8240fe4788aeb9c668f76
ARENA_ADDRESS_BLOCK=5464689
LOOT_ADDRESS=0xFf0271fb151F25cf909d1d8b16017Af54FBb9938
LOOT_ADDRESS_TX=0x3988dc4a025f3c74442eea4fe59a24efcbf526b4f2610cece4a0773e8a7b85de
LOOT_ADDRESS_BLOCK=5463528
EQUIPMENT_ADDRESS=0xa04EDa9C22f10960Df6f470e143f7f6a195Dcba6
EQUIPMENT_ADDRESS_TX=0x8f6b833c0e44a096211e43a46f1d41a72415b4da3b79124c8254093d21383a76
EQUIPMENT_ADDRESS_BLOCK=5463529
MARKETPLACE_ADDRESS=0x868Bb518122B670Cd02b93dEeDc6B53DcFA36374
MARKETPLACE_ADDRESS_TX=0x26b48659df71983269d6367625dbcd608e35d11b13a626a248d4c6a43b1ecfad
MARKETPLACE_ADDRESS_BLOCK=5463530
W6_LOOT_ARENA_TX=0x1dd39c7e6d26096602167b33705209df4a62e827b58bcb7d169d6db1c66c0006
W6_ARENA_REWARDS_TX=0x5966a7b2932b50a6eb29bbd908e6a9e3f793107754b626d82432a64d46dce9bf
W6_ARENA_EQUIPMENT_TX=0x66e1ecd6837958fbc7b8a8f46c68607f6bf9f8ec4814133b30d2014ff0d20c74
W6_ITEM_RUSTED_BLADE_TX=0xfffaad1504f6023fd3d47f84db01e14f8ad9232365b776fd83e374dc735e1b48
W6_ITEM_PADDED_VEST_TX=0xbdfbdf0e20a5b6a5758dce869479ea6652f16cf7aa296d0ac960d5a3f3e752f9
W6_ITEM_IRON_SWORD_TX=0xab9c91f7591b37679795c8d362ea7516ee5bcc90426716d0bdc49e0418bed9b2
W6_ITEM_SWIFT_CHARM_TX=0x30b6c8b12fad57d18b57c7b9752d012e8e151dec7e35f7cffcbdb57cee95e986
W6_ITEM_PLATE_HARNESS_TX=0xb3d07a5ff0f521161b36fda3dd716aeab2effd5ae5bc9602bea9c5bfb35f349b
W6_ITEM_SCHOLARS_SCROLL_TX=0x3dc82d802a67c6e78c1860f3b7292aa93dd0c7b3c09dbdeae1eef69db40a37f6
W6_ITEM_ARCANE_CODEX_TX=0xe1ccedea1abb9ccf8ea1ec67317b3ffb5822b570dd41e88ba1cfc206292d371f
W6_ITEM_WARHAMMER_TX=0x4068e699c6066665cf792a583886563b4f04971bd2e30cd1d0c2be722346a9a9
W6_ITEM_GILDED_AEGIS_TX=0xa01a6e1113d078467716f64a9ef3f0bb1d6274b76152158a599cc3923fa65ebf
W6_ITEM_BLESSED_BLADE_TX=0xdfda03b741776c82f7d6386664639b4f9d19d1a355619af1f1029542c6124698
W6_ITEM_SEERS_CRYSTAL_TX=0x8547ddac5d835e4ff595b2be1870051525dca6d76fab84f387d3ddfa8724ebb5
V8_BADGE_NFT_ADDRESS=0x6b57F8a913FBC175ff46B53542F23D362e46d8f2
V8_BADGE_NFT_ADDRESS_TX=0x3c8142f338968e7d28568a6586aca97c4de44df777be85f9100b4bb4f08b99d2
V8_BADGE_NFT_ADDRESS_BLOCK=5463522
V8_VAEL_HERO_ADDRESS=0x48C1f60EBf6fE1bE821CE3557818ba24d1589a96
V8_VAEL_HERO_ADDRESS_TX=0xe3eec7759a0ad92a7cbc37f99c8a23a8c3ece5eab4ca2e817170c9c54b3876f8
V8_VAEL_HERO_ADDRESS_BLOCK=5463523
V8_QUEST_MANAGER_ADDRESS=0x488dc9C1F6ed0c1d3456E55200C78FACeE7C903e
V8_QUEST_MANAGER_ADDRESS_TX=0xec01d72916512f1839543e64d8e0d5cd67ffce13c7327458539940f924a12281
V8_QUEST_MANAGER_ADDRESS_BLOCK=5463524
V8_QUEST_ASC_ADDRESS=0x6e457d910285b5a927Da42742bb58218c5CD1885
V8_QUEST_ASC_ADDRESS_TX=0x705a77dfd05df01502197de370d2ead88e9e083fe709b5b34761053e0016a5cb
V8_QUEST_ASC_ADDRESS_BLOCK=5463525
V8_RAID_BOSS_ADDRESS=0x2c01f35B5f3BDD6078af2093AbbB838CfD8C47C7
V8_RAID_BOSS_ADDRESS_TX=0x9f4e1268ac09730ac2291a7947d9cef541ba9c7580ea1f1cbe7594a3dafd1b9f
V8_RAID_BOSS_ADDRESS_BLOCK=5463526
V8_ARENA_ADDRESS=0xA8db5D09d539fDa7Cf29707866a72d4B69Cf813B
V8_ARENA_ADDRESS_TX=0x25b9d26a5a4b3c4f3fd0555fe6e7da0a8c171ac58333d7ca2d54646c1115a999
V8_ARENA_ADDRESS_BLOCK=5463527
V8_LOOT_ADDRESS=0x59a40C93A2819B866Fd1495a9d7ce7D7DAc49601
V8_LOOT_ADDRESS_TX=0x3988dc4a025f3c74442eea4fe59a24efcbf526b4f2610cece4a0773e8a7b85de
V8_LOOT_ADDRESS_BLOCK=5463528
V8_EQUIPMENT_ADDRESS=0x3924E2AE751d1FE2d84753dC42c3C34708c5Da45
V8_EQUIPMENT_ADDRESS_TX=0x8f6b833c0e44a096211e43a46f1d41a72415b4da3b79124c8254093d21383a76
V8_EQUIPMENT_ADDRESS_BLOCK=5463529
V8_MARKETPLACE_ADDRESS=0x33dba17e54b030B3C9A751332513e9a610e76A46
V8_MARKETPLACE_ADDRESS_TX=0x26b48659df71983269d6367625dbcd608e35d11b13a626a248d4c6a43b1ecfad
V8_MARKETPLACE_ADDRESS_BLOCK=5463530
V8_IMPORT_HERO_1_TX=0xf34804404ac46d506b00421e0901dc7ec77587b87012d71e99d9abc4f6194a73
V8_IMPORT_HERO_2_TX=0x255fdf1889282ace5273779d574d8e854d8d903e9af5fc86d777c14218620e2c
V8_HERO_CLOSE_IMPORT_TX=0x9de7a507807d04daebd88b4813b353a4dc0f2d88eaecd0dc9ea4cd3af13b6270
V8_BADGE_MINTER_SELF_TX=0xa02ad49d6af630ca87b47ec836578fc496433a5107b7162ef0cb3acace6846ce
V8_BADGE_1_TX=0x2a10d4de5f25c41e9de404c6a600bf97c6131d283179a59f59d7b7ccb117df97
V8_BADGE_2_TX=0x16806ce158146a27f9e6d3f9e6f72e75802c44007e40ec36196d45f335ca1b44
V8_BADGE_3_TX=0x290c101484ea34469dc236339ea6b449786aaad9764ff91f6fd27f24bfee097d
V8_BADGE_4_TX=0xef028215a16b6dabeaf6334959f54a90d164a01dade58f3114422c4d8e9a317d
V8_BADGE_5_TX=0x11217b8d688278f8061fffe0ecdc4b96906f9a0d59ed42a1f558d14fc26a77e5
V8_BADGE_6_TX=0xfac4cbcfb2a6c800d7db69c738cf437ca24cde74a17ec64d127c7e8a63b1887e
V8_BADGE_7_TX=0xf96cfa787314fd9b1356ad6c6e8c1b58751140734952f7fd0b6cdcae058610b1
V8_BADGE_8_TX=0xc15a20df0d7b8d76204e904d4ad809fac3601aea465b43a93efa0293c57a48c7
V8_BADGE_9_TX=0xdc1a8ef52ba4abeffcd3473c3f1d7cc0e6938b7b48f22da071df07aca990bfb8
V8_BADGE_10_TX=0x8bf3e5ffad606ee89e6af42217ec450fff6bb5a0d119b806335e2df8311103b2
V8_BADGE_MINTER_REVOKE_TX=0x0ed3bc98963a53dd389c2a0fe8ea675a466f427a69e2b47c0b010aec2e67649d
V8_ITEM_RUSTED_BLADE_TX=0x4a653f411ca478f7f82f027c23e9ac73946504b6f41b5918e0f8163cffbfc008
V8_ITEM_PADDED_VEST_TX=0x76407dcb15a245281b6c99901bba2114248ca9aa6fcf735dfa4226a3a3c2e1e1
V8_ITEM_IRON_SWORD_TX=0x4fe0ecb6350d44f7d500651323e339927d79a32d3638f8287b86e1725d945e30
V8_ITEM_SWIFT_CHARM_TX=0x5f9184f38daac3318175659ba5d622d1ff05a56f3e67a709bfa05426eddab5a1
V8_ITEM_PLATE_HARNESS_TX=0x3948f52eba5d5b6925433de3f632889d02b1d557f472f899a86ee5689b227c1c
V8_ITEM_SCHOLARS_SCROLL_TX=0x90d4c73884ed3b8bdc37eff301bd836a1054761819a5a2502f78a9d2f5082018
V8_ITEM_ARCANE_CODEX_TX=0x992b057a87e533fc156ed2122802f8d04c8f0b17686a2a8553b693b09cfc7e9f
V8_ITEM_WARHAMMER_TX=0x555f3405263768a9883994db0d349d9526f39b0c5da41ae8e8c1f7782cdae4f9
V8_ITEM_GILDED_AEGIS_TX=0x62a20b13ac8491156063138d6c1e0e47349203f7b2d8bcc3c4456741ef9121d6
V8_ITEM_BLESSED_BLADE_TX=0xe1d19c32846ed8757e2a4209a81d7b6baa5d2a074793cba5a3d22ac163746e12
V8_ITEM_SEERS_CRYSTAL_TX=0xc4e9d7ea18edcacfedc57f01a8808bdbfd2b25a9e460d84f81094a179b2ca232
V8_VAULT_MANAGER_TX=0x6174eed78f2055b7717cae37c18e95e58708de9b433fe2ff47fa9df1c1caddb6
V8_BADGE_MANAGER_TX=0x3da9d8fbe6d71433166ff7a1683802202293d3e593c43a574d4af6430900f604
V8_REPUTATION_AUTH_TX=0x12b8e06a46fc1ee7ce8d44504f4d561bf7a17cc7bb6005b1154d7faae06b3108
V8_REPUTATION_REVOKE_TX=0x38f46e1e0beece4c33aa2aceaca6243a074e4049a405965bbc6bc27934dbee09
V8_ESCROW_RELEASER_TX=0xf0be6332a786911022ce6b1c5a68598cf6bb45eee7b5ac0a8ae6139b2e432163
V8_QM_ASC_TX=0xc4f924322f70f572afadf277aeba44f1453582499a84f352a84924bbf7f3a094
V8_HERO_ASC_TX=0x109f31f958bfd21fc0a9c8e571e45256e7dc2e29a694eb56597ee862a59bb8a0
V8_RAID_ASC_TX=0x47858e8b83f0775117eb73d096dc36d58cbdeaab4a758f32bf39ad7c7366565a
V8_ASC_ESCROW_TX=0x1cdeea2e520440171093ada28474d523cf9ee11e048193407b7fd9ad26410d99
V8_ASC_CHAIN_1_TX=0xf6095f7fc287bf858812bb7ea71846f6606c5e130639fe355f894df00ec213a6
V8_ASC_CHAIN_3_TX=0x53f2aba3315eed1d2cc6c64eef454c69020462d0305fd1894cca914cd4922f72
V8_ASC_PORTAL_TX=0xc8289eb47764c62cf3655a60cbf636570e23bdf3944ae2be06719439d61df407
V8_ADAPTER_PORTAL_TX=0xb9152140e156d9c52d81c3cee6c280084547b27a7fcdf9e26989e4224465d10f
V8_ADAPTER_ERC20_TX=0x02ecd6a0cfbc8c31ae5213ddbdf1da6dffd86dfa111ce8438e637a388d371d12
V8_ADAPTER_SWAP_TX=0xbe91fdb8a3128050aa2adc61b9f3d6ed2659cceaf4c18fcdd6a1e2c2db412b9b
V8_ADAPTER_SUPPLY_TX=0xb71f95427cb15e59245c5314d8fd58a1eaee8656788a5202332715cebf41f8d7
V8_ADAPTER_BORROW_TX=0xd4d2575e9b3156ee56c4043c84b09031e71497a66b7425f57a3fa701cb606dd7
V8_ADAPTER_ERC20_M_TX=0x11018dfeb69e8db704b775f18af105fe73decec612b6f21e16a201597c48b070
V8_ALLOW_ERC20_WETH_TX=0xc0ff235fb82079646633d2d8cc011def842e54d885adada52fed333b29cd4b99
V8_ALLOW_ERC20_USDC_TX=0x53ea55d2c59179343c002d3a4353cb83dd9892f59356e70af7e3df28fd1856f7
V8_ALLOW_ERC20_AUSDC_TX=0xfe635e01f6ed471e427395c08a1605b67a2fb4c81cac972ba0fa419a41fbfdab
V8_ALLOW_ERC20_ADAI_TX=0xc1040ba38ccd0e7d5b0b694600a401d0e0f9a1d3e593b7c7fb2081a6b0810245
V8_ALLOW_ERC20_AWETH_TX=0xbfe2a189235483f86470344305b83344771a04848a651a6c3b8c5bd6e9595722
V8_ALLOW_ERC20_ALINK_TX=0x3e6963bbdca188598aca52a6167fb365a791b09b5bff97e9781ba2adb6235b1e
V8_ALLOW_SWAP_P500_TX=0xc53eca84a180b5d010dac0616427274364f19d300ef89a3f5ef37e94bf91b7c6
V8_ALLOW_SWAP_P3000_TX=0xcd95a9490a27586a5640ecf515b98a4e75c647ff80906ab206f205ebad6ced53
V8_ALLOW_AAVE_SUPPLY_TX=0x7880ce0435bd0783ccb75f8e4acec9a1762ce6460681dc4cd27dee2281e5b9c1
V8_ALLOW_AAVE_BORROW_TX=0x0c64057593252f42da3cbe799fe89608f589f0d8a5e8c2b5829e01157967736f
V8_ALLOW_ERC20_M_USDC_TX=0x5d30310401b0f70111b212f235e50a963e14354470d2492c2d04b3eb45203b8e
V8_POOL500_TX=0x79413f175976d0307d3fe7a2b2c9cd552a7884c1f1c82207f00a58be450c9ff7
V8_POOL3000_TX=0x769aa710a6b56564cd2b75abf4b2243e99cc0c808e13463ae19c759e00e38aab
V8_HOOK_HERO_TX=0x778f8ffaf33f4a3ef102a960860a65e93ff9d71d8171ecd33aa827c4ecbc53da
V8_HOOK_RAID_TX=0xc797fabcba1acaf5bd2a849723844db75b164d794b58f54ae881e51ac6aed814
V8_BADGE_MINTER_RAID_TX=0x21afce02aaab1cd127fc4338804e44208915f83f586d1aa509d4aaf5465ec868
V8_LOOT_ARENA_TX=0x67a5cc69f6df81af8e51d3ef3bc204941a44fcd4131aec15a6e8f8a33a540cf5
V8_ARENA_REWARDS_TX=0x1296e73ef23ecb1549a3cd19ba5b378fc90ff560c13987632d44f10687d0c123
V8_ARENA_EQUIPMENT_TX=0x55a4c1b9fbabefd90bdd04cc2532d3d1d5bf24d0b13826b33af6172343167164
VAEL_HERO_ADDRESS_BLOCK=5463523
QUEST_ASC_ADDRESS_BLOCK=5463525
RAID_BOSS_ADDRESS_BLOCK=5463526
SUPERSEDED_QUEST_MANAGER_ADDRESS=0xD701A48cc22224Ca4679178db7a749dC68725EFD
SUPERSEDED_QUEST_ASC_ADDRESS=0x929eabBe43d498e7BA47BB69e8C9432703e969Aa
SUPERSEDED_BADGE_NFT_ADDRESS=0xC3FF8f522408fF5FB2192519E70b875a9754aa94
SUPERSEDED_VAEL_HERO_ADDRESS=0x8bE97BeBB253d7F660529e23e093F18645Fc974b
SUPERSEDED_RAID_BOSS_ADDRESS=0xE9BB305bCe2466f2Ee2739D499cb18f8721415F6
SUPERSEDED_ARENA_ADDRESS=0xe3A14E7D140AA38A7c6Ebe6B7C3639539789f6be
SUPERSEDED_LOOT_ADDRESS=0xD7eA8ca568b0E8BfECC74e88CcC71A438f581D86
SUPERSEDED_EQUIPMENT_ADDRESS=0x983f2510EdA82260b32dB7EAdBcc578e67Ec4517
SUPERSEDED_MARKETPLACE_ADDRESS=0x5d816890b23593E997f66292b7B446E5a8379D56
VAEL_HERO_V1_ADDRESS=0x8bE97BeBB253d7F660529e23e093F18645Fc974b
RAID_BOSS_V1_ADDRESS=0xE9BB305bCe2466f2Ee2739D499cb18f8721415F6
ARENA_V1_ADDRESS=0xe3A14E7D140AA38A7c6Ebe6B7C3639539789f6be
LOOT_V1_ADDRESS=0xD7eA8ca568b0E8BfECC74e88CcC71A438f581D86
EQUIPMENT_V1_ADDRESS=0x983f2510EdA82260b32dB7EAdBcc578e67Ec4517
MARKETPLACE_V1_ADDRESS=0x5d816890b23593E997f66292b7B446E5a8379D56
V9_ARENA_ADDRESS=0xAF6Fe3daC56Fd05dD04a2CdeE97516CD2E90D4DF
V9_ARENA_ADDRESS_TX=0x943673fd335450ba87c7eb2fbc2ecfa6340df62ef0f8240fe4788aeb9c668f76
V9_ARENA_ADDRESS_BLOCK=5464689
V9_LOOT_ARENA_TX=0x10cea306565c739404221de3603947bd1f65540c6b5577f2279e8b7908be14b5
V9_ARENA_REWARDS_TX=0x253b4b002e8e10990ce57de6d1250c646af35e3133c4a7046906808a56a24a18
V9_ARENA_EQUIPMENT_TX=0xef6b7ca429e44e6ffc1a3a565c92963cb860455982b58001667e177eb82a1b69
ARENA_V2_ADDRESS=0xA8db5D09d539fDa7Cf29707866a72d4B69Cf813B
V10_VAEL_HERO_ADDRESS=0x6Da74d3F37973FA99eDF8153D2155a9F70235b77
V10_VAEL_HERO_ADDRESS_TX=0x2af9339d50ef3918966b97fb811b885e4c674933cacf929b1a84f353a8f3db02
V10_VAEL_HERO_ADDRESS_BLOCK=5465160
V10_QUEST_MANAGER_ADDRESS=0x56385ac5cc5F1817ac96d8D1632E53f3A9a412B7
V10_QUEST_MANAGER_ADDRESS_TX=0x4dd8faf8c3e157745a8a4ebb0744e7720657be79d80e9934decb6bad51c9bcaa
V10_QUEST_MANAGER_ADDRESS_BLOCK=5465161
V10_QUEST_ASC_ADDRESS=0x05958dD789EaC1de84e864d6b3956C90d3e90d0f
V10_QUEST_ASC_ADDRESS_TX=0xd12cc7c9a2e807da9c4a881d4d913c8930667e1a3f4345f9abe6982e71cbee36
V10_QUEST_ASC_ADDRESS_BLOCK=5465162
V10_NATIVE_PORTAL_ADDRESS=0xa512544f721230Fa04560078D0dC214423FE2970
V10_NATIVE_PORTAL_ADDRESS_TX=0x9a9a428778c6962ff5d3204d76559416cfc9879abe4f826f0ab630e481d2b51a
V10_NATIVE_PORTAL_ADDRESS_BLOCK=5465163
V10_RAID_BOSS_ADDRESS=0x201Fe44a8E26Ce866A5DB807b29b90710b527c41
V10_RAID_BOSS_ADDRESS_TX=0x62de89a336ac9d0c50894d38dc65af1deb50abcdba941959d0065f799b147774
V10_RAID_BOSS_ADDRESS_BLOCK=5465164
V10_ARENA_ADDRESS=0x72A9a0eB023A4a903bB541202448919F81E61185
V10_ARENA_ADDRESS_TX=0x49e8003e8b62ac6ddaca3fde255277da4f109215050493fe94bfd63b4d0682e9
V10_ARENA_ADDRESS_BLOCK=5465165
V10_LOOT_ADDRESS=0x2810313DA39b9b8C33a9bc9d4C3bC65AdD8a9072
V10_LOOT_ADDRESS_TX=0x143919a140732a0d5c9fbd13afb32097d25864a2e6c4d742fd3152f47fef8048
V10_LOOT_ADDRESS_BLOCK=5465166
V10_EQUIPMENT_ADDRESS=0xe3F4DD0A6FbB5E8888a32bE57dC03394cC8302C8
V10_EQUIPMENT_ADDRESS_TX=0x30e28824e6776ae62118dbe3c86ea11af342e251dd834a387213978ce187662e
V10_EQUIPMENT_ADDRESS_BLOCK=5465167
V10_MARKETPLACE_ADDRESS=0x64B80FfE7d54167ACB90D75b73A5459Ea168AbDB
V10_MARKETPLACE_ADDRESS_TX=0x2d75a9378306ccc9573099fd31314bbe153dd273ecd62d932f3ae5a5fb39350e
V10_MARKETPLACE_ADDRESS_BLOCK=5465168
V10_IMPORT_HERO_1_TX=0xe9a5fb7f074c688049a9b7f795512c03560faa1d4a81f843980f01946b3a0470
V10_IMPORT_HERO_2_TX=0x767b3c6a98f50e8f9fc7fa10511f692c61fc37136b9e51e903bb738ae0e4b06c
V10_HERO_CLOSE_IMPORT_TX=0x9595cfb49534b6abc3f66bca4e9df7748ef1a4e8a838bb4ac850c01ed30a9824
V10_ITEM_RUSTED_BLADE_TX=0x59bbf9af7d68e626707f4cf89ad341f0be3b6221dca55634b1b9a19f75560e76
V10_ITEM_PADDED_VEST_TX=0xcd09e2dd2e024b7549f689cc9a98e5d6d69d17b01297eb6cc6ab4b03fc448d26
V10_ITEM_IRON_SWORD_TX=0xcbc60e6228dcd542f0289c52eb25434c3f13072f203461b73bcf914cf2a7ca00
V10_ITEM_SWIFT_CHARM_TX=0x67906328d4634530fd1615eb3ed8b227ace56cb92f9ee12055dacf4f2d2f882a
V10_ITEM_PLATE_HARNESS_TX=0xb65166b25484a7e03a42f4f0370e1446736369cbe785116a216292a901724ae7
V10_ITEM_SCHOLARS_SCROLL_TX=0x9f680cc1308161a6b4201117a1736ccc698f141b9fb7e334c1c7cf6410677383
V10_ITEM_ARCANE_CODEX_TX=0x77830d21e2033f56cc16a97a76d268b502deeae7c7180f5e5af738de73a99bc2
V10_ITEM_WARHAMMER_TX=0xd54d4688bf4c9e77caa32ab847e4cc984914e211b9a92c9a23b8408196c947fd
V10_ITEM_GILDED_AEGIS_TX=0x994f343753563c0469702dabf5a95fb9efab4a8ac197606dfc4e7fc94a2a7af4
V10_ITEM_BLESSED_BLADE_TX=0xda6b43ba96c46d7c5042f5ec4d74f8b26484d6d49349ef654ef96e7d07610cc8
V10_ITEM_SEERS_CRYSTAL_TX=0x06ca660ac218733ed5ddf2622468519370dd94c28197a95ab25c6108d302cf6b
V10_VAULT_MANAGER_TX=0xf71ec3130ad6f4a59b9dbcd23b2d228df1c90b7ebd34d8424719366231b85e2b
V10_BADGE_MANAGER_TX=0x7854ae780ec1f1df7ee03fb079f9fdd9b281868d2c346aaf5486778d3374df4f
V10_REPUTATION_AUTH_TX=0xf6025387e96d1fdaa230ea938f76e0312e3e541d35d59169adda3e1c6597f64f
V10_REPUTATION_REVOKE_TX=0x51833a347534ea46e223c21d49f6e6a53875ac1561bb6f3b962c73d6aff52070
V10_ESCROW_RELEASER_TX=0x99fdfcccd487edce64fe872514120b79e04183ca0bd0ae5f5f3a7bdc2a7103c9
V10_QM_ASC_TX=0x3c1be1f089f74a3bc0bcab4d593c6f108d411ff73a61926eb44597718f2e99e7
V10_QM_NATIVE_TX=0x610bee1b8ac57eaed95b128333e7d33193b2298671e6b05d723fd65e0be8a6d5
V10_HERO_COMPLETERS_TX=0x015bba41a3de2bb15270a9946afa2341c685720e128fc8dc92413875a2ecc718
V10_RAID_COMPLETERS_TX=0x06f6a8b3390ae8c304c877b6af028a5761504d391e2f0e75a6873a61b982c4ba
V10_ASC_ESCROW_TX=0x0f588bde7b2fb7a9c00d7347cff7789c3fc9f05735837851b21f3e137c2e0895
V10_ASC_CHAIN_1_TX=0xffa55fddaa72fa87d53b40f5fb7b30c623ef400ccf1961fd62a108a37214bd04
V10_ASC_CHAIN_3_TX=0x9f369df238235e1f9c2a03dc56291b2866f1f254efda5f304a5e09a49a98de25
V10_ASC_PORTAL_TX=0xcee8398a4563397fa420a2c5d3e33128aa1d5f844091b64d8f1ff901671fff3f
V10_ADAPTER_PORTAL_TX=0x457480e6a5a0e01a852b2a023e8159a039d7896aef52d4a15571fe7b3f834bad
V10_ADAPTER_ERC20_TX=0x23cbc74a7a9a799263a4ee76910d5a7b348e71e09267cb4af41e349757aa6d5a
V10_ADAPTER_SWAP_TX=0x64fd5802337f644a623a4e8c50c42bfc22650c411e0f69f7ab3a41a23b4cc00e
V10_ADAPTER_SUPPLY_TX=0x762f0de970621e81314cb2802f882c8b79588924d655be5682be2ea07634d9ee
V10_ADAPTER_BORROW_TX=0x104e4bf4a0d5f5fc13049e1de7436284f094d5e83385a0ec4fc44156b2af2c47
V10_ADAPTER_ERC20_M_TX=0x9c3bcac4e9763aa6605cb094d3be190d55a0a37acaba8966618aa768f34ff6f0
V10_ALLOW_ERC20_WETH_TX=0x157e09665a27c3c7ac4a3bea0e4a602619a3a554d2bb3cb262d2ab8f2899ff36
V10_ALLOW_ERC20_USDC_TX=0x3c1c9c074bf96419f0c71d4f2359b6b3666aa666eb091ca536330ea6d2d3799c
V10_ALLOW_ERC20_AUSDC_TX=0xd3e69f9ae5574d28a2242f8280f1d73afcd5bcc72dea6e46cfcc5b2735f1e1d3
V10_ALLOW_ERC20_ADAI_TX=0x9b13c61f6566fa0c196bd094e887315f11bf62bdbe2846b36325a07f6c4c4b12
V10_ALLOW_ERC20_AWETH_TX=0xe3e3c90f251e1d05e2352bf4389c3620905506e793fb9a3fc429e44675d67ead
V10_ALLOW_ERC20_ALINK_TX=0x2dfdb94308b7aaf4c8e422a21dc7b141aadd4a7a56487dc4010317851a03e55b
V10_ALLOW_SWAP_P500_TX=0x910afd48123b2e3554d1cb5a6a06def825faf7e2722e4deadf82283b59aac762
V10_ALLOW_SWAP_P3000_TX=0x11d802902766e58bb7c477a1be1205d53337e0e1a840d9a325c6586b2f6ff891
V10_ALLOW_AAVE_SUPPLY_TX=0xb1a9e5b41c443be10a1617cd8183e57a043e703e40832ec8314f4f9e47d233d2
V10_ALLOW_AAVE_BORROW_TX=0xbf6570aa2ed1b2784b1821aa51b1b33808cbf2f46c9fec966668e67920ea58ed
V10_ALLOW_ERC20_M_USDC_TX=0xeeeade4f12af679b285543bd7cd03ee8ef43699a9418face74673adeb13ee209
V10_POOL500_TX=0xddb8ba54ab11a16aa484abd1f9b6844efdb901179afb8f58400adedcc3652018
V10_POOL3000_TX=0x08b1dbecf4938e8ba6d3c03f91833fe26b969c5d87f81c97afb704505f2d56af
V10_ASC_HOOK_HERO_TX=0xf05924ee370f3da8fbeada6e68157d7602733c7442e1fa14fbedaf0257f4c16f
V10_ASC_HOOK_RAID_TX=0xd5eaae62554d23811db0c9a5ba1e912b91d01d695c19b6bccee087b6d568be33
V10_NATIVE_HOOK_HERO_TX=0xa1ed76f4a655186e72baf9c11e4b1fa78e01b9cff15c42eef0b579cdc69aabeb
V10_NATIVE_HOOK_RAID_TX=0xff69293c9b466cbaa2cecb0ef497edde2fb7cd48a3c5081e51d38372d4c568c0
V10_NATIVE_ROUTER_TX=0xd7cfe713e716e4ca578f8477494d0155aa73d0077f731679b0341f6302ba653d
V10_NATIVE_WCTC_TX=0xb3de97abf8fa098c9943d9dac03692680a5349f07688663e95e6a53fea6f1a3b
V10_BADGE_MINTER_RAID_TX=0x8e6ad642d37b8be4ab69837d9fbcb4b2a620eedacab5eefc08501a9e4659dc3c
V10_BADGE_MINTER_REVOKE_TX=0x8015032b418748133efc142d3860d1a733562780ae019df652db8568f3dfa2e4
V10_LOOT_ARENA_TX=0x8be31946ec6296d8b1989fe9e6de9d072bc01940f7cf8f076554a114f9f51046
V10_ARENA_REWARDS_TX=0xe18cc0ef08c319b02d678ba5453b132ce24b15df657c28f1efd35e737e62df4d
V10_ARENA_EQUIPMENT_TX=0xfce44e2c4c15ab0d6d6ec538458a8eb8a6659f86cfbb20f7ba386d555bb4acd9
P10_SUPERSEDED_VAEL_HERO_ADDRESS=0x48C1f60EBf6fE1bE821CE3557818ba24d1589a96
P10_SUPERSEDED_QUEST_MANAGER_ADDRESS=0x488dc9C1F6ed0c1d3456E55200C78FACeE7C903e
P10_SUPERSEDED_QUEST_ASC_ADDRESS=0x6e457d910285b5a927Da42742bb58218c5CD1885
P10_SUPERSEDED_RAID_BOSS_ADDRESS=0x2c01f35B5f3BDD6078af2093AbbB838CfD8C47C7
P10_SUPERSEDED_ARENA_ADDRESS=0xAF6Fe3daC56Fd05dD04a2CdeE97516CD2E90D4DF
P10_SUPERSEDED_LOOT_ADDRESS=0x59a40C93A2819B866Fd1495a9d7ce7D7DAc49601
P10_SUPERSEDED_EQUIPMENT_ADDRESS=0x3924E2AE751d1FE2d84753dC42c3C34708c5Da45
P10_SUPERSEDED_MARKETPLACE_ADDRESS=0x33dba17e54b030B3C9A751332513e9a610e76A46
SUPERSEDED_QUEST_MANAGERS=0x7d8f5f0D5F4523Fb3C8F62a560C00f286CAbed9F,0xE2b5e65F55D90BD096CB93A6aD4BC44048a9c6CA,0x8E42A111295F72c93d3A23181C4C3E13eCbeF220,0x68B609a29cC6B0635d6A3A6A1eDa5a1bBCCEdE24,0x152BcBCE43EC8a3Ef1a96485A28967AbEEe95377,0xD701A48cc22224Ca4679178db7a749dC68725EFD,0x488dc9C1F6ed0c1d3456E55200C78FACeE7C903e
SUPERSEDED_ARENAS=0xe3A14E7D140AA38A7c6Ebe6B7C3639539789f6be,0xA8db5D09d539fDa7Cf29707866a72d4B69Cf813B,0xAF6Fe3daC56Fd05dD04a2CdeE97516CD2E90D4DF,0x72A9a0eB023A4a903bB541202448919F81E61185,0xCC29353505b1a8F88FC313ffb22926925198d59b
SUPERSEDED_RAID_BOSSES=0xE9BB305bCe2466f2Ee2739D499cb18f8721415F6,0x2c01f35B5f3BDD6078af2093AbbB838CfD8C47C7,0x201Fe44a8E26Ce866A5DB807b29b90710b527c41
V10B_VAEL_HERO_ADDRESS=0x74befcC907073f5F0125813FEF3A2A22406d3024
V10B_VAEL_HERO_ADDRESS_TX=0xbaf585631f6561f09208b8ed34dc0784ad856a02284998acfdf7c12113aa117b
V10B_VAEL_HERO_ADDRESS_BLOCK=5465437
V10B_RAID_BOSS_ADDRESS=0xF3492B8491f3f9a3272C03b8779374c9eF3D9A7B
V10B_RAID_BOSS_ADDRESS_TX=0x7fa0fffe28f8b2ee69b8dc9d908578ea5c9ddfc46649989fd877ab0bcdd52192
V10B_RAID_BOSS_ADDRESS_BLOCK=5465438
V10B_ARENA_ADDRESS=0xCC29353505b1a8F88FC313ffb22926925198d59b
V10B_ARENA_ADDRESS_TX=0xf71f4ecd057bfcbd62dbd106d5e3783f034fcb36891d51c493df25098f0dd452
V10B_ARENA_ADDRESS_BLOCK=5465439
V10B_LOOT_ADDRESS=0xFf0271fb151F25cf909d1d8b16017Af54FBb9938
V10B_LOOT_ADDRESS_TX=0x94af1c37fd9b383e76f27d1c34fcb856ec9b7de25e21ec5e1b81359a5487fb6b
V10B_LOOT_ADDRESS_BLOCK=5465440
V10B_EQUIPMENT_ADDRESS=0xa04EDa9C22f10960Df6f470e143f7f6a195Dcba6
V10B_EQUIPMENT_ADDRESS_TX=0xc8c08391fb0b239004d5d73e4e7082861a7d916984524bf7759932f387dab131
V10B_EQUIPMENT_ADDRESS_BLOCK=5465441
V10B_MARKETPLACE_ADDRESS=0x868Bb518122B670Cd02b93dEeDc6B53DcFA36374
V10B_MARKETPLACE_ADDRESS_TX=0x9d5935b310c25fd7fee6085d5c48e60b9a8cd8b72ffac3f880ca89ad23cb45c4
V10B_MARKETPLACE_ADDRESS_BLOCK=5465442
V10B_IMPORT_HERO_1_TX=0xc5670d22029c61ae7fe2f010e4cd8835045c233be04a9e4829e5da127f9195f9
V10B_IMPORT_HERO_2_TX=0xf7724d7164eb37bf528fba55763749f46e62e4782b1b0b529fe3f9d1ee2c70ad
V10B_HERO_CLOSE_IMPORT_TX=0x27db9382b2b35a1ff647717099168f9700bf02ef2778715f8ec67c2172f54ffb
V10B_ITEM_RUSTED_BLADE_TX=0xb72e612d5cc04aa58354046655ec6bed5884c26bf08d85e3ae4978d44aaf560d
V10B_ITEM_PADDED_VEST_TX=0x6aca40a6a7222379395f3901d233fd10037e6b70ee723f5483359b134ae1ed76
V10B_ITEM_IRON_SWORD_TX=0x3f28e6127dd1fe16f826a182a62be2aeebb6fd0676eee406020e113dda6dfd1b
V10B_ITEM_SWIFT_CHARM_TX=0xd9bbbfcec01ddd857bb8bc8d3de14ee179fcfcaa59828c13621db34e6b6aae63
V10B_ITEM_PLATE_HARNESS_TX=0xc535c7892f2fe1d33965ccc388c509aa7e880e67956938d96f1d655b0ff66bf6
V10B_ITEM_SCHOLARS_SCROLL_TX=0x3d9e9a092b4c5a0cd5f209ef6be851a2d3d1591b420da8bc94f700338cc1a3e5
V10B_ITEM_ARCANE_CODEX_TX=0x7f71865c066d8e98aad325fc782dbe100066ec49fb32cea463794a0c8e68d2d7
V10B_ITEM_WARHAMMER_TX=0x7e45f9df600add6595eb6916c8e7189acc42d8f8d952e8d1cb45049629d688ef
V10B_ITEM_GILDED_AEGIS_TX=0x07875b721823d5eb255470b64e0d5ed7da868c6c580838965800c313d9533215
V10B_ITEM_BLESSED_BLADE_TX=0xdd5ac575a5fa3ae76616031e01cecb7b5dd13ce194a496f764f24caffedc13e6
V10B_ITEM_SEERS_CRYSTAL_TX=0x8c40f6c0f1420264f33720a8ff6bf4cc8a038be4701db3d6a7e7d36b1ba8a2cd
V10B_HERO_COMPLETERS_TX=0x0e7837eaa820dbe2f71e80f2ef071aeab965a393a8972d668a8b77d2fc869c94
V10B_RAID_COMPLETERS_TX=0x3e82c8b9243bd43ff245c01ee3c4bf04e07b3efe9a5654605107c2c5827d1e73
V10B_ASC_HOOKS_TX=0xad26c5e497cee6adde345e483c39598cb563e1e5b070715358e16f42b4ff4392
V10B_NATIVE_HOOKS_TX=0x59360a59c34f80401428cbcea0e2fa9553a488e0da844f6d63d62eea6db96626
V10B_BADGE_MINTER_RAID_TX=0x17fc216e0ed58648cedd2f8caa17917f800eb90dc8f417ad62ab22f0857b4718
V10B_BADGE_MINTER_REVOKE_TX=0x7b3c348270a8259a6b44b233594f60aaf5f16e301576c70945d0dd9f3f619efd
V10B_LOOT_ARENA_TX=0x396d17f9b148daf7b2c3b15f5abf48a60940895cff89e20574cb88d47500514e
V10B_ARENA_REWARDS_TX=0xc02e8741f8555e928c507423b2491556a5e26c3afb56188c09366f10e6842bf4
V10B_ARENA_EQUIPMENT_TX=0x5ffad0c5a3464fe6daefba964adc02e0ca9f8b34de72d2b983bc91d09f56a116
V10B_SUPERSEDED_VAEL_HERO_ADDRESS=0x6Da74d3F37973FA99eDF8153D2155a9F70235b77
V10B_SUPERSEDED_RAID_BOSS_ADDRESS=0x201Fe44a8E26Ce866A5DB807b29b90710b527c41
V10B_SUPERSEDED_ARENA_ADDRESS=0x72A9a0eB023A4a903bB541202448919F81E61185
V10B_SUPERSEDED_LOOT_ADDRESS=0x2810313DA39b9b8C33a9bc9d4C3bC65AdD8a9072
V10B_SUPERSEDED_EQUIPMENT_ADDRESS=0xe3F4DD0A6FbB5E8888a32bE57dC03394cC8302C8
V10B_SUPERSEDED_MARKETPLACE_ADDRESS=0x64B80FfE7d54167ACB90D75b73A5459Ea168AbDB
V10C_ARENA_ADDRESS=0xa98672b481c35f76d09612849E75A2c7A1a976d9
V10C_ARENA_ADDRESS_TX=0x93ec01a712baf7f035b008500d1eb2e5d2513e31ff2e7fbf29609b79b88d5757
V10C_ARENA_ADDRESS_BLOCK=5465619
V10C_SUPERSEDED_ARENA_ADDRESS=0xCC29353505b1a8F88FC313ffb22926925198d59b
V13_CAMPAIGN_ESCROW_ADDRESS=0x48f5612Bd48ad29f6Aefd8700EbD3946F0511b28
V13_CAMPAIGN_ESCROW_ADDRESS_TX=0x15cf0195a468b16fb1d78b1194f9bdd458fdf593091ea58140cf6fead0142464
V13_CAMPAIGN_ESCROW_ADDRESS_BLOCK=5478582
V13_CAMPAIGN_PAYOUT_HOOK_ADDRESS=0xeeB8A2EEf0D8b4B28D50ce130E7a70b871F621b1
V13_CAMPAIGN_PAYOUT_HOOK_ADDRESS_TX=0xe6ba49ae956aba6be8ebe04ed8a3dd4cc4965ac80e31375b4b676e4f229516a4
V13_CAMPAIGN_PAYOUT_HOOK_ADDRESS_BLOCK=5478585
V13_ESCROW_TOKEN_TX=0x2423681e40add80c625a21f5e8cb9185e53a307274039ee4bce34ba0005d82fa
V13_HOOK_ESCROW_TX=0x462acb3ff8899a3f36d5a6995a84d7c06e429d9211c8b43df9f17aed3b5c3882
V13_ESCROW_RELEASERS_TX=0x0f77bd63419ad0e10452dddb425a7510a052b7325d8d769e5a7a07175a0e70c2
V13_MIGRATE_07e1398c_AMOUNT=258050000000000000000
V13_MIGRATE_07e1398c_REFUND_TX=0x46053111b922643fc9897c7dbd25de23490e04eddf50d233cbc7d42ef6ba4886
V13_MIGRATE_50c9f717_AMOUNT=716400000000000000000
V13_MIGRATE_50c9f717_REFUND_TX=0x3a070621ab4507117a905956f6c1a17f03aba0e152724069bdba2ef3d2f48b59
V13_MIGRATE_6fa8f505_AMOUNT=327750000000000000000
V13_MIGRATE_6fa8f505_REFUND_TX=0xec6aea2aea84530caf9410205060838d04b4e74ee747b31c245bc3ff01ddaa95
V13_MIGRATE_4a5d2f43_AMOUNT=447000000000000000000
V13_MIGRATE_4a5d2f43_REFUND_TX=0x4726ef7aa171121bddd3ccfa642d3f26ec5b902eac3c81e78c923560cfdc6c57
V13_ASC_ESCROW_TX=0x22ac66e505505041593d4657dce995bf2f929fe844aa38a6289606bdcd68d183
V13_PORTAL_HOOK_TX=0xdc28f357e12fdfaff4e2f7943b7852f79125e7c2630dd0d4b1167193ba204ab5
V13_MIGRATE_07e1398c_APPROVE_TX=0x49bf942997fab95dcc86f04bf826ebfca9dbc488969b7c9821fb0d864afb12f2
V13_MIGRATE_07e1398c_DEPOSIT_TX=0x56391e9d3aa3bd5dae02b51c9dbfb3965c0725c8ecb7fd7d4f4607d09aa75da9
V13_MIGRATE_50c9f717_APPROVE_TX=0x00428a508e744d6aa8d2dcc13bcedff031c5841cccc997712ef102fbac6aca63
V13_MIGRATE_50c9f717_DEPOSIT_TX=0x04a6c1de7d821f8fd7465c27430ab4559471b2bca6e553c1c8e113c690da6b4e
V13_MIGRATE_6fa8f505_APPROVE_TX=0xc0af9300c23d2d5384b487024ee7322df77b084a3b9e3263eb5c2c046afe0768
V13_MIGRATE_6fa8f505_DEPOSIT_TX=0xc0f7a27d2352e0c5b84715eb065149bed397d43be53c5be28b8db2dcb9bf8301
V13_MIGRATE_4a5d2f43_APPROVE_TX=0xf405799b2a72f429b78f65a9c6fe7d9629bde7e2c119de0f5a52153b195af83b
V13_MIGRATE_4a5d2f43_DEPOSIT_TX=0xb7c027329fa4905382ea3154112c2a3196d9652c213222ff9b84b9fa30751359
CAMPAIGN_PAYOUT_HOOK_ADDRESS=0xeeB8A2EEf0D8b4B28D50ce130E7a70b871F621b1
V13_SUPERSEDED_CAMPAIGN_ESCROW_ADDRESS=0xcF675302d19967788009592423E4E66bd69EA32b
SUPERSEDED_CAMPAIGN_ESCROWS=0xcF675302d19967788009592423E4E66bd69EA32b
