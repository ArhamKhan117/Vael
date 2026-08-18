import { supabase } from "../lib/supabase"
import { generateUserAvatar } from "../utils/avatarGenerator"

export interface User {
  id: string
  wallet_address: string
  ens_name?: string
  nickname?: string
  avatar_url?: string
  join_date: string
}

export interface Campaign {
  id: string
  partner_wallet: string
  partner_name?: string | null
  title: string
  status: string
  template_type: "swap" | "deposit" | "borrow" | "stake" | "other"
  template_params: Record<string, unknown>
  pool_token: string
  pool_amount: string | number
  max_participants: number
  reward_per_quest_usdc: string | number
  vael_per_quest?: number | null
  escrow_address?: string | null
  escrow_tx_hash?: string | null
  participant_count: number
  claimed_count: number
  start_at?: string | null
  end_at?: string | null
  thumbnail?: string | null
  description?: string | null
  metadata_uri?: string | null
  created_at: string
  updated_at: string
}

export interface CampaignParticipant {
  id: string
  campaign_id: string
  participant_wallet: string
  quest_id_on_chain: number
  usdc_released: boolean
  created_at: string
}

export interface Quest {
  id: string
  quest_id_on_chain: number
  campaign_id?: string | null
  agent_id?: number
  agent_controller?: string
  title: string
  description?: string
  project_name?: string
  category?: string
  protocol_address?: string
  metadata_uri?: string
  parameters_hash?: string
  reward_per_participant?: string
  badge_level?: number
  assigned_participant?: string
  expiry_timestamp?: number
  accepted_at?: string | null
  status: string
  quest_type?: "daily" | "weekly" | "custom"
  /** Attestcoin source chain key: 1 Sepolia, 3 Ethereum mainnet. */
  source_chain_key?: number
  created_at: string
}

export interface QuestSubmission {
  id: string
  quest_id_on_chain: number
  participant_address: string
  transaction_hash: string
  source_chain_key: number
  verification_status: string
  query_id?: string
  evidence_uri?: string
  completion_tx_hash?: string
  created_at: string
}

export interface UserXPEntry {
  id: string
  user_id: string
  wallet_address: string
  quest_id_on_chain: number
  xp_amount: number
  reward_amount?: string
  badge_token_id?: number
  completion_tx_hash?: string
  created_at: string
}

export interface UserStats {
  user_id: string
  wallet_address: string
  total_xp: number
  completed_quests: number
  level: number
  rank?: number
  updated_at: string
}

/**
 * Get or create user by wallet address
 */
export async function getOrCreateUser(walletAddress: string): Promise<User> {
  // Try to get existing user
  const { data: existingUser, error: getError } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .single()

  if (existingUser && !getError) {
    return existingUser as User
  }

  // Create new user if not found
  const { data: newUser, error: createError } = await supabase
    .from("users")
    .insert({
      wallet_address: walletAddress.toLowerCase(),
    })
    .select()
    .single()

  if (createError || !newUser) {
    throw new Error(`Failed to create user: ${createError?.message}`)
  }

  return newUser as User
}

/**
 * Save quest metadata to database after AI generation
 */
export async function saveQuest(questData: {
  quest_id_on_chain: number
  campaign_id?: string | null
  agent_id?: number
  agent_controller?: string
  title: string
  description?: string
  project_name?: string
  category?: string
  protocol_address?: string
  metadata_uri?: string
  parameters_hash?: string
  reward_per_participant?: string
  badge_level?: number
  assigned_participant?: string
  expiry_timestamp?: number
  status?: string
  quest_type?: "custom" | "daily" | "weekly"
}): Promise<Quest> {
  // Check if quest already exists
  const existingQuest = await getQuestByOnChainId(questData.quest_id_on_chain)
  
  if (existingQuest) {
    // Update existing quest instead of creating new one
    const { data, error } = await supabase
      .from("quests")
      .update({
        ...questData,
        assigned_participant: questData.assigned_participant?.toLowerCase(),
        protocol_address: questData.protocol_address?.toLowerCase(),
        status: questData.status || "active",
        quest_type: questData.quest_type || "custom",
        updated_at: new Date().toISOString(),
      })
      .eq("quest_id_on_chain", questData.quest_id_on_chain)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to update quest: ${error?.message}`)
    }

    return data as Quest
  }

  // Create new quest
  const { data, error } = await supabase
    .from("quests")
    .insert({
      ...questData,
      assigned_participant: questData.assigned_participant?.toLowerCase(),
      protocol_address: questData.protocol_address?.toLowerCase(),
      status: questData.status || "active",
      quest_type: questData.quest_type || "custom",
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to save quest: ${error?.message}`)
  }

  return data as Quest
}

