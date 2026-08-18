/**
 * Generate avatar URL using DiceBear API
 * Free API, no API key required
 * https://www.dicebear.com/
 */
export function generateAvatarUrl(seed: string, style: "avataaars" | "lorelei" | "micah" | "miniavs" = "avataaars"): string {
  // Use seed (e.g., wallet address) to generate consistent avatar
  // Clean seed to ensure valid URL
  const cleanSeed = seed.toLowerCase().replace(/[^a-z0-9]/g, "")
  
  // DiceBear API v7 - free, no API key needed
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${cleanSeed}&size=256&radius=50`
}

/**
 * Generate avatar for user based on wallet address
 */
export function generateUserAvatar(walletAddress: string): string {
  // Use wallet address as seed for consistent avatar generation
  // Style: avataaars (classic avatar style)
  return generateAvatarUrl(walletAddress, "avataaars")
}

