"use client"

import Image from "next/image"

import type { Listing } from "@/hooks/useModules"
import { RARITY, itemArtwork, vael } from "@/lib/market"

/**
 * One item for sale.
 *
 * The picture leads, because a grid of items is scanned rather than read: rarity is carried by the
 * border and the name's colour, and the two things that decide a purchase, the bonuses and the
 * price, sit where the eye lands last.
 */
export function MarketItemCard({
  listing,
  onSelect,
  selected,
}: {
  listing: Listing
  onSelect: (listing: Listing) => void
  selected?: boolean
}) {
  const item = listing.item
  const rarity = RARITY[item?.rarity ?? 0] ?? RARITY[0]
  const art = itemArtwork(item?.name)
  const bonuses = item
    ? [
        item.strength ? `+${item.strength} STR` : null,
        item.agility ? `+${item.agility} AGI` : null,
        item.intellect ? `+${item.intellect} INT` : null,
      ].filter(Boolean)
    : []

  return (
    <button
      type="button"
      onClick={() => onSelect(listing)}
      data-testid={`listing-${listing.listingId}`}
      className={`group flex flex-col overflow-hidden rounded border bg-black text-left transition ${
        selected ? "border-sky-500/60" : `${rarity.border} hover:border-zinc-600`
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[#0A0A0C]">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] text-zinc-700">
            no artwork
          </span>
        )}
        <span
          className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${rarity.chip}`}
        >
          {rarity.name}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <div>
          <p className={`truncate text-xs font-semibold ${rarity.text}`}>
            {item?.name ?? "Unknown item"}
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            {item?.slotName ?? "-"}
          </p>
        </div>

        <p className="text-[10px] text-zinc-500">
          {bonuses.length > 0 ? bonuses.join("  ") : "no bonuses"}
        </p>

        <div className="flex items-baseline justify-between border-t border-[#1A1A1A] pt-2">
          <span className="font-mono text-sm font-semibold text-white">{vael(listing.price)}</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">VAEL</span>
        </div>
      </div>
    </button>
  )
}
