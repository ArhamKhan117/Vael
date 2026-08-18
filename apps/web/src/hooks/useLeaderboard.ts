"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

export interface LeaderboardEntry {
  user_id: string
  wallet_address: string
  total_xp: number
  completed_quests: number
  level: number
  rank: number
  name?: string
  avatar_url?: string
}

export function useLeaderboard(limit: number = 100) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getLeaderboard(limit)
      setLeaderboard(res.leaderboard || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch leaderboard")
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return { leaderboard, loading, error, refetch: fetchLeaderboard }
}
