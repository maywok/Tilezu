import type { AppearanceTheme, ThemeGradient, ThemeGradientKind, ThemeGradientStop } from '../types'

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return trimmed
  }

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`
  }

  return fallback
}

function normalizeGradientKind(value: string): ThemeGradientKind {
  return value === 'radial' ? 'radial' : 'linear'
}

function normalizeStops(stops: ThemeGradientStop[]): ThemeGradientStop[] {
  if (!Array.isArray(stops) || stops.length === 0) {
    return [
      { color: '#9fd3ff', position: 0 },
      { color: '#ffc4de', position: 100 },
    ]
  }

  const clamped = stops
    .map((stop) => ({
      color: normalizeHexColor(stop.color, '#9fd3ff'),
      position: Math.round(clampNumber(Number(stop.position), 0, 100)),
    }))
    .sort((a, b) => a.position - b.position)

  if (clamped.length === 1) {
    return [
      { color: clamped[0].color, position: 0 },
      { color: clamped[0].color, position: 100 },
    ]
  }

  return clamped
}

export function normalizeGradient(gradient: ThemeGradient): ThemeGradient {
  const kind = normalizeGradientKind(gradient.kind)
  const direction = (gradient.direction || '').trim() || (kind === 'linear' ? '135deg' : 'circle at center')

  return {
    kind,
    direction,
    stops: normalizeStops(gradient.stops),
  }
}

export function gradientToCss(gradient: ThemeGradient): string {
  const normalized = normalizeGradient(gradient)
  const stopString = normalized.stops.map((stop) => `${stop.color} ${stop.position}%`).join(', ')

  if (normalized.kind === 'radial') {
    return `radial-gradient(${normalized.direction}, ${stopString})`
  }

  return `linear-gradient(${normalized.direction}, ${stopString})`
}

export function cloneTheme(theme: AppearanceTheme): AppearanceTheme {
  return {
    ...theme,
    backgroundImage: theme.backgroundImage ? { ...theme.backgroundImage } : null,
    backgroundGradient: normalizeGradient(theme.backgroundGradient),
    borderGradient: normalizeGradient(theme.borderGradient),
    iconGradient: normalizeGradient(theme.iconGradient),
    animation: { ...theme.animation },
    iconCard: { ...theme.iconCard },
    typography: { ...theme.typography },
  }
}

function toComparableTheme(theme: AppearanceTheme) {
  return {
    ...theme,
    updatedAt: 0,
  }
}

export function themesEqual(a: AppearanceTheme, b: AppearanceTheme): boolean {
  return JSON.stringify(toComparableTheme(cloneTheme(a))) === JSON.stringify(toComparableTheme(cloneTheme(b)))
}

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function channel(seed: number): number {
  return Math.round(50 + seededUnit(seed) * 180)
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0')
}

export function createRandomColorPair(seedBase: number = Date.now()): { accentColor: string; highlightColor: string } {
  const accent = `#${toHex(channel(seedBase + 1))}${toHex(channel(seedBase + 2))}${toHex(channel(seedBase + 3))}`
  const highlight = `#${toHex(channel(seedBase + 4))}${toHex(channel(seedBase + 5))}${toHex(channel(seedBase + 6))}`

  return {
    accentColor: accent,
    highlightColor: highlight,
  }
}

export function createEntityId(prefix: string): string {
  const randomSuffix = Math.floor((Math.sin(Date.now() * 0.001) + 1) * 500000)
    .toString(36)
    .slice(0, 5)
  return `${prefix}-${Date.now().toString(36)}-${randomSuffix}`
}
