"use client"

import { LeaderboardTables } from "./leaderboard-client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { OrbitingCircles } from "@/components/ui/orbiting-circles";
import {
    BadgeCheck,
    ChevronLeft,
    ChevronRight,
    Crown,
    Diamond,
    File,
    Lock,
    Rocket,
    Search,
    Settings,
    Sparkles,
    Star,
    TrendingUp,
    Trophy,
    Users,
    Wallet,
} from "lucide-react";
import { useIsMobile } from "@/hooks/breakpoint";

type LeaderRow = {
    rank: number;
    name: string;
    handle: string;
    avatarSrc: string;
    level: number;
    xp: number;
    deltaToday?: number;
    // distribution: { defi: number; social: number; nft: number };
    trendPct?: number;
    completed_quests: number;
};

const ITEMS_PER_PAGE = 10;

function paginate<T>(items: T[], page: number, perPage: number) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const safePage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (safePage - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, total);

    return {
        items: items.slice(startIndex, endIndex),
        currentPage: safePage,
        totalPages,
        startIndex: total === 0 ? 0 : startIndex + 1,
        endIndex,
        total,
    };
}

function mapApiToLeaderRow(entry: { rank: number; name?: string; wallet_address: string; level: number; total_xp: number; avatar_url?: string; completed_quests: number }, idx: number): LeaderRow {
    const shortAddr = `${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}`;
    return {
        rank: entry.rank ?? idx + 1,
        name: entry.name || `User ${shortAddr}`,
        handle: shortAddr,
        avatarSrc: entry.avatar_url || "/images/avatar-fallback.png",
        level: entry.level,
        xp: entry.total_xp,
        completed_quests: entry.completed_quests,
    };
}

const LEADERBOARD_META = {
    totalXpEarned: 124802950,
    activeQuesters: 24812,
    seasonRewardsPool: 125000,
    seasonRewardsUnit: "USDT",
};

function formatNumber(n: number) {
    return Intl.NumberFormat("en").format(n);
}

function formatCompact(n: number) {
    return Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(n);
}

function rankBadgeClass(rank: number) {
    if (rank === 1) return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    if (rank === 2) return "bg-zinc-500/15 text-zinc-200 border-zinc-500/25";
    if (rank === 3) return "bg-orange-500/15 text-orange-300 border-orange-500/20";
    return "bg-zinc-900 text-zinc-300 border-[#1A1A1A]";
}

function rankCardAccent(rank: number) {
    if (rank === 1) return "from-amber-500/15 via-black to-black";
    if (rank === 2) return "from-zinc-300/10 via-black to-black";
    return "from-orange-500/15 via-black to-black";
}

