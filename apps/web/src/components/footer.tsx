import Image from "next/image"
import Link from "next/link"

/**
 * Twelve destinations in a 4 x 3 grid, in the order they are meant to be met.
 *
 * The README and the whitepaper are in here with the game pages rather than tucked into a
 * "resources" corner, because the claim this project makes is the kind a reader should be able to
 * check without leaving the site.
 */
const MENU: { label: string; path: string }[] = [
  { label: "Quests", path: "/quests" },
  { label: "Campaigns", path: "/campaigns" },
  { label: "Academy", path: "/academy" },
  { label: "Hero", path: "/hero" },
  { label: "Raid", path: "/raid" },
  { label: "Arena", path: "/arena" },
  { label: "Market", path: "/market" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Feedback", path: "/feedback" },
  { label: "Studio", path: "/dashboard/studio" },
  { label: "README", path: "/readme" },
  { label: "Whitepaper", path: "/whitepaper" },
]

export default function Footer() {
  return (
    <footer className="border-t border-[#1A1A1A] bg-black px-5 py-10 md:px-10">
      {/* The two blocks are pushed apart rather than merely placed side by side: the menu sits
          against the right edge and the gap between it and the wordmark is the widest thing on the
          row, so the eye reads them as two separate things instead of one long line of text. */}
      <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-24">
        <div className="md:max-w-xs">
          {/* The logo, alone, where the mark and the wordmark used to sit: 28 px tall, which is
              the line the wordmark took, from a master three times that so it is sharp at 2x. */}
          <Link href="/" className="mb-4 flex items-center">
            <Image
              src="/brand/vael-logo-84h.webp"
              alt="Vael"
              width={86}
              height={28}
              className="h-7 w-auto"
              priority={false}
            />
          </Link>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Do real DeFi on Ethereum. Prove it on Creditcoin with the Attestcoin Protocol. Earn
            rewards no backend key can hand out.
          </p>
        </div>

        <nav aria-labelledby="footer-menu" className="md:shrink-0">
          <h2 id="footer-menu" className="mb-4 text-sm font-semibold text-white">
            Menu
          </h2>
          {/* Two columns on a phone, four from `sm` up: twelve links in one column is a scroll,
              and in four columns at 390 px the labels wrap mid-word. The rows are tighter than the
              columns are wide, so the block reads as a grid rather than as four lists. */}
          <ul className="grid grid-cols-2 gap-x-10 gap-y-1.5 sm:grid-cols-4 lg:gap-x-14">
            {MENU.map((link) => (
              <li key={link.path}>
                <Link
                  href={link.path}
                  className="block py-0.5 text-sm text-muted-foreground transition hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-10 border-t border-[#1A1A1A] pt-8 text-center">
        <p className="text-sm text-muted-foreground">© 2026 Vael. All rights reserved.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Built on Creditcoin with the Attestcoin Protocol.
        </p>
      </div>
    </footer>
  )
}
