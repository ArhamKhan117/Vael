"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Dither from "@/components/ui/Dither";
import FaultyTerminal from "@/components/ui/FaultyTerminal";
import {
  ArrowRightLeft,
  FileCheck2,
  Github,
  MoveRight,
  Trophy,
  Twitter,
} from "lucide-react";
import Link from "next/link";
import Marquee from "react-fast-marquee";
import { TypeAnimation } from "react-type-animation";
import PartnershipCarousel from "@/components/partnership-carousel";
import { LiveRaidBanner } from "@/components/live-raid-banner";
import { NetworkStats } from "@/components/network-stats";
import { FaqSection } from "@/components/faq-section";
import { api } from "@/lib/api";
// import TextType from "@/components/ui/TextType";
// import dynamic from "next/dynamic";

// const Dither = dynamic(() => import("@/components/ui/Dither"), {
//   ssr: false,
// });

/** Creditcoin ecosystem surfaces Vael builds on. */
const ECOSYSTEM = [
  { name: "Creditcoin", role: "Game chain" },
  { name: "Attestcoin", role: "Proof layer" },
  { name: "Ethereum", role: "Source chain" },
  { name: "PenguinSwap", role: "Native DEX" },
  { name: "PenguinBase", role: "Ecosystem" },
  { name: "Credit Wallet", role: "Wallet" },
] as const;

type HomeFeedbackItem = {
  quote: string;
  name: string;
  role: string;
  rating: number;
};

