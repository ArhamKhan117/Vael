import { formatUnits } from "viem"

import itemCatalogue from "@/content/items.json"

/**
 * Rarity, as the marketplace draws it.
 *
 * Mirrors `Loot`'s rarity enum, which is the only authority on which tier an item is. The colours
 * are ours, but the tier is the chain's.
 */
export const RARITY = [
  { name: "Common", border: "border-[#1A1A1A]", text: "text-zinc-200", chip: "bg-zinc-800/80 text-zinc-300", dot: "bg-zinc-500" },
  { name: "Uncommon", border: "border-emerald-900/60", text: "text-emerald-200", chip: "bg-emerald-950/80 text-emerald-300", dot: "bg-emerald-500" },
  { name: "Rare", border: "border-sky-900/60", text: "text-sky-200", chip: "bg-sky-950/80 text-sky-300", dot: "bg-sky-500" },
  { name: "Epic", border: "border-violet-900/60", text: "text-violet-200", chip: "bg-violet-950/80 text-violet-300", dot: "bg-violet-500" },
  { name: "Legendary", border: "border-amber-900/60", text: "text-amber-200", chip: "bg-amber-950/80 text-amber-300", dot: "bg-amber-500" },
] as const

/** The chain is the authority on an item's stats; this is only its picture. */
const ARTWORK = new Map(itemCatalogue.items.map((item) => [item.name, item.image]))

export function itemArtwork(name: string | undefined): string | undefined {
  return name ? ARTWORK.get(name) : undefined
}

export function vael(wei: string): string {
  return Number(formatUnits(BigInt(wei || "0"), 18)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
}

export const SLOT_NAMES = ["Weapon", "Armour", "Trinket", "Relic"] as const
