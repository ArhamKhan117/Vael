"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MoveRight } from "lucide-react";
import { useIsTablet } from "@/hooks/breakpoint";
import { Button } from "./ui/button";
import Link from "next/link";
import { useCampaigns } from "@/hooks/useCampaigns";

const DEFAULT_THUMBNAIL = "https://picsum.photos/seed/quest/600/400";

interface PartnershipCarouselProps {
  /** When false, hide the "Partnership Quests" heading (e.g. when nested under "Explore more quests") */
  showHeading?: boolean
}

export default function PartnershipCarousel({ showHeading = true }: PartnershipCarouselProps) {
  const isTablet = useIsTablet();
  const { campaigns, loading } = useCampaigns({ status: "active", limit: 20 });

  const CARDS_PER_SLIDE = showHeading ? (isTablet ? 1 : 3) : (isTablet ? 1 : 2);
  const cards = campaigns.map((c) => ({
    id: c.id,
    imageSrc: c.thumbnail ?? DEFAULT_THUMBNAIL,
    badgeLeft: c.template_type?.toUpperCase() ?? "Campaign",
    badgeRight: "Active",
    eyebrow: "Partner quest",
    headline: c.title ?? "Campaign",
    description: (c.description ?? "").replace(/<[^>]*>/g, "").slice(0, 120) || "Complete this quest to earn USDC rewards.",
    rewardUsdc: Number(c.reward_per_quest_usdc ?? 0).toFixed(2),
    ctaLabel: "Join Quest",
  }));

  const totalSlides = Math.max(1, cards.length - CARDS_PER_SLIDE + 1);
  const [index, setIndex] = useState(0);

  const prev = () =>
    setIndex((current) =>
      current === 0 ? totalSlides - 1 : current - 1
    );
  const next = () =>
    setIndex((current) =>
      current === totalSlides - 1 ? 0 : current + 1
    );

  return (
    <section className="space-y-4">
      {showHeading && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold md:text-2xl">Partnership Quests</h1>
        </div>
      )}

      {loading ? (
        <div className="rounded border border-[#1A1A1A] bg-black py-12 text-center text-zinc-400">
          Loading partnership campaigns...
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded border border-[#1A1A1A] bg-black py-12 text-center text-zinc-400">
          No active partnership campaigns. Check back later.
        </div>
      ) : (
        <div className={`relative pb-4 ${showHeading ? "border border-[#1A1A1A]" : "border-b border-[#1A1A1A]"}` }>
          {/* Track */}
          <div className={`overflow-hidden gap-4 py-4 rounded bg-black`}>
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(-${(index * 100) / CARDS_PER_SLIDE}%)`,
              }}
            >
              {cards.map((card) => (
                <article
                  key={card.id}
                  className={`w-full shrink-0 px-2 ${showHeading ? "lg:w-1/3" : "lg:w-1/2"}`}
                >
                  <div className="flex h-full flex-col justify-between rounded border border-[#1A1A1A] bg-[#18181B] px-6 py-6">
                    <div className="relative h-48 w-full overflow-hidden rounded">
                      <Image
                        src={card.imageSrc}
                        alt={card.headline}
                        fill
                        className="object-cover"
                        unoptimized={card.imageSrc.startsWith("ipfs://")}
                      />
                    </div>

                    <div className="mt-6 space-y-3 text-center md:text-left">
                      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                        <span className="rounded bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.14em]">
                          {card.badgeLeft}
                        </span>
                        <span className="rounded bg-sky-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-300">
                          {card.badgeRight}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          {card.eyebrow}
                        </p>
                        <p className="text-2xl font-semibold text-sky-300 md:text-3xl">
                          {card.headline}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {card.description}
                        </p>
                        <p className="text-xs font-medium text-emerald-400">
                          Reward: {card.rewardUsdc} USDC per quest
                        </p>
                      </div>
                    </div>

                    <Button
                      asChild
                      variant="default"
                      className="mt-6 rounded font-semibold text-black bg-sky-500 hover:bg-sky-400"
                    >
                      <Link href={`/campaigns/${card.id}`}>
                        {card.ctaLabel}
                        <MoveRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Arrows */}
          {cards.length > CARDS_PER_SLIDE && (
            <>
              <button
                type="button"
                onClick={prev}
                className="cursor-pointer absolute left-0 top-1/2 -translate-y-1/2 translate-x-[-40%] rounded-full bg-white/90 p-2 text-black shadow-lg hover:bg-white"
                aria-label="Previous partnership quest"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={next}
                className="cursor-pointer absolute right-0 top-1/2 -translate-y-1/2 -translate-x-[-40%] rounded-full bg-white/90 p-2 text-black shadow-lg hover:bg-white"
                aria-label="Next partnership quest"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Dots */}
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
