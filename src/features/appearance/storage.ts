import {
  APPEARANCE_STATE_VERSION,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_STATE,
  DEFAULT_APPEARANCE_THEME,
} from './constants'
import type {
  AppearanceState,
  AppearanceTheme,
  SavedAppearanceGradient,
  SavedAppearanceTheme,
  ThemeBackgroundImageConfig,
  ThemeGradient,
} from './types'
import { cloneTheme, createEntityId, normalizeGradient, normalizeHexColor } from './utils/theme'

const MAX_BACKGROUND_IMAGE_DATA_URL_LENGTH = 900000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function toNumberValue(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function toBackgroundImageDataUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith('data:image/')) {
    return null
  }

  if (trimmed.length > MAX_BACKGROUND_IMAGE_DATA_URL_LENGTH) {
    return null
  }

  return trimmed
}

function coerceBackgroundImage(
  value: unknown,
  fallback: ThemeBackgroundImageConfig | null,
): ThemeBackgroundImageConfig | null {
  if (!isRecord(value)) {
    return fallback ? { ...fallback } : null
  }

  const dataUrl = toBackgroundImageDataUrl(value.dataUrl)
  if (!dataUrl) {
    return null
  }

  const fit = value.fit === 'contain' ? 'contain' : 'cover'
  const fallbackOpacity = fallback?.opacity ?? 0.58
  const opacity = Math.min(0.9, Math.max(0.12, toNumberValue(value.opacity, fallbackOpacity)))

  return {
    dataUrl,
    fit,
    opacity,
  }
}

function coerceGradient(value: unknown, fallback: ThemeGradient): ThemeGradient {
  if (!isRecord(value)) {
    return normalizeGradient(fallback)
  }

  const stops = Array.isArray(value.stops)
    ? value.stops
        .map((stop) => {
          if (!isRecord(stop)) {
            return null
          }

          return {
            color: normalizeHexColor(String(stop.color ?? ''), '#9fd3ff'),
            position: Number(stop.position ?? 0),
          }
        })
        .filter((stop): stop is { color: string; position: number } => Boolean(stop))
    : fallback.stops

  return normalizeGradient({
    kind: value.kind === 'radial' ? 'radial' : 'linear',
    direction: toStringValue(value.direction, fallback.direction),
    stops,
  })
}

function coerceTheme(value: unknown, fallback: AppearanceTheme): AppearanceTheme {
  if (!isRecord(value)) {
    return cloneTheme(fallback)
  }

  const presetId = value.presetId === 'pastel-dream' || value.presetId === 'neon-night' || value.presetId === 'ocean-breeze' || value.presetId === 'persona-pop'
    ? value.presetId
    : 'custom'

  const theme: AppearanceTheme = {
    id: toStringValue(value.id, createEntityId('theme')),
    name: toStringValue(value.name, fallback.name),
    presetId,
    accentColor: normalizeHexColor(String(value.accentColor ?? ''), fallback.accentColor),
    highlightColor: normalizeHexColor(String(value.highlightColor ?? ''), fallback.highlightColor),
    backgroundImage: coerceBackgroundImage(value.backgroundImage, fallback.backgroundImage),
    backgroundGradient: coerceGradient(value.backgroundGradient, fallback.backgroundGradient),
    borderGradient: coerceGradient(value.borderGradient, fallback.borderGradient),
    iconGradient: coerceGradient(value.iconGradient, fallback.iconGradient),
    animation: {
      type:
        value.animation && isRecord(value.animation) &&
        (value.animation.type === 'waves' || value.animation.type === 'shapes' || value.animation.type === 'dots' || value.animation.type === 'none')
          ? value.animation.type
          : fallback.animation.type,
      speed:
        value.animation && isRecord(value.animation)
          ? Math.min(1, Math.max(0, toNumberValue(value.animation.speed, fallback.animation.speed)))
          : fallback.animation.speed,
      density:
        value.animation && isRecord(value.animation)
          ? Math.min(1, Math.max(0, toNumberValue(value.animation.density, fallback.animation.density)))
          : fallback.animation.density,
      opacity:
        value.animation && isRecord(value.animation)
          ? Math.min(1, Math.max(0, toNumberValue(value.animation.opacity, fallback.animation.opacity)))
          : fallback.animation.opacity,
    },
    iconCard: {
      shape:
        value.iconCard && isRecord(value.iconCard) &&
        (value.iconCard.shape === 'rounded' || value.iconCard.shape === 'square' || value.iconCard.shape === 'circle')
          ? value.iconCard.shape
          : fallback.iconCard.shape,
      borderThickness:
        value.iconCard && isRecord(value.iconCard)
          ? Math.min(6, Math.max(1, Math.round(toNumberValue(value.iconCard.borderThickness, fallback.iconCard.borderThickness))))
          : fallback.iconCard.borderThickness,
      shadowStrength:
        value.iconCard && isRecord(value.iconCard)
          ? Math.min(1, Math.max(0, toNumberValue(value.iconCard.shadowStrength, fallback.iconCard.shadowStrength)))
          : fallback.iconCard.shadowStrength,
      glowStrength:
        value.iconCard && isRecord(value.iconCard)
          ? Math.min(1, Math.max(0, toNumberValue(value.iconCard.glowStrength, fallback.iconCard.glowStrength)))
          : fallback.iconCard.glowStrength,
      logoStyle:
        value.iconCard && isRecord(value.iconCard) &&
        (value.iconCard.logoStyle === 'flat' || value.iconCard.logoStyle === 'gradient' || value.iconCard.logoStyle === 'outlined')
          ? value.iconCard.logoStyle
          : fallback.iconCard.logoStyle,
    },
    typography: {
      fontFamily:
        value.typography && isRecord(value.typography) &&
        (value.typography.fontFamily === 'nunito' ||
          value.typography.fontFamily === 'segoe' ||
          value.typography.fontFamily === 'trebuchet' ||
          value.typography.fontFamily === 'georgia')
          ? value.typography.fontFamily
          : fallback.typography.fontFamily,
      density:
        value.typography && isRecord(value.typography) &&
        (value.typography.density === 'compact' || value.typography.density === 'cozy' || value.typography.density === 'spacious')
          ? value.typography.density
          : fallback.typography.density,
    },
    updatedAt: toNumberValue(value.updatedAt, Date.now()),
  }

  return cloneTheme(theme)
}

