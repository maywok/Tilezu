import { APPEARANCE_SYNC_EVENT, DEFAULT_APPEARANCE_THEME, THEME_PRESETS, V1_DEFAULT_COLOR_PRESET_ID } from './constants'
import { APPEARANCE_V1_COLOR_VIBES_ENABLED } from './featureFlags'
import { loadAppearanceState, persistAppearanceState } from './storage'
import type { AppearanceTheme, ThemeDensity, ThemeIconShape, ThemePresetId } from './types'
import { clampNumber, cloneTheme, createEntityId } from './utils/theme'

export type QuickMotionChoice = 'calm' | 'balanced' | 'energetic' | 'still'
export type QuickColorModeChoice = 'light' | 'dark'
export type QuickSurfaceChoice = 'glass' | 'solid'

export interface QuickCustomizeSelection {
  presetId: ThemePresetId
  motion: QuickMotionChoice
  mode: QuickColorModeChoice
  surface: QuickSurfaceChoice
  iconShape: ThemeIconShape
  density: ThemeDensity
}

export const DEFAULT_QUICK_CUSTOMIZE_SELECTION: QuickCustomizeSelection = {
  presetId: V1_DEFAULT_COLOR_PRESET_ID,
  motion: 'balanced',
  mode: 'light',
  surface: 'glass',
  iconShape: 'rounded',
  density: 'cozy',
}

const QUICK_PRESET_IDS: ThemePresetId[] = ['pastel-dream', 'neon-night', 'ocean-breeze', 'persona-pop']
export const V1_QUICK_PRESET_IDS = QUICK_PRESET_IDS

function effectivePresetId(presetId: ThemePresetId): ThemePresetId {
  return APPEARANCE_V1_COLOR_VIBES_ENABLED ? presetId : V1_DEFAULT_COLOR_PRESET_ID
}
const QUICK_MOTION_CHOICES: QuickMotionChoice[] = ['calm', 'balanced', 'energetic', 'still']
const QUICK_MODE_CHOICES: QuickColorModeChoice[] = ['light', 'dark']
const QUICK_SURFACE_CHOICES: QuickSurfaceChoice[] = ['glass', 'solid']
const QUICK_ICON_SHAPES: ThemeIconShape[] = ['rounded', 'square', 'circle']
const QUICK_DENSITY_CHOICES: ThemeDensity[] = ['compact', 'cozy', 'spacious']

function pickRandom<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().toLowerCase()
  const matches = /^#([0-9a-f]{6})$/.exec(hex)
  if (!matches) {
    return null
  }

  const raw = matches[1]
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  }
}

function toHexChannel(value: number): string {
  return Math.round(clampNumber(value, 0, 255)).toString(16).padStart(2, '0')
}

