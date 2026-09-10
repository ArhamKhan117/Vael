"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Info,
  Loader2,
  MoveRight,
  Users,
  Zap,
  Wallet,
  AlertCircle,
} from "lucide-react"
import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useAppKit } from "@reown/appkit/react"
import { useQuest, useQuestProgress } from "@/hooks/useQuests"
import { useQuestContract } from "@/hooks/useQuestContract"
import { useReownWallet } from "@/hooks/useReownWallet"
import {
  ipfsToHttp,
  PLACEHOLDER_METADATA_URI,
  fetchIPFSMetadata,
  type QuestMetadata,
} from "@/lib/ipfs"
import PartnershipCarousel from "@/components/partnership-carousel"
import { ActionArt, ActionBanner } from "@/components/action-art"
import { ClaimPanel } from "@/components/quest/claim-panel"
import { NativeActionPanel } from "@/components/quest/native-action-panel"
import { ActionType, ProofStatus, VerificationRule, isNativeAction } from "@/lib/attestcoin/types"
import { useProofStatus, useVerificationRule } from "@/hooks/useProofStatus"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"

function formatCompact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n)
}

function detectQuestType(metadata: QuestMetadata | null): "daily" | "weekly" | null {
  const notes = metadata?.extraNotes?.toLowerCase() ?? ""
  if (notes.includes("daily")) return "daily"
  if (notes.includes("weekly")) return "weekly"
  return null
}

/**
 * Styling by the action the rule actually checks, not by `Quest.category`.
 *
 * The category enum is display-only and the quest agent sets it to Swap for everything, so a page
 * that trusted it labelled an Aave supply quest "SWAP". The action type is the field the chain
 * enforces, and it is what a player needs to read.
 */
