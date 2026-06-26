import type { Keychain } from '../../../components/keychains-data'

export type RungoRarityTier = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical'

export const RUNGO_RARITY_TIER_BY_ID: Readonly<Record<string, RungoRarityTier>> = {
  'talented-learner': 'legendary',
  reflex: 'legendary',
  'purple-dude': 'legendary',
  tv: 'mythical',
  'funny-bunny': 'mythical',
  'orange-cat': 'rare',
  'black-cat': 'rare',
  'calico-cat': 'rare',
  lifeguard: 'rare',
  alien: 'rare',
  bluehat: 'uncommon',
  pinkhat: 'uncommon',
  greenhat: 'uncommon',
  sunglasses: 'uncommon',
}

export function resolveRungoRarityTier(keychain: Keychain): RungoRarityTier {
  return RUNGO_RARITY_TIER_BY_ID[keychain.id] ?? 'common'
}

export function resolveRungoTierLabel(tier: RungoRarityTier): string {
  if (tier === 'mythical') {
    return 'Mythical'
  }

  if (tier === 'legendary') {
    return 'Legendary'
  }

  if (tier === 'rare') {
    return 'Rare'
  }

  if (tier === 'uncommon') {
    return 'Uncommon'
  }

  return 'Common'
}

export const RUNGO_TIER_ODDS_LABEL = 'Weighted by catalog rarity; duplicates grant Range seeds.'
