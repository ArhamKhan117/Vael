"use client"

import { useEffect, useMemo, useState } from "react"
import { useReadContract } from "wagmi"

import { CREDITCOIN_CHAIN_ID } from "@/lib/chains"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"
import { ActionType, ProofStatus, VerificationRule } from "@/lib/attestcoin/types"
import { api } from "@/lib/api"

const questAscRuleAbi = [
  {
    type: "function",
    name: "rules",
    stateMutability: "view",
    inputs: [{ name: "questId", type: "uint256" }],
    outputs: [
      { name: "actionType", type: "uint8" },
      { name: "emitter", type: "address" },
      { name: "token", type: "address" },
      { name: "minAmount", type: "uint256" },
      { name: "minSourceBlock", type: "uint64" },
      { name: "maxSourceBlock", type: "uint64" },
      { name: "playerMustMatch", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "ruleExists",
    stateMutability: "view",
    inputs: [{ name: "questId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

/**
 * Read a quest's verification rule straight from QuestASC.
 *
 * From the contract rather than from our API on purpose: the rule is what the chain will actually
 * enforce, and showing a cached copy that had drifted would be worse than showing nothing.
 */
export function useVerificationRule(questId: number | undefined): VerificationRule | undefined {
  const enabled = questId !== undefined && !!CONTRACT_ADDRESSES.QUEST_ASC

  const { data: exists } = useReadContract({
    abi: questAscRuleAbi,
    address: CONTRACT_ADDRESSES.QUEST_ASC,
    functionName: "ruleExists",
    args: enabled ? [BigInt(questId)] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled },
  })

  const { data } = useReadContract({
    abi: questAscRuleAbi,
    address: CONTRACT_ADDRESSES.QUEST_ASC,
    functionName: "rules",
    args: enabled ? [BigInt(questId)] : undefined,
    chainId: CREDITCOIN_CHAIN_ID,
    query: { enabled: enabled && exists === true },
  })

  return useMemo(() => {
    if (!data) return undefined
    const [actionType, emitter, token, minAmount, minSourceBlock, maxSourceBlock, playerMustMatch] =
      data as readonly [number, `0x${string}`, `0x${string}`, bigint, bigint, bigint, boolean]
    return {
      actionType: actionType as ActionType,
      emitter,
      token,
      minAmount,
      minSourceBlock,
      maxSourceBlock,
      playerMustMatch,
    }
  }, [data])
}

/**
 * Where a claim has got to, from the API when it is reachable.
 *
 * The API is a convenience here, not a dependency: if it is down the timeline simply shows
 * "not started" and the self-claim path still works, because that path talks to the Proof Builder
 * and the chain directly.
 */
export function useProofStatus(questId: number | undefined, participant?: string): ProofStatus {
  const [status, setStatus] = useState<ProofStatus>({ stage: "not_started" })

  useEffect(() => {
    if (questId === undefined || !participant) return
    let cancelled = false

    const poll = async () => {
      try {
        const result = await api.getProofStatus(questId, participant)
        if (!cancelled && result) setStatus(result)
      } catch {
        // Leave the last known stage in place. A missing API must not look like a failed proof.
      }
    }

    void poll()
    const timer = setInterval(poll, 20_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [questId, participant])

  return status
}
