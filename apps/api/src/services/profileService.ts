import { supabase } from "../lib/supabase"
import { generateUserAvatar } from "../utils/avatarGenerator"

/**
 * The player's own details: a display name, an email, an avatar.
 *
 * This is the only player-facing state Vael keeps off chain, because it is the only part the chain
 * has no opinion about. Everything a quest, a hero, a badge, or a reward is worth comes from
 * Creditcoin; nothing here gates anything, and a wiped row costs a name.
 */

export interface User {
  id: string
  wallet_address: string
  name?: string
  email?: string
  avatar_url?: string
  created_at?: string
}

export async function getOrCreateUser(walletAddress: string): Promise<User> {
  const address = walletAddress.toLowerCase()

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", address)
    .maybeSingle()
  if (existing) return existing as User

  const { data: created, error } = await supabase
    .from("users")
    .insert({ wallet_address: address })
    .select()
    .single()
  if (error || !created) throw new Error(`Failed to create user: ${error?.message}`)
  return created as User
}

export async function saveProfile(
  walletAddress: string,
  profile: { name: string; email: string; avatar_url?: string }
): Promise<User> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new Error("Invalid email format")
  if (!profile.name || profile.name.trim().length === 0) throw new Error("Name is required")

  const existing = await getOrCreateUser(walletAddress)
  // A generated avatar is a fallback, never an overwrite: a player who has picked one keeps it.
  const avatarUrl =
    profile.avatar_url ?? existing.avatar_url ?? generateUserAvatar(walletAddress)

  const { data, error } = await supabase
    .from("users")
    .update({
      name: profile.name.trim(),
      email: profile.email.trim().toLowerCase(),
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_address", walletAddress.toLowerCase())
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to save profile: ${error?.message ?? "unknown error"}`)
  return data as User
}

export async function updateAvatar(walletAddress: string, avatarUrl: string): Promise<User> {
  await getOrCreateUser(walletAddress)
  const { data, error } = await supabase
    .from("users")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("wallet_address", walletAddress.toLowerCase())
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to update avatar: ${error?.message ?? "unknown error"}`)
  return data as User
}
