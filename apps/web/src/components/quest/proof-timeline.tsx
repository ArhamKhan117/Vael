"use client"

import { Check, Circle, Loader2, X } from "lucide-react"

import { ProofStage, ProofStatus } from "@/lib/attestcoin/types"
import { CREDITCOIN_EXPLORER_URL, SEPOLIA_EXPLORER_URL } from "@/lib/chains"
import { cn } from "@/lib/utils"

const ORDER: ProofStage[] = ["detected", "attesting", "proving", "submitted", "verified"]

const COPY: Record<ProofStage, { title: string; detail: string }> = {
  not_started: { title: "Not started", detail: "Perform the action on Ethereum Sepolia." },
  detected: { title: "Seen on Sepolia", detail: "Your transaction is mined." },
  attesting: {
    title: "Waiting for attestation",
    detail: "Attestors record the Sepolia block on Creditcoin. Usually about eight minutes.",
  },
  proving: { title: "Building the proof", detail: "Merkle and continuity proof for your transaction." },
  submitted: { title: "Submitted to Creditcoin", detail: "QuestASC is verifying the proof." },
  verified: {
    title: "Verified on-chain",
    detail: "The contract checked the proof itself and released the reward.",
  },
  failed: { title: "Failed", detail: "See the reason below." },
}

export function stageIndex(stage: ProofStage): number {
  return ORDER.indexOf(stage)
}

/**
 * Where a claim has got to.
 *
 * Every stage is something that actually happened, in order, with a chain link wherever there is
 * one. The attestation wait is the long one and is labelled as such: a player staring at an
 * unexplained eight-minute pause assumes it is broken.
 */
export function ProofTimeline({ status }: { status: ProofStatus }) {
  const current = stageIndex(status.stage)
  const failed = status.stage === "failed"

  return (
    <div className="rounded border border-[#1A1A1A] bg-black">
      <div className="border-b border-[#1A1A1A] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Proof status</h3>
      </div>
      <ol className="divide-y divide-[#1A1A1A]">
        {ORDER.map((stage, i) => {
          const done = current > i
          const active = current === i && !failed
          return (
            <li key={stage} className="flex gap-3 px-4 py-3">
              <span className="mt-0.5 shrink-0">
                {done ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                ) : (
                  <Circle className="h-4 w-4 text-zinc-700" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-medium",
                    done && "text-emerald-500",
                    active && "text-white",
                    !done && !active && "text-zinc-600"
                  )}
                >
                  {COPY[stage].title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{COPY[stage].detail}</p>

                {stage === "detected" && status.sourceTxHash && (
                  <a
                    href={`${SEPOLIA_EXPLORER_URL}/tx/${status.sourceTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[11px] text-sky-400 hover:underline"
                  >
                    {status.sourceTxHash.slice(0, 10)}…{status.sourceTxHash.slice(-6)}
                  </a>
                )}
                {stage === "attesting" &&
                  status.attestedHeight !== undefined &&
                  status.sourceBlock !== undefined && (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Attested to block {status.attestedHeight.toLocaleString()}
                      {status.attestedHeight <= status.sourceBlock
                        ? `, ${(status.sourceBlock - status.attestedHeight + 1).toLocaleString()} to go`
                        : ", your block is covered"}
                    </p>
                  )}
                {stage === "verified" && status.creditcoinTxHash && (
                  <a
                    href={`${CREDITCOIN_EXPLORER_URL}/tx/${status.creditcoinTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[11px] text-sky-400 hover:underline"
                  >
                    {status.creditcoinTxHash.slice(0, 10)}…{status.creditcoinTxHash.slice(-6)}
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {failed && status.error && (
        <div className="flex gap-2 border-t border-red-900/40 bg-red-950/20 px-4 py-3">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-400">{status.error}</p>
        </div>
      )}
    </div>
  )
}
