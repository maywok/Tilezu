import type { ClaimAllGameTokensResult, ClaimGameTokenResult } from '../launcher/hooks/useKeychainAttachments'

type ClaimFeedbackCatalog = {
  gardenThemes: Array<{ id: string; name: string }>
  rangePerks: Array<{ id: string; name: string }>
  rangeCosmetics: Array<{ id: string; name: string }>
  rangeToyCatalog: Array<{ id: string; name: string }>
}

export function buildClaimFeedbackFromResult(
  claimResult: ClaimGameTokenResult | ClaimAllGameTokensResult,
  catalog: ClaimFeedbackCatalog,
): string {
  const segments: string[] = []

  if (claimResult.claimedTokens > 0) {
    segments.push(`Claimed ${claimResult.claimedTokens} token${claimResult.claimedTokens === 1 ? '' : 's'}.`)
  }

  const unlockedThemeNames = claimResult.newlyUnlockedGardenThemeIds
    .map((themeId) => catalog.gardenThemes.find((theme) => theme.id === themeId)?.name ?? themeId)
  if (unlockedThemeNames.length > 0) {
    segments.push(`Garden theme unlocked: ${unlockedThemeNames.join(', ')}.`)
  }

  const unlockedPerkNames = claimResult.newlyUnlockedRangePerkIds
    .map((perkId) => catalog.rangePerks.find((perk) => perk.id === perkId)?.name ?? perkId)
  if (unlockedPerkNames.length > 0) {
    segments.push(`Range perk unlocked: ${unlockedPerkNames.join(', ')}.`)
  }

  const unlockedCosmeticNames = claimResult.newlyUnlockedRangeCosmeticIds
    .map((cosmeticId) => catalog.rangeCosmetics.find((entry) => entry.id === cosmeticId)?.name ?? cosmeticId)
  if (unlockedCosmeticNames.length > 0) {
    segments.push(`Range cosmetic unlocked: ${unlockedCosmeticNames.join(', ')}.`)
  }

  const unlockedToyNames = claimResult.newlyUnlockedRangeToyIds
    .map((toyId) => catalog.rangeToyCatalog.find((entry) => entry.id === toyId)?.name ?? toyId)
  if (unlockedToyNames.length > 0) {
    segments.push(`Range toy unlocked: ${unlockedToyNames.join(', ')}.`)
  }

  if (claimResult.newlyUnlockedRangeTierIds.includes('v2')) {
    segments.push('Range V2 unlocked: expanded toy systems are now active.')
  }

  if (claimResult.newlyUnlockedRangeTierIds.includes('v3')) {
    segments.push('Range V3 unlocked: full needs-and-toys loop is now active.')
  }

  if (claimResult.awardedRangeProgressionPoints > 0) {
    segments.push(`Range +${claimResult.awardedRangeProgressionPoints} pts.`)
  }

  if ('gamesClaimed' in claimResult && claimResult.gamesClaimed > 1 && claimResult.claimedTokens > 0) {
    segments.unshift(`Collected from ${claimResult.gamesClaimed} games.`)
  }

  return segments.join(' ')
}