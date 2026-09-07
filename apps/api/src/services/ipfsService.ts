import { serviceEnv } from "../config/env"

const PINATA_JSON_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS"

function ipfsToHttp(ipfsUri: string): string {
  if (!ipfsUri) return ""
  if (ipfsUri.startsWith("ipfs://")) {
    const cid = ipfsUri.replace("ipfs://", "")
    return `https://ipfs.io/ipfs/${cid}`
  }
  return ipfsUri
}

/** Verification params from quest metadata (IPFS) */
export interface QuestVerificationParams {
  tokenIn?: string
  tokenOut?: string
  minAmountIn?: number
  minAmountOut?: number
  minTokenAmount?: number
  tokenIdForMinAmount?: string
  tokenIds?: string[]
  actionType?: "swap" | "deposit" | "borrow" | "stake"
}

/** IPFS metadata, the subset this service reads. */
export interface QuestMetadataFromIpfs {
  verificationParams?: QuestVerificationParams
  category?: string
}

interface PinataResponse {
  IpfsHash: string
}

/**
 * Fetch quest metadata from IPFS. Used to read back verificationParams.
 */
export async function fetchQuestMetadataFromIpfs(
  metadataUri: string | null | undefined
): Promise<QuestMetadataFromIpfs | null> {
  if (!metadataUri?.trim()) return null
  try {
    const url = ipfsToHttp(metadataUri.trim())
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = (await res.json()) as QuestMetadataFromIpfs
    return json
  } catch {
    return null
  }
}

export async function uploadQuestMetadata(metadata: unknown, name: string) {
  const response = await fetch(PINATA_JSON_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceEnv().PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataMetadata: {
        name,
      },
      pinataContent: metadata,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Pinata upload failed: ${response.status} ${errorText}`)
  }

  const json = (await response.json()) as PinataResponse
  return `ipfs://${json.IpfsHash}`
}


const PINATA_FILE_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS"

/** What a quest banner may be. Anything else is refused rather than pinned and left broken. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
export const MAX_IMAGE_BYTES = 1024 * 1024

export class ImageRejected extends Error {}

/**
 * Pin an image and return its `ipfs://` URI.
 *
 * The type and the size are checked here rather than at the route, so every caller gets the same
 * rule. A 40 MB upload pinned successfully is still a quest card that never loads.
 */
export async function uploadImage(bytes: Buffer, contentType: string, name: string) {
  if (!(IMAGE_TYPES as readonly string[]).includes(contentType)) {
    throw new ImageRejected(`unsupported image type ${contentType}`)
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageRejected(`image is ${bytes.byteLength} bytes, over the ${MAX_IMAGE_BYTES} limit`)
  }

  const form = new FormData()
  const extension = contentType.split("/")[1]
  form.append("file", new Blob([new Uint8Array(bytes)], { type: contentType }), `${name}.${extension}`)
  form.append("pinataMetadata", JSON.stringify({ name }))

  const response = await fetch(PINATA_FILE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceEnv().PINATA_JWT}` },
    body: form,
  })
  if (!response.ok) {
    throw new Error(`Pinata image upload failed: ${response.status} ${await response.text()}`)
  }
  const json = (await response.json()) as PinataResponse
  return `ipfs://${json.IpfsHash}`
}

/**
 * Decode a `data:` URL into bytes and a content type.
 *
 * The browser sends the picked file this way rather than as multipart: the API takes JSON
 * everywhere else, and one 2 MB base64 body is a far smaller change than a multipart parser and a
 * second body-parsing path to keep in step with it.
 */
export function decodeDataUrl(value: string): { bytes: Buffer; contentType: string } {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(value.trim())
  if (!match) throw new ImageRejected("expected a base64 data URL")
  const bytes = Buffer.from(match[2]!, "base64")
  if (bytes.byteLength === 0) throw new ImageRejected("image is empty")
  return { bytes, contentType: match[1]! }
}
