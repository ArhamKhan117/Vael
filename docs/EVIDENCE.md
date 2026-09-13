# Evidence

Every feature below is exercised by a transaction that confirmed on a public network.
Creditcoin transactions link to Blockscout and Ethereum Sepolia transactions to Etherscan, so each row can be checked without trusting this document.
Addresses are in [`ADDRESSES.md`](./ADDRESSES.md); the contracts in the current table there are the ones every Creditcoin transaction below went to, except where a row says otherwise.

Read from the chain and the index at Creditcoin block 5479941:

| Measure | Value |
|---|---|
| Quests created | 44, of which 19 completed |
| Proved through Attestcoin | 13 |
| Completed on the native path | 6 |
| Heroes minted | 6 |
| Badges minted | 45 |
| Raid seasons | 3, for 2,900 damage |
| Duels resolved | 22 |
| Loot items | 27, of which 13 listed and 4 sold |
| Campaign pools | 4, holding 1,629.2 VAEL |
| VAEL released | 2,675 |

Screenshots of the production build, at 1280 px and 390 px, are in [`evidence/final/`](./evidence/final/) and linked from the sections they belong to.

## 1. The proof loop

A player acts on Ethereum Sepolia, attestation covers the block seven to nine minutes later, a proof is fetched right before submission, and `QuestASC` verifies it on Creditcoin in the transaction that pays.
The submitter does not matter: what is checked is the proof.

