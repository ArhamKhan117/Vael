/**
 * Generate an illustration for every Academy lesson.
 *
 *   node apps/web/scripts/make-lesson-art.mjs
 *
 * Writes `apps/web/public/academy/<module>-<n>.png` at 960x360.
 *
 * Twelve lessons, twelve diagrams. Each one draws the thing its lesson is about rather than being
 * decoration: two chains with a gap between them, a pool with a curve through it, a vault filling
 * up. They are drawn on a 96x36 pixel grid and upscaled ten times, so they match the rest of the
 * site's pixel art and cost a few kilobytes each.
 *
 * Shares its primitives with make-action-art.mjs by reimplementing the two it needs rather than
 * exporting from there: that script is a generator with a `main`, and importing it would run it.
 */
import { createRequire } from "node:module"
import { mkdirSync, readdirSync } from "node:fs"
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

const W = 96
const H = 36
const SCALE = 10

const hex = (value) => {
  const n = value.replace("#", "")
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 255]
}

class Canvas {
  constructor() {
    this.data = Buffer.alloc(W * H * 4, 0)
  }
  set(x, y, colour) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    this.data[i] = colour[0]
    this.data[i + 1] = colour[1]
    this.data[i + 2] = colour[2]
    this.data[i + 3] = colour[3]
  }
  rect(x, y, w, h, colour) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, colour)
  }
  frame(x, y, w, h, colour) {
    this.rect(x, y, w, 1, colour)
    this.rect(x, y + h - 1, w, 1, colour)
    this.rect(x, y, 1, h, colour)
    this.rect(x + w - 1, y, 1, h, colour)
  }
  disc(cx, cy, r, colour) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.4) this.set(cx + x, cy + y, colour)
  }
  /** A dashed horizontal run, for a link that is not solid. */
  dashes(x, y, length, colour, on = 2, off = 2) {
    for (let i = 0; i < length; i++) if (i % (on + off) < on) this.set(x + i, y, colour)
  }
  arrow(x, y, length, thickness, colour, flip = false) {
    const head = thickness + 2
    const shaft = length - head
    const draw = (px, py) => this.set(flip ? 2 * x + length - 1 - px : px, py, colour)
    for (let dy = 0; dy < thickness; dy++) for (let dx = 0; dx < shaft; dx++) draw(x + dx, y + dy)
    const cy = y + Math.floor(thickness / 2)
    for (let i = 0; i < head; i++) {
      const half = head - i - 1
      for (let dy = -half; dy <= half; dy++) draw(x + shaft + i, cy + dy)
    }
  }
  /** A binary-tree silhouette, for anything Merkle. */
  tree(x, y, colour, leaf) {
    this.rect(x + 14, y, 3, 3, colour)
    this.rect(x + 6, y + 6, 3, 3, colour)
    this.rect(x + 22, y + 6, 3, 3, colour)
    for (let i = 0; i < 4; i++) this.rect(x + i * 8 + 2, y + 12, 3, 3, i === 1 ? leaf : colour)
    for (let i = 0; i < 30; i++) {
      if (i % 3 === 0) {
        this.set(x + 8 + Math.round(i / 4), y + 4, colour)
        this.set(x + 22 - Math.round(i / 4), y + 4, colour)
      }
    }
  }
  /** A shallow curve, for a constant-product pool. */
  curve(x, y, w, h, colour) {
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1)
      this.set(x + i, y + Math.round(h * (1 - t) * (1 - t)), colour)
    }
  }
  async png(path) {
    await sharp(this.data, { raw: { width: W, height: H, channels: 4 } })
      .resize(W * SCALE, H * SCALE, { kernel: "nearest" })
      .png()
      .toFile(path)
  }
}

const INK = hex("#0a0a0f")
const DIM = hex("#3f3f46")
const TEXT = hex("#a1a1aa")

/** Two boxes labelled by colour rather than by letters: left is Ethereum, right is Creditcoin. */
function chains(c, eth, ctc) {
  c.frame(4, 8, 30, 20, eth)
  c.rect(6, 10, 26, 16, hex("#0f1420"))
  c.frame(62, 8, 30, 20, ctc)
  c.rect(64, 10, 26, 16, hex("#141020"))
}

const ETH = hex("#94a3b8")
const CTC = hex("#facc15")

