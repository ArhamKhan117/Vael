"use client";

import Link from "next/link";

import { CardCarousel } from "@/components/ui/card-carousel";
import { CampaignCard } from "./campaign-card";
import { useCampaigns } from "@/hooks/useCampaigns";

/**
 * Partner campaigns, straight off CampaignEscrow.
 *
 * A campaign is a pool of money on Creditcoin, so every figure on a card is the pool: what the
 * partner deposited, what has been released out of it against verified completions, and what is
 * left. The strip itself is the shared card carousel; this only fetches the funded pools and
 * decides how many fit a row.
 */

interface PartnershipCarouselProps {
  /** When false, hide the "Partnership Quests" heading (e.g. when nested under another section) */
  showHeading?: boolean
  /** Advance one card on its own every this many milliseconds. Off by default; the landing page turns it on. */
  autoAdvanceMs?: number
}

export default function PartnershipCarousel({ showHeading = true, autoAdvanceMs }: PartnershipCarouselProps) {
  const { campaigns, loading } = useCampaigns({ status: "funded" });

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
        <div className={`rounded bg-black py-4 pb-4 ${showHeading ? "border border-[#1A1A1A]" : "border-b border-[#1A1A1A]"}`}>
          <CardCarousel
            items={campaigns}
            keyOf={(campaign) => campaign.campaignKey}
            render={(campaign) => <CampaignCard campaign={campaign} />}
            // The card is about half its old height, so the board page's wider strip holds four.
            perSlide={showHeading ? 4 : 3}
            autoAdvanceMs={autoAdvanceMs}
            label="partner campaign"
            testId="partner-carousel"
          />
        </div>
      )}
    </section>
  );
}
