"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { Swords } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EventBus, GameEvents } from "@/game/EventBus"
import { useReownWallet } from "@/hooks/useReownWallet"
import {
  Challenge,
  useArenaHistory,
  useChallenges,
  useModuleWrites,
} from "@/hooks/useModules"
import { decodeRounds, hitPoints, shortAddress } from "@/lib/arena"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"
import { CREDITCOIN_EXPLORER_URL } from "@/lib/chains"

const ArenaCanvas = dynamic(() => import("@/game/ArenaCanvas"), { ssr: false })

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

type Affinity = "novice" | "warrior" | "rogue" | "mage"

interface HeroSummary {
  hasHero: boolean
  level: number
  intellect: number
  affinity: Affinity
}

async function heroOf(address: string): Promise<HeroSummary> {
  try {
    const response = await fetch(`${API_BASE_URL}/hero/${address}`)
    if (!response.ok) throw new Error("no hero")
    const body = (await response.json()) as Partial<HeroSummary>
    return {
      hasHero: Boolean(body.hasHero),
      level: body.level ?? 1,
      intellect: body.intellect ?? 0,
      affinity: (body.affinity as Affinity) ?? "novice",
    }
  } catch {
    return { hasHero: false, level: 1, intellect: 0, affinity: "novice" }
  }
}

function vael(wei: string) {
  return Number(formatUnits(BigInt(wei || "0"), 18)).toLocaleString()
}

