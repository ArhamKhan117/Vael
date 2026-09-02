"use client"

import { useCallback, useEffect, useState } from "react"

import { api, type CampaignStatus, type ChainCampaign, type ChainQuest } from "@/lib/api"

/** Every campaign pool the escrow holds, or held. */
export function useCampaigns(params?: { partner?: string; status?: CampaignStatus }) {
  const [campaigns, setCampaigns] = useState<ChainCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const partner = params?.partner
  const status = params?.status

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query: { partner?: string; status?: CampaignStatus } = {}
      if (partner) query.partner = partner
      if (status) query.status = status
      const res = await api.listCampaigns(query)
      setCampaigns(res.campaigns ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch campaigns")
    } finally {
      setLoading(false)
    }
  }, [partner, status])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  return { campaigns, loading, error, refetch: fetchCampaigns }
}

/** One pool and the quests that draw on it. */
export function useCampaign(campaignKey: string | null) {
  const [campaign, setCampaign] = useState<ChainCampaign | null>(null)
  const [quests, setQuests] = useState<ChainQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaign = useCallback(async () => {
    if (!campaignKey) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getCampaign(campaignKey)
      setCampaign(res.campaign)
      setQuests(res.quests ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch campaign")
    } finally {
      setLoading(false)
    }
  }, [campaignKey])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  return { campaign, quests, loading, error, refetch: fetchCampaign }
}
