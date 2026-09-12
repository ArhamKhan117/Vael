"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { useIsTablet } from "@/hooks/breakpoint";
import { CampaignCard } from "./campaign-card";
import { useCampaigns } from "@/hooks/useCampaigns";

/**
 * Partner campaigns, straight off CampaignEscrow.
 *
 * A campaign is a pool of money on Creditcoin, so every figure on a card is the pool: what the
 * partner deposited, what QuestASC has released out of it against verified proofs, and what is
 * left. There is no artwork and no promised reward, because the escrow holds neither.
 */

interface PartnershipCarouselProps {
  /** When false, hide the "Partnership Quests" heading (e.g. when nested under another section) */
  showHeading?: boolean
  /**
   * Advance one card on its own every this many milliseconds. Off by default; the landing page
   * turns it on. It pauses while the pointer or the keyboard focus is on the carousel, while the
   * tab is hidden, and for a moment after the reader moves it by hand, and it does nothing at all
   * for a reader who has asked for reduced motion.
   */
  autoAdvanceMs?: number
}

export default function PartnershipCarousel({ showHeading = true, autoAdvanceMs }: PartnershipCarouselProps) {
  const isTablet = useIsTablet();
  const { campaigns, loading } = useCampaigns({ status: "funded" });

  // The card is about half its old height, so a row holds more of them without crowding.
  const CARDS_PER_SLIDE = showHeading ? (isTablet ? 1 : 4) : (isTablet ? 1 : 3);

  // One card per step, so with four campaigns and three in view the second slide shows the
  // fourth card beside the two it was already next to, rather than alone.
  const totalSlides = Math.max(1, campaigns.length - CARDS_PER_SLIDE + 1);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // A manual move restarts the clock, so the next automatic step is a full interval away rather
  // than a fraction of a second after the reader pressed the arrow.
  const lastManual = useRef(0);

  const prev = () => {
    lastManual.current = Date.now();
    setIndex((current) => (current === 0 ? totalSlides - 1 : current - 1));
  };
  const next = () => {
    lastManual.current = Date.now();
    setIndex((current) => (current === totalSlides - 1 ? 0 : current + 1));
  };
  const goTo = useCallback((i: number) => {
    lastManual.current = Date.now();
    setIndex(i);
  }, []);

  useEffect(() => {
    if (!autoAdvanceMs || totalSlides < 2 || paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastManual.current < autoAdvanceMs) return;
      setIndex((current) => (current === totalSlides - 1 ? 0 : current + 1));
    }, autoAdvanceMs);
    return () => clearInterval(timer);
  }, [autoAdvanceMs, totalSlides, paused]);

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
        <div
          className={`relative pb-4 ${showHeading ? "border border-[#1A1A1A]" : "border-b border-[#1A1A1A]"}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {/* When there are arrows the track is inset so they sit in a gutter beside the first and
              last card rather than over a card's own text. */}
          <div className={`rounded bg-black py-4 ${campaigns.length > CARDS_PER_SLIDE ? "px-9" : ""}`}>
            {/* The clip is a box of its own inside the gutter. Clipping the padded box instead
                let the next card show through the gutter beside the arrow. */}
            <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${(index * 100) / CARDS_PER_SLIDE}%)` }}
            >
              {campaigns.map((campaign, i) => (
                <article
                  key={campaign.campaignKey}
                  className={`w-full shrink-0 px-2 ${showHeading ? "lg:w-1/4" : "lg:w-1/3"}`}
                >
                  <CampaignCard campaign={campaign} />
                </article>
              ))}
            </div>
            </div>
          </div>

          {/* The arrows sit inside the edges, on nothing: a chevron in mid grey that brightens
              under the pointer, over a faint dark wash so it stays legible across a card's
              picture. The white discs that used to hang half outside the component are gone. */}
          {campaigns.length > CARDS_PER_SLIDE && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-1 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-black/30 p-2 text-zinc-500 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
                aria-label="Previous partner campaign"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-black/30 p-2 text-zinc-500 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
                aria-label="Next partner campaign"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </>
          )}

          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
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
