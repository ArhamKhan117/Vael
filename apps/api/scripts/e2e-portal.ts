/**
 * Live end-to-end proof of the Attestcoin core loop, Portal action.
 *
 * Creates a portal quest on Creditcoin, accepts it, performs a real check-in on Ethereum Sepolia,
 * waits for the Attestcoin attestors to cover that block, fetches a proof, preflights it keylessly,
 * submits it, and then asserts on chain that the reward moved, the badge exists, and the replay key
 * is claimed.
 *
 * Run:  pnpm --filter @vael/api exec tsx scripts/e2e-portal.ts
 *       pnpm --filter @vael/api exec tsx scripts/e2e-portal.ts --replay <sepoliaTxHash>
 *
 * The second form re-submits an already-proved transaction and asserts the replay is refused at
 * preflight, so it costs no gas.
 */
import { Contract, JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers"

import { env } from "../src/config/env"
import {
  SEPOLIA_CHAIN_KEY,
  creditcoinProvider,
  sepoliaProvider,
  workerWallet,
} from "../src/attestcoin/config"
import { getAttestedFrontier } from "../src/attestcoin/chainInfo"
import { waitForAttestation } from "../src/attestcoin/attest"
import { fetchProof, verifyMerkleRootLocally } from "../src/attestcoin/prove"
import { preflight, submitProof } from "../src/attestcoin/submit"
import {
  QUEST_ASC_ABI,
  QUEST_MANAGER_ABI,
  QUEST_PORTAL_ABI,
} from "../src/attestcoin/questAscAbi"

const CHECK_IN_AMOUNT = parseEther("0.001")
const REWARD = parseEther("100")
const DASHBOARD = "https://dashboard.cc3-testnet.creditcoin.network"
const CC_EXPLORER = "https://creditcoin-testnet.blockscout.com"
const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io"

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"]
const BADGE_ABI = ["function balanceOf(address) view returns (uint256)"]

function log(step: string, detail?: unknown) {
  const stamp = new Date().toISOString().slice(11, 19)
  console.log(`[${stamp}] ${step}${detail !== undefined ? ` ${detail}` : ""}`)
}

/** ethers types `wait()` as nullable; a dropped receipt here means the run cannot continue. */
function required<T>(value: T | null, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} produced no receipt`)
  return value
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

async function main() {
  const replayArgIndex = process.argv.indexOf("--replay")
  const replayTxHash = replayArgIndex >= 0 ? process.argv[replayArgIndex + 1] : undefined

  const cc = creditcoinProvider()
  const sepolia = sepoliaProvider()
  const wallet = workerWallet()
  const sepoliaWallet = new Wallet(wallet.privateKey, sepolia)
  const player = await wallet.getAddress()

  const questManagerAddress = env.QUEST_MANAGER_ADDRESS
  const questAscAddress = requireEnv("QUEST_ASC_ADDRESS")
  const portalAddress = requireEnv("QUEST_PORTAL_ADDRESS")
  const vaelTokenAddress = requireEnv("VAEL_TOKEN_ADDRESS")
  const badgeAddress = env.BADGE_NFT_ADDRESS

  log("player           ", player)
  log("QuestManager     ", questManagerAddress)
  log("QuestASC         ", questAscAddress)
  log("QuestPortal      ", `${portalAddress} (Sepolia)`)

  const questManager = new Contract(questManagerAddress, QUEST_MANAGER_ABI, wallet)
  const questASC = new Contract(questAscAddress, QUEST_ASC_ABI, wallet)
  const portal = new Contract(portalAddress, QUEST_PORTAL_ABI, sepoliaWallet)
  const vael = new Contract(vaelTokenAddress, ERC20_ABI, cc)
  const badge = new Contract(badgeAddress, BADGE_ABI, cc)

  if (replayTxHash) {
    await runReplayCheck(questASC, sepolia, replayTxHash)
    return
  }

  // ---------------------------------------------------------------- 1. create

  log("1. creating a portal quest")
  const rule = {
    actionType: 0, // Portal
    emitter: portalAddress,
    token: "0x0000000000000000000000000000000000000000",
    minAmount: CHECK_IN_AMOUNT,
    minSourceBlock: 0,
    maxSourceBlock: 0,
    playerMustMatch: true,
  }
  const createTx = await questManager.getFunction("createQuest").send({
    category: 0,
    protocol: portalAddress,
    parametersHash: "0x" + "11".repeat(32),
    metadataURI: "ipfs://placeholder",
    rewardPerParticipant: REWARD,
    expiry: 0,
    badgeLevel: 1,
    participant: player,
    sourceChainKey: SEPOLIA_CHAIN_KEY,
    campaignId: 0,
    rule,
  })
  const createReceipt = required(await createTx.wait(1), "createQuest")
  const questId = readQuestId(createReceipt, questManagerAddress)
  log("   questId       ", questId.toString())
  log("   create tx     ", `${CC_EXPLORER}/tx/${createReceipt.hash}`)
  log("   gas           ", `${createReceipt.gasUsed}`)

  // ---------------------------------------------------------------- 2. accept

  log("2. accepting, which anchors the attested Sepolia frontier")
  const acceptTx = await questManager.getFunction("acceptQuest").send(questId)
  const acceptReceipt = required(await acceptTx.wait(1), "acceptQuest")
  const anchored: bigint = await questManager
    .getFunction("acceptedAtSourceHeight")
    .staticCall(questId, player)
  log("   accept tx     ", `${CC_EXPLORER}/tx/${acceptReceipt.hash}`)
  log("   anchored at   ", `Sepolia height ${anchored}`)
  log("   gas           ", `${acceptReceipt.gasUsed}`)

  // ---------------------------------------------------------------- 3. act

  log("3. performing the real action on Sepolia")
  const balanceBefore: bigint = await vael.getFunction("balanceOf").staticCall(player)
  const badgesBefore: bigint = await badge.getFunction("balanceOf").staticCall(player)

  const checkInTx = await portal
    .getFunction("checkIn")
    .send(questId, { value: CHECK_IN_AMOUNT })
  const checkInReceipt = required(await checkInTx.wait(1), "checkIn")
  const sourceBlock = BigInt(checkInReceipt.blockNumber)
  log("   sepolia tx    ", `${SEPOLIA_EXPLORER}/tx/${checkInReceipt.hash}`)
  log("   sepolia block ", sourceBlock.toString())
  log("   gas           ", `${checkInReceipt.gasUsed}`)

  if (sourceBlock <= anchored) {
    throw new Error(
      `source block ${sourceBlock} is not above the anchored height ${anchored}; ` +
        "the quest could never be satisfied by this action"
    )
  }

  // ---------------------------------------------------------------- 4. attest

  log("4. waiting for attestation, measured lag is roughly 8 minutes")
  const waitStarted = Date.now()
  const waited = await waitForAttestation(cc, SEPOLIA_CHAIN_KEY, sourceBlock, {
    onPoll: ({ attestedHeight, elapsedMs }) => {
      const behind = sourceBlock - attestedHeight
      log(
        "   polling       ",
        `frontier ${attestedHeight}, ${behind > 0n ? `${behind} blocks behind` : "covered"}, ` +
          `${Math.round(elapsedMs / 1000)}s elapsed`
      )
    },
  })
  if (!waited.ok) throw new Error(waited.error)
  log(
    "   attested      ",
    `height ${waited.value.attestedHeight} after ${Math.round(waited.value.waitedMs / 1000)}s ` +
      `over ${waited.value.polls} polls`
  )

  // ---------------------------------------------------------------- 5. prove

  log("5. fetching the proof immediately before submitting")
  const proof = await fetchProof(SEPOLIA_CHAIN_KEY, checkInReceipt.hash, sepolia)
  if (!proof.ok) throw new Error(proof.error)
  log("   source        ", proof.value.source)
  log("   txIndex       ", proof.value.txIndex)
  log("   continuity    ", `${proof.value.continuityProof.roots.length} roots`)
  log("   siblings      ", `${proof.value.merkleProof.siblings.length}`)

  const localRoot = await verifyMerkleRootLocally(proof.value)
  if (!localRoot.ok) throw new Error(localRoot.error)
  log("   merkle root   ", `re-derived locally and matches: ${localRoot.value.slice(0, 18)}...`)

  // ---------------------------------------------------------------- 6. submit

  log("6. keyless preflight, then submit")
  const pre = await preflight(questASC, proof.value, questId)
  if (!pre.ok) throw new Error(`preflight failed: ${pre.error}`)
  log("   preflight     ", `would handle ${pre.value} log(s), no gas spent`)

  const submitted = await submitProof(wallet, questAscAddress, proof.value, questId)
  if (!submitted.ok) {
    throw new Error(`submit failed (${submitted.failure?.kind}): ${submitted.error}`)
  }
  log("   creditcoin tx ", `${CC_EXPLORER}/tx/${submitted.value.txHash}`)
  log("   block         ", submitted.value.blockNumber)
  log(
    "   gas           ",
    `${submitted.value.gasUsed} used / ${submitted.value.gasLimit} limit ` +
      `(${(Number(submitted.value.gasUsed) * 100) / Number(submitted.value.gasLimit) | 0}%)`
  )
  log("   dashboard     ", DASHBOARD)

  // ---------------------------------------------------------------- 7. assert

  log("7. asserting the on-chain outcome")
  const confirmedAt = submitted.value.blockNumber

  const events = decodeEvents(submitted.value.receipt, questManagerAddress, questAscAddress)
  if (!events.questCompleted) throw new Error("QuestCompleted not found in the receipt")
  if (!events.questProofApplied) throw new Error("QuestProofApplied not found in the receipt")
  log("   QuestCompleted   ", `replayKey ${events.questCompleted.replayKey}`)
  log(
    "   QuestProofApplied",
    `questId ${events.questProofApplied.questId}, amount ${formatEther(events.questProofApplied.amount)} ETH, ` +
      `sourceBlock ${events.questProofApplied.sourceBlock}`
  )

  const balanceAfter: bigint = await vael
    .getFunction("balanceOf")
    .staticCall(player, { blockTag: confirmedAt })
  const delta = balanceAfter - balanceBefore
  if (delta !== REWARD) {
    throw new Error(`VAEL delta was ${formatEther(delta)}, expected ${formatEther(REWARD)}`)
  }
  log("   VAEL delta    ", `${formatEther(delta)} VAEL, exactly the reward`)

  const badgesAfter: bigint = await badge
    .getFunction("balanceOf")
    .staticCall(player, { blockTag: confirmedAt })
  if (badgesAfter !== badgesBefore + 1n) {
    throw new Error(`badge balance went ${badgesBefore} to ${badgesAfter}, expected +1`)
  }
  log("   badge         ", `minted, balance ${badgesAfter}`)

  const replayKey: string = await questASC
    .getFunction("replayKey")
    .staticCall(SEPOLIA_CHAIN_KEY, sourceBlock, proof.value.txIndex, 0)
  const claimed: boolean = await questASC
    .getFunction("claimedLog")
    .staticCall(replayKey, { blockTag: confirmedAt })
  if (!claimed) throw new Error(`replay key ${replayKey} is not marked claimed`)
  log("   replay key    ", `${replayKey} claimed`)

  console.log("")
  console.log("E2E PASSED")
  console.log(`  questId            ${questId}`)
  console.log(`  sepolia tx         ${checkInReceipt.hash}`)
  console.log(`  sepolia block      ${sourceBlock}`)
  console.log(`  attestation wait   ${Math.round((Date.now() - waitStarted) / 1000)}s`)
  console.log(`  creditcoin tx      ${submitted.value.txHash}`)
  console.log(`  submit gas         ${submitted.value.gasUsed} / ${submitted.value.gasLimit}`)
  console.log(`  replay key         ${replayKey}`)
  console.log("")
  console.log(`  Re-run to prove replay is refused:`)
  console.log(
    `  pnpm --filter @vael/api exec tsx scripts/e2e-portal.ts --replay ${checkInReceipt.hash}`
  )
}

/** Re-submit an already-proved transaction and require the preflight to refuse it. */
async function runReplayCheck(questASC: Contract, sepolia: JsonRpcProvider, txHash: string) {
  log("replay check on ", txHash)
  const proof = await fetchProof(SEPOLIA_CHAIN_KEY, txHash, sepolia)
  if (!proof.ok) throw new Error(proof.error)
  log("   proof         ", `refetched from ${proof.value.source}`)

  const replayKey: string = await questASC
    .getFunction("replayKey")
    .staticCall(SEPOLIA_CHAIN_KEY, proof.value.blockHeight, proof.value.txIndex, 0)
  const claimed: boolean = await questASC.getFunction("claimedLog").staticCall(replayKey)
  log("   replay key    ", `${replayKey} claimed=${claimed}`)

  const pre = await preflight(questASC, proof.value, 0n)
  if (pre.ok) {
    throw new Error("REPLAY ACCEPTED. The replay ledger is not working.")
  }
  log("   preflight     ", `refused: ${pre.error}`)
  if (!/AlreadyClaimed/i.test(pre.error)) {
    throw new Error(`refused, but not with AlreadyClaimed: ${pre.error}`)
  }

  console.log("")
  console.log("REPLAY CORRECTLY REFUSED, no gas spent")
  console.log(`  replay key ${replayKey}`)
  console.log(`  revert     ${pre.error}`)
}

function readQuestId(receipt: any, questManagerAddress: string): bigint {
  const iface = new Contract(questManagerAddress, QUEST_MANAGER_ABI).interface
  for (const entry of receipt.logs) {
    if (entry.address.toLowerCase() !== questManagerAddress.toLowerCase()) continue
    try {
      const parsed = iface.parseLog({ topics: [...entry.topics], data: entry.data })
      if (parsed?.name === "QuestCreated") return parsed.args.questId as bigint
    } catch {
      // Not a QuestManager event this ABI slice declares.
    }
  }
  throw new Error("QuestCreated not found in the create receipt")
}

function decodeEvents(receipt: any, questManagerAddress: string, questAscAddress: string) {
  const managerIface = new Contract(questManagerAddress, QUEST_MANAGER_ABI).interface
  const ascIface = new Contract(questAscAddress, QUEST_ASC_ABI).interface
  let questCompleted: any
  let questProofApplied: any

  for (const entry of receipt.logs) {
    const address = entry.address.toLowerCase()
    const log = { topics: [...entry.topics], data: entry.data }
    if (address === questManagerAddress.toLowerCase()) {
      try {
        const parsed = managerIface.parseLog(log)
        if (parsed?.name === "QuestCompleted") questCompleted = parsed.args
      } catch {
        /* not ours */
      }
    }
    if (address === questAscAddress.toLowerCase()) {
      try {
        const parsed = ascIface.parseLog(log)
        if (parsed?.name === "QuestProofApplied") questProofApplied = parsed.args
      } catch {
        /* not ours */
      }
    }
  }
  return { questCompleted, questProofApplied }
}

main().catch((error) => {
  console.error("\nE2E FAILED")
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