/**
 * Get quest by on-chain quest ID
 */
export async function getQuestByOnChainId(questIdOnChain: number): Promise<Quest | null> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("quest_id_on_chain", questIdOnChain)
    .single()

  if (error || !data) {
    return null
  }

  return data as Quest
}

/**
 * Update accepted_at timestamp for quest (from on-chain events)
 */
export async function setQuestAcceptedAt(
  questIdOnChain: number,
  acceptedAtIso: string
): Promise<void> {
  const { error } = await supabase
    .from("quests")
    .update({
      accepted_at: acceptedAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq("quest_id_on_chain", questIdOnChain)

  if (error) {
    throw new Error(`Failed to update accepted_at: ${error.message}`)
  }
}

/**
 * Get expired daily/weekly quests (for expiry-driven regeneration)
 * Returns quests that are active, daily or weekly type, and past expiry_timestamp
 */
export async function getExpiredDailyWeeklyQuests(): Promise<Quest[]> {
  const now = Math.floor(Date.now() / 1000)
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("status", "active")
    .in("quest_type", ["daily", "weekly"])
    .lt("expiry_timestamp", now)

  if (error) {
    throw new Error(`Failed to get expired quests: ${error.message}`)
  }

  return (data || []) as Quest[]
}

/**
 * Mark quest as expired by quest_id_on_chain
 */
export async function markQuestExpired(questIdOnChain: number): Promise<void> {
  const { error } = await supabase
    .from("quests")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("quest_id_on_chain", questIdOnChain)

  if (error) {
    throw new Error(`Failed to mark quest expired: ${error.message}`)
  }
}

/**
 * Cron cursor helpers (for event polling)
 */
export async function getCronCursor(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("cron_state")
    .select("value")
    .eq("key", key)
    .single()

  if (error || !data) {
    return null
  }

  return data.value ?? null
}

export async function setCronCursor(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("cron_state")
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    throw new Error(`Failed to update cron cursor: ${error.message}`)
  }
}

/**
 * Save quest submission (tx hash proof)
 */
export async function saveQuestSubmission(submission: {
  quest_id_on_chain: number
  participant_address: string
  transaction_hash: string
  source_chain_key?: number
  verification_status?: string
  evidence_uri?: string
}): Promise<QuestSubmission> {
  const { data, error } = await supabase
    .from("quest_submissions")
    .insert({
      ...submission,
      participant_address: submission.participant_address.toLowerCase(),
      source_chain_key: submission.source_chain_key ?? 1,
      verification_status: submission.verification_status || "detected",
    })
    .select()
    .single()

  if (error) {
    // Check if it's a duplicate
    if (error.code === "23505") {
      // Unique constraint violation - already exists
      const { data: existing } = await supabase
        .from("quest_submissions")
        .select("*")
        .eq("quest_id_on_chain", submission.quest_id_on_chain)
        .eq("transaction_hash", submission.transaction_hash)
        .single()

      if (existing) {
        return existing as QuestSubmission
      }
    }
    throw new Error(`Failed to save submission: ${error.message}`)
  }

  if (!data) {
    throw new Error("Failed to save submission: no data returned")
  }

  return data as QuestSubmission
}

/**
 * Check if transaction hash already submitted for quest
 */
export async function isTransactionHashSubmitted(
  questIdOnChain: number,
  txHash: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("quest_submissions")
    .select("id")
    .eq("quest_id_on_chain", questIdOnChain)
    .eq("transaction_hash", txHash)
    .single()

  return !error && !!data
}

/**
 * Check if transaction hash was already used by this participant for any quest.
 * Prevents one tx from auto-completing multiple quests (e.g. daily + weekly).
 */
export async function isTransactionHashUsedByParticipant(
  participantAddress: string,
  txHash: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("quest_submissions")
    .select("id")
    .eq("participant_address", participantAddress.toLowerCase())
    .eq("transaction_hash", txHash)
    .limit(1)

  return !error && !!data && data.length > 0
}

/**
 * Update submission with completion tx hash
 */
export async function updateSubmissionCompletion(
  questIdOnChain: number,
  txHash: string,
  completionTxHash: string
): Promise<void> {
  const { error } = await supabase
    .from("quest_submissions")
    .update({
      verification_status: "verified",
      completion_tx_hash: completionTxHash,
      updated_at: new Date().toISOString(),
    })
    .eq("quest_id_on_chain", questIdOnChain)
    .eq("transaction_hash", txHash)

  if (error) {
    throw new Error(`Failed to update submission: ${error.message}`)
  }
}

/**
 * Record XP gain for user (triggers user_stats update)
 */
export async function recordXP(
  walletAddress: string,
  questIdOnChain: number,
  xpAmount: number,
  rewardAmount?: string,
  badgeTokenId?: number,
  completionTxHash?: string
): Promise<UserXPEntry> {
  // Get or create user first
  const user = await getOrCreateUser(walletAddress)

  const { data, error } = await supabase
    .from("user_xp_ledger")
    .insert({
      user_id: user.id,
      wallet_address: walletAddress.toLowerCase(),
      quest_id_on_chain: questIdOnChain,
      xp_amount: xpAmount,
      reward_amount: rewardAmount,
      badge_token_id: badgeTokenId,
      completion_tx_hash: completionTxHash,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to record XP: ${error?.message}`)
  }

  return data as UserXPEntry
}

/**
 * Get user stats for leaderboard
 * Also calculates rank based on total_xp
 */
export async function getUserStats(walletAddress: string): Promise<(UserStats & { name?: string; email?: string; avatar_url?: string }) | null> {
  // Get user stats and profile data
  const { data: stats, error: statsError } = await supabase
    .from("user_stats")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .single()

  if (statsError || !stats) {
    return null
  }

  // Calculate rank: count how many users have more XP than this user
  // Only calculate rank if user has XP > 0
  let rank: number | null = null
  if (stats.total_xp > 0) {
    const { count, error: rankError } = await supabase
      .from("user_stats")
      .select("*", { count: "exact", head: true })
      .gt("total_xp", stats.total_xp)

    // Rank = number of users with more XP + 1
    // If count is null or error, rank is null (unranked)
    if (count !== null && !rankError) {
      rank = count + 1
    }
  }

  // Get user profile data (name, email, avatar_url)
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("name, email, avatar_url")
    .eq("wallet_address", walletAddress.toLowerCase())
    .single()

  return {
    ...(stats as UserStats),
    ...(rank !== null && rank !== undefined ? { rank } : {}),
    ...(user?.name ? { name: user.name } : {}),
    ...(user?.email ? { email: user.email } : {}),
    ...(user?.avatar_url ? { avatar_url: user.avatar_url } : {}),
  }
}

/**
 * Save user profile (name, email)
 * Auto-generates avatar if not already set
 */
export async function saveProfile(
  walletAddress: string,
  profileData: { name: string; email: string; avatar_url?: string }
): Promise<User> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(profileData.email)) {
    throw new Error("Invalid email format")
  }

  // Validate name
  if (!profileData.name || profileData.name.trim().length === 0) {
    throw new Error("Name is required")
  }

  // Get existing user to check if avatar already exists
  const existingUser = await getOrCreateUser(walletAddress)

  // Generate avatar if not provided and user doesn't have one
  let avatarUrl = profileData.avatar_url
  if (!avatarUrl && !existingUser.avatar_url) {
    avatarUrl = generateUserAvatar(walletAddress)
  } else if (!avatarUrl) {
    // Keep existing avatar if not updating
    avatarUrl = existingUser.avatar_url
  }

  // Update user profile
  const { data, error } = await supabase
    .from("users")
    .update({
      name: profileData.name.trim(),
      email: profileData.email.trim().toLowerCase(),
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", walletAddress.toLowerCase())
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to save profile: ${error?.message || "Unknown error"}`)
  }

  return data as User
}

/**
 * Update user avatar
 */
export async function updateAvatar(
  walletAddress: string,
  avatarUrl: string
): Promise<User> {
  // Get or create user first
  await getOrCreateUser(walletAddress)

  // Update avatar
  const { data, error } = await supabase
    .from("users")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", walletAddress.toLowerCase())
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to update avatar: ${error?.message || "Unknown error"}`)
  }

  return data as User
}

/**
 * Get leaderboard (top users by XP)
 * Only includes users with XP > 0 (ranked users)
 */
export async function getLeaderboard(limit: number = 100): Promise<(UserStats & { name?: string; email?: string; avatar_url?: string })[]> {
  // Get user stats ordered by XP, only users with XP > 0 (ranked)
  const { data: statsData, error: statsError } = await supabase
    .from("user_stats")
    .select("user_id, wallet_address, total_xp, completed_quests, level, updated_at")
    .gt("total_xp", 0) // Only show users with XP > 0 (ranked)
    .order("total_xp", { ascending: false })
    .limit(limit)

  if (statsError || !statsData || statsData.length === 0) {
    return []
  }

  // Get profile data (name, email, avatar_url) from users table for all leaderboard entries
  const walletAddresses = statsData.map((s) => s.wallet_address.toLowerCase())
  const { data: usersData } = await supabase
    .from("users")
    .select("wallet_address, name, email, avatar_url")
    .in("wallet_address", walletAddresses)

  // Create a map of wallet_address -> user profile data
  const userProfileMap = new Map<string, { name?: string; email?: string; avatar_url?: string }>()
  usersData?.forEach((user) => {
    userProfileMap.set(user.wallet_address.toLowerCase(), {
      name: user.name || undefined,
      email: user.email || undefined,
      avatar_url: user.avatar_url || undefined,
    })
  })

  // Combine stats with profile data and assign ranks
  return statsData.map((stats, index) => {
    const profile = userProfileMap.get(stats.wallet_address.toLowerCase()) || {}
    return {
      ...(stats as UserStats),
      rank: index + 1,
      ...(profile.name ? { name: profile.name } : {}),
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.avatar_url ? { avatar_url: profile.avatar_url } : {}),
    }
  })
}

/**
 * Log AI generation
 */
export async function logAIGeneration(logData: {
  quest_id_on_chain?: number
  prompt_input?: any
  ai_output?: any
  metadata_uri?: string
  ipfs_cid?: string
  deployed_on_chain?: boolean
  deployment_tx_hash?: string
}): Promise<void> {
  const { error } = await supabase.from("ai_generation_logs").insert(logData)

  if (error) {
    console.error("Failed to log AI generation:", error)
    // Don't throw - logging failures shouldn't break the flow
  }
}

const PLACEHOLDER_PROTOCOL = "0x0000000000000000000000000000000000000000"

/**
 * Create a draft campaign (partial data, status draft)
 */
export async function createCampaignDraft(data: {
  partner_wallet: string
  partner_name?: string
  title: string
  template_type?: "swap" | "deposit" | "borrow" | "stake" | "other"
  template_params?: Record<string, unknown>
  pool_amount?: number
  max_participants?: number
  pool_token?: string
  start_at?: string
  end_at?: string
  thumbnail?: string
  description?: string
}): Promise<Campaign> {
  const templateParams = data.template_params ?? { protocol_address: PLACEHOLDER_PROTOCOL }
  const protocolAddr = (templateParams as Record<string, unknown>).protocol_address ?? PLACEHOLDER_PROTOCOL
  const poolAmount = data.pool_amount ?? 0
  const maxParticipants = data.max_participants ?? 1
  const rewardPerQuestUsdc = maxParticipants > 0 ? poolAmount / maxParticipants : 0
  const { data: row, error } = await supabase
    .from("campaigns")
    .insert({
      partner_wallet: data.partner_wallet.toLowerCase(),
      partner_name: data.partner_name?.trim() || null,
      title: data.title,
      status: "draft",
      template_type: data.template_type ?? "other",
      template_params: { ...templateParams, protocol_address: String(protocolAddr) },
      pool_token: data.pool_token ?? "USDC",
      pool_amount: poolAmount,
      max_participants: maxParticipants,
      reward_per_quest_usdc: rewardPerQuestUsdc,
      start_at: data.start_at ?? null,
      end_at: data.end_at ?? null,
      thumbnail: data.thumbnail ?? null,
      description: data.description ?? null,
    })
    .select()
    .single()
  if (error || !row) throw new Error(`Failed to create draft: ${error?.message}`)
  return row as Campaign
}

/**
 * Campaign CRUD
 */
export async function createCampaign(campaign: {
  partner_wallet: string
  partner_name?: string
  title: string
  template_type: "swap" | "deposit" | "borrow" | "stake" | "other"
  template_params: Record<string, unknown>
  pool_token?: string
  pool_amount: number
  max_participants: number
  start_at?: string
  end_at?: string
  thumbnail?: string
  description?: string
}): Promise<Campaign> {
  const rewardPerQuestUsdc = campaign.pool_amount / campaign.max_participants
  const startAt = campaign.start_at ?? null
  const endAt = campaign.end_at ?? null
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      partner_wallet: campaign.partner_wallet.toLowerCase(),
      partner_name: campaign.partner_name?.trim() || null,
      title: campaign.title,
      status: "pending",
      template_type: campaign.template_type,
      template_params: campaign.template_params,
      pool_token: campaign.pool_token ?? "USDC",
      pool_amount: campaign.pool_amount,
      max_participants: campaign.max_participants,
      reward_per_quest_usdc: rewardPerQuestUsdc,
      start_at: startAt,
      end_at: endAt,
      thumbnail: campaign.thumbnail ?? null,
      description: campaign.description ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create campaign: ${error?.message}`)
  }
  return data as Campaign
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("campaigns").delete().eq("id", id)
  if (error) throw new Error(`Failed to delete campaign: ${error.message}`)
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) return null
  return data as Campaign
}

