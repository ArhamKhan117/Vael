"use client";

import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useId, useState } from 'react'
import ConnectWalletButton from './connect-wallet-button';

const CENTER_ITEMS: { key: string; label: string }[] = [
    { key: "/", label: "Vael" },
    { key: "/dashboard/studio", label: "Studio" },
];

/**
 * The studio header, sized by CSS for the same reasons as the main one.
 *
 * The previous version branched on `useIsTablet()` and put the wallet button inside the drawer, so
 * on a phone the only way to connect was to open a menu first, and the button in there was a dead
 * placeholder that opened nothing. The wallet is in the header at every width now.
 */
export default function NavbarDashboard() {
    const menuId = useId();
    const [menuOpen, setMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    return (
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1A1A1A] bg-black">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-5 md:px-10">
                <Link href="/dashboard/studio" className="flex shrink-0 items-center gap-2">
                    <Image src="/logo/vael.svg" alt="Vael" width={24} height={24} />
                    <span className="text-xl font-medium tracking-tighter text-white">
                        VAEL | Studio
                    </span>
                </Link>

                <nav className="ml-6 hidden items-center gap-6 text-white lg:flex">
                    {CENTER_ITEMS.map((item) => (
                        <Link
                            key={item.key}
                            href={item.key}
                            className="relative px-1 py-0.5 text-sm transition hover:animate-pulse hover:bg-gradient-to-r hover:from-blue-600 hover:to-black hover:bg-clip-text hover:font-bold hover:text-transparent"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <ConnectWalletButton />

                    <button
                        type="button"
                        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-white lg:hidden"
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

            <div
                id={menuId}
                className={cn(
                    "overflow-hidden bg-black transition-all duration-300 ease-out lg:hidden",
                    menuOpen ? "max-h-40 border-t border-[#1A1A1A] opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <nav className="flex flex-col gap-1 px-5 pb-4 pt-2 md:px-10">
                    {CENTER_ITEMS.map((item) => (
                        <Link
                            key={item.key}
                            href={item.key}
                            onClick={() => setMenuOpen(false)}
                            className="rounded-md px-3 py-2 text-[15px] font-bold text-white transition-colors hover:bg-[#141414]"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    )
}
