import {
  getCampaignById,
  getCampaignParticipant,
  addCampaignParticipant,
  incrementCampaignParticipant,
  updateCampaignStatus,
} from "./dbService"
import { generateQuestFromCampaign } from "./campaignQuestGenerator"
import type { Campaign } from "./dbService"

export async function joinCampaign(
  campaignId: string,
  participantWallet: string
): Promise<{ questIdOnChain: number; deploymentTxHash: string }> {
  const campaign = await getCampaignById(campaignId)
  if (!campaign) {
    throw new Error("Campaign not found")
  }

  if (campaign.status !== "active") {
    throw new Error(`Campaign is not active (status: ${campaign.status})`)
  }

  const existing = await getCampaignParticipant(campaignId, participantWallet)
  if (existing) {
    throw new Error("Already joined this campaign")
  }

  const slotsLeft = campaign.max_participants - campaign.participant_count
  if (slotsLeft <= 0) {
    throw new Error("Campaign is full")
  }

  const result = await generateQuestFromCampaign(
    campaign as Campaign,
    participantWallet
  )

  await addCampaignParticipant(campaignId, participantWallet, result.questIdOnChain)
  await incrementCampaignParticipant(campaignId)

  return {
    questIdOnChain: result.questIdOnChain,
    deploymentTxHash: result.deploymentTxHash,
  }
}

export async function activateCampaign(campaignId: string, escrowTxHash?: string): Promise<void> {
  await updateCampaignStatus(campaignId, "active", {
    ...(escrowTxHash && { escrow_tx_hash: escrowTxHash }),
  })
}
