const DEFAULT_IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs/"

export interface QuestMetadataStep {
  title: string
  description: string
}

export interface QuestMetadataParameters {
  actionPlan?: string
  successCriteria?: string
  evidenceHint?: string
}

export interface QuestMetadataReward {
  token?: string
  amount?: string
  badgeLevel?: number
}

export interface QuestMetadataCampaignReward {
  token?: string
  amount?: string
}

export interface QuestMetadata {
  title?: string
  summary?: string
  projectName?: string
  chain?: string
  goal?: string
  category?: string
  difficulty?: string
  requirements?: string[]
  steps?: QuestMetadataStep[]
  parameters?: QuestMetadataParameters
  reward?: QuestMetadataReward
  campaignReward?: QuestMetadataCampaignReward
  participant?: string
  extraNotes?: string
  metadataSnippet?: string
  banner?: string
  verificationParams?: {
    minAmount?: number
    tokenIds?: string[]
    actionType?: string
  }
}

export function ipfsToHttp(uri: string) {
  if (!uri.startsWith("ipfs://")) return uri
  const path = uri.replace("ipfs://", "")
  return `${DEFAULT_IPFS_GATEWAY}${path}`
}

/**
 * The original stand-in, still on chain for any quest created before metadata was pinned. It is not
 * a CID, so asking a gateway for it returns 400 and a CORS error in the console rather than a
 * document. The caller falls back to what the chain itself says about the quest.
 */
export const PLACEHOLDER_METADATA_URI = "ipfs://placeholder"

export async function fetchIPFSMetadata(uri: string): Promise<QuestMetadata> {
  if (uri.trim() === PLACEHOLDER_METADATA_URI) {
    throw new Error("this quest has no pinned metadata")
  }
  const url = ipfsToHttp(uri)
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to load metadata (${response.status})`)
  }
  return response.json()
}
