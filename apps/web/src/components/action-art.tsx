import Image from "next/image"

import { ActionType, isNativeAction } from "@/lib/attestcoin/types"

/**
 * The artwork for one action type, drawn by `apps/api/scripts/generate-art.ts` and credited in
 * `apps/web/public/game/CREDITS.md` with the prompt and the model that drew it.
 *
 * Keyed by the on-chain `VaelTypes.ActionType`, not by `Quest.category`: the agent sets the category
 * to Swap for everything, so a card keyed on it would put swap art on an Aave supply.
 *
 * The alt text describes the picture rather than restating the action name, which is already beside
 * it in the markup: a screen reader reading "Uniswap swap, Uniswap swap" is worse than no alt at all.
 */
const ART: Record<number, { slug: string; alt: string }> = {
  [ActionType.Portal]: { slug: "portal", alt: "A glowing portal archway on a stone plinth" },
  [ActionType.UniswapSwap]: { slug: "uniswap-swap", alt: "Two blue coins arcing past each other" },
  [ActionType.Erc20Transfer]: { slug: "erc20-transfer", alt: "A green coin streaking through the dark" },
  [ActionType.AaveSupply]: { slug: "aave-supply", alt: "Coins pouring down into an open vault" },
  [ActionType.AaveBorrow]: { slug: "aave-borrow", alt: "Coins rising out of an open vault" },
  [ActionType.PenguinSwapSwap]: { slug: "penguinswap-swap", alt: "Two cyan coins trading above blue ice" },
  [ActionType.WrapNative]: { slug: "wrap-native", alt: "A violet coin inside an open glass cube" },
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
        // Served down from 1024px, so next/image does the resizing rather than the browser
        // shipping a megabyte to draw a 64px square.
        className={`h-full w-full object-cover ${idle ? "action-idle" : ""}`}
        sizes="128px"
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
        className="h-full w-full object-cover"
        priority
        sizes="(max-width: 768px) 100vw, 768px"
      />
      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
        {isNativeAction(actionType) ? "Creditcoin" : "Ethereum Sepolia"}
      </span>
    </div>
  )
}
