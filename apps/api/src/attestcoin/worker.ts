import { Contract, JsonRpcProvider, Wallet } from "ethers"

import { env } from "../config/env"
import { SEPOLIA_CHAIN_KEY, creditcoinProvider, sepoliaProvider, workerWallet } from "./config"
import { getAttestedFrontier } from "./chainInfo"
import { waitUntilProvable } from "./attest"
import { fetchProof, verifyMerkleRootLocally } from "./prove"
import { submitProof } from "./submit"
import { QUEST_ASC_ABI, QUEST_MANAGER_ABI } from "./questAscAbi"
import { scanLogs } from "./watcher"
import { IndexedQuest, ProofSubmission, WorkerStore, createWorkerStore } from "./store"
import { CreditcoinIndexer } from "../indexer"

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

/** `QuestActionPerformed(uint256,address,uint8,address,uint256)`. */
const PORTAL_TOPIC = "0x3ffa602a6835802daaea4f4c4102da0a312d481769471dd020a1512afd9d8022"

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
  private readonly indexer: CreditcoinIndexer
  private stopping = false

  constructor(private readonly options: WorkerOptions = {}) {
    this.cc = creditcoinProvider()
    this.sepolia = sepoliaProvider()
    this.wallet = workerWallet()
    this.questAscAddress = requireEnv("QUEST_ASC_ADDRESS")
    this.questManager = new Contract(env.QUEST_MANAGER_ADDRESS, QUEST_MANAGER_ABI, this.cc)
    this.store = options.store ?? createWorkerStore()
    this.indexer = new CreditcoinIndexer(this.store, this.cc)
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

  /** One pass: index Creditcoin, observe Sepolia, then advance every pending submission. */
  async tick(): Promise<void> {
    // Indexing first, so a quest accepted moments ago is already resolvable when the Sepolia log
    // for it turns up in the same pass.
    const indexed = await this.indexer.scanOnce()
    // Every counter, not just the first three. The arena, loot, market and proof counters were
    // added later and a scan that only moved those looked, in the log, like a scan that did
    // nothing at all.
    const moved = [
      ["quest", indexed.questsTouched],
      ["hero", indexed.heroesTouched],
      ["raid hit", indexed.raidHits],
      ["action", indexed.actions],
      ["reward", indexed.rewards],
      ["badge", indexed.badges],
      ["arena", indexed.arena],
      ["drop", indexed.drops],
      ["equipment", indexed.equipment],
      ["listing", indexed.listings],
    ].filter(([, count]) => (count as number) > 0)

    if (moved.length > 0) {
      log(
        `indexed ${indexed.fromBlock}..${indexed.toBlock}: ` +
          moved.map(([label, count]) => `${count} ${label}`).join(", ")
      )
    }

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
      const match = await this.questForLog(entry)
      if (!match) continue
      const created = await this.store.upsertSubmission({
        questIdOnChain: match.quest.questId,
        participant: match.quest.participant,
        sourceChainKey: SEPOLIA_CHAIN_KEY,
        sourceTxHash: entry.transactionHash,
        sourceBlock: entry.blockNumber,
        actionType: match.quest.actionType,
        status: "detected",
      })
      if (created.status === "detected" && created.attempts === 0) {
        log(`detected ${created.sourceTxHash} for quest ${match.quest.questId} (${match.reason})`)
      }
    }

    // Only advance over what was actually covered.
    await this.store.setCursor(SEPOLIA_CHAIN_KEY, cursorKey, scan.value.scannedTo)
    return scan.value.scannedTo
  }

  /**
   * Which quest, if any, an observed Sepolia log belongs to.
   *
   * A third-party protocol's event cannot name a quest, so the answer comes from the chain-derived
   * index: of the quests this deployment knows are accepted and not yet completed, which one names
   * this emitter or this token? Most recently accepted first, because a player who accepted the
   * same kind of quest twice means the newer one.
   *
   * Being wrong here is cheap and safe. The quest id is only a hint, and QuestASC re-checks every
   * rule against the proved log: a mismatched guess is declined on chain, not paid.
   */
  private async questForLog(entry: {
    transactionHash: string
    address: string
    topics: readonly string[]
  }): Promise<{ quest: IndexedQuest; reason: string } | undefined> {
    const emitter = entry.address.toLowerCase()
    const quests = await this.store.allQuests()

    const open = quests.filter((q) => q.accepted && !q.completed)
    if (open.length === 0) return undefined

    // Vael's own portal event names the quest in topics[1], so there is nothing to guess. This
    // matters whenever a player has several open quests against the same emitter: without it,
    // every check-in would resolve to whichever they accepted last.
    if (entry.topics[0] === PORTAL_TOPIC && entry.topics.length > 1) {
      const named = Number(BigInt(entry.topics[1]!))
      const quest = open.find((q) => q.questId === named)
      if (quest) return { quest, reason: "named by the portal event" }
    }

    const byEmitter = open
      .filter((q) => q.emitter === emitter)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (byEmitter[0]) return { quest: byEmitter[0], reason: "emitter match" }

    // An ERC-20 transfer is emitted by the token itself, so the rule's token is the emitter.
    const byToken = open
      .filter((q) => q.token === emitter)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (byToken[0]) return { quest: byToken[0], reason: "token match" }

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
