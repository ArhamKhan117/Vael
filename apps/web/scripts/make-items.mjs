/**
 * Generate the loot item icons and the catalogue every other tool reads.
 *
 *   node apps/web/scripts/make-items.mjs
 *
 * Writes `apps/web/public/items/<slug>.png` and `apps/web/src/content/items.json`. The catalogue is
 * the single source of truth for what an item is: the pin script turns it into metadata, the
 * registration script turns it into `registerItem` calls, and the web reads it for names and
 * icons. Stats live here and nowhere else, so the three can never disagree.
 *
 * Two sheets, both CC0 by Kenney. Tiny Dungeon has the weapons; the Roguelike/RPG pack has the
 * armour, books, and crystals but no weapons at all, which is why neither alone is enough.
 */
import { createRequire } from "node:module"
import { readdirSync, writeFileSync } from "node:fs"
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

const SIZE = 256
const ICON = 152

/** Tiny Dungeon: 16px tiles, 12 per row, no margin. */
const DUNGEON = {
  path: "apps/web/public/game/kenney-tiny-dungeon/tilemap_packed.png",
  tile: 16,
  step: 16,
  cols: 12,
}
/** Roguelike/RPG: 16px tiles with a 1px margin, addressed by column and row. */
const ROGUE = {
  path: "apps/web/public/game/kenney-roguelike-rpg/roguelikeSheet_transparent.png",
  tile: 16,
  step: 17,
}

const SLOTS = ["weapon", "armour", "trinket", "relic"]
const RARITIES = [
  { name: "Common", colour: "#9ca3af" },
  { name: "Uncommon", colour: "#34d399" },
  { name: "Rare", colour: "#38bdf8" },
  { name: "Epic", colour: "#a78bfa" },
  { name: "Legendary", colour: "#fbbf24" },
]

/**
 * The catalogue. Every rarity has at least one item, because Loot falls back down the ladder when
 * a pool is empty and an empty Legendary pool would quietly pay a raid's biggest contributor in
 * Epics.
 *
 * Sheet coordinates were picked by eye off labelled contact sheets of both packs.
 */
export const ITEMS = [
  { slug: "rusted-blade", name: "Rusted Blade", slot: 0, rarity: 0, strength: 2, agility: 0, intellect: 0,
    icon: { sheet: "dungeon", frame: 103 },
    blurb: "Notched, pitted, and still sharper than nothing." },
  { slug: "padded-vest", name: "Padded Vest", slot: 1, rarity: 0, strength: 1, agility: 0, intellect: 1,
    icon: { sheet: "rogue", col: 41, row: 10 },
    blurb: "Layered cloth and hope." },
  { slug: "iron-sword", name: "Iron Sword", slot: 0, rarity: 1, strength: 4, agility: 0, intellect: 0,
    icon: { sheet: "dungeon", frame: 106 },
    blurb: "Plain, balanced, and honest about what it is." },
  { slug: "swift-charm", name: "Swift Charm", slot: 2, rarity: 1, strength: 0, agility: 3, intellect: 0,
    icon: { sheet: "dungeon", frame: 56 },
    blurb: "Light enough to forget you are wearing it." },
  { slug: "plate-harness", name: "Plate Harness", slot: 1, rarity: 2, strength: 3, agility: 0, intellect: 4,
    icon: { sheet: "rogue", col: 42, row: 10 },
    blurb: "Fitted steel. Heavy, and worth the weight." },
  { slug: "scholars-scroll", name: "Scholar's Scroll", slot: 2, rarity: 2, strength: 0, agility: 2, intellect: 4,
    icon: { sheet: "rogue", col: 44, row: 15 },
    blurb: "Someone else's notes, and better than yours." },
  { slug: "arcane-codex", name: "Arcane Codex", slot: 3, rarity: 2, strength: 0, agility: 0, intellect: 6,
    icon: { sheet: "rogue", col: 51, row: 15 },
    blurb: "Half of it is marginalia. That is the useful half." },
  { slug: "warhammer", name: "Warhammer", slot: 0, rarity: 3, strength: 10, agility: 0, intellect: 0,
    icon: { sheet: "dungeon", frame: 117 },
    blurb: "No finesse. None needed." },
  { slug: "gilded-aegis", name: "Gilded Aegis", slot: 1, rarity: 3, strength: 5, agility: 0, intellect: 7,
    icon: { sheet: "rogue", col: 43, row: 10 },
    blurb: "Gold over steel, which is less foolish than it looks." },
  { slug: "blessed-blade", name: "Blessed Blade", slot: 0, rarity: 4, strength: 12, agility: 4, intellect: 0,
    icon: { sheet: "dungeon", frame: 107 },
    blurb: "Awarded for carrying a season." },
  { slug: "seers-crystal", name: "Seer's Crystal", slot: 3, rarity: 4, strength: 0, agility: 5, intellect: 10,
    icon: { sheet: "rogue", col: 50, row: 9 },
    blurb: "It shows you the next round. Only the next one." },
]

