"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PagedList } from "@/components/ui/paged-list"
import { MarketItemCard } from "@/components/market/item-card"
import { useReownWallet } from "@/hooks/useReownWallet"
import {
  useInventory,
  useListings,
  useMarketActivity,
  useMarketStats,
  useModuleWrites,
  type Listing,
} from "@/hooks/useModules"
import { RARITY, SLOT_NAMES, itemArtwork, vael } from "@/lib/market"
import { shortAddress } from "@/lib/arena"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"
import { CREDITCOIN_EXPLORER_URL } from "@/lib/chains"

/**
 * The marketplace.
 *
 * Everything here is visible without a wallet, because a market nobody can look at cannot tell
 * anybody whether it is worth joining. A wallet adds exactly two things: the buy button, and the
 * panel for listing what you own. Nothing else is hidden.
 *
 * **Every item on sale was earned.** `Loot` has no owner mint: an item exists because somebody
 * defeated a raid boss or won a duel, so the floor price is a statement about how hard those are
 * rather than about how many were printed.
 */

type SortKey = "price-asc" | "price-desc" | "newest" | "rarity"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "price-asc", label: "Price, low to high" },
  { key: "price-desc", label: "Price, high to low" },
  { key: "newest", label: "Newest" },
  { key: "rarity", label: "Rarity" },
]

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="mt-1 truncate font-mono text-lg font-semibold text-white">{value}</p>
      {hint && <p className="text-[10px] text-zinc-600">{hint}</p>}
    </div>
  )
}