export default function ArenaPage() {
  const { wallet } = useReownWallet()
  const address = wallet.address ?? undefined

  const { challenges: open, refetch: refetchOpen } = useChallenges("open")
  const { challenges: accepted, refetch: refetchAccepted } = useChallenges("accepted")
  const { challenges: history, refetch: refetchHistory } = useArenaHistory()
  const writes = useModuleWrites()

  const [opponent, setOpponent] = useState("")
  const [stake, setStake] = useState("10")
  const [selected, setSelected] = useState<Challenge | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refetchAll = useCallback(() => {
    setTimeout(() => {
      void refetchOpen()
      void refetchAccepted()
      void refetchHistory()
    }, 4000)
  }, [refetchOpen, refetchAccepted, refetchHistory])

  // The first finished duel is shown without being asked for, so the canvas is never empty when
  // there is something real to put in it.
  useEffect(() => {
    if (!selected && history.length > 0) setSelected(history[0] ?? null)
  }, [history, selected])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selected) {
        EventBus.emit(GameEvents.ArenaReplay, null)
        return
      }
      const [challengerHero, opponentHero] = await Promise.all([
        heroOf(selected.challenger),
        heroOf(selected.opponent),
      ])
      if (cancelled) return
      EventBus.emit(GameEvents.ArenaReplay, {
        challengeId: selected.challengeId,
        challenger: {
          address: selected.challenger,
          affinity: challengerHero.affinity,
          hp: hitPoints(challengerHero.level, challengerHero.intellect),
        },
        opponent: {
          address: selected.opponent,
          affinity: opponentHero.affinity,
          hp: hitPoints(opponentHero.level, opponentHero.intellect),
        },
        swings: decodeRounds(selected.rounds),
        winner: selected.winner ?? "",
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selected])

  const isValidOpponent = /^0x[a-fA-F0-9]{40}$/.test(opponent)
  const stakeWei = useMemo(() => {
    try {
      return parseUnits(stake || "0", 18)
    } catch {
      return 0n
    }
  }, [stake])

  const submitChallenge = async () => {
    setNotice(null)
    if (!isValidOpponent || stakeWei === 0n) return
    // The stake is escrowed on the challenge, so the allowance has to be in place first.
    const approved = await writes.approveVael(CONTRACT_ADDRESSES.ARENA, stakeWei)
    if (!approved) return
    const hash = await writes.challenge(opponent as `0x${string}`, stakeWei)
    if (hash) {
      setNotice(`Challenge sent. ${hash.slice(0, 10)}…`)
      setOpponent("")
      refetchAll()
    }
  }

  const accept = async (challenge: Challenge) => {
    setNotice(null)
    const approved = await writes.approveVael(CONTRACT_ADDRESSES.ARENA, BigInt(challenge.stake))
    if (!approved) return
    const hash = await writes.acceptChallenge(challenge.challengeId)
    if (hash) {
      setNotice(`Accepted duel #${challenge.challengeId}.`)
      refetchAll()
    }
  }

  const withdraw = async (challenge: Challenge) => {
    setNotice(null)
    const hash = await writes.cancelChallenge(challenge.challengeId)
    if (hash) {
      setNotice(`Withdrew challenge #${challenge.challengeId}, stake returned.`)
      refetchAll()
    }
  }

  const resolve = async (challenge: Challenge) => {
    setNotice(null)
    const hash = await writes.resolveChallenge(challenge.challengeId)
    if (hash) {
      setNotice(`Resolved duel #${challenge.challengeId}.`)
      refetchAll()
    }
  }

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">Arena</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Duels are fought with stats that were earned. Strength, agility, and intellect rise only
            through a proof Creditcoin verified, so an arena win is downstream of real DeFi on
            Ethereum and cannot be bought. Resolution is a pure function of both heroes and one
            seed, and the full round log is on chain, so the replay below is the fight rather than
            an impression of it.
          </p>
        </header>

        <ArenaCanvas />

        {history.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 8).map((challenge) => (
              <button
                key={challenge.challengeId}
                type="button"
                onClick={() => setSelected(challenge)}
                className={`rounded border px-3 py-1.5 text-[11px] transition ${
                  selected?.challengeId === challenge.challengeId
                    ? "border-zinc-400 text-zinc-100"
                    : "border-[#1A1A1A] text-zinc-500 hover:border-zinc-700"
                }`}
              >
                #{challenge.challengeId} {shortAddress(challenge.challenger)} v{" "}
                {shortAddress(challenge.opponent)}
              </button>
            ))}
          </div>
        )}

        {notice && (
          <p className="rounded border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-300">
            {notice}
          </p>
        )}
        {writes.error && (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            {writes.error}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded border border-[#1A1A1A] bg-black p-5">
            <h2 className="text-sm font-semibold text-white">Challenge someone</h2>
            <p className="mt-1 text-[11px] text-zinc-600">
              Both wallets need a hero. Your stake is escrowed when you send the challenge, and
              comes back if nobody answers within 7200 blocks.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  Opponent address
                </span>
                <input
                  value={opponent}
                  onChange={(event) => setOpponent(event.target.value.trim())}
                  placeholder="0x…"
                  className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  Stake, in VAEL
                </span>
                <input
                  value={stake}
                  onChange={(event) => setStake(event.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
                />
              </label>
              <Button
                onClick={submitChallenge}
                disabled={!isValidOpponent || stakeWei === 0n || writes.pending !== null}
                className="w-full rounded bg-white text-black hover:bg-white/90"
              >
                <Swords className="mr-2 h-4 w-4" />
                {writes.pending === "approve"
                  ? "Approving VAEL…"
                  : writes.pending === "challenge"
                    ? "Confirm in your wallet…"
                    : "Send challenge"}
              </Button>
              {opponent && !isValidOpponent && (
                <p className="text-[11px] text-amber-400">That is not a 20-byte address.</p>
              )}
            </div>
          </section>

          <section className="rounded border border-[#1A1A1A] bg-black p-5">
            <h2 className="text-sm font-semibold text-white">Open and awaiting resolution</h2>
            {open.length === 0 && accepted.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">Nothing on the board.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {open.map((challenge) => (
                  <li
                    key={challenge.challengeId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#1A1A1A] px-3 py-2.5 text-xs"
                  >
                    <div>
                      <p className="text-zinc-300">
                        #{challenge.challengeId} {shortAddress(challenge.challenger)} challenged{" "}
                        {shortAddress(challenge.opponent)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">
                        {vael(challenge.stake)} VAEL each side
                      </p>
                    </div>
                    {address?.toLowerCase() === challenge.opponent.toLowerCase() ? (
                      <Button
                        size="sm"
                        onClick={() => accept(challenge)}
                        disabled={writes.pending !== null}
                        className="rounded bg-white text-black hover:bg-white/90"
                      >
                        {writes.pending === `accept-${challenge.challengeId}` ? "Confirm…" : "Accept"}
                      </Button>
                    ) : address?.toLowerCase() === challenge.challenger.toLowerCase() ? (
                      // The stake is escrowed, so a challenger who changes their mind needs a way
                      // out that is not waiting 7200 blocks for the expiry refund.
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => withdraw(challenge)}
                        disabled={writes.pending !== null}
                        className="rounded border-zinc-700 text-zinc-300"
                      >
                        {writes.pending === `cancel-${challenge.challengeId}`
                          ? "Confirm…"
                          : "Withdraw"}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-zinc-600">not yours</span>
                    )}
                  </li>
                ))}
                {accepted.map((challenge) => (
                  <li
                    key={challenge.challengeId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs"
                  >
                    <div>
                      <p className="text-zinc-300">
                        #{challenge.challengeId} {shortAddress(challenge.challenger)} v{" "}
                        {shortAddress(challenge.opponent)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">
                        Accepted. Anyone can resolve it.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => resolve(challenge)}
                      disabled={writes.pending !== null}
                      className="rounded bg-white text-black hover:bg-white/90"
                    >
                      {writes.pending === `resolve-${challenge.challengeId}` ? "Confirm…" : "Fight"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
          <header className="border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Finished duels</h2>
            <p className="mt-1 text-[11px] text-zinc-600">
              Each carries the round log the contract emitted. Select one to replay it above.
            </p>
          </header>
          {history.length === 0 ? (
            <p className="px-5 py-6 text-xs text-zinc-500">No duel has been fought yet.</p>
          ) : (
            <ul className="divide-y divide-[#1A1A1A]">
              {history.map((challenge) => (
                <li
                  key={challenge.challengeId}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => setSelected(challenge)}
                    className="text-left"
                  >
                    <p className="text-zinc-200">
                      #{challenge.challengeId} {shortAddress(challenge.challenger)} v{" "}
                      {shortAddress(challenge.opponent)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {challenge.status === "drawn"
                        ? "A draw, both stakes returned"
                        : `${shortAddress(challenge.winner ?? "")} took ${vael(challenge.payout ?? "0")} VAEL`}
                      {" · "}
                      {decodeRounds(challenge.rounds).length} swings
                    </p>
                  </button>
                  {challenge.resolvedAtBlock ? (
                    <a
                      href={`${CREDITCOIN_EXPLORER_URL}/block/${challenge.resolvedAtBlock}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-sky-400 hover:underline"
                    >
                      block {challenge.resolvedAtBlock.toLocaleString()}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
