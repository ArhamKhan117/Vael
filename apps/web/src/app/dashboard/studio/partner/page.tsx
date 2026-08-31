"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { formatUnits, keccak256, parseUnits, stringToHex } from "viem"
import { useAccount, useWriteContract } from "wagmi"

import { Button } from "@/components/ui/button"
import { CREDITCOIN_CHAIN_ID, CREDITCOIN_EXPLORER_URL } from "@/lib/chains"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"
import { waitForReceipt } from "@/lib/reader"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

const ESCROW_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const

/** Mirrors VaelTypes.ActionType. */
const ACTIONS = [
  { value: 0, label: "Portal check-in" },
  { value: 1, label: "Uniswap v3 swap" },
  { value: 2, label: "ERC-20 transfer" },
  { value: 3, label: "Aave v3 supply" },
  { value: 4, label: "Aave v3 borrow" },
]

interface CampaignQuest {
  questId: number
  metadataURI: string
  rewardPerParticipant: string
  assignedParticipant: string
  status: number
  accepted: boolean
  completed: boolean
  actionType: number
  minAmount: string
  // The two arms must not both accept "verified", or TypeScript cannot tell them apart and every
  // field read below becomes an error.
  proof:
    | { state: "verified"; replayKey: string; sourceBlock: number; creditcoinBlock: number; at: string }
    | {
        state: "waiting" | "detected" | "attesting" | "proving" | "submitted" | "failed"
        sourceTxHash?: string
        attempts?: number
        error?: string | null
        at?: string
      }
}

interface CampaignView {
  campaignId: string
  onChainCampaignId: string
  escrowKey: string
  poolBalance: string
  quests: CampaignQuest[]
}

function vael(wei: string) {
  return Number(formatUnits(BigInt(wei || "0"), 18)).toLocaleString()
}

/**
 * The partner side of a campaign.
 *
 * Funding is the only step that needs the partner's wallet. Everything after it is proof-gated:
 * publishing writes the quests and their verification rules to the chain, and from then on nothing
 * can move the pool except QuestASC, after the Attestcoin precompile has verified a real
 * transaction on Ethereum. There is no button on this page that pays anybody.
 */
export default function PartnerCampaignPage() {
  return (
    <Suspense fallback={null}>
      <PartnerCampaignPageInner />
    </Suspense>
  )
}

