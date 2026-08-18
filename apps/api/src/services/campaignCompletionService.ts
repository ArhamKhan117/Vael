/**
 * Handle campaign-related logic when a quest is completed.
 * - Release USDC from CampaignEscrow (if deployed)
 * - Increment campaign claimed_count
 * - Mark campaign completed if full
 */

import {
  getCampaignByQuestId,
  getCampaignParticipantByQuestId,
  incrementCampaignClaimed,
  markCampaignParticipantUsdcReleased,
} from "./dbService"
import { releaseCampaignReward } from "./campaignEscrowService"
import { campaignEscrowAddress } from "../lib/contracts"

export async function onCampaignQuestCompleted(
  questIdOnChain: number,
  participantWallet: string
): Promise<void> {
  const campaign = await getCampaignByQuestId(questIdOnChain)
  if (!campaign) return

  const cp = await getCampaignParticipantByQuestId(questIdOnChain)
  if (!cp || cp.usdc_released) return

  if (campaignEscrowAddress) {
    try {
      await releaseCampaignReward(
        campaign.id,
        participantWallet,
        campaign.reward_per_quest_usdc
      )
      console.log(
        `[CAMPAIGN] Released ${campaign.reward_per_quest_usdc} USDC to ${participantWallet} for quest ${questIdOnChain}`
      )
    } catch (err: unknown) {
      console.error("[CAMPAIGN] USDC release failed:", (err as Error)?.message ?? err)
      // Don't mark usdc_released so we can retry
      return
    }
  } else {
    console.log(
      `[CAMPAIGN] Quest ${questIdOnChain} completed. USDC release skipped (CAMPAIGN_ESCROW_ADDRESS not set)`
    )
  }

  await markCampaignParticipantUsdcReleased(campaign.id, participantWallet)
  await incrementCampaignClaimed(campaign.id)
}
