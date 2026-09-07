# Vael

**A quest game where no key can hand out a reward.**

Arham Khan.
BUIDL CTC 2026 Fall, Gaming track.
Creditcoin testnet 102031, Ethereum Sepolia 11155111.

---

## 1. The problem is the key, not the indexer

Every quest platform in DeFi works the same way underneath.
A backend watches a chain, decides that a wallet did the thing, and calls a contract to pay out.
The contract trusts that backend, because it has no way to check for itself what happened on another chain.

The indexer is not the weak point.
Indexers can be open source, redundant, and reproducible.
The weak point is the key at the end of it: a single address that the reward contract obeys.

Whoever holds that key can pay a reward for an action that never happened.
Not through a bug, but through the intended interface.
Everything else about the platform, the audits, the multisig, the dashboard showing verified transactions, sits on top of one address that can simply say a thing is true.

That is the property Vael removes.

## 2. The claim

**No key held by Vael, or by anyone else, can complete a quest.**

A quest completes when a contract on Creditcoin has verified a cryptographic proof of the player's transaction, or has performed the action itself in the same transaction that records it.
There is no third path, and there is no address that can stand in for either.

The claim is meant to be checkable rather than believed.
Section 8 is how to check it, in commands that send nothing and need no key.

## 3. How a cross-chain quest completes

A player does something real on Ethereum Sepolia: a Uniswap v3 swap, an Aave v3 supply or borrow, an ERC-20 transfer, or a check-in through Vael's own portal contract.
That transaction is ordinary.
Vael is not in it.

The Attestcoin Protocol then makes that transaction provable on Creditcoin.
Creditcoin's validators attest to Ethereum block headers, and the Block Prover precompile at `0x…0FD2` will verify, on chain, that a given transaction and its receipt belong to an attested block.
Two things are needed: a Merkle proof placing the transaction in its block's transaction trie, and a continuity proof linking that block to a header the attestors have covered.

`QuestASC` submits both to the precompile and then does the part the precompile does not do.
It decodes the receipt, and for each log it checks:

- the receipt status is success, so a reverted transaction proves nothing;
- the emitting contract is on an allowlist, so an event with the right shape from a contract anyone can deploy is refused;
- the player is the address in the indexed log topic, never the transaction's `from` field, so a relayed or sponsored transaction cannot be claimed by the relayer;
- the amount meets the quest's minimum, in the token the rule names;
- the source block is inside the window the quest was accepted against, so a transaction from before the player accepted cannot be reused.

Only then does it call `QuestManager.recordCompletion`, which is the single function that marks a quest done, and which accepts no other caller.

Each proved log burns a replay key of `keccak(chainKey, blockHeight, txIndex, logOrdinal)`.
The key is scoped to the log rather than to the transaction, so one transaction that satisfies several quests is several completions and no completion can be replayed.

## 4. How a native quest completes, and why it is not a shortcut

Some actions happen on Creditcoin itself: a swap on PenguinSwap, or wrapping CTC into WCTC.
These carry no Attestcoin proof, and it would be dishonest to pretend otherwise.

The reason is that there is nothing to prove.
Attestcoin exists to close the gap between a chain and a chain it cannot see.
A Creditcoin transaction is in a block Creditcoin produced; asking the Block Prover to attest to it would be asking Creditcoin to prove itself to itself, and waiting minutes for coverage of a block it already has.

What replaces the proof is that nobody makes a claim at all.
`NativePortal` does not observe an action and report it.
It **performs** the action, inside the transaction that completes the quest, out of the player's own balance:

```
player -> NativePortal.swapViaPenguinSwap(questId, tokenIn, tokenOut, fee, amountIn, minOut)
            safeTransferFrom(msg.sender, ...)             the player's tokens, or it reverts
            ISwapRouter.exactInputSingle(recipient: msg.sender)
            QuestManager.recordCompletion(...)            same transaction, or none of it happened
```

There is no window between the action and the completion in which a claim could be made, correctly or otherwise.
If the swap reverts, the completion reverts.
If the caller is not the assigned participant, or has not accepted the quest, or sends less than the minimum, it reverts before a token moves.

