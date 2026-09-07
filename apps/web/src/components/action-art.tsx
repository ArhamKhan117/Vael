import Image from "next/image"

import { ActionType, isNativeAction } from "@/lib/attestcoin/types"

/**
 * The artwork for one action type, drawn by `apps/web/scripts/make-action-art.mjs`.
 *
 * Keyed by the on-chain `VaelTypes.ActionType`, not by `Quest.category`: the agent sets the category
 * to Swap for everything, so a card keyed on it would put swap art on an Aave supply.
 */
const ART: Record<number, { slug: string; alt: string }> = {
  [ActionType.Portal]: { slug: "portal", alt: "A portal on a plinth" },
  [ActionType.UniswapSwap]: { slug: "uniswap-swap", alt: "Two arrows passing, one token for another" },
  [ActionType.Erc20Transfer]: { slug: "erc20-transfer", alt: "A coin in motion" },
  [ActionType.AaveSupply]: { slug: "aave-supply", alt: "A coin going into a vault" },
  [ActionType.AaveBorrow]: { slug: "aave-borrow", alt: "A coin coming out of a vault" },
  [ActionType.PenguinSwapSwap]: { slug: "penguinswap-swap", alt: "Two arrows passing, on Creditcoin" },
  [ActionType.WrapNative]: { slug: "wrap-native", alt: "A coin inside a box" },
}

const FALLBACK = { slug: "portal", alt: "A quest action" }

export function actionArtSlug(actionType: number): string {
  return (ART[actionType] ?? FALLBACK).slug
}

/**
 * The square icon, for a card.
 *
 * `idle` gives it a slow breathing float. It is CSS rather than frames, because the art is a single
 * still and animating it in the browser costs nothing; `prefers-reduced-motion` turns it off.
 */
export function ActionArt({
  actionType,
  size = 64,
  idle = true,
  className = "",
}: {
  actionType: number
  size?: number
  idle?: boolean
  className?: string
}) {
  const art = ART[actionType] ?? FALLBACK
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-lg border border-[#1A1A1A] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={`/actions/${art.slug}.png`}
        alt={art.alt}
        width={size}
        height={size}
        // Nearest-neighbour, or a 32px grid upscaled by the browser turns to mush.
        className={`h-full w-full [image-rendering:pixelated] ${idle ? "action-idle" : ""}`}
        unoptimized
      />
    </span>
  )
}

/** The wide banner, for the top of a quest detail page. */
export function ActionBanner({ actionType, className = "" }: { actionType: number; className?: string }) {
  const art = ART[actionType] ?? FALLBACK
  return (
    <div className={`relative overflow-hidden rounded border border-[#1A1A1A] ${className}`}>
      <Image
        src={`/actions/${art.slug}-banner.png`}
        alt={art.alt}
        width={1024}
        height={384}
        className="h-full w-full object-cover [image-rendering:pixelated]"
        priority
        unoptimized
      />
      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
        {isNativeAction(actionType) ? "Creditcoin" : "Ethereum Sepolia"}
      </span>
    </div>
  )
}