export async function listCampaigns(options?: {
  status?: string
  partner_wallet?: string
  participant?: string
  joinedOnly?: boolean
  limit?: number
}): Promise<Campaign[]> {
  if (options?.joinedOnly && (!options?.participant || !/^0x[a-fA-F0-9]{40}$/.test(options.participant))) {
    return []
  }
  if (options?.participant && /^0x[a-fA-F0-9]{40}$/.test(options.participant)) {
    const { data: participantRows, error: pe } = await supabase
      .from("campaign_participants")
      .select("campaign_id, quest_id_on_chain")
      .eq("participant_wallet", options.participant.toLowerCase())
    if (pe || !participantRows?.length) return []
    const campaignIds = participantRows.map((r) => r.campaign_id)
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .in("id", campaignIds)
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 50)
    if (error) return []
    const campaigns = (data ?? []) as Campaign[]
    const questMap = new Map(participantRows.map((r) => [r.campaign_id, r.quest_id_on_chain]))
    return campaigns.map((c) => ({ ...c, quest_id_on_chain: questMap.get(c.id) } as Campaign & { quest_id_on_chain?: number }))
  }
  let query = supabase.from("campaigns").select("*").order("created_at", { ascending: false })
  if (options?.status) query = query.eq("status", options.status)
  if (options?.partner_wallet) query = query.eq("partner_wallet", options.partner_wallet.toLowerCase())
  if (options?.limit) query = query.limit(options.limit)
  const { data, error } = await query
  if (error) return []
  return (data ?? []) as Campaign[]
}

