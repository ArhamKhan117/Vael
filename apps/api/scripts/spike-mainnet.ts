/**
 * Keyless feasibility spike: can Vael prove an Ethereum *mainnet* action on Creditcoin?
 *
 *   pnpm --filter @vael/api spike:mainnet
 *
 * Nothing here signs anything or spends anything. It reads the ChainInfo precompile for chainKey 3,
 * picks a real historical USDC Transfer inside the attested range, asks the Proof Builder for a
 * proof of it, and preflights that proof through the Block Prover's `view` overload and through
 * QuestASC's own `submit`, both over `eth_call`.
 *
 * The point is to answer three questions with numbers rather than opinion: how far back mainnet is
 * attested, how big a mainnet proof is, and what verifying one would cost.
 *
 * It deliberately does not complete a quest. A proof of somebody else's transaction is exactly what
 * the player-binding rule exists to refuse, and demonstrating the mechanics must not blur that.
 */
import "dotenv/config"

import { Contract, JsonRpcProvider, id } from "ethers"

import { creditcoinProvider } from "../src/attestcoin/config"
import { fetchProof } from "../src/attestcoin/prove"
import { toSourceTxTuple } from "../src/attestcoin/submit"

const MAINNET_CHAIN_KEY = 3
const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)")

const CHAIN_INFO = "0x0000000000000000000000000000000000000fD3"
const BLOCK_PROVER = "0x0000000000000000000000000000000000000FD2"

/** snake_case, because the method name is the selector on this precompile. */
const CHAIN_INFO_ABI = [
  "function get_chain_by_key(uint64 chainKey) view returns (((uint64 chainKey,uint64 chainId,bytes chainName,uint8 chainEncoding) info, bool exists) result)",
  "function get_latest_attestation_height_and_hash(uint64 chainKey) view returns ((uint64 height,bytes32 hash,bool isAttestation,bool exists) result)",
  "function get_attestation_genesis_height(uint64 chainKey) view returns (uint64)",
  "function get_attestation_bounds(uint64 chainKey, uint64 targetHeight) view returns ((uint64 parentHeight,bytes32 parentHash,bool parentIsAttestation,uint64 childHeight,bytes32 childHash,bool childIsAttestation,bool isAttested) result)",
  "function find_highest_attested_before(uint64 chainKey, uint64 targetHeight) view returns ((uint64 height,bytes32 hash,bool isAttestation,bool exists) result)",
]

const QUEST_ASC_ABI = [
  "function submit((uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,(bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof,(bytes32 lowerEndpointDigest,bytes32[] roots) continuityProof) sourceTx, uint256 questIdHint) returns (uint256)",
]

function line(label: string, value: unknown) {
  console.log(`  ${label.padEnd(34)} ${value}`)
}

