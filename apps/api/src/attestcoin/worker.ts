import { Contract, JsonRpcProvider, Wallet } from "ethers"

import { env } from "../config/env"
import { SEPOLIA_CHAIN_KEY, creditcoinProvider, sepoliaProvider, workerWallet } from "./config"
import { getAttestedFrontier } from "./chainInfo"
import { waitUntilProvable } from "./attest"
import { fetchProof, verifyMerkleRootLocally } from "./prove"
import { submitProof } from "./submit"
import { QUEST_ASC_ABI, QUEST_MANAGER_ABI } from "./questAscAbi"
import { scanLogs } from "./watcher"
import { ProofSubmission, WorkerStore, createWorkerStore } from "./store"

/**
 * The long-running proof worker.
 *
 * It watches Sepolia for logs from emitters that quests care about, records what it sees **before**
 * doing any network work, and then walks each submission through
 * detected → attesting → proving → submitted → verified, or failed with a reason and an attempt
 * count.
 *
 * Persisting first is what makes a restart safe: a crash between observing a log and proving it
 * leaves a row that the next start picks up, rather than losing the player's action. The worker is
 * a convenience, not a trust dependency: it can only submit proofs, and the chain decides whether
 * they are valid.
 */

const MAX_ATTEMPTS = 5
const POLL_INTERVAL_MS = 30_000
/** Sepolia confirmations before a log is considered stable enough to prove. */
const CONFIRMATIONS = 2

export interface WorkerOptions {
  store?: WorkerStore
  /** Stop after one pass. Used by tests and by the restart demonstration. */
  once?: boolean
  onTick?: (info: { pending: number; scannedTo: number }) => void
}

function log(message: string, detail?: unknown) {
  const stamp = new Date().toISOString().slice(11, 19)
  console.log(`[${stamp}] [worker] ${message}${detail !== undefined ? ` ${detail}` : ""}`)
}

/** Backoff in milliseconds for the nth attempt. */
function backoffMs(attempts: number): number {
  return Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1))
}

export class AttestcoinWorker {
  private readonly cc: JsonRpcProvider
  private readonly sepolia: JsonRpcProvider
  private readonly wallet: Wallet
  private readonly questManager: Contract
  private readonly questAscAddress: string
  private readonly store: WorkerStore
  private stopping = false

  constructor(private readonly options: WorkerOptions = {}) {
    this.cc = creditcoinProvider()
    this.sepolia = sepoliaProvider()
    this.wallet = workerWallet()
    this.questAscAddress = requireEnv("QUEST_ASC_ADDRESS")
    this.questManager = new Contract(env.QUEST_MANAGER_ADDRESS, QUEST_MANAGER_ABI, this.cc)
    this.store = options.store ?? createWorkerStore()
  }

  async start(): Promise<void> {
    await this.store.init()
    log(`state store: ${this.store.kind}`)

    const frontier = await getAttestedFrontier(this.cc, SEPOLIA_CHAIN_KEY)
    if (frontier.ok) log(`attested Sepolia frontier ${frontier.value.height}`)

    // Catch-up before watching: unfinished rows from a previous run come first, because the
    // player whose action they represent has already been waiting.
    const carried = await this.store.pendingSubmissions()
    if (carried.length > 0) {
      log(`resuming ${carried.length} unfinished submission(s) from persisted state`)
      for (const row of carried) log(`  ${row.status.padEnd(9)} ${row.sourceTxHash} quest ${row.questIdOnChain}`)
    }

    for (;;) {
      if (this.stopping) return
      try {
        await this.tick()
      } catch (error: any) {
        log(`tick failed: ${error?.message ?? String(error)}`)
      }
      if (this.options.once) return
      await sleep(POLL_INTERVAL_MS)
    }
  }

  stop() {
    this.stopping = true
  }

  /** One pass: observe, then advance every pending submission by one step. */
  async tick(): Promise<void> {
    const scannedTo = await this.observe()
    const pending = await this.store.pendingSubmissions()
    this.options.onTick?.({ pending: pending.length, scannedTo })

    for (const row of pending) {
      if (this.stopping) return
      try {
        await this.advance(row)
      } catch (error: any) {
        // A thrown error here is almost always transient: an RPC timeout, a rate limit, a provider
        // hiccup. Marking the row failed would abandon a player's action because one request was
        // slow. Count the attempt, keep the stage, and only give up once the attempts run out.
        await this.retryLater(row, error?.message ?? String(error))
      }
    }
  }

  /**
   * Watch Sepolia for logs from emitters any accepted quest cares about.
   *
   * The emitter set comes from the QuestASC allowlist as configured, passed in through the
   * environment, because reading every allowlist entry from chain would need an enumerable
   * mapping the contract deliberately does not have.
   */
  private async observe(): Promise<number> {
    const emitters = watchedEmitters()
    if (emitters.length === 0) return 0

    const head = await this.sepolia.getBlockNumber()
    const safeHead = head - CONFIRMATIONS
    if (safeHead <= 0) return 0

    const cursorKey = "all"
    const cursor = await this.store.getCursor(SEPOLIA_CHAIN_KEY, cursorKey)
    const from = cursor ? cursor.lastBlock + 1 : Math.max(0, safeHead - env.WORKER_LOG_CHUNK_MAX)
    if (from > safeHead) return cursor?.lastBlock ?? safeHead

    const scan = await scanLogs({
      provider: this.sepolia,
      emitters,
      topics: [],
      fromBlock: from,
      toBlock: safeHead,
    })
    if (!scan.ok) {
      log(`scan failed: ${scan.error}`)
      return cursor?.lastBlock ?? from - 1
    }

    if (scan.value.logs.length > 0) {
      log(`observed ${scan.value.logs.length} log(s) in ${from}..${scan.value.scannedTo}`)
    }

    // Persist before any network work, so a crash here still leaves a record of what was seen.
    for (const entry of scan.value.logs) {
      const questId = await this.questForLog(entry)
      if (questId === undefined) continue
      const created = await this.store.upsertSubmission({
        questIdOnChain: questId,
        participant: (await this.wallet.getAddress()).toLowerCase(),
        sourceChainKey: SEPOLIA_CHAIN_KEY,
        sourceTxHash: entry.transactionHash,
        sourceBlock: entry.blockNumber,
        actionType: 0,
        status: "detected",
      })
      log(`detected ${created.sourceTxHash} for quest ${questId}`)
    }

    // Only advance over what was actually covered.
    await this.store.setCursor(SEPOLIA_CHAIN_KEY, cursorKey, scan.value.scannedTo)
    return scan.value.scannedTo
  }