export async function updateCampaignStatus(
  id: string,
  status: string,
  extra?: { escrow_address?: string; escrow_tx_hash?: string; vael_per_quest?: number }
): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (extra?.escrow_address) updates.escrow_address = extra.escrow_address
  if (extra?.escrow_tx_hash) updates.escrow_tx_hash = extra.escrow_tx_hash
  if (extra?.vael_per_quest != null) updates.vael_per_quest = extra.vael_per_quest
  const { error } = await supabase.from("campaigns").update(updates).eq("id", id)
  if (error) throw new Error(`Failed to update campaign: ${error.message}`)
}

export type UpdateCampaignFields = {
  title?: string
  description?: string
  partner_name?: string | null
  start_at?: string
  end_at?: string
  pool_amount?: number
  max_participants?: number
  pool_token?: string
  thumbnail?: string | null
  template_type?: "swap" | "deposit" | "borrow" | "stake" | "other"
  template_params?: Record<string, unknown>
}

export async function updateCampaign(id: string, fields: UpdateCampaignFields): Promise<Campaign> {
  const camp = await getCampaignById(id)
  if (!camp) throw new Error("Campaign not found")
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.title != null) updates.title = fields.title
  if (fields.description != null) updates.description = fields.description
  if (fields.partner_name !== undefined) updates.partner_name = fields.partner_name?.trim() || null
  if (fields.start_at != null) updates.start_at = fields.start_at || null
  if (fields.end_at != null) updates.end_at = fields.end_at || null
  if (fields.pool_amount != null) updates.pool_amount = fields.pool_amount
  if (fields.max_participants != null) updates.max_participants = fields.max_participants
  if (fields.pool_token != null) updates.pool_token = fields.pool_token
  if (fields.thumbnail !== undefined) updates.thumbnail = fields.thumbnail || null
  if (fields.template_type != null) updates.template_type = fields.template_type
  if (fields.template_params != null) updates.template_params = fields.template_params
  const { data, error } = await supabase.from("campaigns").update(updates).eq("id", id).select().single()
  if (error) throw new Error(`Failed to update campaign: ${error.message}`)
  return data as Campaign
}

