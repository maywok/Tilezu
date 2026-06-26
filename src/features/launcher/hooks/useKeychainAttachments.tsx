import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { RUNGO_UNLOCKED_DEFAULT_IDS, getKeychainById, ownedKeychains } from '../../../components/keychains-data'

export type KeychainAttachmentsMap = Record<string, string>

const KNOWN_RUNGO_IDS = new Set(ownedKeychains.map((entry) => entry.id))

type RungoMilestoneRoll = {
  milestone: number
  roll: number
  chance: number
  awardedRungoId: string | null
  duplicate: boolean
  createdAt: number
}

export type GameRungoProgress = {
  creditedHours: number
  pity: number
  processedMilestones: number[]
  rollHistory: RungoMilestoneRoll[]
  updatedAt: number
}

export type RungoMilestoneRollResult = {
  milestone: number
  chance: number
  roll: number
  awardedRungoId: string | null
  duplicate: boolean
}

export type DebugRungoRollResult = {
  awardedRungoId: string | null
  duplicate: boolean
}

export type ClaimGameTokenResult = {
  gameId: string
  creditedHours: number
  claimedMilestones: number[]
  claimedTokens: number
  tokenBalance: number
  highestCreditedHours: number
  newlyUnlockedGardenThemeIds: GardenThemeId[]
  awardedRangeProgressionPoints: number
  newlyUnlockedRangePerkIds: RangePerkId[]
  newlyUnlockedRangeCosmeticIds: string[]
  newlyUnlockedRangeToyIds: string[]
  newlyUnlockedRangeTierIds: RangeFeatureTierId[]
}

export type PlaytimeHubGameEntry = {
  id: string
  title: string
  totalMinutes: number
  iconSrc: string | null
  trackedMinutes: number
  officialMinutes: number | null
  playCount: number
  lastPlayedAt: number
  sourceLabel: string
}

export type ClaimAllGameTokensResult = {
  claimedTokens: number
  tokenBalance: number
  gamesClaimed: number
  newlyUnlockedGardenThemeIds: GardenThemeId[]
  awardedRangeProgressionPoints: number
  newlyUnlockedRangePerkIds: RangePerkId[]
  newlyUnlockedRangeCosmeticIds: string[]
  newlyUnlockedRangeToyIds: string[]
  newlyUnlockedRangeTierIds: RangeFeatureTierId[]
}

export type TokenRollHistoryEntry = {
  awardedRungoId: string
  duplicate: boolean
  sourceGameId: string | null
  tokenCost: number
  createdAt: number
}

export type RollRungoWithTokenResult = {
  awardedRungoId: string | null
  duplicate: boolean
  awardedSeeds: number
  tokenBalance: number
  gardenSeedBalance: number
  spentToken: boolean
  sourceGameId: string | null
  error: string | null
}

export type RollRungoWithTokenOptions = {
  debugInfiniteTokens?: boolean
}

export type PlanetLoadoutUpdateResult = {
  updated: boolean
  reason: 'ok' | 'invalid' | 'locked' | 'capacity' | 'already-present' | 'not-found'
  loadout: string[]
}

export type RungoNameOverridesByGame = Record<string, Record<string, string>>
export type RungoSignatureId = string | null
export type RungoTrioRole = 'leader' | 'mood' | 'hype'
export type RungoTrioRoleAssignments = Partial<Record<RungoTrioRole, string>>
export type RungoTrioByGame = Record<string, RungoTrioRoleAssignments>

export type GardenThemeId =
  | 'classic-meadow'
  | 'sunset-terrace'
  | 'mint-breeze'
  | 'moon-pool'
  | 'lantern-cove'

export type GardenThemeDefinition = {
  id: GardenThemeId
  name: string
  unlockHours: number
}

export type RangeNeedsDelta = {
  mood?: number
  energy?: number
  hunger?: number
}

export type RangeNeedsState = {
  mood: number
  energy: number
  hunger: number
  updatedAt: number
  totalToyInteractions: number
  totalConversations: number
}

export type RangeNeedsByRungoId = Record<string, RangeNeedsState>

export type RangeToyType = 'comfort' | 'snack' | 'play'

export type RangeToyState = {
  id: string
  name: string
  glyph: string
  type: RangeToyType
  xPercent: number
  lane: number
  interactionRadius: number
  cooldownMs: number
  availableAt: number
  moodBoost: number
  energyBoost: number
  hungerDelta: number
  totalUses: number
  lastUsedAt: number
}

export type RangeFeatureTierId = 'v2' | 'v3'

export type RangeToyCatalogEntry = {
  id: string
  name: string
  glyph: string
  type: RangeToyType
  unlockHours: number
  unlockTierId: 'v1' | RangeFeatureTierId
}

export type RangeItemCountsByToyId = Record<string, number>

export type RangeFeatureState = {
  schemaVersion: number
  highestCreditedHours: number
  unlockedToyIds: string[]
  unlockedTierIds: RangeFeatureTierId[]
}

export type RangePerkId = 'restful-breeze' | 'seed-whisper' | 'cozy-chat'

export type RangePerkDefinition = {
  id: RangePerkId
  name: string
  unlockHours: number
  description: string
}

export type RangeCosmeticDefinition = {
  id: string
  name: string
  unlockHours: number
  description: string
}

export type RangeMiniEventState = {
  id: string
  name: string
  startsAt: number
  endsAt: number
  targetToyInteractions: number
  toyInteractions: number
  rewardSeeds: number
  rewardPoints: number
  moodBonus: number
  energyBonus: number
}

export type RangeMiniEventHistoryEntry = {
  id: string
  name: string
  completedAt: number
  rewardSeeds: number
  rewardPoints: number
}

export type RangeProgressionState = {
  progressionPoints: number
  unlockedPerkIds: RangePerkId[]
  unlockedCosmeticIds: string[]
  activeMiniEvent: RangeMiniEventState | null
  miniEventHistory: RangeMiniEventHistoryEntry[]
  miniEventCooldownEndsAt: number
  nextMiniEventCheckAt: number
}

export type GardenSlotAssignments = Record<number, string>

export type UnlockGardenSlotResult = {
  updated: boolean
  reason: 'ok' | 'maxed' | 'insufficient'
  nextSlotCount: number
  spentSeeds: number
  seedBalance: number
  nextCost: number | null
}

const LEGACY_ATTACHMENTS_STORAGE_KEY = 'tm:keychainAttachments'
const ATTACHED_RUNGO_STORAGE_KEY = 'tm:attachedRungoBySystem'
const UNLOCKED_RUNGO_STORAGE_KEY = 'tm:rungoUnlocked'
const GAME_PROGRESS_STORAGE_KEY = 'tm:rungoProgressByGame'
const RUNGO_TOKEN_BALANCE_STORAGE_KEY = 'tm:rungoTokenBalance'
const RUNGO_TOKEN_ROLL_HISTORY_STORAGE_KEY = 'tm:rungoTokenRollHistory'
const ENABLED_ORBIT_RUNGO_STORAGE_KEY = 'tm:enabledOrbitRungoIds'
const PLANET_LOADOUT_BY_GAME_STORAGE_KEY = 'tm:rungoPlanetLoadoutByGame'
const RUNGO_NAME_OVERRIDES_BY_GAME_STORAGE_KEY = 'tm:rungoNameOverridesByGame'
const RUNGO_SIGNATURE_STORAGE_KEY = 'tm:rungoSignatureId'
const RUNGO_TRIO_BY_GAME_STORAGE_KEY = 'tm:rungoTrioByGame'
const GARDEN_SEED_BALANCE_STORAGE_KEY = 'tm:rungoGardenSeedBalance'
const GARDEN_UNLOCKED_SLOT_COUNT_STORAGE_KEY = 'tm:rungoGardenUnlockedSlotCount'
const GARDEN_SLOT_ASSIGNMENTS_STORAGE_KEY = 'tm:rungoGardenSlotAssignments'
const GARDEN_UNLOCKED_THEME_IDS_STORAGE_KEY = 'tm:rungoGardenUnlockedThemeIds'
const GARDEN_ACTIVE_THEME_ID_STORAGE_KEY = 'tm:rungoGardenActiveThemeId'
const RANGE_NEEDS_BY_ID_STORAGE_KEY = 'tm:rungoRangeNeedsById'
const RANGE_TOY_STATES_STORAGE_KEY = 'tm:rungoRangeToyStates'
const RANGE_ITEM_COUNTS_STORAGE_KEY = 'tm:rungoRangeItemCounts'
const RANGE_PROGRESSION_STORAGE_KEY = 'tm:rungoRangeProgression'
const RANGE_FEATURE_STATE_STORAGE_KEY = 'tm:rungoRangeFeatureState'
const RUNGO_MAX_CREDITED_HOURS = 1000
const RUNGO_MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 500, 1000]
const GARDEN_STARTING_SLOT_COUNT = 4
const GARDEN_MAX_SLOT_COUNT = 12
const GARDEN_SLOT_UNLOCK_COSTS = [8, 12, 16, 22, 30, 40, 52, 66] as const
const GARDEN_DEFAULT_THEME_ID: GardenThemeId = 'classic-meadow'
const RANGE_FEATURE_STATE_SCHEMA_VERSION = 3
const RANGE_V2_UNLOCK_HOURS = 20
const RANGE_V3_UNLOCK_HOURS = 60
const RANGE_MINI_EVENT_CHECK_INTERVAL_MS = 120000
const RANGE_MINI_EVENT_COOLDOWN_MS = 1500000
const RANGE_MINI_EVENT_DURATION_MS = 300000
const RANGE_MINI_EVENT_TRIGGER_CHANCE = 0.14
const RANGE_MINI_EVENT_MIN_RESIDENTS = 2
const RUNGO_TRIO_ROLE_ORDER: RungoTrioRole[] = ['leader', 'mood', 'hype']
export const GARDEN_THEME_DEFINITIONS: GardenThemeDefinition[] = [
  { id: 'classic-meadow', name: 'Classic Meadow', unlockHours: 0 },
  { id: 'sunset-terrace', name: 'Sunset Terrace', unlockHours: 10 },
  { id: 'mint-breeze', name: 'Mint Breeze', unlockHours: 30 },
  { id: 'moon-pool', name: 'Moon Pool', unlockHours: 60 },
  { id: 'lantern-cove', name: 'Lantern Cove', unlockHours: 100 },
]

export const RANGE_PERK_DEFINITIONS: RangePerkDefinition[] = [
  {
    id: 'restful-breeze',
    name: 'Restful Breeze',
    unlockHours: 25,
    description: 'Residents recover energy faster while resting.',
  },
  {
    id: 'seed-whisper',
    name: 'Seed Whisper',
    unlockHours: 60,
    description: 'Duplicate rolls award an extra Garden Seed.',
  },
  {
    id: 'cozy-chat',
    name: 'Cozy Chat',
    unlockHours: 120,
    description: 'Conversations lean happier in the Range.',
  },
]

export const RANGE_COSMETIC_DEFINITIONS: RangeCosmeticDefinition[] = [
  {
    id: 'range-ribbon-banner',
    name: 'Range Ribbon Banner',
    unlockHours: 40,
    description: 'A festive ribbon accent for your Range.',
  },
  {
    id: 'glimmer-dew-overlay',
    name: 'Glimmer Dew Overlay',
    unlockHours: 90,
    description: 'A soft sparkle shimmer over the meadow.',
  },
  {
    id: 'starglow-confetti',
    name: 'Starglow Confetti',
    unlockHours: 180,
    description: 'Occasional star confetti trails behind conversations.',
  },
]

export const RANGE_TOY_CATALOG: RangeToyCatalogEntry[] = [
  {
    id: 'plush-nest',
    name: 'Plush Nest',
    glyph: '🧺',
    type: 'comfort',
    unlockHours: 0,
    unlockTierId: 'v1',
  },
  {
    id: 'snack-cart',
    name: 'Snack Cart',
    glyph: '🍓',
    type: 'snack',
    unlockHours: RANGE_V2_UNLOCK_HOURS,
    unlockTierId: 'v2',
  },
  {
    id: 'bounce-ball',
    name: 'Bounce Ball',
    glyph: '⚽',
    type: 'play',
    unlockHours: RANGE_V3_UNLOCK_HOURS,
    unlockTierId: 'v3',
  },
]

const RANGE_TOY_UNLOCK_HOURS_BY_ID = RANGE_TOY_CATALOG.reduce<Record<string, number>>((map, entry) => {
  map[entry.id] = entry.unlockHours
  return map
}, {})

const RANGE_DEFAULT_TOY_STATES: RangeToyState[] = [
  {
    id: 'plush-nest',
    name: 'Plush Nest',
    glyph: '🧺',
    type: 'comfort',
    xPercent: 22,
    lane: 0,
    interactionRadius: 34,
    cooldownMs: 240000,
    availableAt: 0,
    moodBoost: 5,
    energyBoost: 12,
    hungerDelta: 0,
    totalUses: 0,
    lastUsedAt: 0,
  },
  {
    id: 'snack-cart',
    name: 'Snack Cart',
    glyph: '🍓',
    type: 'snack',
    xPercent: 52,
    lane: 1,
    interactionRadius: 34,
    cooldownMs: 240000,
    availableAt: 0,
    moodBoost: 4,
    energyBoost: 3,
    hungerDelta: -16,
    totalUses: 0,
    lastUsedAt: 0,
  },
  {
    id: 'bounce-ball',
    name: 'Bounce Ball',
    glyph: '⚽',
    type: 'play',
    xPercent: 78,
    lane: 2,
    interactionRadius: 34,
    cooldownMs: 240000,
    availableAt: 0,
    moodBoost: 9,
    energyBoost: -5,
    hungerDelta: 4,
    totalUses: 0,
    lastUsedAt: 0,
  },
]

const RANGE_DEFAULT_ITEM_COUNTS: RangeItemCountsByToyId = {
  'snack-cart': 15,
  'bounce-ball': 15,
  'plush-nest': 15,
}

const RANGE_MINI_EVENT_CATALOG: Array<{
  id: string
  name: string
  targetToyInteractions: number
  rewardSeeds: number
  rewardPoints: number
  moodBonus: number
  energyBonus: number
}> = [
  {
    id: 'sunshower-jam',
    name: 'Sunshower Jam',
    targetToyInteractions: 3,
    rewardSeeds: 4,
    rewardPoints: 14,
    moodBonus: 2,
    energyBonus: 0,
  },
  {
    id: 'picnic-pawty',
    name: 'Picnic Pawty',
    targetToyInteractions: 4,
    rewardSeeds: 5,
    rewardPoints: 16,
    moodBonus: 3,
    energyBonus: 1,
  },
  {
    id: 'lantern-lullaby',
    name: 'Lantern Lullaby',
    targetToyInteractions: 3,
    rewardSeeds: 4,
    rewardPoints: 15,
    moodBonus: 1,
    energyBonus: 2,
  },
]

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry): entry is string => Boolean(entry))
}

function sanitizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry))
}

function sanitizeRungoAlias(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, 42)
}

function isRungoTrioRole(value: unknown): value is RungoTrioRole {
  return value === 'leader' || value === 'mood' || value === 'hype'
}

