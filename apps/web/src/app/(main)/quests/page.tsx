"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import PartnershipCarousel from "@/components/partnership-carousel";
import { CardCarousel } from "@/components/ui/card-carousel";
import { QuestCard, QuestGridEmpty } from "@/components/quest-card";
import { useAllQuests } from "@/hooks/useQuests";
import { useWallet } from "@/hooks/useWallet";
import type { ChainQuest } from "@/lib/api";

/**
 * The quest board.
 *
 * Every quest here exists because QuestManager emitted QuestCreated on Creditcoin, and every one of
 * them is on this page whether a wallet is connected or not. Connecting does not filter the board;
 * it lifts your own assignments into a section of their own at the top, a plain grid that never
 * moves, and leaves everybody else's where it was.
 *
 * That is deliberate. The board is the argument: a visitor should be able to see that real quests
 * exist, who they are assigned to and which have been proved, before deciding to connect anything.
 * The one thing a wallet is needed for is accepting, and a quest is assigned to an address at
 * creation, so somebody else's quest is readable by everyone and acceptable by nobody else.
 *
 * Each of the four sections is a carousel: three cards in view at desktop width, one on a phone,
 * stepping one card every four seconds and wrapping, paused under the pointer. "View all" in a
 * section's heading expands it into a grid in place and stops its rotation. Fifteen daily quests
 * in one column was a board ten thousand pixels tall; six in a grid was better, and still a wall.
 *
 * Two kinds of quest are on chain and not on the board. A quest past its expiry, which
 * QuestManager will not let anybody accept or complete, goes into a section at the bottom that is
 * closed by default and counted in no section's total. A quest whose campaign pool was refunded
 * would pay nothing, and it is left out here and shown only on that campaign's own page, marked.
 */

const SECTIONS: { cadence: ChainQuest["cadence"]; title: string; blurb: string }[] = [
  {
    cadence: "daily",
    title: "Daily quests",
    blurb: "Generated for you each day from the actions you have already proved.",
  },
  {
    cadence: "weekly",
    title: "Weekly quests",
    blurb: "A longer target, refreshed every Monday.",
  },
  {
    cadence: "campaign",
    title: "Partner quests",
    blurb: "Paid out of a partner's escrow, only against a verified proof.",
  },
  {
    cadence: "open",
    title: "Open quests",
    blurb: "Everything else the agent has created on chain.",
  },
];

/** How often a section's carousel steps on its own. */
const ROTATE_MS = 4000;

function SectionHeading({
  title,
  count,
  blurb,
  control,
}: {
  title: string;
  count: number;
  blurb: string;
  control?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-base font-semibold md:text-lg">{title}</h2>
      <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        {count}
      </span>
      <p className="text-xs text-zinc-500">{blurb}</p>
      {control && <span className="ml-auto">{control}</span>}
    </div>
  );
}

/**
 * One section of the board: a carousel of its quests, or the whole grid once "View all" is pressed.
 *
 * The control sits in the heading line, beside the count it refers to. Expanding stops the
 * rotation, because a grid that is all in view has nothing to rotate to.
 */
function QuestSection({
  section,
  quests,
  viewer,
  loading,
  emptyMessage,
}: {
  section: (typeof SECTIONS)[number];
  quests: ChainQuest[];
  viewer?: string;
  loading: boolean;
  emptyMessage: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const control =
    quests.length > 1 ? (
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        data-testid={`view-all-${section.cadence}`}
        className="rounded border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500 hover:text-white"
      >
        {expanded ? "Show fewer" : `View all ${quests.length}`}
      </button>
    ) : undefined;
  return (
    <section className="space-y-3" data-testid={`section-${section.cadence}`}>
      <SectionHeading
        title={section.title}
        count={quests.length}
        blurb={section.blurb}
        control={control}
      />
      {loading ? (
        <div className="grid gap-4">
          <QuestGridEmpty>Reading the chain…</QuestGridEmpty>
        </div>
      ) : quests.length === 0 ? (
        <div className="grid gap-4">
          <QuestGridEmpty>{emptyMessage}</QuestGridEmpty>
        </div>
      ) : expanded ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid={`grid-${section.cadence}`}>
          {quests.map((quest) => (
            <QuestCard key={quest.questId} quest={quest} viewer={viewer} />
          ))}
        </div>
      ) : (
        <CardCarousel
          items={quests}
          keyOf={(quest) => String(quest.questId)}
          render={(quest) => <QuestCard quest={quest} viewer={viewer} />}
          perSlide={3}
          autoAdvanceMs={ROTATE_MS}
          label={`${section.title.toLowerCase().replace(/ quests$/, "")} quest`}
          testId={`carousel-${section.cadence}`}
        />
      )}
    </section>
  );
}

