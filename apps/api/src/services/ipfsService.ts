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

/** Metadata structure dari IPFS (subset yang dipakai) */
export interface QuestMetadataFromIpfs {
  verificationParams?: QuestVerificationParams
  category?: string
}

interface PinataResponse {
  IpfsHash: string
}

/**
 * Fetch quest metadata dari IPFS. Dipakai untuk ambil verificationParams.
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

