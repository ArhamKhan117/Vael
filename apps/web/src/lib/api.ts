/**
 * API client for the Vael backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export interface APIError {
  message: string
  error?: string
}

class APIClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        message: response.statusText,
      }))) as APIError
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async health() {
    return this.request<{ status: string; network: string }>("/health")
  }

  async getProtocols() {
    return this.request<{
      protocols: Array<{
        name: string
        chain: string
        evmAddress: string
        category: string
        website: string
        description: string
      }>
    }>("/ai/protocols")
  }

  /** One quest, as the index read it back off QuestManager. */
  async getQuest(questId: number) {
    return this.request<{ quest: ChainQuest }>(`/quests/${questId}`)
  }

  /** The quest board. Every entry exists because QuestManager emitted QuestCreated. */
  async listQuests(params?: { participant?: string | null; cadence?: QuestCadence }) {
    const search = new URLSearchParams()
    if (params?.participant) search.set("participant", params.participant)
    if (params?.cadence) search.set("cadence", params.cadence)
    const query = search.toString()
    return this.request<{ quests: ChainQuest[] }>(`/quests${query ? `?${query}` : ""}`)
  }

  async getQuestProgress(questId: number, participant: string) {
    return this.request<{
      questId: number
      participant: string
      progress: { accepted: boolean; completed: boolean }
    }>(`/quests/${questId}/progress/${participant}`)
  }

  /**
   * Where a proof submission has got to, if the API knows.
   *
   * Returns null rather than throwing when the endpoint is unavailable: the self-claim path does
   * not need this, so a missing API degrades the timeline rather than the feature.
   */
  async getProofStatus(questId: number, participant: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/quests/${questId}/proof-status?participant=${participant}`
      )
      if (!response.ok) return null
      return (await response.json()) as {
        stage: "not_started" | "detected" | "attesting" | "proving" | "submitted" | "verified" | "failed"
        sourceTxHash?: string
        sourceBlock?: number
        creditcoinTxHash?: string
        attestedHeight?: number
        error?: string
      }
    } catch {
      return null
    }
  }

  async submitProof(questId: number, data: { transactionHash: string; participant?: string }) {
    return this.request<{ message: string; questId: string; transactionHash: string }>(
      `/quests/${questId}/submit-proof`,
      { method: "POST", body: JSON.stringify(data) }
    )
  }

  async getUserStats(walletAddress: string) {
    return this.request<{
      stats: {
        user_id: string
        wallet_address: string
        total_xp: number
        completed_quests: number
        level: number
        rank: number | null
        updated_at: string
        name?: string
        email?: string
        avatar_url?: string
      }
    }>(`/quests/users/${walletAddress}/stats`)
  }

  async saveProfile(walletAddress: string, data: { name: string; email: string }) {
    return this.request<{
      success: boolean
      message: string
      user: {
        user_id: string
        wallet_address: string
        name?: string
        email?: string
        avatar_url?: string
      }
    }>(`/quests/users/${walletAddress}/profile`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getCompletedQuests(walletAddress: string) {
    return this.request<{
      quests: Array<{
        questId: number
        title: string
        description: string
        cadence: QuestCadence
        rewardVael: string
        badgeLevel: number
        replayKey?: string
        sourceBlock?: number
        creditcoinBlock?: number
        completedAt?: string
      }>
    }>(`/quests/users/${walletAddress}/completed`)
  }

  async updateAvatar(walletAddress: string, avatarUrl: string) {
    return this.request<{
      success: boolean
      message: string
      user: {
        user_id: string
        wallet_address: string
        avatar_url?: string
      }
    }>(`/quests/users/${walletAddress}/avatar`, {
      method: "PATCH",
      body: JSON.stringify({ avatar_url: avatarUrl }),
    })
  }


  async getUserQuests(walletAddress: string) {
    return this.request<{
      quests: { daily: ChainQuest | null; weekly: ChainQuest | null; all: ChainQuest[] }
    }>(`/quests/users/${walletAddress}/quests`)
  }

  /**
   * FEEDBACK
   */
  async listFeedback(params?: { user_id?: string; limit?: number }) {
    const search = new URLSearchParams()
    if (params?.user_id) search.set("user_id", params.user_id)
    if (params?.limit) search.set("limit", String(params.limit))
    const q = search.toString()
    return this.request<{
      feedback: Array<{
        id: number
        name?: string | null
        role?: string | null
        wallet_address?: string | null
        username?: string | null
        rating: number
        message: string
        created_at?: string
      }>
    }>(`/feedback${q ? `?${q}` : ""}`)
  }

  async createFeedback(data: {
    name?: string
    role?: string
    wallet_address?: string
    username?: string
    rating: number
    message: string
  }) {
    return this.request<{
      feedback: {
        id: number
        name?: string | null
        role?: string | null
        wallet_address?: string | null
        username?: string | null
        rating: number
        message: string
        created_at?: string
      }
    }>("/feedback", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  /** Trigger daily/weekly quest generation (for users who failed on first try) */
  async generateUserQuests(walletAddress: string) {
    return this.request<{
      success: boolean
      message: string
      quests: { daily?: { questId: number }; weekly?: { questId: number } }
      errors?: { daily?: string; weekly?: string }
    }>(`/quests/users/${walletAddress}/generate-quests`, { method: "POST" })
  }

  /** Every pool CampaignEscrow has held money for, with the balance read from the contract. */
  async listCampaigns(params?: { partner?: string; status?: CampaignStatus }) {
    const search = new URLSearchParams()
    if (params?.partner) search.set("partner", params.partner)
    if (params?.status) search.set("status", params.status)
    const query = search.toString()
    return this.request<{ campaigns: ChainCampaign[] }>(`/campaigns${query ? `?${query}` : ""}`)
  }

  /** One pool and the quests that draw on it, by its bytes32 escrow key. */
  async getCampaign(campaignKey: string) {
    return this.request<{ campaign: ChainCampaign; quests: ChainQuest[] }>(
      `/campaigns/${campaignKey}`
    )
  }
}

export type QuestCadence = "daily" | "weekly" | "campaign" | "open"

export type ProofStage =
  | "waiting"
  | "detected"
  | "attesting"
  | "proving"
  | "submitted"
  | "verified"
  | "failed"

export interface QuestProof {
  state: ProofStage
  replayKey?: string
  sourceBlock?: number
  creditcoinBlock?: number
  sourceTxHash?: string
  attempts?: number
  error?: string | null
  at?: string
}

/**
 * A quest as Creditcoin describes it.
 *
 * Everything here was read back off QuestManager after a QuestCreated, except the title and the
 * description, which come from the metadata document the quest points at.
 */
export interface ChainQuest {
  questId: number
  title: string
  description: string
  cadence: QuestCadence
  category: string
  status: string
  statusValue: number
  participant: string
  protocol: string
  metadataURI: string
  rewardToken: string
  rewardAmount: string
  rewardVael: string
  badgeLevel: number
  expiry: number
  createdAt: number
  sourceChainKey: number
  campaignId: string
  campaignKey: string | null
  /** A campaign quest is paid by the partner's escrow, an ordinary one by RewardVault. */
  fundedBy: "escrow" | "vault"
  accepted: boolean
  completed: boolean
  acceptedCount: number
  completedCount: number
  /** The pinned banner as an `ipfs://` URI, when the quest was published with one. */
  image?: string
  action: {
    actionType: number
    actionName: string
    emitter: string
    token: string
    tokenSymbol: string | null
    minAmount: string
    /** The minimum in the token's own units, or "any amount" when the rule sets none. */
    minAmountLabel: string
    /** Where the action happens: "Ethereum Sepolia" or "Creditcoin". */
    chain: string
    /** The only contract that can complete this quest: "QuestASC" or "NativePortal". */
    settledBy: string
  }
  proof: QuestProof
}

export type CampaignStatus = "funded" | "drained" | "refunded"

export interface ChainCampaign {
  campaignKey: string
  campaignId?: string
  title?: string
  partner: string
  deposited: string
  released: string
  refunded: string
  firstSeenBlock: number
  balance: string
  balanceVael: string
  questCount: number
  completedCount: number
  status: CampaignStatus
  /**
   * The protocol every quest in this pool targets, when they all target one.
   *
   * `verified` is not a label anybody can set: it is true only when QuestASC's own allowlist
   * accepts that contract for that action type, so a campaign cannot call itself official.
   */
  protocol?: { name: string; slug: string; verified: boolean }
  /** Banner pinned with the campaign's quests, if one was. */
  image?: string
  /**
   * True when Vael's own deployer funded the pool.
   *
   * Such a campaign demonstrates the mechanism rather than representing a third party who paid for
   * it, and the card says so: implying a partnership that does not exist would be the one dishonest
   * thing a partner card could do.
   */
  selfFunded?: boolean
}

export const api = new APIClient()
