"use client";

import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import ConnectWalletButton from "./connect-wallet-button";

type CenterItemKey =
  | "quests"
  | "campaigns"
  | "academy"
  | "hero"
  | "raid"
  | "arena"
  | "market"
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
      key: "campaigns",
      label: "Campaigns",
      title: "Campaigns",
      description: "Partner pools on Creditcoin, paid out only against a verified proof.",
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
      key: "arena",
      label: "Arena",
      title: "Arena",
      description: "Duels fought with stats that were earned through verified proofs.",
    },
    {
      key: "market",
      label: "Market",
      title: "Market",
      description: "Buy and sell loot for VAEL. Items are escrowed the moment they are listed.",
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

/**
 * One header, sized by CSS rather than by a media-query hook.
 *
 * The previous version branched on `useIsTablet()`, which is false during server render and on the
 * first client paint, so the wide layout was always rendered first and swapped. That is a flash on
 * every navigation, and it made the breakpoint invisible to anyone reading the markup. It also put
 * eleven links, a logo and the wallet button on one row with no room for them: below about 1280 px
 * the pill overlapped the logo and clipped it to "V VA".
 *
 * Now: the logo never shrinks, the wallet button is in the header at every width so it is always
 * one tap away, and the link pill collapses into a menu button when there is not room for it.
 */
export default function Navbar() {
  const [activeItem, setActiveItem] = useState<CenterItemKey>("quests");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  // The landing page puts the header over its hero, so it stays transparent until scrolled past.
  const [isPastHero, setIsPastHero] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById("hero-end");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => setIsPastHero(!entries[0]?.isIntersecting),
      { root: null, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Any navigation closes the menu. Without this it stays open over the page it just left.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const activeData = CENTER_ITEMS.find((item) => item.key === activeItem)!;
  const transparent = pathname === "/" && !menuOpen && !isPastHero;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        transparent ? "bg-transparent" : "bg-black"
      )}
    >
      <div className="mx-auto flex items-center gap-3 px-5 py-5 md:px-10">
        {/* The logo never shrinks. Everything else gives way before it does. */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/logo/vael.svg" alt="Vael" width={24} height={24} />
          <span className="font-matemasie mb-1 text-xl font-medium text-white">VAEL</span>
        </Link>

        {/* Centre: the full pill, only where eleven links actually fit. */}
        <div
          className="relative mx-auto hidden xl:block"
          onMouseEnter={() => setDropdownOpen(true)}
          onMouseLeave={() => setDropdownOpen(false)}
        >
          <nav className="flex h-9 items-center gap-4 rounded bg-[#F3F4F6] px-5 text-sm text-[#171717] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] 2xl:gap-8 2xl:px-6">
            {CENTER_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={`/${item.key}`}
                className="relative whitespace-nowrap px-1 py-0.5 font-semibold transition hover:animate-pulse hover:bg-gradient-to-r hover:from-blue-600 hover:to-black hover:bg-clip-text hover:font-bold hover:text-transparent"
                onMouseEnter={() => setActiveItem(item.key)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-full rounded bg-[#F3F4F6] p-5 text-sm text-[#171717] shadow-[0_18px_45px_rgba(0,0,0,0.55)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
              <div className="mb-2 text-base font-semibold text-[#171717]">{activeData.title}</div>
              <p className="text-xs leading-relaxed text-zinc-600">{activeData.description}</p>
            </div>
          )}
        </div>

        {/* Right: the wallet is present at every width, and the menu button appears when the pill
            does not. `ml-auto` keeps them right-aligned once the pill is gone. */}
        <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
          <ConnectWalletButton />

          <button
            type="button"
            className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-white xl:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-controls={menuId}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu
              className={cn(
                "absolute h-6 w-6 transition-all duration-300",
                menuOpen ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              )}
              aria-hidden="true"
            />
            <X
              className={cn(
                "h-6 w-6 transition-all duration-300",
                menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* The compact menu. It overlays rather than pushing, so opening it does not reflow the page
          behind it. */}
      <div
        id={menuId}
        className={cn(
          "overflow-hidden bg-black transition-all duration-300 ease-out xl:hidden",
          menuOpen ? "max-h-[32rem] border-b border-[#1A1A1A] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav className="flex flex-col gap-1 px-5 pb-4 pt-1 md:px-10">
          {CENTER_ITEMS.map((item) => {
            const href = `/${item.key}`;
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                href={href}
                key={item.key}
                className={cn(
                  "rounded-md px-3 py-2 text-[15px] font-bold transition-colors",
                  active ? "bg-[#141414] text-white" : "text-white hover:bg-[#141414]"
                )}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