  /**
   * Which quest, if any, a log belongs to.
   *
   * milestone 3b resolves this from an explicit mapping supplied by the operator, because a
   * third-party protocol's log carries no quest id. milestone 4 replaces it with the accepted-quest
   * index once quests are indexed off chain.
   */
  private async questForLog(entry: { transactionHash: string }): Promise<number | undefined> {
    const mapping = process.env.WORKER_TX_QUEST_MAP
    if (!mapping) return undefined
    for (const pair of mapping.split(",")) {
      const [hash, quest] = pair.split(":")
      if (hash && quest && hash.toLowerCase() === entry.transactionHash.toLowerCase()) {
        return Number(quest)
      }
    }
    return undefined
  }

  /** Move one submission forward by exactly one step. */
  private async advance(row: ProofSubmission): Promise<void> {
    if (row.attempts >= MAX_ATTEMPTS) {
      await this.fail(row, `giving up after ${row.attempts} attempts`)
      return
    }
    const age = Date.now() - new Date(row.updatedAt).getTime()
    if (row.attempts > 0 && age < backoffMs(row.attempts)) return

    if (row.status === "detected" || row.status === "attesting") {
      await this.store.updateSubmission(row.id, { status: "attesting" })
      const frontier = await getAttestedFrontier(this.cc, SEPOLIA_CHAIN_KEY)
      if (!frontier.ok) throw new Error(frontier.error)
      // Strictly above: a continuity proof needs an attested endpoint on both sides of the block.
      if (frontier.value.height <= BigInt(row.sourceBlock)) {
        log(`waiting: frontier ${frontier.value.height}, need above ${row.sourceBlock}`)
        return
      }
      await this.store.updateSubmission(row.id, { status: "proving" })
      log(`proving ${row.sourceTxHash}`)
      return
    }

    if (row.status === "proving") {
      const proof = await fetchProof(SEPOLIA_CHAIN_KEY, row.sourceTxHash, this.sepolia)
      if (!proof.ok) {
        await this.store.updateSubmission(row.id, { attempts: row.attempts + 1, error: proof.error })
        return
      }
      const local = await verifyMerkleRootLocally(proof.value)
      if (!local.ok) {
        await this.store.updateSubmission(row.id, { attempts: row.attempts + 1, error: local.error })
        return
      }

      const submitted = await submitProof(
        this.wallet,
        this.questAscAddress,
        proof.value,
        BigInt(row.questIdOnChain)
      )
      if (!submitted.ok) {
        if (submitted.failure?.kind === "refetch") {
          log(`proof perished for ${row.sourceTxHash}, will refetch`)
          await this.store.updateSubmission(row.id, {
            attempts: row.attempts + 1,
            error: submitted.error,
          })
          return
        }
        await this.fail(row, submitted.error)
        return
      }

      await this.store.updateSubmission(row.id, {
        status: "verified",
        creditcoinTxHash: submitted.value.txHash,
        error: "",
      })
      log(`verified ${row.sourceTxHash} in ${submitted.value.txHash}`)
      return
    }
  }

  /**
   * Record a transient failure without losing the row's place in the pipeline.
   *
   * Terminal failure is reserved for things retrying cannot fix: a rule the action does not
   * satisfy, a replayed log, an emitter that is not allowlisted. Everything else waits and tries
   * again, with the backoff growing per attempt.
   */
  private async retryLater(row: ProofSubmission, reason: string): Promise<void> {
    const attempts = row.attempts + 1
    if (attempts >= MAX_ATTEMPTS) {
      await this.fail(row, `${reason} (after ${attempts} attempts)`)
      return
    }
    log(`retrying ${row.sourceTxHash} in ${Math.round(backoffMs(attempts) / 1000)}s: ${reason}`)
    await this.store.updateSubmission(row.id, { attempts, error: reason })
  }

  private async fail(row: ProofSubmission, reason: string): Promise<void> {
    log(`failed ${row.sourceTxHash}: ${reason}`)
    await this.store.updateSubmission(row.id, {
      status: "failed",
      error: reason,
      attempts: row.attempts + 1,
    })
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** Emitters the worker watches, from the environment. */
function watchedEmitters(): string[] {
  const names = [
    "QUEST_PORTAL_ADDRESS",
    "SEPOLIA_WETH9",
    "SEPOLIA_USDC",
    "SEPOLIA_AAVE_POOL",
    "SEPOLIA_POOL_USDC_WETH_500",
  ]
  return names
    .map((name) => process.env[name])
    .filter((value): value is string => !!value && /^0x[0-9a-fA-F]{40}$/.test(value))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
