import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import type { RaUserProfile, RaRecentAchievement, RaAward } from '../launcher/types'
import { SignatureRungoPreview } from '../../components/SignatureRungoPreview'
import { openDialog } from '../../services/dialogService'
import { readLocalImageAsDataUrl } from '../../services/launcherService'
import styles from './ProfileScreen.module.css'

type ProfileTheme = 'frost' | 'aurora' | 'midnight'
type CollageLayout = 'grid' | 'polaroid' | 'stack'

type ProfileScreenProps = {
  displayName: string
  avatarDataUrl: string
  bio: string
  statusLine: string
  favoriteGenres: string[]
  featuredImageUrls: string[]
  profileTheme: ProfileTheme
  collageLayout: CollageLayout
  featuredFallbackImageUrls: string[]
  totalGames: number
  totalPlaytimeText: string
  systemsUsed: number
  rungosCollected: number
  favoriteGameName: string
  screenshotOfWeekUrl: string
  signatureRungoId: string | null
  signatureRungoName: string
  onProfileSaved: (update: {
    displayName?: string
    avatarDataUrl?: string
    bio?: string
    statusLine?: string
    favoriteGenres?: string[]
    featuredImageUrls?: string[]
    profileTheme?: ProfileTheme
    collageLayout?: CollageLayout
  }) => void
  raUsername: string
  raProfile: RaUserProfile | null
  raRecentAchievements: RaRecentAchievement[]
  raAwards: RaAward[]
  raStatus: 'idle' | 'loading' | 'connected' | 'error'
  raError: string
  onRaConnect: (username: string, apiKey: string) => Promise<void>
  onRaDisconnect: () => void
  isExiting?: boolean
}

type PlacedAsset = {
  id: string
  name: string
  sourceInventoryId?: string
  imageUrl?: string
  foilType: StickerFoilType
  foilIntensity: StickerFoilIntensity
  specialEdition: boolean
  specialVariantId: StickerSpecialVariantId
  editionPaletteId: StickerEditionPaletteId
  fillOpacity: number
  tintHueShift: number
  tintSaturation: number
  tintLightness: number
  sheenStrength: number
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
  zIndex: number
  createdAt: number
}

type StickerInventoryItem = {
  id: string
  name: string
  imageUrl: string
  createdAt: number
  placed: boolean
  foilType: StickerFoilType
  foilIntensity: StickerFoilIntensity
  specialEdition: boolean
  specialVariantId: StickerSpecialVariantId
  editionPaletteId: StickerEditionPaletteId
  fillOpacity: number
  tintHueShift: number
  tintSaturation: number
  tintLightness: number
  sheenStrength: number
}

type StickerFoilType =
  | 'none'
  | 'gloss'
  | 'foil'
  | 'holographic'
  | 'polychrome'
  | 'negative'
  | 'aurora'
  | 'ripple'
  | 'lavaContour'
type StickerFoilIntensity = 'low' | 'medium' | 'high'
type StickerEditionPaletteId = 'crimson' | 'ember' | 'jade' | 'violet' | 'cobalt'
type StickerSpecialFoilFamily = 'holographic' | 'negative' | 'aurora' | 'ripple' | 'lavaContour'
type StickerSpecialVariantId = string
type RgbTriplet = [number, number, number]

type StickerSpecialVariantDefinition = {
  id: StickerSpecialVariantId
  label: string
  legacyPaletteId: StickerEditionPaletteId
  fillRgb: RgbTriplet
  highlightRgb: RgbTriplet
  edgeRgb: RgbTriplet
  defaultHueShift: number
  defaultSaturation: number
  defaultLightness: number
  defaultSheen: number
  motionSpeed: number
  motionPhaseDeg: number
  glowStrength: number
  grainDensity: number
}

type StickerRollProgress = {
  dailyWindowStart: number
  dailyUploads: number
  weeklyWindowStart: number
  weeklyUploads: number
  uploadsSinceFoil: number
  foilsSinceSpecial: number
}

type StickerRollOutcome = {
  foilType: StickerFoilType
  foilIntensity: StickerFoilIntensity
  specialEdition: boolean
  specialVariantId: StickerSpecialVariantId
  editionPaletteId: StickerEditionPaletteId
  fillOpacity: number
  tintHueShift: number
  tintSaturation: number
  tintLightness: number
  sheenStrength: number
  nextProgress: StickerRollProgress
}

const STICKER_DRAG_TRANSFER_TYPE = 'application/x-tile-manager-sticker-id'
const STICKER_DRAG_TRANSFER_PREFIX = 'tile-manager-sticker:'

const MAX_BIO_LENGTH = 160
const MAX_DISPLAY_NAME_LENGTH = 32
const MAX_STATUS_LENGTH = 56
const MAX_TAGS = 8
const PROFILE_DRAFT_STORAGE_KEY = 'tile-manager.profile-assets.v3'
const DEFAULT_STICKER_FOIL_TYPE: StickerFoilType = 'holographic'
const STICKER_DRAG_START_THRESHOLD_PX = 6
const STICKER_UPLOAD_DAILY_CAP = 24
const STICKER_UPLOAD_WEEKLY_CAP = 120
const STICKER_FOIL_DROP_CHANCE = 0.18
const STICKER_FOIL_PITY_UPLOADS = 8
const STICKER_SPECIAL_EDITION_CHANCE = 0.04
const STICKER_SPECIAL_PITY_FOILS = 20
const STICKER_SCRAP_ROLL_TICKET_COST = 120
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

const STICKER_FOIL_WEIGHT_TABLE: Array<{ foilType: Exclude<StickerFoilType, 'none' | 'gloss' | 'foil' | 'polychrome'>; weight: number }> = [
  { foilType: 'holographic', weight: 35 },
  { foilType: 'aurora', weight: 20 },
  { foilType: 'ripple', weight: 16 },
  { foilType: 'lavaContour', weight: 15 },
]

const SPECIAL_EDITION_PALETTES: Array<{
  id: StickerEditionPaletteId
  label: string
  fillRgb: [number, number, number]
  defaultHueShift: number
  defaultSaturation: number
  defaultLightness: number
  defaultSheen: number
}> = [
  { id: 'crimson', label: 'Crimson', fillRgb: [236, 0, 86], defaultHueShift: 0, defaultSaturation: 1, defaultLightness: 1, defaultSheen: 1 },
  { id: 'ember', label: 'Ember', fillRgb: [236, 66, 44], defaultHueShift: -8, defaultSaturation: 1.08, defaultLightness: 1.02, defaultSheen: 1.06 },
  { id: 'jade', label: 'Jade', fillRgb: [34, 180, 138], defaultHueShift: -44, defaultSaturation: 1.1, defaultLightness: 1.02, defaultSheen: 1.04 },
  { id: 'violet', label: 'Violet', fillRgb: [174, 40, 232], defaultHueShift: 22, defaultSaturation: 1.08, defaultLightness: 1.01, defaultSheen: 1.08 },
  { id: 'cobalt', label: 'Cobalt', fillRgb: [60, 118, 255], defaultHueShift: 38, defaultSaturation: 1.1, defaultLightness: 1, defaultSheen: 1.05 },
]

const SPECIAL_VARIANTS_BY_FOIL: Record<StickerSpecialFoilFamily, StickerSpecialVariantDefinition[]> = {
  holographic: [
    { id: 'holo-prism-burst', label: 'Azure Current', legacyPaletteId: 'cobalt', fillRgb: [56, 122, 255], highlightRgb: [212, 240, 255], edgeRgb: [86, 210, 255], defaultHueShift: 0, defaultSaturation: 1.16, defaultLightness: 1.02, defaultSheen: 1.14, motionSpeed: 1.1, motionPhaseDeg: 18, glowStrength: 1.24, grainDensity: 1.08 },
    { id: 'holo-opal-shift', label: 'Glacier Bloom', legacyPaletteId: 'cobalt', fillRgb: [128, 190, 255], highlightRgb: [236, 248, 255], edgeRgb: [172, 230, 255], defaultHueShift: -2, defaultSaturation: 1.08, defaultLightness: 1.08, defaultSheen: 1.08, motionSpeed: 0.9, motionPhaseDeg: 62, glowStrength: 1.1, grainDensity: 1.2 },
    { id: 'holo-neon-bloom', label: 'Midnight Signal', legacyPaletteId: 'cobalt', fillRgb: [42, 66, 158], highlightRgb: [182, 210, 255], edgeRgb: [72, 134, 244], defaultHueShift: 4, defaultSaturation: 1.22, defaultLightness: 0.94, defaultSheen: 1.18, motionSpeed: 1.2, motionPhaseDeg: 132, glowStrength: 1.28, grainDensity: 1.02 },
    { id: 'holo-vapor-static', label: 'Storm Glass', legacyPaletteId: 'jade', fillRgb: [58, 142, 176], highlightRgb: [198, 244, 246], edgeRgb: [82, 210, 216], defaultHueShift: -4, defaultSaturation: 1.14, defaultLightness: 1.01, defaultSheen: 1.12, motionSpeed: 1.28, motionPhaseDeg: 210, glowStrength: 1.22, grainDensity: 1.28 },
    { id: 'holo-starlace', label: 'Starlace', legacyPaletteId: 'ember', fillRgb: [255, 174, 82], highlightRgb: [255, 244, 220], edgeRgb: [255, 206, 120], defaultHueShift: 44, defaultSaturation: 1.15, defaultLightness: 1.06, defaultSheen: 1.1, motionSpeed: 0.86, motionPhaseDeg: 286, glowStrength: 1.05, grainDensity: 1.24 },
  ],
  negative: [
    { id: 'negative-mono-invert', label: 'Mono Invert', legacyPaletteId: 'crimson', fillRgb: [232, 232, 232], highlightRgb: [255, 255, 255], edgeRgb: [210, 210, 210], defaultHueShift: 0, defaultSaturation: 0.96, defaultLightness: 1.01, defaultSheen: 1.02, motionSpeed: 0.96, motionPhaseDeg: 0, glowStrength: 1.02, grainDensity: 1.02 },
    { id: 'negative-cyanotype', label: 'Cyanotype', legacyPaletteId: 'cobalt', fillRgb: [132, 186, 255], highlightRgb: [222, 242, 255], edgeRgb: [148, 210, 255], defaultHueShift: -42, defaultSaturation: 1.08, defaultLightness: 0.98, defaultSheen: 1.04, motionSpeed: 1.02, motionPhaseDeg: 68, glowStrength: 1.08, grainDensity: 1.2 },
    { id: 'negative-infrared-ghost', label: 'Infrared Ghost', legacyPaletteId: 'ember', fillRgb: [255, 166, 146], highlightRgb: [255, 220, 202], edgeRgb: [255, 178, 154], defaultHueShift: 34, defaultSaturation: 1.14, defaultLightness: 1.02, defaultSheen: 1.08, motionSpeed: 1.16, motionPhaseDeg: 142, glowStrength: 1.18, grainDensity: 1.1 },
    { id: 'negative-xray-amber', label: 'XRay Amber', legacyPaletteId: 'ember', fillRgb: [255, 192, 112], highlightRgb: [255, 236, 190], edgeRgb: [255, 206, 128], defaultHueShift: 18, defaultSaturation: 1.1, defaultLightness: 1.04, defaultSheen: 1.05, motionSpeed: 0.9, motionPhaseDeg: 236, glowStrength: 1.1, grainDensity: 1.28 },
    { id: 'negative-noir-glitch', label: 'Noir Glitch', legacyPaletteId: 'violet', fillRgb: [196, 182, 236], highlightRgb: [238, 230, 255], edgeRgb: [214, 192, 248], defaultHueShift: 56, defaultSaturation: 1.06, defaultLightness: 0.95, defaultSheen: 1.12, motionSpeed: 1.28, motionPhaseDeg: 312, glowStrength: 1.22, grainDensity: 1.34 },
  ],
  aurora: [
    { id: 'aurora-borealis-mint', label: 'Borealis Mint', legacyPaletteId: 'jade', fillRgb: [86, 224, 176], highlightRgb: [210, 255, 236], edgeRgb: [114, 246, 190], defaultHueShift: -26, defaultSaturation: 1.2, defaultLightness: 1.02, defaultSheen: 1.1, motionSpeed: 1.08, motionPhaseDeg: 28, glowStrength: 1.16, grainDensity: 1.08 },
    { id: 'aurora-polar-violet', label: 'Polar Violet', legacyPaletteId: 'violet', fillRgb: [186, 122, 255], highlightRgb: [242, 220, 255], edgeRgb: [206, 146, 255], defaultHueShift: 18, defaultSaturation: 1.18, defaultLightness: 1.04, defaultSheen: 1.14, motionSpeed: 0.92, motionPhaseDeg: 96, glowStrength: 1.14, grainDensity: 1.22 },
    { id: 'aurora-emerald-arc', label: 'Emerald Arc', legacyPaletteId: 'jade', fillRgb: [70, 214, 146], highlightRgb: [202, 255, 222], edgeRgb: [94, 238, 166], defaultHueShift: -38, defaultSaturation: 1.24, defaultLightness: 1.03, defaultSheen: 1.08, motionSpeed: 1.18, motionPhaseDeg: 164, glowStrength: 1.2, grainDensity: 0.98 },
    { id: 'aurora-rose-storm', label: 'Rose Storm', legacyPaletteId: 'crimson', fillRgb: [248, 96, 166], highlightRgb: [255, 220, 242], edgeRgb: [255, 120, 188], defaultHueShift: 24, defaultSaturation: 1.2, defaultLightness: 1.01, defaultSheen: 1.12, motionSpeed: 1.26, motionPhaseDeg: 226, glowStrength: 1.24, grainDensity: 1.16 },
    { id: 'aurora-midnight-veil', label: 'Midnight Veil', legacyPaletteId: 'cobalt', fillRgb: [88, 126, 248], highlightRgb: [208, 226, 255], edgeRgb: [112, 152, 255], defaultHueShift: -8, defaultSaturation: 1.1, defaultLightness: 0.97, defaultSheen: 1.16, motionSpeed: 0.84, motionPhaseDeg: 304, glowStrength: 1.06, grainDensity: 1.3 },
  ],
  ripple: [
    { id: 'ripple-lagoon-glass', label: 'Lagoon Glass', legacyPaletteId: 'jade', fillRgb: [88, 224, 188], highlightRgb: [220, 255, 244], edgeRgb: [118, 244, 210], defaultHueShift: -32, defaultSaturation: 1.22, defaultLightness: 1.03, defaultSheen: 1.08, motionSpeed: 1.12, motionPhaseDeg: 18, glowStrength: 1.14, grainDensity: 1.08 },
    { id: 'ripple-toxic-tide', label: 'Toxic Tide', legacyPaletteId: 'ember', fillRgb: [182, 232, 84], highlightRgb: [236, 255, 194], edgeRgb: [202, 246, 108], defaultHueShift: -58, defaultSaturation: 1.26, defaultLightness: 1.01, defaultSheen: 1.06, motionSpeed: 1.22, motionPhaseDeg: 84, glowStrength: 1.2, grainDensity: 1.24 },
    { id: 'ripple-abyssal-current', label: 'Abyssal Current', legacyPaletteId: 'cobalt', fillRgb: [74, 122, 232], highlightRgb: [208, 224, 255], edgeRgb: [98, 148, 246], defaultHueShift: 12, defaultSaturation: 1.14, defaultLightness: 0.95, defaultSheen: 1.12, motionSpeed: 0.9, motionPhaseDeg: 158, glowStrength: 1.08, grainDensity: 1.34 },
    { id: 'ripple-sunset-surf', label: 'Sunset Surf', legacyPaletteId: 'ember', fillRgb: [255, 148, 78], highlightRgb: [255, 226, 182], edgeRgb: [255, 172, 104], defaultHueShift: 34, defaultSaturation: 1.18, defaultLightness: 1.04, defaultSheen: 1.09, motionSpeed: 1.04, motionPhaseDeg: 236, glowStrength: 1.16, grainDensity: 1.02 },
    { id: 'ripple-glacial-wake', label: 'Glacial Wake', legacyPaletteId: 'cobalt', fillRgb: [156, 222, 255], highlightRgb: [232, 248, 255], edgeRgb: [176, 236, 255], defaultHueShift: -12, defaultSaturation: 1.09, defaultLightness: 1.08, defaultSheen: 1.04, motionSpeed: 0.82, motionPhaseDeg: 308, glowStrength: 1.03, grainDensity: 1.2 },
  ],
  lavaContour: [
    { id: 'lava-tide-atlas', label: 'Coral', legacyPaletteId: 'jade', fillRgb: [206, 184, 142], highlightRgb: [236, 225, 196], edgeRgb: [32, 112, 114], defaultHueShift: -12, defaultSaturation: 0.96, defaultLightness: 1.04, defaultSheen: 1.08, motionSpeed: 1.04, motionPhaseDeg: 14, glowStrength: 1.16, grainDensity: 1.04 },
    { id: 'lava-porcelain-current', label: 'Porcelain', legacyPaletteId: 'cobalt', fillRgb: [236, 234, 226], highlightRgb: [198, 224, 255], edgeRgb: [46, 96, 178], defaultHueShift: 8, defaultSaturation: 1.02, defaultLightness: 1.06, defaultSheen: 1.12, motionSpeed: 0.94, motionPhaseDeg: 94, glowStrength: 1.08, grainDensity: 1.2 },
    { id: 'lava-basalt-steam', label: 'Basalt', legacyPaletteId: 'cobalt', fillRgb: [56, 62, 74], highlightRgb: [192, 214, 224], edgeRgb: [64, 184, 210], defaultHueShift: -6, defaultSaturation: 1.08, defaultLightness: 0.94, defaultSheen: 1.16, motionSpeed: 1.16, motionPhaseDeg: 172, glowStrength: 1.2, grainDensity: 1.12 },
    { id: 'lava-kelp-fault', label: 'Kelp', legacyPaletteId: 'jade', fillRgb: [132, 142, 86], highlightRgb: [228, 188, 126], edgeRgb: [24, 84, 56], defaultHueShift: -18, defaultSaturation: 1.12, defaultLightness: 0.98, defaultSheen: 1.08, motionSpeed: 1.22, motionPhaseDeg: 246, glowStrength: 1.18, grainDensity: 1.22 },
    { id: 'lava-coral-shelf', label: 'Shelf', legacyPaletteId: 'ember', fillRgb: [220, 122, 96], highlightRgb: [255, 206, 172], edgeRgb: [46, 82, 128], defaultHueShift: 10, defaultSaturation: 1.14, defaultLightness: 1.02, defaultSheen: 1.14, motionSpeed: 1.26, motionPhaseDeg: 314, glowStrength: 1.24, grainDensity: 1.1 },
  ],
}

