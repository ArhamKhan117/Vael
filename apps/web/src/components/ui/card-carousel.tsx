"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { useIsTablet } from "@/hooks/breakpoint"

/**
 * A row of cards that steps one card at a time, on its own if asked.
 *
 * Used by the partner campaign strip and by every section of the quest board. Three cards in view
 * at desktop width (four for the strip on the board page, where the cards are shorter) and one on
 * a phone; each step moves one card, wrapping, so with four items and three in view the second
 * slide shows the fourth beside the two it was already next to rather than alone.
 *
 * Rotation, when `autoAdvanceMs` is set, stops while the pointer or the keyboard focus is on the
 * carousel, while the tab is hidden, for a full interval after the reader moves it by hand, and
 * altogether for a reader who has asked for reduced motion; the arrows and dots still work then.
 *
 * The arrows sit inside the edges, a mid-grey chevron over a faint dark wash, and the track is
 * inset so they sit in a gutter beside the first and last card rather than over a card's text.
 * The clip is a box of its own inside that gutter: clipping the padded box let the next card show
 * through beside the arrow.
 */
const WIDTH_CLASS: Record<number, string> = {
  1: "lg:w-full",
  2: "lg:w-1/2",
  3: "lg:w-1/3",
  4: "lg:w-1/4",
}

export function CardCarousel<T>({
  items,
  keyOf,
  render,
  perSlide = 3,
  autoAdvanceMs,
  label,
  testId,
}: {
  items: T[]
  keyOf: (item: T) => string
  render: (item: T) => ReactNode
  /** Cards in view at desktop width. Always one on a phone or tablet. */
  perSlide?: 1 | 2 | 3 | 4
  autoAdvanceMs?: number
  /** What a card is, for the arrows' accessible names. */
  label?: string
  testId?: string
}) {
  const isTablet = useIsTablet()
  const inView = isTablet ? 1 : perSlide
  const totalSlides = Math.max(1, items.length - inView + 1)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // A manual move restarts the clock, so the next automatic step is a full interval away rather
  // than a fraction of a second after the reader pressed the arrow.
  const lastManual = useRef(0)

  // The list can shrink under the reader, and the phone breakpoint changes the slide count.
  useEffect(() => {
    if (index > totalSlides - 1) setIndex(totalSlides - 1)
  }, [index, totalSlides])

  const step = useCallback(
    (direction: 1 | -1) => {
      lastManual.current = Date.now()
      setIndex((current) => (current + direction + totalSlides) % totalSlides)
    },
    [totalSlides]
  )
  const goTo = useCallback((i: number) => {
    lastManual.current = Date.now()
    setIndex(i)
  }, [])

  useEffect(() => {
    if (!autoAdvanceMs || totalSlides < 2 || paused) return
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setInterval(() => {
      if (document.hidden) return
      if (Date.now() - lastManual.current < autoAdvanceMs) return
      setIndex((current) => (current + 1) % totalSlides)
    }, autoAdvanceMs)
    return () => clearInterval(timer)
  }, [autoAdvanceMs, totalSlides, paused])

  const arrows = items.length > inView
  const arrow =
    "absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-black/30 p-2 text-zinc-500 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"

  return (
    <div
      className="relative"
      data-testid={testId}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={arrows ? "px-9" : ""}>
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${(index * 100) / inView}%)` }}
            data-testid={testId ? `${testId}-track` : undefined}
          >
            {items.map((item) => (
              <article key={keyOf(item)} className={`w-full shrink-0 px-2 ${WIDTH_CLASS[perSlide]}`}>
                {render(item)}
              </article>
            ))}
          </div>
        </div>
      </div>

      {arrows && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            className={`${arrow} left-1`}
            aria-label={`Previous ${label ?? "card"}`}
            data-testid={testId ? `${testId}-prev` : undefined}
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className={`${arrow} right-1`}
            aria-label={`Next ${label ?? "card"}`}
            data-testid={testId ? `${testId}-next` : undefined}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </>
      )}

      {totalSlides > 1 && (
        <div className="mt-4 flex justify-center gap-2" data-testid={testId ? `${testId}-dots` : undefined}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`h-1.5 w-4 rounded-full transition-colors ${i === index ? "bg-white" : "bg-zinc-700"}`}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
