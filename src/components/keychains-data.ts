import alienBumpSheet from '../assets/rungo/alien/alienBump.png'
import alienFallSheet from '../assets/rungo/alien/alienFall.png'
import alienIdleSheet from '../assets/rungo/alien/alienIdle.png'
import alienRunSheet from '../assets/rungo/alien/alienRun.png'
import alienSitSheet from '../assets/rungo/alien/alienSit.png'
import baseBumpSheet from '../assets/rungo/base/RungoBump.png'
import baseFallSheet from '../assets/rungo/base/RungoFall.png'
import baseIdleSheet from '../assets/rungo/base/RungoIdle.png'
import baseRunSheet from '../assets/rungo/base/RungoRun.png'
import baseSitSheet from '../assets/rungo/base/RungoSit.png'
import blackCatBumpSheet from '../assets/rungo/black cat/bcBump.png'
import blackCatFallSheet from '../assets/rungo/black cat/bcFall.png'
import blackCatIdleSheet from '../assets/rungo/black cat/bcIdle.png'
import blackCatRunSheet from '../assets/rungo/black cat/bcRun.png'
import blackCatSitSheet from '../assets/rungo/black cat/bcSit.png'
import bluehatBumpSheet from '../assets/rungo/bluehat/hatBump.png'
import bluehatFallSheet from '../assets/rungo/bluehat/hatFall.png'
import bluehatIdleSheet from '../assets/rungo/bluehat/hatIdle.png'
import bluehatRunSheet from '../assets/rungo/bluehat/hatRun.png'
import bluehatSitSheet from '../assets/rungo/bluehat/hatSit.png'
import calicoCatBumpSheet from '../assets/rungo/calico cat/ccBump.png'
import calicoCatFallSheet from '../assets/rungo/calico cat/ccFall.png'
import calicoCatIdleSheet from '../assets/rungo/calico cat/ccIdle.png'
import calicoCatRunSheet from '../assets/rungo/calico cat/ccRun.png'
import calicoCatSitSheet from '../assets/rungo/calico cat/ccSit.png'
import funnyOneBumpSheet from '../assets/rungo/funny one/f1Bump.png'
import funnyOneFallSheet from '../assets/rungo/funny one/f1Fall.png'
import funnyOneIdleSheet from '../assets/rungo/funny one/f1Idle.png'
import funnyOneRunSheet from '../assets/rungo/funny one/f1Run.png'
import funnyOneSitSheet from '../assets/rungo/funny one/f1Sit.png'
import pinkhatBumpSheet from '../assets/rungo/pinkhat/pinkhatBump.png'
import pinkhatFallSheet from '../assets/rungo/pinkhat/pinkhatFall.png'
import pinkhatIdleSheet from '../assets/rungo/pinkhat/pinkhatIdle.png'
import pinkhatRunSheet from '../assets/rungo/pinkhat/pinkhatRun.png'
import pinkhatSitSheet from '../assets/rungo/pinkhat/pinkhatSit.png'
import purpleDudeBumpSheet from '../assets/rungo/purple dude/purpleBump.png'
import purpleDudeFallSheet from '../assets/rungo/purple dude/purpleFall.png'
import purpleDudeIdleSheet from '../assets/rungo/purple dude/purpleIdle.png'
import purpleDudeRunSheet from '../assets/rungo/purple dude/purpleRun.png'
import purpleDudeSitSheet from '../assets/rungo/purple dude/purpleSit.png'
import sunglassesBumpSheet from '../assets/rungo/sunglasses/sunglassesBump.png'
import sunglassesFallSheet from '../assets/rungo/sunglasses/sunglassesFall.png'
import sunglassesIdleSheet from '../assets/rungo/sunglasses/sunglassesIdle.png'
import sunglassesRunSheet from '../assets/rungo/sunglasses/sunglassesRun.png'
import sunglassesSitSheet from '../assets/rungo/sunglasses/sunglassesSit.png'
import greenhatBumpSheet from '../assets/rungo/greenhat/greenhatBump.png'
import greenhatFallSheet from '../assets/rungo/greenhat/greenhatFall.png'
import greenhatIdleSheet from '../assets/rungo/greenhat/greenhatIdle.png'
import greenhatRunSheet from '../assets/rungo/greenhat/greenhatRun.png'
import greenhatSitSheet from '../assets/rungo/greenhat/greenhatSit.png'
import lifeguardBumpSheet from '../assets/rungo/lifeguard/lifeguardBump.png'
import lifeguardFallSheet from '../assets/rungo/lifeguard/lifeguardFall.png'
import lifeguardIdleSheet from '../assets/rungo/lifeguard/lifeguardIdle.png'
import lifeguardRunSheet from '../assets/rungo/lifeguard/lifeguardRun.png'
import lifeguardSitSheet from '../assets/rungo/lifeguard/lifeguardSit.png'
import orangeCatBumpSheet from '../assets/rungo/orange cat/ocBump.png'
import orangeCatFallSheet from '../assets/rungo/orange cat/ocFall.png'
import orangeCatIdleSheet from '../assets/rungo/orange cat/ocIdle.png'
import orangeCatRunSheet from '../assets/rungo/orange cat/ocRun.png'
import orangeCatSitSheet from '../assets/rungo/orange cat/ocSit.png'
import reflexBumpSheet from '../assets/rungo/reflex/reflexBump.png'
import reflexFallSheet from '../assets/rungo/reflex/reflexFall.png'
import reflexIdleSheet from '../assets/rungo/reflex/reflexIdle.png'
import reflexRunSheet from '../assets/rungo/reflex/reflexRun.png'
import reflexSitSheet from '../assets/rungo/reflex/reflexSit.png'
import talentedLearnerBumpSheet from '../assets/rungo/talented learner/tlBump.png'
import talentedLearnerFallSheet from '../assets/rungo/talented learner/tlFall.png'
import talentedLearnerIdleSheet from '../assets/rungo/talented learner/tlIdle.png'
import talentedLearnerRunSheet from '../assets/rungo/talented learner/tlRun.png'
import talentedLearnerSitSheet from '../assets/rungo/talented learner/tlSit.png'
import tvBumpSheet from '../assets/rungo/tv/tvBump.png'
import tvFallSheet from '../assets/rungo/tv/tvFall.png'
import tvIdleSheet from '../assets/rungo/tv/tvIdle.png'
import tvRunSheet from '../assets/rungo/tv/tvRun.png'
import tvSitSheet from '../assets/rungo/tv/tvSit.png'

