"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

export interface ProfileStats {
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

export function useProfile(walletAddress: string | null) {
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!walletAddress) {
      setStats(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.getUserStats(walletAddress)
      setStats(res.stats as ProfileStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile")
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { stats, loading, error, refetch: fetchProfile }
}

export function useCompletedQuests(walletAddress: string | null) {
  const [quests, setQuests] = useState<
    Array<{
      quest_id_on_chain: number
      title?: string
      description?: string
      quest_type?: string
      category?: string
      completionTxHash?: string
      completedAt?: string
    }>
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuests = useCallback(async () => {
    if (!walletAddress) {
      setQuests([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.getCompletedQuests(walletAddress)
      setQuests(res.quests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch completed quests")
      setQuests([])
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    fetchQuests()
  }, [fetchQuests])

  return { quests, loading, error, refetch: fetchQuests }
}