function blendHex(color: string, targetColor: string, amount: number): string {
  const source = parseHexColor(color)
  const target = parseHexColor(targetColor)
  if (!source || !target) {
    return color
  }

  const mix = clampNumber(amount, 0, 1)
  const r = source.r + (target.r - source.r) * mix
  const g = source.g + (target.g - source.g) * mix
  const b = source.b + (target.b - source.b) * mix

  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`
}

function shiftGradient(themeGradient: AppearanceTheme['backgroundGradient'], targetColor: string, amount: number): AppearanceTheme['backgroundGradient'] {
  return {
    ...themeGradient,
    stops: themeGradient.stops.map((stop, index) => ({
      ...stop,
      color: blendHex(stop.color, targetColor, clampNumber(amount + index * 0.02, 0, 1)),
    })),
  }
}

function luminanceFor(color: string): number {
  const parsed = parseHexColor(color)
  if (!parsed) {
    return 0.75
  }

  return ((0.2126 * parsed.r) + (0.7152 * parsed.g) + (0.0722 * parsed.b)) / 255
}

function motionToAnimation(choice: QuickMotionChoice): AppearanceTheme['animation'] {
  switch (choice) {
    case 'calm':
      return {
        type: 'waves',
        speed: 0.34,
        density: 0.3,
        opacity: 0.2,
      }
    case 'energetic':
      return {
        type: 'shapes',
        speed: 0.8,
        density: 0.72,
        opacity: 0.42,
      }
    case 'still':
      return {
        type: 'none',
        speed: 0,
        density: 0,
        opacity: 0,
      }
    default:
      return {
        type: 'dots',
        speed: 0.56,
        density: 0.52,
        opacity: 0.28,
      }
  }
}

function applyColorMode(theme: AppearanceTheme, mode: QuickColorModeChoice): AppearanceTheme {
  if (mode === 'dark') {
    return {
      ...theme,
      accentColor: blendHex(theme.accentColor, '#6ea9f5', 0.24),
      highlightColor: blendHex(theme.highlightColor, '#d67bdf', 0.22),
      backgroundGradient: shiftGradient(theme.backgroundGradient, '#060c18', 0.72),
      borderGradient: shiftGradient(theme.borderGradient, '#0d1629', 0.64),
      iconGradient: shiftGradient(theme.iconGradient, '#13223b', 0.58),
      animation: {
        ...theme.animation,
        opacity: clampNumber(theme.animation.opacity * 0.9 + 0.08, 0, 1),
      },
    }
  }

  return {
    ...theme,
    accentColor: blendHex(theme.accentColor, '#ffffff', 0.1),
    highlightColor: blendHex(theme.highlightColor, '#ffffff', 0.12),
    backgroundGradient: shiftGradient(theme.backgroundGradient, '#ffffff', 0.22),
    borderGradient: shiftGradient(theme.borderGradient, '#f6fbff', 0.16),
    iconGradient: shiftGradient(theme.iconGradient, '#ffffff', 0.14),
    animation: {
      ...theme.animation,
      opacity: clampNumber(theme.animation.opacity * 0.96 + 0.02, 0, 1),
    },
  }
}

function applySurfaceStyle(iconCard: AppearanceTheme['iconCard'], surface: QuickSurfaceChoice): AppearanceTheme['iconCard'] {
  if (surface === 'solid') {
    return {
      ...iconCard,
      borderThickness: Math.max(2, iconCard.borderThickness),
      shadowStrength: Number(clampNumber(Math.max(iconCard.shadowStrength, 0.6), 0, 1).toFixed(2)),
      glowStrength: Number(clampNumber(Math.min(iconCard.glowStrength, 0.38), 0, 1).toFixed(2)),
      logoStyle: iconCard.logoStyle === 'outlined' ? 'flat' : iconCard.logoStyle,
    }
  }

  return {
    ...iconCard,
    borderThickness: Math.min(3, Math.max(1, iconCard.borderThickness)),
    shadowStrength: Number(clampNumber(Math.min(iconCard.shadowStrength, 0.44), 0, 1).toFixed(2)),
    glowStrength: Number(clampNumber(Math.max(iconCard.glowStrength, 0.44), 0, 1).toFixed(2)),
    logoStyle: iconCard.logoStyle === 'flat' ? 'gradient' : iconCard.logoStyle,
  }
}

export function buildQuickTheme(selection: QuickCustomizeSelection, baseTheme: AppearanceTheme): AppearanceTheme {
  const presetId = effectivePresetId(selection.presetId)
  const preset = THEME_PRESETS.find((entry) => entry.id === presetId) ?? THEME_PRESETS[0]

  const themeBase = cloneTheme({
    ...preset.theme,
    id: createEntityId('quick-theme'),
    name: `${preset.label} · Quick`,
    presetId,
    backgroundImage: baseTheme.backgroundImage ? { ...baseTheme.backgroundImage } : null,
    animation: motionToAnimation(selection.motion),
    iconCard: {
      ...baseTheme.iconCard,
      shape: selection.iconShape,
    },
    typography: {
      ...baseTheme.typography,
      density: selection.density,
    },
    updatedAt: Date.now(),
  })

  const modeTheme = applyColorMode(themeBase, selection.mode)

  return cloneTheme({
    ...modeTheme,
    iconCard: applySurfaceStyle(modeTheme.iconCard, selection.surface),
    updatedAt: Date.now(),
  })
}

function inferMotion(theme: AppearanceTheme): QuickMotionChoice {
  if (theme.animation.type === 'none') {
    return 'still'
  }

  if (theme.animation.speed <= 0.42) {
    return 'calm'
  }

  if (theme.animation.speed >= 0.72 || theme.animation.density >= 0.66) {
    return 'energetic'
  }

  return 'balanced'
}

function inferMode(theme: AppearanceTheme): QuickColorModeChoice {
  const stops = theme.backgroundGradient.stops
  if (stops.length === 0) {
    return 'light'
  }

  const averageLuminance = stops.reduce((sum, stop) => sum + luminanceFor(stop.color), 0) / stops.length
  return averageLuminance < 0.46 ? 'dark' : 'light'
}

function inferSurface(theme: AppearanceTheme): QuickSurfaceChoice {
  if (
    theme.iconCard.shadowStrength <= 0.48
    && theme.iconCard.glowStrength >= 0.4
    && theme.iconCard.borderThickness <= 3
  ) {
    return 'glass'
  }

  return 'solid'
}

export function inferQuickSelection(theme: AppearanceTheme): QuickCustomizeSelection {
  const fallbackPreset = V1_DEFAULT_COLOR_PRESET_ID
  const presetId = theme.presetId === 'pastel-dream' || theme.presetId === 'neon-night' || theme.presetId === 'ocean-breeze' || theme.presetId === 'persona-pop'
    ? theme.presetId
    : fallbackPreset

  return {
    presetId: effectivePresetId(presetId),
    motion: inferMotion(theme),
    mode: inferMode(theme),
    surface: inferSurface(theme),
    iconShape: theme.iconCard.shape,
    density: theme.typography.density,
  }
}

export function createRandomQuickCustomizeSelection(): QuickCustomizeSelection {
  return {
    presetId: effectivePresetId(pickRandom(QUICK_PRESET_IDS)),
    motion: pickRandom(QUICK_MOTION_CHOICES),
    mode: pickRandom(QUICK_MODE_CHOICES),
    surface: pickRandom(QUICK_SURFACE_CHOICES),
    iconShape: pickRandom(QUICK_ICON_SHAPES),
    density: pickRandom(QUICK_DENSITY_CHOICES),
  }
}

export function getQuickSelectionFromActiveTheme(): QuickCustomizeSelection {
  const state = loadAppearanceState()
  return inferQuickSelection(state.activeTheme)
}

export function applyQuickCustomizeSelection(selection: QuickCustomizeSelection): AppearanceTheme {
  const state = loadAppearanceState()
  const normalizedSelection = {
    ...selection,
    presetId: effectivePresetId(selection.presetId),
  }
  const nextTheme = buildQuickTheme(normalizedSelection, state.activeTheme)

  persistAppearanceState({
    ...state,
    activeTheme: nextTheme,
  })

  window.dispatchEvent(new Event(APPEARANCE_SYNC_EVENT))
  return nextTheme
}

export function applyRandomQuickCustomizeSelection(): AppearanceTheme {
  return applyQuickCustomizeSelection(createRandomQuickCustomizeSelection())
}

export function applyDefaultQuickCustomizeSelection(): AppearanceTheme {
  const state = loadAppearanceState()
  const nextTheme = cloneTheme({
    ...DEFAULT_APPEARANCE_THEME,
    updatedAt: Date.now(),
  })

  persistAppearanceState({
    ...state,
    activeTheme: nextTheme,
  })

  window.dispatchEvent(new Event(APPEARANCE_SYNC_EVENT))
  return nextTheme
}

/** Migrate stored themes to the v1 default color preset when vibes are hidden. */
export function ensureV1DefaultColorPreset(): void {
  if (APPEARANCE_V1_COLOR_VIBES_ENABLED) {
    return
  }

  const state = loadAppearanceState()
  if (state.activeTheme.presetId === V1_DEFAULT_COLOR_PRESET_ID) {
    return
  }

  const selection = {
    ...inferQuickSelection(state.activeTheme),
    presetId: V1_DEFAULT_COLOR_PRESET_ID,
  }

  applyQuickCustomizeSelection(selection)
}