export type KeychainAnimationState = 'running' | 'idle' | 'sit' | 'bump' | 'fall'

export type KeychainSpriteState = {
  sheetUrl: string
  frameSizePx: number
  frameCount: number
  frameDurationMs: number
  loop: boolean
}

export interface Keychain {
  id: string
  name: string
  description: string
  rarityWeight: number
  unlockHint: string
  previewSheetUrl: string
  isSpawnEligible: boolean
  sprites?: Record<KeychainAnimationState, KeychainSpriteState>
}

function buildSpriteStates(
  runSheet: string,
  idleSheet: string,
  sitSheet: string,
  bumpSheet: string,
  fallSheet: string,
  frameSizePx: number,
  sitFrameCount = 8,
  fallFrameCount = 6,
): Record<KeychainAnimationState, KeychainSpriteState> {
  return {
    running: {
      sheetUrl: runSheet,
      frameSizePx,
      frameCount: 6,
      frameDurationMs: 60,
      loop: true,
    },
    idle: {
      sheetUrl: idleSheet,
      frameSizePx,
      frameCount: 3,
      frameDurationMs: 160,
      loop: true,
    },
    sit: {
      sheetUrl: sitSheet,
      frameSizePx,
      frameCount: sitFrameCount,
      frameDurationMs: 180,
      loop: true,
    },
    bump: {
      sheetUrl: bumpSheet,
      frameSizePx,
      frameCount: 1,
      frameDurationMs: 100,
      loop: false,
    },
    fall: {
      sheetUrl: fallSheet,
      frameSizePx,
      frameCount: fallFrameCount,
      frameDurationMs: 100,
      loop: false,
    },
  }
}

export const RUNGO_UNLOCKED_DEFAULT_IDS = ['base']