async function main() {
  const cc = creditcoinProvider()
  // Public mainnet endpoints differ wildly in what they allow without a key. The block reads below
  // are the widest-supported thing that finds a real transaction, and the list is tried in order.
  const candidates = [
    process.env.MAINNET_RPC_URL,
    "https://eth.drpc.org",
    "https://rpc.flashbots.net",
    "https://eth.llamarpc.com",
    "https://ethereum-rpc.publicnode.com",
  ].filter((url): url is string => Boolean(url))

  // The check is a real block read with full transactions, not `eth_blockNumber`. publicnode
  // answers the latter happily and refuses the former without a key, so the cheap check picks an
  // endpoint that cannot do the only thing this script needs.
  let mainnet: JsonRpcProvider | undefined
  for (const url of candidates) {
    try {
      const provider = new JsonRpcProvider(url, 1, { staticNetwork: true })
      const head = await provider.getBlockNumber()
      const block = await provider.getBlock(head - 40, true)
      if (!block || block.transactions.length === 0) continue
      mainnet = provider
      console.log(`mainnet rpc: ${url}`)
      break
    } catch {
      // Try the next one.
    }
  }
  if (!mainnet) throw new Error("no usable Ethereum mainnet endpoint")
  const chainInfo = new Contract(CHAIN_INFO, CHAIN_INFO_ABI, cc)

  console.log("=== chainKey 3, as the precompile reports it ===")
  const chain = await chainInfo.getFunction("get_chain_by_key").staticCall(MAINNET_CHAIN_KEY)
  const known = chain[1] as boolean
  line("known to ChainInfo", known)
  if (!known) throw new Error("chainKey 3 is not attested at all; the spike stops here")
  line("native chain id", chain[0][1].toString())
  line("name", Buffer.from(chain[0][2].slice(2), "hex").toString("utf8"))

  const frontier = await chainInfo
    .getFunction("get_latest_attestation_height_and_hash")
    .staticCall(MAINNET_CHAIN_KEY)
  const genesis: bigint = await chainInfo
    .getFunction("get_attestation_genesis_height")
    .staticCall(MAINNET_CHAIN_KEY)
  const tip: bigint = frontier[0]
  line("attested frontier", tip.toString())
  line("attestation genesis", genesis.toString())
  line("attested depth (blocks)", (tip - genesis).toString())

  const head = BigInt(await mainnet.getBlockNumber())
  line("mainnet head", head.toString())
  line("frontier lag behind head", (head - tip).toString())

  // Genesis 0 is ambiguous: SPEC §3.2 records that the precompile returns 0 both for "no configured
  // genesis" and for chains that are in fact supported. So the usable depth is measured by asking
  // whether real historical heights are covered, rather than by trusting the genesis read.
  console.log("\n=== how far back is actually provable ===")
  for (const back of [100n, 1_000n, 10_000n, 100_000n, 1_000_000n, 5_000_000n]) {
    if (back >= tip) continue
    const height = tip - back
    const probe = await chainInfo
      .getFunction("get_attestation_bounds")
      .staticCall(MAINNET_CHAIN_KEY, height)
    const days = Number(back) * 12 / 86400
    line(
      `${back} blocks back (~${days.toFixed(1)} days)`,
      probe[6] ? `attested, bounds ${probe[0]}..${probe[3]}` : "NOT attested"
    )
  }

  // ------------------------------------------------------------ pick a transaction

  console.log("\n=== finding a real USDC Transfer inside the attested range ===")
  // Inside the attested range but close to its top. Public mainnet endpoints treat anything more
  // than about 128 blocks old as an archive request and refuse it without a key, and the attested
  // frontier is only tens of blocks behind the head anyway, so the two windows overlap narrowly.
  let chosen: { txHash: string; blockNumber: bigint } | undefined

  // A block read rather than a log filter. eth_getLogs is the first thing a public endpoint
  // withholds without a key; eth_getBlockByNumber with full transactions is not.
  for (let attempt = 0; attempt < 12 && !chosen; attempt++) {
    const height = tip - 12n - BigInt(attempt * 4)
    const block = await mainnet.getBlock(Number(height), true).catch(() => null)
    if (!block) continue
    for (const txHash of block.transactions) {
      const tx = await block.getPrefetchedTransaction(txHash)
      if (tx.to?.toLowerCase() !== USDC_MAINNET.toLowerCase()) continue
      const receipt = await mainnet.getTransactionReceipt(txHash).catch(() => null)
      if (!receipt || receipt.status !== 1) continue
      const hasTransfer = receipt.logs.some(
        (entry) =>
          entry.address.toLowerCase() === USDC_MAINNET.toLowerCase() &&
          entry.topics[0] === TRANSFER_TOPIC
      )
      if (!hasTransfer) continue
      chosen = { txHash, blockNumber: BigInt(receipt.blockNumber) }
      break
    }
  }
  if (!chosen) throw new Error("no USDC Transfer found in the searched range")

  const bounds = await chainInfo
    .getFunction("get_attestation_bounds")
    .staticCall(MAINNET_CHAIN_KEY, chosen.blockNumber)
  line("transaction", chosen.txHash)
  line("mainnet block", chosen.blockNumber.toString())
  line("covered by attestation bounds", bounds[6])
  line("bounds", `${bounds[0]} .. ${bounds[3]}`)
  if (!bounds[6]) throw new Error("the chosen height is not attested; pick a lower one")

  // ------------------------------------------------------------ proof

  console.log("\n=== the proof ===")
  const started = Date.now()
  const proof = await fetchProof(MAINNET_CHAIN_KEY, chosen.txHash, mainnet)
  if (!proof.ok) throw new Error(`no proof: ${proof.error}`)
  const fetchMs = Date.now() - started

  line("source", proof.value.source)
  line("fetch time", `${Math.round(fetchMs / 100) / 10}s`)
  line("continuity roots", proof.value.continuityProof.roots.length)
  line("merkle siblings", proof.value.merkleProof.siblings.length)
  line("encoded transaction bytes", (proof.value.encodedTransaction.length - 2) / 2)

  const tuple = toSourceTxTuple(proof.value)
  const asc = new Contract(process.env.QUEST_ASC_ADDRESS!, QUEST_ASC_ABI, cc)
  const calldata = asc.interface.encodeFunctionData("submit", [tuple, 0n])
  line("calldata bytes", (calldata.length - 2) / 2)

  // ------------------------------------------------------------ keyless preflight and gas

  console.log("\n=== keyless preflight ===")
  let handled: bigint | undefined
  let ascError: string | undefined
  try {
    handled = await asc.getFunction("submit").staticCall(tuple, 0n)
    line("QuestASC.submit (eth_call)", `handled ${handled} log(s)`)
  } catch (error) {
    ascError = (error as Error).message.slice(0, 200)
    line("QuestASC.submit (eth_call)", `reverted: ${ascError}`)
  }

  // Gas, estimated rather than spent. `from` is a plain address with no key behind it here.
  let gas: bigint | undefined
  try {
    gas = await cc.estimateGas({
      to: process.env.QUEST_ASC_ADDRESS!,
      data: calldata,
      from: process.env.DEPLOYER_ADDRESS ?? "0x0000000000000000000000000000000000000001",
    })
    line("estimated gas for submit", gas.toString())
  } catch (error) {
    line("estimated gas for submit", `estimate reverted: ${(error as Error).message.slice(0, 160)}`)
  }

  // The precompile on its own, with no Vael logic in the way, is the honest measure of whether the
  // proof itself verifies.
  console.log("\n=== the precompile alone ===")
  // `verify` returns a bool, not the decoded bytes. It is the honest measure of whether the proof
  // itself holds up, with none of Vael's own rules in the way.
  const proverAbi = [
    "function verify(uint64 chainKey, uint64 blockHeight, bytes encodedTransaction, (bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest,bytes32[] roots) continuityProof) view returns (bool)",
    "function verifyAndEmit(uint64 chainKey, uint64 blockHeight, bytes encodedTransaction, (bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest,bytes32[] roots) continuityProof) returns (bool)",
  ]
  const prover = new Contract(BLOCK_PROVER, proverAbi, cc)
  const proverArgs = [
    MAINNET_CHAIN_KEY,
    chosen.blockNumber,
    proof.value.encodedTransaction,
    [proof.value.merkleProof.root, proof.value.merkleProof.siblings.map((s) => [s.hash, s.isLeft])],
    [proof.value.continuityProof.lowerEndpointDigest, proof.value.continuityProof.roots],
  ] as const

  let verified: boolean | undefined
  try {
    verified = await prover.getFunction("verify").staticCall(...proverArgs)
    line("verify (view)", verified ? "true, the proof holds" : "false")
  } catch (error) {
    line("verify (view)", `reverted: ${(error as Error).message.slice(0, 200)}`)
  }

  let proverGas: bigint | undefined
  try {
    const data = prover.interface.encodeFunctionData("verifyAndEmit", proverArgs as unknown as unknown[])
    proverGas = await cc.estimateGas({
      to: BLOCK_PROVER,
      data,
      from: process.env.DEPLOYER_ADDRESS ?? "0x0000000000000000000000000000000000000001",
    })
    line("verifyAndEmit estimated gas", proverGas.toString())
  } catch (error) {
    line("verifyAndEmit estimated gas", `estimate reverted: ${(error as Error).message.slice(0, 160)}`)
  }

  console.log("\n=== summary ===")
  line("attested depth", `${tip - genesis} blocks`)
  line("frontier lag", `${head - tip} blocks behind mainnet head`)
  line("proof size", `${proof.value.continuityProof.roots.length} continuity roots, ${proof.value.merkleProof.siblings.length} siblings`)
  line("calldata", `${(calldata.length - 2) / 2} bytes`)
  line("proof verifies", verified === true ? "yes" : String(verified))
  line("QuestASC gas", gas ? gas.toString() : "refused, chainKey 3 is not registered")
  line("precompile gas", proverGas ? proverGas.toString() : "not estimable")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