export async function incrementCampaignParticipant(id: string): Promise<void> {
  const camp = await getCampaignById(id)
  if (!camp) throw new Error("Campaign not found")
  const { error } = await supabase
    .from("campaigns")
    .update({
      participant_count: camp.participant_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) throw new Error(`Failed to increment participant: ${error.message}`)
}

export async function addCampaignParticipant(
  campaignId: string,
  participantWallet: string,
  questIdOnChain: number
): Promise<CampaignParticipant> {
  const { data, error } = await supabase
    .from("campaign_participants")
    .insert({
      campaign_id: campaignId,
      participant_wallet: participantWallet.toLowerCase(),
      quest_id_on_chain: questIdOnChain,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to add campaign participant: ${error.message}`)
  return data as CampaignParticipant
}

export async function getCampaignParticipant(
  campaignId: string,
  participantWallet: string
): Promise<CampaignParticipant | null> {
  const { data, error } = await supabase
    .from("campaign_participants")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("participant_wallet", participantWallet.toLowerCase())
    .single()

  if (error || !data) return null
  return data as CampaignParticipant
}

export async function getQuestByCampaignAndParticipant(
  campaignId: string,
  participantWallet: string
): Promise<number | null> {
  const cp = await getCampaignParticipant(campaignId, participantWallet)
  return cp?.quest_id_on_chain ?? null
}

export async function getCampaignByQuestId(questIdOnChain: number): Promise<Campaign | null> {
  const { data: quest } = await supabase
    .from("quests")
    .select("campaign_id")
    .eq("quest_id_on_chain", questIdOnChain)
    .single()
  if (!quest?.campaign_id) return null
  return getCampaignById(quest.campaign_id as string)
}

export async function getCampaignParticipantByQuestId(
  questIdOnChain: number
): Promise<CampaignParticipant | null> {
  const { data, error } = await supabase
    .from("campaign_participants")
    .select("*")
    .eq("quest_id_on_chain", questIdOnChain)
    .single()
  if (error || !data) return null
  return data as CampaignParticipant
}

export async function incrementCampaignClaimed(id: string): Promise<void> {
  const camp = await getCampaignById(id)
  if (!camp) throw new Error("Campaign not found")
  const newClaimed = camp.claimed_count + 1
  const status = newClaimed >= camp.max_participants ? "completed" : camp.status
  const { error } = await supabase
    .from("campaigns")
    .update({
      claimed_count: newClaimed,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) throw new Error(`Failed to increment claimed: ${error.message}`)
}

export async function markCampaignParticipantUsdcReleased(
  campaignId: string,
  participantWallet: string
): Promise<void> {
  const { error } = await supabase
    .from("campaign_participants")
    .update({ usdc_released: true })
    .eq("campaign_id", campaignId)
    .eq("participant_wallet", participantWallet.toLowerCase())
  if (error) throw new Error(`Failed to mark USDC released: ${error.message}`)
}

