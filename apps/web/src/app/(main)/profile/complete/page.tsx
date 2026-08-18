"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, Mail, CheckCircle2, AlertCircle } from "lucide-react"

export default function ProfileCompletePage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)

  // Disable body scroll while on this page
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight

    // Prevent layout shift when scrollbar disappears (desktop)
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [])

  // Check if profile already complete
  useEffect(() => {
    if (!isConnected || !address) {
      router.push("/")
      return
    }

    const check = async () => {
      try {
        const res = await api.getUserStats(address)
        const hasProfile = !!(
          res.stats?.name?.trim() &&
          res.stats?.email?.trim()
        )
        if (hasProfile) {
          router.push("/quests")
          return
        }
        if (res.stats?.name) setName(res.stats.name)
        if (res.stats?.email) setEmail(res.stats.email)
      } catch {
        // New user - no profile yet
      } finally {
        setChecking(false)
      }
    }
    check()
  }, [isConnected, address, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (!name.trim()) throw new Error("Name is required")
      if (!email.trim()) throw new Error("Email is required")
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error("Invalid email format")
      }

      await api.saveProfile(address, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      })

      setSuccess(true)
      setTimeout(() => router.push("/quests"), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected || !address) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-20 pt-24 relative z-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </main>
    )
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-20 pt-24 relative z-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10 relative z-20 flex flex-col justify-center">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            Complete Your Profile
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Fill in your details to receive your daily and weekly quests.
          </p>
        </div>

        <div className="rounded border border-[#1A1A1A] bg-black p-6">
          <div className="mb-6 border-b border-[#1A1A1A] pb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Wallet
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-300">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="text-zinc-300">
                <User className="mr-2 inline h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || success}
                className="mt-2 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-zinc-300">
                <Mail className="mr-2 inline h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || success}
                className="mt-2 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500"
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                For quest updates and rewards notifications.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 rounded bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Profile saved! Redirecting to quests…
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || success || !name.trim() || !email.trim()}
              className="w-full rounded bg-white text-black hover:bg-white/90"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : success ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : null}
              {loading
                ? "Saving..."
                : success
                  ? "Saved!"
                  : "Save Profile & Get Quests"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
