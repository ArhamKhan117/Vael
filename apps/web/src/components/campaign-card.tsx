"use client"

import Image from "next/image"
import Link from "next/link"
import { BadgeCheck, MoveRight } from "lucide-react"

import { ipfsToHttp } from "@/lib/ipfs"
import type { ChainCampaign } from "@/lib/api"

/**
 * One partner campaign, everywhere a partner campaign appears.
 *
 * The three places that showed a campaign each drew their own, so they drifted: the landing page
 * had a tall card with a coloured gradient block, /quests had a shorter one, /campaigns a third.
 * This is the one card, so a change to it is a change everywhere.
 *
 * Deliberately compact. A campaign is not the point of a quest board; it is a frame around some
 * quests, and a board showing eight of them at the previous height was a wall. The pool figure and
 * the quest count are what a player needs at a glance, and everything else is one click away.
 */
export function CampaignCard({ campaign }: { campaign: ChainCampaign }) {
  const name =
    campaign.title ?? campaign.campaignId ?? `Pool ${campaign.campaignKey.slice(0, 10)}…`
  const image = campaign.image ? ipfsToHttp(campaign.image) : undefined
  const balance = Number(campaign.balanceVael).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })

  return (
    <Link
      href={`/campaigns/${campaign.campaignKey}`}
      data-testid={`campaign-card-${campaign.campaignKey}`}
      className="group relative block h-full overflow-hidden rounded border border-[#1A1A1A] bg-black transition hover:border-zinc-700"
    >
      {/* The partner's own picture, well behind the text. Loud enough to tell two campaigns apart
          at a glance, quiet enough that the numbers stay the thing you read. */}
      {image && (
        <Image
          src={image}
          alt=""
          fill
          className="pointer-events-none object-cover opacity-[0.14] transition duration-500 group-hover:opacity-25"
          sizes="(max-width: 768px) 100vw, 420px"
          unoptimized
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/55" />

      <div className="relative flex h-full flex-col justify-between gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-sky-200">{name}</h3>
              {campaign.protocol?.verified && (
                // Shown only when QuestASC's allowlist accepts the contract these quests read, so
                // the chip is a statement about the chain rather than about the partner.
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-emerald-300"
                  title={`${campaign.protocol.name} is on the QuestASC emitter allowlist for this action`}
                >
                  <BadgeCheck className="h-2.5 w-2.5" /> Verified protocol
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {campaign.questCount} quest{campaign.questCount === 1 ? "" : "s"},{" "}
              {campaign.completedCount} completed
              {campaign.selfFunded && (
                <>
                  {" · "}
                  <span className="text-zinc-600" title="Funded by Vael's own deployer, to show how a partner campaign works">
                    demo, funded by Vael
                  </span>
                </>
              )}
            </p>
          </div>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
              campaign.status === "funded"
                ? "bg-emerald-500/10 text-emerald-400/90"
                : "bg-amber-900/30 text-amber-500/80"
            }`}
          >
            {campaign.status}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-semibold leading-none text-white">{balance}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
              VAEL in escrow
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-sky-300/80 transition group-hover:text-sky-200">
            View
            <MoveRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  )
}