function coerceSavedThemes(value: unknown): SavedAppearanceTheme[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      return {
        id: toStringValue(item.id, createEntityId('saved-theme')),
        name: toStringValue(item.name, 'Custom Theme'),
        theme: coerceTheme(item.theme, DEFAULT_APPEARANCE_THEME),
        createdAt: toNumberValue(item.createdAt, Date.now()),
      }
    })
    .filter((item): item is SavedAppearanceTheme => Boolean(item))
}

function coerceSavedGradients(value: unknown): SavedAppearanceGradient[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      const target = item.target === 'background' || item.target === 'border' || item.target === 'icon' ? item.target : 'background'
      const fallback =
        target === 'border'
          ? DEFAULT_APPEARANCE_THEME.borderGradient
          : target === 'icon'
            ? DEFAULT_APPEARANCE_THEME.iconGradient
            : DEFAULT_APPEARANCE_THEME.backgroundGradient

      return {
        id: toStringValue(item.id, createEntityId('saved-gradient')),
        name: toStringValue(item.name, 'Custom Gradient'),
        target,
        gradient: coerceGradient(item.gradient, fallback),
        createdAt: toNumberValue(item.createdAt, Date.now()),
      }
    })
    .filter((item): item is SavedAppearanceGradient => Boolean(item))
}

export function loadAppearanceState(): AppearanceState {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) {
      return {
        ...DEFAULT_APPEARANCE_STATE,
        activeTheme: cloneTheme(DEFAULT_APPEARANCE_STATE.activeTheme),
      }
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return {
        ...DEFAULT_APPEARANCE_STATE,
        activeTheme: cloneTheme(DEFAULT_APPEARANCE_STATE.activeTheme),
      }
    }

    return {
      version: APPEARANCE_STATE_VERSION,
      activeTheme: coerceTheme(parsed.activeTheme, DEFAULT_APPEARANCE_THEME),
      savedThemes: coerceSavedThemes(parsed.savedThemes),
      savedGradients: coerceSavedGradients(parsed.savedGradients),
    }
  } catch {
    return {
      ...DEFAULT_APPEARANCE_STATE,
      activeTheme: cloneTheme(DEFAULT_APPEARANCE_STATE.activeTheme),
    }
  }
}

export function persistAppearanceState(state: AppearanceState): void {
  const normalized: AppearanceState = {
    version: APPEARANCE_STATE_VERSION,
    activeTheme: cloneTheme(state.activeTheme),
    savedThemes: state.savedThemes.map((saved) => ({
      ...saved,
      theme: cloneTheme(saved.theme),
    })),
    savedGradients: state.savedGradients.map((saved) => ({
      ...saved,
      gradient: normalizeGradient(saved.gradient),
    })),
  }

  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Keep runtime responsive when storage quota is reached.
  }
}

export function serializeThemeForExport(theme: AppearanceTheme): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: APPEARANCE_STATE_VERSION,
      theme: cloneTheme(theme),
    },
    null,
    2,
  )
}

export function parseThemeFromJson(jsonText: string): AppearanceTheme | null {
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!isRecord(parsed)) {
      return null
    }

    const rawTheme = isRecord(parsed.theme) ? parsed.theme : parsed
    return coerceTheme(rawTheme, DEFAULT_APPEARANCE_THEME)
  } catch {
    return null
  }
}
