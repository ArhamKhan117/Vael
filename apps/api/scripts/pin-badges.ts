/**
 * Pin the ten badge images and their metadata to IPFS through Pinata.
 *
 *   pnpm --filter @vael/api pin-badges
 *
 * Each image is pinned first, then a metadata document that points at it, so the token URI a badge
 * carries resolves to a real document with a real picture rather than to `ipfs://placeholder`.
 *
 * The result is written to `apps/api/scripts/badge-cids.json`, which is committed: the CIDs are
 * what `setBadgeURI` is called with, and losing them would mean re-pinning and re-wiring for no
 * reason. Re-running is safe. IPFS is content addressed, so identical bytes pin to the same CID.
 */
import "dotenv/config"

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const PIN_FILE = "https://api.pinata.cloud/pinning/pinFileToIPFS"
const PIN_JSON = "https://api.pinata.cloud/pinning/pinJSONToIPFS"

const REPO_ROOT = join(__dirname, "../../..")
const BADGE_DIR = join(REPO_ROOT, "apps/web/public/badges")
const OUT = join(__dirname, "badge-cids.json")

/** Mirrors BadgeNFT v3's rarityForBadgeLevel: 1 Common through 5 and above, Legendary. */
const RARITY = ["Common", "Uncommon", "Rare", "Epic", "Legendary"]
const rarityForLevel = (level: number) => RARITY[level >= 5 ? 4 : level - 1]

const BADGES = [
  { level: 1, name: "Initiate", blurb: "Awarded for a first action Creditcoin verified." },
  { level: 2, name: "Apprentice", blurb: "Awarded for proving a second protocol." },
  { level: 3, name: "Adept", blurb: "Awarded for steady, verified activity." },
  { level: 4, name: "Veteran", blurb: "Awarded for going deep into the quest board." },
  { level: 5, name: "Champion", blurb: "Awarded for a season's worth of proofs." },
  { level: 6, name: "Warden", blurb: "Awarded for holding the line on a raid." },
  { level: 7, name: "Sentinel", blurb: "Awarded for striking a season boss down." },
  { level: 8, name: "Archon", blurb: "Awarded for mastery of every action type." },
  { level: 9, name: "Paragon", blurb: "Rarely awarded." },
  { level: 10, name: "Ascendant", blurb: "The highest badge Vael issues." },
]

function jwt(): string {
  const token = process.env.PINATA_JWT
  if (!token) throw new Error("PINATA_JWT is not set")
  return token
}

async function pinFile(path: string, name: string): Promise<string> {
  const body = new FormData()
  body.append("file", new Blob([new Uint8Array(readFileSync(path))], { type: "image/png" }), name)
  body.append("pinataMetadata", JSON.stringify({ name }))

  const response = await fetch(PIN_FILE, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt()}` },
    body,
  })
  if (!response.ok) throw new Error(`pin ${name} failed: ${response.status} ${await response.text()}`)
  return ((await response.json()) as { IpfsHash: string }).IpfsHash
}

async function pinJson(content: unknown, name: string): Promise<string> {
  const response = await fetch(PIN_JSON, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt()}` },
    body: JSON.stringify({ pinataMetadata: { name }, pinataContent: content }),
  })
  if (!response.ok) throw new Error(`pin ${name} failed: ${response.status} ${await response.text()}`)
  return ((await response.json()) as { IpfsHash: string }).IpfsHash
}

async function main() {
  const records: Record<string, unknown>[] = []

  for (const badge of BADGES) {
    const rarity = rarityForLevel(badge.level)
    const imageCid = await pinFile(join(BADGE_DIR, `level-${badge.level}.png`), `vael-badge-${badge.level}.png`)

    const metadata = {
      name: `Vael Quest Badge: ${badge.name}`,
      description:
        `${badge.blurb} Vael badges are minted only by QuestASC, after it verifies an Attestcoin ` +
        "proof of an action on Ethereum. No backend key can issue one.",
      image: `ipfs://${imageCid}`,
      // No external_url: there is no published site or repository to point at yet, and inventing
      // one would put a dead link inside every badge's permanent metadata.
      attributes: [
        { trait_type: "Rarity", value: rarity },
        { trait_type: "Badge level", value: badge.level },
        { trait_type: "Collection", value: "Vael Quest Badges" },
      ],
    }

    const metadataCid = await pinJson(metadata, `vael-badge-${badge.level}.json`)
    records.push({ level: badge.level, name: badge.name, rarity, imageCid, metadataCid })
    console.log(`level ${badge.level} ${badge.name.padEnd(11)} image ${imageCid}  metadata ${metadataCid}`)
  }

  writeFileSync(OUT, `${JSON.stringify({ badges: records }, null, 2)}\n`)
  console.log(`\nwrote ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