async function iconFor(icon) {
  if (icon.sheet === "dungeon") {
    const col = icon.frame % DUNGEON.cols
    const row = Math.floor(icon.frame / DUNGEON.cols)
    return sharp(join(repoRoot, DUNGEON.path))
      .extract({ left: col * DUNGEON.step, top: row * DUNGEON.step, width: DUNGEON.tile, height: DUNGEON.tile })
      .resize(ICON, ICON, { kernel: "nearest" })
      .png()
      .toBuffer()
  }
  return sharp(join(repoRoot, ROGUE.path))
    .extract({ left: icon.col * ROGUE.step, top: icon.row * ROGUE.step, width: ROGUE.tile, height: ROGUE.tile })
    .resize(ICON, ICON, { kernel: "nearest" })
    .png()
    .toBuffer()
}

function plate(colour) {
  return Buffer.from(`<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="44%">
      <stop offset="0%" stop-color="${colour}" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="${colour}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="28" fill="url(#g)"/>
  <rect x="5" y="5" width="${SIZE - 10}" height="${SIZE - 10}" rx="24"
        fill="none" stroke="${colour}" stroke-opacity="0.6" stroke-width="3"/>
  <rect width="${SIZE}" height="${SIZE}" rx="28" fill="url(#glow)"/>
</svg>`)
}

function caption(item, rarity) {
  return Buffer.from(`<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <text x="${SIZE / 2}" y="212" text-anchor="middle" font-family="monospace" font-size="19"
        font-weight="bold" fill="#f4f4f5">${item.name.replace(/&/g, "&amp;").replace(/'/g, "&#39;")}</text>
  <text x="${SIZE / 2}" y="234" text-anchor="middle" font-family="monospace" font-size="13"
        fill="${rarity.colour}">${rarity.name} &#183; ${SLOTS[item.slot]}</text>
</svg>`)
}

async function main() {
  const outDir = join(repoRoot, "apps/web/public/items")
  for (const item of ITEMS) {
    const rarity = RARITIES[item.rarity]
    const icon = await iconFor(item.icon)
    await sharp(plate(rarity.colour))
      .composite([
        { input: icon, left: (SIZE - ICON) / 2, top: 30 },
        { input: caption(item, rarity), left: 0, top: 0 },
      ])
      .png({ compressionLevel: 9, palette: true })
      .toFile(join(outDir, `${item.slug}.png`))
    console.log(`${item.name.padEnd(18)} ${rarity.name.padEnd(10)} ${SLOTS[item.slot]}`)
  }

  const catalogue = {
    slots: SLOTS,
    rarities: RARITIES.map((r) => r.name),
    items: ITEMS.map(({ icon, ...rest }) => ({ ...rest, image: `/items/${rest.slug}.png` })),
  }
  const path = join(repoRoot, "apps/web/src/content/items.json")
  writeFileSync(path, `${JSON.stringify(catalogue, null, 2)}\n`)
  console.log(`\nwrote ${path}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