function sanitizeRungoTrioRoleAssignments(
  value: unknown,
  allowedRungoIds: Set<string>,
): RungoTrioRoleAssignments {
  if (!isRecord(value)) {
    return {}
  }

  const usedRungoIds = new Set<string>()
  const normalized: RungoTrioRoleAssignments = {}
  RUNGO_TRIO_ROLE_ORDER.forEach((role) => {
    const rawRungoId = value[role]
    if (typeof rawRungoId !== 'string') {
      return
    }

    const normalizedRungoId = rawRungoId.trim()
    if (!normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return
    }

    if (!allowedRungoIds.has(normalizedRungoId) || usedRungoIds.has(normalizedRungoId)) {
      return
    }

    normalized[role] = normalizedRungoId
    usedRungoIds.add(normalizedRungoId)
  })

  return normalized
}

function sanitizeRungoTrioByGame(
  value: unknown,
  unlockedRungoIds: string[],
  planetLoadoutByGame: Record<string, string[]>,
): RungoTrioByGame {
  if (!isRecord(value)) {
    return {}
  }

  const unlockedSet = new Set(unlockedRungoIds)
  const normalized: RungoTrioByGame = {}
  Object.entries(value).forEach(([gameId, roleAssignments]) => {
    if (typeof gameId !== 'string' || !gameId.trim()) {
      return
    }

    const normalizedGameId = gameId.trim()
    const allowedRungoIds = new Set(
      (planetLoadoutByGame[normalizedGameId] ?? []).filter((entry) => unlockedSet.has(entry) && KNOWN_RUNGO_IDS.has(entry)),
    )
    const sanitizedAssignments = sanitizeRungoTrioRoleAssignments(roleAssignments, allowedRungoIds)
    if (Object.keys(sanitizedAssignments).length > 0) {
      normalized[normalizedGameId] = sanitizedAssignments
    }
  })

  return normalized
}

function isGardenThemeId(value: unknown): value is GardenThemeId {
  return typeof value === 'string'
    && GARDEN_THEME_DEFINITIONS.some((theme) => theme.id === value)
}

function orderedGardenThemeIds(themeIds: Iterable<GardenThemeId>): GardenThemeId[] {
  const requested = new Set(themeIds)
  return GARDEN_THEME_DEFINITIONS
    .map((theme) => theme.id)
    .filter((themeId) => requested.has(themeId))
}

function resolveGardenSlotUnlockCost(unlockedSlotCount: number): number | null {
  const normalizedSlotCount = Math.max(GARDEN_STARTING_SLOT_COUNT, Math.floor(unlockedSlotCount))
  if (normalizedSlotCount >= GARDEN_MAX_SLOT_COUNT) {
    return null
  }

  const nextSlotNumber = normalizedSlotCount + 1
  const costIndex = nextSlotNumber - (GARDEN_STARTING_SLOT_COUNT + 1)
  const cost = GARDEN_SLOT_UNLOCK_COSTS[costIndex]
  return typeof cost === 'number' ? cost : null
}

function resolveSeedRewardForRungo(rungoId: string): number {
  const keychain = getKeychainById(rungoId)
  if (!keychain) {
    return 0
  }

  if (keychain.rarityWeight <= 1) {
    return 7
  }

  if (keychain.rarityWeight <= 2) {
    return 4
  }

  if (keychain.rarityWeight <= 4) {
    return 2
  }

  return 1
}

function resolveGardenThemeUnlocksByHours(creditedHours: number): GardenThemeId[] {
  return GARDEN_THEME_DEFINITIONS
    .filter((theme) => creditedHours >= theme.unlockHours)
    .map((theme) => theme.id)
}

function getMaxCreditedHours(progressById: Record<string, GameRungoProgress>): number {
  return Object.values(progressById).reduce((maxHours, entry) => Math.max(maxHours, entry.creditedHours), 0)
}

function areGardenSlotAssignmentsEqual(a: GardenSlotAssignments, b: GardenSlotAssignments): boolean {
  const aEntries = Object.entries(a)
  const bEntries = Object.entries(b)
  if (aEntries.length !== bEntries.length) {
    return false
  }

  return aEntries.every(([slotKey, rungoId]) => b[Number(slotKey)] === rungoId)
}

function areRungoTrioRoleAssignmentsEqual(a: RungoTrioRoleAssignments, b: RungoTrioRoleAssignments): boolean {
  return RUNGO_TRIO_ROLE_ORDER.every((role) => {
    return (a[role] ?? null) === (b[role] ?? null)
  })
}

function areRungoTrioByGameEqual(a: RungoTrioByGame, b: RungoTrioByGame): boolean {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  if (aKeys.length !== bKeys.length) {
    return false
  }

  return aKeys.every((gameId, index) => {
    const compareGameId = bKeys[index]
    if (gameId !== compareGameId) {
      return false
    }

    const aAssignments = a[gameId] ?? {}
    const bAssignments = b[gameId] ?? {}
    return areRungoTrioRoleAssignmentsEqual(aAssignments, bAssignments)
  })
}

function sanitizeGardenSlotAssignments(
  value: unknown,
  unlockedRungoIds: string[],
  unlockedSlotCount: number,
): GardenSlotAssignments {
  if (!isRecord(value)) {
    return {}
  }

  const unlockedSet = new Set(unlockedRungoIds)
  const usedRungoIds = new Set<string>()
  const normalized: GardenSlotAssignments = {}
  Object.entries(value).forEach(([slotKey, rawRungoId]) => {
    const slotIndex = Number(slotKey)
    if (!Number.isFinite(slotIndex) || Math.floor(slotIndex) !== slotIndex) {
      return
    }

    if (slotIndex < 0 || slotIndex >= unlockedSlotCount || slotIndex >= GARDEN_MAX_SLOT_COUNT) {
      return
    }

    if (typeof rawRungoId !== 'string') {
      return
    }

    const normalizedRungoId = rawRungoId.trim()
    if (!normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId) || !unlockedSet.has(normalizedRungoId)) {
      return
    }

    if (usedRungoIds.has(normalizedRungoId)) {
      return
    }

    normalized[slotIndex] = normalizedRungoId
    usedRungoIds.add(normalizedRungoId)
  })

  return normalized
}

