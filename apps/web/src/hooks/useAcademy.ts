"use client"

import { useCallback, useEffect, useState } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export interface AcademyModuleProgress {
  lessonsRead: number[]
  quizScore: number
  quizPassed: boolean
  updatedAt: string
}

export interface AcademyOpenQuest {
  questId: number
  actionType: number
  minAmount: string
}

export interface AcademyProgressResponse {
  address: string
  modules: Record<string, AcademyModuleProgress>
  updatedAt: string | null
  openQuests: AcademyOpenQuest[]
}

/**
 * Academy progress for one address.
 *
 * Progress is a bookmark, not an entitlement. Nothing here unlocks a reward: a module's badge
 * comes from its do quest, which QuestASC verifies from a proof exactly like any other quest.
 */
export function useAcademy(address?: string) {
  const [data, setData] = useState<AcademyProgressResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!address) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/academy/progress?address=${address}`)
      if (response.ok) setData((await response.json()) as AcademyProgressResponse)
    } catch {
      // The academy reads fine without the API; only the ticks go missing.
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const save = useCallback(
    async (module: string, patch: { lessonsRead?: number[]; quizScore?: number }) => {
      if (!address) return
      try {
        const response = await fetch(`${API_BASE_URL}/academy/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, module, ...patch }),
        })
        if (!response.ok) return
        const body = (await response.json()) as { module: string; progress: AcademyModuleProgress }
        setData((current) =>
          current
            ? { ...current, modules: { ...current.modules, [body.module]: body.progress } }
            : current
        )
      } catch {
        // Progress is a convenience. Losing a tick is not worth an error dialog.
      }
    },
    [address]
  )

  return { data, loading, save, refetch }
}