function PartnerCampaignPageInner() {
  const { isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const router = useRouter()
  const searchParams = useSearchParams()

  // The campaign lives in the URL, so a reload keeps looking at the same one and the page can be
  // linked to. Losing it on refresh made the proof state impossible to watch.
  const [campaignId, setCampaignId] = useState(searchParams.get("campaign") ?? "")
  const [budget, setBudget] = useState("1000")
  const [player, setPlayer] = useState("")
  const [actionType, setActionType] = useState(0)
  const [minAmount, setMinAmount] = useState("0.0005")
  const [reward, setReward] = useState("250")

  const [view, setView] = useState<CampaignView | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const escrowKey = useMemo(
    () => (campaignId ? keccak256(stringToHex(campaignId)) : undefined),
    [campaignId]
  )

  const refresh = useCallback(async () => {
    if (!campaignId) return
    try {
      const response = await fetch(`${API_BASE_URL}/partner/campaign/${encodeURIComponent(campaignId)}`)
      if (!response.ok) return
      setView((await response.json()) as CampaignView)
    } catch {
      // Leave the last good view on screen.
    }
  }, [campaignId])

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 15_000)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    const current = searchParams.get("campaign") ?? ""
    if (campaignId && campaignId !== current) {
      router.replace(`/dashboard/studio/partner?campaign=${encodeURIComponent(campaignId)}`)
    }
  }, [campaignId, router, searchParams])

  const fund = async () => {
    setError(null)
    setNotice(null)
    if (!escrowKey) return
    const amount = parseUnits(budget || "0", 18)
    if (amount === 0n) return

    try {
      setBusy("approve")
      const approveHash = await writeContractAsync({
        abi: ERC20_ABI,
        address: CONTRACT_ADDRESSES.VAEL_TOKEN,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.CAMPAIGN_ESCROW, amount],
        chainId: CREDITCOIN_CHAIN_ID,
      })
      // The approve has to land before the deposit is estimated, or the estimate runs against an
      // allowance that is still zero and the deposit reverts before it is ever signed.
      setBusy("waiting")
      await waitForReceipt(approveHash)

      setBusy("deposit")
      const hash = await writeContractAsync({
        abi: ESCROW_ABI,
        address: CONTRACT_ADDRESSES.CAMPAIGN_ESCROW,
        functionName: "deposit",
        args: [escrowKey, amount],
        chainId: CREDITCOIN_CHAIN_ID,
      })
      setNotice(`Deposited. ${hash.slice(0, 10)}…`)
      setTimeout(refresh, 5000)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(/User rejected|denied/i.test(message) ? "Rejected in the wallet." : message)
    } finally {
      setBusy(null)
    }
  }

  const publish = async () => {
    setError(null)
    setNotice(null)
    setBusy("publish")
    try {
      const response = await fetch(`${API_BASE_URL}/partner/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          participant: player,
          templates: [
            {
              actionType,
              emitter: CONTRACT_ADDRESSES.QUEST_PORTAL,
              token: "0x0000000000000000000000000000000000000000",
              minAmount: parseUnits(minAmount || "0", 18).toString(),
              rewardPerParticipant: parseUnits(reward || "0", 18).toString(),
              badgeLevel: 1,
              playerMustMatch: true,
              category: 0,
              metadataURI: "ipfs://QmfDNGL7khGCv8yd1zzNN93oVmp9YcSbPcndrY8obY82qb",
              sourceChainKey: 1,
            },
          ],
        }),
      })
      const body = (await response.json()) as { message?: string; created?: { questId: number }[] }
      if (!response.ok) {
        setError(body.message ?? "publish failed")
        return
      }
      setNotice(`Published quest ${body.created?.map((q) => q.questId).join(", ")}.`)
      setTimeout(refresh, 3000)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(null)
    }
  }

  const retry = async (submissionId: string) => {
    setError(null)
    setBusy(`retry-${submissionId}`)
    try {
      const response = await fetch(`${API_BASE_URL}/partner/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      })
      const body = (await response.json()) as { message?: string }
      setNotice(response.ok ? "Queued for another attempt." : (body.message ?? "retry failed"))
      setTimeout(refresh, 3000)
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">Campaign</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Fund a pool, publish the quests it pays for, and watch each one reach a proof. Funding
            is the only step here that spends anything. After it, nothing can move the pool except
            QuestASC, and only once the Attestcoin precompile has verified a real transaction on
            Ethereum, so there is no button on this page that pays a player.
          </p>
          <Link href="/dashboard/studio" className="mt-2 inline-block text-[11px] text-zinc-500 hover:text-zinc-300">
            Back to Studio
          </Link>
        </header>

        {notice && (
          <p className="rounded border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-300">{notice}</p>
        )}
        {error && (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">{error}</p>
        )}

        <section className="rounded border border-[#1A1A1A] bg-black p-5">
          <h2 className="text-sm font-semibold text-white">1. Fund the pool</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Campaign id</span>
              <input
                data-testid="campaign-id"
                value={campaignId}
                onChange={(event) => setCampaignId(event.target.value.trim())}
                placeholder="my-campaign-2026"
                className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Budget, in VAEL</span>
              <input
                data-testid="budget"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
            </label>
          </div>
          {escrowKey && (
            <p className="mt-2 font-mono text-[10px] text-zinc-600">escrow key {escrowKey}</p>
          )}
          <Button
            data-testid="fund"
            onClick={fund}
            disabled={!isConnected || !campaignId || busy !== null}
            className="mt-3 rounded bg-white text-black hover:bg-white/90"
          >
            {busy === "approve"
              ? "Approving…"
              : busy === "waiting"
                ? "Waiting for the approval…"
                : busy === "deposit"
                  ? "Depositing…"
                  : "Approve and deposit"}
          </Button>
          {!isConnected && <p className="mt-2 text-[11px] text-zinc-600">Connect a wallet to fund.</p>}
        </section>

        <section className="rounded border border-[#1A1A1A] bg-black p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">2. Publish a quest</h2>
            <span data-testid="pool" className="text-[11px] text-zinc-500">
              Pool on chain: {view ? `${vael(view.poolBalance)} VAEL` : "—"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            The rule goes on chain with the quest, so what counts is fixed before anybody plays.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Player address</span>
              <input
                data-testid="player"
                value={player}
                onChange={(event) => setPlayer(event.target.value.trim())}
                placeholder="0x…"
                className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Action</span>
              <select
                data-testid="action"
                value={actionType}
                onChange={(event) => setActionType(Number(event.target.value))}
                className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600"
              >
                {ACTIONS.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Minimum amount</span>
              <input
                data-testid="min-amount"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Reward, in VAEL</span>
              <input
                data-testid="reward"
                value={reward}
                onChange={(event) => setReward(event.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
            </label>
          </div>

          <Button
            data-testid="publish"
            onClick={publish}
            disabled={!campaignId || !/^0x[a-fA-F0-9]{40}$/.test(player) || busy !== null}
            className="mt-3 rounded bg-white text-black hover:bg-white/90"
          >
            {busy === "publish" ? "Publishing…" : "Publish on chain"}
          </Button>
        </section>

        <section className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
          <header className="border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">3. Proof state</h2>
            <p className="mt-1 text-[11px] text-zinc-600">
              From the index for what the chain verified, and from the worker&apos;s queue for what
              is still in flight.
            </p>
          </header>
          {!view || view.quests.length === 0 ? (
            <p className="px-5 py-6 text-xs text-zinc-500">
              {campaignId ? "No quests published for this campaign yet." : "Enter a campaign id."}
            </p>
          ) : (
            <ul data-testid="quests" className="divide-y divide-[#1A1A1A]">
              {view.quests.map((quest) => {
                // Narrowed here rather than inside the JSX: a closure loses the discriminant.
                const verified = quest.proof.state === "verified" ? quest.proof : null
                const failed = quest.proof.state === "failed" ? quest.proof : null
                return (
                <li key={quest.questId} className="px-5 py-3 text-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-zinc-200">
                      Quest {quest.questId} · {ACTIONS[quest.actionType]?.label ?? quest.actionType} ·{" "}
                      {vael(quest.rewardPerParticipant)} VAEL
                    </span>
                    <span
                      className={
                        quest.proof.state === "verified"
                          ? "text-emerald-400"
                          : quest.proof.state === "failed"
                            ? "text-red-400"
                            : "text-amber-300"
                      }
                    >
                      {quest.proof.state}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {quest.accepted ? "accepted" : "not accepted"} ·{" "}
                    {quest.completed ? "completed" : "open"} · player{" "}
                    {quest.assignedParticipant.slice(0, 6)}…{quest.assignedParticipant.slice(-4)}
                  </p>
                  {verified && (
                    <a
                      href={`${CREDITCOIN_EXPLORER_URL}/block/${verified.creditcoinBlock}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block font-mono text-[10px] text-sky-400 hover:underline"
                    >
                      verified in block {verified.creditcoinBlock.toLocaleString()} from Sepolia{" "}
                      {verified.sourceBlock.toLocaleString()}
                    </a>
                  )}
                  {failed?.sourceTxHash && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-red-300">{failed.error}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retry(`1:${failed.sourceTxHash}:${quest.questId}`)}
                        disabled={busy !== null}
                        className="rounded border-zinc-700 text-[11px] text-zinc-300"
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
