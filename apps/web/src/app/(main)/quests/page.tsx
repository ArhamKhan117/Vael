"use client";

import { useMemo } from "react";
import Link from "next/link";

import PartnershipCarousel from "@/components/partnership-carousel";
import { QuestCard, QuestGridEmpty } from "@/components/quest-card";
import { useAllQuests } from "@/hooks/useQuests";
import { useWallet } from "@/hooks/useWallet";
import type { ChainQuest } from "@/lib/api";

/**
 * The quest board.
 *
 * Every quest here exists because QuestManager emitted QuestCreated on Creditcoin, and every one of
 * them is on this page whether a wallet is connected or not. Connecting does not filter the board;
 * it sorts it, putting your own assignments first and marking them.
 *
 * That is deliberate. The board is the argument: a visitor should be able to see that real quests
 * exist, who they are assigned to and which have been proved, before deciding to connect anything.
 * The one thing a wallet is needed for is accepting, and a quest is assigned to an address at
 * creation, so somebody else's quest is readable by everyone and acceptable by nobody else.
 */

const PERSONAL: { cadence: ChainQuest["cadence"]; title: string; blurb: string }[] = [
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
];

const BOARD: { cadence: ChainQuest["cadence"]; title: string; blurb: string }[] = [
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

function SectionHeading({ title, count, blurb }: { title: string; count: number; blurb: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-base font-semibold md:text-lg">{title}</h2>
      <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        {count}
      </span>
      <p className="text-xs text-zinc-500">{blurb}</p>
    </div>
  );
}

export default function QuestsPage() {
  const { address, isConnected } = useWallet();
  // Never filtered by participant. The whole board, always.
  const { quests, loading, error } = useAllQuests();
  const viewer = isConnected && address ? address.toLowerCase() : undefined;

  const mineCount = useMemo(
    () => (viewer ? quests.filter((q) => q.participant?.toLowerCase() === viewer).length : 0),
    [quests, viewer]
  );

  const byCadence = useMemo(() => {
    const map = new Map<ChainQuest["cadence"], ChainQuest[]>();
    for (const quest of quests) {
      const list = map.get(quest.cadence) ?? [];
      list.push(quest);
      map.set(quest.cadence, list);
    }
    // Your own assignments first inside each section, then the rest. Sorting rather than hiding is
    // the whole difference between a board and a private list.
    if (viewer) {
      for (const list of map.values()) {
        list.sort((a, b) => {
          const mineA = a.participant?.toLowerCase() === viewer ? 0 : 1;
          const mineB = b.participant?.toLowerCase() === viewer ? 0 : 1;
          return mineA - mineB || b.questId - a.questId;
        });
      }
    }
    return map;
  }, [quests]);

  const emptyMessage = (cadence: ChainQuest["cadence"]) => {
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
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="space-y-12">
        <PartnershipCarousel />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold md:text-2xl">Quest board</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {viewer
                ? `Every quest on chain, read from QuestManager. ${mineCount} assigned to your wallet, shown first.`
                : "Every quest on chain, read from QuestManager. Connect a wallet to accept the ones assigned to you."}
            </p>
          </div>
          <p className="text-xs text-zinc-500" data-testid="quest-count">
            {loading ? "Loading…" : `${quests.length} quest${quests.length === 1 ? "" : "s"} indexed`}
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* The two personal quests sit side by side: one card each, and a four-column grid would
            leave three quarters of the row empty. */}
        <div className="grid gap-8 md:grid-cols-2">
          {PERSONAL.map((section) => {
            const list = byCadence.get(section.cadence) ?? [];
            return (
              <section key={section.cadence} className="space-y-4">
                <SectionHeading title={section.title} count={list.length} blurb={section.blurb} />
                <div className="grid gap-4">
                  {loading ? (
                    <QuestGridEmpty>Reading the chain…</QuestGridEmpty>
                  ) : list.length === 0 ? (
                    <QuestGridEmpty>{emptyMessage(section.cadence)}</QuestGridEmpty>
                  ) : (
                    list.map((quest) => (
                      <QuestCard key={quest.questId} quest={quest} viewer={viewer} />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {BOARD.map((section) => {
          const list = byCadence.get(section.cadence) ?? [];
          return (
            <section key={section.cadence} className="space-y-4">
              <SectionHeading title={section.title} count={list.length} blurb={section.blurb} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {loading ? (
                  <QuestGridEmpty>Reading the chain…</QuestGridEmpty>
                ) : list.length === 0 ? (
                  <QuestGridEmpty>{emptyMessage(section.cadence)}</QuestGridEmpty>
                ) : (
                  list.map((quest) => (
                    <QuestCard key={quest.questId} quest={quest} viewer={viewer} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
