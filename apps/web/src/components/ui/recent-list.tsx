import type { ReactNode } from "react"

/**
 * A feed that shows its newest rows in full and keeps the rest behind a scroll.
 *
 * A list that grows with history is a page that grows with history: after twenty duels the arena
 * was a scroll to the footer, and the marketplace's activity feed was heading the same way. The
 * first `visible` rows are laid out as before; everything older sits in a box of fixed height that
 * scrolls on its own, so the page is the same length after a thousand rows as after ten.
 *
 * The caller passes rows newest first. Nothing is sorted here, because the order is the API's
 * statement about the chain and a component should not have an opinion about it.
 */
export function RecentList<T>({
  items,
  visible,
  keyOf,
  render,
  className = "",
  scrollClassName = "max-h-64",
  testId,
}: {
  items: T[]
  /** How many rows are shown in full before the scroller starts. */
  visible: number
  keyOf: (item: T) => string
  render: (item: T) => ReactNode
  className?: string
  /** The height of the scroller; a Tailwind max-height so a page can pick its own. */
  scrollClassName?: string
  testId?: string
}) {
  const recent = items.slice(0, visible)
  const older = items.slice(visible)
  return (
    <div className={className} data-testid={testId}>
      <ul className="divide-y divide-[#1A1A1A]">{recent.map((item) => <li key={keyOf(item)}>{render(item)}</li>)}</ul>
      {older.length > 0 && (
        <>
          <p className="border-y border-[#1A1A1A] bg-[#0A0A0C] px-5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
            {older.length} older, scroll for the rest
          </p>
          <ul
            className={`divide-y divide-[#1A1A1A] overflow-y-auto ${scrollClassName}`}
            data-testid={testId ? `${testId}-older` : undefined}
          >
            {older.map((item) => (
              <li key={keyOf(item)}>{render(item)}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
