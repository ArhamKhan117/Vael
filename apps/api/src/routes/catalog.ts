import { Router } from "express"
import { Contract, formatUnits } from "ethers"

import { creditcoinProvider } from "../attestcoin/config"
import { createWorkerStore } from "../attestcoin/store"
import { verifiedProtocolFor } from "../lib/verifiedProtocol"
import { tokenInfo } from "../lib/protocols"
import type {
  CataloguedQuest,
  IndexedAction,
  IndexedCampaign,
  ProofSubmission,
  WorkerStore,
} from "../attestcoin/store"

/**
 * The player-facing quest and campaign lists, assembled from Creditcoin.
 *
 * Every field here comes from a QuestManager struct the indexer read back, a CampaignEscrow event,
 * or the worker's own queue. Nothing is read from a table an operator fills in by hand, because
 * the thing a player most needs to trust about a quest board is that the quests on it are the
 * quests the chain will pay for.
 */

export const catalogRouter: Router = Router()

const CATEGORY_LABELS = ["Swap", "Liquidity", "Stake", "Lend", "Other"] as const
const STATUS_LABELS = ["Inactive", "Active", "Completed", "Cancelled"] as const
/** Mirrors VaelTypes.ActionType, all seven of them. */
const ACTION_LABELS = [
  "Portal check-in",
  "Uniswap swap",
  "ERC-20 transfer",
  "Aave supply",
  "Aave borrow",
  "PenguinSwap swap",
  "Wrap CTC",
] as const
const ACTION_PORTAL = 0
/** Mirrors VaelTypes.FIRST_NATIVE_ACTION. At or above this, the action happens on Creditcoin. */
const FIRST_NATIVE_ACTION = 5
/** The action that spends the native coin itself, so its minimum is denominated in CTC. */
const ACTION_WRAP_NATIVE = 6

/**
 * The rule's minimum, in units a player recognises.
 *
 * A minimum of zero is not "0 USDC", it is no minimum at all, and saying so is the difference
 * between a quest that looks impossible and one that looks free. Where the units come from
 * depends on the rule: a named token sets them, and a portal quest has none to name because the
 * amount it checks is the ether the player sent. Anything else is shown as the integer the rule
 * actually holds rather than guessed at a scale.
 */
function minAmountLabel(minAmount: string, token: string, actionType: number): string {
  if (BigInt(minAmount || "0") === 0n) return "any amount"
  const info = tokenInfo(token)
  if (info) return `${formatUnits(minAmount, info.decimals)} ${info.symbol}`
  if (actionType === ACTION_PORTAL) return `${formatUnits(minAmount, 18)} ETH`
  // Wrapping names no token because the thing it spends is the native coin.
  if (actionType === ACTION_WRAP_NATIVE) return `${formatUnits(minAmount, 18)} CTC`
  return `${minAmount} units`
}

const ESCROW_ABI = ["function campaignBalance(bytes32 campaignId) view returns (uint256)"]

function escrowAddress(): string | undefined {
  const value = process.env.CAMPAIGN_ESCROW_ADDRESS
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : undefined
}

/**
 * What the escrow holds for a pool right now, read from the contract and remembered for a short
 * while.
 *
 * The balance is read rather than accumulated, so it is whatever the contract says even if the
 * index has never seen a single one of the pool's events. It is also what decides whether a pool
 * is refunded, which the quest board now asks on every refresh, and eight contract reads against a
 * rate-limited public RPC every few seconds is how a board stops loading. Thirty seconds is well
 * inside how often a pool's balance changes.
 */
const BALANCE_TTL_MS = 30_000
const balances = new Map<string, { value: string; at: number }>()

async function campaignBalance(campaignKey: string): Promise<string> {
  const cached = balances.get(campaignKey)
  if (cached && Date.now() - cached.at < BALANCE_TTL_MS) return cached.value
  const escrow = escrowAddress()
  if (!escrow) return "0"
  try {
    const contract = new Contract(escrow, ESCROW_ABI, creditcoinProvider())
    const balance: bigint = await contract.getFunction("campaignBalance").staticCall(campaignKey)
    balances.set(campaignKey, { value: balance.toString(), at: Date.now() })
    return balance.toString()
  } catch {
    return cached?.value ?? "0"
  }
}

type PoolStatus = "funded" | "drained" | "refunded"