export default function MarketPage() {
  const { wallet } = useReownWallet()
  const address = wallet.address ?? undefined

  const { listings, loading, refetch: refetchListings } = useListings("active")
  const { inventory, refetch: refetchInventory } = useInventory(address)
  const { stats, refetch: refetchStats } = useMarketStats()
  const { activity, refetch: refetchActivity } = useMarketActivity()
  const writes = useModuleWrites()

  const [selected, setSelected] = useState<Listing | null>(null)
  const [sort, setSort] = useState<SortKey>("price-asc")
  const [search, setSearch] = useState("")
  const [rarities, setRarities] = useState<number[]>([])
  const [slots, setSlots] = useState<number[]>([])
  const [maxPrice, setMaxPrice] = useState("")
  const [minBonus, setMinBonus] = useState(0)

  const [sellItemId, setSellItemId] = useState<number | null>(null)
  const [price, setPrice] = useState("50")
  const [notice, setNotice] = useState<string | null>(null)

  const refetchAll = useCallback(() => {
    setTimeout(() => {
      void refetchListings()
      void refetchInventory()
      void refetchStats()
      void refetchActivity()
    }, 4000)
  }, [refetchListings, refetchInventory, refetchStats, refetchActivity])

  const priceWei = useMemo(() => {
    try {
      return parseUnits(price || "0", 18)
    } catch {
      return 0n
    }
  }, [price])

  const toggle = (list: number[], value: number, set: (next: number[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const ceiling = maxPrice.trim() ? Number(maxPrice) : undefined
    const filtered = listings.filter((listing) => {
      const item = listing.item
      if (rarities.length > 0 && !rarities.includes(item?.rarity ?? -1)) return false
      if (slots.length > 0 && !slots.includes(item?.slot ?? -1)) return false
      if (needle && !(item?.name ?? "").toLowerCase().includes(needle)) return false
      if (ceiling !== undefined && Number(formatUnits(BigInt(listing.price), 18)) > ceiling) return false
      if (minBonus > 0) {
        const total = (item?.strength ?? 0) + (item?.agility ?? 0) + (item?.intellect ?? 0)
        if (total < minBonus) return false
      }
      return true
    })

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "price-desc":
          return BigInt(b.price) > BigInt(a.price) ? 1 : -1
        case "newest":
          return b.listingId - a.listingId
        case "rarity":
          return (b.item?.rarity ?? 0) - (a.item?.rarity ?? 0) || b.listingId - a.listingId
        default:
          return BigInt(a.price) > BigInt(b.price) ? 1 : -1
      }
    })
  }, [listings, rarities, slots, search, maxPrice, minBonus, sort])

  const sellable = inventory?.items ?? []

  const list = async () => {
    setNotice(null)
    if (sellItemId === null || priceWei === 0n) return
    const approved = await writes.approveLoot(CONTRACT_ADDRESSES.MARKETPLACE)
    if (!approved) return
    const hash = await writes.listItem(sellItemId, 1, priceWei)
    if (hash) {
      setNotice(`Listed. ${hash.slice(0, 10)}…`)
      setSellItemId(null)
      refetchAll()
    }
  }

  const buy = async (listing: Listing) => {
    setNotice(null)
    const approved = await writes.approveVael(CONTRACT_ADDRESSES.MARKETPLACE, BigInt(listing.price))
    if (!approved) return
    const hash = await writes.buyListing(listing.listingId)
    if (hash) {
      setNotice(`Bought listing #${listing.listingId}.`)
      setSelected(null)
      refetchAll()
    }
  }

  const cancel = async (listing: Listing) => {
    setNotice(null)
    const hash = await writes.cancelListing(listing.listingId)
    if (hash) {
      setNotice(`Cancelled listing #${listing.listingId}.`)
      setSelected(null)
      refetchAll()
    }
  }

  const mine = !!selected && !!address && selected.seller.toLowerCase() === address.toLowerCase()

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="space-y-6">
        {/* ---------------------------------------------------------- collection header */}
        <header className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-[#1A1A1A]">
                <Image src="/items/blessed-blade.webp" alt="" fill className="object-cover" sizes="64px" />
              </span>
              <div>
                <h1 className="text-xl font-semibold text-white md:text-2xl">Vael Loot</h1>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
                  Every item here was earned. Loot has no owner mint: an item exists because somebody
                  defeated a raid boss or won a duel, and it is escrowed the moment it is listed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 md:shrink-0">
              <Stat
                label="Floor"
                value={stats?.floor ? vael(stats.floor) : "—"}
                hint="VAEL"
              />
              <Stat label="Listed" value={String(stats?.listed ?? 0)} hint={`${stats?.kinds ?? 0} kinds`} />
              <Stat label="Volume" value={stats ? vael(stats.volume) : "—"} hint={`${stats?.sales ?? 0} sales`} />
              <Stat label="Owners" value={String(stats?.owners ?? 0)} hint="holding now" />
            </div>
          </div>
        </header>

        {notice && (
          <p className="rounded border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-300">
            {notice}
          </p>
        )}
        {writes.error && (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            {writes.error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* -------------------------------------------------------- filter rail */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search items"
                  data-testid="market-search"
                  className="w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] py-2 pl-8 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Rarity</p>
              <div className="flex flex-wrap gap-1.5">
                {RARITY.map((rarity, index) => (
                  <button
                    key={rarity.name}
                    type="button"
                    onClick={() => toggle(rarities, index, setRarities)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition ${
                      rarities.includes(index)
                        ? `${rarity.border} ${rarity.text}`
                        : "border-[#1A1A1A] text-zinc-500 hover:border-zinc-700"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${rarity.dot}`} />
                    {rarity.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Kind</p>
              <div className="flex flex-wrap gap-1.5">
                {SLOT_NAMES.map((slot, index) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggle(slots, index, setSlots)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                      slots.includes(index)
                        ? "border-sky-700/60 text-sky-300"
                        : "border-[#1A1A1A] text-zinc-500 hover:border-zinc-700"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                Stat bonus, at least {minBonus}
              </p>
              <input
                type="range"
                min={0}
                max={20}
                value={minBonus}
                onChange={(event) => setMinBonus(Number(event.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Max price</p>
              <input
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                inputMode="decimal"
                placeholder="any"
                className="w-full rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
            </div>

            {(rarities.length > 0 || slots.length > 0 || search || maxPrice || minBonus > 0) && (
              <button
                type="button"
                onClick={() => {
                  setRarities([])
                  setSlots([])
                  setSearch("")
                  setMaxPrice("")
                  setMinBonus(0)
                }}
                className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
              >
                Clear filters
              </button>
            )}
          </aside>

          {/* -------------------------------------------------------- grid */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-500" data-testid="market-count">
                {loading ? "Reading the chain…" : `${visible.length} of ${listings.length} listed`}
              </p>
              <label className="flex items-center gap-2 text-[11px] text-zinc-500">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="rounded border border-[#1A1A1A] bg-[#0A0A0A] px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
                >
                  {SORTS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visible.length === 0 ? (
              <div className="rounded border border-[#1A1A1A] bg-black/40 py-16 text-center text-sm text-zinc-500">
                {listings.length === 0
                  ? "Nothing is listed right now."
                  : "No item matches these filters."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((listing) => (
                  <MarketItemCard
                    key={listing.listingId}
                    listing={listing}
                    selected={selected?.listingId === listing.listingId}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            )}

            {/* ------------------------------------------------------ detail */}
            {selected && (
              <div
                data-testid="listing-detail"
                className="grid gap-5 rounded border border-[#1A1A1A] bg-black p-5 md:grid-cols-[220px_1fr]"
              >
                <span className="relative aspect-square w-full overflow-hidden rounded border border-[#1A1A1A]">
                  {itemArtwork(selected.item?.name) && (
                    <Image
                      src={itemArtwork(selected.item?.name)!}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="220px"
                    />
                  )}
                </span>

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        {selected.item?.name ?? "Unknown item"}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {RARITY[selected.item?.rarity ?? 0]?.name} · {selected.item?.slotName} ·
                        listing #{selected.listingId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      Close
                    </button>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-4">
                    <div>
                      <dt className="text-zinc-600">Strength</dt>
                      <dd className="font-mono text-zinc-200">+{selected.item?.strength ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Agility</dt>
                      <dd className="font-mono text-zinc-200">+{selected.item?.agility ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Intellect</dt>
                      <dd className="font-mono text-zinc-200">+{selected.item?.intellect ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Seller</dt>
                      <dd className="font-mono text-zinc-200">{shortAddress(selected.seller)}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#1A1A1A] pt-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Price</p>
                      <p className="font-mono text-xl font-semibold text-white">
                        {vael(selected.price)} <span className="text-xs text-zinc-500">VAEL</span>
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        2% to the treasury on sale; the seller keeps the rest.
                      </p>
                    </div>

                    {/* The one thing that needs a wallet. Everything above is readable by anybody. */}
                    {!address ? (
                      <p className="text-[11px] text-zinc-500">Connect a wallet to buy.</p>
                    ) : mine ? (
                      <Button
                        onClick={() => cancel(selected)}
                        disabled={writes.pending !== null}
                        variant="outline"
                        className="rounded border-zinc-700 text-zinc-200"
                      >
                        {writes.pending ? "Confirm…" : "Cancel listing"}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => buy(selected)}
                        disabled={writes.pending !== null}
                        data-testid="buy"
                        className="rounded bg-white font-semibold text-black hover:bg-white/90"
                      >
                        {writes.pending ? "Confirm in your wallet…" : `Buy for ${vael(selected.price)} VAEL`}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------------ sell */}
        {address && sellable.length > 0 && (
          <section className="rounded border border-[#1A1A1A] bg-black p-5">
            <h2 className="text-sm font-semibold text-white">List something you own</h2>
            <p className="mt-1 text-[11px] text-zinc-600">
              Equipped items are held by Equipment and cannot be listed until they are unequipped.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Item</span>
                <select
                  value={sellItemId ?? ""}
                  onChange={(event) => setSellItemId(Number(event.target.value) || null)}
                  className="mt-1 block rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                >
                  <option value="">Choose…</option>
                  {sellable.map((item) => (
                    <option key={item.itemId} value={item.itemId}>
                      {item.name} ×{item.amount}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Price, VAEL</span>
                <input
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  inputMode="decimal"
                  className="mt-1 block w-32 rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
                />
              </label>
              <Button
                onClick={list}
                disabled={writes.pending !== null || sellItemId === null || priceWei === 0n}
                className="rounded bg-white font-semibold text-black hover:bg-white/90"
              >
                {writes.pending ? "Confirm…" : "List it"}
              </Button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ activity */}
        <section className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
          <header className="border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Activity</h2>
            <p className="mt-1 text-[11px] text-zinc-600">
              Listings, sales and cancellations, from the index. A listing that later sold appears
              twice, once as each, because they are two events at two heights.
            </p>
          </header>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-zinc-600">Nothing has happened yet.</p>
          ) : (
            // Newest first, from the API, ten to a page with arrows and a page size.
            <PagedList
              items={activity}
              noun="entries"
              keyOf={(event) => `${event.kind}-${event.listingId}-${event.block}`}
              testId="market-activity"
              render={(event) => (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-xs">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                        event.kind === "sold"
                          ? "bg-emerald-950/80 text-emerald-300"
                          : event.kind === "cancelled"
                            ? "bg-zinc-800/80 text-zinc-400"
                            : "bg-sky-950/80 text-sky-300"
                      }`}
                    >
                      {event.kind}
                    </span>
                    <span className="truncate text-zinc-300">{event.item?.name ?? "Unknown item"}</span>
                    <span className="font-mono text-zinc-600">{shortAddress(event.actor)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-zinc-300">{vael(event.price)} VAEL</span>
                    <a
                      href={`${CREDITCOIN_EXPLORER_URL}/block/${event.block}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-sky-400 hover:underline"
                    >
                      {event.block.toLocaleString()}
                    </a>
                  </span>
                </div>
              )}
            />
          )}
        </section>
      </div>
    </main>
  )
}