const ACTION_STYLE: Record<number, { code: string; bg: string; text: string }> = {
  0: { code: "PORTAL", bg: "bg-zinc-500/15", text: "text-zinc-300" },
  1: { code: "SWAP", bg: "bg-sky-500/15", text: "text-sky-400" },
  2: { code: "TRANSFER", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  3: { code: "SUPPLY", bg: "bg-indigo-500/15", text: "text-indigo-400" },
  4: { code: "BORROW", bg: "bg-amber-500/15", text: "text-amber-400" },
  5: { code: "PENGUINSWAP", bg: "bg-cyan-500/15", text: "text-cyan-300" },
  6: { code: "WRAP CTC", bg: "bg-violet-500/15", text: "text-violet-300" },
}
const UNKNOWN_ACTION = { code: "QUEST", bg: "bg-zinc-500/15", text: "text-zinc-300" }

export default function QuestDetailPage() {
  const params = useParams()
  const questId = parseInt(params.id as string, 10)
  const { open } = useAppKit()
  const { wallet, isCreditcoinNetwork } = useReownWallet()
  const isConnected = wallet.isConnected

  const { quest, loading: questLoading, error: questError, refetch: refetchQuest } =
    useQuest(Number.isNaN(questId) ? null : questId)
  const { progress, loading: progressLoading, refetch: refetchProgress } =
    useQuestProgress(questId, wallet.address ?? null)
  const { acceptQuest, loading: acceptLoading } = useQuestContract()

  // The rule comes from QuestASC itself, not from our cache: it is what the chain will enforce.
  const verificationRule = useVerificationRule(Number.isNaN(questId) ? undefined : questId)
  const proofStatus = useProofStatus(
    Number.isNaN(questId) ? undefined : questId,
    wallet.address ?? undefined
  )

  const [metadata, setMetadata] = useState<QuestMetadata | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [hasAccepted, setHasAccepted] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    const uri = quest?.metadataURI
    if (!uri?.startsWith("ipfs://") || uri === PLACEHOLDER_METADATA_URI) {
      setMetadata(null)
      return
    }
    setMetadataLoading(true)
    fetchIPFSMetadata(uri)
      .then(setMetadata)
      .catch(() => setMetadata(null))
      .finally(() => setMetadataLoading(false))
  }, [quest?.metadataURI])

  const handleConnectWallet = () => open({ view: "Connect" })
  const handleSwitchNetwork = () => open({ view: "Networks" })

  const handleAcceptQuest = async () => {
    if (!isConnected || !wallet.address) {
      setVerificationResult({
        success: false,
        message: "Please connect your wallet first",
      })
      return
    }
    if (!isCreditcoinNetwork) {
      setVerificationResult({
        success: false,
        message: "Please switch to Creditcoin Testnet",
      })
      return
    }
    try {
      setVerificationResult(null)
      const result = await acceptQuest(questId)
      setHasAccepted(true)
      setVerificationResult({
        success: true,
        message: `Quest accepted! Transaction: ${result.transactionHash}`,
      })
      setTimeout(() => refetchProgress(), 2000)
      setTimeout(() => refetchProgress(), 4000)
      setTimeout(() => refetchProgress(), 6000)
    } catch (err) {
      setVerificationResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to accept quest",
      })
    }
  }

  if (Number.isNaN(questId) || questId <= 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-20 pt-24">
        <p className="text-zinc-400">Invalid quest</p>
        <Link href="/quests" className="ml-4 text-white underline">
          Back to Quests
        </Link>
      </main>
    )
  }

  if (questLoading || !quest) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 pb-20 pt-24">
        {questError ? (
          <div className="text-center">
            <p className="text-zinc-400">{questError}</p>
            <Link href="/quests" className="mt-4 inline-block text-white underline">
              Back to Quests
            </Link>
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        )}
      </main>
    )
  }

  const questType = detectQuestType(metadata)
  const title = metadata?.title ?? quest.title ?? `Quest #${quest.questId}`
  const summary = metadata?.summary ?? metadata?.metadataSnippet ?? ""
  const goal = metadata?.goal ?? ""
  const difficulty = metadata?.difficulty ?? "medium"
  const style = ACTION_STYLE[quest.action?.actionType ?? -1] ?? UNKNOWN_ACTION
  const isNativeQuest = isNativeAction(quest.action?.actionType ?? -1)

  const rewardAmount = metadata?.reward?.amount ?? quest.rewardVael ?? "0"
  const rewardToken = metadata?.reward?.token ?? "VAEL"
  const badgeLevel =
    metadata?.reward?.badgeLevel ?? Number(quest.badgeLevel ?? 1)

  const bannerUri = metadata?.banner ?? ""
  const bannerUrl = bannerUri.startsWith("ipfs://")
    ? ipfsToHttp(bannerUri)
    : bannerUri || ""
  // As on a campaign card: a gateway that rate-limits or has not propagated must fall back to the
  // action's own artwork rather than leaving an empty frame where the picture should be.
  const [bannerFailed, setBannerFailed] = useState(false)
  const hasBanner = !!bannerUrl && !bannerFailed
  const isIpfsBanner = bannerUrl.includes("ipfs.io") || bannerUrl.includes("ipfs/")

  const acceptedCount = quest.acceptedCount ?? 0
  const completedCount = quest.completedCount ?? 0

  const requirements = metadata?.requirements ?? []
  const steps = metadata?.steps ?? []
  const howItWorks = metadata?.parameters?.actionPlan
    ? [metadata.parameters.actionPlan]
    : metadata?.extraNotes
      ? [metadata.extraNotes]
      : []

  const isAccepted = progress?.accepted ?? false
  const isCompleted = progress?.completed ?? false

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full space-y-8">
        <Link
          href="/quests"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quests
        </Link>

        {/* Hero */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-400">
            <span
              className={`inline-flex items-center gap-2 rounded px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${style.bg} ${style.text}`}
            >
              {style.code}
            </span>
            {questType && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  {questType}
                </span>
              </>
            )}
            <span className="text-zinc-600">•</span>
            <span className="capitalize text-zinc-400">{difficulty}</span>
            <span className="text-zinc-600">•</span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-500" />
              {formatCompact(acceptedCount)} participants
            </span>
            {metadata?.chain && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  {metadata.chain}
                </span>
              </>
            )}
          </div>

          <div className="flex items-start gap-4">
            <ActionArt actionType={quest.action?.actionType ?? -1} size={64} className="mt-1" />
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-semibold md:text-4xl">{title}</h1>
              {metadata?.projectName && (
                <p className="text-base font-medium text-zinc-400 md:text-lg">
                  {metadata.projectName}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Main layout */}
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
              <div className="relative aspect-[2/1] w-full bg-zinc-900 sm:aspect-video">
                {hasBanner ? (
                  <Image
                    src={bannerUrl}
                    alt={title}
                    fill
                    className="object-cover opacity-90"
                    priority
                    onError={() => setBannerFailed(true)}
                    unoptimized={isIpfsBanner}
                  />
                ) : (
                  // No pinned banner: the action's own artwork, which at least says what the quest
                  // asks for. A giant letter said nothing.
                  <ActionBanner
                    actionType={quest.action?.actionType ?? -1}
                    className="absolute inset-0 rounded-none border-0"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              </div>

              <div className="p-5 md:p-6">
                <div className="inline-flex items-center gap-2 rounded border border-[#1A1A1A] bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  {metadata?.chain ?? "Creditcoin"} Quest
                </div>

                {metadataLoading ? (
                  <div className="mt-4 flex items-center gap-2 text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading metadata...</span>
                  </div>
                ) : (
                  <>
                    {summary && (
                      <p className="mt-4 text-sm leading-relaxed text-zinc-300 md:text-[15px]">
                        {summary}
                      </p>
                    )}
                    {goal && (
                      <div className="mt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Goal
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                          {goal}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Requirements */}
            {requirements.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-white md:text-base">
                  Requirements
                </h2>
                <div className="space-y-3">
                  {requirements.map((req, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded border border-[#1A1A1A] bg-black p-4"
                    >
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-900 text-zinc-300">
                        <Info className="h-4 w-4" />
                      </span>
                      <p className="text-sm text-zinc-300">{req}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Steps */}
            {steps.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-white md:text-base">
                  Quest Steps
                </h2>
                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-1 rounded border border-[#1A1A1A] bg-black p-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {step.title}
                        </span>
                      </div>
                      <p className="pl-8 text-sm text-zinc-400">
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action plan & success criteria */}
            {metadata?.parameters &&
              (metadata.parameters.actionPlan ||
                metadata.parameters.successCriteria ||
                metadata.parameters.evidenceHint) && (
                <div className="space-y-4 rounded border border-[#1A1A1A] bg-black p-5">
                  {metadata.parameters.actionPlan && (
                    <div>
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Action Plan
                      </h3>
                      <p className="mt-1 text-sm text-zinc-300">
                        {metadata.parameters.actionPlan}
                      </p>
                    </div>
                  )}
                  {metadata.parameters.successCriteria && (
                    <div>
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Success Criteria
                      </h3>
                      <p className="mt-1 text-sm text-zinc-300">
                        {metadata.parameters.successCriteria}
                      </p>
                    </div>
                  )}
                  {metadata.parameters.evidenceHint && (
                    <div className="rounded bg-zinc-900/50 p-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Evidence Hint
                      </h3>
                      <p className="mt-1 text-xs text-zinc-400">
                        {metadata.parameters.evidenceHint}
                      </p>
                    </div>
                  )}
                </div>
            )}

            {/* Verification result */}
            {verificationResult && (
              <div
                className={`flex items-start gap-3 rounded border p-4 ${
                  verificationResult.success
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-rose-500/30 bg-rose-500/10"
                }`}
              >
                {verificationResult.success ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                )}
                <p
                  className={
                    verificationResult.success
                      ? "text-sm font-medium text-emerald-300"
                      : "text-sm font-medium text-rose-300"
                  }
                >
                  {verificationResult.message}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:col-span-4">
            <div className="rounded border border-[#1A1A1A] bg-black">
              <div className="border-b border-[#1A1A1A] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Quest rewards
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Token reward
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {rewardAmount} {rewardToken}
                  </div>
                  {/* Who actually pays is derived from the quest's campaign id, not from the
                      struct's rewardToken, which names the protocol's vault token for every quest.
                      See docs/ATTESTCOIN_INTEGRATION.md section 8. */}
                  <div className="text-[11px] text-zinc-500">
                    Paid by{" "}
                    <span className={quest.fundedBy === "escrow" ? "text-emerald-400" : "text-zinc-300"}>
                      {quest.fundedBy === "escrow" ? "Campaign escrow" : "Reward vault"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Badge level
                  </div>
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-400">
                      Level {badgeLevel} Badge NFT
                    </span>
                  </div>
                </div>

                {metadata?.campaignReward?.amount && metadata.campaignReward.token && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      Campaign reward
                    </div>
                    <div className="text-lg font-semibold text-emerald-400">
                      {metadata.campaignReward.amount} {metadata.campaignReward.token}
                    </div>
                  </div>
                )}

                <div className="space-y-2 border-t border-[#1A1A1A] pt-4 text-[11px]">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Status</span>
                    <span className="text-xs font-semibold text-zinc-300">
                      {quest.status ?? "Active"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Accepted</span>
                    <span className="text-xs font-semibold text-white">
                      {formatCompact(acceptedCount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Completed</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {formatCompact(completedCount)}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                {!isConnected && (
                  <Button
                    onClick={handleConnectWallet}
                    className="w-full rounded bg-white text-black hover:bg-white/90"
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </Button>
                )}

                {isConnected && !isCreditcoinNetwork && (
                  <Button
                    onClick={handleSwitchNetwork}
                    className="w-full rounded border-yellow-500/50 bg-transparent text-yellow-500 hover:bg-yellow-500/10"
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Switch to Creditcoin Testnet
                  </Button>
                )}

                {isConnected &&
                  isCreditcoinNetwork &&
                  !(isAccepted || hasAccepted) &&
                  !isCompleted && (
                    <Button
                      onClick={handleAcceptQuest}
                      disabled={acceptLoading || progressLoading}
                      className="w-full rounded font-semibold bg-white text-black hover:bg-white/90"
                    >
                      {acceptLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Accepting...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Accept Quest
                        </>
                      )}
                    </Button>
                  )}

                {(isAccepted || hasAccepted) && !isCompleted && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-300">
                      Quest Accepted
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {isNativeQuest
                        ? "This one happens on Creditcoin. Perform it below and the reward lands in the same transaction."
                        : "Your Sepolia block window is anchored. Act now, then prove it."}
                    </p>
                  </div>
                )}

                {(isAccepted || hasAccepted) && !isCompleted && verificationRule && (
                  <div className="pt-2">
                    {/* A quest belongs to exactly one completion path, fixed at creation by its
                        action type. Offering the proof form on a native quest would be offering a
                        step that cannot work. */}
                    {isNativeQuest ? (
                      <NativeActionPanel
                        questId={BigInt(questId)}
                        rule={verificationRule}
                        onCompleted={() => {
                          void refetchQuest()
                          void refetchProgress()
                        }}
                      />
                    ) : (
                      <ClaimPanel
                        questId={BigInt(questId)}
                        rule={verificationRule}
                        status={proofStatus}
                      />
                    )}
                  </div>
                )}

                {isCompleted && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-300">
                      Quest Completed!
                    </p>
                  </div>
                )}

                {isConnected &&
                  isCreditcoinNetwork &&
                  (isAccepted || hasAccepted) &&
                  !isCompleted && (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full rounded border-zinc-700 text-zinc-300"
                    >
                      <Link href="/quests">View other quests</Link>
                    </Button>
                  )}
              </div>
            </div>

            {howItWorks.length > 0 && (
              <div className="rounded border border-[#1A1A1A] bg-black p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  How it works
                </div>
                <ul className="space-y-2 text-sm text-zinc-400">
                  {howItWorks.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-zinc-600" />
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold md:text-2xl">
              Explore more quests
            </h2>
            <Button
              asChild
              variant="default"
              className="rounded font-semibold bg-white text-black hover:bg-white/90 w-fit"
            >
              <Link href="/quests">
                View all quests
                <MoveRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <PartnershipCarousel showHeading={false} />
        </section>
      </div>
    </main>
  )
}