const LESSONS = {
  "attestcoin-proofs": [
    // The gap between two chains.
    (c) => {
      chains(c, ETH, CTC)
      c.dashes(36, 17, 24, DIM, 2, 3)
      // A blocked crossing: an X in the middle of the gap.
      const red = hex("#ef4444")
      for (let i = 0; i < 7; i++) {
        c.set(45 + i, 14 + i, red)
        c.set(51 - i, 14 + i, red)
      }
      c.rect(10, 14, 8, 8, hex("#38bdf8"))
      c.rect(72, 14, 8, 8, DIM)
    },
    // Two proofs: a Merkle tree and a chain of headers.
    (c) => {
      c.tree(8, 6, hex("#38bdf8"), hex("#fbbf24"))
      for (let i = 0; i < 5; i++) {
        c.frame(50 + i * 9, 14, 7, 8, hex("#a78bfa"))
        if (i < 4) c.rect(57 + i * 9, 17, 2, 2, DIM)
      }
      c.rect(4, 30, 34, 1, DIM)
      c.rect(50, 30, 41, 1, DIM)
    },
    // A verified log becoming a reward.
    (c) => {
      c.frame(6, 10, 26, 16, hex("#34d399"))
      for (let i = 0; i < 4; i++) c.rect(9, 13 + i * 3, 14 + (i % 2) * 6, 1, hex("#34d399"))
      c.arrow(38, 16, 18, 4, hex("#e4e4e7"))
      c.disc(72, 18, 7, hex("#065f46"))
      c.disc(72, 18, 6, hex("#34d399"))
      c.rect(71, 14, 2, 8, hex("#d1fae5"))
    },
  ],
  "uniswap-swaps": [
    // A pool with two reserves.
    (c) => {
      c.frame(20, 6, 56, 24, hex("#38bdf8"))
      c.rect(22, 8, 52, 20, hex("#0a1a26"))
      c.rect(24, 18, 22, 8, hex("#38bdf8"))
      c.rect(50, 12, 22, 14, hex("#0369a1"))
      c.rect(24, 8, 48, 1, DIM)
    },
    // Price impact: a curve, with the trade sliding along it.
    (c) => {
      c.rect(10, 30, 76, 1, DIM)
      c.rect(10, 6, 1, 25, DIM)
      c.curve(12, 6, 72, 22, hex("#38bdf8"))
      c.disc(36, 15, 2, hex("#fbbf24"))
      c.disc(62, 24, 2, hex("#ef4444"))
      c.dashes(36, 30, 26, hex("#ef4444"), 1, 2)
    },
    // The Swap log: one line with the two amounts picked out.
    (c) => {
      c.frame(8, 9, 80, 18, hex("#38bdf8"))
      c.rect(10, 11, 76, 14, hex("#0a1a26"))
      c.rect(13, 14, 18, 2, TEXT)
      c.rect(13, 19, 28, 2, hex("#34d399"))
      c.rect(46, 19, 24, 2, hex("#ef4444"))
      c.rect(74, 14, 9, 2, hex("#fbbf24"))
    },
  ],
  "aave-supply-borrow": [
    // Many depositors, one pool.
    (c) => {
      for (let i = 0; i < 4; i++) c.disc(10, 6 + i * 8, 3, hex("#818cf8"))
      for (let i = 0; i < 4; i++) c.arrow(16, 5 + i * 8, 20, 2, hex("#3730a3"))
      c.frame(40, 6, 30, 24, hex("#818cf8"))
      c.rect(42, 18, 26, 10, hex("#818cf8"))
    },
    // Collateral in, a smaller loan out.
    (c) => {
      c.frame(8, 8, 26, 20, hex("#818cf8"))
      c.rect(10, 16, 22, 10, hex("#818cf8"))
      c.arrow(38, 12, 22, 4, hex("#fbbf24"))
      c.frame(64, 12, 24, 12, hex("#fbbf24"))
      c.rect(66, 18, 12, 4, hex("#fbbf24"))
      c.dashes(66, 26, 20, DIM, 2, 2)
    },
    // A cap: a vault full to a marked line.
    (c) => {
      c.frame(24, 5, 48, 26, hex("#818cf8"))
      c.rect(26, 15, 44, 14, hex("#3730a3"))
      c.rect(26, 14, 44, 1, hex("#ef4444"))
      for (let i = 0; i < 44; i += 4) c.set(26 + i, 12, hex("#ef4444"))
      c.rect(76, 13, 6, 3, hex("#ef4444"))
    },
  ],
  "penguinswap-creditcoin": [
    // One chain, everything inside it.
    (c) => {
      c.frame(14, 5, 68, 26, CTC)
      c.rect(16, 7, 64, 22, hex("#141020"))
      c.frame(22, 12, 20, 12, hex("#22d3ee"))
      c.frame(54, 12, 20, 12, hex("#22d3ee"))
      c.dashes(42, 17, 12, hex("#22d3ee"), 2, 2)
    },
    // No gap to bridge: the two chains, and the action wholly inside one of them.
    (c) => {
      chains(c, ETH, CTC)
      c.dashes(36, 17, 24, DIM, 2, 3)
      c.rect(68, 14, 18, 8, hex("#22d3ee"))
      c.rect(70, 16, 14, 4, hex("#cffafe"))
    },
    // One transaction containing both the action and the completion.
    (c) => {
      c.frame(6, 6, 84, 24, hex("#22d3ee"))
      c.rect(8, 8, 80, 20, hex("#062229"))
      c.rect(12, 13, 20, 10, hex("#22d3ee"))
      c.arrow(35, 16, 12, 4, hex("#cffafe"))
      c.rect(50, 13, 20, 10, hex("#0e7490"))
      c.disc(80, 18, 4, hex("#34d399"))
    },
  ],
}

async function main() {
  const outDir = join(repoRoot, "apps/web/public/academy")
  mkdirSync(outDir, { recursive: true })
  let count = 0
  for (const [slug, drawings] of Object.entries(LESSONS)) {
    for (let i = 0; i < drawings.length; i++) {
      const c = new Canvas()
      c.rect(0, 0, W, H, INK)
      drawings[i](c)
      await c.png(join(outDir, `${slug}-${i}.png`))
      count += 1
    }
    console.log(`${slug.padEnd(26)} ${drawings.length} lessons`)
  }
  console.log(`\n${count} lesson illustrations in ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
