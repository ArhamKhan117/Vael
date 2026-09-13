import { NetworkStats } from "@/components/network-stats"

import { LeaderboardTables } from "./leaderboard-client"

export const metadata = {
  title: "Leaderboard",
  description: "Rankings derived from proofs Creditcoin verified itself.",
}

export default function LeaderboardPage() {
  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">Leaderboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Every number on this page was counted from an event Creditcoin emitted after verifying a
            Merkle proof and a continuity proof. No rank can be granted, bought, or seeded, and an
            empty board means nobody has done anything yet.
          </p>
        </header>

        <NetworkStats />

        <LeaderboardTables />
      </div>
    </main>
  )
}
