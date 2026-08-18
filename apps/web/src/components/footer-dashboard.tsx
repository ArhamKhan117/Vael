import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

export default function FooterDashboard() {
    return (
        <footer className="border-t border-[#1A1A1A] bg-black p-10">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl md:text-8xl font-bold text-center text-white mb-8">VAEL | Studio</h1>
                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-transparent flex items-center justify-center">
                                <Image
                                    src="/logo/vael.svg"
                                    className=""
                                    alt="Vael"
                                    width={32}
                                    height={32}
                                />
                            </div>
                            <span className="text-xl text-white font-matemasie mb-1">VAEL</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Join the ultimate DeFi quest platform. Complete on-chain tasks, participate in communities, and earn valuable rewards while climbing the leaderboard.
                        </p>
                    </div>
                </div> */}

                <div className="border-t border-[#1A1A1A] pt-8">
                    <p className="text-sm text-muted-foreground text-center">
                        © Vael 2026
                    </p>
                    <p className="text-sm text-muted-foreground text-center">
                        Built on Creditcoin with the Attestcoin Protocol
                    </p>
                </div>
            </div>
        </footer>
    )
}
