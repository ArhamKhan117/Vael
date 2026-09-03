"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ActionType, ProofStatus, VerificationRule } from "@/lib/attestcoin/types"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"
import { RuleCard, actionDeepLink } from "./rule-card"
import { ProofTimeline } from "./proof-timeline"
import { SelfClaimButton } from "./self-claim-button"
import { PortalCheckInButton } from "./portal-check-in-button"

interface ClaimPanelProps {
  questId: bigint
  rule: VerificationRule
  status: ProofStatus
  onClaimed?: (creditcoinTxHash: string) => void
}

/**
 * Everything a player needs between accepting a quest and holding the reward.
 *
 * Three parts, in the order they are used: what the chain will check, how to do the thing, and how
 * to prove it. The proof step is deliberately available to the player directly, not only through
 * our worker, because a platform that stops working when its servers do is the thing Vael exists
 * to replace.
 */
export function ClaimPanel({ questId, rule, status, onClaimed }: ClaimPanelProps) {
  const [sourceTxHash, setSourceTxHash] = useState(status.sourceTxHash ?? "")
  const isPortal = rule.actionType === ActionType.Portal
  const deepLink = actionDeepLink(rule.actionType)
  const validHash = /^0x[0-9a-fA-F]{64}$/.test(sourceTxHash)

  return (
    <div className="space-y-4">
      <RuleCard rule={rule} />

      <div className="rounded border border-[#1A1A1A] bg-black">
        <div className="border-b border-[#1A1A1A] px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Do it on Ethereum Sepolia</h3>
          <p className="mt-1 text-xs text-zinc-500">
            This is a real transaction on Ethereum. Vael reads it, it does not simulate it.
          </p>
        </div>
        <div className="space-y-3 px-4 py-3">
          {isPortal && CONTRACT_ADDRESSES.QUEST_PORTAL ? (
            <PortalCheckInButton
              questId={questId}
              minAmount={rule.minAmount}
              onSent={(hash) => setSourceTxHash(hash)}
            />
          ) : deepLink ? (
            <Button
              asChild
              variant="outline"
              className="w-full rounded border-zinc-700 text-zinc-200"
            >
              <Link href={deepLink.href} target="_blank" rel="noopener noreferrer">
                {deepLink.label}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}

          {!isPortal && (
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Perform the action from the wallet assigned to this quest. The proof reads your
              address from the event, so acting through a different wallet will not count.
            </p>
          )}
        </div>
      </div>

      <ProofTimeline status={status} />

      <div className="rounded border border-[#1A1A1A] bg-black">
        <div className="border-b border-[#1A1A1A] px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Claim it yourself</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Paste your Sepolia transaction. The proof is fetched in your browser and submitted from
            your wallet.
          </p>
        </div>
        <div className="space-y-3 px-4 py-3">
          <Input
            value={sourceTxHash}
            onChange={(event) => setSourceTxHash(event.target.value.trim())}
            placeholder="0x… your Sepolia transaction hash"
            spellCheck={false}
            className="rounded border-zinc-800 bg-black font-mono text-xs text-white"
          />
          {validHash ? (
            <SelfClaimButton
              questId={questId}
              sourceTxHash={sourceTxHash}
              {...(onClaimed ? { onClaimed } : {})}
            />
          ) : (
            <p className="text-[11px] text-zinc-600">
              {sourceTxHash.length > 0
                ? "That does not look like a transaction hash."
                : "Waiting for a transaction hash."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