export default function QuestsPage() {
  const { address, isConnected } = useWallet();
  // Never filtered by participant. The whole board, always.
  const { quests, loading, error } = useAllQuests();
  const viewer = isConnected && address ? address.toLowerCase() : undefined;

  const [showExpired, setShowExpired] = useState(false);

  // What the board shows, what it folds away, and what it leaves out.
  const { live, expired, refundedCount } = useMemo(() => {
    const live: ChainQuest[] = [];
    const expired: ChainQuest[] = [];
    let refundedCount = 0;
    for (const quest of quests) {
      if (quest.campaignStatus === "refunded") refundedCount += 1;
      else if (quest.expired) expired.push(quest);
      else live.push(quest);
    }
    expired.sort((a, b) => b.questId - a.questId);
    return { live, expired, refundedCount };
  }, [quests]);

  // The connected wallet's own assignments, lifted out of the sections below and never repeated
  // in them. Newest first, and the section counts count only what each section shows.
  const { mine, byCadence } = useMemo(() => {
    const mine: ChainQuest[] = [];
    const map = new Map<ChainQuest["cadence"], ChainQuest[]>();
    for (const quest of live) {
      if (viewer && quest.participant?.toLowerCase() === viewer) {
        mine.push(quest);
        continue;
      }
      const list = map.get(quest.cadence) ?? [];
      list.push(quest);
      map.set(quest.cadence, list);
    }
    mine.sort((a, b) => b.questId - a.questId);
    for (const list of map.values()) list.sort((a, b) => b.questId - a.questId);
    return { mine, byCadence: map };
  }, [live, viewer]);
  const mineCount = mine.length;

  const emptyMessage = (cadence: ChainQuest["cadence"]) => {
    // A section that is empty only because everything in it is yours says so, rather than
    // claiming the chain holds nothing of the kind.
    const yours = mine.filter((quest) => quest.cadence === cadence).length;
    if (yours > 0) {
      return `${yours === 1 ? "The one quest" : `All ${yours} quests`} of this kind ${yours === 1 ? "is" : "are"} assigned to you, in Your quests above.`;
    }
    if (cadence === "campaign") {
      return (
        <>
          No partner quest here yet.{" "}
          <Link href="/campaigns" className="underline hover:text-white">
            Browse campaigns
          </Link>
          .
        </>
      );
    }
    return "Nothing on chain in this category yet.";
  };

  return (
    <main className="bg-black px-5 pb-12 pt-24 text-white md:px-10">
      <div className="space-y-8">
        <PartnershipCarousel />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold md:text-2xl">Quest board</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {viewer
                ? `Every quest on chain, read from QuestManager. ${mineCount} assigned to your wallet, in a section of their own.`
                : "Every quest on chain, read from QuestManager. Connect a wallet to accept the ones assigned to you."}
            </p>
          </div>
          <p className="text-xs text-zinc-500" data-testid="quest-count">
            {loading
              ? "Loading…"
              : [
                  `${live.length} quest${live.length === 1 ? "" : "s"} on the board`,
                  expired.length > 0 ? `${expired.length} expired` : null,
                  refundedCount > 0 ? `${refundedCount} in a refunded campaign, not shown` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* The wallet's own quests: a plain grid, at the top, that never rotates. A carousel is
            for browsing what is there; what is yours is for doing, and it should hold still. */}
        {viewer && !loading && mine.length > 0 && (
          <section className="space-y-3" data-testid="section-mine">
            <SectionHeading
              title="Your quests"
              count={mine.length}
              blurb="Assigned to the connected wallet. Not repeated below."
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="grid-mine">
              {mine.map((quest) => (
                <QuestCard key={quest.questId} quest={quest} viewer={viewer} />
              ))}
            </div>
          </section>
        )}

        {SECTIONS.map((section) => (
          <QuestSection
            key={section.cadence}
            section={section}
            quests={byCadence.get(section.cadence) ?? []}
            viewer={viewer}
            loading={loading}
            emptyMessage={emptyMessage(section.cadence)}
          />
        ))}

        {/* Past their expiry: on chain, and nothing anybody can do. Kept for the record, folded
            away so they are never mistaken for work, and counted in no section above. */}
        {expired.length > 0 && (
          <section className="space-y-4" data-testid="expired-section">
            <button
              type="button"
              onClick={() => setShowExpired((open) => !open)}
              aria-expanded={showExpired}
              className="flex flex-wrap items-center gap-3 text-left"
            >
              <h2 className="text-base font-semibold text-zinc-400 md:text-lg">Expired</h2>
              <span className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {expired.length}
              </span>
              <p className="text-xs text-zinc-600">
                Past the expiry QuestManager enforces, so nobody can accept or complete them now.
              </p>
              <ChevronDown
                className={`h-4 w-4 text-zinc-500 transition ${showExpired ? "rotate-180" : ""}`}
              />
            </button>
            {showExpired && (
              <div className="grid gap-4 opacity-60 sm:grid-cols-2 xl:grid-cols-3">
                {expired.map((quest) => (
                  <QuestCard key={quest.questId} quest={quest} viewer={viewer} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
