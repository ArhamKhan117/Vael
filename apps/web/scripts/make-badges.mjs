/**
 * Generate the ten badge images from the CC0 Tiny Dungeon sheet.
 *
 * The art is committed, so this is not part of any build. It exists so the badges can be
 * regenerated or restyled without anybody having to guess how the originals were made.
 *
 *   node apps/web/scripts/make-badges.mjs
 *
 * sharp is not a declared dependency of this package. It arrives in the store as an optional
 * dependency of Next's image optimiser, so it is resolved from there rather than added to
 * package.json for a script that runs once.
 */
import { createRequire } from "node:module"
import { readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../..")
const require = createRequire(import.meta.url)

function loadSharp() {
  try {
    return require("sharp")
  } catch {
    const store = join(repoRoot, "node_modules/.pnpm")
    const entry = readdirSync(store).find((name) => name.startsWith("sharp@"))
    if (!entry) throw new Error("sharp is not in the pnpm store; run pnpm install first")
    return require(join(store, entry, "node_modules/sharp"))
  }
}

const sharp = loadSharp()

const TILE = 16
const COLS = 12
const SIZE = 512
const ICON = 288

/** Rarity as BadgeNFT v3 derives it from a level: 1 Common through 5 and above, Legendary. */
const RARITY = [
  { name: "Common", colour: "#9ca3af" },
  { name: "Uncommon", colour: "#34d399" },
  { name: "Rare", colour: "#38bdf8" },
  { name: "Epic", colour: "#a78bfa" },
  { name: "Legendary", colour: "#fbbf24" },
]

function rarityForLevel(level) {
  return RARITY[level >= 5 ? 4 : level - 1]
}

/**
 * Frame indices verified by eye against a labelled contact sheet of the whole tilemap. Guessing
 * these is how the hero sprites once ended up wrong.
 */
export const BADGES = [
  { level: 1, name: "Initiate", frame: 113, blurb: "First verified action." },
  { level: 2, name: "Apprentice", frame: 103, blurb: "A second protocol proved." },
  { level: 3, name: "Adept", frame: 56, blurb: "Steady, verified activity." },
  { level: 4, name: "Veteran", frame: 106, blurb: "Deep into the quest board." },
  { level: 5, name: "Champion", frame: 107, blurb: "A season's worth of proofs." },
  { level: 6, name: "Warden", frame: 118, blurb: "Held the line on a raid." },
  { level: 7, name: "Sentinel", frame: 117, blurb: "Struck a boss down." },
  { level: 8, name: "Archon", frame: 129, blurb: "Mastery of every action type." },
  { level: 9, name: "Paragon", frame: 131, blurb: "Rarely awarded." },
  { level: 10, name: "Ascendant", frame: 89, blurb: "The highest badge Vael issues." },
]

async function iconFor(frame) {
  const col = frame % COLS
  const row = Math.floor(frame / COLS)
  const sheet = join(repoRoot, "apps/web/public/game/kenney-tiny-dungeon/tilemap_packed.png")
  return sharp(sheet)
    .extract({ left: col * TILE, top: row * TILE, width: TILE, height: TILE })
    .resize(ICON, ICON, { kernel: "nearest" })
    .png()
    .toBuffer()
}

function plate(colour) {
  return Buffer.from(`<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="46%" r="42%">
      <stop offset="0%" stop-color="${colour}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${colour}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="56" fill="url(#g)"/>
  <rect x="10" y="10" width="${SIZE - 20}" height="${SIZE - 20}" rx="48"
        fill="none" stroke="${colour}" stroke-opacity="0.55" stroke-width="6"/>
  <rect x="26" y="26" width="${SIZE - 52}" height="${SIZE - 52}" rx="38"
        fill="none" stroke="${colour}" stroke-opacity="0.18" stroke-width="2"/>
  <rect width="${SIZE}" height="${SIZE}" rx="56" fill="url(#glow)"/>
</svg>`)
}

function caption(badge, rarity) {
  return Buffer.from(`<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <text x="${SIZE / 2}" y="430" text-anchor="middle" font-family="monospace" font-size="38"
        font-weight="bold" fill="#f4f4f5">${badge.name}</text>
  <text x="${SIZE / 2}" y="466" text-anchor="middle" font-family="monospace" font-size="22"
        fill="${rarity.colour}">${rarity.name} &#183; level ${badge.level}</text>
</svg>`)
}

async function main() {
  const outDir = join(repoRoot, "apps/web/public/badges")
  for (const badge of BADGES) {
    const rarity = rarityForLevel(badge.level)
    const icon = await iconFor(badge.frame)
    const out = join(outDir, `level-${badge.level}.png`)
    await sharp(plate(rarity.colour))
      .composite([
        { input: icon, left: (SIZE - ICON) / 2, top: 64 },
        { input: caption(badge, rarity), left: 0, top: 0 },
      ])
      .png({ compressionLevel: 9, palette: true })
      .toFile(out)
    console.log(`level ${badge.level} ${badge.name} (${rarity.name}) -> ${out}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
