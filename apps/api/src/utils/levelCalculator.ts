/**
 * Calculate user level based on total XP
 * Formula: level = floor(total_xp / 5000) + 1
 * 
 * Examples:
 * - 0-4,999 XP = Level 1
 * - 5,000-9,999 XP = Level 2
 * - 10,000-14,999 XP = Level 3
 * - etc.
 */
export function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / 5000) + 1
}

/**
 * Calculate XP required for next level
 * Returns the minimum XP needed to reach the next level
 */
export function getXpForNextLevel(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp)
  const nextLevel = currentLevel + 1
  return (nextLevel - 1) * 5000
}

/**
 * Calculate XP needed to reach next level
 * Returns how much more XP the user needs to level up
 */
export function getXpNeededForNextLevel(currentXp: number): number {
  const xpForNextLevel = getXpForNextLevel(currentXp)
  return Math.max(0, xpForNextLevel - currentXp)
}

/**
 * Calculate progress percentage to next level (0-100)
 */
export function getProgressToNextLevel(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp)
  const xpForCurrentLevel = (currentLevel - 1) * 5000
  const xpForNextLevel = currentLevel * 5000
  const xpInCurrentLevel = currentXp - xpForCurrentLevel
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel
  
  if (xpNeededForLevel === 0) return 100
  return Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForLevel) * 100))
}

