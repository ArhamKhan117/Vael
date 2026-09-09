"use client"

import Link from "next/link"
import { BookOpen, Check, ShieldCheck } from "lucide-react"

import { ACADEMY_MODULES } from "@/content/academy"
import { useAcademy } from "@/hooks/useAcademy"
import { useReownWallet } from "@/hooks/useReownWallet"

export default function AcademyPage() {
  const { wallet } = useReownWallet()
  const { data } = useAcademy(wallet.address ?? undefined)

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-white">Academy</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Four modules on what you are actually doing when you use DeFi, and on the proof
            machinery that lets Creditcoin check it. Read three lessons, pass a five-question quiz
            at four out of five, then go and do the thing for real.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-zinc-600">
            Progress is a bookmark. It unlocks nothing on its own: the badge comes from the do
            quest, which the chain verifies from a proof like any other quest.
          </p>
        </header>

        {!wallet.address && (
          <p className="rounded border border-[#1A1A1A] bg-black px-4 py-3 text-xs text-zinc-500">
            Every module is readable without a wallet. Connect one to have your progress remembered.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {ACADEMY_MODULES.map((module) => {
            const progress = data?.modules[module.slug]
            const read = progress?.lessonsRead.length ?? 0
            return (
              <Link
                key={module.slug}
                href={`/academy/${module.slug}`}
                className="flex flex-col justify-between rounded border border-[#1A1A1A] bg-black transition hover:border-zinc-700"
              >
                {/* No cover image. The list is for choosing a module, and twelve pictures of light
                    in the dark do not help anybody choose between four titles; the artwork belongs
                    with the lesson it illustrates. */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold text-white">{module.title}</h2>
                    {progress?.quizPassed && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        <Check className="h-3 w-3" /> Passed
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{module.summary}</p>
                </div>

                <div className="flex items-center gap-4 px-5 pb-5 text-[11px] text-zinc-600">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    {read} of {module.lessons.length} lessons
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {module.doQuest.available ? module.doQuest.actionName : "No quest yet"}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
