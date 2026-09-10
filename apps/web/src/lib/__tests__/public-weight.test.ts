import { readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"

import itemCatalogue from "@/content/items.json"

/**
 * What the site ships under public/ is a budget, not a folder.
 *
 * milestone 11 committed forty-eight generated PNGs at about 1.4 MB each, and a visitor's browser was
 * asked to pull a megabyte to draw a 64 px icon. The packed WebPs replaced them, and these are the
 * numbers that stop it happening again: every generated picture under 200 KB, the whole folder
 * under 8 MB, and no PNG master left behind in a folder pack-art owns.
 */
const PUBLIC = resolve(__dirname, "../../../public")
const PACKED = ["actions", "academy", "items", "quests", "campaigns"]
const EACH_LIMIT = 200 * 1024
const TOTAL_LIMIT = 8 * 1024 * 1024

function walk(dir: string): { path: string; size: number }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [{ path, size: statSync(path).size }]
  })
}

describe("public/ weight", () => {
  const files = walk(PUBLIC)

  it("keeps the whole folder under 8 MB", () => {
    const total = files.reduce((sum, file) => sum + file.size, 0)
    expect(total, `public/ is ${(total / 1024 / 1024).toFixed(2)} MB`).toBeLessThanOrEqual(TOTAL_LIMIT)
  })

  it("keeps every packed picture under 200 KB", () => {
    const heavy = files
      .filter((file) => file.path.endsWith(".webp") && file.size > EACH_LIMIT)
      .map((file) => `${relative(PUBLIC, file.path)} ${(file.size / 1024).toFixed(0)} KB`)
    expect(heavy).toEqual([])
  })

  it("leaves no PNG master in a folder pack-art owns", () => {
    const strays = files
      .filter((file) => file.path.endsWith(".png"))
      .map((file) => relative(PUBLIC, file.path))
      .filter((path) => PACKED.includes(path.split("/")[0] ?? ""))
    expect(strays).toEqual([])
  })

  // The action art and the loot catalogue are the two places a picture is referenced by a path the
  // code builds, so a rename in pack-art with no rename here would be a broken image, not an error.
  it("has a packed file for every action icon, banner, and loot item", () => {
    const slugs = [
      "portal",
      "uniswap-swap",
      "erc20-transfer",
      "aave-supply",
      "aave-borrow",
      "penguinswap-swap",
      "wrap-native",
    ]
    const expected = [
      ...slugs.map((slug) => `actions/${slug}.webp`),
      ...slugs.map((slug) => `actions/${slug}-banner.webp`),
      ...itemCatalogue.items.map((item) => item.image.replace(/^\//, "")),
    ]
    const present = new Set(files.map((file) => relative(PUBLIC, file.path)))
    expect(expected.filter((path) => !present.has(path))).toEqual([])
  })
})
