"use client";

import Link from "next/link";
import { MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/hooks/useCampaigns";
import type { ChainCampaign } from "@/lib/api";

/**
 * Every partner campaign, read from CampaignEscrow.
 *
 * A campaign is a pool of money on Creditcoin and nothing else, so this page shows the pool: what
 * went in, what verified proofs have taken out, what was refunded, and what remains. A campaign
 * with no name is a pool somebody funded without publishing quests through the studio, and it
 * still appears, under its key.
 */

const STATUS_STYLE: Record<ChainCampaign["status"], { label: string; chip: string }> = {
  funded: { label: "Funded", chip: "border-emerald-500/40 text-emerald-400" },
  drained: { label: "Fully paid out", chip: "border-zinc-700 text-zinc-400" },
  refunded: { label: "Refunded", chip: "border-amber-500/40 text-amber-400" },
};

function vael(amount: string) {
  return Number(amount).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function named(campaign: ChainCampaign) {
  return campaign.title ?? campaign.campaignId ?? null;
}

export default function CampaignsPage() {
  const { campaigns, loading, error } = useCampaigns();

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold md:text-2xl">Partner campaigns</h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            A partner deposits a pool into CampaignEscrow on Creditcoin and publishes quests against
            it. The only address the escrow will pay is QuestASC, and the only thing that makes
            QuestASC pay is an Attestcoin proof of the player&apos;s own transaction. No key here can
            release a campaign reward.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-sm text-zinc-500">
              Reading the escrow…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="col-span-full rounded border border-[#1A1A1A] bg-black/40 py-12 text-center text-sm text-zinc-500">
              No campaign has been funded yet.
            </div>
          ) : (
            campaigns.map((campaign) => {
              const status = STATUS_STYLE[campaign.status];
              return (
                <div
                  key={campaign.campaignKey}
                  data-testid={`campaign-${campaign.campaignKey}`}
                  className="flex h-full flex-col justify-between rounded border border-[#1A1A1A] p-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${status.chip}`}
                      >
                        {status.label}
                      </span>
                      {named(campaign) && (
                        <span className="truncate rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500">
                          {campaign.campaignKey.slice(0, 10)}…
                        </span>
                      )}
                    </div>

                    <h2 className="truncate text-sm font-semibold text-white">
                      {named(campaign) ?? (
                        <span className="font-mono text-xs text-zinc-300">
                          {campaign.campaignKey.slice(0, 18)}…
                        </span>
                      )}
                    </h2>

                    <div className="space-y-2 border-t border-[#1A1A1A] pt-4 text-[11px]">
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>IN ESCROW</span>
                        <span className="text-xs font-semibold text-white">
                          {vael(campaign.balanceVael)} VAEL
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>DEPOSITED</span>
                        <span className="text-xs text-white">
                          {vael((Number(campaign.deposited) / 1e18).toString())} VAEL
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>RELEASED ON PROOF</span>
                        <span className="text-xs text-white">
                          {vael((Number(campaign.released) / 1e18).toString())} VAEL
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>QUESTS</span>
                        <span className="text-xs text-white">
                          {campaign.completedCount} of {campaign.questCount} completed
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    asChild
                    variant="default"
                    className="mt-5 rounded bg-white font-semibold text-black hover:bg-white/80"
                  >
                    <Link href={`/campaigns/${campaign.campaignKey}`}>
                      View campaign
                      <MoveRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
