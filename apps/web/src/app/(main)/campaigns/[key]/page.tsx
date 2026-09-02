"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

import { QuestCard, QuestGridEmpty } from "@/components/quest-card";
import { useCampaign } from "@/hooks/useCampaigns";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

/**
 * One partner campaign: the pool, and every quest that draws on it.
 *
 * There is no join button. A campaign quest is created for a named participant by the partner, in
 * the studio, and accepting it happens on the quest itself; nothing on this page can make the
 * escrow pay.
 */

const EXPLORER = "https://creditcoin-testnet.blockscout.com";

function vael(raw: string) {
  return (Number(raw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export default function CampaignDetailPage() {
  const params = useParams();
  const key = typeof params.key === "string" ? params.key : null;
  const { campaign, quests, loading, error } = useCampaign(key);

  if (loading) {
    return (
      <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
        <p className="text-sm text-zinc-500">Reading the escrow…</p>
      </main>
    );
  }

  if (error || !campaign) {
    return (
      <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
        <p className="text-sm text-zinc-400">{error ?? "No campaign with that key."}</p>
        <Link href="/campaigns" className="mt-4 inline-block text-sm text-white underline">
          Back to campaigns
        </Link>
      </main>
    );
  }

  const escrowAddress = CONTRACT_ADDRESSES.CAMPAIGN_ESCROW;

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="space-y-10">
        <div className="space-y-3">
          <Link href="/campaigns" className="text-xs text-zinc-500 underline hover:text-white">
            All campaigns
          </Link>
          <h1 className="text-xl font-semibold md:text-2xl">
            {campaign.title ?? campaign.campaignId ?? "Partner campaign"}
          </h1>
          <p className="break-all font-mono text-[11px] text-zinc-500">{campaign.campaignKey}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "In escrow", value: `${Number(campaign.balanceVael).toLocaleString(undefined, { maximumFractionDigits: 3 })} VAEL` },
            { label: "Deposited", value: `${vael(campaign.deposited)} VAEL` },
            { label: "Released on proof", value: `${vael(campaign.released)} VAEL` },
            { label: "Refunded", value: `${vael(campaign.refunded)} VAEL` },
          ].map((stat) => (
            <div key={stat.label} className="rounded border border-[#1A1A1A] p-5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{stat.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded border border-[#1A1A1A] p-5 text-xs text-zinc-400">
          <p>
            Funded by{" "}
            <span className="font-mono text-zinc-300">{campaign.partner || "unknown"}</span>. The
            escrow releases only to QuestASC, and QuestASC releases only after the block prover
            precompile has verified a Merkle and a continuity proof of the player&apos;s source
            transaction.
          </p>
          {escrowAddress && (
            <a
              className="mt-2 inline-block underline hover:text-white"
              href={`${EXPLORER}/address/${escrowAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              CampaignEscrow on Blockscout
            </a>
          )}
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold md:text-lg">
            Quests drawing on this pool ({quests.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quests.length === 0 ? (
              <QuestGridEmpty>
                This pool is funded but no quest has been published against it yet.
              </QuestGridEmpty>
            ) : (
              quests.map((quest) => <QuestCard key={quest.questId} quest={quest} />)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
