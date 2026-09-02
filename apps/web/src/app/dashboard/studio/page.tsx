"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { ArrowUpRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/hooks/useCampaigns";
import type { ChainCampaign } from "@/lib/api";

/**
 * The partner studio.
 *
 * A campaign here is a pool in CampaignEscrow, not a database row: the numbers are the escrow's
 * own, and a campaign appears the moment its deposit lands. Publishing quests against a pool
 * happens in the partner flow, which refuses to publish quests the pool cannot cover.
 */

const STATUS_CHIP: Record<ChainCampaign["status"], string> = {
  funded: "border-emerald-500/40 text-emerald-400",
  drained: "border-zinc-700 text-zinc-400",
  refunded: "border-amber-500/40 text-amber-400",
};

function vael(raw: string) {
  return (Number(raw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function label(campaign: ChainCampaign) {
  return campaign.title ?? campaign.campaignId ?? `${campaign.campaignKey.slice(0, 12)}…`;
}

export default function StudioPage() {
  const { address, isConnected } = useAccount();
  const { campaigns, loading, error } = useCampaigns(
    isConnected && address ? { partner: address } : undefined
  );

  const totals = useMemo(() => {
    let deposited = 0n;
    let released = 0n;
    let balance = 0n;
    for (const campaign of campaigns) {
      deposited += BigInt(campaign.deposited);
      released += BigInt(campaign.released);
      balance += BigInt(campaign.balance);
    }
    return {
      deposited: deposited.toString(),
      released: released.toString(),
      balance: balance.toString(),
    };
  }, [campaigns]);

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold md:text-2xl">Partner studio</h1>
            <p className="max-w-2xl text-sm text-zinc-400">
              {isConnected
                ? "Every pool this wallet has funded in CampaignEscrow on Creditcoin."
                : "Every pool in CampaignEscrow on Creditcoin. Connect a partner wallet to see only its own."}
            </p>
          </div>
          <Button
            asChild
            className="rounded bg-white font-semibold text-black hover:bg-white/80"
          >
            <Link href="/dashboard/studio/partner">
              <Plus className="mr-2 h-4 w-4" />
              Fund a campaign
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Deposited", value: totals.deposited },
            { label: "Released on proof", value: totals.released },
            { label: "Left in escrow", value: totals.balance },
          ].map((stat) => (
            <div key={stat.label} className="rounded border border-[#1A1A1A] p-5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{stat.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{vael(stat.value)} VAEL</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded border border-[#1A1A1A]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#1A1A1A] text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">Campaign</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">In escrow</th>
                <th className="px-5 py-3 font-medium">Released</th>
                <th className="px-5 py-3 font-medium">Quests</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                    Reading the escrow…
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                    {isConnected
                      ? "This wallet has not funded a campaign yet."
                      : "Connect a wallet to see its campaigns."}
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr
                    key={campaign.campaignKey}
                    data-testid={`studio-campaign-${campaign.campaignKey}`}
                    className="border-b border-[#1A1A1A] last:border-0"
                  >
                    <td className="max-w-[260px] truncate px-5 py-4 text-white">
                      {label(campaign)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${STATUS_CHIP[campaign.status]}`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-300">
                      {Number(campaign.balanceVael).toLocaleString(undefined, {
                        maximumFractionDigits: 3,
                      })}
                    </td>
                    <td className="px-5 py-4 text-zinc-300">{vael(campaign.released)}</td>
                    <td className="px-5 py-4 text-zinc-300">
                      {campaign.completedCount} / {campaign.questCount}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={
                          campaign.campaignId
                            ? `/dashboard/studio/partner?campaign=${encodeURIComponent(campaign.campaignId)}`
                            : `/campaigns/${campaign.campaignKey}`
                        }
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 underline hover:text-white"
                      >
                        Manage
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
