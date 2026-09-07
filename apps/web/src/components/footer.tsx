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
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,20rem)_1fr]">
        <div>
          <Link href="/" className="mb-4 flex items-center gap-2">
            <Image src="/logo/vael.svg" alt="Vael" width={24} height={24} />
            <span className="font-matemasie mb-1 text-xl text-white">VAEL</span>
          </Link>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Do real DeFi on Ethereum. Prove it on Creditcoin with the Attestcoin Protocol. Earn
            rewards no backend key can hand out.
          </p>
        </div>

        <nav aria-labelledby="footer-menu">
          <h2 id="footer-menu" className="mb-4 text-sm font-semibold text-white">
            Menu
          </h2>
          {/* Two columns on a phone, four from `sm` up: twelve links in one column is a scroll,
              and in four columns at 390 px the labels wrap mid-word. */}
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
            {MENU.map((link) => (
              <li key={link.path}>
                <Link
                  href={link.path}
                  className="text-sm text-muted-foreground transition hover:text-white"
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
