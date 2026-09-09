import { QuestCadence } from "../attestcoin/store"

/**
 * The one part of a quest Creditcoin does not hold.
 *
 * `metadataURI` is on chain; the document it points at is on IPFS. A card needs a title, so the
 * indexer fetches it once at index time and copies the three fields a page uses into the row.
 * Everything here is best effort: a gateway that is slow, rate-limited, or serving something
 * unexpected must not stop a quest from being indexed, it just leaves the quest showing its id.
 */

const GATEWAY = (process.env.IPFS_GATEWAY_URL ?? "https://ipfs.io/ipfs/").replace(/\/?$/, "/")
const TIMEOUT_MS = 8_000

export interface QuestMetadata {
  title: string
  description: string
  /** From the Cadence attribute the generator pins. Absent for anything else. */
  cadence?: QuestCadence
  /** The pinned banner, as an `ipfs://` URI. Absent when the quest was published without one. */
  image?: string
}

function cadenceOf(attributes: unknown): QuestCadence | undefined {
  if (!Array.isArray(attributes)) return undefined
  for (const attribute of attributes) {
    const trait = (attribute as { trait_type?: unknown })?.trait_type
    if (typeof trait !== "string" || trait.toLowerCase() !== "cadence") continue
    const value = String((attribute as { value?: unknown }).value ?? "").toLowerCase()
    if (value === "daily" || value === "weekly") return value
  }
  return undefined
}

/** Resolve a quest's metadata document, or nothing at all. Never throws. */
export async function fetchQuestMetadata(metadataURI: string): Promise<QuestMetadata | undefined> {
  const uri = metadataURI.trim()
  if (!uri || uri === "ipfs://placeholder") return undefined

  const url = uri.startsWith("ipfs://") ? `${GATEWAY}${uri.slice("ipfs://".length)}` : uri
  if (!/^https?:\/\//.test(url)) return undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return undefined
    const body = (await response.json()) as Record<string, unknown>
    const metadata: QuestMetadata = {
      title: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : "",
    }
    const cadence = cadenceOf(body.attributes)
    if (cadence) metadata.cadence = cadence
    // `banner` is what the Studio writes and `image` is the ERC-721 convention; both are accepted
    // so a quest pinned by either path shows its picture.
    const image = body.banner ?? body.image
    if (typeof image === "string" && image) metadata.image = image
    return metadata
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}