function poolStatus(campaign: IndexedCampaign, balance: string): PoolStatus {
  if (BigInt(balance) > 0n) return "funded"
  return BigInt(campaign.refunded) > 0n ? "refunded" : "drained"
}

/** The status of every indexed pool, by escrow key. */
async function poolStatuses(store: WorkerStore): Promise<Map<string, PoolStatus>> {
  const campaigns = await store.campaigns()
  const statuses = new Map<string, PoolStatus>()
  await Promise.all(
    campaigns.map(async (campaign) => {
      statuses.set(campaign.campaignKey, poolStatus(campaign, await campaignBalance(campaign.campaignKey)))
    })
  )
  return statuses
}

/** A uint256 campaign id as the bytes32 key CampaignEscrow stores pools under. */
function campaignKeyOf(campaignId: string): string {
  return `0x${BigInt(campaignId).toString(16).padStart(64, "0")}`
}

type ProofState =
  | { state: "verified"; replayKey: string; sourceBlock: number; creditcoinBlock: number; at: string }
  | { state: ProofSubmission["status"]; sourceTxHash: string; attempts: number; error: string | null; at: string }
  | { state: "waiting" }

/**
 * Where a quest stands between acceptance and payout.
 *
 * A verified action outranks a submission row: the submission is what the worker is doing, the
 * action is what QuestASC did. A quest with neither is waiting on the player.
 */
