const submissionMap = new Map<string, Set<string>>()

function getQuestKey(questId: number) {
  return questId.toString()
}

export function hasSubmission(questId: number, txHash: string) {
  const key = getQuestKey(questId)
  const normalizedHash = txHash.toLowerCase()
  return submissionMap.get(key)?.has(normalizedHash) ?? false
}

export function saveSubmission(questId: number, txHash: string) {
  const key = getQuestKey(questId)
  const normalizedHash = txHash.toLowerCase()
  if (!submissionMap.has(key)) {
    submissionMap.set(key, new Set())
  }
  submissionMap.get(key)?.add(normalizedHash)
}

