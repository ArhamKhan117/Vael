"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { api, type ChainQuest, type QuestCadence } from "@/lib/api"

export interface QuestProgress {
  accepted: boolean
  completed: boolean
}

export function useQuest(questId: number | null) {
  const [quest, setQuest] = useState<ChainQuest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuest = useCallback(async () => {
    if (!questId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getQuest(questId)
      setQuest(res.quest)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch quest")
    } finally {
      setLoading(false)
    }
  }, [questId])

  useEffect(() => {
    fetchQuest()
  }, [fetchQuest])

  return { quest, loading, error, refetch: fetchQuest }
}

export function useQuestProgress(questId: number | null, participant: string | null) {
  const [progress, setProgress] = useState<QuestProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!questId || !participant) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getQuestProgress(questId, participant)
      setProgress(res.progress)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch progress")
    } finally {
      setLoading(false)
    }
  }, [questId, participant])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  return { progress, loading, error, refetch: fetchProgress }
}

export function useSubmitProof() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitProof = useCallback(
    async (
      questId: number,
      data: { transactionHash: string; participant?: string }
    ) => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.submitProof(questId, data)
        return result
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to submit proof"
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { submitProof, loading, error }
}

/** The quest board, optionally narrowed to one player or one kind of quest. */
export function useAllQuests(params?: { participant?: string | null; cadence?: QuestCadence }) {
  const [quests, setQuests] = useState<ChainQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const participant = params?.participant
  const cadence = params?.cadence

  const fetchQuests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query: { participant?: string | null; cadence?: QuestCadence } = {}
      if (participant) query.participant = participant
      if (cadence) query.cadence = cadence
      const res = await api.listQuests(query)
      setQuests(res.quests || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch quests")
    } finally {
      setLoading(false)
    }
  }, [participant, cadence])

  useEffect(() => {
    fetchQuests()
  }, [fetchQuests])

  return { quests, loading, error, refetch: fetchQuests }
}

export function useUserQuests(walletAddress: string | null) {
  const [quests, setQuests] = useState<{
    daily: ChainQuest | null
    weekly: ChainQuest | null
    all: ChainQuest[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generationTriggered = useRef<string | null>(null)

  const fetchQuests = useCallback(async () => {
    if (!walletAddress) {
      setQuests(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.getUserQuests(walletAddress)
      setQuests(res.quests)
      // Auto-retry generation if user has no daily/weekly (e.g. previous attempt failed)
      const needsGeneration = !res.quests?.daily || !res.quests?.weekly
      const alreadyTriggered = generationTriggered.current === walletAddress
      if (needsGeneration && !alreadyTriggered) {
        generationTriggered.current = walletAddress
        api.generateUserQuests(walletAddress).then(() => {
          setTimeout(() => fetchQuests(), 4000)
        }).catch(() => { /* don't reset ref - avoid infinite retry loop */ })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch quests")
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    generationTriggered.current = null // reset when wallet changes
  }, [walletAddress])

  useEffect(() => {
    fetchQuests()
  }, [fetchQuests])

  return { quests, loading, error, refetch: fetchQuests }
}
