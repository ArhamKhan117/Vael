/**
 * Pack the generated artwork for the web.
 *
 *   node apps/web/scripts/pack-art.mjs            # convert every master, then print the size report
 *   node apps/web/scripts/pack-art.mjs --report   # the size report alone, no conversion
 *
 * The masters are what the image models drew: 1024 or 1536 pixel PNGs, about 1.4 MB each, forty-
 * eight of them, 52 MB in a folder every visitor's browser was asked to pull from. They live in
 * `apps/web/art-src/`, which is gitignored, and this writes what the site actually serves into
 * `apps/web/public/`: one WebP per master at the largest size any layout draws it, which next/image
 * then serves down per breakpoint and pixel density. Nothing here is ever drawn larger than the
 * file it comes from, so nothing is stretched.
 *
 * The size a folder is packed at follows from where the layout shows it, and is the 2x of that slot
 * where the slot is large enough for the difference to be visible:
 *
 *   actions/<slug>.webp          128 px square, the 64 px card icon at 2x
 *   actions/<slug>-banner.webp   1536 x 864, the quest page banner, 768 px wide at 2x
 *   academy/*.webp               1536 x 864, the lesson illustration, 768 px wide at 2x
 *   items/*.webp                 512 px square, the 240 px market tile at 2x
 *   quests/*.webp                1024 px square, the picture pinned into a quest's metadata
 *   campaigns/*.webp             1024 x 576, the picture pinned into a campaign's metadata
 *
 * The two pinned folders are not served from here by any page: the file is what goes to IPFS, so
 * the committed copy and the pinned bytes are the same bytes and CREDITS.md can point at one file.
 *
 * Every output must come in under EACH_LIMIT and the whole of public/ under TOTAL_LIMIT, and the
 * script fails if either is missed rather than quietly shipping a heavy page.
 */
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../..")
const webRoot = resolve(here, "..")
const SRC = join(webRoot, "art-src")
const PUBLIC = join(webRoot, "public")
const require = createRequire(import.meta.url)

const EACH_LIMIT = 200 * 1024
const TOTAL_LIMIT = 8 * 1024 * 1024
const QUALITY = 82

/** Output size by folder. A predicate picks between the two shapes actions/ holds. */
const RULES = [
  { dir: "actions", match: (name) => name.endsWith("-banner"), width: 1536, height: 864 },
  { dir: "actions", match: () => true, width: 128, height: 128 },
  { dir: "academy", match: () => true, width: 1536, height: 864 },
  { dir: "items", match: () => true, width: 512, height: 512 },
  { dir: "quests", match: () => true, width: 1024, height: 1024 },
  { dir: "campaigns", match: () => true, width: 1024, height: 576 },
]

function loadSharp() {
  try {
    return require("sharp")
  } catch {
    // Hoisted into the pnpm store by Next rather than being a dependency of this package.
    const store = join(repoRoot, "node_modules/.pnpm")
    const entry = readdirSync(store).find((name) => name.startsWith("sharp@"))
    if (!entry) throw new Error("sharp is not in the pnpm store; run pnpm install first")
    return require(join(store, entry, "node_modules/sharp"))
  }
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0).padStart(5)} KB`
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** Every regular file under a directory, recursively, with its size. */
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(path))
    else out.push({ path, size: statSync(path).size })
  }
  return out
}

async function pack() {
  const sharp = loadSharp()
  const written = []
  for (const rule of RULES) {
    const from = join(SRC, rule.dir)
    if (!existsSync(from)) continue
    const to = join(PUBLIC, rule.dir)
    mkdirSync(to, { recursive: true })
    for (const file of readdirSync(from).filter((name) => name.endsWith(".png")).sort()) {
      const name = basename(file, ".png")
      // Candidates that were drawn and not chosen stay masters; pick-art removes them.
      if (/\.c\d+$/.test(name)) continue
      // The first rule whose predicate matches owns the file; later rules for the same folder are
      // skipped so the icon rule cannot repack a banner.
      const owner = RULES.find((r) => r.dir === rule.dir && r.match(name))
      if (owner !== rule) continue

      const target = join(to, `${name}.webp`)
      let quality = QUALITY
      let bytes
      // Start at the house quality and step down only if a file misses the cap. None does today;
      // this is what keeps the promise if a busier picture is ever drawn.
      for (;;) {
        bytes = await sharp(join(from, file))
          .resize(rule.width, rule.height, { fit: "cover", withoutEnlargement: true })
          .webp({ quality, effort: 6 })
          .toBuffer()
        if (bytes.length <= EACH_LIMIT || quality <= 50) break
        quality -= 6
      }
      writeFileSync(target, bytes)
      written.push({ path: target, size: bytes.length, quality, width: rule.width, height: rule.height })
      console.log(
        `${relative(webRoot, target).padEnd(44)} ${String(rule.width).padStart(4)}x${String(rule.height).padEnd(4)} q${quality}  ${kb(bytes.length)}`
      )
    }
  }
  return written
}

function report() {
  const files = walk(PUBLIC)
  const total = files.reduce((sum, f) => sum + f.size, 0)
  const byDir = new Map()
  for (const f of files) {
    const dir = relative(PUBLIC, dirname(f.path)).split("/")[0] || "."
    const entry = byDir.get(dir) ?? { count: 0, size: 0 }
    entry.count += 1
    entry.size += f.size
    byDir.set(dir, entry)
  }

  console.log("\nSize report, apps/web/public")
  for (const [dir, { count, size }] of [...byDir.entries()].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${dir.padEnd(12)} ${String(count).padStart(3)} files  ${mb(size).padStart(9)}`)
  }
  console.log(`  ${"total".padEnd(12)} ${String(files.length).padStart(3)} files  ${mb(total).padStart(9)}  (limit ${mb(TOTAL_LIMIT)})`)

  const generated = files.filter((f) => f.path.endsWith(".webp"))
  const heavy = generated.filter((f) => f.size > EACH_LIMIT)
  const largest = [...generated].sort((a, b) => b.size - a.size)[0]
  if (largest) {
    console.log(
      `  ${generated.length} WebP files, ${mb(generated.reduce((s, f) => s + f.size, 0))}, ` +
        `largest ${relative(PUBLIC, largest.path)} at ${kb(largest.size).trim()} (limit ${kb(EACH_LIMIT).trim()})`
    )
  }

  let failed = false
  for (const f of heavy) {
    console.error(`OVER: ${relative(PUBLIC, f.path)} is ${kb(f.size).trim()}, limit ${kb(EACH_LIMIT).trim()}`)
    failed = true
  }
  if (total > TOTAL_LIMIT) {
    console.error(`OVER: public/ is ${mb(total)}, limit ${mb(TOTAL_LIMIT)}`)
    failed = true
  }
  const strays = files.filter(
    (f) => f.path.endsWith(".png") && RULES.some((r) => f.path.startsWith(join(PUBLIC, r.dir) + "/"))
  )
  for (const f of strays) {
    console.error(`STRAY: ${relative(PUBLIC, f.path)} is a PNG master; it belongs in art-src/`)
    failed = true
  }
  return !failed
}

async function main() {
  if (!process.argv.includes("--report")) {
    if (!existsSync(SRC)) throw new Error(`${SRC} does not exist; the masters are not on this machine`)
    const written = await pack()
    console.log(`\npacked ${written.length} files`)
  }
  if (!report()) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
