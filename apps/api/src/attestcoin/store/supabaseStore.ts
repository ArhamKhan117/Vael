import { createClient, SupabaseClient } from "@supabase/supabase-js"

import {
  AcademyProgress,
  CataloguedQuest,
  IndexedAction,
  IndexedBadge,
  IndexedCampaign,
  IndexedChallenge,
  IndexedDrop,
  IndexedEquipmentEvent,
  IndexedListing,
  IndexedHero,
  IndexedQuest,
  IndexedRaidHit,
  IndexedReward,
  PENDING_STATUSES,
  QuestCadence,
  QuestCatalogFields,
  ProofSubmission,
  WorkerCursor,
  WorkerStore,
  submissionId,
} from "./types"

/** Row shape of `proof_submissions`, which is snake_case in the database. */
interface Row {
  id: string
  quest_id_on_chain: number
  participant: string
  source_chain_key: number
  source_tx_hash: string
  source_block: number | null
  action_type: number | null
  status: string
  query_id: string | null
  creditcoin_tx_hash: string | null
  error: string | null
  attempts: number
  created_at: string
  updated_at: string
}

function toDomain(row: Row): ProofSubmission {
  const submission: ProofSubmission = {
    id: row.id,
    questIdOnChain: row.quest_id_on_chain,
    participant: row.participant,
    sourceChainKey: row.source_chain_key,
    sourceTxHash: row.source_tx_hash,
    sourceBlock: row.source_block ?? 0,
    actionType: row.action_type ?? 0,
    status: row.status as ProofSubmission["status"],
    attempts: row.attempts ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (row.query_id) submission.queryId = row.query_id
  if (row.creditcoin_tx_hash) submission.creditcoinTxHash = row.creditcoin_tx_hash
  if (row.error) submission.error = row.error
  return submission
}

/**
 * Supabase-backed store, using the `proof_submissions` and `worker_cursors` tables from the
 * Attestcoin migration.
 *
 * Chain state remains the source of truth: everything here is a cache the indexer could rebuild.
 * What it buys is that a restarted worker knows which source transactions it had already seen.
 */
export class SupabaseWorkerStore implements WorkerStore {
  readonly kind = "supabase" as const

  private readonly client: SupabaseClient

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async init(): Promise<void> {
    const { error } = await this.client.from("proof_submissions").select("id").limit(1)
    if (error) {
      throw new Error(
        `proof_submissions is not reachable: ${error.message}. ` +
          "Run apps/api/database/migrations/add_attestcoin_tables.sql."
      )
    }
  }

  async upsertSubmission(
    input: Omit<ProofSubmission, "id" | "createdAt" | "updatedAt" | "attempts"> &
      Partial<Pick<ProofSubmission, "attempts">>
  ): Promise<ProofSubmission> {
    const id = submissionId(input.sourceChainKey, input.sourceTxHash, input.questIdOnChain)

    const existing = await this.getSubmission(id)
    if (existing) return existing

    const { data, error } = await this.client
      .from("proof_submissions")
      .insert({
        id,
        quest_id_on_chain: input.questIdOnChain,
        participant: input.participant.toLowerCase(),
        source_chain_key: input.sourceChainKey,
        source_tx_hash: input.sourceTxHash,
        source_block: input.sourceBlock,
        action_type: input.actionType,
        status: input.status,
        attempts: input.attempts ?? 0,
      })
      .select()
      .single()

    if (error) {
      // A concurrent worker may have inserted the same row; take theirs.
      const raced = await this.getSubmission(id)
      if (raced) return raced
      throw new Error(`failed to insert submission: ${error.message}`)
    }
    return toDomain(data as Row)
  }

  async updateSubmission(id: string, patch: Partial<ProofSubmission>): Promise<ProofSubmission> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.status !== undefined) update.status = patch.status
    if (patch.queryId !== undefined) update.query_id = patch.queryId
    if (patch.creditcoinTxHash !== undefined) update.creditcoin_tx_hash = patch.creditcoinTxHash
    if (patch.error !== undefined) update.error = patch.error
    if (patch.attempts !== undefined) update.attempts = patch.attempts
    if (patch.sourceBlock !== undefined) update.source_block = patch.sourceBlock

    const { data, error } = await this.client
      .from("proof_submissions")
      .update(update)
      .eq("id", id)
      .select()
      .single()
    if (error) throw new Error(`failed to update submission ${id}: ${error.message}`)
    return toDomain(data as Row)
  }

  async pendingSubmissions(): Promise<ProofSubmission[]> {
    const { data, error } = await this.client
      .from("proof_submissions")
      .select("*")
      .in("status", PENDING_STATUSES)
      .order("created_at", { ascending: true })
    if (error) throw new Error(`failed to read pending submissions: ${error.message}`)
    return (data as Row[]).map(toDomain)
  }

  async getSubmission(id: string): Promise<ProofSubmission | undefined> {
    const { data } = await this.client.from("proof_submissions").select("*").eq("id", id).maybeSingle()
    return data ? toDomain(data as Row) : undefined
  }

  async allSubmissions(): Promise<ProofSubmission[]> {
    const { data, error } = await this.client
      .from("proof_submissions")
      .select("*")
      .order("created_at", { ascending: true })
    if (error) throw new Error(`failed to read submissions: ${error.message}`)
    return (data as Row[]).map(toDomain)
  }

  async getCursor(chainKey: number, emitter: string): Promise<WorkerCursor | undefined> {
    const { data } = await this.client
      .from("worker_cursors")
      .select("*")
      .eq("chain_key", chainKey)
      .eq("emitter", emitter.toLowerCase())
      .maybeSingle()
    if (!data) return undefined
    return {
      chainKey: data.chain_key,
      emitter: data.emitter,
      lastBlock: Number(data.last_block),
      updatedAt: data.updated_at,
    }
  }

  async setCursor(chainKey: number, emitter: string, lastBlock: number): Promise<void> {
    const { error } = await this.client.from("worker_cursors").upsert(
      {
        chain_key: chainKey,
        emitter: emitter.toLowerCase(),
        last_block: lastBlock,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chain_key,emitter" }
    )
    if (error) throw new Error(`failed to write cursor: ${error.message}`)
  }

  // ---------------------------------------------------------------- index

  async upsertQuest(quest: IndexedQuest): Promise<void> {
    const { error } = await this.client.from("indexed_quests").upsert(
      {
        quest_id: quest.questId,
        participant: quest.participant.toLowerCase(),
        source_chain_key: quest.sourceChainKey,
        action_type: quest.actionType,
        emitter: quest.emitter.toLowerCase(),
        token: quest.token.toLowerCase(),
        min_amount: quest.minAmount,
        accepted_at_source_height: quest.acceptedAtSourceHeight ?? null,
        accepted: quest.accepted,
        completed: quest.completed,
        updated_at: quest.updatedAt,
      },
      { onConflict: "quest_id" }
    )
    if (error) throw new Error(`failed to index quest ${quest.questId}: ${error.message}`)
  }

  async getQuest(questId: number): Promise<IndexedQuest | undefined> {
    const { data } = await this.client
      .from("indexed_quests")
      .select("*")
      .eq("quest_id", questId)
      .maybeSingle()
    return data ? questFromRow(data) : undefined
  }

  async openQuestsFor(participant: string): Promise<IndexedQuest[]> {
    const { data, error } = await this.client
      .from("indexed_quests")
      .select("*")
      .eq("participant", participant.toLowerCase())
      .eq("accepted", true)
      .eq("completed", false)
      .order("updated_at", { ascending: false })
    if (error) throw new Error(`failed to read open quests: ${error.message}`)
    return (data ?? []).map(questFromRow)
  }

  async allQuests(): Promise<IndexedQuest[]> {
    const { data, error } = await this.client.from("indexed_quests").select("*")
    if (error) throw new Error(`failed to read quests: ${error.message}`)
    return (data ?? []).map(questFromRow)
  }

  async upsertQuestCatalog(questId: number, fields: QuestCatalogFields): Promise<void> {
    // Only the catalog half is written. PostgREST updates exactly the columns it is given, so the
    // worker's matching half of the same row survives untouched.
    const { error } = await this.client.from("indexed_quests").upsert(
      {
        quest_id: questId,
        participant: fields.assignedParticipant.toLowerCase(),
        category: fields.category,
        protocol: fields.protocol.toLowerCase(),
        metadata_uri: fields.metadataURI,
        reward_token: fields.rewardToken.toLowerCase(),
        reward_amount: fields.rewardAmount,
        badge_level: fields.badgeLevel,
        status: fields.status,
        expiry: fields.expiry,
        created_at_chain: fields.createdAtChain,
        campaign_id: fields.campaignId,
        accepted_count: fields.acceptedCount,
        completed_count: fields.completedCount,
        title: fields.title,
        description: fields.description,
        cadence: fields.cadence,
        creditcoin_block: fields.creditcoinBlock,
        catalogued: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "quest_id" }
    )
    if (error) throw new Error(`failed to catalogue quest ${questId}: ${error.message}`)
  }

  async questCatalog(filter?: {
    participant?: string
    cadence?: QuestCadence
    campaignId?: string
  }): Promise<CataloguedQuest[]> {
    let query = this.client
      .from("indexed_quests")
      .select("*")
      .eq("catalogued", true)
      .order("quest_id", { ascending: false })
    if (filter?.participant) query = query.eq("participant", filter.participant.toLowerCase())
    if (filter?.cadence) query = query.eq("cadence", filter.cadence)
    if (filter?.campaignId) query = query.eq("campaign_id", filter.campaignId)
    const { data, error } = await query
    if (error) throw new Error(`failed to read the quest catalog: ${error.message}`)
    return (data ?? []).map(catalogFromRow)
  }

  async upsertCampaign(
    campaign: Pick<IndexedCampaign, "campaignKey"> & Partial<Omit<IndexedCampaign, "campaignKey">>
  ): Promise<void> {
    const key = campaign.campaignKey.toLowerCase()
    const row: Record<string, unknown> = { campaign_key: key, updated_at: new Date().toISOString() }
    if (campaign.campaignId !== undefined) row.campaign_id = campaign.campaignId
    if (campaign.title !== undefined) row.title = campaign.title
    if (campaign.partner !== undefined) row.partner = campaign.partner.toLowerCase()
    if (campaign.deposited !== undefined) row.deposited = campaign.deposited
    if (campaign.released !== undefined) row.released = campaign.released
    if (campaign.refunded !== undefined) row.refunded = campaign.refunded
    if (campaign.firstSeenBlock !== undefined) row.first_seen_block = campaign.firstSeenBlock
    if (campaign.lastBlock !== undefined) row.last_block = campaign.lastBlock
    if (campaign.lastLogIndex !== undefined) row.last_log_index = campaign.lastLogIndex
    const { error } = await this.client
      .from("indexed_campaigns")
      .upsert(row, { onConflict: "campaign_key" })
    if (error) throw new Error(`failed to index campaign ${key}: ${error.message}`)
  }

  async campaigns(): Promise<IndexedCampaign[]> {
    const { data, error } = await this.client
      .from("indexed_campaigns")
      .select("*")
      .order("first_seen_block", { ascending: false })
    if (error) throw new Error(`failed to read campaigns: ${error.message}`)
    return (data ?? []).map(campaignFromRow)
  }

  async getCampaign(campaignKey: string): Promise<IndexedCampaign | undefined> {
    const { data } = await this.client
      .from("indexed_campaigns")
      .select("*")
      .eq("campaign_key", campaignKey.toLowerCase())
      .maybeSingle()
    return data ? campaignFromRow(data) : undefined
  }

  async upsertHero(hero: IndexedHero): Promise<void> {
    const { error } = await this.client.from("hero_snapshots").upsert(
      {
        address: hero.player.toLowerCase(),
        token_id: hero.tokenId,
        level: hero.level,
        xp: hero.xp,
        strength: hero.strength,
        agility: hero.agility,
        intellect: hero.intellect,
        streak: hero.streak,
        updated_at: hero.updatedAt,
      },
      { onConflict: "address" }
    )
    if (error) throw new Error(`failed to index hero: ${error.message}`)
  }

  async getHero(player: string): Promise<IndexedHero | undefined> {
    const { data } = await this.client
      .from("hero_snapshots")
      .select("*")
      .eq("address", player.toLowerCase())
      .maybeSingle()
    return data ? heroFromRow(data) : undefined
  }

  async allHeroes(): Promise<IndexedHero[]> {
    const { data, error } = await this.client.from("hero_snapshots").select("*")
    if (error) throw new Error(`failed to read heroes: ${error.message}`)
    return (data ?? []).map(heroFromRow)
  }

  async addRaidHit(hit: IndexedRaidHit): Promise<void> {
    // The replay key makes a hit idempotent, so a re-scan of the same range cannot double-count.
    const { error } = await this.client.from("raid_damage").upsert(
      {
        season_id: hit.seasonId,
        player: hit.player.toLowerCase(),
        damage: hit.damage,
        query_id: hit.replayKey,
        creditcoin_tx_hash: null,
        created_at: hit.createdAt,
      },
      { onConflict: "season_id,query_id" }
    )
    if (error) throw new Error(`failed to index raid hit: ${error.message}`)
  }

  async raidHits(seasonId: number): Promise<IndexedRaidHit[]> {
    const { data, error } = await this.client
      .from("raid_damage")
      .select("*")
      .eq("season_id", seasonId)
      .order("created_at", { ascending: false })
    if (error) throw new Error(`failed to read raid hits: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      seasonId: row.season_id,
      player: row.player,
      damage: String(row.damage),
      hpRemaining: "0",
      actionType: 0,
      replayKey: row.query_id,
      creditcoinBlock: 0,
      createdAt: row.created_at,
    }))
  }

  async addAction(action: IndexedAction): Promise<void> {
    // The replay key is unique on chain, so a rescan of the same range is a no-op here.
    const { error } = await this.client.from("verified_actions").upsert(
      {
        replay_key: action.replayKey,
        quest_id: action.questId,
        player: action.player.toLowerCase(),
        action_type: action.actionType,
        source_block: action.sourceBlock,
        amount: action.amount,
        creditcoin_block: action.creditcoinBlock,
        created_at: action.createdAt,
      },
      { onConflict: "replay_key" }
    )
    if (error) throw new Error(`failed to index verified action: ${error.message}`)
  }

  async actions(player?: string): Promise<IndexedAction[]> {
    let query = this.client
      .from("verified_actions")
      .select("*")
      .order("creditcoin_block", { ascending: false })
    if (player) query = query.eq("player", player.toLowerCase())
    const { data, error } = await query
    if (error) throw new Error(`failed to read verified actions: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      replayKey: row.replay_key,
      questId: Number(row.quest_id),
      player: row.player,
      actionType: Number(row.action_type),
      sourceBlock: Number(row.source_block),
      amount: String(row.amount ?? "0"),
      creditcoinBlock: Number(row.creditcoin_block),
      createdAt: row.created_at,
    }))
  }

  async addReward(reward: IndexedReward): Promise<void> {
    const { error } = await this.client.from("reward_releases").upsert(
      {
        id: reward.id,
        quest_id: reward.questId,
        recipient: reward.recipient.toLowerCase(),
        amount: reward.amount,
        creditcoin_block: reward.creditcoinBlock,
        creditcoin_tx_hash: reward.creditcoinTxHash,
        created_at: reward.createdAt,
      },
      { onConflict: "id" }
    )
    if (error) throw new Error(`failed to index reward release: ${error.message}`)
  }

  async addBadge(badge: IndexedBadge): Promise<void> {
    const { error } = await this.client.from("indexed_badges").upsert(
      {
        token_id: badge.tokenId,
        player: badge.player.toLowerCase(),
        quest_id: badge.questId,
        badge_level: badge.badgeLevel,
        rarity: badge.rarity,
        rarity_is_derived: badge.rarityIsDerived,
        creditcoin_block: badge.creditcoinBlock,
        created_at: badge.createdAt,
      },
      { onConflict: "token_id" }
    )
    if (error) throw new Error(`failed to index badge: ${error.message}`)
  }

  async badges(player?: string): Promise<IndexedBadge[]> {
    let query = this.client.from("indexed_badges").select("*").order("token_id", { ascending: false })
    if (player) query = query.eq("player", player.toLowerCase())
    const { data, error } = await query
    if (error) throw new Error(`failed to read badges: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      tokenId: Number(row.token_id),
      player: row.player,
      questId: Number(row.quest_id),
      badgeLevel: Number(row.badge_level),
      rarity: Number(row.rarity),
      rarityIsDerived: Boolean(row.rarity_is_derived),
      creditcoinBlock: Number(row.creditcoin_block),
      createdAt: row.created_at,
    }))
  }

  async upsertChallenge(challenge: IndexedChallenge): Promise<void> {
    const { error } = await this.client.from("arena_challenges").upsert(
      {
        challenge_id: challenge.challengeId,
        challenger: challenge.challenger.toLowerCase(),
        opponent: challenge.opponent.toLowerCase(),
        stake: challenge.stake,
        status: challenge.status,
        winner: challenge.winner ?? null,
        payout: challenge.payout ?? null,
        burned: challenge.burned ?? null,
        seed: challenge.seed ?? null,
        rounds: challenge.rounds ?? null,
        opened_at_block: challenge.openedAtBlock,
        accepted_at_block: challenge.acceptedAtBlock ?? null,
        resolved_at_block: challenge.resolvedAtBlock ?? null,
        updated_at: challenge.updatedAt,
      },
      { onConflict: "challenge_id" }
    )
    if (error) throw new Error(`failed to index challenge: ${error.message}`)
  }

  async getChallenge(challengeId: number): Promise<IndexedChallenge | undefined> {
    const { data, error } = await this.client
      .from("arena_challenges")
      .select("*")
      .eq("challenge_id", challengeId)
      .maybeSingle()
    if (error) throw new Error(`failed to read challenge: ${error.message}`)
    return data ? challengeFromRow(data) : undefined
  }

  async challenges(filter?: { address?: string; status?: string }): Promise<IndexedChallenge[]> {
    let query = this.client.from("arena_challenges").select("*").order("challenge_id", { ascending: false })
    if (filter?.status) query = query.eq("status", filter.status)
    if (filter?.address) {
      const who = filter.address.toLowerCase()
      query = query.or(`challenger.eq.${who},opponent.eq.${who}`)
    }
    const { data, error } = await query
    if (error) throw new Error(`failed to read challenges: ${error.message}`)
    return (data ?? []).map(challengeFromRow)
  }

  async addDrop(drop: IndexedDrop): Promise<void> {
    const { error } = await this.client.from("loot_drops").upsert(
      {
        id: drop.id,
        player: drop.player.toLowerCase(),
        item_id: drop.itemId,
        rarity: drop.rarity,
        reason: drop.reason,
        season_id: drop.seasonId ?? null,
        share_bps: drop.shareBps ?? null,
        creditcoin_block: drop.creditcoinBlock,
        creditcoin_tx_hash: drop.creditcoinTxHash,
        created_at: drop.createdAt,
      },
      { onConflict: "id" }
    )
    if (error) throw new Error(`failed to index drop: ${error.message}`)
  }

  async drops(player?: string): Promise<IndexedDrop[]> {
    let query = this.client.from("loot_drops").select("*").order("creditcoin_block", { ascending: false })
    if (player) query = query.eq("player", player.toLowerCase())
    const { data, error } = await query
    if (error) throw new Error(`failed to read drops: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      player: row.player,
      itemId: Number(row.item_id),
      rarity: Number(row.rarity),
      reason: row.reason,
      ...(row.season_id != null ? { seasonId: Number(row.season_id) } : {}),
      ...(row.share_bps != null ? { shareBps: Number(row.share_bps) } : {}),
      creditcoinBlock: Number(row.creditcoin_block),
      creditcoinTxHash: row.creditcoin_tx_hash,
      createdAt: row.created_at,
    }))
  }

  async addEquipmentEvent(event: IndexedEquipmentEvent): Promise<void> {
    const { error } = await this.client.from("equipment_events").upsert(
      {
        id: event.id,
        hero_token_id: event.heroTokenId,
        slot: event.slot,
        item_id: event.itemId,
        owner: event.owner.toLowerCase(),
        equipped: event.equipped,
        creditcoin_block: event.creditcoinBlock,
        created_at: event.createdAt,
      },
      { onConflict: "id" }
    )
    if (error) throw new Error(`failed to index equipment event: ${error.message}`)
  }

  async equipmentEvents(heroTokenId?: number): Promise<IndexedEquipmentEvent[]> {
    let query = this.client
      .from("equipment_events")
      .select("*")
      .order("creditcoin_block", { ascending: false })
    if (heroTokenId !== undefined) query = query.eq("hero_token_id", heroTokenId)
    const { data, error } = await query
    if (error) throw new Error(`failed to read equipment events: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      heroTokenId: Number(row.hero_token_id),
      slot: Number(row.slot),
      itemId: Number(row.item_id),
      owner: row.owner,
      equipped: Boolean(row.equipped),
      creditcoinBlock: Number(row.creditcoin_block),
      createdAt: row.created_at,
    }))
  }

  async upsertListing(listing: IndexedListing): Promise<void> {
    const { error } = await this.client.from("market_listings").upsert(
      {
        listing_id: listing.listingId,
        seller: listing.seller.toLowerCase(),
        item_id: listing.itemId,
        amount: listing.amount,
        price: listing.price,
        status: listing.status,
        buyer: listing.buyer ?? null,
        fee: listing.fee ?? null,
        listed_at_block: listing.listedAtBlock,
        closed_at_block: listing.closedAtBlock ?? null,
        updated_at: listing.updatedAt,
      },
      { onConflict: "listing_id" }
    )
    if (error) throw new Error(`failed to index listing: ${error.message}`)
  }

  async getListing(listingId: number): Promise<IndexedListing | undefined> {
    const { data, error } = await this.client
      .from("market_listings")
      .select("*")
      .eq("listing_id", listingId)
      .maybeSingle()
    if (error) throw new Error(`failed to read listing: ${error.message}`)
    return data ? listingFromRow(data) : undefined
  }

  async listings(filter?: { status?: string; seller?: string }): Promise<IndexedListing[]> {
    let query = this.client.from("market_listings").select("*").order("listing_id", { ascending: false })
    if (filter?.status) query = query.eq("status", filter.status)
    if (filter?.seller) query = query.eq("seller", filter.seller.toLowerCase())
    const { data, error } = await query
    if (error) throw new Error(`failed to read listings: ${error.message}`)
    return (data ?? []).map(listingFromRow)
  }

  async getAcademyProgress(player: string): Promise<AcademyProgress | undefined> {
    const { data, error } = await this.client
      .from("academy_progress")
      .select("*")
      .eq("player", player.toLowerCase())
      .maybeSingle()
    if (error) throw new Error(`failed to read academy progress: ${error.message}`)
    if (!data) return undefined
    return {
      player: data.player,
      modules: (data.modules ?? {}) as AcademyProgress["modules"],
      updatedAt: data.updated_at,
    }
  }

  async saveAcademyProgress(progress: AcademyProgress): Promise<void> {
    const { error } = await this.client.from("academy_progress").upsert(
      {
        player: progress.player.toLowerCase(),
        modules: progress.modules,
        updated_at: progress.updatedAt,
      },
      { onConflict: "player" }
    )
    if (error) throw new Error(`failed to save academy progress: ${error.message}`)
  }

  async allRewards(): Promise<IndexedReward[]> {
    const { data, error } = await this.client.from("reward_releases").select("*")
    if (error) throw new Error(`failed to read reward releases: ${error.message}`)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      questId: Number(row.quest_id),
      recipient: row.recipient,
      amount: String(row.amount ?? "0"),
      creditcoinBlock: Number(row.creditcoin_block),
      creditcoinTxHash: row.creditcoin_tx_hash,
      createdAt: row.created_at,
    }))
  }
}

function questFromRow(row: any): IndexedQuest {
  const quest: IndexedQuest = {
    questId: row.quest_id,
    participant: row.participant,
    sourceChainKey: row.source_chain_key,
    actionType: row.action_type,
    emitter: row.emitter,
    token: row.token,
    minAmount: String(row.min_amount ?? "0"),
    accepted: Boolean(row.accepted),
    completed: Boolean(row.completed),
    updatedAt: row.updated_at,
  }
  if (row.accepted_at_source_height != null) {
    quest.acceptedAtSourceHeight = Number(row.accepted_at_source_height)
  }
  return quest
}

function catalogFromRow(row: any): CataloguedQuest {
  const quest = questFromRow(row) as CataloguedQuest
  quest.catalogued = Boolean(row.catalogued)
  if (!quest.catalogued) return quest
  quest.category = Number(row.category ?? 0)
  quest.protocol = row.protocol ?? ""
  quest.metadataURI = row.metadata_uri ?? ""
  quest.rewardToken = row.reward_token ?? ""
  quest.rewardAmount = String(row.reward_amount ?? "0")
  quest.badgeLevel = Number(row.badge_level ?? 1)
  quest.status = Number(row.status ?? 1)
  quest.expiry = Number(row.expiry ?? 0)
  quest.createdAtChain = Number(row.created_at_chain ?? 0)
  quest.campaignId = String(row.campaign_id ?? "0")
  quest.acceptedCount = Number(row.accepted_count ?? 0)
  quest.completedCount = Number(row.completed_count ?? 0)
  quest.title = row.title ?? ""
  quest.description = row.description ?? ""
  quest.cadence = (row.cadence ?? "open") as QuestCadence
  quest.creditcoinBlock = Number(row.creditcoin_block ?? 0)
  return quest
}

function campaignFromRow(row: any): IndexedCampaign {
  const campaign: IndexedCampaign = {
    campaignKey: row.campaign_key,
    partner: row.partner ?? "",
    deposited: String(row.deposited ?? "0"),
    released: String(row.released ?? "0"),
    refunded: String(row.refunded ?? "0"),
    firstSeenBlock: Number(row.first_seen_block ?? 0),
    lastBlock: Number(row.last_block ?? -1),
    lastLogIndex: Number(row.last_log_index ?? -1),
    updatedAt: row.updated_at,
  }
  if (row.campaign_id) campaign.campaignId = row.campaign_id
  if (row.title) campaign.title = row.title
  return campaign
}

function heroFromRow(row: any): IndexedHero {
  return {
    player: row.address,
    tokenId: Number(row.token_id ?? 0),
    level: Number(row.level ?? 1),
    xp: String(row.xp ?? "0"),
    strength: Number(row.strength ?? 0),
    agility: Number(row.agility ?? 0),
    intellect: Number(row.intellect ?? 0),
    streak: Number(row.streak ?? 0),
    updatedAt: row.updated_at,
  }
}

function challengeFromRow(row: any): IndexedChallenge {
  const challenge: IndexedChallenge = {
    challengeId: Number(row.challenge_id),
    challenger: row.challenger,
    opponent: row.opponent,
    stake: String(row.stake ?? "0"),
    status: row.status,
    openedAtBlock: Number(row.opened_at_block),
    updatedAt: row.updated_at,
  }
  if (row.winner) challenge.winner = row.winner
  if (row.payout != null) challenge.payout = String(row.payout)
  if (row.burned != null) challenge.burned = String(row.burned)
  if (row.seed) challenge.seed = row.seed
  if (row.rounds) challenge.rounds = row.rounds
  if (row.accepted_at_block != null) challenge.acceptedAtBlock = Number(row.accepted_at_block)
  if (row.resolved_at_block != null) challenge.resolvedAtBlock = Number(row.resolved_at_block)
  return challenge
}

function listingFromRow(row: any): IndexedListing {
  const listing: IndexedListing = {
    listingId: Number(row.listing_id),
    seller: row.seller,
    itemId: Number(row.item_id),
    amount: Number(row.amount),
    price: String(row.price ?? "0"),
    status: row.status,
    listedAtBlock: Number(row.listed_at_block),
    updatedAt: row.updated_at,
  }
  if (row.buyer) listing.buyer = row.buyer
  if (row.fee != null) listing.fee = String(row.fee)
  if (row.closed_at_block != null) listing.closedAtBlock = Number(row.closed_at_block)
  return listing
}