The two paths cannot be confused for one another, and this is enforced rather than agreed:

| | Proof path | Native path |
|---|---|---|
| Completing contract | `QuestASC` | `NativePortal` |
| Action types | Portal, Uniswap swap, ERC-20 transfer, Aave supply, Aave borrow | PenguinSwap swap, wrap CTC |
| Event | `QuestProofApplied` | `NativeActionApplied` |
| Source chain in the hook call | 1 or 3 | 0 |

`QuestManager.createQuest` files a quest to one side at creation, by its action type, permanently.
`recordCompletion` dispatches on that same flag and reverts with `QuestManager__WrongCompleter` if the wrong contract calls.
So `NativePortal` cannot complete an Ethereum quest and `QuestASC` cannot complete a PenguinSwap one.

The event names differ deliberately.
An indexer that treated `NativeActionApplied` as a proof would be reporting something false, and giving both events the same name would have made that easy to do by accident.

## 5. What is actually locked

A claim about trust is only as good as the smallest privilege that could break it.
These are the gates, all of them on chain and all of them assertable without a key:

| Gate | What it protects |
|---|---|
| `QuestManager.recordCompletion` | Accepts only the completer the quest's action type names. Two one-shot bindings, neither replaceable |
| `RewardVault.onlyQuestManager` | VAEL leaves the vault only for a quest QuestManager has already marked complete |
| `CampaignEscrow.rewardReleaser` | A partner's pool pays out only through `QuestASC`, and refunds only through it |
| `BadgeNFT.onlyMinter` | Badges are minted by QuestManager and RaidBoss and by nobody else. The deployer's minting privilege is revoked and asserted revoked |
| `VaelHero.completers` / `RaidBoss.completers` | Hero XP and raid damage arrive only as hooks from a completion path |
| `VaelHero.closeImport()` | Irreversible. After a migration the owner can no longer write hero state |

The completer set is the one thing here that can change, and it is the interesting case.

An earlier design made it a one-shot binding, which is maximally trust-minimised and also means that adding a second completion path costs nine redeployments, because four modules hold each other immutably.
That is not a safety property; it is a reason not to improve the system.

It is now a two-step change with a 24-hour delay: `proposeCompleter`, a wait, then `acceptCompleter`.
This is still trust-minimised, for three reasons.
The proposal is public for a day before it can take effect, so a redirection is visible rather than instantaneous.
A completer can write hero XP and raid damage and nothing else, because VAEL, badges and quest status sit behind gates a completer does not hold.
And the owner could always have deployed a fresh set of modules and pointed the front end at them; the delay makes the honest change cheap without making the dishonest one cheaper.

## 6. The game, and why it is built this way round

Vael is a game because a proof is a boring thing to look at and a hero is not.
The design rule is that the game never decides anything:

- **Hero.** One soul-bound ERC-721 per wallet. XP arrives only as a hook from a completion, scaled by how far the action exceeded the quest's minimum, with a streak multiplier for consecutive days. Stats grow with level.
- **Raid.** A season boss with real HP. Every point of damage is a completed quest, so the boss falls only because a lot of real DeFi happened. The loot pool is split by damage contributed.
- **Arena.** Duels for VAEL stakes, fought with stats that were earned through completions. The outcome seed is `blockhash` of a block committed at acceptance and not yet mined, so neither player can see it when they commit, and a duel left unresolved past its window can be voided with both stakes returned and nothing burned.
- **Loot and Equipment.** ERC-1155 items from raid claims and arena rewards, escrowed while equipped, tradable for VAEL at a fixed price with 2% to the treasury.
- **Academy.** Four modules that teach what a swap, a supply, and a proof actually do, each ending in a real quest. Passing a quiz mints nothing; the badge comes from the quest.

Phaser renders and replays. It never computes an outcome. Every number it draws was read from Creditcoin.

## 7. Campaigns, and what a partner is buying

