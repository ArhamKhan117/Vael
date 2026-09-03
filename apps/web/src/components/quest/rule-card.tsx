"use client"

import type { ReactNode } from "react"
import { formatUnits } from "viem"

import { ACTION_LABELS, ActionType, VerificationRule } from "@/lib/attestcoin/types"
import { SEPOLIA_EXPLORER_URL } from "@/lib/chains"
import { ruleAmountUnit } from "@/lib/tokens"

interface RuleCardProps {
  rule: VerificationRule
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * The verification rule, in plain language.
 *
 * Shown before a player acts, not after, because the rule is the contract between them and the
 * chain: it is exactly what QuestASC will check, and it cannot change once the quest exists.
 * Hiding it would make a failed claim feel arbitrary.
 */
export function RuleCard({ rule }: RuleCardProps) {
  // The units come from the rule's own token, never from the quest's reward token. Passing the
  // reward token in here printed a portal quest's 0.0005 ETH minimum as "0.0005 VAEL".
  const unit = ruleAmountUnit(rule.token, rule.actionType)
  const rows: { label: string; value: ReactNode }[] = [
    { label: "Action", value: ACTION_LABELS[rule.actionType] ?? `Type ${rule.actionType}` },
    {
      label: "Must be emitted by",
      value: (
        <a
          href={`${SEPOLIA_EXPLORER_URL}/address/${rule.emitter}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sky-400 hover:underline"
        >
          {short(rule.emitter)}
        </a>
      ),
    },
  ]

  if (rule.minAmount > 0n) {
    rows.push({
      label: "Minimum amount",
      value: unit.known
        ? `${formatUnits(rule.minAmount, unit.decimals)} ${unit.symbol}`
        : `${rule.minAmount.toString()} units of ${short(rule.token)}`,
    })
  }
  if (rule.playerMustMatch) {
    rows.push({
      label: "Who must act",
      value: "You. The proof reads the address from the event's indexed topic, not the gas payer.",
    })
  }
  rows.push({
    label: "When",
    value:
      rule.minSourceBlock > 0n
        ? `Sepolia block above ${rule.minSourceBlock.toString()}`
        : "After the Sepolia block attested when you accepted",
  })

  return (
    <div className="rounded border border-[#1A1A1A] bg-black">
      <div className="border-b border-[#1A1A1A] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">What the chain will check</h3>
        <p className="mt-1 text-xs text-zinc-500">
          QuestASC verifies these against the proved transaction. No backend is involved.
        </p>
      </div>
      <dl className="divide-y divide-[#1A1A1A]">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 px-4 py-3 text-xs">
            <dt className="w-40 shrink-0 text-zinc-500">{row.label}</dt>
            <dd className="text-zinc-200">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Where to go to perform an action Vael does not own a contract for. */
export function actionDeepLink(actionType: ActionType): { href: string; label: string } | null {
  switch (actionType) {
    case ActionType.UniswapSwap:
      return { href: "https://app.uniswap.org/swap?chain=sepolia", label: "Open Uniswap" }
    case ActionType.AaveSupply:
    case ActionType.AaveBorrow:
      return { href: "https://app.aave.com/?marketName=proto_sepolia_v3", label: "Open Aave" }
    case ActionType.Erc20Transfer:
      return { href: SEPOLIA_EXPLORER_URL, label: "Transfer from your wallet" }
    default:
      return null
  }
}