export const ownedKeychains: Keychain[] = [
  {
    id: 'base',
    name: 'Base Rungo',
    description: 'Booooooriing!',
    rarityWeight: 6,
    unlockHint: 'Starter unlocked by default.',
    previewSheetUrl: baseIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(baseRunSheet, baseIdleSheet, baseSitSheet, baseBumpSheet, baseFallSheet, 16),
  },
  {
    id: 'alien',
    name: 'Alien Rungo',
    description: 'Bogos Binted?',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: alienIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(alienRunSheet, alienIdleSheet, alienSitSheet, alienBumpSheet, alienFallSheet, 32),
  },
  {
    id: 'bluehat',
    name: 'Blue Hat Rungo',
    description: 'Wearing blue makes them think theyre better than everyone else',
    rarityWeight: 3,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: bluehatIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(bluehatRunSheet, bluehatIdleSheet, bluehatSitSheet, bluehatBumpSheet, bluehatFallSheet, 32),
  },
  {
    id: 'pinkhat',
    name: 'Pink Hat Rungo',
    description: 'Wearing pink makes them think theyre better than everyone else',
    rarityWeight: 3,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: pinkhatIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(pinkhatRunSheet, pinkhatIdleSheet, pinkhatSitSheet, pinkhatBumpSheet, pinkhatFallSheet, 32),
  },
  {
    id: 'greenhat',
    name: 'Green Hat Rungo',
    description: 'Wearing green makes them think theyre better than everyone else',
    rarityWeight: 1,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: greenhatIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(greenhatRunSheet, greenhatIdleSheet, greenhatSitSheet, greenhatBumpSheet, greenhatFallSheet, 32),
  },
  {
    id: 'purple-dude',
    name: 'Purple Dude',
    description: 'I don\'t know what I was thinking, leaving my child behind Now I suffer the curse, and now I am blind.',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: purpleDudeIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      purpleDudeRunSheet,
      purpleDudeIdleSheet,
      purpleDudeSitSheet,
      purpleDudeBumpSheet,
      purpleDudeFallSheet,
      32,
    ),
  },
  {
    id: 'sunglasses',
    name: 'Sunglesses Rungo',
    description: 'So cool she dosent even take em off inside',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: sunglassesIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      sunglassesRunSheet,
      sunglassesIdleSheet,
      sunglassesSitSheet,
      sunglassesBumpSheet,
      sunglassesFallSheet,
      32,
    ),
  },
  {
    id: 'reflex',
    name: 'Cosmic Rocker',
    description: 'Richie C approved!',
    rarityWeight: 1,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: reflexIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(reflexRunSheet, reflexIdleSheet, reflexSitSheet, reflexBumpSheet, reflexFallSheet, 32),
  },
  {
    id: 'lifeguard',
    name: 'Lifeguard Rungo',
    description: 'Much harder than it looks',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: lifeguardIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      lifeguardRunSheet,
      lifeguardIdleSheet,
      lifeguardSitSheet,
      lifeguardBumpSheet,
      lifeguardFallSheet,
      32,
    ),
  },
  {
    id: 'talented-learner',
    name: 'Talented Learner',
    description: 'MOVE IT!',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: talentedLearnerIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      talentedLearnerRunSheet,
      talentedLearnerIdleSheet,
      talentedLearnerSitSheet,
      talentedLearnerBumpSheet,
      talentedLearnerFallSheet,
      32,
    ),
  },
  {
    id: 'tv',
    name: 'Mr. TV Head Man',
    description: 'Unfortunatly we have to censor almost every word he says',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: tvIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      tvRunSheet,
      tvIdleSheet,
      tvSitSheet,
      tvBumpSheet,
      tvFallSheet,
      32,
      8,
      8,
    ),
  },
  {
    id: 'orange-cat',
    name: 'Orange Cat',
    description: 'Does anyone actually know what breed orange cats are?',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: orangeCatIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      orangeCatRunSheet,
      orangeCatIdleSheet,
      orangeCatSitSheet,
      orangeCatBumpSheet,
      orangeCatFallSheet,
      32,
      7,
    ),
  },
  {
    id: 'black-cat',
    name: 'Black Cat',
    description: 'Black cat are scientificaly proven to be good luck',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: blackCatIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      blackCatRunSheet,
      blackCatIdleSheet,
      blackCatSitSheet,
      blackCatBumpSheet,
      blackCatFallSheet,
      32,
      7,
    ),
  },
  {
    id: 'calico-cat',
    name: 'Calico Cat',
    description: 'I feel like every calico cat is named Sushi',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: calicoCatIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      calicoCatRunSheet,
      calicoCatIdleSheet,
      calicoCatSitSheet,
      calicoCatBumpSheet,
      calicoCatFallSheet,
      32,
      7,
    ),
  },
  {
    id: 'funny-bunny',
    name: 'Funny Bunny',
    description: 'That\'s what the mask is That\'s what the point of the mask is',
    rarityWeight: 2,
    unlockHint: 'Can roll from milestone unlocks.',
    previewSheetUrl: funnyOneIdleSheet,
    isSpawnEligible: true,
    sprites: buildSpriteStates(
      funnyOneRunSheet,
      funnyOneIdleSheet,
      funnyOneSitSheet,
      funnyOneBumpSheet,
      funnyOneFallSheet,
      32,
    ),
  },
]

export function getKeychainById(id: string): Keychain | undefined {
  return ownedKeychains.find((entry) => entry.id === id)
}