A partner funds a `CampaignEscrow` pool and publishes quests against it.
The pool pays out only when `QuestASC` has verified a proof, and the release happens in the same transaction as the proof, in the same receipt.

The thing a partner is buying is not impressions.
It is a guarantee that every unit that leaves the pool corresponds to a transaction that a contract checked, on chain, against a rule the partner set: this protocol, this token, this minimum, this window.
Unspent budget comes back through `refundCampaign`, which is also gated on `QuestASC`.

Quests are created by a registered ERC-8004 agent, not by an arbitrary address, and the agent's completions are written to the ERC-8004 reputation registry.

## 8. How to check the claim

None of these sends a transaction or needs a private key.

**The whole wiring, re-asserted from the address book.**

```bash
cd contracts
set -a; source .env; set +a
set -a; eval "$(grep -E '^[A-Z0-9_]+=(0x|[0-9a-fA-Fx,]+$)' ../docs/ADDRESSES.md | grep -vE '_TX=|_BLOCK=')"; set +a
forge script script/VerifyBaseline.s.sol:VerifyBaseline --rpc-url creditcoin
```

126 assertions, each read off the chain.
It fails the run if any slot disagrees with what is recorded, so a silent rewiring or a stale address book cannot pass.

**The removal test.**
Ask the deployer to complete a quest and watch it be refused:

```bash
cast call <QuestManager> 'recordCompletion(uint256,address,bytes32,bytes32)' \
  1 <deployer> 0x00…00 0x00…00 --from <deployer> --rpc-url creditcoin
```

It reverts with `QuestManager__WrongCompleter`.
The same call from a randomly chosen address reverts identically, because the caller is checked rather than the caller's permissions.

**A proof, end to end.**
Every live run, with gas, timings, and both transaction hashes, is in `docs/E2E_LOG.md`.
The Creditcoin transaction and the Sepolia transaction it proves are both public, and the proof material is reconstructible from the Sepolia RPC alone.

**Verify without us.**
A player can build the proof in their own browser and submit it from their own wallet.
This has been done live with the worker stopped, and it is recorded as such.
A platform that stops working when its servers do is the thing this replaces.

## 9. What is not claimed

- **This is testnet.** Creditcoin testnet 102031 and Ethereum Sepolia. Mainnet Ethereum is registered as a supported source chain and a mainnet USDC emitter is allowlisted, but no quest is opened against it, because that needs a keyed mainnet endpoint. `docs/MAINNET_SPIKE.md` says what would change.
- **The deployer is one testnet key.** Deployer, worker, and agent controller are the same address today. It can create quests, fund the vault, and set rules. It cannot complete a quest, mint a badge, grant XP, or move a campaign pool.
- **Attestcoin coverage is a real wait.** Attestation of a Sepolia block takes minutes, and one continuity proof proves exactly one height. The proof material perishes and has to be fetched immediately before submission. Measured waits are in `docs/E2E_LOG.md`.
- **The hosted Proof Builder is not reliable enough alone.** It failed on the first live portal run and on three of five wild-action runs. A raw builder over a Sepolia RPC is an independent second source, and either one's material verifies identically on chain.
- **Writability is not live.** Publishing Creditcoin state back to Ethereum is declared in `contracts/src/interfaces/IVaelOutbound.sol` with zero implementation, so the shape of the game cannot drift into something unpublishable. Nothing outbound could complete a quest in any case.
- **Nothing here makes a bad trade good.** Vael verifies that an action happened, at a size, in a window. It has no opinion about whether it was wise.

## 10. Where the rest is

| | |
|---|---|
| Architecture, contracts, constants, phases | `docs/SPEC.md` |
| How Attestcoin is used, with live evidence | `docs/ATTESTCOIN_INTEGRATION.md` |
| Deployed addresses and every supersession | `docs/ADDRESSES.md` |
| Every live run, with gas and timings | `docs/E2E_LOG.md` |
| Hackathon requirements, and where each is met | `docs/HACKATHON_REQUIREMENTS.md` |
| What running it looks like | `README.md` |
