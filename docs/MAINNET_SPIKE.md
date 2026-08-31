# Ethereum mainnet feasibility, chainKey 3

Can Vael verify a real Ethereum **mainnet** action on Creditcoin, and is a "veteran" quest that
proves a player's own past mainnet activity worth building?

Everything below was measured, keylessly, by `apps/api/scripts/spike-mainnet.ts`.
Nothing was signed and nothing was spent.

```bash
set -a; source contracts/.env; set +a
pnpm --filter @vael/api spike:mainnet
```

## Verdict: go, with three conditions

The mechanism works today. A real mainnet USDC `Transfer` was proved against the Attestcoin
attestation from a plain `eth_call`, and it costs about the same gas as a Sepolia proof.

What stands between that and a shipped veteran quest is configuration, not code:

1. **`QuestASC.setSupportedChain(3, true)`.** The live contract refuses chainKey 3 with
   `UnsupportedChainKey(3)`, which is one owner transaction, not a redeploy.
2. **An emitter allowlist entry** for mainnet USDC under `Erc20Transfer`.
3. **`rule.minSourceBlock` set explicitly.** A quest's block floor otherwise defaults to the
   attested frontier at acceptance, so a *past* transaction is rejected as `SourceBlockTooEarly`.
   A veteran quest is the one case where the floor must point backwards, and the rule already
   supports it.

None of the three needs a contract change. They are deliberately not done here: turning mainnet on
in the live deployment is a decision about what the game accepts, and this document is the evidence
for making it, not the making of it.

## What the precompile reports

| | |
|---|---|
| chainKey 3 known to ChainInfo | yes |
| Native chain id | 1 |
| Name | `Ethereum` |
| Attested frontier | 25,946,290 |
| Mainnet head at the time | 25,946,323 |
| **Frontier lag** | **33 to 36 blocks, about 7 minutes** |
| `get_attestation_genesis_height(3)` | 0 |

The genesis read of 0 is not evidence of anything. `docs/SPEC.md` §3.2 records that the precompile
returns 0 both for "no configured genesis" and for chains that are in fact supported, so the usable
depth was measured by asking about real historical heights instead.

## How far back mainnet is actually provable

`get_attestation_bounds(3, height)` at increasing depth:

| Depth | Approximate age | Attested | Bounds returned |
|---|---|---|---|
| 100 blocks | 20 minutes | yes | 25,946,180 .. 25,946,190 |
| 1,000 | 3 hours | yes | 25,945,200 .. 25,945,300 |
| 10,000 | 1.4 days | yes | 25,936,200 .. 25,936,300 |
| 100,000 | 14 days | yes | 25,846,200 .. 25,846,300 |
| 1,000,000 | 139 days | yes | 24,946,000 .. 24,947,000 |
| 5,000,000 | 694 days | yes | 20,946,000 .. 20,947,000 |

**Coverage reaches at least 694 days back**, which is more than enough for a veteran quest.

The interesting detail is the **stride**, visible in the bounds column. Near the frontier
attestations are 10 blocks apart; a thousand blocks back they are 100 apart; a million back they are
1,000 apart. Older history is attested more coarsely, so a continuity proof spanning an old height
has further to walk. The proof measured below sat 12 blocks behind the frontier and needed 3
continuity roots; an equivalent proof from two years ago should be expected to need more, and a
veteran quest should be sized on that rather than on the numbers here.

## The proof

A real USDC `Transfer` on mainnet, chosen from a block inside the attested range.

| | |
|---|---|
| Transaction | `0x3004f482…1ff79e` |
| Mainnet block | 25,946,278 |
| Covered by bounds | yes, 25,946,270 .. 25,946,280 |
| Proof source | Proof Builder |
| Fetch time | 1.1 s |
| **Continuity roots** | **3** |
| **Merkle siblings** | **9** |
| Encoded transaction | 1,664 bytes |
| Calldata for a `submit` | 2,788 bytes |

## Verification and gas

| Call | Result |
|---|---|
| `INativeQueryVerifier.verify(3, …)` over `eth_call` | **true, the proof holds** |
| `verifyAndEmit` estimated gas | **46,688** |
| `QuestASC.submit` over `eth_call` | reverted `UnsupportedChainKey(3)` |
| `QuestASC.submit` estimated gas | not estimable, same revert |

The QuestASC revert is the correct answer rather than a failure: the contract refuses a chain
nobody has registered, which is the check that stops a proof from an unexpected chain reaching the
payout path. The precompile figure is the honest cost of the verification itself, and at 46,688 gas
it is in the same range as Sepolia; the rest of a real submission is Vael's own rule checking and
calldata, which do not change with the source chain.

## What a veteran quest would look like

The pieces exist. `Erc20TransferAdapter` takes the player from `topics[1]`, the **sender**, so a
veteran quest proves that the player *sent* a mainnet transfer, not that they received one. That is
the right way round: receiving tokens is something anybody can arrange for anybody.

A rule would read: action `Erc20Transfer`, emitter mainnet USDC
`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, token the same, `minAmount` a meaningful sum,
`playerMustMatch` true, and `minSourceBlock` set to a height comfortably in the past.

## What this spike deliberately did not do

It did not complete a quest. The transaction it proved belongs to a stranger, and the player-binding
rule exists precisely to refuse that: `playerMustMatch` compares the address in the log to the
participant who accepted the quest, so somebody else's mainnet transfer can never be claimed. A
spike that blurred that line would be demonstrating the wrong thing.

It also does not turn mainnet on. See the three conditions above.
