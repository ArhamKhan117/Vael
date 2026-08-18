"use client";

import { useState, useEffect } from "react";
import PartnershipCarousel from "@/components/partnership-carousel";
import { Button } from "@/components/ui/button";
import { MoveRight } from "lucide-react";
import Link from "next/link";
import { useUserQuests } from "@/hooks/useQuests";
import { useWallet } from "@/hooks/useWallet";
import { useCampaigns } from "@/hooks/useCampaigns";

/** Format seconds until expiry as "Xd Xh" or "Xh Xm" etc */
function formatResetCountdown(expiryTimestamp: number | undefined | null): string {
    if (!expiryTimestamp || typeof expiryTimestamp !== "number") return "—";
    const now = Math.floor(Date.now() / 1000);
    let sec = expiryTimestamp - now;
    if (sec <= 0) return "Resetting...";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

const CATEGORY_STYLE: Record<string, { code: string; codeBg: string; codeText: string; bonusDot: string }> = {
    swap: { code: "SW", codeBg: "bg-sky-500/15", codeText: "text-sky-400", bonusDot: "bg-sky-400" },
    liquidity: { code: "LP", codeBg: "bg-sky-500/15", codeText: "text-sky-400", bonusDot: "bg-emerald-400" },
    stake: { code: "ST", codeBg: "bg-indigo-500/15", codeText: "text-indigo-400", bonusDot: "bg-indigo-400" },
    lend: { code: "L", codeBg: "bg-indigo-500/15", codeText: "text-indigo-400", bonusDot: "bg-sky-400" },
};

function mapQuestToCard(q: Record<string, unknown>, idx: number) {
    const cat = String(q.category || "swap").toLowerCase();
    const style = CATEGORY_STYLE[cat] || CATEGORY_STYLE.swap;
    const reward = q.reward_per_participant ? `${Number(q.reward_per_participant)} VAEL` : "- VAEL";
    return {
        id: String(q.quest_id_on_chain ?? q.id ?? idx),
        code: style.code,
        codeBg: style.codeBg,
        codeText: style.codeText,
        title: String(q.title || "Quest"),
        description: String(q.description || ""),
        reward,
        bonusDot: style.bonusDot,
        bonusLabel: "Badge NFT",
    };
}

export default function QuestsPage() {
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 60_000);
        return () => clearInterval(id);
    }, []);
    const { address, isConnected } = useWallet();
    const { quests: userQuests } = useUserQuests(isConnected ? address : null);
    const { campaigns: userCampaigns } = useCampaigns({
        participant: isConnected && address ? address : "",
        joinedOnly: true,
        limit: 20,
    });

    const dailyExpiry = (userQuests?.daily as { expiry_timestamp?: number } | undefined)?.expiry_timestamp;
    const weeklyExpiry = (userQuests?.weekly as { expiry_timestamp?: number } | undefined)?.expiry_timestamp;

    const campaignQuests = userCampaigns.map((c) => {
        const questId = (c as { quest_id_on_chain?: number }).quest_id_on_chain;
        return {
            id: c.id,
            questId,
            code: "CP",
            codeBg: "bg-amber-500/15",
            codeText: "text-amber-400",
            title: c.title ?? "Campaign",
            description: (c.description ?? "").replace(/<[^>]*>/g, "").slice(0, 100) || "Complete this partner quest to earn USDC rewards.",
            reward: `${Number(c.reward_per_quest_usdc ?? 0).toFixed(2)} USDC`,
            bonusDot: "bg-emerald-400",
            bonusLabel: "Partner Quest",
        };
    });

    const dailyQuests = userQuests?.daily
        ? [mapQuestToCard(userQuests.daily as Record<string, unknown>, 0)]
        : [];

    const weeklyQuests = userQuests?.weekly
        ? [mapQuestToCard(userQuests.weekly as Record<string, unknown>, 0)]
        : [];

    return (
        <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
            <div className="space-y-12">
                {/* Partnership Quests as carousel */}
                <PartnershipCarousel />

                <div className="grid gap-4 md:grid-cols-2">
                    {/* Daily Quests */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs">
                                <h2 className="text-base font-semibold md:text-lg">Daily Quests</h2>
                                <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                    Reset in {formatResetCountdown(dailyExpiry)}
                                </span>
                            </div>
                        </div>

                        <div>
                            {!isConnected ? (
                                <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-zinc-500">
                                    Connect your wallet to see your daily quests.
                                </div>
                            ) : dailyQuests.length === 0 ? (
                                <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-zinc-500">
                                    No daily quest assigned. Complete your profile to get one.
                                </div>
                            ) : (
                                dailyQuests.map((quest) => (
                                    <div
                                        key={quest.id}
                                        className="flex h-full flex-col justify-between p-6 border border-[#1A1A1A] rounded"
                                    >
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                                <div className="inline-flex items-center gap-2">
                                                    <span
                                                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${quest.codeBg} ${quest.codeText}`}
                                                    >
                                                        {quest.code}
                                                    </span>
                                                </div>
                                                <span className="rounded border border-zinc-700 px-2 py-0.5">
                                                    ID: {quest.id}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-semibold text-white">
                                                    {quest.title}
                                                </h3>
                                                <p className="text-xs leading-relaxed text-zinc-400">
                                                    {quest.description}
                                                </p>
                                            </div>

                                            <div className="mt-4 space-y-2 text-[11px]">
                                                <div className="flex items-center justify-between text-zinc-500">
                                                    <span>REWARD</span>
                                                    <span className="text-xs font-semibold text-white">
                                                        {quest.reward}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-zinc-500">
                                                    <span>BONUS</span>
                                                    <span className="inline-flex items-center gap-1 text-xs text-white">
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${quest.bonusDot}`}
                                                        />
                                                        {quest.bonusLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button asChild variant="default" className="rounded mt-5 font-semibold bg-white text-black hover:bg-white/80">
                                            <Link href={`/quests/${quest.id}`}>
                                                Continue Quest
                                                <MoveRight className="w-4 h-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                )))}
                        </div>
                    </section>

                    {/* Weekly Quests */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs">
                                <h2 className="text-base font-semibold md:text-lg">Weekly Quests</h2>
                                <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                    Reset in {formatResetCountdown(weeklyExpiry)}
                                </span>
                            </div>
                        </div>

                        <div>
                            {!isConnected ? (
                                <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-zinc-500">
                                    Connect your wallet to see your weekly quests.
                                </div>
                            ) : weeklyQuests.length === 0 ? (
                                <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-zinc-500">
                                    No weekly quest assigned. Complete your profile to get one.
                                </div>
                            ) : (
                                weeklyQuests.map((quest) => (
                                    <div
                                        key={quest.id}
                                        className="flex h-full flex-col justify-between p-6 border border-[#1A1A1A] rounded"
                                    >
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                                <div className="inline-flex items-center gap-2">
                                                    <span
                                                        className={`flex h-7 w-7 items-center justify-center rounded text-xs ${quest.codeBg} ${quest.codeText}`}
                                                    >
                                                        {quest.code}
                                                    </span>
                                                </div>
                                                <span className="rounded border border-zinc-700 px-2 py-0.5">
                                                    ID: {quest.id}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-semibold text-white">
                                                    {quest.title}
                                                </h3>
                                                <p className="text-xs leading-relaxed text-zinc-400">
                                                    {quest.description}
                                                </p>
                                            </div>

                                            <div className="mt-4 space-y-2 text-[11px]">
                                                <div className="flex items-center justify-between text-zinc-500">
                                                    <span>REWARD</span>
                                                    <span className="text-xs font-semibold text-white">
                                                        {quest.reward}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-zinc-500">
                                                    <span>BONUS</span>
                                                    <span className="inline-flex items-center gap-1 text-xs text-white">
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${quest.bonusDot}`}
                                                        />
                                                        {quest.bonusLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button asChild variant="default" className="rounded mt-5 font-semibold bg-white text-black hover:bg-white/80">
                                            <Link href={`/quests/${quest.id}`}>
                                                Continue Quest
                                                <MoveRight className="w-4 h-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                )))}
                        </div>
                    </section>
                </div>

                {/* Campaign Quests - only quests user has joined */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs">
                            <h2 className="text-base font-semibold md:text-lg">Campaign Quests</h2>
                            <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                My joined campaigns
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                        {!isConnected ? (
                            <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-zinc-500">
                                Connect your wallet to see your campaign quests.
                            </div>
                        ) : campaignQuests.length === 0 ? (
                            <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-zinc-500">
                                You haven&apos;t joined any campaign quests. Browse the carousel above to join one.
                            </div>
                        ) : (
                            campaignQuests.map((quest) => (
                                <div
                                    key={quest.id}
                                    className="flex h-full flex-col justify-between rounded border border-[#1A1A1A] p-6"
                                >
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${quest.codeBg} ${quest.codeText}`}>
                                                {quest.code}
                                            </span>
                                            <span className="rounded border border-zinc-700 px-2 py-0.5">
                                                Partner
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-white">
                                                {quest.title}
                                            </h3>
                                            <p className="text-xs leading-relaxed text-zinc-400">
                                                {quest.description}
                                            </p>
                                        </div>
                                        <div className="mt-4 space-y-2 text-[11px]">
                                            <div className="flex items-center justify-between text-zinc-500">
                                                <span>REWARD</span>
                                                <span className="text-xs font-semibold text-emerald-400">
                                                    {quest.reward}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-zinc-500">
                                                <span>BONUS</span>
                                                <span className="inline-flex items-center gap-1 text-xs text-white">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${quest.bonusDot}`} />
                                                    {quest.bonusLabel}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button asChild variant="default" className="mt-5 rounded bg-white font-semibold text-black hover:bg-white/80">
                                        <Link href={quest.questId != null ? `/quests/${quest.questId}` : `/campaigns/${quest.id}`}>
                                            {quest.questId != null ? "Continue Quest" : "View Campaign"}
                                            <MoveRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
