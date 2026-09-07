/**
 * Generate the artwork for every quest action type.
 *
 *   node apps/web/scripts/make-action-art.mjs
 *
 * Writes `apps/web/public/actions/<slug>.png` (256px, shown at 64) and `<slug>-banner.png`
 * (1024x384, shown across the top of a quest detail page).
 *
 * These are drawn here rather than downloaded. The obvious alternative was each protocol's own
 * brand mark, which would be recognisable and is also somebody else's trademark, and the repo's
 * rule is that every committed asset is CC0 or ours. Drawing an imitation of a logo would be worse
 * than either. So the art says what the *action* is, which is the thing a player is actually being
 * asked to do, and the protocol is named in text beside it.
 *
 * The grid is 32x32 and everything is drawn with integer primitives, so the output is real pixel
 * art rather than a downscaled vector: upscaled with nearest-neighbour it stays crisp at any size.
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

const GRID = 32
const ICON_SCALE = 8 // 32 * 8 = 256
const BANNER = { width: 1024, height: 384 }

// ---------------------------------------------------------------- a tiny pixel canvas

const hex = (value) => {
  const n = value.replace("#", "")
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 255]
}

class Pixels {
  constructor(size = GRID) {
    this.size = size
    this.data = Buffer.alloc(size * size * 4, 0)
  }
  set(x, y, colour) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return
    const i = (y * this.size + x) * 4
    const [r, g, b, a] = colour
    this.data[i] = r
    this.data[i + 1] = g
    this.data[i + 2] = b
    this.data[i + 3] = a
  }
  rect(x, y, w, h, colour) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, colour)
  }
  /** A filled disc. Radius is in whole pixels and the edge is left hard, as pixel art wants. */
  disc(cx, cy, r, colour) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + r * 0.4) this.set(cx + x, cy + y, colour)
      }
    }
  }
  ring(cx, cy, r, thickness, colour) {
    const inner = r - thickness
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y
        if (d <= r * r + r * 0.4 && d >= inner * inner) this.set(cx + x, cy + y, colour)
      }
    }
  }
  /** A right-pointing arrow: a shaft with a solid triangular head. Mirror it with `flip`. */
  arrow(x, y, length, thickness, colour, flip = false) {
    const head = thickness + 2
    const shaft = length - head
    const draw = (px, py) => this.set(flip ? 2 * x + length - 1 - px : px, py, colour)
    for (let dy = 0; dy < thickness; dy++) {
      for (let dx = 0; dx < shaft; dx++) draw(x + dx, y + dy)
    }
    // The head, tapering to a point.
    const cy = y + Math.floor(thickness / 2)
    for (let i = 0; i < head; i++) {
      const half = head - i - 1
      for (let dy = -half; dy <= half; dy++) draw(x + shaft + i, cy + dy)
    }
  }
  /** An upward arrow, for a value leaving somewhere. */
  arrowUp(x, y, length, thickness, colour, down = false) {
    const head = thickness + 2
    const shaft = length - head
    const draw = (px, py) => this.set(px, down ? 2 * y + length - 1 - py : py, colour)
    for (let dx = 0; dx < thickness; dx++) {
      for (let dy = 0; dy < shaft; dy++) draw(x + dx, y + head + dy)
    }
    const cx = x + Math.floor(thickness / 2)
    for (let i = 0; i < head; i++) {
      const half = i
      for (let dx = -half; dx <= half; dx++) draw(cx + dx, y + i)
    }
  }
  /** A coin: a filled disc with a darker rim and a mark in the middle. */
  coin(cx, cy, r, face, rim, mark) {
    this.disc(cx, cy, r, rim)
    this.disc(cx, cy, r - 1, face)
    this.rect(cx - 1, cy - Math.floor(r / 2), 2, r, mark)
  }
  async png(path, scale) {
    const size = this.size * scale
    const image = sharp(this.data, { raw: { width: this.size, height: this.size, channels: 4 } })
      .resize(size, size, { kernel: "nearest" })
      .png()
    await image.toFile(path)
  }
  buffer() {
    return sharp(this.data, { raw: { width: this.size, height: this.size, channels: 4 } }).png().toBuffer()
  }
}

// ---------------------------------------------------------------- the actions

const INK = hex("#0a0a0f")

/**
 * One entry per `VaelTypes.ActionType`, in the on-chain order.
 *
 * `chain` decides the palette family as much as the icon does: an action on Ethereum and the same
 * action on Creditcoin should be told apart at a glance, and the shape alone cannot do that.
 */