**Four portal check-ins, proved by the worker.**
Each quest was accepted first, which anchored its window at the attested Sepolia frontier (11677320 for quest 1, 11677330 for the rest); every action landed above it.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 1: check-in through `QuestPortal`, sent from the player's own wallet | Sepolia | [`0xe4d6d140…4dc6b9`](https://sepolia.etherscan.io/tx/0xe4d6d1402159d75790308000e0d2b9f0d2031f3e74bd4b5df92d2ec4584dc6b9) | 11677363 | 35,411 |
| Quest 2: check-in through `QuestPortal`, sent from the player's own wallet | Sepolia | [`0x984ef058…bb8825`](https://sepolia.etherscan.io/tx/0x984ef058c4e294601ac324e4cff65a082bd5f67e16ffed217324bd5c6abb8825) | 11677367 | 35,411 |
| Quest 3: check-in through `QuestPortal`, sent from the player's own wallet | Sepolia | [`0xd959cbab…e8e801`](https://sepolia.etherscan.io/tx/0xd959cbabbc1bb5a5ffc225936212d3510ed5ad6c5e0f02b0b6b94c3d42e8e801) | 11677370 | 35,411 |
| Quest 4: check-in through `QuestPortal`, sent from the player's own wallet | Sepolia | [`0xde38b307…b628f1`](https://sepolia.etherscan.io/tx/0xde38b30770532ee364b40bc5ea2a4d079405e1fd1e4dfb0f8f6e96787cb628f1) | 11677373 | 35,411 |
| Quest 1: proof verified, 120 VAEL released, badge minted, hero credited | Creditcoin | [`0x42e9d9b6…ac27b9`](https://creditcoin-testnet.blockscout.com/tx/0x42e9d9b6e27ef1802a12af9e3531ad3307b675a258c59b4328f4bbdc59ac27b9) | 5465537 | 1,030,246 |
| Quest 2: proof verified, 120 VAEL released, badge minted, hero credited | Creditcoin | [`0xb92614a7…c44e67`](https://creditcoin-testnet.blockscout.com/tx/0xb92614a76abb5613d1ff75a23b264940d6b7e480ff5753d0bf47e81e03c44e67) | 5465538 | 1,028,454 |
| Quest 3: proof verified, 120 VAEL released, badge minted, hero credited | Creditcoin | [`0x19abbdc2…6ff27f`](https://creditcoin-testnet.blockscout.com/tx/0x19abbdc2c8e6fd98e037f266dae5b3438ecfc2b112e46f83ff873eac716ff27f) | 5465544 | 1,027,110 |
| Quest 4: proof verified, 120 VAEL released, badge minted, hero credited | Creditcoin | [`0x812ebea2…747d4d`](https://creditcoin-testnet.blockscout.com/tx/0x812ebea2c84a81e1126a07227a842b2979a307e30b478626ecc4ce7c55747d4d) | 5465545 | 1,030,246 |

**The other action types, each proved the same way.**

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 15: 100 LINK supplied to Aave v3 | Sepolia | [`0xc6eb39c8…fd0dab`](https://sepolia.etherscan.io/tx/0xc6eb39c809d7099b1a7595bc4d5d736a863e27172eeeba7dd3746a8889fd0dab) | 11678160 | 206,164 |
| Quest 15: Aave supply proved | Creditcoin | [`0x0c645ce1…b3b410`](https://creditcoin-testnet.blockscout.com/tx/0x0c645ce1e75c5a4d05001fd8670b54818f74cf518bd56a836ab80011e0b3b410) | 5466194 | 1,091,692 |
| Quest 23: ERC-20 transfer | Sepolia | [`0x264585fe…14d4fe`](https://sepolia.etherscan.io/tx/0x264585fee962417d3bf8c95744b87f4d8e4580bcce695e8c7cbe2ebd3814d4fe) | 11679355 | - |
| Quest 23: transfer proved | Creditcoin | [`0x3f20c18b…3acad1`](https://creditcoin-testnet.blockscout.com/tx/0x3f20c18b99fb32a7696b812f0aaf1fe48f85767205f706ae5d366135e73acad1) | 5467184 | 1,029,224 |
| Quest 25: Uniswap v3 swap | Sepolia | [`0x8efe4529…d17590`](https://sepolia.etherscan.io/tx/0x8efe45291c1b79ab8bc95083551f6fce0f93f4c3b33db5d9a2af2009e7d17590) | 11679358 | - |
| Quest 25: swap proved, the swap's own ERC-20 `Transfer` logs declined beside its `Swap` | Creditcoin | [`0x5578518a…11d042`](https://creditcoin-testnet.blockscout.com/tx/0x5578518a1e66718344c6665e810e7de05017dc2d44dfa6f9d7b65818b111d042) | 5467185 | 1,089,172 |
| Quest 22: portal check-in | Sepolia | [`0xfce25c17…aee051`](https://sepolia.etherscan.io/tx/0xfce25c176e9d266b6e16da9de3cef4cbeb9a59105fc4354dc24a0615d2aee051) | 11679194 | - |
| Quest 22: check-in proved | Creditcoin | [`0xb6354756…e15cb5`](https://creditcoin-testnet.blockscout.com/tx/0xb6354756de4b847e1a4af069c1cc1a7360c8230d9a9e52a78da432fb70e15cb5) | 5467012 | 1,027,558 |

**The worker, unattended, on the deployment as published.**
Quest 44 was created and accepted, the check-in was sent, and nothing told the worker about it: it named the quest from the portal event, waited out attestation, and submitted.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 44: portal check-in | Sepolia | [`0xe04146fb…473b7e`](https://sepolia.etherscan.io/tx/0xe04146fb07be741f049927dcbea43873ff14a54d3dec82f66d9accfe2e473b7e) | 11694871 | - |
| Quest 44: proof built and submitted by the worker after a nine-minute attestation wait | Creditcoin | [`0x8b9afeec…ba88d7`](https://creditcoin-testnet.blockscout.com/tx/0x8b9afeec52066df2a1cac074e120d155a0d0606fe457205e942980da57ba88d7) | 5479937 | 1,025,864 |

```
[08:55:15] [worker] detected 0xe04146fb…473b7e for quest 44 (named by the portal event)
[08:55:17] [worker] waiting: frontier 11694840, need above 11694871
[09:04:09] [worker] proving 0xe04146fb…473b7e
[09:05:02] [worker] verified 0xe04146fb…473b7e in 0x8b9afeec…ba88d7
```

Screenshots: [quest board](./evidence/final/quests-1280.webp) ([phone](./evidence/final/quests-390.webp)), [a quest](./evidence/final/quest-detail-1280.webp) ([phone](./evidence/final/quest-detail-390.webp)), [the board with a wallet connected](./evidence/final/quests-connected-1280.webp) ([phone](./evidence/final/quests-connected-390.webp)).

## 2. Batch submission

One Uniswap swap and one ERC-20 transfer, performed four Sepolia blocks apart, submitted in a single `submitBatch`.
The batch carried two continuity proofs, ten roots for the first member and six for the second, because one continuity proof proves exactly one source height.
The two members also came from different proof sources, one built from the raw block and one from the Proof Builder API, and both verified through the same precompile.

This run was made against the previous deployment of `QuestASC`; the contract code that verified it is the same, and the superseded address is in `ADDRESSES.md`.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| ERC-20 transfer | Sepolia | [`0x13751dbf…95a5aa`](https://sepolia.etherscan.io/tx/0x13751dbf6774b0440464876c5972c3628a55dddb9c82a8b56ff9a2c04295a5aa) | 11675331 | - |
| Uniswap v3 swap | Sepolia | [`0x33ff996f…6a5d4d`](https://sepolia.etherscan.io/tx/0x33ff996f282662b63476a8a41013c69c9dcb4e09fee0a2ecb8660b92cc6a5d4d) | 11675335 | - |
| Both proved in one transaction, two quests completed, two logs handled | Creditcoin | [`0xb4dc2664…58fa0a`](https://creditcoin-testnet.blockscout.com/tx/0xb4dc2664afe75739ddbd20c8cbe6bdce2ef1fec4989cf576bee562144358fa0a) | - | 1,194,636 |

## 3. The native path

`NativePortal` performs the Creditcoin action with the player's own tokens and records the completion in the same transaction.
No proof, no wait, and nothing that takes anybody's word for it: if the router returned less than the rule demands, nothing would have completed.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 5: PLAYER3 wrapped 2 CTC into WCTC and completed the quest in the same transaction | Creditcoin | [`0x9773c5e2…99a451`](https://creditcoin-testnet.blockscout.com/tx/0x9773c5e289a4663c16e96bf4e28c7d560d92ff626685a3d1a83fcc72aa99a451) | 5465551 | 918,988 |
| Quest 6: PLAYER3 swapped 1 WCTC for USD1 on PenguinSwap and completed the quest in the same transaction | Creditcoin | [`0x1b656345…697a94`](https://creditcoin-testnet.blockscout.com/tx/0x1b656345a90bb9f4f2801d5cfd683637dbcb476e2f7d1f45ea3a678417697a94) | 5465555 | 1,467,088 |
| Quest 24: the owner wallet wrapped 1 CTC, one transaction | Creditcoin | [`0x9caf3db6…942058`](https://creditcoin-testnet.blockscout.com/tx/0x9caf3db6ba98cc8297559094f6686c899e641f6120065f6c597dc836e1942058) | 5466976 | 918,988 |
| Quest 29: the owner wallet swapped on PenguinSwap, one transaction | Creditcoin | [`0x09c99573…0e9237`](https://creditcoin-testnet.blockscout.com/tx/0x09c99573802c159e582c54d1866c91986d197d5c2433bcfe3d0caffb720e9237) | 5466979 | 1,377,460 |

## 4. Partner campaigns and payouts

A partner funds a pool before its quests exist, and a completion releases the reward from that pool in the transaction that proves it.
Each campaign carries a document and a picture pinned to IPFS.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| "Swap week" pool funded with 600 VAEL | Creditcoin | [`0x0e95f72f…995232`](https://creditcoin-testnet.blockscout.com/tx/0x0e95f72fe0979de204f98d8fbdcb0efd3a0eac254fa16beefd1cf214db995232) | 5465657 | 114,072 |
| Quest 7 created in the pool, assigned to PLAYER3 | Creditcoin | [`0xda3e43be…9a2732`](https://creditcoin-testnet.blockscout.com/tx/0xda3e43be6bf0bdc829310aead492b7f8e0c320a0ad60520eab4857e8b59a2732) | 5465658 | 489,108 |
| "First steps" pool funded with 450 VAEL | Creditcoin | [`0xd4083ab0…9bb440`](https://creditcoin-testnet.blockscout.com/tx/0xd4083ab0cf3f3074cc48d327e2d1a7ac34ce5844f51465a72f2b3aba9e9bb440) | 5465661 | 114,072 |
| "PenguinSwap on Creditcoin" pool funded with 360 VAEL | Creditcoin | [`0x72d25a32…8559c0`](https://creditcoin-testnet.blockscout.com/tx/0x72d25a32b6a14e8ebae145949ed5b56fbb139e867df410ff2eb494ada38559c0) | 5466814 | 114,072 |
| "Creditcoin check-in" pool funded with 390 VAEL | Creditcoin | [`0x7e2d6630…e1225f`](https://creditcoin-testnet.blockscout.com/tx/0x7e2d6630a9c22ee1ef23b64ec05ddc896a35c7bb8f45c02f4da73bb6cee1225f) | 5466818 | 114,072 |
| Quest 7: PLAYER3's Uniswap swap | Sepolia | [`0x4eb29fda…0a7d01`](https://sepolia.etherscan.io/tx/0x4eb29fdadbbff754c4d38f69b8c6a0e22c67fe3cb35e279742b0b6be180a7d01) | 11678105 | 129,858 |
| Quest 7 proved; the pool paid 150 VAEL in the same transaction (597.0 to 447.0 VAEL) | Creditcoin | [`0x444009d1…53e264`](https://creditcoin-testnet.blockscout.com/tx/0x444009d114f73a18e85e772d5b17a7356a3658acce27fd8ff1e1f3ab1553e264) | 5466149 | 1,097,306 |
| Quest 10: PLAYER3's portal check-in | Sepolia | [`0xaef246fa…682849`](https://sepolia.etherscan.io/tx/0xaef246fa8d93cd931568137771beb1ac096f8980c05c9b7adb389866ec682849) | 11678106 | 35,411 |
| Quest 10 proved; the pool paid 120 VAEL (447.75 to 327.75 VAEL) | Creditcoin | [`0xa744f23a…72f4c4`](https://creditcoin-testnet.blockscout.com/tx/0xa744f23a0a427d59638083df5332122bbfaa7482e2283c3b7524a9caba72f4c4) | 5466058 | 1,037,484 |
| Quest 19: PLAYER3's portal check-in | Sepolia | [`0xf2fbd0b7…58f8b3`](https://sepolia.etherscan.io/tx/0xf2fbd0b7296dcb062212c4f829055072da15c631e9b5d97c1262881cf858f8b3) | 11678969 | 35,411 |
| Quest 19 proved; the pool paid 130 VAEL (388.05 to 258.05 VAEL) | Creditcoin | [`0x1966cb47…d70023`](https://creditcoin-testnet.blockscout.com/tx/0x1966cb470539617bde2e3756aeffa9d01ebdbeaf5b8fe11c985aff8e9bd70023) | 5466860 | 1,035,244 |

**A native campaign quest, paid by the escrow's releaser set.**
`CampaignEscrow` trusts a set of releasers: `QuestASC` for proved quests and `CampaignPayoutHook`, on `NativePortal`'s hook list, for native ones.
Quest 43 completed on the native path and the pool paid it in the same receipt.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 43 created in the "PenguinSwap on Creditcoin" pool | Creditcoin | [`0xa2d4ff5d…e89049`](https://creditcoin-testnet.blockscout.com/tx/0xa2d4ff5d27235c98729c65cee0d860dc3da34bba6ad438dd78fd7e8f12e89049) | 5478636 | 459,985 |
| Quest 43: swap performed by `NativePortal`, 120 VAEL released by the escrow through `CampaignPayoutHook`, same transaction | Creditcoin | [`0x35011dab…c2b55d`](https://creditcoin-testnet.blockscout.com/tx/0x35011dab05f860f9e9f57986b1585fc796047c490ab9ce9cf55ce950d3c2b55d) | 5478639 | 1,534,330 |

Two earlier native campaign completions, quests 16 and 29, ran against the escrow before it had a releaser set.
Each completed, minted its badge, and credited its hero, and released nothing, because the escrow of the time trusted `QuestASC` alone.
They stay unpaid: a release happens only inside a completion, both completions are recorded, and paying them by hand would take the privileged path the escrow refuses to have.
The escrow migration that followed, pool by pool, is recorded in `ADDRESSES.md`.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 16: PLAYER3's PenguinSwap swap completed; the pool released nothing (716.4 to 716.4 VAEL) | Creditcoin | [`0x28d04b80…d4bbca`](https://creditcoin-testnet.blockscout.com/tx/0x28d04b8029468eca58184da157329ef339f52adbff9a741ed3706a9109d4bbca) | 5466828 | 1,377,460 |

Screenshots: [campaigns](./evidence/final/campaigns-1280.webp) ([phone](./evidence/final/campaigns-390.webp)), [a campaign](./evidence/final/campaign-detail-1280.webp) ([phone](./evidence/final/campaign-detail-390.webp)), [the Studio](./evidence/final/studio-1280.webp) ([phone](./evidence/final/studio-390.webp)), [the partner Studio](./evidence/final/studio-partner-1280.webp) ([phone](./evidence/final/studio-partner-390.webp)).

## 5. Heroes

One hero per wallet, minted by the wallet itself; nothing here can be granted by an owner.
XP, level, and streak move only inside the completion transactions above, through the `VaelHero` hook.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| PLAYER3 minted hero 3 | Creditcoin | [`0xfbcdf58c…c17d81`](https://creditcoin-testnet.blockscout.com/tx/0xfbcdf58cebf494f0f3beaafdf3ad4b9a5128cd75a267975d882c4b3c6ac17d81) | 5465491 | 157,668 |
| PLAYER4 minted hero 4 | Creditcoin | [`0xef6b7489…d01565`](https://creditcoin-testnet.blockscout.com/tx/0xef6b74892b25c53bf84dc106692391833343edc2b994251b5f015ce6e6d01565) | 5465492 | 157,668 |
| PLAYER5 minted hero 5 | Creditcoin | [`0x61c21a31…c35005`](https://creditcoin-testnet.blockscout.com/tx/0x61c21a3110c217138ddb75252eb57114ff473930af9f6592078f4bb000c35005) | 5465493 | 157,668 |
| PLAYER6 minted hero 6 | Creditcoin | [`0xd0f73ac0…0e605f`](https://creditcoin-testnet.blockscout.com/tx/0xd0f73ac07cc81f779a9e5cb416c0f635e59a43d0c7569b6895936f88050e605f) | 5465494 | 157,668 |
| The owner equipped a Warhammer on hero 1, +10 STR | Creditcoin | [`0x21736946…ee7f8e`](https://creditcoin-testnet.blockscout.com/tx/0x21736946ffecc521a6dbb63b4843d9f16ebba1c36582208d0f01ec357bee7f8e) | 5467253 | 361,494 |

Screenshots: [hero sheet](./evidence/final/hero-connected-1280.webp) ([phone](./evidence/final/hero-connected-390.webp)), [profile](./evidence/final/profile-connected-1280.webp) ([phone](./evidence/final/profile-connected-390.webp)).

## 6. Raids

Each season's loot pool is deposited before the season opens.
Damage lands inside completion transactions through the `RaidBoss` hook; a season is defeated when its hit points reach zero, and every contributor claims one item, its rarity set by their share.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Season 1 started, 500 HP, 2,000 VAEL pool | Creditcoin | [`0xa938249b…f492db`](https://creditcoin-testnet.blockscout.com/tx/0xa938249ba39c09971e269312f268ed3f640633f9137527ef9bcd449567f492db) | 5465496 | 169,764 |
| Season 2 started, 1,200 HP, 2,000 VAEL pool | Creditcoin | [`0xab1c1737…38ae4a`](https://creditcoin-testnet.blockscout.com/tx/0xab1c1737f34f8bbcecd34b0f2d361ca4f69e902d473f36127c955b1a8938ae4a) | 5466012 | 159,880 |
| Season 3 started, 1,200 HP, 2,000 VAEL pool | Creditcoin | [`0x6e25beab…aad7af`](https://creditcoin-testnet.blockscout.com/tx/0x6e25beaba690a5d37559055ceeaa4b636aa68f139475bddfe1a93f0fd1aad7af) | 5466974 | 159,880 |
| PLAYER3 claimed their share of season 1, 170 damage | Creditcoin | [`0x0ef4883d…22f5e9`](https://creditcoin-testnet.blockscout.com/tx/0x0ef4883dc307083a1b3ead8c897ccce1bdf4af72b5f6faf99626832d4a22f5e9) | 5465583 | 277,158 |
| PLAYER3 claimed a rarity-3 item from season 1 | Creditcoin | [`0xd7a380d1…c61efc`](https://creditcoin-testnet.blockscout.com/tx/0xd7a380d10f8c1348032524fa7ad30e3e61e7fb795a81bf54ab73f172e4c61efc) | 5465584 | 253,680 |
| PLAYER4 claimed their share of season 1, 110 damage | Creditcoin | [`0x87dda9ab…7818a5`](https://creditcoin-testnet.blockscout.com/tx/0x87dda9ab8b0096bc11e63c34121100704bc99e1ab1c382cff6fefd3fcf7818a5) | 5465585 | 277,158 |
| PLAYER4 claimed a rarity-2 item from season 1 | Creditcoin | [`0x716d6bea…c8ba4c`](https://creditcoin-testnet.blockscout.com/tx/0x716d6bea4445eed4cd498c9a46048258f57260c7b590aa80e6f3e5dae8c8ba4c) | 5465586 | 253,680 |
| The owner claimed their share of season 3, 780 damage | Creditcoin | [`0xef9662b8…3224fd`](https://creditcoin-testnet.blockscout.com/tx/0xef9662b8756a19f2d2dad14789f541cb42c9d0d48a6a095315e7a54b933224fd) | 5467213 | 277,158 |
| The owner claimed a rarity-4 item from season 3 | Creditcoin | [`0x83c882d4…294e70`](https://creditcoin-testnet.blockscout.com/tx/0x83c882d46b8a9b1759cdb56aa114a36319a93778680c614dd6742f628c294e70) | 5467214 | 253,680 |

Screenshot: [raid](./evidence/final/raid-1280.webp) ([phone](./evidence/final/raid-390.webp)).

## 7. Arena

A challenge commits its seed block at acceptance, two blocks ahead, and resolves from that block's hash inside a bounded window, so neither side can wait for a block they like.
A duel nobody resolves is voided after its window: both stakes return and nothing burns.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Duel 2: PLAYER3 challenged PLAYER4 for 10 VAEL, resolved | Creditcoin | [`0x9b8f0fb8…51de97`](https://creditcoin-testnet.blockscout.com/tx/0x9b8f0fb89acdea3391bdd3b7c4d53da9166a17b686d2ace9b41b496bfb51de97) | 5465641 | 583,492 |
| Duel 3: PLAYER5 challenged PLAYER6 for 10 VAEL, resolved | Creditcoin | [`0xf2dd7e9a…aea6e2`](https://creditcoin-testnet.blockscout.com/tx/0xf2dd7e9abff8a74c55c4536a6373134b4d420e1d915913539c344f0037aea6e2) | 5465647 | 583,492 |
| Duel 4: PLAYER4 challenged PLAYER5 for 10 VAEL, resolved | Creditcoin | [`0x79cfe42f…69e24a`](https://creditcoin-testnet.blockscout.com/tx/0x79cfe42f47c692b7d9e53e71f7b4466c0a9122ae80078ee734fe3b799369e24a) | 5465653 | 583,492 |
| Duel 5: the owner challenged PLAYER3 for 5 VAEL, won, and took the drop | Creditcoin | [`0x5fe39c5a…5322b3`](https://creditcoin-testnet.blockscout.com/tx/0x5fe39c5a421546dbeaf383182a1534552f1fe56849d4642c9271e9a91d5322b3) | 5467064 | 583,492 |
| Duel 22: PLAYER4 challenged PLAYER6 for 5 VAEL, won, and took the drop | Creditcoin | [`0x5ff5507d…a093c5`](https://creditcoin-testnet.blockscout.com/tx/0x5ff5507d828718d5c524038195ba12f3123c684b1d300a49aa9d3c40cfa093c5) | 5467212 | 583,492 |
| Duel 1: PLAYER6 challenged PLAYER5 for 5 VAEL, then nobody resolved it | Creditcoin | [`0x084c722b…718350`](https://creditcoin-testnet.blockscout.com/tx/0x084c722b6ddbaf96c6b2644f4b10382e429d87b9e273531cff9972268c718350) | 5465633 | 348,040 |
| Duel 1 voided after its 250-block window; both stakes returned | Creditcoin | [`0x8045f838…95f780`](https://creditcoin-testnet.blockscout.com/tx/0x8045f8383443602ccc1257d5213ed5bd4d5231c0d4f950c4b95e6f333a95f780) | 5465973 | 203,266 |

Screenshot: [arena](./evidence/final/arena-1280.webp) ([phone](./evidence/final/arena-390.webp)).

## 8. Market

An item is escrowed the moment it is listed; a sale pays the seller in VAEL with 2% to the treasury.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| PLAYER3 listed loot item 8 for 25 VAEL, listing 1 | Creditcoin | [`0x9b9ca959…3ea72a`](https://creditcoin-testnet.blockscout.com/tx/0x9b9ca9594bdec3d747910f8b2fe048250cec0558c3f43fdd95ec3fc7273ea72a) | 5465592 | 227,472 |
| PLAYER4 listed loot item 5 for 25 VAEL, listing 2 | Creditcoin | [`0xfb4182a7…40a6f3`](https://creditcoin-testnet.blockscout.com/tx/0xfb4182a7019051f914b0aedb89470f359b540ccaf7bc4051b3366fc45140a6f3) | 5465594 | 227,472 |
| The owner listed a Seer's Crystal for 260 VAEL, listing 9 | Creditcoin | [`0x4a4ff5d5…33d930`](https://creditcoin-testnet.blockscout.com/tx/0x4a4ff5d58790b723ac59f6c596939eb58817996d5b97a6554af3650e9733d930) | 5467232 | 227,472 |
| The owner bought listing 1 for 25 VAEL | Creditcoin | [`0x2277dae1…128d6f`](https://creditcoin-testnet.blockscout.com/tx/0x2277dae1d61e7975c619d398b90669624cd6a8d4f0f46e4d1026272194128d6f) | 5467245 | 286,062 |
| The owner bought listing 2 for 25 VAEL | Creditcoin | [`0xea099de2…5ee3f5`](https://creditcoin-testnet.blockscout.com/tx/0xea099de2cbbae6e27c3f9f7a56cc6d4885fc37950394cd0479a831f7cd5ee3f5) | 5467246 | 286,062 |
| PLAYER3 bought listing 3 for 18 VAEL | Creditcoin | [`0xec70b77e…a1ab92`](https://creditcoin-testnet.blockscout.com/tx/0xec70b77e23971bbceb8e051b4c4b19a3221a7c452c188ffbd477371399a1ab92) | 5467248 | 286,062 |
| PLAYER3 bought listing 4 for 18 VAEL | Creditcoin | [`0xee75db1d…80eb39`](https://creditcoin-testnet.blockscout.com/tx/0xee75db1de105afb907c85800b0163e983bb23b441e32a1e0bf47d9011180eb39) | 5467249 | 286,062 |

Screenshots: [market](./evidence/final/market-1280.webp) ([phone](./evidence/final/market-390.webp)), [leaderboard](./evidence/final/leaderboard-1280.webp) ([phone](./evidence/final/leaderboard-390.webp)).

## 9. AI quests

The generator reads a player's verified-action index, never a wallet feed, chooses an action type from it, and the server picks the emitter from the allowlist `QuestASC` already enforces.
The quest is created by the registered ERC-8004 agent and completed exactly like any other.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 13 generated for PLAYER3 from their proved history, a Uniswap swap | Creditcoin | [`0x77d3539c…4c3181`](https://creditcoin-testnet.blockscout.com/tx/0x77d3539c6422f7ea69fed218c5c960ca9da9b3d8ecd09ecbd1b45ab4ad4c3181) | 5465665 | 557,158 |
| Quest 14 generated for PLAYER4 from their proved history, a Uniswap swap | Creditcoin | [`0x47aed75a…c8ccfe`](https://creditcoin-testnet.blockscout.com/tx/0x47aed75a37c12cf450ea9e89959a1e907367f5d5845b47ea212f735397c8ccfe) | 5465666 | 557,158 |
| Quest 13: PLAYER3's swap | Sepolia | [`0x2a612a77…d56577`](https://sepolia.etherscan.io/tx/0x2a612a77fc0ec3e9440a98e88bc6509d3e67cce21c888b8ca74e294889d56577) | 11679197 | - |
| Quest 13 proved, 20 VAEL released | Creditcoin | [`0xe50655e8…86bedb`](https://creditcoin-testnet.blockscout.com/tx/0xe50655e8b30cbadfeccf998af0e3b796679c58e621d92b0f122f0fe3d086bedb) | 5467053 | 1,088,724 |

## 10. Self-claim from the browser

The proof worker was stopped before the accept and started again after the claim, so the only thing that completed this quest was the player's own wallet.
The browser asked the Proof Builder too early, was told the block was not yet attested, said so on screen, and claimed once it was.

This run was made against the previous deployment; the self-claim code path in the web app is unchanged and the superseded addresses are in `ADDRESSES.md`.

| What | Chain | Transaction | Block | Gas |
|---|---|---|---|---|
| Quest 11 accepted from the browser | Creditcoin | [`0xbcee137c…53600f`](https://creditcoin-testnet.blockscout.com/tx/0xbcee137cc00e0e57fa337e49252bca25399b40b3f774e6ff929996311e53600f) | - | - |
| Portal check-in, 0.001 ETH | Sepolia | [`0xd49c904c…f8cd2b`](https://sepolia.etherscan.io/tx/0xd49c904cb252ebc0d8aeda1a4cb26cd47db5e16249af07bf91a1d3b5c4f8cd2b) | 11675552 | - |
| Proof fetched in the browser and submitted from the player's wallet; 75 VAEL paid | Creditcoin | [`0x1dab0174…913912`](https://creditcoin-testnet.blockscout.com/tx/0x1dab017412f69afaa9e506b91507dd2828068e9b05dd3b0e994f502e96913912) | - | - |

## 11. No key can pay a player, reproduced

Every privileged path that could pay a player without a proof reverts with a named error.
Reproduce with `cast call` against the current addresses; the outputs are in the README.

| Call | Revert |
|---|---|
| `QuestManager.recordCompletion` from any key | `QuestManager__WrongCompleter` |
| `VaelHero.onQuestCompleted` from any key | `VaelHero__OnlyQuestASC` |
| `RewardVault.releaseReward` from any key | `RewardVault__OnlyQuestManager` |
| `CampaignEscrow.releaseReward` from any key | `ReleaserSet__NotAReleaser` |

Screenshots: [landing](./evidence/final/landing-1280.webp) ([phone](./evidence/final/landing-390.webp)), [academy](./evidence/final/academy-1280.webp) ([phone](./evidence/final/academy-390.webp)).
