"use client"

import Image from "next/image"
import Link from "next/link"
import { notFound, useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { ArrowLeft, Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { QUIZ_PASS_MARK, academyModule } from "@/content/academy"
import { FIRST_NATIVE_ACTION } from "@/lib/attestcoin/types"
import { useAcademy } from "@/hooks/useAcademy"
import { useReownWallet } from "@/hooks/useReownWallet"

export default function AcademyModulePage() {
  const params = useParams()
  const slug = String(params.module)
  const module = academyModule(slug)
  if (!module) notFound()

  const { wallet } = useReownWallet()
  const { data, save } = useAcademy(wallet.address ?? undefined)
  const progress = data?.modules[slug]

  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const score = useMemo(
    () => module.quiz.filter((question, i) => answers[i] === question.answer).length,
    [answers, module.quiz]
  )
  const allAnswered = Object.keys(answers).length === module.quiz.length
  const passed = submitted && score >= QUIZ_PASS_MARK

  // The linked quest is the one this address actually accepted on chain. If there is none, the
  // page says to go and accept one rather than inventing an id to link to.
  const doQuest = module.doQuest
  // Which completion path this module's action belongs to. Action types at or above
  // FIRST_NATIVE_ACTION are settled by NativePortal on Creditcoin, not by a proof.
  const isNative = doQuest.available && doQuest.actionType >= FIRST_NATIVE_ACTION
  const linkedQuest = doQuest.available
    ? data?.openQuests.find((quest) => quest.actionType === doQuest.actionType)
    : undefined

  const markRead = (index: number) => void save(slug, { lessonsRead: [index] })

  const submitQuiz = () => {
    setSubmitted(true)
    void save(slug, { quizScore: score })
  }

  const retake = () => {
    setAnswers({})
    setSubmitted(false)
  }

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div>
          <Link
            href="/academy"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Academy
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">{module.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{module.summary}</p>
        </div>

        <section className="space-y-4">
          {module.lessons.map((lesson, index) => {
            const read = progress?.lessonsRead.includes(index) ?? false
            return (
              <article key={lesson.title} className="rounded border border-[#1A1A1A] bg-black p-5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-sm font-semibold text-white">
                    {index + 1}. {lesson.title}
                  </h2>
                  {wallet.address && (
                    <button
                      type="button"
                      onClick={() => markRead(index)}
                      disabled={read}
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] transition ${
                        read
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {read ? "Read" : "Mark read"}
                    </button>
                  )}
                </div>
                {/* One image per lesson, named by convention rather than listed in the JSON, so a
                    new lesson cannot ship with a stale path pointing at the one before it. Alt is
                    empty on purpose: it illustrates the prose directly beneath it and has nothing
                    to add to a screen reader that the prose does not already say. */}
                <Image
                  src={`/academy/${slug}-${index}.png`}
                  alt=""
                  width={1536}
                  height={864}
                  className="mt-4 aspect-video w-full rounded border border-[#1A1A1A] object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                />

                <div className="mt-4 space-y-3">
                  {lesson.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)} className="text-xs leading-relaxed text-zinc-400">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            )
          })}
        </section>

        <section className="rounded border border-[#1A1A1A] bg-black">
          <header className="border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Quiz</h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Five questions, passing at {QUIZ_PASS_MARK}. Retake it as often as you like; your best
              attempt is the one kept.
              {progress?.quizPassed && !submitted && " You have already passed this one."}
            </p>
          </header>

          <div className="divide-y divide-[#1A1A1A]">
            {module.quiz.map((question, qi) => (
              <div key={question.question} className="px-5 py-4">
                <p className="text-xs font-medium text-zinc-200">
                  {qi + 1}. {question.question}
                </p>
                <div className="mt-3 space-y-1.5">
                  {question.options.map((option, oi) => {
                    const chosen = answers[qi] === oi
                    const isAnswer = question.answer === oi
                    let tone = "border-[#1A1A1A] text-zinc-400 hover:border-zinc-700"
                    if (submitted && isAnswer) {
                      tone = "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    } else if (submitted && chosen) {
                      tone = "border-red-500/40 bg-red-500/10 text-red-200"
                    } else if (chosen) {
                      tone = "border-zinc-500 text-zinc-100"
                    }
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswers((current) => ({ ...current, [qi]: oi }))}
                        className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-[11px] transition ${tone}`}
                      >
                        {submitted && isAnswer && <Check className="h-3 w-3 shrink-0" />}
                        {submitted && chosen && !isAnswer && <X className="h-3 w-3 shrink-0" />}
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>
                {submitted && (
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{question.why}</p>
                )}
              </div>
            ))}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1A1A1A] px-5 py-4">
            {submitted ? (
              <>
                <p className={`text-xs ${passed ? "text-emerald-300" : "text-amber-300"}`}>
                  {score} of {module.quiz.length}.{" "}
                  {passed ? "Passed." : `You need ${QUIZ_PASS_MARK} to pass.`}
                </p>
                <Button
                  onClick={retake}
                  className="rounded bg-white text-black hover:bg-white/90"
                >
                  Retake
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-zinc-500">
                  {Object.keys(answers).length} of {module.quiz.length} answered
                  {!wallet.address && ". Connect a wallet to have the result remembered."}
                </p>
                <Button
                  onClick={submitQuiz}
                  disabled={!allAnswered}
                  className="rounded bg-white text-black hover:bg-white/90"
                >
                  Submit
                </Button>
              </>
            )}
          </footer>
        </section>

        <section className="rounded border border-[#1A1A1A] bg-black p-5">
          <h2 className="text-sm font-semibold text-white">Now do it for real</h2>

          {!doQuest.available ? (
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {doQuest.unavailableReason}
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-zinc-400">{doQuest.title}</p>
              <ol className="mt-3 space-y-2">
                {doQuest.steps.map((step, index) => (
                  <li key={step.slice(0, 32)} className="flex gap-3 text-xs leading-relaxed text-zinc-500">
                    <span className="shrink-0 font-mono text-zinc-600">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button asChild className="rounded bg-white text-black hover:bg-white/90">
                  <Link href={linkedQuest ? `/quests/${linkedQuest.questId}` : "/quests"}>
                    {linkedQuest ? `Open quest #${linkedQuest.questId}` : "Find a quest"}
                  </Link>
                </Button>
                <p className="text-[11px] text-zinc-600">
                  {linkedQuest
                    ? "One of your open quests takes this action."
                    : "You have no open quest for this action yet."}
                </p>
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
                {isNative
                  ? "Completing it awards a Common badge in the same transaction as the swap, because NativePortal performs the action and records the completion together. Passing the quiz above does not mint anything, and nothing off-chain can."
                  : "Completing it awards a Common badge through the normal quest flow, which means QuestASC mints it after verifying your proof. Passing the quiz above does not mint anything, and nothing off-chain can."}
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
