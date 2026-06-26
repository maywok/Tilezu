export function normalizeGameTitle(title: string): string {
  return title.replace(/\s*\((steam|epic|battle\.net|battle\s*net)\)\s*$/i, '').trim()
}

const ROM_REGION_TOKEN = '(usa|europe|japan|world|asia|korea|australia|france|germany|italy|spain|uk|canada)'
const ROM_TRAILING_REGION_TAG = new RegExp(`\\s*\\(${ROM_REGION_TOKEN}(\\s*,\\s*${ROM_REGION_TOKEN})*\\)\\s*$`, 'i')
const ROM_TRAILING_LANGUAGE_TAG = /\s*\((en|fr|de|es|it|pt|ja|jp|ko|zh|ru)(\s*,\s*(en|fr|de|es|it|pt|ja|jp|ko|zh|ru))*\)\s*$/i
const ROM_TRAILING_REV_TAG = /\s*\(rev(?:ision)?\s*\d+\)\s*$/i
const ROM_TRAILING_VERSION_TAG = /\s*\(v\d+(?:\.\d+){0,2}\)\s*$/i
const ROM_TRAILING_FEATURE_TAG = /\s*\((?:nds|ndsi|dsi)\s+enhanced\)\s*$/i
const ROM_TRAILING_TRACK_TAG = /\s*\(track\s*\d+\)\s*$/i
const ROM_TRAILING_SCENE_TAG = /\s*\[(b|h|t\+\s*[a-z]{2,12})\]\s*$/i
const ROM_TRAILING_NKIT_SUFFIX = /\s*\.nkit\s*$/i

export function cleanRomTitleMetadata(title: string): string {
  let next = normalizeGameTitle(title)

  while (true) {
    const previous = next

    next = next
      .replace(ROM_TRAILING_REGION_TAG, '')
      .replace(ROM_TRAILING_LANGUAGE_TAG, '')
      .replace(ROM_TRAILING_REV_TAG, '')
      .replace(ROM_TRAILING_VERSION_TAG, '')
      .replace(ROM_TRAILING_FEATURE_TAG, '')
      .replace(ROM_TRAILING_TRACK_TAG, '')
      .replace(ROM_TRAILING_SCENE_TAG, '')
      .replace(ROM_TRAILING_NKIT_SUFFIX, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (next === previous) {
      break
    }
  }

  return next
}

export function getFuzzySearchScore(candidate: string, query: string): number {
  const normalizedCandidate = candidate.trim().toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return 1
  }

  if (!normalizedCandidate) {
    return 0
  }

  const directMatchIndex = normalizedCandidate.indexOf(normalizedQuery)
  let score = directMatchIndex >= 0 ? 1200 - directMatchIndex * 8 : 0

  const compactCandidate = normalizedCandidate.replace(/[^a-z0-9]/g, '')
  const compactQuery = normalizedQuery.replace(/[^a-z0-9]/g, '')

  if (!compactQuery) {
    return Math.max(1, score)
  }

  let queryIndex = 0
  let consecutiveMatchCount = 0
  let sequenceScore = 0

  for (let candidateIndex = 0; candidateIndex < compactCandidate.length && queryIndex < compactQuery.length; candidateIndex += 1) {
    const candidateChar = compactCandidate[candidateIndex]
    const queryChar = compactQuery[queryIndex]

    if (candidateChar === queryChar) {
      consecutiveMatchCount += 1
      sequenceScore += 28 + consecutiveMatchCount * 8
      if (candidateIndex < 4) {
        sequenceScore += 10 - candidateIndex * 2
      }
      queryIndex += 1
      continue
    }

    consecutiveMatchCount = 0
    sequenceScore -= 1
  }

  if (queryIndex < compactQuery.length) {
    return 0
  }

  const lengthPenalty = Math.max(0, compactCandidate.length - compactQuery.length) * 1.2
  score += 520 + sequenceScore - lengthPenalty

  return Math.max(1, Math.round(score))
}

export function getJumpLetter(title: string): string {
  const normalized = normalizeGameTitle(title).trim()
  if (!normalized) {
    return '#'
  }

  const firstCharacter = normalized[0].toUpperCase()
  return /[A-Z0-9]/.test(firstCharacter) ? firstCharacter : '#'
}
