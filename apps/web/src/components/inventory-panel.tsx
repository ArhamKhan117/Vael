"use client"

import Image from "next/image"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import itemCatalogue from "@/content/items.json"
import { useInventory, useModuleWrites } from "@/hooks/useModules"
import { useRaid } from "@/hooks/useGame"

/** Local artwork by item name. The chain is the authority on stats; this is only the picture. */
const ARTWORK = new Map(itemCatalogue.items.map((item) => [item.name, item.image]))
const SLOT_NAMES = ["Weapon", "Armour", "Trinket", "Relic"]

const RARITY_CLASSES = [
  "border-zinc-700 text-zinc-300",
  "border-emerald-600/50 text-emerald-300",
  "border-sky-600/50 text-sky-300",
  "border-violet-600/50 text-violet-300",
  "border-amber-500/50 text-amber-300",
] as const

/**
 * A hero's items, what is equipped, and what that is worth in the arena.
 *
 * Balances and the loadout are read live from the contracts rather than from the index, because an
 * ERC-1155 balance moves through transfers nothing here watches. `readOnly` shows somebody else's
 * inventory without offering buttons that would sign from the wrong wallet.
 */
export function InventoryPanel({
  address,
  readOnly = false,
}: {
  address?: string
  readOnly?: boolean
}) {
  const { inventory, loading, refetch } = useInventory(address)
  const { raid } = useRaid()
  const writes = useModuleWrites()
  const [notice, setNotice] = useState<string | null>(null)

  const after = useCallback(() => setTimeout(() => void refetch(), 4000), [refetch])

  const heroTokenId = inventory?.heroTokenId ?? 0
  const equipped = inventory?.equipped ?? []
  const items = inventory?.items ?? []
  const bonuses = inventory?.bonuses ?? { strength: 0, agility: 0, intellect: 0 }
  const byId = new Map(items.map((item) => [item.itemId, item]))

  // The equipped item is held by the registry, so it is not in `items`. Names come from the
  // catalogue instead, which is keyed the same way the contract is.
  const nameOf = (itemId: number) =>
    byId.get(itemId)?.name ??
    itemCatalogue.items.find((_, index) => index + 1 === itemId)?.name ??
    `Item ${itemId}`

  const claimable = Boolean(address) && raid?.defeated && raid.seasonId > 0

  const equip = async (slot: number, itemId: number) => {
    setNotice(null)
    const approved = await writes.approveLoot(
      process.env.NEXT_PUBLIC_EQUIPMENT_ADDRESS as `0x${string}`
    )
    if (!approved) return
    const hash = await writes.equip(heroTokenId, slot, itemId)
    if (hash) {
      setNotice("Equipped.")
      after()
    }
  }

  const unequip = async (slot: number) => {
    setNotice(null)
    const hash = await writes.unequip(heroTokenId, slot)
    if (hash) {
      setNotice("Unequipped.")
      after()
    }
  }

  const claim = async () => {
    setNotice(null)
    if (!raid) return
    const hash = await writes.claimRaidLoot(raid.seasonId)
    if (hash) {
      setNotice("Claimed a raid drop.")
      after()
    }
  }

  return (
    <section className="rounded border border-[#1A1A1A] bg-black p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Inventory</h2>
        <span className="text-[11px] text-zinc-600">
          Equipped bonuses: +{bonuses.strength} strength, +{bonuses.agility} agility, +
          {bonuses.intellect} intellect
        </span>
      </div>

      {notice && <p className="mt-2 text-[11px] text-sky-300">{notice}</p>}
      {writes.error && <p className="mt-2 text-[11px] text-red-400">{writes.error}</p>}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SLOT_NAMES.map((slotName, slot) => {
          const itemId = equipped[slot]?.itemId ?? 0
          const candidates = items.filter((item) => item.slot === slot)
          return (
            <div key={slotName} className="rounded border border-[#1A1A1A] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{slotName}</p>
              {itemId > 0 ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    {ARTWORK.get(nameOf(itemId)) && (
                      <Image
                        src={ARTWORK.get(nameOf(itemId))!}
                        alt=""
                        width={32}
                        height={32}
                        className="rounded"
                      />
                    )}
                    <span className="text-xs text-zinc-200">{nameOf(itemId)}</span>
                  </div>
                  {!readOnly && heroTokenId > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unequip(slot)}
                      disabled={writes.pending !== null}
                      className="mt-2 w-full rounded border-zinc-700 text-[11px] text-zinc-300"
                    >
                      {writes.pending === `unequip-${slot}` ? "Confirm…" : "Unequip"}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 text-xs text-zinc-600">Empty</p>
                  {!readOnly &&
                    heroTokenId > 0 &&
                    candidates.map((item) => (
                      <Button
                        key={item.itemId}
                        size="sm"
                        onClick={() => equip(slot, item.itemId)}
                        disabled={writes.pending !== null}
                        className="mt-2 w-full rounded bg-white text-[11px] text-black hover:bg-white/90"
                      >
                        {writes.pending === `equip-${slot}` ? "Confirm…" : `Equip ${item.name}`}
                      </Button>
                    ))}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Held</p>
        {loading && items.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            No items. They drop from defeated raid bosses, where rarity follows your share of the
            damage, and from arena wins.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((item) => (
              <span
                key={item.itemId}
                className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-[11px] ${
                  RARITY_CLASSES[item.rarity] ?? RARITY_CLASSES[0]
                }`}
              >
                {ARTWORK.get(item.name) && (
                  <Image src={ARTWORK.get(item.name)!} alt="" width={24} height={24} className="rounded" />
                )}
                {item.name}
                {item.amount > 1 ? ` x${item.amount}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {!readOnly && claimable && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
          <p className="text-[11px] text-emerald-300">
            Season {raid?.seasonId} is defeated. If you dealt damage, one item is owed to you.
          </p>
          <Button
            size="sm"
            onClick={claim}
            disabled={writes.pending !== null}
            className="rounded bg-white text-black hover:bg-white/90"
          >
            {writes.pending === "claim-loot" ? "Confirm…" : "Claim raid drop"}
          </Button>
        </div>
      )}
    </section>
  )
}