export default function Home() {
  // Empty until the API answers with something real. There is no placeholder set: an invented
  // testimonial is a made-up number wearing a name.
  const [homeFeedback, setHomeFeedback] = useState<HomeFeedbackItem[]>([]);

  useEffect(() => {
    const loadHomeFeedback = async () => {
      try {
        const res = await api.listFeedback({ limit: 3 });
        const items = (res.feedback ?? []).map<HomeFeedbackItem>((f) => ({
          quote: f.message,
          name: f.name || f.username || "Community member",
          role:
            f.role ||
            (f.wallet_address
              ? `On-chain user ${f.wallet_address.slice(0, 6)}…${f.wallet_address.slice(-4)}`
              : "Community member"),
          rating: f.rating,
        }));
        if (items.length > 0) {
          setHomeFeedback(items);
        }
      } catch (err) {
        console.error("Failed to load home feedback", err);
      }
    };

    loadHomeFeedback();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section
        id="hero"
        className="mx-auto flex min-h-screen flex-col justify-end overflow-hidden"
      >
        <div className='absolute w-full h-dvh'>
          <Dither
            waveColor={[0, 0, 0.5]}
            disableAnimation={false}
            enableMouseInteraction
            mouseRadius={0.1}
            colorNum={4}
            pixelSize={2}
            waveAmplitude={0.3}
            waveFrequency={3}
            waveSpeed={0.05}
          />
        </div>

        <div className="relative z-10 px-5 md:px-10 py-5 grid md:flex flex-row justify-between">
          <div className="space-y-5 max-w-xl text-center md:text-left">
            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Complete Quests. Earn Rewards.
              </h1>
              <TypeAnimation
                sequence={[
                  // Same substring at the start will only be typed once, initially
                  'Join the ultimate DeFi quest platform. Complete on-chain tasks, participate in communities, and earn valuable rewards while climbing the leaderboard.',
                ]}
                speed={75}
              // style={{ fontSize: '2em' }}
              // repeat={Infinity}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm justify-center md:justify-start">
              <Link href="/quests">
                <Button variant="default" className="rounded font-semibold bg-white text-black hover:bg-white/80">
                  Explore Quests
                  <MoveRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-end justify-center md:justify-between mt-4 md:mt-0">
            <div className="border-r border-white py-1 px-4">
              <Link href="https://x.com" target="_blank" rel="noopener noreferrer">
                <Twitter className="w-6 h-6 text-white transition-transform duration-500 hover:rotate-[360deg]" />
              </Link>
            </div>
            <div className="py-1 px-4">
              <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Github className="w-6 h-6 text-white transition-transform duration-500 hover:rotate-[360deg]" />
              </Link>
            </div>
          </div>
        </div>

        {/* Invisible sentinel used by the navbar to detect when hero ends */}
        <div id="hero-end" className="absolute bottom-0 mt-24 h-px w-full" />
      </section>

      <div className="m-5 space-y-5 md:m-10">
        <LiveRaidBanner />
        <NetworkStats />
      </div>

      <div className="border border-[#1A1A1A] m-5 md:m-10">
        <section className="p-10 space-y-8 border-b border-[#1A1A1A]">
          <h1 className="text-3xl font-semibold text-white text-center">Powered By</h1>
          <Marquee className="gap-10" gradient={true} gradientColor="#000000" gradientWidth={100} pauseOnHover={true}>
            {[...ECOSYSTEM, ...ECOSYSTEM, ...ECOSYSTEM].map((item, i) => (
              <div key={`${item.name}-${i}`} className="mx-10 flex flex-col items-center justify-center">
                <span className="font-matemasie text-2xl leading-none text-white">{item.name}</span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  {item.role}
                </span>
              </div>
            ))}
          </Marquee>
        </section>

        <section className="border-b border-[#1A1A1A]">
          <div className="">
            <div className="border-b border-[#1A1A1A] p-10">
              <h2 className="text-2xl font-semibold tracking-[0.16em] text-white md:text-3xl">
                3 SIMPLE STEPS
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400 md:text-sm">
                Join the ultimate DeFi quest platform. Complete on-chain tasks and earn
                rewards, all in a few simple steps.
              </p>
            </div>

            <div className="grid md:grid-cols-3">
              <div className="flex flex-col justify-between border-r border-[#1A1A1A] p-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-center">
                    <div className="flex h-[150px] w-[150px] items-center justify-center text-white">
                      <ArrowRightLeft className="h-[100px] w-[100px]" />
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500">
                      STEP 01
                    </span>
                    <h3 className="text-sm font-semibold text-white">
                      Accept &amp; Execute
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      Select a quest on Vael and perform the required
                      on-chain action or swap on your favorite DeFi venue.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between border-r border-[#1A1A1A] p-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-center">
                    <div className="flex h-[150px] w-[150px] items-center justify-center text-white">
                      <FileCheck2 className="h-[100px] w-[100px]" />
                    </div>
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500">
                      STEP 02
                    </span>
                    <h3 className="text-sm font-semibold text-white">
                      Automatic Verification
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      Once you act on Ethereum, the Attestcoin Protocol attests the block and
                      QuestASC verifies the proof on Creditcoin. No backend key decides the outcome.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between p-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-center">
                    <div className="flex h-[150px] w-[150px] items-center justify-center text-white">
                      <Trophy className="h-[100px] w-[100px]" />
                    </div>
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500">
                      STEP 03
                    </span>
                    <h3 className="text-sm font-semibold text-white">
                      Receive Rewards
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      Once verified, rewards are sent directly to your wallet
                      VAEL, partner-funded stablecoin payouts, and soul-bound badge NFTs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div>
            {/* Header */}
            <div className="space-y-3 p-10 border-b border-[#1A1A1A]">
              <h2 className="text-3xl font-semibold md:text-4xl">Active Campaigns.</h2>
              <p className="max-w-2xl text-xs leading-relaxed text-zinc-400 md:text-sm">
                Explore proof-verified quests across Ethereum and Creditcoin. Complete real DeFi
                actions to earn VAEL and soul-bound badges.
              </p>
            </div>

            <div>
              <PartnershipCarousel showHeading={false} />
            </div>

          </div>
        </section>

        {/* Feedback. Rendered only when real feedback exists. */}
        {homeFeedback.length > 0 && (
        <section className="border-b border-[#1A1A1A]">
          <div className="p-10 space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2 max-w-2xl">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-sky-400">
                  COMMUNITY VOICES
                </p>
                <h2 className="text-2xl font-semibold md:text-3xl">
                  What builders say about Vael.
                </h2>
                <p className="text-xs leading-relaxed text-zinc-400 md:text-sm">
                  Left by people who used Vael and signed with their wallet. Nothing on this page is
                  written on their behalf.
                </p>
              </div>

              <Link href="/feedback" className="mt-2 md:mt-0">
                <Button
                  variant="default"
                  className="rounded font-semibold bg-white text-black hover:bg-white/80"
                >
                  View all feedback
                  <MoveRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {homeFeedback.map((item, idx) => (
                <div
                  key={idx}
                  className="flex h-full flex-col justify-between rounded border border-zinc-800 bg-zinc-950/60 p-5"
                >
                  <p className="text-xs leading-relaxed text-zinc-200 md:text-sm">
                    “{item.quote}”
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        {item.role}
                      </p>
                    </div>
                    {typeof item.rating === "number" && (
                      <div className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {item.rating.toFixed(1)} / 5
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        <FaqSection />

        <section className="relative overflow-hidden p-10">

          <div className="pointer-events-none absolute inset-0 z-10">
            <FaultyTerminal
              scale={1.5}
              gridMul={[2, 1]}
              digitSize={1.2}
              timeScale={0.5}
              pause={false}
              scanlineIntensity={0.5}
              glitchAmount={1}
              flickerAmount={1}
              noiseAmp={1}
              chromaticAberration={0}
              dither={0}
              curvature={0.1}
              tint="#f51414"
              mouseReact
              mouseStrength={0.5}
              pageLoadAnimation
              brightness={0.6}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-6 md:flex-row md:items-center relative z-10">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-sky-400">
                READY TO START
              </p>
              <h2 className="text-2xl font-semibold md:text-3xl">
                Ready to Begin Your Quest?
              </h2>
              <p className="max-w-xl text-xs leading-relaxed text-zinc-200 md:text-sm">
                Connect your wallet to start earning rewards, complete challenges, and join the community of DeFi enthusiasts.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Link href="/quests">
                <Button variant="default" className="rounded font-semibold bg-white text-black hover:bg-white/80">
                  Explore Quests
                  <MoveRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
