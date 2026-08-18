"use client"

import Image from "next/image"
import Link from "next/link"
import { useAccount } from "wagmi"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useProfile, useCompletedQuests } from "@/hooks/useProfile"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { EditAvatarDialog } from "@/components/edit-avatar-dialog"
import { Button } from "@/components/ui/button"
import { Copy, Loader2, Edit2, MoveRight } from "lucide-react"

function getDefaultAvatar(seed: string) {
  const s = seed.toLowerCase().replace(/[^a-z0-9]/g, "") || "default"
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${s}&size=256&radius=50`
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function ProfilePage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { stats, loading, refetch } = useProfile(address ?? null)
  const { quests: completedQuestsList, loading: completedLoading } =
    useCompletedQuests(address ?? null)

  useEffect(() => {
    if (!isConnected || !address) {
      router.push("/")
    }
  }, [isConnected, address, router])

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
    }
  }

  if (!isConnected || !address) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-20 pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </main>
    )
  }

  if (loading && !stats) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-20 pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </main>
    )
  }

  const avatarUrl = stats?.avatar_url ?? getDefaultAvatar(address)
  const displayName = stats?.name?.trim() || shortAddress(address)
  const hasProfile = !!(stats?.name?.trim() && stats?.email?.trim())
  const level = stats?.level ?? 1
  const totalXp = stats?.total_xp ?? 0
  const completedQuests = stats?.completed_quests ?? 0
  const rank = stats?.rank
  const xpForNextLevel = 5000
  const xpInCurrentLevel = totalXp % xpForNextLevel
  const xpNeeded = xpForNextLevel - xpInCurrentLevel
  const xpPct =
    xpNeeded === 0 ? 0 : (xpInCurrentLevel / xpForNextLevel) * 100

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Complete profile prompt */}
        {!hasProfile && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-200">
              Complete your profile with name and email to get personalized quests.
            </p>
            <EditProfileDialog
              walletAddress={address}
              stats={stats}
              onSuccess={refetch}
            >
              <Button
                variant="outline"
                size="sm"
                className="mt-2 rounded border-amber-500/50 text-amber-200 hover:bg-amber-500/20"
              >
                Add Name & Email
              </Button>
            </EditProfileDialog>
          </div>
        )}

        {/* Top identity bar */}
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <EditAvatarDialog
              walletAddress={address}
              stats={stats}
              onSuccess={refetch}
            >
              <div className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white/10 bg-zinc-900 ring-2 ring-transparent transition hover:ring-white/20">
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized={
                    avatarUrl.startsWith("data:") ||
                    avatarUrl.includes("dicebear")
                  }
                  sizes="80px"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                  <Edit2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </EditAvatarDialog>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-white">
                  {displayName}
                </h1>
                <EditProfileDialog
                  walletAddress={address}
                  stats={stats}
                  onSuccess={refetch}
                >
                  <button
                    type="button"
                    className="rounded p-1 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    aria-label="Edit profile"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </EditProfileDialog>
              </div>
              {stats?.email && (
                <p className="mt-0.5 truncate text-sm text-zinc-400">
                  {stats.email}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded border border-[#1A1A1A] bg-[#18181B] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  {shortAddress(address)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="h-7 px-2 text-zinc-500 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EditProfileDialog
              walletAddress={address}
              stats={stats}
              onSuccess={refetch}
            >
              <Button
                variant="default"
                className="rounded w-full font-semibold bg-white text-black hover:bg-white/80"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </EditProfileDialog>
          </div>
        </section>

        {/* Level / XP */}
        <section>
          <div className="overflow-hidden rounded border border-[#1A1A1A] bg-black p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded border border-[#1A1A1A] bg-[#18181B] text-sm font-semibold text-zinc-200">
                    L{level}
                  </span>
                  <span className="text-sm font-medium text-white">
                    Level {level}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {xpInCurrentLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP
                </div>
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-[#1A1A1A]">
                  <div
                    className="h-full bg-white transition-[width] duration-500"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-[#1A1A1A] bg-black p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              XP Points
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {totalXp.toLocaleString()}
            </div>
          </div>
          <div className="rounded border border-[#1A1A1A] bg-black p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Current Level
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {level}
            </div>
          </div>
          <div className="rounded border border-[#1A1A1A] bg-black p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Quests Completed
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {completedQuests}
            </div>
          </div>
          <div className="rounded border border-[#1A1A1A] bg-black p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Leaderboard Rank
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {rank != null ? `#${rank}` : "—"}
            </div>
          </div>
        </section>

        {/* Completed Quests */}
        <section className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
          <div className="border-b border-[#1A1A1A] p-5">
            <div className="text-sm font-semibold text-white">
              Completed Quests
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Quests you have completed
            </div>
          </div>
          <div className="p-5">
            {completedLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : completedQuestsList.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                No completed quests yet. Complete quests to earn XP and rewards.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {completedQuestsList.map((q) => (
                  <Link
                    key={q.quest_id_on_chain}
                    href={`/quests/${q.quest_id_on_chain}`}
                    className="flex items-center justify-between gap-4 rounded border border-[#1A1A1A] bg-[#0F0F10] p-4 transition hover:border-zinc-600"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">
                        {q.title ?? `Quest #${q.quest_id_on_chain}`}
                      </div>
                      {q.quest_type && (
                        <span className="mt-1 inline-block rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                          {q.quest_type}
                        </span>
                      )}
                    </div>
                    <MoveRight className="h-4 w-4 shrink-0 text-zinc-500" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick links */}
        <section className="flex gap-3">
          <Button
            asChild
            variant="default"
            className="rounded font-semibold bg-white text-black hover:bg-white/80"
          >
            <Link href="/quests">View Quests</Link>
          </Button>
          <Button
            asChild
            variant="default"
            className="rounded font-semibold bg-white text-black hover:bg-white/80"
          >
            <Link href="/leaderboard">View Leaderboard</Link>
          </Button>
        </section>
      </div>
    </main>
  )
}
