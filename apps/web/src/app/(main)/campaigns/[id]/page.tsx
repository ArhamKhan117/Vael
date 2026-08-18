"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, type Campaign } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAppKit } from "@reown/appkit/react";
import { useWallet } from "@/hooks/useWallet";
import { useReownWallet } from "@/hooks/useReownWallet";
import { ArrowLeft, MoveRight } from "lucide-react";

const DEFAULT_THUMBNAIL = "https://picsum.photos/seed/quest/600/400";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { open } = useAppKit();
  const { isCreditcoinNetwork } = useReownWallet();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    api
      .getCampaign(id)
      .then(setCampaign)
      .catch(() => setCampaign(null))
      .finally(() => setLoading(false));
  }, [params?.id]);

  const handleConnect = () => open({ view: "Connect" });

  const handleJoin = async () => {
    if (!campaign || !address) return;
    if (!isCreditcoinNetwork) {
      setError("Please switch to Creditcoin Testnet");
      return;
    }
    setJoinLoading(true);
    setError(null);
    try {
      const { questIdOnChain } = await api.joinCampaign(campaign.id, address);
      router.push(`/quests/${questIdOnChain}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join campaign");
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
        <div className="mx-auto max-w-2xl py-20 text-center text-zinc-400">
          Loading campaign...
        </div>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
        <div className="mx-auto max-w-2xl py-20 text-center">
          <p className="text-zinc-400">Campaign not found</p>
          <Button asChild variant="default" className="mt-4">
            <Link href="/quests">Back to Quests</Link>
          </Button>
        </div>
      </main>
    );
  }

  const rewardUsdc = Number(campaign.reward_per_quest_usdc ?? 0).toFixed(2);
  const poolAmount = Number(campaign.pool_amount ?? 0);
  const participants = campaign.participant_count ?? 0;
  const maxParticipants = campaign.max_participants ?? 0;
  const isActive = campaign.status === "active";
  const thumbnail = campaign.thumbnail ?? DEFAULT_THUMBNAIL;
  const description = (campaign.description ?? "")
    .replace(/<[^>]*>/g, "")
    .trim();

  return (
    <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link
          href="/quests"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quests
        </Link>

        <article className="rounded border border-[#1A1A1A] bg-[#18181B] overflow-hidden">
          <div className="relative h-56 w-full md:h-72">
            <Image
              src={thumbnail}
              alt={campaign.title}
              fill
              className="object-cover"
              unoptimized={thumbnail.startsWith("ipfs://")}
            />
            <div className="absolute bottom-4 left-4 rounded bg-black/70 px-3 py-1 text-xs uppercase tracking-wider text-sky-300">
              {campaign.template_type} · {campaign.status}
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">
                {campaign.title}
              </h1>
              {description && (
                <p className="mt-3 text-zinc-400">{description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="rounded bg-black/40 px-4 py-2">
                <span className="text-zinc-500">Reward per quest</span>
                <p className="font-semibold text-emerald-400">
                  {rewardUsdc} USDC
                </p>
              </div>
              <div className="rounded bg-black/40 px-4 py-2">
                <span className="text-zinc-500">Pool</span>
                <p className="font-semibold text-white">
                  {poolAmount.toFixed(2)} USDC
                </p>
              </div>
              <div className="rounded bg-black/40 px-4 py-2">
                <span className="text-zinc-500">Slots</span>
                <p className="font-semibold text-white">
                  {participants} / {maxParticipants}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {!isConnected ? (
                <Button
                  variant="default"
                  className="rounded bg-sky-500 text-black hover:bg-sky-400"
                  onClick={handleConnect}
                >
                  Connect Wallet to Join
                </Button>
              ) : !isCreditcoinNetwork ? (
                <p className="text-sm text-amber-500">
                  Switch to Creditcoin Testnet to join this campaign.
                </p>
              ) : (
                <>
                  <Button
                    variant="default"
                    className="rounded bg-sky-500 text-black hover:bg-sky-400"
                    onClick={handleJoin}
                    disabled={!isActive || participants >= maxParticipants || joinLoading}
                  >
                    {joinLoading ? (
                      "Joining..."
                    ) : !isActive ? (
                      "Campaign not active"
                    ) : participants >= maxParticipants ? (
                      "Campaign full"
                    ) : (
                      <>
                        Join Quest
                        <MoveRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            <p className="text-xs text-zinc-500">
              Rewards are held in escrow and released only when the Attestcoin proof of your
              action verifies on Creditcoin.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
