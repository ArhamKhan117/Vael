"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { formatUnits, parseUnits } from "viem"

import { Button } from "@/components/ui/button"
import { useReownWallet } from "@/hooks/useReownWallet"
import { useInventory, useListings, useModuleWrites } from "@/hooks/useModules"
import itemCatalogue from "@/content/items.json"
import { shortAddress } from "@/lib/arena"
import { CONTRACT_ADDRESSES } from "@/lib/contracts"

/** Local artwork by item name. The chain is the authority on stats; this is only the picture. */
const ARTWORK = new Map(itemCatalogue.items.map((item) => [item.name, item.image]))

const RARITY_CLASSES = [
  "border-zinc-700 text-zinc-300",
  "border-emerald-600/50 text-emerald-300",
  "border-sky-600/50 text-sky-300",
  "border-violet-600/50 text-violet-300",
  "border-amber-500/50 text-amber-300",
] as const

function vael(wei: string) {
  return Number(formatUnits(BigInt(wei || "0"), 18)).toLocaleString()
}

export default function MarketPage() {
  const { wallet } = useReownWallet()
  const address = wallet.address ?? undefined

  const { listings, refetch: refetchListings } = useListings("active")
  const { inventory, refetch: refetchInventory } = useInventory(address)
  const writes = useModuleWrites()

  const [sellItemId, setSellItemId] = useState<number | null>(null)
  const [price, setPrice] = useState("50")
  const [notice, setNotice] = useState<string | null>(null)

  const refetchAll = useCallback(() => {
    setTimeout(() => {
      void refetchListings()
      void refetchInventory()
    }, 4000)
  }, [refetchListings, refetchInventory])

  const priceWei = useMemo(() => {
    try {
      return parseUnits(price || "0", 18)
    } catch {
      return 0n
    }
  }, [price])

  // Only what is actually in the wallet can be listed: the marketplace escrows on listing, so an
  // item that is equipped or already listed is not available here.
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

  const buy = async (listingId: number, listingPrice: string) => {
    setNotice(null)
    const approved = await writes.approveVael(CONTRACT_ADDRESSES.MARKETPLACE, BigInt(listingPrice))
    if (!approved) return
    const hash = await writes.buyListing(listingId)
    if (hash) {
      setNotice(`Bought listing #${listingId}.`)
      refetchAll()
    }
  }

  const cancel = async (listingId: number) => {
    setNotice(null)
    const hash = await writes.cancelListing(listingId)
    if (hash) {
      setNotice(`Cancelled listing #${listingId}.`)
      refetchAll()
    }
  }

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">Market</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Fixed-price sales in VAEL. Items are escrowed the moment they are listed, so everything
            below is fillable rather than a promise the seller may already have broken. 2% of each
            sale goes to the treasury; the seller keeps the rest.
          </p>
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

        <section className="rounded border border-[#1A1A1A] bg-black p-5">
          <h2 className="text-sm font-semibold text-white">Sell something</h2>
          {!address ? (
            <p className="mt-2 text-xs text-zinc-500">Connect a wallet to list an item.</p>
          ) : sellable.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Nothing in your inventory. Items drop from defeated raid bosses and arena wins.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {sellable.map((item) => (
                  <button
                    key={item.itemId}
                    type="button"
                    onClick={() => setSellItemId(item.itemId)}
                    className={`flex items-center gap-2 rounded border px-3 py-2 text-[11px] transition ${
                      sellItemId === item.itemId
                        ? "border-zinc-400 text-zinc-100"
                        : `${RARITY_CLASSES[item.rarity] ?? RARITY_CLASSES[0]} hover:border-zinc-500`
                    }`}
                  >
                    {ARTWORK.get(item.name) && (
                      <Image
                        src={ARTWORK.get(item.name)!}
                        alt=""
                        width={28}
                        height={28}
                        className="rounded"
                      />
                    )}
                    {item.name} x{item.amount}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Price, in VAEL
                  </span>
                  <input
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-40 rounded border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
                  />
                </label>
                <Button
                  onClick={list}
                  disabled={sellItemId === null || priceWei === 0n || writes.pending !== null}
                  className="rounded bg-white text-black hover:bg-white/90"
                >
                  {writes.pending === "approve-items"
                    ? "Approving items…"
                    : writes.pending === "list"
                      ? "Confirm in your wallet…"
                      : "List for sale"}
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="overflow-hidden rounded border border-[#1A1A1A] bg-black">
          <header className="border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">For sale</h2>
          </header>
          {listings.length === 0 ? (
            <p className="px-5 py-6 text-xs text-zinc-500">Nothing is listed right now.</p>
          ) : (
            <ul className="divide-y divide-[#1A1A1A]">
              {listings.map((listing) => {
                const artwork = listing.item ? ARTWORK.get(listing.item.name) : undefined
                const isMine = address?.toLowerCase() === listing.seller.toLowerCase()
                return (
                  <li
                    key={listing.listingId}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      {artwork && (
                        <Image src={artwork} alt="" width={44} height={44} className="rounded" />
                      )}
                      <div>
                        <p className="text-zinc-200">
                          {listing.item?.name ?? `Item ${listing.itemId}`}
                          {listing.amount > 1 ? ` x${listing.amount}` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-600">
                          {listing.item
                            ? `${listing.item.rarityName} · ${listing.item.slotName} · +${listing.item.strength}/${listing.item.agility}/${listing.item.intellect}`
                            : ""}
                          {" · "}
                          {shortAddress(listing.seller)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-300">{vael(listing.price)} VAEL</span>
                      {isMine ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancel(listing.listingId)}
                          disabled={writes.pending !== null}
                          className="rounded border-zinc-700 text-zinc-300"
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => buy(listing.listingId, listing.price)}
                          disabled={writes.pending !== null || !address}
                          className="rounded bg-white text-black hover:bg-white/90"
                        >
                          {writes.pending === `buy-${listing.listingId}` ? "Confirm…" : "Buy"}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
