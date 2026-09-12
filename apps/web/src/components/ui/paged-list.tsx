"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * A feed that pages through history instead of growing with it.
 *
 * The caller passes rows newest first; nothing is sorted here, because the order is the API's
 * statement about the chain and a component should not have an opinion about it. The list shows
 * one page, ten rows unless the reader asks for fifty or a hundred, with arrows that walk the
 * pages and a line beside them saying where the page sits: "11 to 20 of 27, page 2 of 3". A page
 * larger than the box scrolls inside it, so the page below never lengthens however many rows are
 * asked for.
 *
 * The previous version laid the newest few rows out in full and put the rest behind a second,
 * scrolling list. Two lists for one feed was one too many.
 */
export const PAGE_SIZES = [10, 50, 100] as const

export function PagedList<T>({
  items,
  keyOf,
  render,
  className = "",
  boxClassName = "max-h-[37.5rem]",
  noun = "entries",
  testId,
}: {
  items: T[]
  keyOf: (item: T) => string
  render: (item: T) => ReactNode
  className?: string
  /** The scroll box's height cap: ten rows of either feed fit without scrolling. */
  boxClassName?: string
  /** What a row is, for the range line: "11 to 20 of 27 duels". */
  noun?: string
  testId?: string
}) {
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10)
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  // A feed that shrinks, or a larger page size, can leave the current page past the end.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1)
  }, [page, pageCount])

  const first = page * pageSize
  const shown = items.slice(first, first + pageSize)
  const last = first + shown.length

  return (
    <div className={className} data-testid={testId}>
      <ul
        className={`divide-y divide-[#1A1A1A] overflow-y-auto ${boxClassName}`}
        data-testid={testId ? `${testId}-rows` : undefined}
      >
        {shown.map((item) => (
          <li key={keyOf(item)}>{render(item)}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1A1A1A] px-5 py-2.5 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            data-testid={testId ? `${testId}-prev` : undefined}
            className="rounded border border-[#1A1A1A] p-1 text-zinc-400 transition enabled:hover:border-zinc-600 enabled:hover:text-white disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            disabled={page >= pageCount - 1}
            aria-label="Next page"
            data-testid={testId ? `${testId}-next` : undefined}
            className="rounded border border-[#1A1A1A] p-1 text-zinc-400 transition enabled:hover:border-zinc-600 enabled:hover:text-white disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span data-testid={testId ? `${testId}-range` : undefined}>
            {items.length === 0
              ? `No ${noun}`
              : `${first + 1} to ${last} of ${items.length} ${noun} · page ${page + 1} of ${pageCount}`}
          </span>
        </div>

        <label className="flex items-center gap-2">
          <span className="uppercase tracking-[0.14em] text-zinc-600">View</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number])
              setPage(0)
            }}
            data-testid={testId ? `${testId}-page-size` : undefined}
            className="rounded border border-[#1A1A1A] bg-[#0A0A0C] px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-zinc-600"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