const ACTIVE_SPECIAL_VARIANTS_BY_FOIL: Record<StickerSpecialFoilFamily, StickerSpecialVariantDefinition[]> = {
  holographic: SPECIAL_VARIANTS_BY_FOIL.holographic.slice(0, 4),
  negative: SPECIAL_VARIANTS_BY_FOIL.negative.slice(0, 4),
  aurora: SPECIAL_VARIANTS_BY_FOIL.aurora.slice(0, 4),
  ripple: SPECIAL_VARIANTS_BY_FOIL.ripple.slice(0, 4),
  lavaContour: SPECIAL_VARIANTS_BY_FOIL.lavaContour.slice(0, 4),
}

const STICKER_FOIL_OPTIONS: Array<{ value: StickerFoilType; label: string }> = [
  { value: 'holographic', label: 'Polychrome' },
  { value: 'negative', label: 'Negative' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'ripple', label: 'Guava' },
  { value: 'lavaContour', label: 'Lava' },
]


const FOIL_META_BG_BY_TYPE: Record<StickerFoilType, string> = {
  none: 'rgba(76, 66, 50, 0.92)',
  gloss: 'rgba(108, 108, 108, 0.92)',
  foil: 'rgba(168, 136, 72, 0.92)',
  holographic: 'linear-gradient(120deg, rgba(95, 128, 255, 0.94), rgba(176, 116, 255, 0.94), rgba(76, 220, 230, 0.94))',
  polychrome: 'linear-gradient(120deg, rgba(95, 128, 255, 0.94), rgba(176, 116, 255, 0.94), rgba(76, 220, 230, 0.94))',
  negative: 'linear-gradient(120deg, rgba(122, 130, 140, 0.94), rgba(50, 56, 68, 0.94))',
  aurora: 'linear-gradient(120deg, rgba(58, 176, 182, 0.94), rgba(66, 119, 229, 0.94), rgba(95, 213, 156, 0.94))',
  ripple: 'linear-gradient(120deg, rgba(56, 214, 98, 0.94), rgba(246, 162, 40, 0.94))',
  lavaContour: 'linear-gradient(120deg, rgba(208, 186, 144, 0.94), rgba(176, 154, 118, 0.94))',
}

