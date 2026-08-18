"use client";

import { useIsTablet } from '@/hooks/breakpoint';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useId, useState } from 'react'
import { Button } from './ui/button';
import ConnectWalletButton from './connect-wallet-button';

const CENTER_ITEMS: {
    key: string;
    label: string;
    title: string;
}[] = [
        {
            key: "/",
            label: "Vael",
            title: "vael",
        },
        {
            key: "/dashboard/studio",
            label: "Studio",
            title: "studio",
        },
    ];

export default function NavbarDashboard() {
    const mobileMenuId = useId();
    const isTablet = useIsTablet();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeItem, setActiveItem] = useState<string>("dashboard/partnership");
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const activeData = CENTER_ITEMS.find((item) => item.key === activeItem)!;
    const headerBgClass = mobileOpen
        ? "bg-black"
        : "bg-transparent";
    return (
        <>
            {isTablet ? (
                <header
                    className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${headerBgClass}`}
                >
                    <div className="mx-auto flex flex-col items-center justify-between px-5 md:px-10 py-5 border-b border-[#1A1A1A]">
                        {/* Left: Brand */}
                        <div className="flex items-center justify-between w-full">
                            <Link href="/dashboard/studio" className="flex items-center gap-2">
                                <Image src="/logo/vael.svg" alt="Vael" width={24} height={24} />
                                <span className="text-xl tracking-tighter font-medium text-white">
                                    VAEL | Studio
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
                                    "px-5 md:px-10 pt-2 pb-4 space-y-4 transition-transform duration-300 ease-out",
                                    mobileOpen ? "translate-y-0" : "-translate-y-2"
                                )}
                            >
                                <nav className="flex flex-col gap-1">
                                    {CENTER_ITEMS.map((item) => {
                                        // const active = activeItem === item.key;
                                        return (
                                            <Link
                                                key={item.key}
                                                href={`${item.key}`}
                                                onClick={() => setMobileOpen(false)}
                                                className={cn(
                                                    "rounded-md px-3 py-2 text-[15px] font-bold transition-colors text-white text-center",
                                                )}
                                            >
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </nav>

                                <div>
                                    <Button variant="default" className="rounded bg-white text-black text-xs hover:bg-white/80 w-full">
                                        Connect Wallet
                                    </Button>
                                </div>
                            </div>

                        </div>
                    </div>
                </header>
            ) : (
                <header
                    className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 bg-black border-b border-[#1A1A1A] px-5 md:px-10 py-5 `}
                >
                    <div className="mx-auto flex items-center justify-between max-w-7xl">
                        <div className='flex items-center gap-6'>
                            <Link href="/dashboard/studio" className="flex items-center gap-2">
                                <Image src="/logo/vael.svg" alt="Vael" width={24} height={24} />
                                <span className="text-xl tracking-tighter font-medium text-white">
                                    VAEL | Studio
                                </span>
                            </Link>

                            <div
                                className="relative hidden lg:block"
                            >
                                <nav className="flex items-center gap-6 text-white">
                                    {CENTER_ITEMS.map((item) => {
                                        const isActive = activeItem === item.key;
                                        return (
                                            <Link
                                                key={item.key}
                                                href={`${item.key}`}
                                                className="relative px-1 py-0.5 text-sm transition hover:font-bold hover:animate-pulse hover:bg-gradient-to-r hover:from-blue-600 hover:to-black hover:bg-clip-text hover:text-transparent"
                                                onMouseEnter={() => setActiveItem(item.key)}
                                            >
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>
                        </div>


                        {/* Right: Connect Wallet */}
                        <div className="items-center gap-3 lg:flex hidden">
                            {/* <Button variant="default" className="rounded bg-white text-black text-xs hover:bg-white/80">
                                Connect Wallet
                            </Button> */}

                            <ConnectWalletButton />
                        </div>
                    </div>
                </header>
            )}
        </>
    )
}
