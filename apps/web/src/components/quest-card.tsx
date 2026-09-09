"use client"

import Link from "next/link"
import { MoveRight } from "lucide-react"

import { ActionArt } from "@/components/action-art"
import { Button } from "@/components/ui/button"
import { isNativeAction } from "@/lib/attestcoin/types"
import type { ChainQuest, ProofStage } from "@/lib/api"

/**
 * One quest, as the chain describes it.
 *
 * The three lines that matter to a player are the three states of a quest: has it been accepted on
 * Creditcoin, what has to happen on the source chain, and where the proof of that action has got
 * to. Everything else on the card is context for those three.
 */

const CADENCE_STYLE: Record<
  ChainQuest["cadence"],
  { code: string; label: string; chip: string }
> = {
  daily: { code: "D", label: "Daily", chip: "bg-sky-500/15 text-sky-400" },
  weekly: { code: "W", label: "Weekly", chip: "bg-indigo-500/15 text-indigo-400" },
  campaign: { code: "CP", label: "Partner", chip: "bg-amber-500/15 text-amber-400" },
  open: { code: "Q", label: "Open", chip: "bg-zinc-500/15 text-zinc-300" },
}

const PROOF_LABEL: Record<ProofStage, string> = {
  waiting: "No action yet",
  detected: "Action seen",
  attesting: "Waiting for attestation",
  proving: "Building proof",
  submitted: "Proof submitted",
  verified: "Proof verified",
  failed: "Proof failed",
}

const PROOF_DOT: Record<ProofStage, string> = {
  waiting: "bg-zinc-600",
  detected: "bg-sky-400",
  attesting: "bg-sky-400",
  proving: "bg-amber-400",
  submitted: "bg-amber-400",
  verified: "bg-emerald-400",
  failed: "bg-red-400",
}

function short(address: string) {
  return address && address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export function QuestCard({
  quest,
  /** The connected wallet, so a quest assigned to it can say so. Absent when nobody is connected. */
  viewer,
}: {
  quest: ChainQuest
  viewer?: string | null
}) {
  const cadence = CADENCE_STYLE[quest.cadence] ?? CADENCE_STYLE.open
  const stage = quest.proof.state
  const mine =
    !!viewer && !!quest.participant && quest.participant.toLowerCase() === viewer.toLowerCase()

  return (
    <div
      data-testid={`quest-card-${quest.questId}`}
      className={`flex h-full flex-col justify-between rounded border p-6 ${
        mine ? "border-sky-500/40 bg-sky-500/[0.03]" : "border-[#1A1A1A]"
      }`}
    >
      <div className="space-y-4">
        {/* The art says what the action is; the chip says how often it comes round. A letter in a
            circle said neither, which is why it is gone. */}
        <div className="flex items-start gap-4">
          <ActionArt actionType={quest.action.actionType} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${cadence.chip}`}>
                  {cadence.label}
                </span>
                {mine && (
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-300">
                    Yours
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded border border-zinc-700 px-2 py-0.5">
                ID: {quest.questId}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-white">{quest.title}</h3>
          </div>
        </div>

        <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400">
          {/* The fallback names the action the rule checks, not Quest.category, which the
              agent sets to Swap for every quest and would call a portal check-in a swap. */}
          {quest.description || `${quest.action.actionName} on ${quest.action.chain}.`}
        </p>

        <div className="space-y-2 border-t border-[#1A1A1A] pt-4 text-[11px]">
          <div className="flex items-center justify-between text-zinc-500">
            <span>REWARD</span>
            <span className="text-xs font-semibold text-white">
              {Number(quest.rewardVael).toLocaleString()} VAEL
            </span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>PAID BY</span>
            <span className="text-xs text-white">
              {quest.fundedBy === "escrow" ? "Campaign escrow" : "Reward vault"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 text-zinc-500">
            <span className="shrink-0">DO THIS</span>
            <span className="text-right text-xs text-white">
              {quest.action.actionName}
              <span className="block text-[10px] text-zinc-500">
                min {quest.action.minAmountLabel} · {short(quest.action.emitter)}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>SETTLED BY</span>
            <span className="text-xs text-white">
              {isNativeAction(quest.action.actionType)
                ? "NativePortal, in one transaction"
                : "QuestASC, against an Attestcoin proof"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
          <span
            className={`rounded border px-2 py-0.5 ${
              quest.accepted
                ? "border-emerald-500/40 text-emerald-400"
                : "border-zinc-700 text-zinc-400"
            }`}
          >
            {quest.accepted ? "Accepted" : "Not accepted"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-2 py-0.5 text-zinc-300">
            <span className={`h-1.5 w-1.5 rounded-full ${PROOF_DOT[stage]}`} />
            {PROOF_LABEL[stage]}
          </span>
        </div>
      </div>

      {/* The board is public, so the button says what this visitor can actually do. Accepting is
          the one thing that needs a wallet, and it needs *this* quest's wallet: a quest is assigned
          to an address at creation, so somebody else's quest is readable but never acceptable. */}
      <Button
        asChild
        variant="default"
        className={`mt-5 rounded font-semibold ${
          mine || quest.completed
            ? "bg-white text-black hover:bg-white/80"
            : "border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900"
        }`}
      >
        <Link href={`/quests/${quest.questId}`}>
          {quest.completed
            ? "View proof"
            : mine
              ? quest.accepted
                ? "Continue quest"
                : "Accept quest"
              : viewer
                ? "View quest"
                : "Connect to accept"}
          <MoveRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}

export function QuestGridEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-sm text-zinc-500">
      {children}
    </div>
  )
}
