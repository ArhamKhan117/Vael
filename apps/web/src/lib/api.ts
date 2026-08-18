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

  async getQuest(questId: number) {
    return this.request<{ quest: Record<string, unknown> }>(`/quests/${questId}`)
  }

  async getQuestProgress(questId: number, participant: string) {
    return this.request<{
      questId: number
      participant: string
      progress: { accepted: boolean; completed: boolean }
    }>(`/quests/${questId}/progress/${participant}`)
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
        quest_id_on_chain: number
        title?: string
        description?: string
        quest_type?: string
        category?: string
        completionTxHash?: string
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

  async getLeaderboard(limit: number = 100) {
    return this.request<{
      leaderboard: Array<{
        user_id: string
        wallet_address: string
        total_xp: number
        completed_quests: number
        level: number
        rank: number
        updated_at: string
        name?: string
        email?: string
        avatar_url?: string
      }>
    }>(`/quests/leaderboard?limit=${limit}`)
  }

  async getUserQuests(walletAddress: string) {
    return this.request<{
      quests: {
        daily: Record<string, unknown> | null
        weekly: Record<string, unknown> | null
        all: Record<string, unknown>[]
      }
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
      quests: { daily?: { questId: number } | null; weekly?: { questId: number } | null }
      errors?: { daily?: string; weekly?: string }
    }>(`/quests/users/${walletAddress}/generate-quests`, { method: "POST" })
  }

  async getAllQuests(participant?: string | null) {
    const url = participant
      ? `/quests?participant=${encodeURIComponent(participant)}`
      : "/quests"
    return this.request<{ quests: Record<string, unknown>[] }>(url)
  }

  async listCampaigns(params?: {
    status?: string
    partner?: string
    participant?: string
    joinedOnly?: boolean
    limit?: number
  }) {
    const search = new URLSearchParams()
    if (params?.status) search.set("status", params.status)
    if (params?.partner) search.set("partner", params.partner)
    if (params?.participant != null) search.set("participant", params.participant)
    if (params?.joinedOnly) search.set("joinedOnly", "true")
    if (params?.limit) search.set("limit", String(params.limit))
    const q = search.toString()
    return this.request<{ campaigns: Campaign[] }>(
      `/campaigns${q ? `?${q}` : ""}`
    )
  }

  async createCampaignDraft(data: {
    partner_wallet: string
    partner_name?: string
    title: string
    template_type?: "swap" | "deposit" | "borrow" | "stake" | "other"
    template_params?: Record<string, unknown>
    pool_amount?: number
    max_participants?: number
    pool_token?: string
    description?: string
    thumbnail?: string
    period_start?: string
    period_end?: string
  }) {
    return this.request<Campaign>(`/campaigns/draft`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async createCampaign(data: {
    partner_wallet: string
    partner_name?: string
    title: string
    template_type: "swap" | "deposit" | "borrow" | "stake" | "other"
    description?: string
    thumbnail?: string
    template_params: Record<string, unknown>
    pool_amount: number
    max_participants: number
    period_start?: string
    period_end?: string
  }) {
    return this.request<Campaign>(`/campaigns`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getCampaign(id: string) {
    return this.request<Campaign>(`/campaigns/${id}`)
  }

  async joinCampaign(id: string, participant: string) {
    return this.request<{
      message: string
      questIdOnChain: number
      deploymentTxHash: string
    }>(`/campaigns/${id}/join`, {
      method: "POST",
      body: JSON.stringify({ participant }),
    })
  }

  async activateCampaign(id: string, escrowTxHash?: string) {
    return this.request<{ message: string }>(`/campaigns/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({ escrow_tx_hash: escrowTxHash }),
    })
  }

  async requestRefund(campaignId: string, partnerWallet: string) {
    return this.request<{
      message: string
      transactionHash: string
      amountUsdc: number
    }>(`/campaigns/${campaignId}/refund`, {
      method: "POST",
      body: JSON.stringify({ partner_wallet: partnerWallet }),
    })
  }

  async deleteCampaign(id: string) {
    return fetch(`${this.baseURL}/campaigns/${id}`, {
      method: "DELETE",
    }).then(async (res) => {
      if (res.status === 204) return
      const err = (await res.json().catch(() => ({}))) as APIError
      throw new Error(err.message || `HTTP ${res.status}`)
    })
  }

  async updateCampaignStatus(id: string, status: string) {
    return this.request<Campaign>(`/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
  }

  async updateCampaign(
    id: string,
    data: {
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
  ) {
    return this.request<Campaign>(`/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }
}

export interface Campaign {
  id: string
  partner_wallet: string
  partner_name?: string | null
  title: string
  status: "draft" | "pending" | "active" | "completed" | "cancelled"
  template_type: "swap" | "deposit" | "borrow" | "stake" | "other"
  template_params: Record<string, unknown>
  pool_token: string
  pool_amount: string | number
  max_participants: number
  reward_per_quest_usdc: string | number
  vael_per_quest?: number | null
  participant_count: number
  claimed_count: number
  thumbnail?: string | null
  description?: string | null
  start_at?: string | null
  end_at?: string | null
  created_at: string
  updated_at: string
}

export const api = new APIClient()