function loadJson(raw: string | null): unknown {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function loadAttachments(): KeychainAttachmentsMap {
  try {
    const primaryParsed = loadJson(window.localStorage.getItem(ATTACHED_RUNGO_STORAGE_KEY))
    const legacyParsed = loadJson(window.localStorage.getItem(LEGACY_ATTACHMENTS_STORAGE_KEY))
    const parsed = isRecord(primaryParsed) ? primaryParsed : isRecord(legacyParsed) ? legacyParsed : null
    if (!parsed) {
      return {}
    }

    const normalized: KeychainAttachmentsMap = {}
    Object.entries(parsed).forEach(([systemKey, rungoId]) => {
      if (typeof systemKey !== 'string' || typeof rungoId !== 'string') {
        return
      }

      const trimmedSystemKey = systemKey.trim()
      const trimmedRungoId = rungoId.trim()
      if (!trimmedSystemKey || !trimmedRungoId || !getKeychainById(trimmedRungoId)) {
        return
      }

      normalized[trimmedSystemKey] = trimmedRungoId
    })

    return normalized
  } catch {
    return {}
  }
}

function saveAttachments(data: KeychainAttachmentsMap) {
  try {
    window.localStorage.setItem(ATTACHED_RUNGO_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

function loadUnlockedRungoIds(): string[] {
  try {
    const parsed = loadJson(window.localStorage.getItem(UNLOCKED_RUNGO_STORAGE_KEY))
    const unlocked = sanitizeStringArray(parsed).filter((entry) => KNOWN_RUNGO_IDS.has(entry))
    const baseline = [...new Set([...RUNGO_UNLOCKED_DEFAULT_IDS, ...unlocked])]
    return baseline
  } catch {
    return [...RUNGO_UNLOCKED_DEFAULT_IDS]
  }
}

function saveUnlockedRungoIds(unlockedRungoIds: string[]) {
  try {
    window.localStorage.setItem(UNLOCKED_RUNGO_STORAGE_KEY, JSON.stringify(unlockedRungoIds))
  } catch {
    // ignore
  }
}

function loadTokenBalance(): number {
  try {
    const parsed = Number(window.localStorage.getItem(RUNGO_TOKEN_BALANCE_STORAGE_KEY))
    if (!Number.isFinite(parsed)) {
      return 0
    }

    return Math.max(0, Math.floor(parsed))
  } catch {
    return 0
  }
}

function saveTokenBalance(balance: number) {
  try {
    window.localStorage.setItem(RUNGO_TOKEN_BALANCE_STORAGE_KEY, String(Math.max(0, Math.floor(balance))))
  } catch {
    // ignore
  }
}

function loadTokenRollHistory(): TokenRollHistoryEntry[] {
  try {
    const parsed = loadJson(window.localStorage.getItem(RUNGO_TOKEN_ROLL_HISTORY_STORAGE_KEY))
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((entry) => isRecord(entry))
      .map((entry) => {
        const awardedRungoId = typeof entry.awardedRungoId === 'string' ? entry.awardedRungoId.trim() : ''
        const tokenCost = Number(entry.tokenCost ?? 1)
        const createdAt = Number(entry.createdAt ?? Date.now())
        const sourceGameId = typeof entry.sourceGameId === 'string' && entry.sourceGameId.trim()
          ? entry.sourceGameId.trim()
          : null

        return {
          awardedRungoId,
          duplicate: Boolean(entry.duplicate),
          sourceGameId,
          tokenCost: Number.isFinite(tokenCost) ? Math.max(0, Math.floor(tokenCost)) : 1,
          createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        }
      })
      .filter((entry) => KNOWN_RUNGO_IDS.has(entry.awardedRungoId))
      .slice(-200)
  } catch {
    return []
  }
}

function saveTokenRollHistory(history: TokenRollHistoryEntry[]) {
  try {
    window.localStorage.setItem(RUNGO_TOKEN_ROLL_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-200)))
  } catch {
    // ignore
  }
}

function loadEnabledOrbitRungoIds(unlockedRungoIds: string[]): string[] {
  try {
    const parsed = loadJson(window.localStorage.getItem(ENABLED_ORBIT_RUNGO_STORAGE_KEY))
    const unlockedSet = new Set(unlockedRungoIds)
    const enabled = sanitizeStringArray(parsed).filter((entry) => unlockedSet.has(entry) && KNOWN_RUNGO_IDS.has(entry))
    if (enabled.length > 0) {
      return [...new Set(enabled)]
    }

    return [...unlockedRungoIds]
  } catch {
    return [...unlockedRungoIds]
  }
}

function saveEnabledOrbitRungoIds(enabledRungoIds: string[]) {
  try {
    window.localStorage.setItem(ENABLED_ORBIT_RUNGO_STORAGE_KEY, JSON.stringify(enabledRungoIds))
  } catch {
    // ignore
  }
}

function loadPlanetLoadoutByGame(unlockedRungoIds: string[]): Record<string, string[]> {
  try {
    const parsed = loadJson(window.localStorage.getItem(PLANET_LOADOUT_BY_GAME_STORAGE_KEY))
    if (!isRecord(parsed)) {
      return {}
    }

    const unlockedSet = new Set(unlockedRungoIds)
    const normalized: Record<string, string[]> = {}
    Object.entries(parsed).forEach(([gameId, value]) => {
      if (typeof gameId !== 'string' || !gameId.trim()) {
        return
      }

      const sanitized = sanitizeStringArray(value)
        .filter((entry) => unlockedSet.has(entry) && KNOWN_RUNGO_IDS.has(entry))

      if (sanitized.length > 0) {
        normalized[gameId.trim()] = [...new Set(sanitized)]
      }
    })

    return normalized
  } catch {
    return {}
  }
}

function savePlanetLoadoutByGame(loadoutByGame: Record<string, string[]>) {
  try {
    window.localStorage.setItem(PLANET_LOADOUT_BY_GAME_STORAGE_KEY, JSON.stringify(loadoutByGame))
  } catch {
    // ignore
  }
}

function loadRungoNameOverridesByGame(unlockedRungoIds: string[]): RungoNameOverridesByGame {
  try {
    const parsed = loadJson(window.localStorage.getItem(RUNGO_NAME_OVERRIDES_BY_GAME_STORAGE_KEY))
    if (!isRecord(parsed)) {
      return {}
    }

    const unlockedSet = new Set(unlockedRungoIds)
    const normalized: RungoNameOverridesByGame = {}
    Object.entries(parsed).forEach(([gameId, value]) => {
      if (typeof gameId !== 'string' || !gameId.trim() || !isRecord(value)) {
        return
      }

      const nextEntries: Record<string, string> = {}
      Object.entries(value).forEach(([rungoId, rawAlias]) => {
        if (!KNOWN_RUNGO_IDS.has(rungoId) || !unlockedSet.has(rungoId)) {
          return
        }

        const alias = sanitizeRungoAlias(rawAlias)
        if (!alias) {
          return
        }

        nextEntries[rungoId] = alias
      })

      if (Object.keys(nextEntries).length > 0) {
        normalized[gameId.trim()] = nextEntries
      }
    })

    return normalized
  } catch {
    return {}
  }
}

function saveRungoNameOverridesByGame(overridesByGame: RungoNameOverridesByGame) {
  try {
    window.localStorage.setItem(RUNGO_NAME_OVERRIDES_BY_GAME_STORAGE_KEY, JSON.stringify(overridesByGame))
  } catch {
    // ignore
  }
}

function loadSignatureRungoId(unlockedRungoIds: string[]): RungoSignatureId {
  try {
    const raw = window.localStorage.getItem(RUNGO_SIGNATURE_STORAGE_KEY)
    const parsed = loadJson(raw)
    const normalized = typeof parsed === 'string'
      ? parsed.trim()
      : typeof raw === 'string'
        ? raw.trim()
        : ''

    if (normalized && KNOWN_RUNGO_IDS.has(normalized) && unlockedRungoIds.includes(normalized)) {
      return normalized
    }
  } catch {
    // ignore
  }

  return unlockedRungoIds.find((entry) => KNOWN_RUNGO_IDS.has(entry)) ?? null
}

function saveSignatureRungoId(signatureRungoId: RungoSignatureId) {
  try {
    if (!signatureRungoId) {
      window.localStorage.removeItem(RUNGO_SIGNATURE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(RUNGO_SIGNATURE_STORAGE_KEY, JSON.stringify(signatureRungoId))
  } catch {
    // ignore
  }
}

function loadRungoTrioByGame(
  unlockedRungoIds: string[],
  planetLoadoutByGame: Record<string, string[]>,
): RungoTrioByGame {
  try {
    const parsed = loadJson(window.localStorage.getItem(RUNGO_TRIO_BY_GAME_STORAGE_KEY))
    return sanitizeRungoTrioByGame(parsed, unlockedRungoIds, planetLoadoutByGame)
  } catch {
    return {}
  }
}

function saveRungoTrioByGame(rungoTrioByGame: RungoTrioByGame) {
  try {
    window.localStorage.setItem(RUNGO_TRIO_BY_GAME_STORAGE_KEY, JSON.stringify(rungoTrioByGame))
  } catch {
    // ignore
  }
}

function loadGardenSeedBalance(): number {
  try {
    const parsed = Number(window.localStorage.getItem(GARDEN_SEED_BALANCE_STORAGE_KEY))
    if (!Number.isFinite(parsed)) {
      return 0
    }

    return Math.max(0, Math.floor(parsed))
  } catch {
    return 0
  }
}

function saveGardenSeedBalance(balance: number) {
  try {
    window.localStorage.setItem(GARDEN_SEED_BALANCE_STORAGE_KEY, String(Math.max(0, Math.floor(balance))))
  } catch {
    // ignore
  }
}

function loadGardenUnlockedSlotCount(): number {
  try {
    const parsed = Number(window.localStorage.getItem(GARDEN_UNLOCKED_SLOT_COUNT_STORAGE_KEY))
    if (!Number.isFinite(parsed)) {
      return GARDEN_STARTING_SLOT_COUNT
    }

    return clampNumber(Math.floor(parsed), GARDEN_STARTING_SLOT_COUNT, GARDEN_MAX_SLOT_COUNT)
  } catch {
    return GARDEN_STARTING_SLOT_COUNT
  }
}

function saveGardenUnlockedSlotCount(slotCount: number) {
  try {
    const normalized = clampNumber(Math.floor(slotCount), GARDEN_STARTING_SLOT_COUNT, GARDEN_MAX_SLOT_COUNT)
    window.localStorage.setItem(GARDEN_UNLOCKED_SLOT_COUNT_STORAGE_KEY, String(normalized))
  } catch {
    // ignore
  }
}

function loadGardenSlotAssignments(unlockedRungoIds: string[], unlockedSlotCount: number): GardenSlotAssignments {
  try {
    const parsed = loadJson(window.localStorage.getItem(GARDEN_SLOT_ASSIGNMENTS_STORAGE_KEY))
    return sanitizeGardenSlotAssignments(parsed, unlockedRungoIds, unlockedSlotCount)
  } catch {
    return {}
  }
}

function saveGardenSlotAssignments(assignments: GardenSlotAssignments) {
  try {
    window.localStorage.setItem(GARDEN_SLOT_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments))
  } catch {
    // ignore
  }
}

function loadGardenUnlockedThemeIds(maxCreditedHours: number): GardenThemeId[] {
  try {
    const parsed = loadJson(window.localStorage.getItem(GARDEN_UNLOCKED_THEME_IDS_STORAGE_KEY))
    const persistedIds = sanitizeStringArray(parsed).filter((entry): entry is GardenThemeId => isGardenThemeId(entry))
    const autoUnlockedIds = resolveGardenThemeUnlocksByHours(maxCreditedHours)
    const merged = new Set<GardenThemeId>([GARDEN_DEFAULT_THEME_ID, ...persistedIds, ...autoUnlockedIds])
    return orderedGardenThemeIds(merged)
  } catch {
    return orderedGardenThemeIds([GARDEN_DEFAULT_THEME_ID])
  }
}

function saveGardenUnlockedThemeIds(themeIds: GardenThemeId[]) {
  try {
    window.localStorage.setItem(GARDEN_UNLOCKED_THEME_IDS_STORAGE_KEY, JSON.stringify(orderedGardenThemeIds(themeIds)))
  } catch {
    // ignore
  }
}

function loadActiveGardenThemeId(unlockedThemeIds: GardenThemeId[]): GardenThemeId {
  try {
    const parsed = loadJson(window.localStorage.getItem(GARDEN_ACTIVE_THEME_ID_STORAGE_KEY))
    if (isGardenThemeId(parsed) && unlockedThemeIds.includes(parsed)) {
      return parsed
    }
  } catch {
    // ignore
  }

  if (unlockedThemeIds.includes(GARDEN_DEFAULT_THEME_ID)) {
    return GARDEN_DEFAULT_THEME_ID
  }

  return unlockedThemeIds[0] ?? GARDEN_DEFAULT_THEME_ID
}

function saveActiveGardenThemeId(themeId: GardenThemeId) {
  try {
    window.localStorage.setItem(GARDEN_ACTIVE_THEME_ID_STORAGE_KEY, themeId)
  } catch {
    // ignore
  }
}

function createDefaultRangeNeedsState(now = Date.now()): RangeNeedsState {
  return {
    mood: 82,
    energy: 78,
    hunger: 22,
    updatedAt: now,
    totalToyInteractions: 0,
    totalConversations: 0,
  }
}

function normalizeRangeNeedsState(value: unknown, now = Date.now()): RangeNeedsState {
  if (!isRecord(value)) {
    return createDefaultRangeNeedsState(now)
  }

  return {
    mood: clampNumber(Number(value.mood ?? 82), 0, 100),
    energy: clampNumber(Number(value.energy ?? 78), 0, 100),
    hunger: clampNumber(Number(value.hunger ?? 22), 0, 100),
    updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : now,
    totalToyInteractions: Math.max(0, Math.floor(Number(value.totalToyInteractions ?? 0))),
    totalConversations: Math.max(0, Math.floor(Number(value.totalConversations ?? 0))),
  }
}

function loadRangeNeedsByRungoId(): RangeNeedsByRungoId {
  try {
    const parsed = loadJson(window.localStorage.getItem(RANGE_NEEDS_BY_ID_STORAGE_KEY))
    if (!isRecord(parsed)) {
      return {}
    }

    const normalized: RangeNeedsByRungoId = {}
    const now = Date.now()
    Object.entries(parsed).forEach(([rungoId, state]) => {
      if (!KNOWN_RUNGO_IDS.has(rungoId)) {
        return
      }

      normalized[rungoId] = normalizeRangeNeedsState(state, now)
    })
    return normalized
  } catch {
    return {}
  }
}

function saveRangeNeedsByRungoId(rangeNeedsByRungoId: RangeNeedsByRungoId) {
  try {
    window.localStorage.setItem(RANGE_NEEDS_BY_ID_STORAGE_KEY, JSON.stringify(rangeNeedsByRungoId))
  } catch {
    // ignore
  }
}

function normalizeRangeToyState(value: unknown, fallback: RangeToyState): RangeToyState {
  if (!isRecord(value)) {
    return fallback
  }

  return {
    ...fallback,
    xPercent: clampNumber(Number(value.xPercent ?? fallback.xPercent), 5, 95),
    lane: clampNumber(Math.floor(Number(value.lane ?? fallback.lane)), 0, 2),
    interactionRadius: clampNumber(Number(value.interactionRadius ?? fallback.interactionRadius), 16, 72),
    cooldownMs: Math.max(1000, Math.floor(Number(value.cooldownMs ?? fallback.cooldownMs))),
    availableAt: Number.isFinite(Number(value.availableAt)) ? Number(value.availableAt) : fallback.availableAt,
    totalUses: Math.max(0, Math.floor(Number(value.totalUses ?? fallback.totalUses))),
    lastUsedAt: Number.isFinite(Number(value.lastUsedAt)) ? Number(value.lastUsedAt) : fallback.lastUsedAt,
  }
}

function loadRangeToyStates(): RangeToyState[] {
  try {
    const parsed = loadJson(window.localStorage.getItem(RANGE_TOY_STATES_STORAGE_KEY))
    const parsedById = new Map<string, unknown>()
    if (Array.isArray(parsed)) {
      parsed.forEach((entry) => {
        if (!isRecord(entry) || typeof entry.id !== 'string') {
          return
        }

        parsedById.set(entry.id, entry)
      })
    }

    return RANGE_DEFAULT_TOY_STATES.map((entry) => normalizeRangeToyState(parsedById.get(entry.id), entry))
  } catch {
    return [...RANGE_DEFAULT_TOY_STATES]
  }
}

function saveRangeToyStates(toyStates: RangeToyState[]) {
  try {
    window.localStorage.setItem(RANGE_TOY_STATES_STORAGE_KEY, JSON.stringify(toyStates))
  } catch {
    // ignore
  }
}

function normalizeRangeItemCounts(value: unknown): RangeItemCountsByToyId {
  const normalized: RangeItemCountsByToyId = { ...RANGE_DEFAULT_ITEM_COUNTS }
  if (!isRecord(value)) {
    return normalized
  }

  Object.keys(RANGE_DEFAULT_ITEM_COUNTS).forEach((toyId) => {
    const parsed = Number(value[toyId])
    if (Number.isFinite(parsed)) {
      normalized[toyId] = Math.max(0, Math.floor(parsed))
    }
  })

  return normalized
}

function loadRangeItemCounts(): RangeItemCountsByToyId {
  try {
    const parsed = loadJson(window.localStorage.getItem(RANGE_ITEM_COUNTS_STORAGE_KEY))
    return normalizeRangeItemCounts(parsed)
  } catch {
    return { ...RANGE_DEFAULT_ITEM_COUNTS }
  }
}

function saveRangeItemCounts(rangeItemCountsByToyId: RangeItemCountsByToyId) {
  try {
    const normalized = normalizeRangeItemCounts(rangeItemCountsByToyId)
    window.localStorage.setItem(RANGE_ITEM_COUNTS_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // ignore
  }
}

function orderedRangeToyIds(toyIds: Iterable<string>): string[] {
  const requested = new Set(toyIds)
  return RANGE_TOY_CATALOG
    .map((entry) => entry.id)
    .filter((toyId) => requested.has(toyId))
}

function orderedRangeTierIds(tierIds: Iterable<RangeFeatureTierId>): RangeFeatureTierId[] {
  const requested = new Set(tierIds)
  return ['v2', 'v3'].filter((tierId): tierId is RangeFeatureTierId => requested.has(tierId as RangeFeatureTierId))
}

function resolveUnlockedRangeToyIdsByHours(creditedHours: number): string[] {
  const normalizedHours = clampNumber(Math.floor(creditedHours), 0, RUNGO_MAX_CREDITED_HOURS)
  const unlockedToyIds = RANGE_TOY_CATALOG
    .filter((entry) => normalizedHours >= entry.unlockHours)
    .map((entry) => entry.id)

  if (unlockedToyIds.length > 0) {
    return unlockedToyIds
  }

  const fallbackToyId = RANGE_TOY_CATALOG[0]?.id
  return fallbackToyId ? [fallbackToyId] : []
}

function resolveUnlockedRangeTierIdsByHours(creditedHours: number): RangeFeatureTierId[] {
  const normalizedHours = clampNumber(Math.floor(creditedHours), 0, RUNGO_MAX_CREDITED_HOURS)
  const unlockedTierIds: RangeFeatureTierId[] = []
  if (normalizedHours >= RANGE_V2_UNLOCK_HOURS) {
    unlockedTierIds.push('v2')
  }

  if (normalizedHours >= RANGE_V3_UNLOCK_HOURS) {
    unlockedTierIds.push('v3')
  }

  return unlockedTierIds
}

function createDefaultRangeFeatureState(highestCreditedHours = 0): RangeFeatureState {
  const normalizedHours = clampNumber(Math.floor(highestCreditedHours), 0, RUNGO_MAX_CREDITED_HOURS)
  return {
    schemaVersion: RANGE_FEATURE_STATE_SCHEMA_VERSION,
    highestCreditedHours: normalizedHours,
    unlockedToyIds: resolveUnlockedRangeToyIdsByHours(normalizedHours),
    unlockedTierIds: resolveUnlockedRangeTierIdsByHours(normalizedHours),
  }
}

function normalizeRangeFeatureState(value: unknown, maxCreditedHours: number): RangeFeatureState {
  if (!isRecord(value)) {
    return createDefaultRangeFeatureState(maxCreditedHours)
  }

  const persistedHighestHours = Number(value.highestCreditedHours)
  const highestCreditedHours = clampNumber(
    Math.max(
      Number.isFinite(persistedHighestHours) ? Math.floor(persistedHighestHours) : 0,
      Math.floor(maxCreditedHours),
    ),
    0,
    RUNGO_MAX_CREDITED_HOURS,
  )

  const persistedToyIds = sanitizeStringArray(value.unlockedToyIds)
    .filter((toyId) => Object.prototype.hasOwnProperty.call(RANGE_TOY_UNLOCK_HOURS_BY_ID, toyId))
  const persistedTierIds = sanitizeStringArray(value.unlockedTierIds)
    .filter((tierId): tierId is RangeFeatureTierId => tierId === 'v2' || tierId === 'v3')
  const autoUnlockedToyIds = resolveUnlockedRangeToyIdsByHours(highestCreditedHours)
  const autoUnlockedTierIds = resolveUnlockedRangeTierIdsByHours(highestCreditedHours)

  return {
    schemaVersion: RANGE_FEATURE_STATE_SCHEMA_VERSION,
    highestCreditedHours,
    unlockedToyIds: orderedRangeToyIds([...persistedToyIds, ...autoUnlockedToyIds]),
    unlockedTierIds: orderedRangeTierIds([...persistedTierIds, ...autoUnlockedTierIds]),
  }
}

function loadRangeFeatureState(maxCreditedHours: number): RangeFeatureState {
  try {
    const parsed = loadJson(window.localStorage.getItem(RANGE_FEATURE_STATE_STORAGE_KEY))
    return normalizeRangeFeatureState(parsed, maxCreditedHours)
  } catch {
    return createDefaultRangeFeatureState(maxCreditedHours)
  }
}

function saveRangeFeatureState(rangeFeatureState: RangeFeatureState) {
  try {
    const normalized = normalizeRangeFeatureState(rangeFeatureState, rangeFeatureState.highestCreditedHours)
    window.localStorage.setItem(RANGE_FEATURE_STATE_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // ignore
  }
}

function isRangePerkId(value: unknown): value is RangePerkId {
  return typeof value === 'string' && RANGE_PERK_DEFINITIONS.some((entry) => entry.id === value)
}

function resolveRangePerkUnlocksByHours(creditedHours: number): RangePerkId[] {
  return RANGE_PERK_DEFINITIONS
    .filter((entry) => creditedHours >= entry.unlockHours)
    .map((entry) => entry.id)
}

function resolveRangeCosmeticUnlocksByHours(creditedHours: number): string[] {
  return RANGE_COSMETIC_DEFINITIONS
    .filter((entry) => creditedHours >= entry.unlockHours)
    .map((entry) => entry.id)
}

function createDefaultRangeProgression(now = Date.now()): RangeProgressionState {
  return {
    progressionPoints: 0,
    unlockedPerkIds: [],
    unlockedCosmeticIds: [],
    activeMiniEvent: null,
    miniEventHistory: [],
    miniEventCooldownEndsAt: 0,
    nextMiniEventCheckAt: now + RANGE_MINI_EVENT_CHECK_INTERVAL_MS,
  }
}

function normalizeRangeMiniEvent(value: unknown): RangeMiniEventState | null {
  if (!isRecord(value)) {
    return null
  }

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!id || !name) {
    return null
  }

  const startsAt = Number(value.startsAt)
  const endsAt = Number(value.endsAt)
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    return null
  }

  const targetToyInteractions = Math.max(1, Math.floor(Number(value.targetToyInteractions ?? 3)))
  const toyInteractions = clampNumber(Math.floor(Number(value.toyInteractions ?? 0)), 0, targetToyInteractions)
  return {
    id,
    name,
    startsAt,
    endsAt,
    targetToyInteractions,
    toyInteractions,
    rewardSeeds: Math.max(0, Math.floor(Number(value.rewardSeeds ?? 0))),
    rewardPoints: Math.max(0, Math.floor(Number(value.rewardPoints ?? 0))),
    moodBonus: clampNumber(Number(value.moodBonus ?? 0), -8, 16),
    energyBonus: clampNumber(Number(value.energyBonus ?? 0), -8, 16),
  }
}

function normalizeRangeProgression(value: unknown, now = Date.now()): RangeProgressionState {
  if (!isRecord(value)) {
    return createDefaultRangeProgression(now)
  }

  const activeMiniEvent = normalizeRangeMiniEvent(value.activeMiniEvent)
  const miniEventHistory = Array.isArray(value.miniEventHistory)
    ? value.miniEventHistory
      .filter((entry) => isRecord(entry))
      .map((entry) => {
        const id = typeof entry.id === 'string' ? entry.id.trim() : ''
        const name = typeof entry.name === 'string' ? entry.name.trim() : ''
        if (!id || !name) {
          return null
        }

        const completedAt = Number(entry.completedAt)
        return {
          id,
          name,
          completedAt: Number.isFinite(completedAt) ? completedAt : now,
          rewardSeeds: Math.max(0, Math.floor(Number(entry.rewardSeeds ?? 0))),
          rewardPoints: Math.max(0, Math.floor(Number(entry.rewardPoints ?? 0))),
        }
      })
      .filter((entry): entry is RangeMiniEventHistoryEntry => Boolean(entry))
      .slice(-120)
    : []

  return {
    progressionPoints: Math.max(0, Math.floor(Number(value.progressionPoints ?? 0))),
    unlockedPerkIds: [...new Set(sanitizeStringArray(value.unlockedPerkIds).filter((entry): entry is RangePerkId => isRangePerkId(entry)))],
    unlockedCosmeticIds: [...new Set(sanitizeStringArray(value.unlockedCosmeticIds))],
    activeMiniEvent,
    miniEventHistory,
    miniEventCooldownEndsAt: Number.isFinite(Number(value.miniEventCooldownEndsAt))
      ? Number(value.miniEventCooldownEndsAt)
      : 0,
    nextMiniEventCheckAt: Number.isFinite(Number(value.nextMiniEventCheckAt))
      ? Number(value.nextMiniEventCheckAt)
      : now + RANGE_MINI_EVENT_CHECK_INTERVAL_MS,
  }
}

function loadRangeProgression(maxCreditedHours: number): RangeProgressionState {
  try {
    const parsed = loadJson(window.localStorage.getItem(RANGE_PROGRESSION_STORAGE_KEY))
    const now = Date.now()
    const normalized = normalizeRangeProgression(parsed, now)
    const autoUnlockedPerks = resolveRangePerkUnlocksByHours(maxCreditedHours)
    const autoUnlockedCosmetics = resolveRangeCosmeticUnlocksByHours(maxCreditedHours)
    return {
      ...normalized,
      unlockedPerkIds: [...new Set([...normalized.unlockedPerkIds, ...autoUnlockedPerks])],
      unlockedCosmeticIds: [...new Set([...normalized.unlockedCosmeticIds, ...autoUnlockedCosmetics])],
    }
  } catch {
    return createDefaultRangeProgression()
  }
}

function saveRangeProgression(progressionState: RangeProgressionState) {
  try {
    window.localStorage.setItem(RANGE_PROGRESSION_STORAGE_KEY, JSON.stringify(progressionState))
  } catch {
    // ignore
  }
}

function createDefaultGameProgress(): GameRungoProgress {
  return {
    creditedHours: 0,
    pity: 0,
    processedMilestones: [],
    rollHistory: [],
    updatedAt: Date.now(),
  }
}

function normalizeGameProgress(value: unknown): GameRungoProgress {
  if (!isRecord(value)) {
    return createDefaultGameProgress()
  }

  const creditedHours = clampNumber(Number(value.creditedHours ?? 0), 0, RUNGO_MAX_CREDITED_HOURS)
  const pity = Math.max(0, Number(value.pity ?? 0))
  const processedMilestones = sanitizeNumberArray(value.processedMilestones)
    .filter((milestone) => Number.isFinite(milestone) && RUNGO_MILESTONES.includes(milestone))
  const rollHistory = Array.isArray(value.rollHistory)
    ? value.rollHistory
      .filter((entry) => isRecord(entry))
      .slice(-128)
      .map((entry) => ({
        milestone: Number(entry.milestone ?? 0),
        roll: Number(entry.roll ?? 0),
        chance: Number(entry.chance ?? 0),
        awardedRungoId: typeof entry.awardedRungoId === 'string' ? entry.awardedRungoId : null,
        duplicate: Boolean(entry.duplicate),
        createdAt: Number(entry.createdAt ?? Date.now()),
      }))
      .filter((entry) => Number.isFinite(entry.milestone) && Number.isFinite(entry.roll) && Number.isFinite(entry.chance))
    : []

  return {
    creditedHours,
    pity: Number.isFinite(pity) ? pity : 0,
    processedMilestones: [...new Set(processedMilestones)],
    rollHistory,
    updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : Date.now(),
  }
}

function loadGameProgressById(): Record<string, GameRungoProgress> {
  try {
    const parsed = loadJson(window.localStorage.getItem(GAME_PROGRESS_STORAGE_KEY))
    if (!isRecord(parsed)) {
      return {}
    }

    const normalized: Record<string, GameRungoProgress> = {}
    Object.entries(parsed).forEach(([gameId, gameProgress]) => {
      if (typeof gameId !== 'string' || !gameId.trim()) {
        return
      }
      normalized[gameId] = normalizeGameProgress(gameProgress)
    })

    return normalized
  } catch {
    return {}
  }
}

function saveGameProgressById(progressById: Record<string, GameRungoProgress>) {
  try {
    window.localStorage.setItem(GAME_PROGRESS_STORAGE_KEY, JSON.stringify(progressById))
  } catch {
    // ignore
  }
}

function pickWeightedRungoId(): string | null {
  const spawnEligible = ownedKeychains.filter((entry) => entry.isSpawnEligible && entry.sprites)
  if (spawnEligible.length === 0) {
    return null
  }

  const totalWeight = spawnEligible.reduce((total, entry) => total + Math.max(0.001, entry.rarityWeight), 0)
  let cursor = Math.random() * totalWeight
  for (const entry of spawnEligible) {
    cursor -= Math.max(0.001, entry.rarityWeight)
    if (cursor <= 0) {
      return entry.id
    }
  }

  return spawnEligible[spawnEligible.length - 1]?.id ?? null
}

export interface KeychainAttachmentsContextValue {
  attachments: KeychainAttachmentsMap
  attachedKeychainIdForSystem: (systemKey: string) => string | undefined
  isAttaching: boolean
  attachingKeychainId: string | null
  startAttaching: (keychainId: string) => void
  cancelAttaching: () => void
  attachRungoToSystem: (systemKey: string, rungoId: string) => boolean
  completeAttach: (systemKey: string) => void
  detachFromSystem: (systemKey: string) => void
  unlockedRungoIds: string[]
  isRungoUnlocked: (rungoId: string) => boolean
  unlockRungo: (rungoId: string) => void
  lockRungo: (rungoId: string) => void
  debugRollRungo: () => DebugRungoRollResult
  rungoTokenBalance: number
  tokenRollHistory: TokenRollHistoryEntry[]
  gardenSeedBalance: number
  gardenUnlockedSlotCount: number
  gardenMaxSlotCount: number
  gardenSlotAssignments: GardenSlotAssignments
  getGardenSlotUnlockCost: () => number | null
  unlockNextGardenSlot: () => UnlockGardenSlotResult
  setGardenSlotRungo: (slotIndex: number, rungoId: string | null) => boolean
  gardenThemes: GardenThemeDefinition[]
  gardenUnlockedThemeIds: GardenThemeId[]
  activeGardenThemeId: GardenThemeId
  setActiveGardenTheme: (themeId: GardenThemeId) => boolean
  rangeNeedsByRungoId: RangeNeedsByRungoId
  ensureRangeNeedsForRungo: (rungoId: string) => RangeNeedsState | null
  applyRangeNeedsDelta: (
    rungoId: string,
    delta: RangeNeedsDelta,
    source?: 'decay' | 'toy' | 'conversation' | 'rest',
  ) => RangeNeedsState | null
  decayRangeNeeds: (rungoIds: string[], elapsedMs: number) => void
  rangeFeatureState: RangeFeatureState
  rangeToyCatalog: RangeToyCatalogEntry[]
  rangeToyStates: RangeToyState[]
  rangeItemCountsByToyId: RangeItemCountsByToyId
  getRangeItemCount: (toyId: string) => number
  consumeRangeItemCount: (toyId: string, amount?: number) => number | null
  applyRangeToyEffectDirect: (toyId: string, rungoId: string) => RangeToyState | null
  consumeRangeToy: (toyId: string, rungoId: string) => RangeToyState | null
  rangeProgression: RangeProgressionState
  rangePerks: RangePerkDefinition[]
  rangeCosmetics: RangeCosmeticDefinition[]
  hasRangePerk: (perkId: RangePerkId) => boolean
  maybeActivateRangeMiniEvent: (residentCount: number, now?: number) => RangeMiniEventState | null
  getClaimableTokenCountForGame: (gameId: string, playtimeMinutes: number) => number
  getTotalClaimableTokenCount: (entries: Array<{ gameId: string; playtimeMinutes: number }>) => number
  claimGamePlaytimeTokens: (gameId: string, playtimeMinutes: number) => ClaimGameTokenResult
  claimAllGamePlaytimeTokens: (entries: Array<{ gameId: string; playtimeMinutes: number }>) => ClaimAllGameTokensResult
  rollRungoWithToken: (sourceGameId?: string, options?: RollRungoWithTokenOptions) => RollRungoWithTokenResult
  enabledOrbitRungoIds: string[]
  signatureRungoId: RungoSignatureId
  setSignatureRungoId: (rungoId: string) => boolean
  isRungoEnabledInOrbit: (rungoId: string) => boolean
  setRungoOrbitEnabled: (rungoId: string, enabled: boolean) => void
  getPlanetLoadoutForGame: (gameId: string) => string[]
  addRungoToPlanetLoadout: (gameId: string, rungoId: string, maxSlots: number) => PlanetLoadoutUpdateResult
  removeRungoFromPlanetLoadout: (gameId: string, rungoId: string) => PlanetLoadoutUpdateResult
  getRungoTrioForGame: (gameId: string) => RungoTrioRoleAssignments
  setRungoTrioRoleForGame: (gameId: string, role: RungoTrioRole, rungoId: string | null) => void
  getRungoNameOverridesForGame: (gameId: string) => Record<string, string>
  setRungoNameOverrideForGame: (gameId: string, rungoId: string, alias: string) => void
  gameProgressById: Record<string, GameRungoProgress>
}

const KeychainAttachmentsContext = createContext<KeychainAttachmentsContextValue | null>(null)

export function KeychainAttachmentsProvider({ children }: { children: React.ReactNode }) {
  const initialUnlockedRungoIds = typeof window === 'undefined'
    ? [...RUNGO_UNLOCKED_DEFAULT_IDS]
    : loadUnlockedRungoIds()
  const initialGameProgressById = typeof window === 'undefined'
    ? {}
    : loadGameProgressById()
  const initialGardenUnlockedSlotCount = typeof window === 'undefined'
    ? GARDEN_STARTING_SLOT_COUNT
    : loadGardenUnlockedSlotCount()
  const initialGardenUnlockedThemeIds = typeof window === 'undefined'
    ? orderedGardenThemeIds([GARDEN_DEFAULT_THEME_ID])
    : loadGardenUnlockedThemeIds(getMaxCreditedHours(initialGameProgressById))
  const initialActiveGardenThemeId = typeof window === 'undefined'
    ? GARDEN_DEFAULT_THEME_ID
    : loadActiveGardenThemeId(initialGardenUnlockedThemeIds)
  const initialRangeFeatureState = typeof window === 'undefined'
    ? createDefaultRangeFeatureState(getMaxCreditedHours(initialGameProgressById))
    : loadRangeFeatureState(getMaxCreditedHours(initialGameProgressById))
  const initialRangeProgression = typeof window === 'undefined'
    ? createDefaultRangeProgression()
    : loadRangeProgression(getMaxCreditedHours(initialGameProgressById))
  const initialPlanetLoadoutByGame = typeof window === 'undefined'
    ? {}
    : loadPlanetLoadoutByGame(initialUnlockedRungoIds)

  const [attachments, setAttachments] = useState<KeychainAttachmentsMap>(() => {
    if (typeof window === 'undefined') return {}
    return loadAttachments()
  })
  const [attachingKeychainId, setAttachingKeychainId] = useState<string | null>(null)
  const [unlockedRungoIds, setUnlockedRungoIds] = useState<string[]>(initialUnlockedRungoIds)
  const [gameProgressById, setGameProgressById] = useState<Record<string, GameRungoProgress>>(initialGameProgressById)
  const [rungoTokenBalance, setRungoTokenBalance] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 0
    }

    return loadTokenBalance()
  })
  const [tokenRollHistory, setTokenRollHistory] = useState<TokenRollHistoryEntry[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    return loadTokenRollHistory()
  })
  const [gardenSeedBalance, setGardenSeedBalance] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 0
    }

    return loadGardenSeedBalance()
  })
  const [gardenUnlockedSlotCount, setGardenUnlockedSlotCount] = useState<number>(initialGardenUnlockedSlotCount)
  const [gardenSlotAssignments, setGardenSlotAssignments] = useState<GardenSlotAssignments>(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    return loadGardenSlotAssignments(initialUnlockedRungoIds, initialGardenUnlockedSlotCount)
  })
  const [gardenUnlockedThemeIds, setGardenUnlockedThemeIds] = useState<GardenThemeId[]>(initialGardenUnlockedThemeIds)
  const [activeGardenThemeId, setActiveGardenThemeId] = useState<GardenThemeId>(initialActiveGardenThemeId)
  const [rangeNeedsByRungoId, setRangeNeedsByRungoId] = useState<RangeNeedsByRungoId>(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    return loadRangeNeedsByRungoId()
  })
  const [rangeToyStates, setRangeToyStates] = useState<RangeToyState[]>(() => {
    if (typeof window === 'undefined') {
      return [...RANGE_DEFAULT_TOY_STATES]
    }

    return loadRangeToyStates()
  })
  const [rangeItemCountsByToyId, setRangeItemCountsByToyId] = useState<RangeItemCountsByToyId>(() => {
    if (typeof window === 'undefined') {
      return { ...RANGE_DEFAULT_ITEM_COUNTS }
    }

    return loadRangeItemCounts()
  })
  const [rangeFeatureState, setRangeFeatureState] = useState<RangeFeatureState>(initialRangeFeatureState)
  const [rangeProgression, setRangeProgression] = useState<RangeProgressionState>(initialRangeProgression)
  const [enabledOrbitRungoIds, setEnabledOrbitRungoIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [...initialUnlockedRungoIds]
    }

    return loadEnabledOrbitRungoIds(initialUnlockedRungoIds)
  })
  const [signatureRungoId, setSignatureRungoIdState] = useState<RungoSignatureId>(() => {
    if (typeof window === 'undefined') {
      return initialUnlockedRungoIds.find((entry) => KNOWN_RUNGO_IDS.has(entry)) ?? null
    }

    return loadSignatureRungoId(initialUnlockedRungoIds)
  })
  const [planetLoadoutByGame, setPlanetLoadoutByGame] = useState<Record<string, string[]>>(initialPlanetLoadoutByGame)
  const [rungoTrioByGame, setRungoTrioByGame] = useState<RungoTrioByGame>(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    return loadRungoTrioByGame(initialUnlockedRungoIds, initialPlanetLoadoutByGame)
  })
  const [rungoNameOverridesByGame, setRungoNameOverridesByGame] = useState<RungoNameOverridesByGame>(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    return loadRungoNameOverridesByGame(initialUnlockedRungoIds)
  })

  const unlockedRef = React.useRef(unlockedRungoIds)
  const progressRef = React.useRef(gameProgressById)
  const tokenBalanceRef = React.useRef(rungoTokenBalance)
  const tokenRollHistoryRef = React.useRef(tokenRollHistory)
  const gardenSeedBalanceRef = React.useRef(gardenSeedBalance)
  const gardenUnlockedSlotCountRef = React.useRef(gardenUnlockedSlotCount)
  const gardenSlotAssignmentsRef = React.useRef(gardenSlotAssignments)
  const gardenUnlockedThemeIdsRef = React.useRef(gardenUnlockedThemeIds)
  const activeGardenThemeIdRef = React.useRef(activeGardenThemeId)
  const rangeNeedsRef = React.useRef(rangeNeedsByRungoId)
  const rangeToyStatesRef = React.useRef(rangeToyStates)
  const rangeItemCountsRef = React.useRef(rangeItemCountsByToyId)
  const rangeFeatureStateRef = React.useRef(rangeFeatureState)
  const rangeProgressionRef = React.useRef(rangeProgression)
  const enabledOrbitRef = React.useRef(enabledOrbitRungoIds)
  const signatureRungoIdRef = React.useRef<RungoSignatureId>(signatureRungoId)
  const planetLoadoutRef = React.useRef(planetLoadoutByGame)
  const rungoTrioRef = React.useRef(rungoTrioByGame)
  const rungoNameOverridesRef = React.useRef(rungoNameOverridesByGame)
  const isAttaching = !!attachingKeychainId

  useEffect(() => {
    unlockedRef.current = unlockedRungoIds
  }, [unlockedRungoIds])

  useEffect(() => {
    progressRef.current = gameProgressById
  }, [gameProgressById])

  useEffect(() => {
    tokenBalanceRef.current = rungoTokenBalance
  }, [rungoTokenBalance])

  useEffect(() => {
    tokenRollHistoryRef.current = tokenRollHistory
  }, [tokenRollHistory])

  useEffect(() => {
    gardenSeedBalanceRef.current = gardenSeedBalance
  }, [gardenSeedBalance])

  useEffect(() => {
    gardenUnlockedSlotCountRef.current = gardenUnlockedSlotCount
  }, [gardenUnlockedSlotCount])

  useEffect(() => {
    gardenSlotAssignmentsRef.current = gardenSlotAssignments
  }, [gardenSlotAssignments])

  useEffect(() => {
    gardenUnlockedThemeIdsRef.current = gardenUnlockedThemeIds
  }, [gardenUnlockedThemeIds])

  useEffect(() => {
    activeGardenThemeIdRef.current = activeGardenThemeId
  }, [activeGardenThemeId])

  useEffect(() => {
    rangeNeedsRef.current = rangeNeedsByRungoId
  }, [rangeNeedsByRungoId])

  useEffect(() => {
    rangeToyStatesRef.current = rangeToyStates
  }, [rangeToyStates])

  useEffect(() => {
    rangeItemCountsRef.current = rangeItemCountsByToyId
  }, [rangeItemCountsByToyId])

  useEffect(() => {
    rangeFeatureStateRef.current = rangeFeatureState
  }, [rangeFeatureState])

  useEffect(() => {
    rangeProgressionRef.current = rangeProgression
  }, [rangeProgression])

  useEffect(() => {
    enabledOrbitRef.current = enabledOrbitRungoIds
  }, [enabledOrbitRungoIds])

  useEffect(() => {
    signatureRungoIdRef.current = signatureRungoId
  }, [signatureRungoId])

  useEffect(() => {
    planetLoadoutRef.current = planetLoadoutByGame
  }, [planetLoadoutByGame])

  useEffect(() => {
    rungoTrioRef.current = rungoTrioByGame
  }, [rungoTrioByGame])

  useEffect(() => {
    rungoNameOverridesRef.current = rungoNameOverridesByGame
  }, [rungoNameOverridesByGame])

  useEffect(() => {
    saveAttachments(attachments)
  }, [attachments])

  useEffect(() => {
    saveUnlockedRungoIds(unlockedRungoIds)
  }, [unlockedRungoIds])

  useEffect(() => {
    saveTokenBalance(rungoTokenBalance)
  }, [rungoTokenBalance])

  useEffect(() => {
    saveTokenRollHistory(tokenRollHistory)
  }, [tokenRollHistory])

  useEffect(() => {
    saveGardenSeedBalance(gardenSeedBalance)
  }, [gardenSeedBalance])

  useEffect(() => {
    saveGardenUnlockedSlotCount(gardenUnlockedSlotCount)
  }, [gardenUnlockedSlotCount])

  useEffect(() => {
    saveGardenSlotAssignments(gardenSlotAssignments)
  }, [gardenSlotAssignments])

  useEffect(() => {
    saveGardenUnlockedThemeIds(gardenUnlockedThemeIds)
  }, [gardenUnlockedThemeIds])

  useEffect(() => {
    saveActiveGardenThemeId(activeGardenThemeId)
  }, [activeGardenThemeId])

  useEffect(() => {
    saveRangeNeedsByRungoId(rangeNeedsByRungoId)
  }, [rangeNeedsByRungoId])

  useEffect(() => {
    saveRangeToyStates(rangeToyStates)
  }, [rangeToyStates])

  useEffect(() => {
    saveRangeItemCounts(rangeItemCountsByToyId)
  }, [rangeItemCountsByToyId])

  useEffect(() => {
    saveRangeFeatureState(rangeFeatureState)
  }, [rangeFeatureState])

  useEffect(() => {
    saveRangeProgression(rangeProgression)
  }, [rangeProgression])

  useEffect(() => {
    if (gardenUnlockedThemeIds.includes(activeGardenThemeId)) {
      return
    }

    const fallbackThemeId = gardenUnlockedThemeIds[0] ?? GARDEN_DEFAULT_THEME_ID
    activeGardenThemeIdRef.current = fallbackThemeId
    setActiveGardenThemeId(fallbackThemeId)
  }, [activeGardenThemeId, gardenUnlockedThemeIds])

  useEffect(() => {
    saveEnabledOrbitRungoIds(enabledOrbitRungoIds)
  }, [enabledOrbitRungoIds])

  useEffect(() => {
    saveSignatureRungoId(signatureRungoId)
  }, [signatureRungoId])

  useEffect(() => {
    savePlanetLoadoutByGame(planetLoadoutByGame)
  }, [planetLoadoutByGame])

  useEffect(() => {
    saveRungoTrioByGame(rungoTrioByGame)
  }, [rungoTrioByGame])

  useEffect(() => {
    saveRungoNameOverridesByGame(rungoNameOverridesByGame)
  }, [rungoNameOverridesByGame])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.dispatchEvent(new CustomEvent('tm-rungo-unlocked-updated', {
      detail: {
        unlockedRungoIds,
      },
    }))
  }, [unlockedRungoIds])

  useEffect(() => {
    saveGameProgressById(gameProgressById)
  }, [gameProgressById])

  useEffect(() => {
    const unlockedSet = new Set(unlockedRungoIds)

    setEnabledOrbitRungoIds((previous) => {
      const next = previous.filter((entry) => unlockedSet.has(entry))
      if (next.length === previous.length && next.every((entry, index) => entry === previous[index])) {
        return previous
      }

      enabledOrbitRef.current = next
      return next
    })

    setPlanetLoadoutByGame((previous) => {
      let changed = false
      const next: Record<string, string[]> = {}
      Object.entries(previous).forEach(([gameId, loadout]) => {
        const sanitized = loadout.filter((entry) => unlockedSet.has(entry))
        if (sanitized.length > 0) {
          next[gameId] = sanitized
        }
        if (sanitized.length !== loadout.length) {
          changed = true
        }
      })

      if (!changed) {
        return previous
      }

      planetLoadoutRef.current = next
      return next
    })

    setSignatureRungoIdState((previous) => {
      if (previous && unlockedSet.has(previous) && KNOWN_RUNGO_IDS.has(previous)) {
        return previous
      }

      const fallback = unlockedRungoIds.find((entry) => KNOWN_RUNGO_IDS.has(entry)) ?? null
      if (fallback === previous) {
        return previous
      }

      signatureRungoIdRef.current = fallback
      return fallback
    })

    setRungoTrioByGame((previous) => {
      const next = sanitizeRungoTrioByGame(previous, unlockedRungoIds, planetLoadoutRef.current)
      if (areRungoTrioByGameEqual(previous, next)) {
        return previous
      }

      rungoTrioRef.current = next
      return next
    })

    setRungoNameOverridesByGame((previous) => {
      let changed = false
      const next: RungoNameOverridesByGame = {}
      Object.entries(previous).forEach(([gameId, aliasByRungo]) => {
        const nextAliasByRungo: Record<string, string> = {}
        Object.entries(aliasByRungo).forEach(([rungoId, alias]) => {
          if (unlockedSet.has(rungoId) && KNOWN_RUNGO_IDS.has(rungoId) && sanitizeRungoAlias(alias)) {
            nextAliasByRungo[rungoId] = alias
          } else {
            changed = true
          }
        })

        if (Object.keys(nextAliasByRungo).length > 0) {
          next[gameId] = nextAliasByRungo
        } else if (Object.keys(aliasByRungo).length > 0) {
          changed = true
        }
      })

      if (!changed) {
        return previous
      }

      rungoNameOverridesRef.current = next
      return next
    })

    setGardenSlotAssignments((previous) => {
      const next = sanitizeGardenSlotAssignments(previous, unlockedRungoIds, gardenUnlockedSlotCountRef.current)
      if (areGardenSlotAssignmentsEqual(previous, next)) {
        return previous
      }

      gardenSlotAssignmentsRef.current = next
      return next
    })
  }, [unlockedRungoIds])

  useEffect(() => {
    setGardenSlotAssignments((previous) => {
      const next = sanitizeGardenSlotAssignments(previous, unlockedRef.current, gardenUnlockedSlotCount)
      if (areGardenSlotAssignmentsEqual(previous, next)) {
        return previous
      }

      gardenSlotAssignmentsRef.current = next
      return next
    })
  }, [gardenUnlockedSlotCount])

  const attachedKeychainIdForSystem = useCallback(
    (systemKey: string) => attachments[systemKey],
    [attachments],
  )

  const startAttaching = useCallback((keychainId: string) => {
    setAttachingKeychainId(keychainId)
  }, [])

  const cancelAttaching = useCallback(() => {
    setAttachingKeychainId(null)
  }, [])

  const attachRungoToSystem = useCallback((systemKey: string, rungoId: string) => {
    const normalizedSystemKey = systemKey.trim()
    const normalizedRungoId = rungoId.trim()
    if (!normalizedSystemKey || !normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return false
    }

    if (!unlockedRef.current.includes(normalizedRungoId)) {
      return false
    }

    setAttachments((previous) => ({
      ...previous,
      [normalizedSystemKey]: normalizedRungoId,
    }))
    setAttachingKeychainId(null)
    return true
  }, [])

  const completeAttach = useCallback(
    (systemKey: string) => {
      if (!attachingKeychainId) return
      attachRungoToSystem(systemKey, attachingKeychainId)
    },
    [attachRungoToSystem, attachingKeychainId],
  )

  const detachFromSystem = useCallback((systemKey: string) => {
    setAttachments((prev) => {
      const next = { ...prev }
      delete next[systemKey]
      return next
    })
  }, [])

  const isRungoUnlocked = useCallback((rungoId: string) => {
    return unlockedRef.current.includes(rungoId)
  }, [])

  const unlockRungo = useCallback((rungoId: string) => {
    if (!getKeychainById(rungoId)) {
      return
    }

    setUnlockedRungoIds((previous) => {
      if (previous.includes(rungoId)) {
        return previous
      }

      return [...previous, rungoId]
    })

    setEnabledOrbitRungoIds((previous) => {
      if (previous.includes(rungoId)) {
        return previous
      }

      const next = [...previous, rungoId]
      enabledOrbitRef.current = next
      return next
    })
  }, [])

  const lockRungo = useCallback((rungoId: string) => {
    if (!getKeychainById(rungoId) || RUNGO_UNLOCKED_DEFAULT_IDS.includes(rungoId)) {
      return
    }

    setUnlockedRungoIds((previous) => {
      if (!previous.includes(rungoId)) {
        return previous
      }

      const next = previous.filter((entry) => entry !== rungoId)
      unlockedRef.current = next
      return next
    })

    setAttachments((previous) => {
      let changed = false
      const next: KeychainAttachmentsMap = {}
      Object.entries(previous).forEach(([systemKey, attachedRungoId]) => {
        if (attachedRungoId === rungoId) {
          changed = true
          return
        }
        next[systemKey] = attachedRungoId
      })

      return changed ? next : previous
    })

    setAttachingKeychainId((previous) => (previous === rungoId ? null : previous))

    setEnabledOrbitRungoIds((previous) => {
      if (!previous.includes(rungoId)) {
        return previous
      }

      const next = previous.filter((entry) => entry !== rungoId)
      enabledOrbitRef.current = next
      return next
    })

    setPlanetLoadoutByGame((previous) => {
      let changed = false
      const next: Record<string, string[]> = {}
      Object.entries(previous).forEach(([gameId, loadout]) => {
        const filtered = loadout.filter((entry) => entry !== rungoId)
        if (filtered.length > 0) {
          next[gameId] = filtered
        }

        if (filtered.length !== loadout.length) {
          changed = true
        }
      })

      if (!changed) {
        return previous
      }

      planetLoadoutRef.current = next
      return next
    })

    setRungoNameOverridesByGame((previous) => {
      let changed = false
      const next: RungoNameOverridesByGame = {}
      Object.entries(previous).forEach(([gameId, aliasByRungo]) => {
        const aliasEntries = Object.entries(aliasByRungo)
        const filteredEntries = aliasEntries.filter(([entryRungoId]) => entryRungoId !== rungoId)
        if (filteredEntries.length !== aliasEntries.length) {
          changed = true
        }

        if (filteredEntries.length > 0) {
          next[gameId] = Object.fromEntries(filteredEntries)
        }
      })

      if (!changed) {
        return previous
      }

      rungoNameOverridesRef.current = next
      return next
    })

    setGardenSlotAssignments((previous) => {
      let changed = false
      const next: GardenSlotAssignments = {}
      Object.entries(previous).forEach(([slotKey, assignedRungoId]) => {
        if (assignedRungoId === rungoId) {
          changed = true
          return
        }

        next[Number(slotKey)] = assignedRungoId
      })

      if (!changed) {
        return previous
      }

      gardenSlotAssignmentsRef.current = next
      return next
    })

    setRungoTrioByGame((previous) => {
      let changed = false
      const next: RungoTrioByGame = {}
      Object.entries(previous).forEach(([gameId, assignments]) => {
        const nextAssignments: RungoTrioRoleAssignments = {}
        RUNGO_TRIO_ROLE_ORDER.forEach((role) => {
          if (assignments[role] && assignments[role] !== rungoId) {
            nextAssignments[role] = assignments[role]
          }
        })

        if (!areRungoTrioRoleAssignmentsEqual(assignments, nextAssignments)) {
          changed = true
        }

        if (Object.keys(nextAssignments).length > 0) {
          next[gameId] = nextAssignments
        }
      })

      if (!changed) {
        return previous
      }

      rungoTrioRef.current = next
      return next
    })

    setSignatureRungoIdState((previous) => {
      if (previous !== rungoId) {
        return previous
      }

      const fallback = unlockedRef.current.find((entry) => KNOWN_RUNGO_IDS.has(entry)) ?? null
      signatureRungoIdRef.current = fallback
      return fallback
    })

    setRangeNeedsByRungoId((previous) => {
      if (!previous[rungoId]) {
        return previous
      }

      const next = { ...previous }
      delete next[rungoId]
      rangeNeedsRef.current = next
      return next
    })
  }, [])

  const debugRollRungo = useCallback((): DebugRungoRollResult => {
    const awardedRungoId = pickWeightedRungoId()
    if (!awardedRungoId) {
      return {
        awardedRungoId: null,
        duplicate: false,
      }
    }

    const duplicate = unlockedRef.current.includes(awardedRungoId)
    if (!duplicate) {
      const nextUnlocked = [...new Set([...unlockedRef.current, awardedRungoId])]
      unlockedRef.current = nextUnlocked
      setUnlockedRungoIds(nextUnlocked)
      setEnabledOrbitRungoIds((previous) => {
        if (previous.includes(awardedRungoId)) {
          return previous
        }

        const next = [...previous, awardedRungoId]
        enabledOrbitRef.current = next
        return next
      })
    }

    return {
      awardedRungoId,
      duplicate,
    }
  }, [])

  const getGardenSlotUnlockCost = useCallback(() => {
    return resolveGardenSlotUnlockCost(gardenUnlockedSlotCountRef.current)
  }, [])

  const unlockNextGardenSlot = useCallback((): UnlockGardenSlotResult => {
    const nextCost = resolveGardenSlotUnlockCost(gardenUnlockedSlotCountRef.current)
    if (nextCost === null) {
      return {
        updated: false,
        reason: 'maxed',
        nextSlotCount: gardenUnlockedSlotCountRef.current,
        spentSeeds: 0,
        seedBalance: gardenSeedBalanceRef.current,
        nextCost: null,
      }
    }

    if (gardenSeedBalanceRef.current < nextCost) {
      return {
        updated: false,
        reason: 'insufficient',
        nextSlotCount: gardenUnlockedSlotCountRef.current,
        spentSeeds: 0,
        seedBalance: gardenSeedBalanceRef.current,
        nextCost,
      }
    }

    const nextSeedBalance = gardenSeedBalanceRef.current - nextCost
    const nextSlotCount = Math.min(gardenUnlockedSlotCountRef.current + 1, GARDEN_MAX_SLOT_COUNT)
    gardenSeedBalanceRef.current = nextSeedBalance
    gardenUnlockedSlotCountRef.current = nextSlotCount
    setGardenSeedBalance(nextSeedBalance)
    setGardenUnlockedSlotCount(nextSlotCount)

    return {
      updated: true,
      reason: 'ok',
      nextSlotCount,
      spentSeeds: nextCost,
      seedBalance: nextSeedBalance,
      nextCost: resolveGardenSlotUnlockCost(nextSlotCount),
    }
  }, [])

  const setGardenSlotRungo = useCallback((slotIndex: number, rungoId: string | null) => {
    const normalizedSlotIndex = Math.floor(slotIndex)
    if (!Number.isFinite(normalizedSlotIndex)
      || normalizedSlotIndex < 0
      || normalizedSlotIndex >= gardenUnlockedSlotCountRef.current) {
      return false
    }

    const normalizedRungoId = typeof rungoId === 'string' ? rungoId.trim() : ''
    if (normalizedRungoId) {
      if (!KNOWN_RUNGO_IDS.has(normalizedRungoId) || !unlockedRef.current.includes(normalizedRungoId)) {
        return false
      }
    }

    const nextAssignments: GardenSlotAssignments = { ...gardenSlotAssignmentsRef.current }
    let changed = false
    if (normalizedRungoId) {
      Object.entries(nextAssignments).forEach(([key, assignedRungoId]) => {
        const assignmentSlotIndex = Number(key)
        if (assignmentSlotIndex !== normalizedSlotIndex && assignedRungoId === normalizedRungoId) {
          delete nextAssignments[assignmentSlotIndex]
          changed = true
        }
      })

      if (nextAssignments[normalizedSlotIndex] !== normalizedRungoId) {
        nextAssignments[normalizedSlotIndex] = normalizedRungoId
        changed = true
      }
    } else if (typeof nextAssignments[normalizedSlotIndex] === 'string') {
      delete nextAssignments[normalizedSlotIndex]
      changed = true
    }

    if (!changed) {
      return false
    }

    const sanitized = sanitizeGardenSlotAssignments(
      nextAssignments,
      unlockedRef.current,
      gardenUnlockedSlotCountRef.current,
    )
    gardenSlotAssignmentsRef.current = sanitized
    setGardenSlotAssignments(sanitized)
    return true
  }, [])

  const setActiveGardenTheme = useCallback((themeId: GardenThemeId) => {
    if (!isGardenThemeId(themeId) || !gardenUnlockedThemeIdsRef.current.includes(themeId)) {
      return false
    }

    if (activeGardenThemeIdRef.current === themeId) {
      return true
    }

    activeGardenThemeIdRef.current = themeId
    setActiveGardenThemeId(themeId)
    return true
  }, [])

  const ensureRangeNeedsForRungo = useCallback((rungoId: string): RangeNeedsState | null => {
    const normalizedRungoId = rungoId.trim()
    if (!normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return null
    }

    const existing = rangeNeedsRef.current[normalizedRungoId]
    if (existing) {
      return existing
    }

    const created = createDefaultRangeNeedsState()
    const nextNeeds = {
      ...rangeNeedsRef.current,
      [normalizedRungoId]: created,
    }
    rangeNeedsRef.current = nextNeeds
    setRangeNeedsByRungoId(nextNeeds)
    return created
  }, [])

  const applyRangeNeedsDelta = useCallback((
    rungoId: string,
    delta: RangeNeedsDelta,
    source: 'decay' | 'toy' | 'conversation' | 'rest' = 'decay',
  ): RangeNeedsState | null => {
    const normalizedRungoId = rungoId.trim()
    if (!normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return null
    }

    const previous = rangeNeedsRef.current[normalizedRungoId] ?? createDefaultRangeNeedsState()
    const nextState: RangeNeedsState = {
      mood: clampNumber(previous.mood + (delta.mood ?? 0), 0, 100),
      energy: clampNumber(previous.energy + (delta.energy ?? 0), 0, 100),
      hunger: clampNumber(previous.hunger + (delta.hunger ?? 0), 0, 100),
      updatedAt: Date.now(),
      totalToyInteractions: previous.totalToyInteractions + (source === 'toy' ? 1 : 0),
      totalConversations: previous.totalConversations + (source === 'conversation' ? 1 : 0),
    }

    const nextNeeds = {
      ...rangeNeedsRef.current,
      [normalizedRungoId]: nextState,
    }
    rangeNeedsRef.current = nextNeeds
    setRangeNeedsByRungoId(nextNeeds)
    return nextState
  }, [])

  const decayRangeNeeds = useCallback((rungoIds: string[], elapsedMs: number) => {
    if (!Array.isArray(rungoIds) || rungoIds.length === 0 || elapsedMs <= 0) {
      return
    }

    const elapsedMinutes = elapsedMs / 60000
    const hasRestfulBreezePerk = rangeProgressionRef.current.unlockedPerkIds.includes('restful-breeze')
    const moodDecayPerMinute = 0.18
    const energyDecayPerMinute = hasRestfulBreezePerk ? 0.2 : 0.22
    const hungerRisePerMinute = 0.16
    const now = Date.now()

    let changed = false
    const nextNeeds: RangeNeedsByRungoId = { ...rangeNeedsRef.current }
    const uniqueRungoIds = [...new Set(rungoIds)]
    uniqueRungoIds.forEach((rungoId) => {
      const normalizedRungoId = rungoId.trim()
      if (!normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
        return
      }

      const previous = nextNeeds[normalizedRungoId] ?? createDefaultRangeNeedsState(now)
      const nextState: RangeNeedsState = {
        ...previous,
        mood: clampNumber(previous.mood - (moodDecayPerMinute * elapsedMinutes), 0, 100),
        energy: clampNumber(previous.energy - (energyDecayPerMinute * elapsedMinutes), 0, 100),
        hunger: clampNumber(previous.hunger + (hungerRisePerMinute * elapsedMinutes), 0, 100),
        updatedAt: now,
      }

      if (
        nextState.mood !== previous.mood
        || nextState.energy !== previous.energy
        || nextState.hunger !== previous.hunger
        || !nextNeeds[normalizedRungoId]
      ) {
        nextNeeds[normalizedRungoId] = nextState
        changed = true
      }
    })

    if (!changed) {
      return
    }

    rangeNeedsRef.current = nextNeeds
    setRangeNeedsByRungoId(nextNeeds)
  }, [])

  const hasRangePerk = useCallback((perkId: RangePerkId) => {
    return rangeProgressionRef.current.unlockedPerkIds.includes(perkId)
  }, [])

  const getRangeItemCount = useCallback((toyId: string): number => {
    const normalizedToyId = toyId.trim()
    if (!normalizedToyId) {
      return 0
    }

    const current = rangeItemCountsRef.current[normalizedToyId]
    if (!Number.isFinite(current)) {
      return 0
    }

    return Math.max(0, Math.floor(current))
  }, [])

  const consumeRangeItemCount = useCallback((toyId: string, amount = 1): number | null => {
    const normalizedToyId = toyId.trim()
    if (!normalizedToyId || !Object.prototype.hasOwnProperty.call(RANGE_DEFAULT_ITEM_COUNTS, normalizedToyId)) {
      return null
    }

    const decrementBy = Math.max(1, Math.floor(Number(amount) || 1))
    const currentCount = getRangeItemCount(normalizedToyId)
    if (currentCount < decrementBy) {
      return null
    }

    const nextCounts: RangeItemCountsByToyId = {
      ...rangeItemCountsRef.current,
      [normalizedToyId]: currentCount - decrementBy,
    }

    rangeItemCountsRef.current = nextCounts
    setRangeItemCountsByToyId(nextCounts)
    return nextCounts[normalizedToyId]
  }, [getRangeItemCount])

  const applyRangeToyEffect = useCallback((
    toyId: string,
    rungoId: string,
    options?: {
      bypassUnlock?: boolean
      bypassCooldown?: boolean
      startCooldown?: boolean
    },
  ): RangeToyState | null => {
    const normalizedToyId = toyId.trim()
    const normalizedRungoId = rungoId.trim()
    if (!normalizedToyId || !normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return null
    }

    if (!options?.bypassUnlock && !rangeFeatureStateRef.current.unlockedToyIds.includes(normalizedToyId)) {
      return null
    }

    const now = Date.now()
    const toyIndex = rangeToyStatesRef.current.findIndex((entry) => entry.id === normalizedToyId)
    if (toyIndex < 0) {
      return null
    }

    const toy = rangeToyStatesRef.current[toyIndex]
    if (!options?.bypassCooldown && toy.availableAt > now) {
      return null
    }

    const shouldStartCooldown = options?.startCooldown ?? true

    const updatedToy: RangeToyState = {
      ...toy,
      availableAt: shouldStartCooldown ? now + toy.cooldownMs : toy.availableAt,
      totalUses: toy.totalUses + 1,
      lastUsedAt: now,
    }

    const nextToyStates = [...rangeToyStatesRef.current]
    nextToyStates[toyIndex] = updatedToy
    rangeToyStatesRef.current = nextToyStates
    setRangeToyStates(nextToyStates)

    const currentProgression = rangeProgressionRef.current
    let eventMoodBonus = 0
    let eventEnergyBonus = 0
    let nextProgression = currentProgression
    if (currentProgression.activeMiniEvent) {
      if (currentProgression.activeMiniEvent.endsAt <= now) {
        nextProgression = {
          ...currentProgression,
          activeMiniEvent: null,
          miniEventCooldownEndsAt: now + RANGE_MINI_EVENT_COOLDOWN_MS,
        }
      } else {
        const activeEvent = currentProgression.activeMiniEvent
        const nextToyInteractions = clampNumber(
          activeEvent.toyInteractions + 1,
          0,
          activeEvent.targetToyInteractions,
        )
        eventMoodBonus = activeEvent.moodBonus
        eventEnergyBonus = activeEvent.energyBonus

        if (nextToyInteractions >= activeEvent.targetToyInteractions) {
          const nextSeedBalance = gardenSeedBalanceRef.current + activeEvent.rewardSeeds
          gardenSeedBalanceRef.current = nextSeedBalance
          setGardenSeedBalance(nextSeedBalance)

          nextProgression = {
            ...currentProgression,
            progressionPoints: currentProgression.progressionPoints + activeEvent.rewardPoints,
            activeMiniEvent: null,
            miniEventHistory: [
              ...currentProgression.miniEventHistory,
              {
                id: activeEvent.id,
                name: activeEvent.name,
                completedAt: now,
                rewardSeeds: activeEvent.rewardSeeds,
                rewardPoints: activeEvent.rewardPoints,
              },
            ].slice(-120),
            miniEventCooldownEndsAt: now + RANGE_MINI_EVENT_COOLDOWN_MS,
            nextMiniEventCheckAt: now + RANGE_MINI_EVENT_CHECK_INTERVAL_MS,
          }
        } else {
          nextProgression = {
            ...currentProgression,
            activeMiniEvent: {
              ...activeEvent,
              toyInteractions: nextToyInteractions,
            },
          }
        }
      }
    }

    if (nextProgression !== currentProgression) {
      rangeProgressionRef.current = nextProgression
      setRangeProgression(nextProgression)
    }

    applyRangeNeedsDelta(
      normalizedRungoId,
      {
        mood: updatedToy.moodBoost + eventMoodBonus,
        energy: updatedToy.energyBoost + eventEnergyBonus,
        hunger: updatedToy.hungerDelta,
      },
      'toy',
    )

    return updatedToy
  }, [applyRangeNeedsDelta])

  const applyRangeToyEffectDirect = useCallback((toyId: string, rungoId: string): RangeToyState | null => {
    return applyRangeToyEffect(toyId, rungoId, {
      bypassUnlock: true,
      bypassCooldown: true,
      startCooldown: false,
    })
  }, [applyRangeToyEffect])

  const consumeRangeToy = useCallback((toyId: string, rungoId: string): RangeToyState | null => {
    return applyRangeToyEffect(toyId, rungoId)
  }, [applyRangeToyEffect])

  const maybeActivateRangeMiniEvent = useCallback((residentCount: number, nowValue?: number): RangeMiniEventState | null => {
    const now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now()
    const current = rangeProgressionRef.current

    if (current.activeMiniEvent) {
      if (current.activeMiniEvent.endsAt > now) {
        return current.activeMiniEvent
      }

      const nextAfterExpiry: RangeProgressionState = {
        ...current,
        activeMiniEvent: null,
        miniEventCooldownEndsAt: now + RANGE_MINI_EVENT_COOLDOWN_MS,
      }
      rangeProgressionRef.current = nextAfterExpiry
      setRangeProgression(nextAfterExpiry)
      return null
    }

    if (now < current.nextMiniEventCheckAt) {
      return null
    }

    let nextProgression: RangeProgressionState = {
      ...current,
      nextMiniEventCheckAt: now + RANGE_MINI_EVENT_CHECK_INTERVAL_MS,
    }

    if (
      residentCount < RANGE_MINI_EVENT_MIN_RESIDENTS
      || now < current.miniEventCooldownEndsAt
      || Math.random() >= RANGE_MINI_EVENT_TRIGGER_CHANCE
    ) {
      rangeProgressionRef.current = nextProgression
      setRangeProgression(nextProgression)
      return null
    }

    const eventDefinition = RANGE_MINI_EVENT_CATALOG[Math.floor(Math.random() * RANGE_MINI_EVENT_CATALOG.length)]
    if (!eventDefinition) {
      rangeProgressionRef.current = nextProgression
      setRangeProgression(nextProgression)
      return null
    }

    const activeMiniEvent: RangeMiniEventState = {
      ...eventDefinition,
      startsAt: now,
      endsAt: now + RANGE_MINI_EVENT_DURATION_MS,
      toyInteractions: 0,
    }
    nextProgression = {
      ...nextProgression,
      activeMiniEvent,
    }

    rangeProgressionRef.current = nextProgression
    setRangeProgression(nextProgression)
    return activeMiniEvent
  }, [])

  const applyRangeProgressionFromHours = useCallback((highestCreditedHours: number, awardedPoints: number) => {
    const current = rangeProgressionRef.current
    const autoPerkIds = resolveRangePerkUnlocksByHours(highestCreditedHours)
    const autoCosmeticIds = resolveRangeCosmeticUnlocksByHours(highestCreditedHours)
    const nextUnlockedPerkIds = [...new Set([...current.unlockedPerkIds, ...autoPerkIds])]
    const nextUnlockedCosmeticIds = [...new Set([...current.unlockedCosmeticIds, ...autoCosmeticIds])]
    const newlyUnlockedRangePerkIds = nextUnlockedPerkIds.filter((entry) => !current.unlockedPerkIds.includes(entry))
    const newlyUnlockedRangeCosmeticIds = nextUnlockedCosmeticIds.filter((entry) => !current.unlockedCosmeticIds.includes(entry))

    const nextProgression: RangeProgressionState = {
      ...current,
      progressionPoints: current.progressionPoints + Math.max(0, Math.floor(awardedPoints)),
      unlockedPerkIds: nextUnlockedPerkIds,
      unlockedCosmeticIds: nextUnlockedCosmeticIds,
    }

    if (
      nextProgression.progressionPoints !== current.progressionPoints
      || newlyUnlockedRangePerkIds.length > 0
      || newlyUnlockedRangeCosmeticIds.length > 0
    ) {
      rangeProgressionRef.current = nextProgression
      setRangeProgression(nextProgression)
    }

    return {
      newlyUnlockedRangePerkIds,
      newlyUnlockedRangeCosmeticIds,
      awardedRangeProgressionPoints: Math.max(0, Math.floor(awardedPoints)),
    }
  }, [])

  const applyRangeFeatureUnlocksByHours = useCallback((highestCreditedHours: number) => {
    const normalizedHours = clampNumber(Math.floor(highestCreditedHours), 0, RUNGO_MAX_CREDITED_HOURS)
    const current = rangeFeatureStateRef.current
    const autoUnlockedToyIds = resolveUnlockedRangeToyIdsByHours(normalizedHours)
    const autoUnlockedTierIds = resolveUnlockedRangeTierIdsByHours(normalizedHours)
    const nextUnlockedToyIds = orderedRangeToyIds([...current.unlockedToyIds, ...autoUnlockedToyIds])
    const nextUnlockedTierIds = orderedRangeTierIds([...current.unlockedTierIds, ...autoUnlockedTierIds])
    const newlyUnlockedRangeToyIds = nextUnlockedToyIds.filter((toyId) => !current.unlockedToyIds.includes(toyId))
    const newlyUnlockedRangeTierIds = nextUnlockedTierIds.filter((tierId) => !current.unlockedTierIds.includes(tierId))

    const nextHighestHours = Math.max(current.highestCreditedHours, normalizedHours)
    const hasChanges = nextHighestHours !== current.highestCreditedHours
      || newlyUnlockedRangeToyIds.length > 0
      || newlyUnlockedRangeTierIds.length > 0

    if (hasChanges) {
      const nextFeatureState: RangeFeatureState = {
        schemaVersion: RANGE_FEATURE_STATE_SCHEMA_VERSION,
        highestCreditedHours: nextHighestHours,
        unlockedToyIds: nextUnlockedToyIds,
        unlockedTierIds: nextUnlockedTierIds,
      }
      rangeFeatureStateRef.current = nextFeatureState
      setRangeFeatureState(nextFeatureState)
    }

    return {
      newlyUnlockedRangeToyIds,
      newlyUnlockedRangeTierIds,
    }
  }, [])

  useEffect(() => {
    applyRangeFeatureUnlocksByHours(getMaxCreditedHours(gameProgressById))
  }, [applyRangeFeatureUnlocksByHours, gameProgressById])

  const resolveClaimableMilestones = useCallback((gameId: string, playtimeMinutes: number): {
    normalizedGameId: string
    creditedHours: number
    currentProgress: GameRungoProgress
    nextMilestones: number[]
  } => {
    const normalizedGameId = gameId.trim()
    if (!normalizedGameId) {
      return {
        normalizedGameId: '',
        creditedHours: 0,
        currentProgress: createDefaultGameProgress(),
        nextMilestones: [],
      }
    }

    const creditedHours = clampNumber(Math.floor(Math.max(0, playtimeMinutes) / 60), 0, RUNGO_MAX_CREDITED_HOURS)
    const currentProgress = progressRef.current[normalizedGameId] ?? createDefaultGameProgress()
    const processedMilestones = new Set(currentProgress.processedMilestones)
    const nextMilestones = RUNGO_MILESTONES.filter((milestone) => milestone <= creditedHours && !processedMilestones.has(milestone))

    return {
      normalizedGameId,
      creditedHours,
      currentProgress,
      nextMilestones,
    }
  }, [])

  const getClaimableTokenCountForGame = useCallback((gameId: string, playtimeMinutes: number) => {
    return resolveClaimableMilestones(gameId, playtimeMinutes).nextMilestones.length
  }, [resolveClaimableMilestones])

  const getTotalClaimableTokenCount = useCallback((entries: Array<{ gameId: string; playtimeMinutes: number }>) => {
    return entries.reduce((total, entry) => (
      total + getClaimableTokenCountForGame(entry.gameId, entry.playtimeMinutes)
    ), 0)
  }, [getClaimableTokenCountForGame])

  const claimGamePlaytimeTokens = useCallback((gameId: string, playtimeMinutes: number): ClaimGameTokenResult => {
    const {
      normalizedGameId,
      creditedHours,
      currentProgress,
      nextMilestones,
    } = resolveClaimableMilestones(gameId, playtimeMinutes)

    if (!normalizedGameId) {
      return {
        gameId: '',
        creditedHours: 0,
        claimedMilestones: [],
        claimedTokens: 0,
        tokenBalance: tokenBalanceRef.current,
        highestCreditedHours: getMaxCreditedHours(progressRef.current),
        newlyUnlockedGardenThemeIds: [],
        awardedRangeProgressionPoints: 0,
        newlyUnlockedRangePerkIds: [],
        newlyUnlockedRangeCosmeticIds: [],
        newlyUnlockedRangeToyIds: [],
        newlyUnlockedRangeTierIds: [],
      }
    }

    const nextCreditedHours = Math.max(currentProgress.creditedHours, creditedHours)
    const nextProcessedMilestones = [...new Set([...currentProgress.processedMilestones, ...nextMilestones])]
    const nextProgressById = {
      ...progressRef.current,
      [normalizedGameId]: {
        ...currentProgress,
        creditedHours: nextCreditedHours,
        processedMilestones: nextProcessedMilestones,
        updatedAt: Date.now(),
      },
    }
    progressRef.current = nextProgressById
    setGameProgressById(nextProgressById)

    const claimedTokens = nextMilestones.length
    if (claimedTokens > 0) {
      const nextTokenBalance = tokenBalanceRef.current + claimedTokens
      tokenBalanceRef.current = nextTokenBalance
      setRungoTokenBalance(nextTokenBalance)
    }

    const highestCreditedHours = getMaxCreditedHours(nextProgressById)
    const nextAutoUnlockedThemes = resolveGardenThemeUnlocksByHours(highestCreditedHours)
    const previousThemeIds = gardenUnlockedThemeIdsRef.current
    const nextThemeIds = orderedGardenThemeIds([
      ...previousThemeIds,
      ...nextAutoUnlockedThemes,
      GARDEN_DEFAULT_THEME_ID,
    ])
    const newlyUnlockedGardenThemeIds = nextThemeIds.filter((themeId) => !previousThemeIds.includes(themeId))
    if (newlyUnlockedGardenThemeIds.length > 0) {
      gardenUnlockedThemeIdsRef.current = nextThemeIds
      setGardenUnlockedThemeIds(nextThemeIds)
    }

    const awardedRangeProgressionPoints = claimedTokens * 10
    const rangeProgressionUpdate = applyRangeProgressionFromHours(
      highestCreditedHours,
      awardedRangeProgressionPoints,
    )
    const rangeFeatureUpdate = applyRangeFeatureUnlocksByHours(highestCreditedHours)

    return {
      gameId: normalizedGameId,
      creditedHours: nextCreditedHours,
      claimedMilestones: nextMilestones,
      claimedTokens,
      tokenBalance: tokenBalanceRef.current,
      highestCreditedHours,
      newlyUnlockedGardenThemeIds,
      awardedRangeProgressionPoints: rangeProgressionUpdate.awardedRangeProgressionPoints,
      newlyUnlockedRangePerkIds: rangeProgressionUpdate.newlyUnlockedRangePerkIds,
      newlyUnlockedRangeCosmeticIds: rangeProgressionUpdate.newlyUnlockedRangeCosmeticIds,
      newlyUnlockedRangeToyIds: rangeFeatureUpdate.newlyUnlockedRangeToyIds,
      newlyUnlockedRangeTierIds: rangeFeatureUpdate.newlyUnlockedRangeTierIds,
    }
  }, [applyRangeFeatureUnlocksByHours, applyRangeProgressionFromHours, resolveClaimableMilestones])

  const claimAllGamePlaytimeTokens = useCallback((entries: Array<{ gameId: string; playtimeMinutes: number }>): ClaimAllGameTokensResult => {
    const aggregate: ClaimAllGameTokensResult = {
      claimedTokens: 0,
      tokenBalance: tokenBalanceRef.current,
      gamesClaimed: 0,
      newlyUnlockedGardenThemeIds: [],
      awardedRangeProgressionPoints: 0,
      newlyUnlockedRangePerkIds: [],
      newlyUnlockedRangeCosmeticIds: [],
      newlyUnlockedRangeToyIds: [],
      newlyUnlockedRangeTierIds: [],
    }

    for (const entry of entries) {
      const claimable = getClaimableTokenCountForGame(entry.gameId, entry.playtimeMinutes)
      if (claimable <= 0) {
        continue
      }

      const result = claimGamePlaytimeTokens(entry.gameId, entry.playtimeMinutes)
      if (result.claimedTokens <= 0) {
        continue
      }

      aggregate.claimedTokens += result.claimedTokens
      aggregate.tokenBalance = result.tokenBalance
      aggregate.gamesClaimed += 1
      aggregate.awardedRangeProgressionPoints += result.awardedRangeProgressionPoints
      aggregate.newlyUnlockedGardenThemeIds = [...new Set([
        ...aggregate.newlyUnlockedGardenThemeIds,
        ...result.newlyUnlockedGardenThemeIds,
      ])]
      aggregate.newlyUnlockedRangePerkIds = [...new Set([
        ...aggregate.newlyUnlockedRangePerkIds,
        ...result.newlyUnlockedRangePerkIds,
      ])]
      aggregate.newlyUnlockedRangeCosmeticIds = [...new Set([
        ...aggregate.newlyUnlockedRangeCosmeticIds,
        ...result.newlyUnlockedRangeCosmeticIds,
      ])]
      aggregate.newlyUnlockedRangeToyIds = [...new Set([
        ...aggregate.newlyUnlockedRangeToyIds,
        ...result.newlyUnlockedRangeToyIds,
      ])]
      aggregate.newlyUnlockedRangeTierIds = [...new Set([
        ...aggregate.newlyUnlockedRangeTierIds,
        ...result.newlyUnlockedRangeTierIds,
      ])]
    }

    return aggregate
  }, [claimGamePlaytimeTokens, getClaimableTokenCountForGame])

  const rollRungoWithToken = useCallback((sourceGameId?: string, options?: RollRungoWithTokenOptions): RollRungoWithTokenResult => {
    const normalizedSourceGameId = typeof sourceGameId === 'string' && sourceGameId.trim() ? sourceGameId.trim() : null
    const debugInfiniteTokens = Boolean(options?.debugInfiniteTokens)
    const currentTokenBalance = tokenBalanceRef.current
    if (!debugInfiniteTokens && currentTokenBalance <= 0) {
      return {
        awardedRungoId: null,
        duplicate: false,
        awardedSeeds: 0,
        tokenBalance: currentTokenBalance,
        gardenSeedBalance: gardenSeedBalanceRef.current,
        spentToken: false,
        sourceGameId: normalizedSourceGameId,
        error: 'No tokens available.',
      }
    }

    const awardedRungoId = pickWeightedRungoId()
    if (!awardedRungoId) {
      return {
        awardedRungoId: null,
        duplicate: false,
        awardedSeeds: 0,
        tokenBalance: currentTokenBalance,
        gardenSeedBalance: gardenSeedBalanceRef.current,
        spentToken: false,
        sourceGameId: normalizedSourceGameId,
        error: 'No spawn-eligible Rungos are configured.',
      }
    }

    const nextTokenBalance = debugInfiniteTokens ? currentTokenBalance : currentTokenBalance - 1
    if (!debugInfiniteTokens) {
      tokenBalanceRef.current = nextTokenBalance
      setRungoTokenBalance(nextTokenBalance)
    }

    const duplicate = unlockedRef.current.includes(awardedRungoId)
    const baseAwardedSeeds = duplicate ? resolveSeedRewardForRungo(awardedRungoId) : 0
    const perkBonusSeeds = duplicate && hasRangePerk('seed-whisper') ? 1 : 0
    const awardedSeeds = baseAwardedSeeds + perkBonusSeeds
    if (!duplicate) {
      const nextUnlocked = [...new Set([...unlockedRef.current, awardedRungoId])]
      unlockedRef.current = nextUnlocked
      setUnlockedRungoIds(nextUnlocked)
      setEnabledOrbitRungoIds((previous) => {
        if (previous.includes(awardedRungoId)) {
          return previous
        }

        const next = [...previous, awardedRungoId]
        enabledOrbitRef.current = next
        return next
      })
    } else if (awardedSeeds > 0) {
      const nextSeedBalance = gardenSeedBalanceRef.current + awardedSeeds
      gardenSeedBalanceRef.current = nextSeedBalance
      setGardenSeedBalance(nextSeedBalance)
    }

    const nextRollHistory = [
      ...tokenRollHistoryRef.current,
      {
        awardedRungoId,
        duplicate,
        sourceGameId: normalizedSourceGameId,
        tokenCost: debugInfiniteTokens ? 0 : 1,
        createdAt: Date.now(),
      },
    ].slice(-200)
    tokenRollHistoryRef.current = nextRollHistory
    setTokenRollHistory(nextRollHistory)

    return {
      awardedRungoId,
      duplicate,
      awardedSeeds,
      tokenBalance: nextTokenBalance,
      gardenSeedBalance: gardenSeedBalanceRef.current,
      spentToken: !debugInfiniteTokens,
      sourceGameId: normalizedSourceGameId,
      error: null,
    }
  }, [hasRangePerk])

  const isRungoEnabledInOrbit = useCallback((rungoId: string) => {
    return enabledOrbitRef.current.includes(rungoId)
  }, [])

  const setSignatureRungoId = useCallback((rungoId: string) => {
    const normalizedRungoId = rungoId.trim()
    if (!normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId) || !unlockedRef.current.includes(normalizedRungoId)) {
      return false
    }

    if (signatureRungoIdRef.current === normalizedRungoId) {
      return true
    }

    signatureRungoIdRef.current = normalizedRungoId
    setSignatureRungoIdState(normalizedRungoId)
    saveSignatureRungoId(normalizedRungoId)
    return true
  }, [])

  const setRungoOrbitEnabled = useCallback((rungoId: string, enabled: boolean) => {
    if (!KNOWN_RUNGO_IDS.has(rungoId) || !unlockedRef.current.includes(rungoId)) {
      return
    }

    setEnabledOrbitRungoIds((previous) => {
      const currentlyEnabled = previous.includes(rungoId)
      if (enabled && currentlyEnabled) {
        return previous
      }
      if (!enabled && !currentlyEnabled) {
        return previous
      }

      const next = enabled
        ? [...previous, rungoId]
        : previous.filter((entry) => entry !== rungoId)
      enabledOrbitRef.current = next
      return next
    })

    if (!enabled) {
      setPlanetLoadoutByGame((previous) => {
        let changed = false
        const next: Record<string, string[]> = {}
        Object.entries(previous).forEach(([gameId, loadout]) => {
          const filtered = loadout.filter((entry) => entry !== rungoId)
          if (filtered.length > 0) {
            next[gameId] = filtered
          }

          if (filtered.length !== loadout.length) {
            changed = true
          }
        })

        if (!changed) {
          return previous
        }

        planetLoadoutRef.current = next
        return next
      })

      setRungoTrioByGame((previous) => {
        let changed = false
        const next: RungoTrioByGame = {}
        Object.entries(previous).forEach(([gameId, assignments]) => {
          const nextAssignments: RungoTrioRoleAssignments = {}
          RUNGO_TRIO_ROLE_ORDER.forEach((role) => {
            if (assignments[role] && assignments[role] !== rungoId) {
              nextAssignments[role] = assignments[role]
            }
          })

          if (!areRungoTrioRoleAssignmentsEqual(assignments, nextAssignments)) {
            changed = true
          }

          if (Object.keys(nextAssignments).length > 0) {
            next[gameId] = nextAssignments
          }
        })

        if (!changed) {
          return previous
        }

        rungoTrioRef.current = next
        return next
      })
    }
  }, [])

  const getPlanetLoadoutForGame = useCallback((gameId: string) => {
    const normalizedGameId = gameId.trim()
    if (!normalizedGameId) {
      return []
    }

    const unlockedSet = new Set(unlockedRef.current)
    return (planetLoadoutRef.current[normalizedGameId] ?? []).filter((entry) => unlockedSet.has(entry))
  }, [])

  const addRungoToPlanetLoadout = useCallback((gameId: string, rungoId: string, maxSlots: number): PlanetLoadoutUpdateResult => {
    const normalizedGameId = gameId.trim()
    const normalizedRungoId = rungoId.trim()
    const resolvedMaxSlots = Math.max(0, Math.floor(maxSlots))
    if (!normalizedGameId || !normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return {
        updated: false,
        reason: 'invalid',
        loadout: [],
      }
    }

    if (!unlockedRef.current.includes(normalizedRungoId)) {
      return {
        updated: false,
        reason: 'locked',
        loadout: getPlanetLoadoutForGame(normalizedGameId),
      }
    }

    const currentLoadout = getPlanetLoadoutForGame(normalizedGameId)
    if (currentLoadout.includes(normalizedRungoId)) {
      return {
        updated: false,
        reason: 'already-present',
        loadout: currentLoadout,
      }
    }

    if (resolvedMaxSlots <= 0 || currentLoadout.length >= resolvedMaxSlots) {
      return {
        updated: false,
        reason: 'capacity',
        loadout: currentLoadout,
      }
    }

    const nextLoadout = [...currentLoadout, normalizedRungoId]
    const nextByGame = {
      ...planetLoadoutRef.current,
      [normalizedGameId]: nextLoadout,
    }
    planetLoadoutRef.current = nextByGame
    setPlanetLoadoutByGame(nextByGame)

    return {
      updated: true,
      reason: 'ok',
      loadout: nextLoadout,
    }
  }, [getPlanetLoadoutForGame])

  const removeRungoFromPlanetLoadout = useCallback((gameId: string, rungoId: string): PlanetLoadoutUpdateResult => {
    const normalizedGameId = gameId.trim()
    const normalizedRungoId = rungoId.trim()
    if (!normalizedGameId || !normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return {
        updated: false,
        reason: 'invalid',
        loadout: [],
      }
    }

    const currentLoadout = getPlanetLoadoutForGame(normalizedGameId)
    if (!currentLoadout.includes(normalizedRungoId)) {
      return {
        updated: false,
        reason: 'not-found',
        loadout: currentLoadout,
      }
    }

    const nextLoadout = currentLoadout.filter((entry) => entry !== normalizedRungoId)
    const nextByGame = { ...planetLoadoutRef.current }
    if (nextLoadout.length > 0) {
      nextByGame[normalizedGameId] = nextLoadout
    } else {
      delete nextByGame[normalizedGameId]
    }

    planetLoadoutRef.current = nextByGame
    setPlanetLoadoutByGame(nextByGame)

    setRungoTrioByGame((previous) => {
      const previousForGame = previous[normalizedGameId] ?? {}
      if (Object.keys(previousForGame).length === 0) {
        return previous
      }

      const nextForGame: RungoTrioRoleAssignments = {}
      RUNGO_TRIO_ROLE_ORDER.forEach((role) => {
        if (previousForGame[role] && previousForGame[role] !== normalizedRungoId) {
          nextForGame[role] = previousForGame[role]
        }
      })

      if (areRungoTrioRoleAssignmentsEqual(previousForGame, nextForGame)) {
        return previous
      }

      const nextByGame = { ...previous }
      if (Object.keys(nextForGame).length > 0) {
        nextByGame[normalizedGameId] = nextForGame
      } else {
        delete nextByGame[normalizedGameId]
      }

      rungoTrioRef.current = nextByGame
      return nextByGame
    })

    return {
      updated: true,
      reason: 'ok',
      loadout: nextLoadout,
    }
  }, [getPlanetLoadoutForGame])

  const getRungoTrioForGame = useCallback((gameId: string): RungoTrioRoleAssignments => {
    const normalizedGameId = gameId.trim()
    if (!normalizedGameId) {
      return {}
    }

    const allowedRungoIds = new Set(getPlanetLoadoutForGame(normalizedGameId))
    const assignments = rungoTrioRef.current[normalizedGameId] ?? {}
    return sanitizeRungoTrioRoleAssignments(assignments, allowedRungoIds)
  }, [getPlanetLoadoutForGame])

  const setRungoTrioRoleForGame = useCallback((gameId: string, role: RungoTrioRole, rungoId: string | null) => {
    const normalizedGameId = gameId.trim()
    if (!normalizedGameId || !isRungoTrioRole(role)) {
      return
    }

    const allowedRungoIds = new Set(getPlanetLoadoutForGame(normalizedGameId))
    const normalizedRungoId = typeof rungoId === 'string' ? rungoId.trim() : ''
    if (normalizedRungoId) {
      if (!KNOWN_RUNGO_IDS.has(normalizedRungoId) || !unlockedRef.current.includes(normalizedRungoId) || !allowedRungoIds.has(normalizedRungoId)) {
        return
      }
    }

    setRungoTrioByGame((previous) => {
      const previousForGame = previous[normalizedGameId] ?? {}
      const nextForGame: RungoTrioRoleAssignments = { ...previousForGame }

      if (!normalizedRungoId) {
        if (!nextForGame[role]) {
          return previous
        }

        delete nextForGame[role]
      } else {
        RUNGO_TRIO_ROLE_ORDER.forEach((entryRole) => {
          if (nextForGame[entryRole] === normalizedRungoId) {
            delete nextForGame[entryRole]
          }
        })

        nextForGame[role] = normalizedRungoId
      }

      const sanitizedForGame = sanitizeRungoTrioRoleAssignments(nextForGame, allowedRungoIds)
      if (areRungoTrioRoleAssignmentsEqual(previousForGame, sanitizedForGame)) {
        return previous
      }

      const nextByGame = { ...previous }
      if (Object.keys(sanitizedForGame).length > 0) {
        nextByGame[normalizedGameId] = sanitizedForGame
      } else {
        delete nextByGame[normalizedGameId]
      }

      rungoTrioRef.current = nextByGame
      return nextByGame
    })
  }, [getPlanetLoadoutForGame])

  const getRungoNameOverridesForGame = useCallback((gameId: string) => {
    const normalizedGameId = gameId.trim()
    if (!normalizedGameId) {
      return {}
    }

    const aliasByRungo = rungoNameOverridesRef.current[normalizedGameId] ?? {}
    const sanitized: Record<string, string> = {}
    Object.entries(aliasByRungo).forEach(([rungoId, alias]) => {
      const normalizedAlias = sanitizeRungoAlias(alias)
      if (!normalizedAlias || !KNOWN_RUNGO_IDS.has(rungoId) || !unlockedRef.current.includes(rungoId)) {
        return
      }
      sanitized[rungoId] = normalizedAlias
    })

    return sanitized
  }, [])

  const setRungoNameOverrideForGame = useCallback((gameId: string, rungoId: string, alias: string) => {
    const normalizedGameId = gameId.trim()
    const normalizedRungoId = rungoId.trim()
    if (!normalizedGameId || !normalizedRungoId || !KNOWN_RUNGO_IDS.has(normalizedRungoId)) {
      return
    }

    if (!unlockedRef.current.includes(normalizedRungoId)) {
      return
    }

    const nextAlias = sanitizeRungoAlias(alias)
    setRungoNameOverridesByGame((previous) => {
      const previousByRungo = previous[normalizedGameId] ?? {}
      const currentAlias = previousByRungo[normalizedRungoId] ?? null

      if (currentAlias === nextAlias) {
        return previous
      }

      const nextByRungo = { ...previousByRungo }
      if (nextAlias) {
        nextByRungo[normalizedRungoId] = nextAlias
      } else {
        delete nextByRungo[normalizedRungoId]
      }

      const nextByGame = { ...previous }
      if (Object.keys(nextByRungo).length > 0) {
        nextByGame[normalizedGameId] = nextByRungo
      } else {
        delete nextByGame[normalizedGameId]
      }

      rungoNameOverridesRef.current = nextByGame
      return nextByGame
    })
  }, [])

  const visibleRangeToyStates = useMemo(() => {
    const unlockedToyIds = new Set(rangeFeatureState.unlockedToyIds)
    return rangeToyStates.filter((toyState) => unlockedToyIds.has(toyState.id))
  }, [rangeFeatureState.unlockedToyIds, rangeToyStates])

  const value = useMemo(
    () => ({
      attachments,
      attachedKeychainIdForSystem,
      isAttaching,
      attachingKeychainId,
      startAttaching,
      cancelAttaching,
      attachRungoToSystem,
      completeAttach,
      detachFromSystem,
      unlockedRungoIds,
      isRungoUnlocked,
      unlockRungo,
      lockRungo,
      debugRollRungo,
      rungoTokenBalance,
      tokenRollHistory,
      gardenSeedBalance,
      gardenUnlockedSlotCount,
      gardenMaxSlotCount: GARDEN_MAX_SLOT_COUNT,
      gardenSlotAssignments,
      getGardenSlotUnlockCost,
      unlockNextGardenSlot,
      setGardenSlotRungo,
      gardenThemes: GARDEN_THEME_DEFINITIONS,
      gardenUnlockedThemeIds,
      activeGardenThemeId,
      setActiveGardenTheme,
      rangeNeedsByRungoId,
      ensureRangeNeedsForRungo,
      applyRangeNeedsDelta,
      decayRangeNeeds,
      rangeFeatureState,
      rangeToyCatalog: RANGE_TOY_CATALOG,
      rangeToyStates: visibleRangeToyStates,
      rangeItemCountsByToyId,
      getRangeItemCount,
      consumeRangeItemCount,
      applyRangeToyEffectDirect,
      consumeRangeToy,
      rangeProgression,
      rangePerks: RANGE_PERK_DEFINITIONS,
      rangeCosmetics: RANGE_COSMETIC_DEFINITIONS,
      hasRangePerk,
      maybeActivateRangeMiniEvent,
      getClaimableTokenCountForGame,
      getTotalClaimableTokenCount,
      claimGamePlaytimeTokens,
      claimAllGamePlaytimeTokens,
      rollRungoWithToken,
      enabledOrbitRungoIds,
      signatureRungoId,
      setSignatureRungoId,
      isRungoEnabledInOrbit,
      setRungoOrbitEnabled,
      getPlanetLoadoutForGame,
      addRungoToPlanetLoadout,
      removeRungoFromPlanetLoadout,
      getRungoTrioForGame,
      setRungoTrioRoleForGame,
      getRungoNameOverridesForGame,
      setRungoNameOverrideForGame,
      gameProgressById,
    }),
    [
      attachments,
      attachedKeychainIdForSystem,
      isAttaching,
      attachingKeychainId,
      startAttaching,
      cancelAttaching,
      attachRungoToSystem,
      completeAttach,
      detachFromSystem,
      unlockedRungoIds,
      isRungoUnlocked,
      unlockRungo,
      lockRungo,
      debugRollRungo,
      rungoTokenBalance,
      tokenRollHistory,
      gardenSeedBalance,
      gardenUnlockedSlotCount,
      gardenSlotAssignments,
      getGardenSlotUnlockCost,
      unlockNextGardenSlot,
      setGardenSlotRungo,
      gardenUnlockedThemeIds,
      activeGardenThemeId,
      setActiveGardenTheme,
      rangeNeedsByRungoId,
      ensureRangeNeedsForRungo,
      applyRangeNeedsDelta,
      decayRangeNeeds,
      rangeFeatureState,
      visibleRangeToyStates,
      rangeItemCountsByToyId,
      getRangeItemCount,
      consumeRangeItemCount,
      applyRangeToyEffectDirect,
      consumeRangeToy,
      rangeProgression,
      hasRangePerk,
      maybeActivateRangeMiniEvent,
      getClaimableTokenCountForGame,
      getTotalClaimableTokenCount,
      claimGamePlaytimeTokens,
      claimAllGamePlaytimeTokens,
      rollRungoWithToken,
      enabledOrbitRungoIds,
      signatureRungoId,
      setSignatureRungoId,
      isRungoEnabledInOrbit,
      setRungoOrbitEnabled,
      getPlanetLoadoutForGame,
      addRungoToPlanetLoadout,
      removeRungoFromPlanetLoadout,
      getRungoTrioForGame,
      setRungoTrioRoleForGame,
      getRungoNameOverridesForGame,
      setRungoNameOverrideForGame,
      gameProgressById,
    ],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isAttaching) {
        cancelAttaching()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAttaching, cancelAttaching])

  return <KeychainAttachmentsContext.Provider value={value}>{children}</KeychainAttachmentsContext.Provider>
}

export function useKeychainAttachments() {
  const ctx = useContext(KeychainAttachmentsContext)
  if (!ctx) {
    throw new Error('useKeychainAttachments must be used within a KeychainAttachmentsProvider')
  }
  return ctx
}