const ACTIONS = [
  {
    slug: "portal",
    actionType: 0,
    label: "Portal check-in",
    chain: "ethereum",
    palette: { key: "#a78bfa", deep: "#6d28d9", glow: "#ede9fe", back: "#140f24" },
    draw(p, c) {
      // A portal on a plinth: the doorway a player steps through to say "I am here".
      p.ring(16, 14, 11, 3, c.deep)
      p.ring(16, 14, 7, 2, c.key)
      p.disc(16, 14, 3, c.glow)
      p.rect(6, 27, 20, 3, c.deep)
      p.rect(9, 25, 14, 2, c.key)
    },
  },
  {
    slug: "uniswap-swap",
    actionType: 1,
    label: "Uniswap v3 swap",
    chain: "ethereum",
    palette: { key: "#38bdf8", deep: "#0369a1", glow: "#e0f2fe", back: "#0a1a26" },
    draw(p, c) {
      // Two arrows passing each other: one token out, one token in.
      p.arrow(5, 8, 22, 4, c.key)
      p.arrow(5, 20, 22, 4, c.deep, true)
      p.rect(5, 8, 3, 4, c.glow)
      p.rect(24, 20, 3, 4, c.glow)
    },
  },
  {
    slug: "erc20-transfer",
    actionType: 2,
    label: "ERC-20 transfer",
    chain: "ethereum",
    palette: { key: "#34d399", deep: "#047857", glow: "#d1fae5", back: "#08201a" },
    draw(p, c) {
      // A coin, moving.
      p.coin(10, 16, 7, c.key, c.deep, c.glow)
      p.arrow(19, 14, 11, 4, c.glow)
    },
  },
  {
    slug: "aave-supply",
    actionType: 3,
    label: "Aave v3 supply",
    chain: "ethereum",
    palette: { key: "#818cf8", deep: "#3730a3", glow: "#e0e7ff", back: "#12122e" },
    draw(p, c) {
      // A vault taking a deposit.
      p.rect(6, 16, 20, 13, c.deep)
      p.rect(8, 18, 16, 9, c.key)
      p.disc(16, 22, 3, c.deep)
      p.arrowUp(14, 3, 11, 4, c.glow, true)
    },
  },
  {
    slug: "aave-borrow",
    actionType: 4,
    label: "Aave v3 borrow",
    chain: "ethereum",
    palette: { key: "#fbbf24", deep: "#b45309", glow: "#fef3c7", back: "#241703" },
    draw(p, c) {
      // The same vault, giving one back.
      p.rect(6, 16, 20, 13, c.deep)
      p.rect(8, 18, 16, 9, c.key)
      p.disc(16, 22, 3, c.deep)
      p.arrowUp(14, 3, 11, 4, c.glow)
    },
  },
  {
    slug: "penguinswap-swap",
    actionType: 5,
    label: "PenguinSwap swap",
    chain: "creditcoin",
    palette: { key: "#22d3ee", deep: "#0e7490", glow: "#cffafe", back: "#062229" },
    draw(p, c) {
      // The same two arrows as a Uniswap swap, because it is the same action, in the Creditcoin
      // palette, because it is not the same chain. That difference is the whole point of the pair.
      p.arrow(5, 8, 22, 4, c.key)
      p.arrow(5, 20, 22, 4, c.deep, true)
      p.rect(5, 8, 3, 4, c.glow)
      p.rect(24, 20, 3, 4, c.glow)
    },
  },
  {
    slug: "wrap-native",
    actionType: 6,
    label: "Wrap CTC",
    chain: "creditcoin",
    palette: { key: "#c084fc", deep: "#6b21a8", glow: "#f3e8ff", back: "#1a0c26" },
    draw(p, c) {
      // A coin inside a box: the same value, wrapped. The lid is lifted, so the coin is visible
      // rather than implied.
      p.rect(5, 12, 22, 16, c.deep)
      p.rect(7, 14, 18, 12, c.back)
      p.coin(16, 20, 6, c.key, c.deep, c.glow)
      p.rect(4, 7, 24, 4, c.key)
      p.rect(14, 5, 4, 2, c.glow)
    },
  },
]

/** Where the action happens, marked in the corner so the pair of swaps is never ambiguous. */
const CHAIN_MARK = {
  ethereum: "#94a3b8",
  creditcoin: "#facc15",
}

async function icon(action) {
  const p = new Pixels(GRID)
  const c = Object.fromEntries(Object.entries(action.palette).map(([k, v]) => [k, hex(v)]))
  p.rect(0, 0, GRID, GRID, hex(action.palette.back))
  action.draw(p, c)
  // The chain mark: three pixels in the bottom-right, on its own dark plinth so it reads at 64px.
  p.rect(26, 26, 5, 5, INK)
  p.rect(27, 27, 3, 3, hex(CHAIN_MARK[action.chain]))
  return p
}

/**
 * The wide banner.
 *
 * The icon is scaled up and set on a field of its own palette, with a faint grid so the space does
 * not read as a flat swatch. Composited rather than drawn at banner resolution, so the pixels stay
 * square and aligned.
 */
async function banner(action, iconPixels) {
  const { width, height } = BANNER
  const back = hex(action.palette.back)
  const deep = hex(action.palette.deep)

  const field = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // A 32px grid, one pixel of it lit, so the field has texture without a pattern to look at.
      const onGrid = x % 32 === 0 || y % 32 === 0
      const t = 1 - y / height
      const source = onGrid ? deep : back
      field[i] = Math.round(source[0] * (0.55 + t * 0.45))
      field[i + 1] = Math.round(source[1] * (0.55 + t * 0.45))
      field[i + 2] = Math.round(source[2] * (0.55 + t * 0.45))
      field[i + 3] = 255
    }
  }

  const mark = await sharp(await iconPixels.buffer())
    .resize(288, 288, { kernel: "nearest" })
    .png()
    .toBuffer()

  return sharp(field, { raw: { width, height, channels: 4 } })
    .composite([{ input: mark, left: Math.round(width / 2 - 144), top: Math.round(height / 2 - 144) }])
    .png()
}

async function main() {
  const outDir = join(repoRoot, "apps/web/public/actions")
  mkdirSync(outDir, { recursive: true })

  const manifest = []
  for (const action of ACTIONS) {
    const pixels = await icon(action)
    await pixels.png(join(outDir, `${action.slug}.png`), ICON_SCALE)
    await (await banner(action, pixels)).toFile(join(outDir, `${action.slug}-banner.png`))
    manifest.push(`${String(action.actionType).padStart(2)}  ${action.slug.padEnd(18)} ${action.label}`)
    console.log(`${action.slug.padEnd(18)} icon ${GRID * ICON_SCALE}px, banner ${BANNER.width}x${BANNER.height}`)
  }
  console.log(`\n${manifest.length} action types drawn into ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