function getRelativeLuminance([r, g, b]: RgbTriplet): number {
  const toLinear = (channel: number): number => {
    const value = clamp(channel, 0, 255) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  return lr * 0.2126 + lg * 0.7152 + lb * 0.0722
}

function shouldUseDarkInfoPanelText(item: StickerInventoryItem | null): boolean {
  if (!item) return false
  if (item.specialEdition) {
    const variant = getSpecialVariant(item.foilType, item.specialVariantId)
    return getRelativeLuminance(variant.fillRgb) >= 0.46
  }
  return item.foilType === 'ripple'
}


function resolveFeaturedImages(primary: string[], fallback: string[]): string[] {
  return Array.from({ length: 3 }, (_, index) => {
    const primaryValue = primary[index]?.trim() ?? ''
    if (primaryValue) {
      return primaryValue
    }
    return fallback[index]?.trim() ?? ''
  })
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function getSpecialEditionPalette(paletteId: StickerEditionPaletteId): (typeof SPECIAL_EDITION_PALETTES)[number] {
  return SPECIAL_EDITION_PALETTES.find((palette) => palette.id === paletteId) ?? SPECIAL_EDITION_PALETTES[0]
}

function getSpecialVariantFoilFamily(foilType: StickerFoilType): StickerSpecialFoilFamily {
  if (foilType === 'negative') return 'negative'
  if (foilType === 'aurora') return 'aurora'
  if (foilType === 'ripple') return 'ripple'
  if (foilType === 'lavaContour') return 'lavaContour'
  return 'holographic'
}

function getSpecialVariantsForFoil(foilType: StickerFoilType): StickerSpecialVariantDefinition[] {
  return ACTIVE_SPECIAL_VARIANTS_BY_FOIL[getSpecialVariantFoilFamily(foilType)]
}

function normalizeSpecialVariantId(foilType: StickerFoilType, value: unknown): StickerSpecialVariantId {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return getSpecialVariantsForFoil(foilType)[0].id
  }
  const variants = getSpecialVariantsForFoil(foilType)
  return variants.some((variant) => variant.id === value) ? value : variants[0].id
}

function getSpecialVariant(foilType: StickerFoilType, variantId: StickerSpecialVariantId): StickerSpecialVariantDefinition {
  const variants = getSpecialVariantsForFoil(foilType)
  return variants.find((variant) => variant.id === variantId) ?? variants[0]
}

function normalizeEditionPaletteId(value: unknown): StickerEditionPaletteId {
  return value === 'crimson' || value === 'ember' || value === 'jade' || value === 'violet' || value === 'cobalt'
    ? value
    : 'crimson'
}

function createEditionDefaults(
  specialEdition: boolean,
  foilType: StickerFoilType,
  specialVariantId?: StickerSpecialVariantId,
  legacyPaletteId: StickerEditionPaletteId = 'crimson',
): Pick<PlacedAsset, 'specialEdition' | 'specialVariantId' | 'editionPaletteId' | 'fillOpacity' | 'tintHueShift' | 'tintSaturation' | 'tintLightness' | 'sheenStrength'> {
  const normalizedVariantId = normalizeSpecialVariantId(foilType, specialVariantId)
  const variant = getSpecialVariant(foilType, normalizedVariantId)
  const palette = getSpecialEditionPalette(legacyPaletteId)
  if (!specialEdition) {
    return {
      specialEdition: false,
      specialVariantId: normalizedVariantId,
      editionPaletteId: palette.id,
      fillOpacity: 0.84,
      tintHueShift: 0,
      tintSaturation: 1,
      tintLightness: 1,
      sheenStrength: 1,
    }
  }
  return {
    specialEdition: true,
    specialVariantId: normalizedVariantId,
    editionPaletteId: variant.legacyPaletteId,
    fillOpacity: 0.88,
    tintHueShift: variant.defaultHueShift,
    tintSaturation: variant.defaultSaturation,
    tintLightness: variant.defaultLightness,
    sheenStrength: variant.defaultSheen,
  }
}

function resolveSpecialVariantStyleVars(
  asset: Pick<PlacedAsset, 'foilType' | 'specialEdition' | 'specialVariantId' | 'fillOpacity' | 'tintHueShift' | 'tintSaturation' | 'tintLightness' | 'sheenStrength'>,
  seedId: string,
): CSSProperties {
  void seedId

  if (!asset.specialEdition) {
    return {}
  }

  const variant = getSpecialVariant(asset.foilType, asset.specialVariantId)
  const [fr, fg, fb] = variant.fillRgb
  const [hr, hg, hb] = variant.highlightRgb
  const [er, eg, eb] = variant.edgeRgb

  const lerpC = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
  const mixRgb = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
    [lerpC(a[0], b[0], t), lerpC(a[1], b[1], t), lerpC(a[2], b[2], t)]

  const stop2 = mixRgb(variant.edgeRgb, variant.fillRgb, 0.5)
  const stop4 = mixRgb(variant.fillRgb, variant.highlightRgb, 0.5)
  const specStop2 = mixRgb(variant.highlightRgb, [255, 255, 255], 0.5)
  const grainTint = mixRgb(variant.fillRgb, variant.edgeRgb, 0.4)
  const shadowTint = mixRgb(variant.fillRgb, [0, 0, 0], 0.62)

  return {
    ['--edition-hue-shift' as string]: String(variant.defaultHueShift),
    ['--edition-saturation' as string]: String(variant.defaultSaturation),
    ['--edition-brightness' as string]: String(variant.defaultLightness),
    ['--edition-glow-strength' as string]: String(variant.glowStrength),
    ['--edition-grain-density' as string]: String(variant.grainDensity),
    ['--edition-motion-speed' as string]: String(variant.motionSpeed),
    ['--edition-motion-phase' as string]: `${variant.motionPhaseDeg}deg`,
    ['--edition-poly-stop-1-rgb' as string]: `${er}, ${eg}, ${eb}`,
    ['--edition-poly-stop-2-rgb' as string]: `${stop2[0]}, ${stop2[1]}, ${stop2[2]}`,
    ['--edition-poly-stop-3-rgb' as string]: `${fr}, ${fg}, ${fb}`,
    ['--edition-poly-stop-4-rgb' as string]: `${stop4[0]}, ${stop4[1]}, ${stop4[2]}`,
    ['--edition-poly-stop-5-rgb' as string]: `${hr}, ${hg}, ${hb}`,
    ['--edition-poly-stop-6-rgb' as string]: `${er}, ${eg}, ${eb}`,
    ['--edition-spec-stop-1-rgb' as string]: '255, 255, 255',
    ['--edition-spec-stop-2-rgb' as string]: `${specStop2[0]}, ${specStop2[1]}, ${specStop2[2]}`,
    ['--edition-spec-stop-3-rgb' as string]: `${hr}, ${hg}, ${hb}`,
    ['--edition-grain-tint-rgb' as string]: `${grainTint[0]}, ${grainTint[1]}, ${grainTint[2]}`,
    ['--edition-shadow-tint-rgb' as string]: `${shadowTint[0]}, ${shadowTint[1]}, ${shadowTint[2]}`,
    ['--edition-edge-rgb' as string]: `${er}, ${eg}, ${eb}`,
    ['--edition-highlight-rgb' as string]: `${hr}, ${hg}, ${hb}`,
    ['--lava-fill-rgb' as string]: `${fr}, ${fg}, ${fb}`,
    ['--lava-ring-primary-rgb' as string]: `${er}, ${eg}, ${eb}`,
    ['--lava-ring-accent-rgb' as string]: `${hr}, ${hg}, ${hb}`,
    ['--lava-ring-alpha' as string]: '1',
    ['--lava-fill-opacity' as string]: String(asset.fillOpacity ?? 0.88),
    ['--lava-tint-hue' as string]: String(variant.defaultHueShift),
    ['--lava-tint-saturation' as string]: String(variant.defaultSaturation),
    ['--lava-tint-lightness' as string]: String(variant.defaultLightness),
    ['--lava-sheen-strength' as string]: String(variant.defaultSheen),
  }
}

function createDefaultRollProgress(now = Date.now()): StickerRollProgress {
  return {
    dailyWindowStart: now,
    dailyUploads: 0,
    weeklyWindowStart: now,
    weeklyUploads: 0,
    uploadsSinceFoil: 0,
    foilsSinceSpecial: 0,
  }
}

function normalizeRollProgress(value: unknown, now = Date.now()): StickerRollProgress {
  const source = (value ?? {}) as Partial<StickerRollProgress>
  let dailyWindowStart = Number.isFinite(source.dailyWindowStart) ? Number(source.dailyWindowStart) : now
  let weeklyWindowStart = Number.isFinite(source.weeklyWindowStart) ? Number(source.weeklyWindowStart) : now
  let dailyUploads = Number.isFinite(source.dailyUploads) ? Math.max(0, Math.floor(Number(source.dailyUploads))) : 0
  let weeklyUploads = Number.isFinite(source.weeklyUploads) ? Math.max(0, Math.floor(Number(source.weeklyUploads))) : 0

  if (now - dailyWindowStart >= DAY_MS) {
    dailyWindowStart = now
    dailyUploads = 0
  }
  if (now - weeklyWindowStart >= WEEK_MS) {
    weeklyWindowStart = now
    weeklyUploads = 0
  }

  return {
    dailyWindowStart,
    dailyUploads,
    weeklyWindowStart,
    weeklyUploads,
    uploadsSinceFoil: Number.isFinite(source.uploadsSinceFoil) ? Math.max(0, Math.floor(Number(source.uploadsSinceFoil))) : 0,
    foilsSinceSpecial: Number.isFinite(source.foilsSinceSpecial) ? Math.max(0, Math.floor(Number(source.foilsSinceSpecial))) : 0,
  }
}

function chooseWeightedFoilType(rand: () => number): Exclude<StickerFoilType, 'none' | 'gloss' | 'foil' | 'polychrome'> {
  const totalWeight = STICKER_FOIL_WEIGHT_TABLE.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = rand() * totalWeight
  for (const entry of STICKER_FOIL_WEIGHT_TABLE) {
    cursor -= entry.weight
    if (cursor <= 0) {
      return entry.foilType
    }
  }
  return STICKER_FOIL_WEIGHT_TABLE[STICKER_FOIL_WEIGHT_TABLE.length - 1].foilType
}

function rollStickerOutcome(progress: StickerRollProgress, rand: () => number = Math.random, options: { forceSpecial?: boolean } = {}): StickerRollOutcome {
  const normalizedProgress = normalizeRollProgress(progress)

  const forceFoil = normalizedProgress.uploadsSinceFoil + 1 >= STICKER_FOIL_PITY_UPLOADS
  const hasFoil = forceFoil || rand() < STICKER_FOIL_DROP_CHANCE

  const foilType: StickerFoilType = hasFoil ? chooseWeightedFoilType(rand) : 'none'
  const foilIntensity: StickerFoilIntensity = hasFoil ? 'high' : 'low'

  const forceSpecial = options.forceSpecial === true
  const pitySpecial = hasFoil && normalizedProgress.foilsSinceSpecial + 1 >= STICKER_SPECIAL_PITY_FOILS
  const specialEdition = hasFoil && (forceSpecial || pitySpecial || rand() < STICKER_SPECIAL_EDITION_CHANCE)
  const specialVariantOptions = getSpecialVariantsForFoil(foilType)
  const selectedVariant = specialEdition
    ? specialVariantOptions[Math.floor(rand() * specialVariantOptions.length)]
    : specialVariantOptions[0]
  const editionDefaults = createEditionDefaults(specialEdition, foilType, selectedVariant.id, selectedVariant.legacyPaletteId)

  const nextProgress: StickerRollProgress = {
    ...normalizedProgress,
    dailyUploads: normalizedProgress.dailyUploads + 1,
    weeklyUploads: normalizedProgress.weeklyUploads + 1,
    uploadsSinceFoil: hasFoil ? 0 : normalizedProgress.uploadsSinceFoil + 1,
    foilsSinceSpecial: hasFoil ? (specialEdition ? 0 : normalizedProgress.foilsSinceSpecial + 1) : normalizedProgress.foilsSinceSpecial,
  }

  return {
    foilType,
    foilIntensity,
    ...editionDefaults,
    nextProgress,
  }
}

function nextZIndex(assets: PlacedAsset[]): number {
  return (assets.reduce((max, asset) => Math.max(max, asset.zIndex), 0) || 0) + 1
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function hashToUnit(input: string, salt: number): number {
  let hash = 2166136261 ^ salt
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function hashString32(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = clamp01(saturation)
  const l = clamp01(lightness)
  const c = (1 - Math.abs(2 * l - 1)) * s
  const h = ((hue % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((h % 2) - 1))
  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 1) {
    r = c
    g = x
  } else if (h >= 1 && h < 2) {
    r = x
    g = c
  } else if (h >= 2 && h < 3) {
    g = c
    b = x
  } else if (h >= 3 && h < 4) {
    g = x
    b = c
  } else if (h >= 4 && h < 5) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const m = l - c / 2
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

function choosePolychromeHue(rand: () => number): number {
  const roll = rand()
  // Keep Balatro-like bias: deep violets + magentas, with aggressive cyan pivots and sparse warm flashes.
  if (roll < 0.66) {
    const violetBand = [274, 282, 292, 302, 312, 322, 332]
    return violetBand[Math.floor(rand() * violetBand.length)]
  }
  if (roll < 0.92) {
    const cyanBand = [186, 194, 202, 210, 220]
    return cyanBand[Math.floor(rand() * cyanBand.length)]
  }
  const warmBand = [8, 16, 24, 34, 348]
  return warmBand[Math.floor(rand() * warmBand.length)]
}

function hash2d(x: number, y: number, seed: number): number {
  const value = Math.sin((x + seed * 0.173) * 12.9898 + (y + seed * 0.619) * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function createPolychromeTextureDataUrl(seedKey: string): string {
  if (typeof document === 'undefined') {
    return ''
  }

  const sourceSize = 64
  const outputSize = 192
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = sourceSize
  sourceCanvas.height = sourceSize
  const ctx = sourceCanvas.getContext('2d')
  if (!ctx) {
    return ''
  }

  type CellSite = {
    x: number
    y: number
    hue: number
    sat: number
    // 0 = near-black (negative space), 1 = mid-bright, 2 = hot-bright
    tier: number
    lightness: number
    grainSeed: number
  }

  const rand = createMulberry32(hashString32(seedKey))
  const siteCount = 24 + Math.floor(rand() * 16)
  const sites: CellSite[] = []
  for (let index = 0; index < siteCount; index += 1) {
    const tierRoll = rand()
    // Keep pronounced negative space so highlights jump facet-to-facet.
    const tier = tierRoll < 0.32 ? 0 : tierRoll < 0.64 ? 1 : 2
    const lightness =
      tier === 0 ? rand() * 0.06          // 0–6%: near-black negative space
      : tier === 1 ? 0.46 + rand() * 0.18  // 46–64%: moderate neon
      : 0.74 + rand() * 0.22               // 74–96%: burning highlight
    sites.push({
      x: rand() * sourceSize,
      y: rand() * sourceSize,
      hue: choosePolychromeHue(rand),
      sat: tier === 0 ? 0 : 0.88 + rand() * 0.12,
      tier,
      lightness,
      grainSeed: rand() * 8000,
    })
  }

  const imageData = ctx.createImageData(sourceSize, sourceSize)
  const data = imageData.data

  for (let y = 0; y < sourceSize; y += 1) {
    for (let x = 0; x < sourceSize; x += 1) {
      let nearestIndex = 0
      let nearestDist = Number.POSITIVE_INFINITY
      let secondDist = Number.POSITIVE_INFINITY

      for (let index = 0; index < sites.length; index += 1) {
        const site = sites[index]
        const dx = x - site.x
        const dy = y - site.y
        const dist = dx * dx + dy * dy
        if (dist < nearestDist) {
          secondDist = nearestDist
          nearestDist = dist
          nearestIndex = index
        } else if (dist < secondDist) {
          secondDist = dist
        }
      }

      const cell = sites[nearestIndex]
      const distGap = Math.max(0, Math.sqrt(secondDist) - Math.sqrt(nearestDist))
      // Aggressive seam multiplier creates stark cracked-ice boundaries.
      const seamStrength = clamp01(1 - distGap * 3.1)
      const pixelOffset = (y * sourceSize + x) * 4

      // Bright white crack lines at Voronoi cell boundaries
      if (seamStrength > 0.78) {
        const seamWhite = clamp01((seamStrength - 0.78) / 0.22)
        const w = Math.round(210 + seamWhite * 45)
        data[pixelOffset] = w
        data[pixelOffset + 1] = w
        data[pixelOffset + 2] = w
        data[pixelOffset + 3] = 255
        continue
      }

      // Dark-tier: near-black so color-dodge treats it as transparent negative space
      if (cell.tier === 0) {
        const v = Math.round(cell.lightness * 255)
        data[pixelOffset] = v
        data[pixelOffset + 1] = v
        data[pixelOffset + 2] = v
        data[pixelOffset + 3] = 255
        continue
      }

      // Mid/bright facets use flat per-cell color so transitions snap sharply.
      const hue = cell.hue
      const sat = cell.sat

      // Sparse hotspot sparkles
      const clusterHash = hash2d(Math.floor(x / 3), Math.floor(y / 3), cell.grainSeed + 41)
      const sparkHash = hash2d(x, y, cell.grainSeed + 83)
      const isHotspot = clusterHash > 0.94 && sparkHash > 0.72
      const lightness = isHotspot ? 0.97 : cell.lightness
      const [r, g, b] = hslToRgb(hue, sat, clamp01(lightness))

      data[pixelOffset] = isHotspot ? 255 : Math.round(r)
      data[pixelOffset + 1] = isHotspot ? 255 : Math.round(g)
      data[pixelOffset + 2] = isHotspot ? 255 : Math.round(b)
      data[pixelOffset + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // Smooth bilinear upscale so facet edges flow over the sprite's pixel grid
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = outputSize
  outputCanvas.height = outputSize
  const outputCtx = outputCanvas.getContext('2d')
  if (!outputCtx) {
    return sourceCanvas.toDataURL('image/png')
  }

  outputCtx.imageSmoothingEnabled = true
  outputCtx.imageSmoothingQuality = 'high'
  outputCtx.drawImage(sourceCanvas, 0, 0, outputSize, outputSize)
  return outputCanvas.toDataURL('image/png')
}

async function createPolychromeLumaMaskDataUrl(imageUrl: string): Promise<string> {
  if (typeof document === 'undefined' || !imageUrl) {
    return ''
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image()
    nextImage.decoding = 'async'
    nextImage.onload = () => resolve(nextImage)
    nextImage.onerror = () => reject(new Error('Failed to load sticker image for polychrome mask generation.'))
    nextImage.src = imageUrl
  })

  const width = Math.max(1, image.naturalWidth || image.width)
  const height = Math.max(1, image.naturalHeight || image.height)

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = width
  sourceCanvas.height = height
  const sourceCtx = sourceCanvas.getContext('2d')
  if (!sourceCtx) {
    return ''
  }

  sourceCtx.clearRect(0, 0, width, height)
  sourceCtx.drawImage(image, 0, 0, width, height)

  const sourceImageData = sourceCtx.getImageData(0, 0, width, height)
  const source = sourceImageData.data
  const pixelCount = width * height

  const opaque = new Uint8Array(pixelCount)
  for (let index = 0; index < pixelCount; index += 1) {
    const alpha = source[index * 4 + 3]
    opaque[index] = alpha > 14 ? 1 : 0
  }

  const erode = (input: Uint8Array): Uint8Array => {
    const output = new Uint8Array(pixelCount)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x
        if (!input[pixelIndex]) {
          output[pixelIndex] = 0
          continue
        }

        let keep = 1
        for (let offsetY = -1; offsetY <= 1 && keep === 1; offsetY += 1) {
          const ny = y + offsetY
          if (ny < 0 || ny >= height) {
            keep = 0
            break
          }
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const nx = x + offsetX
            if (nx < 0 || nx >= width) {
              keep = 0
              break
            }
            if (!input[ny * width + nx]) {
              keep = 0
              break
            }
          }
        }

        output[pixelIndex] = keep
      }
    }
    return output
  }

  const interiorPass1 = erode(opaque)
  const interior = erode(interiorPass1)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskCtx = maskCanvas.getContext('2d')
  if (!maskCtx) {
    return ''
  }

  const maskData = maskCtx.createImageData(width, height)
  const maskPixels = maskData.data

  for (let index = 0; index < pixelCount; index += 1) {
    const sourceOffset = index * 4
    const alpha = source[sourceOffset + 3] / 255
    if (alpha <= 0 || !interior[index]) {
      maskPixels[sourceOffset] = 255
      maskPixels[sourceOffset + 1] = 255
      maskPixels[sourceOffset + 2] = 255
      maskPixels[sourceOffset + 3] = 0
      continue
    }

    const red = source[sourceOffset] / 255
    const green = source[sourceOffset + 1] / 255
    const blue = source[sourceOffset + 2] / 255
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

    // The darkest 20 % of pixels (outlines, deep shadows) get zero foil so the
    // character's linework stays sharp. Above that threshold, glint grows smoothly
    // to full strength on the brightest pixels.
    const luminanceBoost = clamp01((luminance - 0.22) / 0.78)
    const glintStrength = Math.pow(luminanceBoost, 1.6)
    const outputAlpha = Math.round(255 * alpha * glintStrength)

    maskPixels[sourceOffset] = 255
    maskPixels[sourceOffset + 1] = 255
    maskPixels[sourceOffset + 2] = 255
    maskPixels[sourceOffset + 3] = outputAlpha
  }

  maskCtx.putImageData(maskData, 0, 0)
  return maskCanvas.toDataURL('image/png')
}

function normalizeFoilType(value: unknown): StickerFoilType {
  return value === 'none' ||
    value === 'gloss' ||
    value === 'foil' ||
    value === 'holographic' ||
    value === 'polychrome' ||
    value === 'negative' ||
    value === 'aurora' ||
    value === 'ripple' ||
    value === 'lavaContour'
    ? value
    : DEFAULT_STICKER_FOIL_TYPE
}

function normalizeFoilIntensity(_value: unknown): StickerFoilIntensity {
  return 'high'
}

function normalizePlacedAsset(asset: PlacedAsset): PlacedAsset {
  const sourceInventoryId = typeof asset.sourceInventoryId === 'string' && asset.sourceInventoryId.trim().length > 0
    ? asset.sourceInventoryId
    : undefined
  const normalizedFoilType = normalizeFoilType(asset.foilType)
  const normalizedPaletteId = normalizeEditionPaletteId(asset.editionPaletteId)
  const normalizedSpecialEdition = false
  const hasLegacyPaletteWithoutVariant = typeof asset.specialVariantId !== 'string' && typeof asset.editionPaletteId === 'string'
  const normalizedVariantId = hasLegacyPaletteWithoutVariant
    ? getSpecialVariantsForFoil(normalizedFoilType)[0].id
    : normalizeSpecialVariantId(normalizedFoilType, asset.specialVariantId)
  const defaults = createEditionDefaults(normalizedSpecialEdition, normalizedFoilType, normalizedVariantId, normalizedPaletteId)
  return {
    ...asset,
    sourceInventoryId,
    foilType: normalizedFoilType,
    foilIntensity: normalizeFoilIntensity(asset.foilIntensity),
    specialEdition: normalizedSpecialEdition,
    specialVariantId: normalizedVariantId,
    editionPaletteId: normalizedPaletteId,
    fillOpacity: clamp(
      Number.isFinite(asset.fillOpacity) ? asset.fillOpacity : defaults.fillOpacity,
      0.5,
      1,
    ),
    tintHueShift: clamp(
      Number.isFinite(asset.tintHueShift) ? asset.tintHueShift : defaults.tintHueShift,
      -180,
      180,
    ),
    tintSaturation: clamp(
      Number.isFinite(asset.tintSaturation) ? asset.tintSaturation : defaults.tintSaturation,
      0.6,
      1.6,
    ),
    tintLightness: clamp(
      Number.isFinite(asset.tintLightness) ? asset.tintLightness : defaults.tintLightness,
      0.75,
      1.25,
    ),
    sheenStrength: clamp(
      Number.isFinite(asset.sheenStrength) ? asset.sheenStrength : defaults.sheenStrength,
      0,
      1.6,
    ),
  }
}

function normalizeInventoryItem(item: StickerInventoryItem): StickerInventoryItem {
  const normalizedFoilType = normalizeFoilType(item.foilType)
  const normalizedPaletteId = normalizeEditionPaletteId(item.editionPaletteId)
  const normalizedSpecialEdition = false
  const hasLegacyPaletteWithoutVariant = typeof item.specialVariantId !== 'string' && typeof item.editionPaletteId === 'string'
  const normalizedVariantId = hasLegacyPaletteWithoutVariant
    ? getSpecialVariantsForFoil(normalizedFoilType)[0].id
    : normalizeSpecialVariantId(normalizedFoilType, item.specialVariantId)
  const defaults = createEditionDefaults(normalizedSpecialEdition, normalizedFoilType, normalizedVariantId, normalizedPaletteId)
  const withPlacement = item as StickerInventoryItem & { placed?: boolean }
  return {
    ...item,
    placed: Boolean(withPlacement.placed),
    foilType: normalizedFoilType,
    foilIntensity: normalizeFoilIntensity(item.foilIntensity),
    specialEdition: normalizedSpecialEdition,
    specialVariantId: normalizedVariantId,
    editionPaletteId: normalizedPaletteId,
    fillOpacity: clamp(Number.isFinite(item.fillOpacity) ? item.fillOpacity : defaults.fillOpacity, 0.5, 1),
    tintHueShift: clamp(Number.isFinite(item.tintHueShift) ? item.tintHueShift : defaults.tintHueShift, -180, 180),
    tintSaturation: clamp(Number.isFinite(item.tintSaturation) ? item.tintSaturation : defaults.tintSaturation, 0.6, 1.6),
    tintLightness: clamp(Number.isFinite(item.tintLightness) ? item.tintLightness : defaults.tintLightness, 0.75, 1.25),
    sheenStrength: clamp(Number.isFinite(item.sheenStrength) ? item.sheenStrength : defaults.sheenStrength, 0, 1.6),
  }
}

function normalizeWholeNumber(value: unknown, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.floor(Number(value)))
}

function getStickerScrapValue(item: StickerInventoryItem): number {
  if (item.specialEdition) {
    return 120
  }
  if (item.foilType === 'none') {
    return 12
  }
  if (item.foilType === 'negative') {
    return 34
  }
  if (item.foilType === 'lavaContour') {
    return 50
  }
  if (item.foilType === 'aurora' || item.foilType === 'ripple') {
    return 42
  }
  return 36
}

function loadStoredAssets(): {
  placedAssets: PlacedAsset[]
  inventoryItems: StickerInventoryItem[]
  rollProgress: StickerRollProgress
  stickerScrap: number
  bonusRollTickets: number
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      placedAssets?: PlacedAsset[]
      inventoryItems?: StickerInventoryItem[]
      rollProgress?: StickerRollProgress
      stickerScrap?: number
      bonusRollTickets?: number
    }
    return {
      placedAssets: Array.isArray(parsed.placedAssets) ? parsed.placedAssets.map(normalizePlacedAsset) : [],
      inventoryItems: Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems.map(normalizeInventoryItem) : [],
      rollProgress: normalizeRollProgress(parsed.rollProgress),
      stickerScrap: normalizeWholeNumber(parsed.stickerScrap),
      bonusRollTickets: normalizeWholeNumber(parsed.bonusRollTickets),
    }
  } catch {
    return null
  }
}

export function ProfileScreen({
  displayName,
  avatarDataUrl,
  bio,
  statusLine,
  favoriteGenres,
  featuredImageUrls,
  profileTheme,
  collageLayout,
  featuredFallbackImageUrls,
  totalGames,
  totalPlaytimeText,
  systemsUsed,
  rungosCollected,
  favoriteGameName,
  screenshotOfWeekUrl,
  signatureRungoId,
  signatureRungoName,
  onProfileSaved,
  raProfile,
  raRecentAchievements,
  raAwards,
  raStatus,
  raError,
  onRaConnect,
  onRaDisconnect,
  isExiting,
}: ProfileScreenProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingBio, setEditingBio] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [draftName, setDraftName] = useState(displayName)
  const [draftBio, setDraftBio] = useState(bio)
  const [draftStatus, setDraftStatus] = useState(statusLine)
  const [tagDraft, setTagDraft] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [rungoHopToken, setRungoHopToken] = useState(0)
  const [raDraftUsername, setRaDraftUsername] = useState('')
  const [raDraftApiKey, setRaDraftApiKey] = useState('')

  const [placedAssets, setPlacedAssets] = useState<PlacedAsset[]>([])
  const [selectedPlacedAssetId, setSelectedPlacedAssetId] = useState<string | null>(null)
  const [justDroppedAssetId, setJustDroppedAssetId] = useState<string | null>(null)
  const [draggingPlacedAssetId, setDraggingPlacedAssetId] = useState<string | null>(null)
  const [inventoryItems, setInventoryItems] = useState<StickerInventoryItem[]>([])
  const [selectedInventoryStickerId, setSelectedInventoryStickerId] = useState<string | null>(null)
  const [stickerMenuOpen, setStickerMenuOpen] = useState(false)
  const [stickerEditMode, setStickerEditMode] = useState(false)
  const [stickerFoilPanelOpen, setStickerFoilPanelOpen] = useState(false)
  const [stickerFoilDebugMode, setStickerFoilDebugMode] = useState(false)
  const [forceNextSpecial, setForceNextSpecial] = useState(false)
  const [defaultStickerFoilType, setDefaultStickerFoilType] = useState<StickerFoilType>(DEFAULT_STICKER_FOIL_TYPE)
  const [stickerRollProgress, setStickerRollProgress] = useState<StickerRollProgress>(() => createDefaultRollProgress())
  const [stickerUploadNotice, setStickerUploadNotice] = useState('')
  const [stickerScrap, setStickerScrap] = useState(0)
  const [bonusRollTickets, setBonusRollTickets] = useState(0)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const bioInputRef = useRef<HTMLTextAreaElement>(null)
  const statusInputRef = useRef<HTMLInputElement>(null)
  const scrapbookCanvasRef = useRef<HTMLDivElement>(null)
  const foilDebugChordStartedAtRef = useRef<number>(0)
  const polychromeTextureCacheRef = useRef<Map<string, string>>(new Map())
  const polychromeMaskCacheRef = useRef<Map<string, string>>(new Map())
  const polychromeMaskLoadingRef = useRef<Set<string>>(new Set())
  const [, setPolychromeMaskVersion] = useState(0)
  const placedAssetsRef = useRef<PlacedAsset[]>(placedAssets)
  const draggingPlacedAssetRef = useRef<{
    placedAssetId: string
    element: HTMLButtonElement
    pointerId: number
    startClientX: number
    startClientY: number
    dragging: boolean
    offsetX: number
    offsetY: number
    snapshotBeforeDrag: PlacedAsset[]
  } | null>(null)
  const rippleSettleAnimationRef = useRef<number | null>(null)

  useEffect(() => {
    placedAssetsRef.current = placedAssets
  }, [placedAssets])

  useEffect(() => {
    const stored = loadStoredAssets()
    if (!stored) return
    if (stored.placedAssets.length > 0) {
      setPlacedAssets(stored.placedAssets)
    }
    if (stored.inventoryItems.length > 0) {
      setInventoryItems(stored.inventoryItems)
    }
    setStickerRollProgress(stored.rollProgress)
    setStickerScrap(stored.stickerScrap)
    setBonusRollTickets(stored.bonusRollTickets)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PROFILE_DRAFT_STORAGE_KEY,
        JSON.stringify({
          placedAssets,
          inventoryItems,
          rollProgress: stickerRollProgress,
          stickerScrap,
          bonusRollTickets,
        }),
      )
    } catch {
      // Ignore persistence failures.
    }
  }, [placedAssets, inventoryItems, stickerRollProgress, stickerScrap, bonusRollTickets])

  useEffect(() => {
    if (!justDroppedAssetId) return
    const timer = window.setTimeout(() => setJustDroppedAssetId(null), 320)
    return () => window.clearTimeout(timer)
  }, [justDroppedAssetId])

  useEffect(() => {
    if (stickerEditMode) return
    draggingPlacedAssetRef.current = null
    setDraggingPlacedAssetId(null)
    setSelectedPlacedAssetId(null)
    setStickerFoilPanelOpen(false)
  }, [stickerEditMode])

  useEffect(() => {
    if (stickerFoilDebugMode) return
    setStickerFoilPanelOpen(false)
  }, [stickerFoilDebugMode])

  useEffect(() => {
    return () => {
      if (rippleSettleAnimationRef.current !== null) {
        window.cancelAnimationFrame(rippleSettleAnimationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    const onDebugChordKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        foilDebugChordStartedAtRef.current = Date.now()
        return
      }

      const isBackquote = event.code === 'Backquote' || event.key === '`'
      if (!isBackquote) {
        return
      }

      if (Date.now() - foilDebugChordStartedAtRef.current > 2000) {
        return
      }

      foilDebugChordStartedAtRef.current = 0
      event.preventDefault()
      setStickerFoilDebugMode((prev) => !prev)
    }

    window.addEventListener('keydown', onDebugChordKeyDown)
    return () => window.removeEventListener('keydown', onDebugChordKeyDown)
  }, [])

  const featuredImages = useMemo(
    () => resolveFeaturedImages(featuredImageUrls, featuredFallbackImageUrls),
    [featuredFallbackImageUrls, featuredImageUrls],
  )

  const selectedPlacedAsset = useMemo(
    () => placedAssets.find((asset) => asset.id === selectedPlacedAssetId) ?? null,
    [placedAssets, selectedPlacedAssetId],
  )

  const getPolychromeTexture = (asset: PlacedAsset): string => {
    const cacheKey = `${asset.id}:${asset.name}:${asset.createdAt}`
    const cached = polychromeTextureCacheRef.current.get(cacheKey)
    if (cached) {
      return cached
    }
    const texture = createPolychromeTextureDataUrl(cacheKey)
    if (!texture) {
      return ''
    }
    polychromeTextureCacheRef.current.set(cacheKey, texture)
    return texture
  }

  const getPolychromeLumaMask = (asset: PlacedAsset): string => {
    const imageUrl = asset.imageUrl?.trim() ?? ''
    if (!imageUrl) {
      return ''
    }

    const cached = polychromeMaskCacheRef.current.get(imageUrl)
    if (cached) {
      return cached
    }

    if (!polychromeMaskLoadingRef.current.has(imageUrl)) {
      polychromeMaskLoadingRef.current.add(imageUrl)
      void createPolychromeLumaMaskDataUrl(imageUrl)
        .then((maskDataUrl) => {
          if (maskDataUrl) {
            polychromeMaskCacheRef.current.set(imageUrl, maskDataUrl)
            setPolychromeMaskVersion((prev) => prev + 1)
          }
        })
        .catch(() => {
          // Ignore mask generation failures and fall back to alpha-only masking.
        })
        .finally(() => {
          polychromeMaskLoadingRef.current.delete(imageUrl)
        })
    }

    return ''
  }

  const mutatePlacedAssets = (mutator: (prev: PlacedAsset[]) => PlacedAsset[]) => {
    setPlacedAssets((prev) => {
      const next = mutator(prev)
      if (next === prev) return prev
      return next
    })
  }

  const computeSnappedPlacement = (rawX: number, rawY: number) => {
    const rect = scrapbookCanvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return { x: rawX, y: rawY, guideX: null as number | null, guideY: null as number | null }
    }

    const maxX = rect.width - 20
    const maxY = rect.height - 20
    const weakSnapThreshold = 12
    const xAnchors: number[] = [rect.width / 2]
    const yAnchors: number[] = [rect.height / 2]

    for (const asset of placedAssetsRef.current) {
      xAnchors.push(asset.x)
      yAnchors.push(asset.y)
    }

    let snappedX = clamp(rawX, 20, maxX)
    let snappedY = clamp(rawY, 20, maxY)
    let guideX: number | null = null
    let guideY: number | null = null

    for (const anchorX of xAnchors) {
      if (Math.abs(anchorX - snappedX) <= weakSnapThreshold) {
        snappedX = anchorX
        guideX = anchorX
        break
      }
    }

    for (const anchorY of yAnchors) {
      if (Math.abs(anchorY - snappedY) <= weakSnapThreshold) {
        snappedY = anchorY
        guideY = anchorY
        break
      }
    }

    return { x: snappedX, y: snappedY, guideX, guideY }
  }

  const placeInventoryItemOnCanvas = (inventoryItem: StickerInventoryItem, x?: number, y?: number) => {
    const rect = scrapbookCanvasRef.current?.getBoundingClientRect()
    const fallbackX = rect ? rect.width * 0.5 : 360
    const fallbackY = rect ? rect.height * 0.5 : 220
    const placement = computeSnappedPlacement(x ?? fallbackX, y ?? fallbackY)
    const placed: PlacedAsset = {
      id: makeId('placed'),
      name: inventoryItem.name,
      sourceInventoryId: inventoryItem.id,
      imageUrl: inventoryItem.imageUrl,
      x: placement.x,
      y: placement.y,
      rotation: 0,
      scale: 1,
      opacity: 1,
      zIndex: nextZIndex(placedAssetsRef.current),
      createdAt: Date.now(),
      foilType: inventoryItem.foilType,
      foilIntensity: inventoryItem.foilIntensity,
      specialEdition: inventoryItem.specialEdition,
      specialVariantId: inventoryItem.specialVariantId,
      editionPaletteId: inventoryItem.editionPaletteId,
      fillOpacity: inventoryItem.fillOpacity,
      tintHueShift: inventoryItem.tintHueShift,
      tintSaturation: inventoryItem.tintSaturation,
      tintLightness: inventoryItem.tintLightness,
      sheenStrength: inventoryItem.sheenStrength,
    }

    mutatePlacedAssets((prev) => [...prev, placed])
    setSelectedPlacedAssetId(placed.id)
    setJustDroppedAssetId(placed.id)
  }

  const addUploadedInventoryItem = (imageUrl: string, rollOutcome: StickerRollOutcome): StickerInventoryItem => {
    const inventoryItem: StickerInventoryItem = {
      id: makeId('inventory'),
      name: `Sticker ${inventoryItems.length + 1}`,
      imageUrl,
      createdAt: Date.now(),
      placed: false,
      foilType: rollOutcome.foilType,
      foilIntensity: rollOutcome.foilIntensity,
      specialEdition: rollOutcome.specialEdition,
      specialVariantId: rollOutcome.specialVariantId,
      editionPaletteId: rollOutcome.editionPaletteId,
      fillOpacity: rollOutcome.fillOpacity,
      tintHueShift: rollOutcome.tintHueShift,
      tintSaturation: rollOutcome.tintSaturation,
      tintLightness: rollOutcome.tintLightness,
      sheenStrength: rollOutcome.sheenStrength,
    }
    setInventoryItems((prev) => [inventoryItem, ...prev])
    return inventoryItem
  }

  const placeInventoryItemById = (inventoryId: string, x?: number, y?: number, markPlaced = false) => {
    const item = inventoryItems.find((entry) => entry.id === inventoryId)
    if (!item || item.placed) {
      return
    }
    placeInventoryItemOnCanvas(item, x, y)
    if (markPlaced) {
      setInventoryItems((prev) => prev.map((entry) => (entry.id === inventoryId ? { ...entry, placed: true } : entry)))
    }
    setSelectedInventoryStickerId(inventoryId)
  }

  const sellInventoryStickerById = (inventoryId: string) => {
    const item = inventoryItems.find((entry) => entry.id === inventoryId)
    if (!item || item.placed) {
      return
    }
    const scrapValue = getStickerScrapValue(item)
    setInventoryItems((prev) => prev.filter((entry) => entry.id !== inventoryId))
    setStickerScrap((prev) => prev + scrapValue)
    setSelectedInventoryStickerId((prev) => (prev === inventoryId ? null : prev))
    setStickerUploadNotice(`Sold ${item.name} for ${scrapValue} scrap.`)
  }

  const buyBonusRollTicket = () => {
    if (stickerScrap < STICKER_SCRAP_ROLL_TICKET_COST) {
      setStickerUploadNotice(`Need ${STICKER_SCRAP_ROLL_TICKET_COST} scrap for a bonus roll ticket.`)
      return
    }
    setStickerScrap((prev) => prev - STICKER_SCRAP_ROLL_TICKET_COST)
    setBonusRollTickets((prev) => prev + 1)
    setStickerUploadNotice(`Bought 1 bonus roll ticket. Tickets: ${bonusRollTickets + 1}.`)
  }

  const readInventoryDragId = (dataTransfer: DataTransfer): string => {
    const customValue = dataTransfer.getData(STICKER_DRAG_TRANSFER_TYPE)
    if (customValue) {
      return customValue
    }
    const plainTextValue = dataTransfer.getData('text/plain')
    if (plainTextValue.startsWith(STICKER_DRAG_TRANSFER_PREFIX)) {
      return plainTextValue.slice(STICKER_DRAG_TRANSFER_PREFIX.length)
    }
    return ''
  }

  const handlePickAvatar = async () => {
    setAvatarError('')
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] }],
      })
      if (!selected || Array.isArray(selected)) return
      const dataUrl = await readLocalImageAsDataUrl(selected)
      const normalized = dataUrl.trim()
      if (!normalized.startsWith('data:image/') || normalized.length > 4_000_000) {
        setAvatarError('Image too large or unsupported format. Try a smaller PNG or JPG.')
        return
      }
      onProfileSaved({ avatarDataUrl: normalized })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setAvatarError(`Could not load image: ${message}`)
    }
  }

  const handleUploadTrayAsset = async () => {
    const now = Date.now()
    const normalizedProgress = normalizeRollProgress(stickerRollProgress, now)
    const bypassUploadCaps = stickerFoilDebugMode
    const hitDailyCap = !bypassUploadCaps && normalizedProgress.dailyUploads >= STICKER_UPLOAD_DAILY_CAP
    const hitWeeklyCap = !bypassUploadCaps && normalizedProgress.weeklyUploads >= STICKER_UPLOAD_WEEKLY_CAP
    const canBypassCapWithTicket = bypassUploadCaps || bonusRollTickets > 0
    if ((hitDailyCap || hitWeeklyCap) && !canBypassCapWithTicket) {
      setStickerRollProgress(normalizedProgress)
      setStickerUploadNotice(
        hitDailyCap
          ? `Daily upload cap reached (${STICKER_UPLOAD_DAILY_CAP}).`
          : `Weekly upload cap reached (${STICKER_UPLOAD_WEEKLY_CAP}).`,
      )
      return
    }

    if ((hitDailyCap || hitWeeklyCap) && !bypassUploadCaps) {
      setBonusRollTickets((prev) => Math.max(0, prev - 1))
      setStickerUploadNotice('Used 1 bonus roll ticket to bypass upload cap.')
    }

    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] }],
      })
      if (!selected || Array.isArray(selected)) return
      const dataUrl = await readLocalImageAsDataUrl(selected)
      const normalized = dataUrl.trim()
      if (!normalized.startsWith('data:image/') || normalized.length > 4_000_000) return

      const outcome = rollStickerOutcome(normalizedProgress, Math.random, { forceSpecial: forceNextSpecial })
      setForceNextSpecial(false)
      setStickerRollProgress(outcome.nextProgress)
      const inventoryItem = addUploadedInventoryItem(normalized, outcome)
      setStickerMenuOpen(true)

      const remainingDaily = Math.max(0, STICKER_UPLOAD_DAILY_CAP - outcome.nextProgress.dailyUploads)
      const remainingWeekly = Math.max(0, STICKER_UPLOAD_WEEKLY_CAP - outcome.nextProgress.weeklyUploads)
      const rarityLabel = outcome.foilType === 'none'
        ? 'No foil this pull.'
        : outcome.specialEdition
          ? `Special ${STICKER_FOIL_OPTIONS.find((option) => option.value === outcome.foilType)?.label ?? 'Foil'} unlocked!`
          : `${STICKER_FOIL_OPTIONS.find((option) => option.value === outcome.foilType)?.label ?? 'Foil'} unlocked.`
      const remainingText = bypassUploadCaps
        ? 'Debug mode: unlimited uploads.'
        : `${remainingDaily} daily / ${remainingWeekly} weekly uploads remaining.`
      setStickerUploadNotice(`${rarityLabel} Added to menu: ${inventoryItem.name}. ${remainingText}`)
    } catch {
      // Ignore user cancel/upload errors.
    }
  }

  const handleReplaceFeaturedImage = async (index: number) => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] }],
      })
      if (!selected || Array.isArray(selected)) return
      const dataUrl = await readLocalImageAsDataUrl(selected)
      const normalized = dataUrl.trim()
      if (!normalized.startsWith('data:image/') || normalized.length > 4_000_000) return

      const next = [...featuredImageUrls]
      while (next.length < 3) {
        next.push('')
      }
      next[index] = normalized
      onProfileSaved({ featuredImageUrls: next.slice(0, 3) })
    } catch {
      // Optional feature image replacement; ignore errors.
    }
  }

  const rotateFeaturedImages = () => {
    const next = [...featuredImageUrls]
    while (next.length < 3) {
      next.push('')
    }
    onProfileSaved({ featuredImageUrls: [next[1], next[2], next[0]] })
  }

  const commitName = () => {
    const trimmed = draftName.trim()
    if (trimmed.length >= 2 && trimmed !== displayName) {
      onProfileSaved({ displayName: trimmed })
    } else {
      setDraftName(displayName)
    }
    setEditingName(false)
  }

  const commitBio = () => {
    const trimmed = draftBio.trim()
    if (trimmed !== bio) {
      onProfileSaved({ bio: trimmed })
    }
    setEditingBio(false)
  }

  const commitStatus = () => {
    const trimmed = draftStatus.trim()
    if (trimmed !== statusLine) {
      onProfileSaved({ statusLine: trimmed })
    }
    setEditingStatus(false)
  }

  const beginEditingName = () => {
    setDraftName(displayName)
    setEditingName(true)
    requestAnimationFrame(() => nameInputRef.current?.select())
  }

  const beginEditingBio = () => {
    setDraftBio(bio)
    setEditingBio(true)
    requestAnimationFrame(() => {
      bioInputRef.current?.focus()
      bioInputRef.current?.select()
    })
  }

  const beginEditingStatus = () => {
    setDraftStatus(statusLine)
    setEditingStatus(true)
    requestAnimationFrame(() => statusInputRef.current?.select())
  }

  const handleRungoClick = () => {
    setRungoHopToken((t) => t + 1)
  }

  const addGenreTag = () => {
    const nextTag = tagDraft.trim()
    if (!nextTag || favoriteGenres.includes(nextTag) || favoriteGenres.length >= MAX_TAGS) {
      return
    }
    onProfileSaved({ favoriteGenres: [...favoriteGenres, nextTag] })
    setTagDraft('')
  }

  const removeGenreTag = (tag: string) => {
    onProfileSaved({ favoriteGenres: favoriteGenres.filter((entry) => entry !== tag) })
  }

  const removePlacedAssetById = (assetId: string) => {
    const removedSourceInventoryId = placedAssetsRef.current.find((asset) => asset.id === assetId)?.sourceInventoryId
    mutatePlacedAssets((prev) => prev.filter((asset) => asset.id !== assetId))
    if (removedSourceInventoryId) {
      setInventoryItems((prev) =>
        prev.map((item) =>
          item.id === removedSourceInventoryId
            ? { ...item, placed: false }
            : item,
        ),
      )
    }
    setSelectedPlacedAssetId((prev) => (prev === assetId ? null : prev))
    if (draggingPlacedAssetRef.current?.placedAssetId === assetId) {
      draggingPlacedAssetRef.current = null
    }
    setDraggingPlacedAssetId((prev) => (prev === assetId ? null : prev))
  }

  const removeSelectedPlacedAsset = () => {
    if (!selectedPlacedAssetId) return
    removePlacedAssetById(selectedPlacedAssetId)
  }

  const updateSelectedOrDefaultFoilType = (foilType: StickerFoilType) => {
    if (selectedPlacedAssetId) {
      const currentAsset = placedAssets.find((a) => a.id === selectedPlacedAssetId)
      mutatePlacedAssets((prev) =>
        prev.map((asset) =>
          asset.id !== selectedPlacedAssetId
            ? asset
            : (() => {
                const nextVariant = getSpecialVariantsForFoil(foilType)[0]
                if (asset.foilType === foilType && asset.specialEdition) {
                  return {
                    ...asset,
                    foilType,
                    ...createEditionDefaults(false, foilType, nextVariant.id, nextVariant.legacyPaletteId),
                  }
                }
                if (asset.specialEdition) {
                  return {
                    ...asset,
                    foilType,
                    ...createEditionDefaults(true, foilType, nextVariant.id, nextVariant.legacyPaletteId),
                  }
                }
                return {
                  ...asset,
                  foilType,
                  specialVariantId: nextVariant.id,
                  editionPaletteId: nextVariant.legacyPaletteId,
                }
              })(),
        ),
      )
      if (currentAsset?.sourceInventoryId) {
        const srcId = currentAsset.sourceInventoryId
        setInventoryItems((prev) =>
          prev.map((item) => {
            if (item.id !== srcId) return item
            const nextVariant = getSpecialVariantsForFoil(foilType)[0]
            const editionDefaults = item.specialEdition
              ? createEditionDefaults(item.foilType !== foilType, foilType, nextVariant.id, nextVariant.legacyPaletteId)
              : { specialVariantId: nextVariant.id, editionPaletteId: nextVariant.legacyPaletteId }
            return { ...item, foilType, ...editionDefaults }
          }),
        )
      }
      return
    }
    setDefaultStickerFoilType(foilType)
  }

  const applyCurrentFoilToAllStickers = () => {
    const foilType = selectedPlacedAsset?.foilType ?? defaultStickerFoilType
    const foilIntensity: StickerFoilIntensity = 'high'
    mutatePlacedAssets((prev) =>
      prev.map((asset) => {
        const nextVariant = getSpecialVariantsForFoil(foilType)[0]
        if (asset.specialEdition) {
          return {
            ...asset,
            foilType,
            foilIntensity,
            ...createEditionDefaults(true, foilType, nextVariant.id, nextVariant.legacyPaletteId),
          }
        }
        return {
          ...asset,
          foilType,
          foilIntensity,
          specialVariantId: nextVariant.id,
          editionPaletteId: nextVariant.legacyPaletteId,
        }
      }),
    )
  }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const session = draggingPlacedAssetRef.current
      if (!session) return
      if (event.pointerId !== session.pointerId) return
      const rect = scrapbookCanvasRef.current?.getBoundingClientRect()
      if (!rect) return

      if (!session.dragging) {
        const deltaX = event.clientX - session.startClientX
        const deltaY = event.clientY - session.startClientY
        if (Math.hypot(deltaX, deltaY) < STICKER_DRAG_START_THRESHOLD_PX) {
          return
        }
        session.dragging = true
        setDraggingPlacedAssetId(session.placedAssetId)
      }

      const rawX = event.clientX - rect.left - session.offsetX
      const rawY = event.clientY - rect.top - session.offsetY
      const placement = computeSnappedPlacement(rawX, rawY)

      setPlacedAssets((prev) =>
        prev.map((asset) =>
          asset.id === session.placedAssetId
            ? {
                ...asset,
                x: placement.x,
                y: placement.y,
              }
            : asset,
        ),
      )
    }

    const onUp = (event: PointerEvent) => {
      const session = draggingPlacedAssetRef.current
      if (!session) return
      if (event.pointerId !== session.pointerId) return
      if (session.element.hasPointerCapture(session.pointerId)) {
        session.element.releasePointerCapture(session.pointerId)
      }
      draggingPlacedAssetRef.current = null
      setDraggingPlacedAssetId(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!stickerEditMode) return
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true'
      if (isTyping) return

      if (!selectedPlacedAssetId) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelectedPlacedAsset()
        return
      }

      const step = event.shiftKey ? 12 : 4
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        mutatePlacedAssets((prev) =>
          prev.map((asset) =>
            asset.id === selectedPlacedAssetId
              ? {
                  ...asset,
                  x: asset.x - step,
                }
              : asset,
          ),
        )
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        mutatePlacedAssets((prev) =>
          prev.map((asset) =>
            asset.id === selectedPlacedAssetId
              ? {
                  ...asset,
                  x: asset.x + step,
                }
              : asset,
          ),
        )
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        mutatePlacedAssets((prev) =>
          prev.map((asset) =>
            asset.id === selectedPlacedAssetId
              ? {
                  ...asset,
                  y: asset.y - step,
                }
              : asset,
          ),
        )
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        mutatePlacedAssets((prev) =>
          prev.map((asset) =>
            asset.id === selectedPlacedAssetId
              ? {
                  ...asset,
                  y: asset.y + step,
                }
              : asset,
          ),
        )
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedPlacedAssetId, stickerEditMode])

  const screenThemeClass =
    profileTheme === 'aurora'
      ? styles.screenThemeAurora
      : profileTheme === 'midnight'
        ? styles.screenThemeMidnight
        : styles.screenThemeFrost

  const featuredGridClass =
    collageLayout === 'polaroid'
      ? `${styles.featuredGrid} ${styles.featuredGridPolaroid}`
      : collageLayout === 'stack'
        ? `${styles.featuredGrid} ${styles.featuredGridStack}`
        : styles.featuredGrid

  const pinnedMemoryUrl = screenshotOfWeekUrl || featuredImages[0] || ''
  const playerNote = statusLine || bio || 'No note yet. Add a status or bio to pin your vibe.'
  const activeFoilType = selectedPlacedAsset?.foilType ?? defaultStickerFoilType
  const normalizedRollProgress = normalizeRollProgress(stickerRollProgress)
  const dailyUploadsRemaining = Math.max(0, STICKER_UPLOAD_DAILY_CAP - normalizedRollProgress.dailyUploads)
  const weeklyUploadsRemaining = Math.max(0, STICKER_UPLOAD_WEEKLY_CAP - normalizedRollProgress.weeklyUploads)
  const uploadsRemainingLabel = stickerFoilDebugMode
    ? 'Infinite (debug mode)'
    : `${dailyUploadsRemaining} daily / ${weeklyUploadsRemaining} weekly`
  const selectedInventorySticker = selectedInventoryStickerId
    ? inventoryItems.find((entry) => entry.id === selectedInventoryStickerId) ?? null
    : null
  const selectedInventoryNeedsDarkText = shouldUseDarkInfoPanelText(selectedInventorySticker)
  const selectedInventoryFoilLabel = selectedInventorySticker
    ? STICKER_FOIL_OPTIONS.find((entry) => entry.value === selectedInventorySticker.foilType)?.label ?? 'None'
    : 'None'
  const updateSelectedSpecialVariant = (foilType: StickerFoilType, variantId: StickerSpecialVariantId) => {
    if (!selectedPlacedAssetId) return
    const currentAsset = placedAssets.find((a) => a.id === selectedPlacedAssetId)
    mutatePlacedAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedPlacedAssetId) {
          return asset
        }
        const variant = getSpecialVariant(foilType, variantId)
        return {
          ...asset,
          foilType,
          ...createEditionDefaults(true, foilType, variant.id, variant.legacyPaletteId),
        }
      }),
    )
    if (currentAsset?.sourceInventoryId) {
      const srcId = currentAsset.sourceInventoryId
      const variant = getSpecialVariant(foilType, variantId)
      setInventoryItems((prev) =>
        prev.map((item) =>
          item.id !== srcId
            ? item
            : { ...item, foilType, ...createEditionDefaults(true, foilType, variant.id, variant.legacyPaletteId) },
        ),
      )
    }
  }
  const getInventoryFoilStyle = (item: StickerInventoryItem): CSSProperties => {
    const isRippleFoil = item.foilType === 'ripple'
    const isLavaContourFoil = item.foilType === 'lavaContour'
    const usesAdvancedFoilMotion = isRippleFoil || isLavaContourFoil
    const variantStyleVars = resolveSpecialVariantStyleVars(item, item.id)

    const rippleAnimationStyle: CSSProperties | undefined = usesAdvancedFoilMotion
      ? {
          ['--ripple-duration' as string]: `${Math.round(22000 + hashToUnit(item.id, 11) * 10000)}ms`,
          ['--ripple-delay' as string]: `${Math.round(-hashToUnit(item.id, 29) * 42000)}ms`,
          ['--ripple-shift-x' as string]: `${((hashToUnit(item.id, 47) - 0.5) * 6).toFixed(2)}%`,
          ['--ripple-shift-y' as string]: `${((hashToUnit(item.id, 71) - 0.5) * 6).toFixed(2)}%`,
          ['--foil-delay' as string]: `${Math.round(-hashToUnit(item.id, 97) * 36000)}ms`,
          ['--foil-speed' as string]: `${(0.9 + hashToUnit(item.id, 113) * 0.36).toFixed(3)}`,
          ['--foil-phase' as string]: `${(hashToUnit(item.id, 131) * 360).toFixed(2)}deg`,
          ['--ripple-mouse-x' as string]: '0',
          ['--ripple-mouse-y' as string]: '0',
          ['--ripple-uv-x' as string]: '0.5',
          ['--ripple-uv-y' as string]: '0.5',
          ['--foil-mouse-x' as string]: '0',
          ['--foil-mouse-y' as string]: '0',
          ['--foil-uv-x' as string]: '0.5',
          ['--foil-uv-y' as string]: '0.5',
          ['--foil-edge' as string]: '0',
          ['--foil-center-dist' as string]: '0',
        }
      : undefined

    return {
      ...variantStyleVars,
      ...(rippleAnimationStyle ?? {}),
    }
  }
  const selectedInventoryFoilStyle: CSSProperties | undefined = selectedInventorySticker
    ? getInventoryFoilStyle(selectedInventorySticker)
    : undefined

  return (
    <div className={`${styles.screen} ${screenThemeClass}`} data-controller-tab="profile">
      <div className={styles.minimalStickerToolbar}>
        <button
          type="button"
          className={styles.minimalUploadButton}
          onClick={() => setStickerMenuOpen((prev) => !prev)}
          aria-label={stickerMenuOpen ? 'Hide sticker menu' : 'Show sticker menu'}
          title={stickerMenuOpen ? 'Hide sticker menu' : 'Show sticker menu'}
        >
          {stickerMenuOpen ? 'Hide Sticker Menu' : 'Sticker Menu'}
        </button>
      </div>
      <p className={styles.foilPanelStatusLine}>
        Uploads remaining: {uploadsRemainingLabel}.
      </p>
      {stickerUploadNotice && <p className={styles.foilPanelNotice}>{stickerUploadNotice}</p>}
      {stickerFoilDebugMode && stickerEditMode && stickerFoilPanelOpen && (
        <div className={styles.foilPanel}>
          <div className={styles.foilPanelSection}>
            <p className={styles.foilPanelLabel}>
              {selectedPlacedAsset ? 'Selected Sticker Foil' : 'Default Foil For New Stickers'}
            </p>
            <div className={styles.foilChipRow}>
              {STICKER_FOIL_OPTIONS.map((option) => (
                <div key={option.value} className={styles.foilOptionGroup}>
                  <button
                    type="button"
                    className={`${styles.foilChip} ${activeFoilType === option.value ? styles.foilChipActive : ''}`.trim()}
                    onClick={() => updateSelectedOrDefaultFoilType(option.value)}
                  >
                    {option.label}
                  </button>
                  <div className={styles.foilVariantRow}>
                    {getSpecialVariantsForFoil(option.value).map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        className={`${styles.foilChip} ${selectedPlacedAsset && selectedPlacedAsset.foilType === option.value && selectedPlacedAsset.specialEdition && selectedPlacedAsset.specialVariantId === variant.id ? styles.foilChipActive : ''}`.trim()}
                        onClick={() => updateSelectedSpecialVariant(option.value, variant.id)}
                        disabled={!selectedPlacedAssetId}
                        title={selectedPlacedAssetId ? `Apply ${variant.label} special variant` : 'Select a sticker on the page to apply special variants'}
                      >
                        {variant.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {placedAssets.length > 0 && (
            <button
              type="button"
              className={styles.foilApplyAllButton}
              onClick={applyCurrentFoilToAllStickers}
            >
              Apply To All Stickers
            </button>
          )}
          <div className={styles.foilPanelSection}>
            <p className={styles.foilPanelLabel}>Special Edition Debug</p>
            <p className={styles.foilPanelMetaLine}>Foils since special: {stickerRollProgress.foilsSinceSpecial} / {STICKER_SPECIAL_PITY_FOILS}</p>
            <div className={styles.foilChipRow}>
              <button
                type="button"
                className={`${styles.foilChip} ${forceNextSpecial ? styles.foilChipActive : ''}`.trim()}
                onClick={() => setForceNextSpecial((prev) => !prev)}
              >
                {forceNextSpecial ? 'Force Special: ON' : 'Force Next Special'}
              </button>
              <button
                type="button"
                className={styles.foilChip}
                onClick={() => setStickerRollProgress((prev) => ({ ...prev, foilsSinceSpecial: STICKER_SPECIAL_PITY_FOILS - 1 }))}
              >
                Set Pity (next triggers)
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className={`${styles.bookSpread}${isExiting ? ` ${styles.bookSpreadExiting}` : ''}`}
        ref={scrapbookCanvasRef}
        onDragOver={(event) => {
          const inventoryId = readInventoryDragId(event.dataTransfer)
          if (!inventoryId) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          const inventoryId = readInventoryDragId(event.dataTransfer)
          if (!inventoryId) return
          event.preventDefault()
          const rect = scrapbookCanvasRef.current?.getBoundingClientRect()
          if (!rect) return
          const rawX = event.clientX - rect.left
          const rawY = event.clientY - rect.top
          placeInventoryItemById(inventoryId, rawX, rawY, true)
          setStickerEditMode(true)
        }}
        onClick={() => {
          if (!stickerEditMode) return
          setSelectedPlacedAssetId(null)
        }}
      >
        <div className={styles.bookPageLeft}>
          <div className={styles.bookAvatarWrap}>
            <button
              type="button"
              className={styles.avatarButton}
              onClick={handlePickAvatar}
              aria-label="Change avatar"
              title="Click to change avatar"
            >
              {avatarDataUrl ? (
                <img className={styles.avatarImage} src={avatarDataUrl} alt="" />
              ) : (
                <span className={styles.avatarInitials} aria-hidden="true">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className={styles.avatarEditHint} aria-hidden="true">Edit</span>
            </button>
          </div>

          <div className={styles.identityBlock}>
            {editingName ? (
              <input
                ref={nameInputRef}
                className={styles.nameInput}
                type="text"
                value={draftName}
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName()
                  if (e.key === 'Escape') { setDraftName(displayName); setEditingName(false) }
                }}
              />
            ) : (
              <button type="button" className={styles.nameButton} onClick={beginEditingName} aria-label="Edit display name">
                {displayName}
                <span className={styles.editPencil} aria-hidden="true">?</span>
              </button>
            )}

            {editingStatus ? (
              <input
                ref={statusInputRef}
                className={styles.statusInput}
                type="text"
                value={draftStatus}
                maxLength={MAX_STATUS_LENGTH}
                autoFocus
                onChange={(e) => setDraftStatus(e.target.value)}
                onBlur={commitStatus}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitStatus()
                  if (e.key === 'Escape') { setDraftStatus(statusLine); setEditingStatus(false) }
                }}
              />
            ) : (
              <button
                type="button"
                className={statusLine ? styles.statusButton : styles.statusButtonEmpty}
                onClick={beginEditingStatus}
                aria-label="Edit status"
              >
                {statusLine || 'Set your status...'}
                <span className={styles.editPencil} aria-hidden="true">?</span>
              </button>
            )}

            {editingBio ? (
              <textarea
                ref={bioInputRef}
                className={styles.bioTextarea}
                value={draftBio}
                maxLength={MAX_BIO_LENGTH}
                rows={3}
                autoFocus
                onChange={(e) => setDraftBio(e.target.value)}
                onBlur={commitBio}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setDraftBio(bio); setEditingBio(false) }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitBio() }
                }}
              />
            ) : (
              <button
                type="button"
                className={bio ? styles.bioButton : styles.bioButtonEmpty}
                onClick={beginEditingBio}
                aria-label="Edit bio"
              >
                {bio || 'Add a short bio...'}
                <span className={styles.editPencil} aria-hidden="true">?</span>
              </button>
            )}
          </div>

          <div className={styles.statsRail} aria-label="Profile stats">
            <span className={styles.statChip}>?? {totalGames} Games</span>
            <span className={styles.statChip}>? {totalPlaytimeText}</span>
            <span className={styles.statChip}>?? {systemsUsed} Systems</span>
            <span className={styles.statChip}>?? {rungosCollected} Rungos</span>
          </div>

          <div className={styles.tagRow}>
            {favoriteGenres.map((tag) => (
              <button
                key={tag}
                type="button"
                className={styles.tagChip}
                onClick={() => removeGenreTag(tag)}
                aria-label={`Remove ${tag}`}
                title="Click to remove"
              >
                {tag}
              </button>
            ))}
            {favoriteGenres.length < MAX_TAGS && (
              <input
                value={tagDraft}
                placeholder="+ genre"
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addGenreTag()
                  }
                }}
                onBlur={addGenreTag}
              />
            )}
          </div>

          {avatarError && <p className={styles.errorNote} role="alert">{avatarError}</p>}

          <div className={styles.pageDivider} aria-hidden="true" />

          <div className={styles.leftHighlights}>
            <div className={styles.highlightItem}>
              <span className={styles.highlightLabel}>Signature Rungo</span>
              {signatureRungoId ? (
                <>
                  <button
                    type="button"
                    className={styles.rungoPreviewButton}
                    onClick={handleRungoClick}
                    aria-label={`Poke ${signatureRungoName}`}
                    title="Click to poke your Rungo"
                  >
                    <SignatureRungoPreview
                      rungoId={signatureRungoId}
                      sizePx={72}
                      ambientMode="running"
                      hopToken={rungoHopToken}
                    />
                  </button>
                  <p className={styles.highlightValue}>{signatureRungoName}</p>
                </>
              ) : (
                <p className={styles.highlightEmpty}>Pick a Rungo</p>
              )}
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightLabel}>Favorite Game</span>
              <p className={styles.highlightValue}>{favoriteGameName}</p>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightLabel}>Most Played</span>
              <p className={styles.highlightValue}>{totalPlaytimeText}</p>
            </div>
          </div>
        </div>

        <div className={styles.bookSeam} aria-hidden="true" />

        <div className={styles.bookPageRight}>
          <div className={styles.movableSection}>
            <div className={styles.storyChipRow} aria-label="Scrapbook story chips">
              <span className={styles.storyChip}>April Drop</span>
              <span className={styles.storyChip}>Weekend Run</span>
              <span className={styles.storyChip}>S Rank Unlock</span>
            </div>
          </div>

          <div className={styles.movableSection}>
            <div className={styles.panelHeadRow}>
              <h2 className={styles.sectionHeading}>Memory Collage</h2>
              <button type="button" className={styles.rotateButton} onClick={rotateFeaturedImages}>Rotate Picks</button>
            </div>

            <div className={featuredGridClass}>
              {featuredImages.map((url, index) => (
                <button
                  key={`featured-${index}`}
                  type="button"
                  className={styles.featuredTile}
                  onClick={() => handleReplaceFeaturedImage(index)}
                  title="Click to replace image"
                >
                  {url ? (
                    <img src={url} alt="Featured profile tile" />
                  ) : (
                    <span className={styles.featuredEmpty}>Add image</span>
                  )}
                  <span className={styles.featuredCaption} aria-hidden="true">. . .</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tornDivider} aria-hidden="true" />

          <div className={styles.movableSection}>
            <h2 className={styles.sectionHeading}>Pinned Memory</h2>
            <article className={styles.pinnedMemoryCard}>
              {pinnedMemoryUrl ? (
                <img className={styles.pinnedMemoryImage} src={pinnedMemoryUrl} alt="Pinned memory" />
              ) : (
                <div className={styles.pinnedMemoryEmpty}>Pin a screenshot to start your memory board</div>
              )}
              <p className={styles.pinnedMemoryCaption}>Weekend snapshot from {favoriteGameName}</p>
            </article>
          </div>

          <div className={styles.movableSection}>
            <h2 className={styles.sectionHeading}>Player Notes</h2>
            <article className={styles.playerNotesCard}>
              <p>{playerNote}</p>
            </article>
          </div>

          <div className={styles.tornDivider} aria-hidden="true" />

          <div className={styles.movableSection}>
            <h2 className={styles.sectionHeading}>RetroAchievements</h2>
            {raStatus === 'connected' && raProfile ? (
              <div className={styles.raConnectedPanel}>
              <div className={styles.raHeader}>
                {raProfile.avatarUrl && (
                  <img className={styles.raAvatar} src={raProfile.avatarUrl} alt={raProfile.username} />
                )}
                <div className={styles.raHeaderInfo}>
                  <span className={styles.raUsername}>{raProfile.username}</span>
                  <span className={styles.raPoints}>{raProfile.totalPoints.toLocaleString()} pts{raProfile.rank ? ` - Rank #${raProfile.rank.toLocaleString()}` : ''}</span>
                </div>
                <button type="button" className={styles.raDisconnectButton} onClick={onRaDisconnect} title="Disconnect">X</button>
              </div>
              {raAwards.length > 0 && (
                <div className={styles.raAwardsRow}>
                  {raAwards.slice(0, 6).map((award, i) => (
                    <div key={i} className={styles.raAwardChip} title={`${award.title} (${award.awardType})`}>
                      {award.imageUrl ? (
                        <img className={styles.raAwardIcon} src={award.imageUrl} alt={award.title} />
                      ) : (
                        <span className={styles.raAwardIconFallback}>AW</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {raRecentAchievements.length > 0 && (
                <ul className={styles.raFeed}>
                  {raRecentAchievements.slice(0, 5).map((a) => (
                    <li key={a.achievementId} className={styles.raFeedItem}>
                      {a.badgeUrl && <img className={styles.raFeedBadge} src={a.badgeUrl} alt="" />}
                      <div className={styles.raFeedText}>
                        <span className={styles.raFeedTitle}>{a.title}</span>
                        <span className={styles.raFeedGame}>{a.gameTitle} - {a.points} pts</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            ) : (
              <div className={styles.raConnectPanel}>
                {raStatus === 'error' && (
                  <p className={styles.raConnectError} role="alert">{raError}</p>
                )}
                <p className={styles.raConnectHint}>
                  Connect your RetroAchievements account to show recent unlocks and awards.
                  Get your API key at <strong>retroachievements.org/controlpanel.php</strong>
                </p>
                <input
                  className={styles.raInput}
                  type="text"
                  placeholder="RA Username"
                  value={raDraftUsername}
                  onChange={(e) => setRaDraftUsername(e.target.value)}
                />
                <input
                  className={styles.raInput}
                  type="password"
                  placeholder="API Key"
                  value={raDraftApiKey}
                  onChange={(e) => setRaDraftApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.raConnectButton}
                  disabled={raStatus === 'loading' || !raDraftUsername.trim() || !raDraftApiKey.trim()}
                  onClick={() => void onRaConnect(raDraftUsername.trim(), raDraftApiKey.trim())}
                >
                  {raStatus === 'loading' ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`${styles.assetRailHandle} ${stickerMenuOpen ? styles.assetRailHandleOpen : ''}`.trim()}
            onClick={(event) => {
              event.stopPropagation()
              setStickerMenuOpen((prev) => !prev)
            }}
            aria-label={stickerMenuOpen ? 'Hide sticker menu' : 'Show sticker menu'}
          >
            <span className={styles.assetRailHandleLabel}>{stickerMenuOpen ? 'Close Stickers' : 'Stickers'}</span>
          </button>

          <aside className={`${styles.assetRail} ${stickerMenuOpen ? styles.assetRailOpen : ''}`.trim()} aria-label="Sticker menu">
            <div className={styles.assetRailHeaderRow}>
              <h3 className={styles.assetRailTitle}>Sticker Menu</h3>
              <span className={styles.assetRailModeChip}>Gacha</span>
            </div>
            <div className={styles.assetRailTopControls}>
              <div className={styles.stickerbookActionsRow}>
                <button
                  type="button"
                  className={`${styles.editModeButton} ${stickerEditMode ? styles.editModeButtonActive : ''}`.trim()}
                  onClick={() => setStickerEditMode((prev) => !prev)}
                  aria-label={stickerEditMode ? 'Exit sticker edit mode' : 'Enter sticker edit mode'}
                  title={stickerEditMode ? 'Exit edit mode' : 'Edit stickers'}
                >
                  {stickerEditMode ? 'Done Editing' : 'Edit Stickers'}
                </button>
                {stickerFoilDebugMode && (
                  <button
                    type="button"
                    className={`${styles.quickActionButton} ${stickerFoilPanelOpen ? styles.editModeButtonActive : ''}`.trim()}
                    onClick={() => setStickerFoilPanelOpen((prev) => !prev)}
                    disabled={!stickerEditMode}
                    aria-label={stickerFoilPanelOpen ? 'Hide sticker foil controls' : 'Show sticker foil controls'}
                    title={selectedPlacedAsset ? 'Edit selected sticker foil' : 'Set default foil for new stickers'}
                  >
                    Foil
                  </button>
                )}
              </div>
              <div className={styles.stickerEconomyRow}>
                <span className={styles.assetRailModeChip}>Scrap: {stickerScrap}</span>
                <span className={styles.assetRailModeChip}>Bonus Rolls: {bonusRollTickets}</span>
              </div>
              <button
                type="button"
                className={styles.quickActionButton}
                onClick={buyBonusRollTicket}
                disabled={stickerScrap < STICKER_SCRAP_ROLL_TICKET_COST}
              >
                Buy Bonus Roll ({STICKER_SCRAP_ROLL_TICKET_COST} Scrap)
              </button>
              <button type="button" className={styles.assetImportButton} onClick={handleUploadTrayAsset}>
                Upload Sticker
              </button>
              <p className={styles.foilPanelMetaLine}>Foil chance: 18% · Special chance: 4%</p>
              <p className={styles.foilPanelMetaLine}>Pity: foil at {STICKER_FOIL_PITY_UPLOADS}, special at {STICKER_SPECIAL_PITY_FOILS} foils</p>
            </div>

            <div className={styles.assetFavoritesStrip}>
              <p className={styles.assetRailSectionLabel}>Sticker Inventory ({inventoryItems.length})</p>
            </div>
            <div className={styles.assetGrid}>
              {inventoryItems.length === 0 ? (
                <p className={styles.assetEmptyState}>Upload a sticker to start your collection.</p>
              ) : (
                inventoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.assetCard} ${item.placed ? styles.assetCardUsed : ''}`.trim()}
                    aria-disabled={item.placed}
                    onClick={() => {
                      setSelectedInventoryStickerId(item.id)
                    }}
                    onDoubleClick={() => {
                      if (item.placed) {
                        return
                      }
                      placeInventoryItemById(item.id, undefined, undefined, true)
                      setStickerEditMode(true)
                    }}
                    onFocus={() => setSelectedInventoryStickerId(item.id)}
                  >
                    <div
                      className={styles.assetPreviewTile}
                      style={getInventoryFoilStyle(item)}
                      draggable={!item.placed}
                      onDragStart={(event) => {
                        if (item.placed) {
                          event.preventDefault()
                          return
                        }
                        event.stopPropagation()
                        event.dataTransfer.setData(STICKER_DRAG_TRANSFER_TYPE, item.id)
                        event.dataTransfer.setData('text/plain', `${STICKER_DRAG_TRANSFER_PREFIX}${item.id}`)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                    >
                      <span
                        className={[
                          styles.stickerFilm,
                          styles.inventoryStickerFilm,
                          item.foilType === 'none' ? styles.stickerFoilNone : '',
                          item.foilType === 'gloss' ? styles.stickerFoilGloss : '',
                          item.foilType === 'foil' ? styles.stickerFoilFoil : '',
                          item.foilType === 'holographic' ? styles.stickerFoilHolographic : '',
                          item.foilType === 'polychrome' ? styles.stickerFoilPolychrome : '',
                          item.foilType === 'negative' ? styles.stickerFoilNegative : '',
                          item.foilType === 'aurora' ? styles.stickerFoilAurora : '',
                          item.foilType === 'ripple' ? styles.stickerFoilRipple : '',
                          item.foilType === 'lavaContour' ? styles.stickerFoilLavaContour : '',
                          item.foilIntensity === 'low' ? styles.stickerFoilLow : '',
                          item.foilIntensity === 'medium' ? styles.stickerFoilMedium : '',
                          item.foilIntensity === 'high' ? styles.stickerFoilHigh : '',
                        ].join(' ')}
                      >
                        <img className={styles.inventoryStickerImage} src={item.imageUrl} alt={item.name} draggable={false} />
                        <span
                          className={styles.stickerRippleOverlayClip}
                          style={{
                            ['--ripple-mask-image' as string]: `url("${item.imageUrl}")`,
                          }}
                          aria-hidden="true"
                        >
                          <span
                            className={styles.stickerSpecular}
                            style={{
                              WebkitMaskImage: `url("${item.imageUrl}")`,
                              maskImage: `url("${item.imageUrl}")`,
                            }}
                            aria-hidden="true"
                          />
                          <span
                            className={styles.stickerPolychrome}
                            style={{
                              WebkitMaskImage: `url("${item.imageUrl}")`,
                              maskImage: `url("${item.imageUrl}")`,
                            }}
                            aria-hidden="true"
                          />
                        </span>
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div
              className={[
                styles.assetSelectedInfoPanel,
                selectedInventoryNeedsDarkText
                  ? styles.assetSelectedInfoPanelDark
                  : '',
              ].join(' ')}
              style={{
                ['--asset-selected-bg' as string]: selectedInventorySticker
                  ? FOIL_META_BG_BY_TYPE[selectedInventorySticker.foilType]
                  : 'rgba(50, 36, 18, 0.92)',
              }}
            >
              {selectedInventorySticker ? (
                <>
                  <span
                    className={[
                      styles.assetSelectedBorderFx,
                      selectedInventorySticker.foilType === 'gloss' ? styles.assetSelectedBorderGloss : '',
                      selectedInventorySticker.foilType === 'foil' ? styles.assetSelectedBorderFoil : '',
                      selectedInventorySticker.foilType === 'holographic' ? styles.assetSelectedBorderHolographic : '',
                      selectedInventorySticker.foilType === 'polychrome' ? styles.assetSelectedBorderPolychrome : '',
                      selectedInventorySticker.foilType === 'negative' ? styles.assetSelectedBorderNegative : '',
                      selectedInventorySticker.foilType === 'aurora' ? styles.assetSelectedBorderAurora : '',
                      selectedInventorySticker.foilType === 'ripple' ? styles.assetSelectedBorderRipple : '',
                      selectedInventorySticker.foilType === 'lavaContour' ? styles.assetSelectedBorderLava : '',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                  <span
                    className={[
                      styles.assetSelectedFoilSurface,
                      styles.stickerFilm,
                      styles.stickerFilmSelected,
                      selectedInventorySticker.foilType === 'none' ? styles.stickerFoilNone : '',

                      selectedInventorySticker.foilType === 'gloss' ? styles.stickerFoilGloss : '',
                      selectedInventorySticker.foilType === 'foil' ? styles.stickerFoilFoil : '',
                      selectedInventorySticker.foilType === 'holographic' ? styles.stickerFoilHolographic : '',
                      selectedInventorySticker.foilType === 'polychrome' ? styles.stickerFoilPolychrome : '',
                      selectedInventorySticker.foilType === 'negative' ? styles.stickerFoilNegative : '',
                      selectedInventorySticker.foilType === 'aurora' ? styles.stickerFoilAurora : '',
                      selectedInventorySticker.foilType === 'ripple' ? styles.stickerFoilRipple : '',
                      selectedInventorySticker.foilType === 'lavaContour' ? styles.stickerFoilLavaContour : '',
                      selectedInventorySticker.foilIntensity === 'low' ? styles.stickerFoilLow : '',
                      selectedInventorySticker.foilIntensity === 'medium' ? styles.stickerFoilMedium : '',
                      selectedInventorySticker.foilIntensity === 'high' ? styles.stickerFoilHigh : '',
                    ].join(' ')}
                    style={selectedInventoryFoilStyle}
                    aria-hidden="true"
                  >
                    <span className={styles.stickerSpecular} aria-hidden="true" />
                    <span className={styles.stickerPolychrome} aria-hidden="true" />
                  </span>
                  <div className={styles.assetSelectedContent}>
                    <div className={styles.assetSelectedShowpiece}>
                      {selectedInventorySticker.imageUrl && (
                        <span className={styles.assetSelectedStickerStamp} aria-hidden="true">
                          <img
                            className={styles.assetSelectedStickerStampImage}
                            src={selectedInventorySticker.imageUrl}
                            alt=""
                          />
                        </span>
                      )}
                      <p className={styles.assetSelectedTitle}>{selectedInventorySticker.name}</p>
                      {selectedInventorySticker.foilType !== 'none' && (
                        <div className={[
                          styles.assetSelectedFoilBadge,
                          selectedInventorySticker.specialEdition ? styles.assetSelectedFoilBadgeSpecial : '',
                        ].join(' ')}>
                          {selectedInventorySticker.specialEdition
                            ? <span className={styles.assetSelectedFoilValue}>{getSpecialVariant(selectedInventorySticker.foilType, selectedInventorySticker.specialVariantId).label}</span>
                            : selectedInventoryFoilLabel}
                        </div>
                      )}
                    </div>
                    <div className={styles.assetSelectedDivider} />
                    <div className={styles.assetSelectedUtilityRow}>
                      <div className={styles.assetSelectedActions}>
                        <button
                          type="button"
                          className={styles.assetPlaceButton}
                          onClick={() => {
                            if (!selectedInventorySticker.placed) {
                              placeInventoryItemById(selectedInventorySticker.id, undefined, undefined, true)
                              setStickerEditMode(true)
                            }
                          }}
                          disabled={selectedInventorySticker.placed}
                        >
                          Place Sticker
                        </button>
                        <button
                          type="button"
                          className={styles.assetSellButton}
                          onClick={() => sellInventoryStickerById(selectedInventorySticker.id)}
                          disabled={selectedInventorySticker.placed}
                        >
                          Sell
                        </button>
                      </div>
                      <span className={styles.assetSelectedScrapBadge}>
                        {getStickerScrapValue(selectedInventorySticker)} Scrap
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className={styles.assetSelectedEmpty}>Select a sticker to inspect foil info and actions.</p>
              )}
            </div>
          </aside>

        </div>

        <div className={styles.placedAssetLayer} aria-hidden={placedAssets.length === 0}>
          {placedAssets.map((asset) => {
            const selected = asset.id === selectedPlacedAssetId
            const dragging = draggingPlacedAssetId === asset.id
            const dropped = justDroppedAssetId === asset.id
            const showOutline = stickerEditMode
            const overlayMaskStyle = {
              WebkitMaskImage: `url("${asset.imageUrl}")`,
              maskImage: `url("${asset.imageUrl}")`,
            }
            const polychromeTexture = asset.foilType === 'polychrome' ? getPolychromeTexture(asset) : ''
            const polychromeLumaMask = asset.foilType === 'polychrome' ? getPolychromeLumaMask(asset) : ''
            const polychromeMaskStyle = polychromeLumaMask
              ? {
                  WebkitMaskImage: `url("${polychromeLumaMask}")`,
                  maskImage: `url("${polychromeLumaMask}")`,
                }
              : overlayMaskStyle
            const isRippleFoil = asset.foilType === 'ripple'
            const isLavaContourFoil = asset.foilType === 'lavaContour'
            const variantStyleVars = resolveSpecialVariantStyleVars(asset, asset.id)
            const usesAdvancedFoilMotion = isRippleFoil || isLavaContourFoil
            const usesOverlayClipMask = isRippleFoil
            const specularMaskStyle = usesOverlayClipMask
              ? undefined
              : asset.foilType === 'polychrome'
                ? polychromeMaskStyle
                : overlayMaskStyle
            const polychromeOverlayMaskStyle = polychromeTexture
              ? {
                  ...polychromeMaskStyle,
                  ['--poly-tex' as string]: `url("${polychromeTexture}")`,
                }
              : polychromeMaskStyle
            const rippleAnimationStyle: CSSProperties | undefined = usesAdvancedFoilMotion
              ? {
                  ['--ripple-duration' as string]: `${Math.round(20000 + hashToUnit(asset.id, 11) * 12000)}ms`,
                  ['--ripple-delay' as string]: `${Math.round(-hashToUnit(asset.id, 29) * 42000)}ms`,
                  ['--ripple-shift-x' as string]: `${((hashToUnit(asset.id, 47) - 0.5) * 6).toFixed(2)}%`,
                  ['--ripple-shift-y' as string]: `${((hashToUnit(asset.id, 71) - 0.5) * 6).toFixed(2)}%`,
                  ['--foil-delay' as string]: `${Math.round(-hashToUnit(asset.id, 97) * 36000)}ms`,
                  ['--foil-speed' as string]: `${(0.86 + hashToUnit(asset.id, 113) * 0.42).toFixed(3)}`,
                  ['--foil-phase' as string]: `${(hashToUnit(asset.id, 131) * 360).toFixed(2)}deg`,
                  ['--ripple-mouse-x' as string]: '0',
                  ['--ripple-mouse-y' as string]: '0',
                  ['--ripple-uv-x' as string]: '0.5',
                  ['--ripple-uv-y' as string]: '0.5',
                  ['--foil-mouse-x' as string]: '0',
                  ['--foil-mouse-y' as string]: '0',
                  ['--foil-uv-x' as string]: '0.5',
                  ['--foil-uv-y' as string]: '0.5',
                  ['--foil-edge' as string]: '0',
                  ['--foil-center-dist' as string]: '0',
                }
              : undefined
            const rippleOverlayClipStyle: CSSProperties | undefined = usesOverlayClipMask
              ? {
                  ['--ripple-mask-image' as string]: `url("${asset.imageUrl}")`,
                }
              : undefined
            const ripplePolychromeStyle = usesOverlayClipMask
              ? { ...variantStyleVars, ...(rippleAnimationStyle ?? {}) }
              : { ...polychromeOverlayMaskStyle, ...variantStyleVars, ...rippleAnimationStyle }
            return (
              <Fragment key={asset.id}>
                <button
                  type="button"
                  className={[
                    styles.placedAsset,
                    styles.placedAssetImageOnly,
                    !stickerEditMode ? styles.placedAssetStatic : '',
                    stickerEditMode ? styles.placedAssetInteractive : '',
                    dragging ? styles.placedAssetDragging : '',
                    showOutline ? styles.placedAssetSelected : '',
                    stickerEditMode && selected ? styles.placedAssetEditSelected : '',
                    dropped ? styles.placedAssetDropped : '',
                  ].join(' ')}
                  style={{
                    left: asset.x,
                    top: asset.y,
                    zIndex: asset.zIndex,
                    opacity: asset.opacity,
                    transform: `translate(-50%, -50%) rotate(${asset.rotation}deg) scale(${asset.scale})`,
                  }}
                  onPointerDown={(event) => {
                    if (!stickerEditMode) {
                      return
                    }
                    event.stopPropagation()
                    event.preventDefault()
                    setSelectedPlacedAssetId(asset.id)
                    setPlacedAssets((prev) => {
                      const top = nextZIndex(prev)
                      return prev.map((entry) =>
                        entry.id === asset.id
                          ? {
                              ...entry,
                              zIndex: top,
                            }
                          : entry,
                      )
                    })
                    event.currentTarget.setPointerCapture(event.pointerId)
                    const rect = scrapbookCanvasRef.current?.getBoundingClientRect()
                    if (!rect) return
                    draggingPlacedAssetRef.current = {
                      placedAssetId: asset.id,
                      element: event.currentTarget,
                      pointerId: event.pointerId,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      dragging: false,
                      offsetX: event.clientX - rect.left - asset.x,
                      offsetY: event.clientY - rect.top - asset.y,
                      snapshotBeforeDrag: placedAssetsRef.current,
                    }
                  }}
                  onClick={(event) => {
                    if (!stickerEditMode) {
                      return
                    }
                    event.stopPropagation()
                    setSelectedPlacedAssetId(asset.id)
                  }}
                  onDragStart={(event) => {
                    event.preventDefault()
                  }}
                  onMouseMove={(event) => {
                    if (rippleSettleAnimationRef.current !== null) {
                      window.cancelAnimationFrame(rippleSettleAnimationRef.current)
                      rippleSettleAnimationRef.current = null
                    }
                    const rect = event.currentTarget.getBoundingClientRect()
                    const rawMx = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
                    const rawMy = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
                    const centeredX = rawMx - 0.5
                    const centeredY = rawMy - 0.5
                    const curvedX = Math.sign(centeredX) * Math.pow(Math.abs(centeredX), 1.34)
                    const curvedY = Math.sign(centeredY) * Math.pow(Math.abs(centeredY), 1.34)
                    // Small travel with stronger edge response keeps movement premium and controlled.
                    const mx = 0.5 + curvedX * 0.26
                    const my = 0.5 + curvedY * 0.26
                    const angle = 135 + centeredX * 18 + centeredY * -12
                    const anisotropic = Math.min(1, Math.max(0, Math.abs(curvedX * 1.06 - curvedY * 0.52) * 2.8))
                    const centerX = rect.left + rect.width * 0.5
                    const centerY = rect.top + rect.height * 0.5
                    const shortHalf = Math.max(1, Math.min(rect.width, rect.height) * 0.5)
                    // Short-side normalization keeps mouse pull consistent across different sticker aspect ratios.
                    const localDx = clamp((event.clientX - centerX) / shortHalf, -1, 1)
                    const localDy = clamp((event.clientY - centerY) / shortHalf, -1, 1)
                    const curvedLocalX = Math.sign(localDx) * Math.pow(Math.abs(localDx), 0.82)
                    const curvedLocalY = Math.sign(localDy) * Math.pow(Math.abs(localDy), 0.82)
                    const rippleMouseX = clamp(-curvedLocalX * 0.96, -1, 1)
                    const rippleMouseY = clamp(-curvedLocalY * 0.96, -1, 1)
                    const rippleUvX = clamp(0.5 + localDx * 0.5, 0, 1)
                    const rippleUvY = clamp(0.5 + localDy * 0.5, 0, 1)
                    const foilMouseX = clamp(curvedLocalX * 0.92, -1, 1)
                    const foilMouseY = clamp(curvedLocalY * 0.92, -1, 1)
                    const foilEdge = clamp(Math.max(Math.abs(localDx), Math.abs(localDy)), 0, 1)
                    const foilCenterDist = clamp(Math.hypot(localDx, localDy) / 1.41421356, 0, 1)
                    const el = event.currentTarget
                    el.style.setProperty('--mx', mx.toFixed(3))
                    el.style.setProperty('--my', my.toFixed(3))
                    el.style.setProperty('--holo-angle', `${angle.toFixed(1)}deg`)
                    el.style.setProperty('--foil-aniso', anisotropic.toFixed(3))
                    el.style.setProperty('--ripple-mouse-x', rippleMouseX.toFixed(3))
                    el.style.setProperty('--ripple-mouse-y', rippleMouseY.toFixed(3))
                    el.style.setProperty('--ripple-uv-x', rippleUvX.toFixed(3))
                    el.style.setProperty('--ripple-uv-y', rippleUvY.toFixed(3))
                    el.style.setProperty('--foil-mouse-x', foilMouseX.toFixed(3))
                    el.style.setProperty('--foil-mouse-y', foilMouseY.toFixed(3))
                    el.style.setProperty('--foil-uv-x', rippleUvX.toFixed(3))
                    el.style.setProperty('--foil-uv-y', rippleUvY.toFixed(3))
                    el.style.setProperty('--foil-edge', foilEdge.toFixed(3))
                    el.style.setProperty('--foil-center-dist', foilCenterDist.toFixed(3))
                  }}
                  onMouseLeave={(event) => {
                    const el = event.currentTarget
                    if (rippleSettleAnimationRef.current !== null) {
                      window.cancelAnimationFrame(rippleSettleAnimationRef.current)
                    }
                    const readCssNumber = (name: string, fallback: number): number => {
                      const raw = el.style.getPropertyValue(name).trim()
                      if (!raw) return fallback
                      const value = Number.parseFloat(raw)
                      return Number.isFinite(value) ? value : fallback
                    }
                    const startMx = readCssNumber('--mx', 0.5)
                    const startMy = readCssNumber('--my', 0.5)
                    const startAngle = readCssNumber('--holo-angle', 135)
                    const startAniso = readCssNumber('--foil-aniso', 0.45)
                    const startRippleMouseX = readCssNumber('--ripple-mouse-x', 0)
                    const startRippleMouseY = readCssNumber('--ripple-mouse-y', 0)
                    const startRippleUvX = readCssNumber('--ripple-uv-x', 0.5)
                    const startRippleUvY = readCssNumber('--ripple-uv-y', 0.5)
                    const startFoilMouseX = readCssNumber('--foil-mouse-x', 0)
                    const startFoilMouseY = readCssNumber('--foil-mouse-y', 0)
                    const startFoilUvX = readCssNumber('--foil-uv-x', 0.5)
                    const startFoilUvY = readCssNumber('--foil-uv-y', 0.5)
                    const startFoilEdge = readCssNumber('--foil-edge', 0)
                    const startFoilCenterDist = readCssNumber('--foil-center-dist', 0)

                    const durationMs = 120
                    const startedAt = performance.now()
                    const animateSettle = (now: number) => {
                      const t = clamp((now - startedAt) / durationMs, 0, 1)
                      const eased = 1 - Math.pow(1 - t, 3)
                      const mix = (from: number, to: number) => from + (to - from) * eased

                      el.style.setProperty('--mx', mix(startMx, 0.5).toFixed(3))
                      el.style.setProperty('--my', mix(startMy, 0.5).toFixed(3))
                      el.style.setProperty('--holo-angle', `${mix(startAngle, 135).toFixed(1)}deg`)
                      el.style.setProperty('--foil-aniso', mix(startAniso, 0.45).toFixed(3))
                      el.style.setProperty('--ripple-mouse-x', mix(startRippleMouseX, 0).toFixed(3))
                      el.style.setProperty('--ripple-mouse-y', mix(startRippleMouseY, 0).toFixed(3))
                      el.style.setProperty('--ripple-uv-x', mix(startRippleUvX, 0.5).toFixed(3))
                      el.style.setProperty('--ripple-uv-y', mix(startRippleUvY, 0.5).toFixed(3))
                      el.style.setProperty('--foil-mouse-x', mix(startFoilMouseX, 0).toFixed(3))
                      el.style.setProperty('--foil-mouse-y', mix(startFoilMouseY, 0).toFixed(3))
                      el.style.setProperty('--foil-uv-x', mix(startFoilUvX, 0.5).toFixed(3))
                      el.style.setProperty('--foil-uv-y', mix(startFoilUvY, 0.5).toFixed(3))
                      el.style.setProperty('--foil-edge', mix(startFoilEdge, 0).toFixed(3))
                      el.style.setProperty('--foil-center-dist', mix(startFoilCenterDist, 0).toFixed(3))

                      if (t < 1) {
                        rippleSettleAnimationRef.current = window.requestAnimationFrame(animateSettle)
                        return
                      }
                      rippleSettleAnimationRef.current = null
                    }

                    rippleSettleAnimationRef.current = window.requestAnimationFrame(animateSettle)
                  }}
                  title={asset.name}
                  aria-label={`${asset.name} sticker`}
                >
                  <span
                    className={[
                      styles.stickerFilm,
                      asset.foilType === 'none' ? styles.stickerFoilNone : '',
                      asset.foilType === 'gloss' ? styles.stickerFoilGloss : '',
                      asset.foilType === 'foil' ? styles.stickerFoilFoil : '',
                      asset.foilType === 'holographic' ? styles.stickerFoilHolographic : '',
                      asset.foilType === 'polychrome' ? styles.stickerFoilPolychrome : '',
                      asset.foilType === 'negative' ? styles.stickerFoilNegative : '',
                      asset.foilType === 'aurora' ? styles.stickerFoilAurora : '',
                      asset.foilType === 'ripple' ? styles.stickerFoilRipple : '',
                      asset.foilType === 'lavaContour' ? styles.stickerFoilLavaContour : '',
                      asset.foilIntensity === 'low' ? styles.stickerFoilLow : '',
                      asset.foilIntensity === 'medium' ? styles.stickerFoilMedium : '',
                      asset.foilIntensity === 'high' ? styles.stickerFoilHigh : '',
                      selected ? styles.stickerFilmSelected : '',
                      dragging ? styles.stickerFilmDragging : '',
                      dropped ? styles.stickerFilmDropped : '',
                    ].join(' ')}
                  >
                    <img
                      className={`${styles.placedAssetImage} ${dragging ? styles.placedAssetImageDragging : ''}`.trim()}
                      src={asset.imageUrl}
                      alt={asset.name}
                      draggable={false}
                    />
                    {usesOverlayClipMask ? (
                      <span className={styles.stickerRippleOverlayClip} style={rippleOverlayClipStyle} aria-hidden="true">
                        <span className={styles.stickerSpecular} style={specularMaskStyle} aria-hidden="true" />
                        <span className={styles.stickerPolychrome} style={ripplePolychromeStyle} aria-hidden="true" />
                      </span>
                    ) : (
                      <>
                        <span className={styles.stickerSpecular} style={specularMaskStyle} aria-hidden="true" />
                        <span className={styles.stickerPolychrome} style={ripplePolychromeStyle} aria-hidden="true" />
                      </>
                    )}
                  </span>
                </button>
                {stickerEditMode && (
                  <div
                    className={styles.stickerDeleteBadge}
                    style={{
                      left: asset.x,
                      top: asset.y,
                      zIndex: asset.zIndex + 1,
                    }}
                  >
                    <button
                      type="button"
                      className={styles.stickerDeleteIconButton}
                      onClick={(event) => {
                        event.stopPropagation()
                        removePlacedAssetById(asset.id)
                      }}
                      aria-label={`Delete ${asset.name}`}
                      title={`Delete ${asset.name}`}
                    >
                      Trash
                    </button>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
