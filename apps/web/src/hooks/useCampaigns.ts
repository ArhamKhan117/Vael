"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type Campaign } from "@/lib/api"

export function useCampaigns(params?: { status?: string; partner?: string; participant?: string; joinedOnly?: boolean; limit?: number }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listCampaigns(params)
      setCampaigns(res.campaigns || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch campaigns")
    } finally {
      setLoading(false)
    }
  }, [params?.status, params?.partner, params?.participant, params?.joinedOnly, params?.limit])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  return { campaigns, loading, error, refetch: fetchCampaigns }
}
