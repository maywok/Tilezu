import { DEFAULT_PLAYER_ID_FOIL_TYPE } from './constants'
import type { PlayerIdFoilType, PlayerIdStickerPlacement } from './types'

export function createStickerId(): string {
  return `sticker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function clampStickerValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeStickerPlacement(raw: unknown): PlayerIdStickerPlacement | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Partial<PlayerIdStickerPlacement>
  const sourceImageUrl = typeof record.sourceImageUrl === 'string' ? record.sourceImageUrl.trim() : ''
  if (!sourceImageUrl.startsWith('data:image/') || sourceImageUrl.length > 4_000_000) {
    return null
  }

  const outlineImageUrl = typeof record.outlineImageUrl === 'string' ? record.outlineImageUrl.trim() : ''
  const foilType =
    record.foilType === 'none'
    || record.foilType === 'aurora'
    || record.foilType === 'ripple'
    || record.foilType === 'holographic'
      ? record.foilType
      : DEFAULT_PLAYER_ID_FOIL_TYPE

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : createStickerId(),
    sourceImageUrl,
    outlineImageUrl:
      outlineImageUrl.startsWith('data:image/') && outlineImageUrl.length <= 4_000_000
        ? outlineImageUrl
        : '',
    foilType,
    x: clampStickerValue(typeof record.x === 'number' ? record.x : 82, 0, 100),
    y: clampStickerValue(typeof record.y === 'number' ? record.y : 78, 0, 100),
    rotation: clampStickerValue(typeof record.rotation === 'number' ? record.rotation : 8, -180, 180),
    scale: clampStickerValue(typeof record.scale === 'number' ? record.scale : 1, 0.5, 1.5),
  }
}

export function normalizePlayerIdStickers(
  rawStickers: unknown,
  legacyStickerUrl: string,
  legacyFoilType: PlayerIdFoilType,
): PlayerIdStickerPlacement[] {
  const parsed = Array.isArray(rawStickers)
    ? rawStickers.map(normalizeStickerPlacement).filter(Boolean) as PlayerIdStickerPlacement[]
    : []

  if (parsed.length > 0) {
    return parsed.slice(0, 3)
  }

  const legacy = legacyStickerUrl.trim()
  if (!legacy.startsWith('data:image/') || legacy.length > 4_000_000) {
    return []
  }

  return [{
    id: createStickerId(),
    sourceImageUrl: legacy,
    outlineImageUrl: '',
    foilType: legacyFoilType,
    x: 82,
    y: 78,
    rotation: 10,
    scale: 1,
  }]
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '')
  if (normalized.length !== 6) {
    return null
  }

  const value = Number.parseInt(normalized, 16)
  if (!Number.isFinite(value)) {
    return null
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return 0.35
  }

  const transform = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  const r = transform(rgb.r)
  const g = transform(rgb.g)
  const b = transform(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function getTextToneForAccent(accentHex: string): 'light' | 'dark' {
  return relativeLuminance(accentHex) > 0.58 ? 'dark' : 'light'
}

export function getReadableTextTone(accentHex: string, hasBannerImage: boolean): 'light' | 'dark' {
  if (hasBannerImage) {
    return 'light'
  }
  return getTextToneForAccent(accentHex)
}
