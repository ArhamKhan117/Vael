"use client";

import { CampaignCard } from "@/components/campaign-card";
import { useCampaigns } from "@/hooks/useCampaigns";

/**
 * Every partner campaign, read from CampaignEscrow.
 *
 * A campaign is a pool of money on Creditcoin and nothing else, so this page shows the pool: what
 * went in, what verified proofs have taken out, what was refunded, and what remains. A campaign
 * with no name is a pool somebody funded without publishing quests through the studio, and it
 * still appears, under its key.
 */

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
            campaigns.map((campaign) => (
              <CampaignCard key={campaign.campaignKey} campaign={campaign} />
            ))
          )}
        </div>
      </div>
    </main>
  );
}
