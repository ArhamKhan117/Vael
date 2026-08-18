"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { api } from "@/lib/api"

// Pages that require profile (name + email) before access
// Backend generates daily/weekly quests after profile save
const PAGES_REQUIRING_PROFILE = ["/quests", "/profile"]

export function ProfileGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  useEffect(() => {
    if (!isConnected || !address) return
    if (pathname?.includes("/profile/complete") || pathname === "/") return

    const needsProfile = PAGES_REQUIRING_PROFILE.some(
      (p) => pathname === p || pathname?.startsWith(`${p}/`)
    )
    if (!needsProfile) return

    let cancelled = false

    const checkAndRedirect = async () => {
      try {
        const res = await api.getUserStats(address)
        const hasProfile = !!(
          res.stats?.name?.trim() &&
          res.stats?.email?.trim()
        )
        if (!cancelled && !hasProfile) {
          router.push("/profile/complete")
        }
      } catch {
        // New user - assume profile incomplete
        if (!cancelled) {
          router.push("/profile/complete")
        }
      }
    }

    // Small delay to avoid flashing
    const t = setTimeout(checkAndRedirect, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [isConnected, address, pathname, router])

  return null
}