function TopStatsStrip() {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <div className="relative overflow-hidden rounded border border-[#1A1A1A] bg-black p-5">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/5 via-black to-black" />
                <div className="relative flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Total XP earned
                        </div>
                        <div className="text-2xl font-semibold text-white">
                            {formatNumber(LEADERBOARD_META.totalXpEarned)}
                        </div>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded border border-[#1A1A1A] bg-[#18181B] text-zinc-200">
                        <TrendingUp className="h-4 w-4" />
                    </span>
                </div>
            </div>

            <div className="relative overflow-hidden rounded border border-[#1A1A1A] bg-black p-5">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/5 via-black to-black" />
                <div className="relative flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Active questers
                        </div>
                        <div className="text-2xl font-semibold text-white">
                            {formatNumber(LEADERBOARD_META.activeQuesters)}
                        </div>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded border border-[#1A1A1A] bg-[#18181B] text-sky-200">
                        <Users className="h-4 w-4" />
                    </span>
                </div>
            </div>

            <div className="relative overflow-hidden rounded border border-[#1A1A1A] bg-black p-5">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/5 via-black to-black" />
                <div className="relative flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            REWARDS DISTRIBUTED
                        </div>
                        <div className="text-2xl font-semibold text-white">
                            {formatCompact(LEADERBOARD_META.seasonRewardsPool)}{" "}
                            {LEADERBOARD_META.seasonRewardsUnit}
                        </div>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded border border-[#1A1A1A] bg-[#18181B] text-emerald-200">
                        <Wallet className="h-4 w-4" />
                    </span>
                </div>
            </div>
        </div>
    );
}

function OrbitProfile({
    row,
}: {
    row: Pick<LeaderRow, "rank" | "name" | "avatarSrc">;
}) {
    return (
        <div>
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded p-2 text-center">
                <div className="relative h-10 w-10 overflow-hidden rounded">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={row.avatarSrc}
                        alt={row.name}
                        className="object-cover w-full h-full"
                    />
                </div>
                <div className="space-y-0.5">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Rank {row.rank}
                    </div>
                    <div className="truncate text-[11px] font-semibold text-zinc-200">
                        {row.name}
                    </div>
                </div>
            </div>
        </div>
    );
}

function HallOfFameOrbit({ rows }: { rows: LeaderRow[] }) {
    const isMobile = useIsMobile();
    const first = rows.find((r) => r.rank === 1) ?? rows[0];
    const orbiters1 = rows.filter((r) => r.rank >= 2 && r.rank <= 3);
    const orbiters2 = rows.filter((r) => r.rank >= 4 && r.rank <= 5);

    return (
        <section className="relative overflow-hidden rounded border border-[#1A1A1A] bg-black px-6 py-10">
            <div className="pointer-events-none absolute inset-0 bg-radial from-white/6 via-black to-black" />

            <div className="relative mx-auto max-w-4xl">
                <div className="text-center">
                    <div className="text-3xl font-semibold tracking-[0.12em] text-white md:text-4xl">
                        HALL OF FAME
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        Top performers currently climbing the Vael leaderboard.
                        <br />
                        Snapshots taken every 24h.
                    </p>
                </div>

                <div className="relative mx-auto mt-8 flex h-[700px] w-full max-w-3xl items-center justify-center overflow-hidden">
                    <OrbitingCircles radius={ isMobile ? 70 : 170} reverse>
                        {orbiters1.map((r) => (
                            <OrbitProfile key={r.rank} row={r} />
                        ))}
                    </OrbitingCircles>
                    {/* Orbiting ring */}
                    <OrbitingCircles radius={ isMobile ? 140 : 270} iconSize={92} duration={22}>
                        {orbiters2.map((r) => (
                            <OrbitProfile key={r.rank} row={r} />
                        ))}
                    </OrbitingCircles>



                    {/* Center */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="mb-3 flex flex-col items-center">
                            <div className="relative overflow-hidden p-2 flex flex-col items-center justify-center">
                                <div className="relative h-16 w-16 overflow-hidden rounded">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={first?.avatarSrc ?? "/images/avatar-fallback.png"}
                                        alt={first?.name ?? "Rank 1"}
                                        className="object-cover w-full h-full"
                                    />
                                </div>
                                <div className="mt-2 text-center">
                                    <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Rank #1
                                    </div>
                                    <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white">
                                        {first?.name ?? "—"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* <div className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white text-black shadow-[0_18px_60px_rgba(255,255,255,0.18)]">
                            <Rocket className="h-5 w-5" />
                        </div> */}
                    </div>
                </div>
            </div>
        </section>
    );
}

type LeaderboardTableProps = {
    rows: LeaderRow[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
};

function LeaderboardTable({
    rows,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
}: LeaderboardTableProps) {
    return (
        <div className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
            <Table className="w-full">
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Rank
                        </TableHead>
                        <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            User
                        </TableHead>
                        <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Level
                        </TableHead>
                        <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Completed quests
                        </TableHead>
                        {/* <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Quest distribution
                        </TableHead> */}
                        <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            XP points
                        </TableHead>
                        {/* <TableHead className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Trend
                        </TableHead> */}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {rows.map((row) => (
                        <TableRow
                            key={row.rank}
                            className={cn(
                                "hover:bg-white/5",
                                row.rank <= 3 && "bg-white/3"
                            )}
                        >
                            <TableCell className="px-5 py-4 align-middle">
                                <span
                                    className={cn(
                                        "inline-flex h-8 w-8 items-center justify-center rounded border text-xs font-semibold",
                                        rankBadgeClass(row.rank)
                                    )}
                                >
                                    {row.rank}
                                </span>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-middle">
                                <div className="flex items-center gap-3">
                                    <div className="relative h-10 w-10 overflow-hidden rounded border border-white/10 bg-zinc-900">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={row.avatarSrc}
                                            alt={row.name}
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="inline-flex items-center gap-2 font-semibold text-white">
                                            <span className="truncate">{row.name}</span>
                                        </div>
                                        <div className="text-xs text-zinc-500">{row.handle}</div>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-middle">
                                <span className="inline-flex items-center rounded border border-[#1A1A1A] bg-[#18181B] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                                    LVL {row.level}
                                </span>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-middle">
                                <div className="space-y-1">
                                    <div className="text-sm font-semibold text-white">
                                        {row.completed_quests}
                                    </div>
                                </div>
                            </TableCell>

                            {/* <TableCell className="px-5 py-4 align-middle">
                                <QuestDistributionBar distribution={row.distribution} />
                            </TableCell> */}

                            <TableCell className="px-5 py-4 align-middle">
                                <div className="space-y-1">
                                    <div className="text-sm font-semibold text-white">
                                        {formatNumber(row.xp)}
                                    </div>
                                    {typeof row.deltaToday === "number" ? (
                                        <div className="text-[11px] text-emerald-400">
                                            +{formatNumber(row.deltaToday)} today
                                        </div>
                                    ) : null}
                                </div>
                            </TableCell>

                            {/* <TableCell className="px-5 py-4 text-right align-middle">
                                {typeof row.trendPct === "number" ? (
                                    <span className="text-[11px] font-semibold text-emerald-400">
                                        +{row.trendPct}%
                                    </span>
                                ) : (
                                    <span className="text-xs text-zinc-600">—</span>
                                )}
                            </TableCell> */}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t border-[#1A1A1A] px-5 py-4 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
                <div>
                    {totalCount === 0
                        ? "No players to display"
                        : `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(
                              currentPage * pageSize,
                              totalCount
                          )} of ${totalCount} players`}
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="grid h-9 w-9 place-items-center rounded border border-[#1A1A1A] bg-black text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-black"
                            aria-label="Previous page"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button
                                key={p}
                                type="button"
                                className={cn(
                                    "grid h-9 w-9 place-items-center rounded border text-xs font-semibold",
                                    p === currentPage
                                        ? "border-sky-500/40 bg-sky-500/15 text-sky-100"
                                        : "border-[#1A1A1A] bg-black text-zinc-300 hover:bg-white/5"
                                )}
                                aria-current={p === currentPage ? "page" : undefined}
                                onClick={() => onPageChange(p)}
                            >
                                {p}
                            </button>
                        ))}
                        {/* <button
                            type="button"
                            className="grid h-9 w-14 place-items-center rounded border border-[#1A1A1A] bg-black text-[10px] font-semibold text-zinc-400"
                            disabled
                        >
                            {pageSize} / page
                        </button> */}
                        <button
                            type="button"
                            className="grid h-9 w-9 place-items-center rounded border border-[#1A1A1A] bg-black text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-black"
                            aria-label="Next page"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeaderboardPage() {
    const { leaderboard, loading } = useLeaderboard(100);
    const [page, setPage] = useState(1);

    const leaderboardRows = useMemo(() => {
        if (leaderboard.length > 0) {
            return leaderboard.map((e, i) => mapApiToLeaderRow(e, i));
        }
        return [];
    }, [leaderboard]);

    const { items: pagedRows, currentPage, totalPages, total } = useMemo(
        () => paginate(leaderboardRows, page, ITEMS_PER_PAGE),
        [leaderboardRows, page]
    );

    return (
        <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
            <div className="mx-auto w-full space-y-6">
                {/* Chain-derived rankings. Everything below this is proof-backed. */}
                <LeaderboardTables />

                <TopStatsStrip />
                <HallOfFameOrbit rows={leaderboardRows} />

                <section className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-white">
                                FULL LEADERBOARD
                            </div>
                            {/* <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                Season 3 • All network players
                            </div> */}
                        </div>
                    </div>

                    {/* <CurrentUserRow /> */}

                    <LeaderboardTable
                        rows={pagedRows}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={total}
                        pageSize={ITEMS_PER_PAGE}
                        onPageChange={setPage}
                    />
                </section>
            </div>
        </main>
    );
}
