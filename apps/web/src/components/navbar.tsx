"use client";

import { useIsTablet } from "@/hooks/breakpoint";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Button } from "./ui/button";
import { usePathname } from "next/navigation";
import ConnectWalletButton from "./connect-wallet-button";

type CenterItemKey =
  | "quests"
  | "academy"
  | "hero"
  | "raid"
  | "leaderboard"
  | "dashboard/studio"
  | "feedback";

const CENTER_ITEMS: {
  key: CenterItemKey;
  label: string;
  title: string;
  description: string;
}[] = [
    {
      key: "quests",
      label: "Quests",
      title: "Quests",
      description: "Browse proof-verified quests and earn VAEL, badges, and hero XP.",
    },
    {
      key: "academy",
      label: "Academy",
      title: "Academy",
      description: "Learn what a swap, a supply, and a proof actually do, then go and do one.",
    },
    {
      key: "hero",
      label: "Hero",
      title: "Hero",
      description: "Your soul-bound hero, levelled only by proofs the chain verified.",
    },
    {
      key: "raid",
      label: "Raid",
      title: "Raid",
      description: "Every point of damage on the season boss is a real DeFi action.",
    },
    {
      key: "leaderboard",
      label: "Leaderboard",
      title: "Leaderboard",
      description: "Track top heroes and raid damage across the Vael leaderboard in real time.",
    },
    {
      key: "feedback",
      label: "Feedback",
      title: "Feedback",
      description: "Share your feedback and help us improve Vael.",
    },
    {
      key: "dashboard/studio",
      label: "Studio",
      title: "Studio",
      description: "Fund a campaign and pay out only on verified proofs.",
    },
  ];

export default function Navbar() {
  const [isPastHero, setIsPastHero] = useState(false);
  const [activeItem, setActiveItem] = useState<CenterItemKey>("quests");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuId = useId();
  const isTablet = useIsTablet();
  const pathname = usePathname();

  useEffect(() => {
    const sentinel = document.getElementById("hero-end");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // When the sentinel is not visible, we've scrolled past the hero.
        setIsPastHero(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, []);

  const activeData = CENTER_ITEMS.find((item) => item.key === activeItem)!;

  // const headerBgClass = mobileOpen
  //   ? "bg-black"
  //   : isPastHero
  //     ? "bg-black"
  //     : "bg-transparent";

  return (
    <>
      {isTablet ? (
        <header
          className={cn(`fixed inset-x-0 top-0 z-10 transition-colors duration-300 ${pathname === "/" ? "bg-transparent" : "bg-black"}`)}
        >
          <div className="mx-auto flex flex-col items-center justify-between px-5 md:px-10 py-5">
            {/* Left: Brand */}
            <div className="flex items-center justify-between w-full">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/logo/vael.svg" alt="Vael" width={24} height={24} />
                <span className="text-xl font-medium text-white font-matemasie mb-1">
                  VAEL
                </span>
              </Link>

              <button
                type="button"
                className="relative cursor-pointer inline-flex items-center justify-center lg:hidden"
                aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
                aria-controls={mobileMenuId}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
              >
                <Menu
                  className={cn(
                    "h-6 w-6 transition-all duration-300 absolute text-white",
                    mobileOpen ? "rotate-90 opacity-0 scale-50" : "rotate-0 opacity-100 scale-100"
                  )}
                  aria-hidden="true"
                />
                <X
                  className={cn(
                    "h-6 w-6 transition-all duration-300 text-white",
                    mobileOpen ? "rotate-0 opacity-100 scale-100" : "-rotate-90 opacity-0 scale-50"
                  )}
                  aria-hidden="true"
                />
              </button>

            </div>

            {/* Mobile Menu */}
            <div
              id={mobileMenuId}
              className={cn(
                "w-full shadow-lg overflow-hidden transition-all duration-300 ease-out",
                mobileOpen
                  ? "max-h-96 opacity-100"
                  : "max-h-0 opacity-0 pointer-events-none",
              )}
            >
              <div
                className={cn(
                  "px-5 md:px-10 pt-2 pb-4 transition-transform duration-300 ease-out",
                  mobileOpen ? "translate-y-0" : "-translate-y-2"
                )}
              >
                <nav className="flex flex-col gap-1">
                  {CENTER_ITEMS.map((item) => {
                    // const active = activeItem === item.key;
                    return (
                      <Link
                        href={`/${item.key}`}
                        key={item.key}
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-2 text-[15px] font-bold transition-colors text-white",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex w-full justify-center items-center gap-3 py-2">
                  {/* <button className="inline-flex w-full h-11 items-center justify-center rounded-full bg-white px-6 text-xs font-semibold tracking-wide text-black shadow-[0_16px_45px_rgba(15,23,42,0.75)] transition hover:bg-zinc-200">
                    Connect Wallet
                  </button> */}
                  {/* <Button variant="default" className="rounded w-full font-semibold bg-white text-black hover:bg-white/80">
                    Connect Wallet
                  </Button> */}

                  <ConnectWalletButton />
                </div>
              </div>


            </div>
          </div>
        </header>
      ) : (
        <header
          className={cn(`fixed inset-x-0 top-0 z-10 transition-colors duration-300 ${pathname === "/" ? "bg-transparent" : "bg-black"}`)}
        >
          <div className="mx-auto flex items-center justify-between px-5 md:px-10 py-5">
            {/* Left: Brand */}
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo/vael.svg" alt="Vael" width={24} height={24} />
              <span className="text-xl font-medium text-white font-matemasie mb-1">
                VAEL
              </span>
            </Link>

            {/* Center: pill navigation with dropdown */}
            <div
              className="relative hidden lg:block"
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <nav className="flex items-center gap-8 rounded bg-[#F3F4F6] px-6 h-9 text-sm text-[#171717] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                {CENTER_ITEMS.map((item) => {
                  const isActive = activeItem === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={`/${item.key}`}
                      className="relative font-semibold px-1 py-0.5 transition hover:font-bold hover:animate-pulse hover:bg-gradient-to-r hover:from-blue-600 hover:to-black hover:bg-clip-text hover:text-transparent"
                      onMouseEnter={() => setActiveItem(item.key)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {dropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-full rounded bg-[#F3F4F6] p-5 text-sm text-[#171717] shadow-[0_18px_45px_rgba(0,0,0,0.55)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                  <div className="mb-2 text-base font-semibold text-[#171717]">
                    {activeData.title}
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-600">
                    {activeData.description}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Connect Wallet */}
            <div className="items-center gap-3 lg:flex hidden">
              {/* <Button variant="default" className="rounded font-semibold bg-white text-black hover:bg-white/80">
                Connect Wallet
              </Button> */}

              <ConnectWalletButton />
            </div>
          </div>
        </header>
      )}
    </>

  );
}

