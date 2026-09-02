"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MoveRight } from "lucide-react";
import Link from "next/link";

import { useIsTablet } from "@/hooks/breakpoint";
import { Button } from "./ui/button";
import { useCampaigns } from "@/hooks/useCampaigns";
import type { ChainCampaign } from "@/lib/api";

/**
 * Partner campaigns, straight off CampaignEscrow.
 *
 * A campaign is a pool of money on Creditcoin, so every figure on a card is the pool: what the
 * partner deposited, what QuestASC has released out of it against verified proofs, and what is
 * left. There is no artwork and no promised reward, because the escrow holds neither.
 */

const DEFAULT_THUMBNAIL_GRADIENTS = [
  "from-sky-500/25 via-sky-500/5 to-transparent",
  "from-amber-500/25 via-amber-500/5 to-transparent",
  "from-emerald-500/25 via-emerald-500/5 to-transparent",
  "from-indigo-500/25 via-indigo-500/5 to-transparent",
];

interface PartnershipCarouselProps {
  /** When false, hide the "Partnership Quests" heading (e.g. when nested under another section) */
  showHeading?: boolean
}

function label(campaign: ChainCampaign) {
  return campaign.title ?? campaign.campaignId ?? `Pool ${campaign.campaignKey.slice(0, 10)}…`
}

export default function PartnershipCarousel({ showHeading = true }: PartnershipCarouselProps) {
  const isTablet = useIsTablet();
  const { campaigns, loading } = useCampaigns({ status: "funded" });

  const CARDS_PER_SLIDE = showHeading ? (isTablet ? 1 : 3) : (isTablet ? 1 : 2);

  const totalSlides = Math.max(1, campaigns.length - CARDS_PER_SLIDE + 1);
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((current) => (current === 0 ? totalSlides - 1 : current - 1));
  const next = () => setIndex((current) => (current === totalSlides - 1 ? 0 : current + 1));

  return (
    <section className="space-y-4">
      {showHeading && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold md:text-2xl">Partnership Quests</h1>
          <Link href="/campaigns" className="text-xs text-zinc-400 underline hover:text-white">
            All campaigns
          </Link>
        </div>
      )}

      {loading ? (
        <div className="rounded border border-[#1A1A1A] bg-black py-12 text-center text-zinc-400">
          Loading partner campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded border border-[#1A1A1A] bg-black py-12 text-center text-zinc-400">
          No funded partner campaigns right now.
        </div>
      ) : (
        <div className={`relative pb-4 ${showHeading ? "border border-[#1A1A1A]" : "border-b border-[#1A1A1A]"}` }>
          <div className="overflow-hidden gap-4 rounded bg-black py-4">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${(index * 100) / CARDS_PER_SLIDE}%)` }}
            >
              {campaigns.map((campaign, i) => (
                <article
                  key={campaign.campaignKey}
                  className={`w-full shrink-0 px-2 ${showHeading ? "lg:w-1/3" : "lg:w-1/2"}`}
                >
                  <div
                    data-testid={`campaign-card-${campaign.campaignKey}`}
                    className="flex h-full flex-col justify-between rounded border border-[#1A1A1A] bg-[#18181B] px-6 py-6"
                  >
                    <div
                      className={`relative flex h-40 w-full flex-col items-center justify-center rounded bg-linear-to-b ${
                        DEFAULT_THUMBNAIL_GRADIENTS[i % DEFAULT_THUMBNAIL_GRADIENTS.length]
                      }`}
                    >
                      <p className="text-3xl font-semibold text-white">
                        {Number(campaign.balanceVael).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                        VAEL in escrow
                      </p>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                        <span className="rounded bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.14em]">
                          Partner
                        </span>
                        <span className="rounded bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                          Funded
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Campaign
                        </p>
                        <p className="truncate text-xl font-semibold text-sky-300 md:text-2xl">
                          {label(campaign)}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {campaign.questCount} quest{campaign.questCount === 1 ? "" : "s"} on chain,{" "}
                          {campaign.completedCount} completed. Every payout needs an Attestcoin proof.
                        </p>
                      </div>
                    </div>

                    <Button
                      asChild
                      variant="default"
                      className="mt-6 rounded bg-sky-500 font-semibold text-black hover:bg-sky-400"
                    >
                      <Link href={`/campaigns/${campaign.campaignKey}`}>
                        View campaign
                        <MoveRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {campaigns.length > CARDS_PER_SLIDE && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-[-40%] cursor-pointer rounded-full bg-white/90 p-2 text-black shadow-lg hover:bg-white"
                aria-label="Previous partner campaign"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-[-40%] cursor-pointer rounded-full bg-white/90 p-2 text-black shadow-lg hover:bg-white"
                aria-label="Next partner campaign"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 w-4 rounded-full transition-colors ${i === index ? "bg-white" : "bg-zinc-700"}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