function proofStateOf(
  questId: number,
  actions: IndexedAction[],
  submissions: ProofSubmission[]
): ProofState {
  const proved = actions.find((action) => action.questId === questId)
  if (proved) {
    return {
      state: "verified",
      replayKey: proved.replayKey,
      sourceBlock: proved.sourceBlock,
      creditcoinBlock: proved.creditcoinBlock,
      at: proved.createdAt,
    }
  }
  const submission = submissions
    .filter((s) => s.questIdOnChain === questId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (submission) {
    return {
      state: submission.status,
      sourceTxHash: submission.sourceTxHash,
      attempts: submission.attempts,
      error: submission.error ?? null,
      at: submission.updatedAt,
    }
  }
  return { state: "waiting" }
}

function serialize(
  quest: CataloguedQuest,
  proof: ProofState,
  pools?: Map<string, PoolStatus>
) {
  const campaignId = quest.campaignId ?? "0"
  const isCampaign = campaignId !== "0"
  const campaignKey = isCampaign ? campaignKeyOf(campaignId) : null
  const rewardAmount = quest.rewardAmount ?? "0"
  const expiry = quest.expiry ?? 0
  return {
    questId: quest.questId,
    title: quest.title || `Quest #${quest.questId}`,
    description: quest.description ?? "",
    cadence: quest.cadence ?? "open",
    category: CATEGORY_LABELS[quest.category ?? 0] ?? "Other",
    status: STATUS_LABELS[quest.status ?? 0] ?? "Unknown",
    statusValue: quest.status ?? 0,
    participant: quest.participant,
    protocol: quest.protocol ?? "",
    metadataURI: quest.metadataURI ?? "",
    rewardToken: quest.rewardToken ?? "",
    rewardAmount,
    rewardVael: formatUnits(rewardAmount, 18),
    badgeLevel: quest.badgeLevel ?? 1,
    expiry,
    // QuestManager refuses to accept or complete a quest past its expiry, so a card for one is a
    // card for something nobody can do. Zero means the quest never expires.
    expired: expiry !== 0 && expiry < Math.floor(Date.now() / 1000),
    createdAt: quest.createdAtChain ?? 0,
    sourceChainKey: quest.sourceChainKey,
    campaignId,
    campaignKey,
    // Whether the pool this quest draws on can still pay. A quest whose campaign was refunded is
    // on chain and Active, and would pay nothing: the board hides it and the campaign's own page
    // says why.
    campaignStatus: campaignKey ? (pools?.get(campaignKey) ?? null) : null,
    // Decided in docs/SPEC.md section 17.1: a campaign quest is paid by the partner's escrow and
    // an ordinary quest by RewardVault. Never both.
    fundedBy: isCampaign ? ("escrow" as const) : ("vault" as const),
    accepted: quest.accepted,
    completed: quest.completed,
    acceptedCount: quest.acceptedCount ?? 0,
    completedCount: quest.completedCount ?? 0,
    // Copied out of the pinned metadata at index time, so a card does not fetch an IPFS gateway
    // per quest to find out whether it has a picture.
    ...(quest.image ? { image: quest.image } : {}),
    /** What the player has to do for this quest to pay, and where. */
    action: {
      actionType: quest.actionType,
      actionName: ACTION_LABELS[quest.actionType] ?? `Action ${quest.actionType}`,
      emitter: quest.emitter,
      token: quest.token,
      tokenSymbol: tokenInfo(quest.token)?.symbol ?? null,
      minAmount: quest.minAmount,
      minAmountLabel: minAmountLabel(quest.minAmount, quest.token, quest.actionType),
      // Which chain the action happens on, and which contract can therefore complete the quest.
      // Both follow from the action type, which the chain fixed at creation.
      chain: quest.actionType >= FIRST_NATIVE_ACTION ? "Creditcoin" : "Ethereum Sepolia",
      settledBy: quest.actionType >= FIRST_NATIVE_ACTION ? "NativePortal" : "QuestASC",
    },
    proof,
  }
}

async function readState(store: WorkerStore) {
  const [actions, submissions] = await Promise.all([store.actions(), store.allSubmissions()])
  return { actions, submissions }
}

/**
 * GET /quests
 *
 * The quest board. `?participant=0x…` narrows it to one address, `?cadence=` to one kind.
 */
catalogRouter.get("/quests", async (req, res, next) => {
  try {
    const participant = String(req.query.participant ?? "")
    const cadence = String(req.query.cadence ?? "")
    const filter: { participant?: string; cadence?: "daily" | "weekly" | "campaign" | "open" } = {}
    if (/^0x[a-fA-F0-9]{40}$/.test(participant)) filter.participant = participant
    if (cadence === "daily" || cadence === "weekly" || cadence === "campaign" || cadence === "open") {
      filter.cadence = cadence
    }

    const store = createWorkerStore()
    await store.init()
    const [quests, state, pools] = await Promise.all([
      store.questCatalog(filter),
      readState(store),
      poolStatuses(store),
    ])

    return res.json({
      quests: quests.map((quest) =>
        serialize(quest, proofStateOf(quest.questId, state.actions, state.submissions), pools)
      ),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /quests/:id
 *
 * One quest, with the same shape as the list plus whatever the index knows about its proof.
 */
catalogRouter.get("/quests/:id", async (req, res, next) => {
  try {
    const questId = Number(req.params.id)
    if (!Number.isInteger(questId) || questId <= 0) {
      return res.status(400).json({ message: "Invalid quest id" })
    }

    const store = createWorkerStore()
    await store.init()
    const [quests, state] = await Promise.all([store.questCatalog(), readState(store)])
    const quest = quests.find((entry) => entry.questId === questId)
    if (!quest) return res.status(404).json({ message: `Quest ${questId} is not indexed` })

    return res.json({
      quest: serialize(
        quest,
        proofStateOf(questId, state.actions, state.submissions),
        await poolStatuses(store)
      ),
    })
  } catch (error) {
    next(error)
  }
})

interface CampaignSummary extends IndexedCampaign {
  balance: string
  balanceVael: string
  questCount: number
  completedCount: number
  status: "funded" | "drained" | "refunded"
}

/** Attach the pool the escrow holds now, plus the quests that draw on it. */
async function summarize(
  campaigns: IndexedCampaign[],
  quests: CataloguedQuest[]
): Promise<CampaignSummary[]> {
  const held = await Promise.all(campaigns.map((campaign) => campaignBalance(campaign.campaignKey)))

  return Promise.all(
    campaigns.map(async (campaign, i) => {
      const balance = held[i] ?? "0"
    // Oldest first, so "the first quest" below is the one the pool was published with.
    const mine = quests
      .filter((quest) => quest.campaignId && campaignKeyOf(quest.campaignId) === campaign.campaignKey)
      .sort((a, b) => a.questId - b.questId)

    // A pool must have received at least what has left it plus what is still in it. The index can
    // be short of the deposit when its cursor starts after the funding transaction, which is the
    // case for every pool funded before the index's first block, so the larger of the two is used
    // rather than a figure that is knowably too small.
    const accountedFor =
      BigInt(campaign.released) + BigInt(campaign.refunded) + BigInt(balance)
    const deposited =
      accountedFor > BigInt(campaign.deposited) ? accountedFor.toString() : campaign.deposited

    // CampaignEscrow stores a bytes32 key and no name. A pool's name is the one its partner pinned
    // for it through /partner/campaign/:id/metadata; a pool that was never named is called after
    // the first quest it was published with, which carries the metadata the partner pinned then.
    // Only a pool with no quests at all is left to its key, and a card shows that as what it is.
    // The earlier rule, a name only where every quest agreed on a title, went blank the moment a
    // fourth quest with its own title joined a pool of three.
    const title = campaign.title ?? mine.find((quest) => quest.title)?.title

      // Which protocol this pool's quests target, and whether the chain's own allowlist agrees it
      // is that protocol's contract. Claimed only when every quest in the pool points at the same
      // one: a pool whose quests target three protocols is not one protocol's campaign.
      const protocols = await Promise.all(
        mine.map((quest) =>
          verifiedProtocolFor(quest.emitter, quest.actionType, quest.sourceChainKey)
        )
      )
      const named = protocols.filter((p): p is NonNullable<typeof p> => !!p)
      const slugs = new Set(named.map((p) => p.slug))
      const protocol =
        named.length === protocols.length && slugs.size === 1 && named.length > 0
          ? { name: named[0]!.name, slug: named[0]!.slug, verified: named.every((p) => p.verified) }
          : undefined

    return {
      ...campaign,
      ...(title ? { title } : {}),
      ...(protocol ? { protocol } : {}),
      // Who put the money in. A pool funded by Vael's own deployer is a demonstration of the
      // mechanism, not a third party paying for attention, and a card that did not say so would be
      // implying a partnership that does not exist.
      selfFunded:
        !!process.env.DEPLOYER_ADDRESS &&
        campaign.partner.toLowerCase() === process.env.DEPLOYER_ADDRESS.toLowerCase(),
      // The pool's own picture where its partner pinned one; otherwise its quests', which share
      // one when published together. Borrowing it is how a partner card gets a background without
      // inventing one.
      ...(campaign.image ?? mine.find((quest) => quest.image)?.image
        ? { image: campaign.image ?? mine.find((quest) => quest.image)!.image }
        : {}),
      deposited,
      balance,
      balanceVael: formatUnits(balance, 18),
      questCount: mine.length,
      completedCount: mine.filter((quest) => quest.completed).length,
      status: poolStatus(campaign, balance),
    }
    })
  )
}

/**
 * GET /campaigns
 *
 * Every pool CampaignEscrow has ever held money for. `?partner=0x…` narrows it to one depositor,
 * `?status=funded` to the ones that can still pay.
 */
catalogRouter.get("/campaigns", async (req, res, next) => {
  try {
    const partner = String(req.query.partner ?? "").toLowerCase()
    const status = String(req.query.status ?? "")

    const store = createWorkerStore()
    await store.init()
    const [indexed, quests] = await Promise.all([store.campaigns(), store.questCatalog()])

    let campaigns = await summarize(indexed, quests)
    if (/^0x[a-f0-9]{40}$/.test(partner)) {
      campaigns = campaigns.filter((campaign) => campaign.partner === partner)
    }
    if (status === "funded" || status === "drained" || status === "refunded") {
      campaigns = campaigns.filter((campaign) => campaign.status === status)
    }

    return res.json({ campaigns })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /campaigns/:key
 *
 * One pool and the quests that draw on it, by its bytes32 escrow key.
 */
catalogRouter.get("/campaigns/:key", async (req, res, next) => {
  try {
    const key = String(req.params.key).toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(key)) {
      return res.status(400).json({ message: "Invalid campaign key" })
    }

    const store = createWorkerStore()
    await store.init()
    const [indexed, quests, state] = await Promise.all([
      store.campaigns(),
      store.questCatalog(),
      readState(store),
    ])
    const found = indexed.find((campaign) => campaign.campaignKey === key)
    if (!found) return res.status(404).json({ message: "No indexed campaign with that key" })

    const [campaign] = await summarize([found], quests)
    const mine = quests.filter(
      (quest) => quest.campaignId && campaignKeyOf(quest.campaignId) === key
    )
    const pools = new Map<string, PoolStatus>([[key, campaign!.status]])

    return res.json({
      campaign,
      quests: mine.map((quest) =>
        serialize(quest, proofStateOf(quest.questId, state.actions, state.submissions), pools)
      ),
    })
  } catch (error) {
    next(error)
  }
})
