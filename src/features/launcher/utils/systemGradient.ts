import type { ThemeGradient, ThemeGradientStop } from '../../appearance/types'
import { gradientToCss, normalizeGradient, normalizeHexColor } from '../../appearance/utils/theme'
import { isFactorySystemKey } from './customSystems'

export type SystemGradientMap = Record<string, ThemeGradient>

export type SystemGradientAnimationDirection = 'clockwise' | 'counterclockwise'

export type SystemGradientAnimationSettings = {
  enabled: boolean
  speed: number
  direction: SystemGradientAnimationDirection
}

export type SystemGradientAnimationMap = Record<string, SystemGradientAnimationSettings>

type Rgb = {
  r: number
  g: number
  b: number
}

export type SystemGradientThemeTokens = {
  gradientCss: string
  brandBackground: string
  logoBackground: string
  logoNeedsLightModeGuard: boolean
  cornerBackground: string
  borderColor: string
  ringColor: string
  glowColor: string
  flyoutEdge: string
  flyoutEdgeSoft: string
  flyoutGlassTop: string
  flyoutGlassBottom: string
  flyoutPillTop: string
  flyoutPillBottom: string
  flyoutPillBorder: string
  flyoutPillPrimaryTop: string
  flyoutPillPrimaryBottom: string
  flyoutAchievementColor: string
  flatBorderColor: string
  flatBorderColorStrong: string
  flatSecondaryColor: string
  flatBorderSpinColorA: string
  flatBorderSpinColorB: string
  flatBorderSpinGradient: string
  flatIconBorderGradient: string
  flatIconFillGradient: string
  waveColorA: string
  waveColorB: string
  waveColorC: string
}

const SYSTEM_GRADIENT_STORAGE_KEY = 'tile-manager-system-gradient-overrides-v1'
const SYSTEM_GRADIENT_ANIMATION_STORAGE_KEY = 'tile-manager-system-gradient-animation-overrides-v1'
const SYSTEM_GRADIENT_APPLY_MODE_STORAGE_KEY = 'tile-manager-system-gradient-apply-mode-v1'

export type SystemGradientApplyMode = 'borders' | 'soaked'

export type SystemGradientApplyModeMap = Record<string, SystemGradientApplyMode>

export const DEFAULT_SYSTEM_GRADIENT_APPLY_MODE: SystemGradientApplyMode = 'borders'

const DEFAULT_SYSTEM_GRADIENT_ANIMATION: SystemGradientAnimationSettings = {
  enabled: true,
  speed: 1,
  direction: 'clockwise',
}

const DEFAULT_THEME_RGB: Rgb = { r: 126, g: 169, b: 223 }

const SYSTEM_GRADIENT_DEFAULTS: Record<string, ThemeGradient> = {
  steam: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#1a4f8f', position: 0 },
      { color: '#2b6fae', position: 56 },
      { color: '#f39a56', position: 100 },
    ],
  },
  epic: {
    kind: 'linear',
    direction: '150deg',
    stops: [
      { color: '#d7c39a', position: 0 },
      { color: '#d7e7f7', position: 48 },
      { color: '#8cc0e5', position: 100 },
    ],
  },
  'battle-net': {
    kind: 'linear',
    direction: '140deg',
    stops: [
      { color: '#ffe670', position: 0 },
      { color: '#ffbf31', position: 50 },
      { color: '#ff8a1a', position: 100 },
    ],
  },
  xbox: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#187B3C', position: 0 },
      { color: '#2FA55A', position: 52 },
      { color: '#B8BCC6', position: 100 },
    ],
  },
  minecraft: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#88c94e', position: 0 },
      { color: '#63993e', position: 54 },
      { color: '#7b5538', position: 100 },
    ],
  },
  roblox: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#7faaf2', position: 0 },
      { color: '#5f85cf', position: 52 },
      { color: '#d86e7f', position: 100 },
    ],
  },
  riot: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#090507', position: 0 },
      { color: '#2a0a12', position: 42 },
      { color: '#7f0f26', position: 72 },
      { color: '#14070b', position: 100 },
    ],
  },
  applications: {
    kind: 'linear',
    direction: '140deg',
    stops: [
      { color: '#9fb7e2', position: 0 },
      { color: '#7f97c4', position: 54 },
      { color: '#5f779f', position: 100 },
    ],
  },
  links: {
    kind: 'linear',
    direction: '140deg',
    stops: [
      { color: '#8ec6eb', position: 0 },
      { color: '#7da7de', position: 58 },
      { color: '#9a8fd8', position: 100 },
    ],
  },
  ds: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#ff475f', position: 0 },
      { color: '#ff6a3f', position: 42 },
      { color: '#2f98ff', position: 68 },
      { color: '#0074ff', position: 100 },
    ],
  },
  '3ds': {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#e60012', position: 0 },
      { color: '#c0001a', position: 45 },
      { color: '#1a1a1a', position: 80 },
      { color: '#000000', position: 100 },
    ],
  },
  n64: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#548B88', position: 0 },
      { color: '#797790', position: 33 },
      { color: '#EBC540', position: 66 },
      { color: '#B74243', position: 100 },
    ],
  },
  nes: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#68454A', position: 0 },
      { color: '#E6D087', position: 100 },
    ],
  },
  snes: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#b39dff', position: 0 },
      { color: '#808080', position: 100 },
    ],
  },
  gba: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#2509C2', position: 0 },
      { color: '#74409F', position: 100 },
    ],
  },
  gameboy: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#787F2B', position: 0 },
      { color: '#385B48', position: 100 },
    ],
  },
  gamecube: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#6a0dad', position: 0 },
      { color: '#7d3ab8', position: 50 },
      { color: '#9b77c7', position: 100 },
    ],
  },
  wii: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#b0c8d8', position: 0 },
      { color: '#d4e6f0', position: 52 },
      { color: '#f8f9fa', position: 100 },
    ],
  },
  wiiu: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#009ac7', position: 0 },
      { color: '#e0e0e0', position: 55 },
      { color: '#8a8a8a', position: 100 },
    ],
  },
  switch: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#ED6B5C', position: 0 },
      { color: '#55BADB', position: 100 },
    ],
  },
  genesis: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#1F294E', position: 0 },
      { color: '#ABABAB', position: 100 },
    ],
  },
  dreamcast: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#f5e6c8', position: 0 },
      { color: '#e8d0a0', position: 48 },
      { color: '#e06000', position: 100 },
    ],
  },
  ps1: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#E70013', position: 0 },
      { color: '#00A392', position: 100 },
    ],
  },
  ps2: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#0a0a2e', position: 0 },
      { color: '#1a0060', position: 48 },
      { color: '#2d0080', position: 100 },
    ],
  },
  ps3: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#7ec8e3', position: 0 },
      { color: '#3a7faa', position: 48 },
      { color: '#002f6c', position: 100 },
    ],
  },
  psp: {
    kind: 'linear',
    direction: '145deg',
    stops: [
      { color: '#111111', position: 0 },
      { color: '#2a2a2a', position: 48 },
      { color: '#c0c0c0', position: 100 },
    ],
  },
  all: {
    kind: 'linear',
    direction: '135deg',
    stops: [
      { color: '#ff7390', position: 0 },
      { color: '#ffd882', position: 35 },
      { color: '#8fd3ff', position: 72 },
      { color: '#c9a8ff', position: 100 },
    ],
  },
}

/** Two-color defaults aligned with launcher.css `.brand-*` flat spin palette endpoints. */
const SYSTEM_FLAT_SPIN_DEFAULT_COLORS: Record<string, readonly [string, string]> = {
  all: ['#ff7390', '#c9a8ff'],
  steam: ['#ffb86c', '#091d3c'],
  epic: ['#e4d1ad', '#7eb6dc'],
  'battle-net': ['#ffd447', '#ff8a1f'],
  xbox: ['#187B3C', '#B8BCC6'],
  minecraft: ['#89c458', '#775439'],
  roblox: ['#ff7d95', '#ffffff'],
  riot: ['#c92e4b', '#090507'],
  applications: ['#c7d8ef', '#8ea9d3'],
  links: ['#c7d8ef', '#8ea9d3'],
  executable: ['#c7d8ef', '#8ea9d3'],
  emulator: ['#c7d8ef', '#8ea9d3'],
  ds: ['#ff475f', '#2f98ff'],
  '3ds': ['#e60012', '#111111'],
  n64: ['#548B88', '#B74243'],
  nes: ['#68454A', '#E6D087'],
  snes: ['#b39dff', '#808080'],
  gba: ['#2509C2', '#74409F'],
  gameboy: ['#787F2B', '#385B48'],
  gamecube: ['#8840c8', '#9b77c7'],
  wii: ['#88b8d8', '#d4e6f0'],
  wiiu: ['#009ac7', '#8a8a8a'],
  switch: ['#ED6B5C', '#55BADB'],
  genesis: ['#1F294E', '#ABABAB'],
  dreamcast: ['#d4a017', '#e06000'],
  ps1: ['#00c060', '#004aad'],
  ps2: ['#4a10c0', '#0a0a2e'],
  ps3: ['#5090c0', '#002f6c'],
  psp: ['#444444', '#c0c0c0'],
  handheld: ['#e8a7d8', '#8eb8ef'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function coerceStop(value: unknown): ThemeGradientStop | null {
  if (!isRecord(value)) {
    return null
  }

  const rawColor = typeof value.color === 'string' ? value.color : '#7faaf2'
  const rawPosition = typeof value.position === 'number' ? value.position : Number(value.position)

  if (!Number.isFinite(rawPosition)) {
    return null
  }

  return {
    color: normalizeHexColor(rawColor, '#7faaf2'),
    position: Math.max(0, Math.min(100, rawPosition)),
  }
}

function coerceGradient(value: unknown, fallback: ThemeGradient): ThemeGradient {
  if (!isRecord(value)) {
    return normalizeGradient(fallback)
  }

  const kind = value.kind === 'radial' ? 'radial' : 'linear'
  const direction = typeof value.direction === 'string' && value.direction.trim().length > 0
    ? value.direction.trim()
    : fallback.direction

  const stops = Array.isArray(value.stops)
    ? value.stops.map((stop) => coerceStop(stop)).filter((stop): stop is ThemeGradientStop => Boolean(stop))
    : []

  return normalizeGradient({
    kind,
    direction,
    stops: stops.length > 0 ? stops : fallback.stops,
  })
}

function clampAnimationSpeed(value: number): number {
  return Math.max(0.35, Math.min(2.5, value))
}

export function normalizeSystemGradientAnimationSettings(
  value?: Partial<SystemGradientAnimationSettings> | null,
): SystemGradientAnimationSettings {
  const rawSpeed = typeof value?.speed === 'number' ? value.speed : Number(value?.speed)
  const speed = Number.isFinite(rawSpeed) ? clampAnimationSpeed(rawSpeed) : DEFAULT_SYSTEM_GRADIENT_ANIMATION.speed

  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : DEFAULT_SYSTEM_GRADIENT_ANIMATION.enabled,
    direction: value?.direction === 'counterclockwise' ? 'counterclockwise' : 'clockwise',
    speed,
  }
}

export function getDefaultSystemGradientAnimation(): SystemGradientAnimationSettings {
  return { ...DEFAULT_SYSTEM_GRADIENT_ANIMATION }
}

export function loadSystemGradientAnimationMap(): SystemGradientAnimationMap {
  try {
    const raw = localStorage.getItem(SYSTEM_GRADIENT_ANIMATION_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return {}
    }

    const result: SystemGradientAnimationMap = {}
    let removedFactoryKeys = false

    for (const [key, value] of Object.entries(parsed)) {
      if (isFactorySystemKey(key)) {
        removedFactoryKeys = true
        continue
      }

      if (!isRecord(value)) {
        continue
      }

      result[key] = normalizeSystemGradientAnimationSettings(value)
    }

    if (removedFactoryKeys) {
      persistSystemGradientAnimationMap(result)
    }

    return result
  } catch {
    return {}
  }
}

export function persistSystemGradientAnimationMap(map: SystemGradientAnimationMap): void {
  try {
    const serializable = Object.entries(map).reduce<SystemGradientAnimationMap>((accumulator, [key, settings]) => {
      accumulator[key] = normalizeSystemGradientAnimationSettings(settings)
      return accumulator
    }, {})

    localStorage.setItem(SYSTEM_GRADIENT_ANIMATION_STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    // Ignore storage write failures.
  }
}

export function getDefaultSystemGradient(systemKey: string): ThemeGradient {
  const flatSpinDefaults = SYSTEM_FLAT_SPIN_DEFAULT_COLORS[systemKey]
  if (flatSpinDefaults) {
    return normalizeGradient({
      kind: 'linear',
      direction: '135deg',
      stops: [
        { color: normalizeHexColor(flatSpinDefaults[0], '#8ec4ff'), position: 0 },
        { color: normalizeHexColor(flatSpinDefaults[1], '#e78ab8'), position: 100 },
      ],
    })
  }

  const legacy = SYSTEM_GRADIENT_DEFAULTS[systemKey] ?? SYSTEM_GRADIENT_DEFAULTS.all
  const first = legacy.stops[0]?.color ?? '#8ec4ff'
  const last = legacy.stops[Math.max(0, legacy.stops.length - 1)]?.color ?? first
  return normalizeGradient({
    kind: 'linear',
    direction: '135deg',
    stops: [
      { color: normalizeHexColor(first, '#8ec4ff'), position: 0 },
      { color: normalizeHexColor(last, '#e78ab8'), position: 100 },
    ],
  })
}

export function loadSystemGradientMap(): SystemGradientMap {
  try {
    const raw = localStorage.getItem(SYSTEM_GRADIENT_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return {}
    }

    const result: SystemGradientMap = {}
    let removedFactoryKeys = false

    for (const [key, value] of Object.entries(parsed)) {
      if (isFactorySystemKey(key)) {
        removedFactoryKeys = true
        continue
      }

      result[key] = coerceGradient(value, getDefaultSystemGradient(key))
    }

    if (removedFactoryKeys) {
      persistSystemGradientMap(result)
    }

    return result
  } catch {
    return {}
  }
}

export function persistSystemGradientMap(map: SystemGradientMap): void {
  try {
    const serializable = Object.entries(map).reduce<SystemGradientMap>((accumulator, [key, gradient]) => {
      accumulator[key] = normalizeGradient(gradient)
      return accumulator
    }, {})

    localStorage.setItem(SYSTEM_GRADIENT_STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    // Ignore storage write failures.
  }
}

export function normalizeSystemGradientApplyMode(value: unknown): SystemGradientApplyMode {
  return value === 'soaked' ? 'soaked' : 'borders'
}

export function loadSystemGradientApplyModeMap(): SystemGradientApplyModeMap {
  try {
    const raw = localStorage.getItem(SYSTEM_GRADIENT_APPLY_MODE_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return {}
    }

    const result: SystemGradientApplyModeMap = {}
    let removedFactoryKeys = false

    for (const [key, value] of Object.entries(parsed)) {
      if (isFactorySystemKey(key)) {
        removedFactoryKeys = true
        continue
      }

      result[key] = normalizeSystemGradientApplyMode(value)
    }

    if (removedFactoryKeys) {
      persistSystemGradientApplyModeMap(result)
    }

    return result
  } catch {
    return {}
  }
}

export function persistSystemGradientApplyModeMap(map: SystemGradientApplyModeMap): void {
  try {
    const serializable = Object.entries(map).reduce<SystemGradientApplyModeMap>((accumulator, [key, mode]) => {
      accumulator[key] = normalizeSystemGradientApplyMode(mode)
      return accumulator
    }, {})

    localStorage.setItem(SYSTEM_GRADIENT_APPLY_MODE_STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    // Ignore storage write failures.
  }
}

export function getSystemGradientApplyMode(
  map: SystemGradientApplyModeMap,
  systemKey: string,
): SystemGradientApplyMode {
  return normalizeSystemGradientApplyMode(map[systemKey])
}

// ─── Logo border per-system map ──────────────────────────────────────────────

const SYSTEM_LOGO_BORDER_STORAGE_KEY = 'tile-manager-system-logo-border-v3'

export type SystemLogoBorderMap = Record<string, boolean>

export function loadSystemLogoBorderMap(): SystemLogoBorderMap {
  try {
    const raw = localStorage.getItem(SYSTEM_LOGO_BORDER_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const result: SystemLogoBorderMap = {}
    let removedFactoryKeys = false

    for (const [key, value] of Object.entries(parsed)) {
      if (isFactorySystemKey(key)) {
        removedFactoryKeys = true
        continue
      }

      if (typeof value === 'boolean') {
        result[key] = value
      }
    }

    if (removedFactoryKeys) {
      persistSystemLogoBorderMap(result)
    }

    return result
  } catch {
    return {}
  }
}

export function persistSystemLogoBorderMap(map: SystemLogoBorderMap): void {
  try {
    localStorage.setItem(SYSTEM_LOGO_BORDER_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage write failures.
  }
}

export function buildLogoBorderOverrideCss(logoBorderMap: SystemLogoBorderMap): string {
  const rules: string[] = []

  for (const [systemKey, enabled] of Object.entries(logoBorderMap)) {
    if (!enabled) {
      continue
    }

    const cssKey = sanitizeSystemKey(systemKey)
    if (!cssKey) {
      continue
    }

    rules.push(
      `.brand-${cssKey} .system-launcher-logo {`,
      `  --tm-logo-outline-display: none !important;`,
      `  --tm-logo-outline-opacity: 0 !important;`,
      `  --tm-logo-outline-scale: 1 !important;`,
      `  --tm-logo-mask-shadow-filter-light: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.34)) drop-shadow(0 4px 8px rgba(20, 36, 58, 0.32)) !important;`,
      `  --tm-logo-mask-shadow-filter-dark: drop-shadow(0 0 1px rgba(221, 236, 255, 0.34)) drop-shadow(0 5px 10px rgba(3, 9, 18, 0.56)) !important;`,
      `  --tm-logo-mask-shadow-filter-light-low-contrast: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.46)) drop-shadow(0 4px 9px rgba(10, 20, 37, 0.42)) !important;`,
      `  --tm-logo-mask-shadow-filter-dark-low-contrast: drop-shadow(0 0 1px rgba(225, 239, 255, 0.42)) drop-shadow(0 6px 11px rgba(2, 8, 16, 0.66)) !important;`,
      `}`,
      `body[data-tm-tone='dark'] .brand-${cssKey} .system-launcher-logo {`,
      `  --tm-logo-outline-opacity: 0 !important;`,
      `  --tm-logo-outline-scale: 1 !important;`,
      `}`,
      `.brand-${cssKey} .system-launcher-logo.is-logo-low-contrast {`,
      `  --tm-logo-outline-opacity: 0 !important;`,
      `  --tm-logo-outline-scale: 1 !important;`,
      `}`,
    )
  }

  return rules.join('\n')
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount))
  return {
    r: clampChannel(a.r + (b.r - a.r) * t),
    g: clampChannel(a.g + (b.g - a.g) * t),
    b: clampChannel(a.b + (b.b - a.b) * t),
  }
}

function rgbToHex(color: Rgb): string {
  const toHex = (channel: number) => clampChannel(channel).toString(16).padStart(2, '0')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

function rgbToRgba(color: Rgb, alpha: number): string {
  const nextAlpha = Math.max(0, Math.min(1, alpha))
  return `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${nextAlpha.toFixed(3)})`
}

function parseHexColor(value: string): Rgb {
  const hex = normalizeHexColor(value, rgbToHex(DEFAULT_THEME_RGB))
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match?.[1]) {
    return DEFAULT_THEME_RGB
  }

  const channels = match[1]
  return {
    r: Number.parseInt(channels.slice(0, 2), 16),
    g: Number.parseInt(channels.slice(2, 4), 16),
    b: Number.parseInt(channels.slice(4, 6), 16),
  }
}

function toLinearChannel(channel: number): number {
  const normalized = Math.max(0, Math.min(255, channel)) / 255
  if (normalized <= 0.04045) {
    return normalized / 12.92
  }

  return ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(color: Rgb): number {
  const red = toLinearChannel(color.r)
  const green = toLinearChannel(color.g)
  const blue = toLinearChannel(color.b)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const luminanceA = relativeLuminance(a)
  const luminanceB = relativeLuminance(b)
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

function sampleGradientColor(gradient: ThemeGradient, position: number): Rgb {
  const normalized = normalizeGradient(gradient)
  const stops = normalized.stops
  if (stops.length === 0) {
    return DEFAULT_THEME_RGB
  }

  const target = Math.max(0, Math.min(100, position))
  const first = stops[0]
  const last = stops[stops.length - 1]

  if (!first || !last) {
    return DEFAULT_THEME_RGB
  }

  if (target <= first.position) {
    return parseHexColor(first.color)
  }

  if (target >= last.position) {
    return parseHexColor(last.color)
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const left = stops[index]
    const right = stops[index + 1]
    if (!left || !right) {
      continue
    }

    if (target >= left.position && target <= right.position) {
      const span = right.position - left.position
      if (!Number.isFinite(span) || span <= 0) {
        return parseHexColor(right.color)
      }

      const ratio = (target - left.position) / span
      return mixRgb(parseHexColor(left.color), parseHexColor(right.color), ratio)
    }
  }

  return parseHexColor(last.color)
}

function sanitizeSystemKey(systemKey: string): string {
  return systemKey.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

export function getSystemBrandClassName(systemKey: string): string {
  const cssKey = sanitizeSystemKey(systemKey)
  return cssKey ? `brand-${cssKey}` : ''
}

export function deriveSystemGradientThemeTokens(gradient: ThemeGradient): SystemGradientThemeTokens {
  const normalized = normalizeGradient(gradient)
  const gradientCss = gradientToCss(normalized)
  const firstStop = normalized.stops[0]
  const lastStop = normalized.stops[Math.max(0, normalized.stops.length - 1)]
  const exactStart = parseHexColor(firstStop?.color ?? '#8ec4ff')
  const exactEnd = parseHexColor(lastStop?.color ?? firstStop?.color ?? '#e78ab8')
  const colorStart = sampleGradientColor(normalized, 12)
  const colorMid = sampleGradientColor(normalized, 52)
  const colorEnd = sampleGradientColor(normalized, 88)
  const white = { r: 255, g: 255, b: 255 }
  const averageLuminance = (
    relativeLuminance(exactStart) * 0.34
    + relativeLuminance(exactEnd) * 0.66
  )
  const weakestContrastToWhite = Math.min(
    contrastRatio(exactStart, white),
    contrastRatio(exactEnd, white),
  )
  const clampFromLuminance = Math.max(0, Math.min(1, (averageLuminance - 0.62) / 0.24))
  const clampFromContrast = Math.max(0, Math.min(1, (2.45 - weakestContrastToWhite) / 1.25))
  const logoContrastClampStrength = Math.max(clampFromLuminance, clampFromContrast)
  const logoNeedsLightModeGuard = logoContrastClampStrength >= 0.34

  // Tile/logo colors follow the picked gradient exactly for WYSIWYG editing.
  const logoBackground = gradientCss

  // Blend both gradient poles for subtle ring/glow accents (borders only — not text).
  const borderBase = mixRgb(exactStart, exactEnd, 0.5)
  const ringBase = mixRgb(exactStart, exactEnd, 0.34)
  const glowBase = mixRgb(exactStart, exactEnd, 0.72)
  const borderColor = mixRgb(borderBase, { r: 255, g: 255, b: 255 }, 0.14)
  const ringColor = mixRgb(ringBase, { r: 255, g: 255, b: 255 }, 0.1)
  const glowColor = mixRgb(glowBase, { r: 255, g: 255, b: 255 }, 0.08)
  const glassTop = mixRgb(colorStart, { r: 255, g: 255, b: 255 }, 0.56)
  const glassBottom = mixRgb(colorEnd, { r: 255, g: 255, b: 255 }, 0.22)
  const pillTop = mixRgb(colorMid, { r: 255, g: 255, b: 255 }, 0.62)
  const pillBottom = mixRgb(colorEnd, { r: 255, g: 255, b: 255 }, 0.36)
  const pillPrimaryTop = mixRgb(exactStart, { r: 255, g: 255, b: 255 }, 0.24)
  const pillPrimaryBottom = mixRgb(exactEnd, { r: 16, g: 28, b: 44 }, 0.16)
  const flatBorderColor = mixRgb(mixRgb(exactStart, exactEnd, 0.5), { r: 255, g: 255, b: 255 }, 0.2)
  const flatBorderColorStrong = mixRgb(exactStart, { r: 255, g: 255, b: 255 }, 0.3)
  const flatSecondaryColor = mixRgb(exactEnd, { r: 255, g: 255, b: 255 }, 0.44)
  const flatSpinColorA = exactStart
  const flatSpinColorB = exactEnd
  const flatIconBorderGradient = [
    'linear-gradient(',
    'to top left, ',
    `${rgbToHex(flatBorderColorStrong)} 0%, `,
    `${rgbToHex(flatBorderColor)} 50%, `,
    `${rgbToHex(flatSpinColorB)} 100%`,
    ')',
  ].join('')
  const flatBorderSpinGradient = [
    'conic-gradient(',
    'from var(--flat-border-spin-angle), ',
    `${rgbToHex(flatSpinColorA)} 0deg, `,
    `${rgbToHex(flatBorderColorStrong)} 92deg, `,
    `${rgbToHex(flatBorderColor)} 176deg, `,
    `${rgbToHex(flatSpinColorB)} 264deg, `,
    `${rgbToHex(flatSpinColorA)} 360deg`,
    ')',
  ].join('')

  return {
    gradientCss,
    brandBackground: gradientCss,
    logoBackground,
    logoNeedsLightModeGuard,
    cornerBackground: `linear-gradient(180deg, ${rgbToHex(mixRgb(exactStart, { r: 255, g: 255, b: 255 }, 0.72))}, ${rgbToHex(mixRgb(exactEnd, { r: 255, g: 255, b: 255 }, 0.36))})`,
    borderColor: rgbToHex(borderColor),
    ringColor: rgbToRgba(ringColor, 0.82),
    glowColor: rgbToRgba(glowColor, 0.54),
    flyoutEdge: rgbToRgba(mixRgb(colorMid, { r: 255, g: 255, b: 255 }, 0.32), 0.72),
    flyoutEdgeSoft: rgbToRgba(mixRgb(colorMid, { r: 255, g: 255, b: 255 }, 0.38), 0.46),
    flyoutGlassTop: rgbToRgba(glassTop, 0.4),
    flyoutGlassBottom: rgbToRgba(glassBottom, 0.3),
    flyoutPillTop: rgbToRgba(pillTop, 0.76),
    flyoutPillBottom: rgbToRgba(pillBottom, 0.56),
    flyoutPillBorder: rgbToRgba(mixRgb(borderColor, { r: 255, g: 255, b: 255 }, 0.14), 0.78),
    flyoutPillPrimaryTop: rgbToRgba(pillPrimaryTop, 0.9),
    flyoutPillPrimaryBottom: rgbToRgba(pillPrimaryBottom, 0.84),
    flyoutAchievementColor: rgbToHex(mixRgb(colorMid, { r: 255, g: 255, b: 255 }, 0.78)),
    flatBorderColor: rgbToHex(flatBorderColor),
    flatBorderColorStrong: rgbToHex(flatBorderColorStrong),
    flatSecondaryColor: rgbToHex(flatSecondaryColor),
    flatBorderSpinColorA: rgbToHex(flatSpinColorA),
    flatBorderSpinColorB: rgbToHex(flatSpinColorB),
    flatBorderSpinGradient,
    flatIconBorderGradient,
    flatIconFillGradient: gradientCss,
    waveColorA: rgbToHex(exactStart),
    waveColorB: rgbToHex(mixRgb(exactStart, exactEnd, 0.5)),
    waveColorC: rgbToHex(exactEnd),
  }
}

function toSeconds(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(2)}s`
}

function scopedSelector(scope: string, selector: string): string {
  if (!scope) {
    return selector
  }

  return `${scope}${selector}`
}

const SYSTEM_TILE_LIQUID_GLASS_FILL = [
  'linear-gradient(',
  '168deg, ',
  'rgba(255, 255, 255, 0.42), ',
  'rgba(255, 255, 255, 0.1) 42%, ',
  'rgba(12, 20, 34, 0.12) 100%',
  ')',
].join('')

const SYSTEM_TILE_NEUTRAL_FILL = 'linear-gradient(180deg, #ffffff 0%, #f3f6fb 100%)'

function buildGradientOverrideRule(
  systemKey: string,
  gradient: ThemeGradient,
  animationSettings: SystemGradientAnimationSettings,
  scope = '',
  _applyMode: SystemGradientApplyMode = DEFAULT_SYSTEM_GRADIENT_APPLY_MODE,
): string {
  const cssKey = sanitizeSystemKey(systemKey)
  if (!cssKey) {
    return ''
  }

  const tokens = deriveSystemGradientThemeTokens(gradient)
  const normalizedAnimation = normalizeSystemGradientAnimationSettings(animationSettings)
  const speed = Math.max(0.35, normalizedAnimation.speed)
  const idleDuration = toSeconds((58 / speed) * 1000)
  const hoverDuration = toSeconds((30 / speed) * 1000)
  const focusDuration = toSeconds((16 / speed) * 1000)
  const spinDirection = normalizedAnimation.direction === 'counterclockwise' ? 'reverse' : 'normal'
  const spinPlayState = normalizedAnimation.enabled ? 'running' : 'paused'
  const brandSelector = scopedSelector(scope, `.brand-${cssKey}`)
  const flatScopedSelector = [
    scopedSelector(scope, `.stack-item.brand-${cssKey}`),
    scopedSelector(scope, `.grid-game-card.brand-${cssKey}`),
    scopedSelector(scope, `.grid-focus-ring.brand-${cssKey}`),
    scopedSelector(scope, `.system-grid-card.brand-${cssKey}`),
    scopedSelector(scope, `.feature-card.brand-${cssKey}`),
    scopedSelector(scope, `.mini-system-icon.brand-${cssKey}`),
    scopedSelector(scope, `.system-focus-block.brand-${cssKey}`),
    scopedSelector(scope, `.game-caption-plate.brand-${cssKey}`),
  ].join(',\n')
  const shellBeforeSelector = [
    scopedSelector(scope, `.stack-item.brand-${cssKey}::before`),
    scopedSelector(scope, `.grid-game-card.brand-${cssKey}::before`),
    scopedSelector(scope, `.system-grid-card.brand-${cssKey}::before`),
    scopedSelector(scope, `.feature-card.brand-${cssKey}::before`),
    scopedSelector(scope, `.mini-system-icon.brand-${cssKey}::before`),
  ].join(',\n')
  const iconCornerSelector = [
    scopedSelector(scope, `.stack-item.brand-${cssKey} .icon-corner`),
    scopedSelector(scope, `.grid-game-card.brand-${cssKey} .icon-corner`),
    scopedSelector(scope, `.system-grid-card.brand-${cssKey} .icon-corner`),
    scopedSelector(scope, `.feature-card.brand-${cssKey} .icon-corner`),
  ].join(',\n')
  const borderSpinFallback = [
    'conic-gradient(',
    'from var(--flat-border-spin-angle), ',
    `${tokens.flatBorderSpinColorA} 0deg, `,
    `${tokens.flatBorderSpinColorB} 250deg, `,
    `${tokens.flatBorderSpinColorA} 360deg`,
    ')',
  ].join('')

  const tileShellInnerFill = `${SYSTEM_TILE_NEUTRAL_FILL} content-box,`

  return [
    `${brandSelector} {`,
    `  --brand-bg: ${tokens.brandBackground} !important;`,
    `  --tm-logo-brand-bg: ${tokens.logoBackground} !important;`,
    `  --tm-logo-low-contrast-light: ${tokens.logoNeedsLightModeGuard ? '1' : '0'} !important;`,
    `  --corner-bg: ${tokens.cornerBackground} !important;`,
    `  --brand-border: ${tokens.borderColor} !important;`,
    `  --active-ring: ${tokens.ringColor} !important;`,
    `  --active-glow: ${tokens.glowColor} !important;`,
    `  --flyout-edge: ${tokens.flyoutEdge} !important;`,
    `  --flyout-edge-soft: ${tokens.flyoutEdgeSoft} !important;`,
    `  --flyout-pill-border: ${tokens.flyoutPillBorder} !important;`,
    `}`,
    `${flatScopedSelector} {`,
    `  --flat-border-color: ${tokens.flatBorderColor} !important;`,
    `  --flat-border-color-strong: ${tokens.flatBorderColorStrong} !important;`,
    `  --flat-border-spin-color-a: ${tokens.flatBorderSpinColorA} !important;`,
    `  --flat-border-spin-color-b: ${tokens.flatBorderSpinColorB} !important;`,
    `  --flat-border-spin-gradient: ${tokens.flatBorderSpinGradient} !important;`,
    `  --flat-icon-border-gradient: ${tokens.flatIconBorderGradient} !important;`,
    `  --flat-border-spin-idle-duration: ${idleDuration} !important;`,
    `  --flat-border-spin-hover-duration: ${hoverDuration} !important;`,
    `  --flat-border-spin-focus-duration: ${focusDuration} !important;`,
    `  --tm-flat-spin-direction: ${spinDirection} !important;`,
    `  --tm-flat-spin-play-state: ${spinPlayState} !important;`,
    `}`,
    `${shellBeforeSelector} {`,
    `  background:`,
    `    ${SYSTEM_TILE_LIQUID_GLASS_FILL} content-box,`,
    `    ${tileShellInnerFill}`,
    `    var(--flat-border-spin-gradient, ${borderSpinFallback}) border-box !important;`,
    `  background-clip: content-box, content-box, border-box !important;`,
    `  background-origin: border-box !important;`,
    `}`,
    `${iconCornerSelector} {`,
    `  border-color: ${tokens.borderColor} !important;`,
    `  background:`,
    `    var(--flat-icon-fill-gradient) padding-box,`,
    `    var(--flat-icon-border-gradient) border-box !important;`,
    `}`,
    `${brandSelector} .system-launcher-logo .category-icon-mask {`,
    `  background: var(--tm-logo-brand-bg, var(--brand-bg)) !important;`,
    `  background-blend-mode: normal !important;`,
    `  transition: background 180ms ease !important;`,
    `}`,
    `${brandSelector} .system-launcher-logo .category-collage-backdrop::before {`,
    `  background-image:`,
    `    radial-gradient(var(--tm-collage-dot-color, rgba(38, 58, 92, 0.22)) 1px, rgba(0, 0, 0, 0) 1.24px),`,
    `    radial-gradient(130% 82% at 50% -14%, var(--tm-collage-top-highlight, rgba(255, 255, 255, 0.24)) 0%, rgba(255, 255, 255, 0) 66%),`,
    `    radial-gradient(120% 88% at 50% 118%, var(--tm-collage-bottom-vignette, rgba(17, 31, 52, 0.18)) 0%, rgba(17, 31, 52, 0) 72%),`,
    `    linear-gradient(160deg, var(--tm-collage-wash-start, rgba(255, 255, 255, 0.5)) 0%, var(--tm-collage-wash-mid, rgba(255, 255, 255, 0.26)) 36%, var(--tm-collage-wash-end, rgba(255, 255, 255, 0.08)) 100%),`,
    `    var(--brand-bg) !important;`,
    `}`,
  ].filter(Boolean).join('\n')
}

export function buildSystemGradientOverrideCss(
  map: SystemGradientMap,
  animationMap: SystemGradientAnimationMap = {},
  applyModeMap: SystemGradientApplyModeMap = {},
): string {
  const rules = Object.entries(map)
    .map(([systemKey, gradient]) =>
      buildGradientOverrideRule(
        systemKey,
        gradient,
        animationMap[systemKey] ?? getDefaultSystemGradientAnimation(),
        '',
        getSystemGradientApplyMode(applyModeMap, systemKey),
      ),
    )
    .filter((rule) => rule.length > 0)

  return rules.join('\n\n')
}

export function buildSystemGradientPreviewOverrideCss(
  systemKey: string,
  gradient: ThemeGradient,
  animationSettings: SystemGradientAnimationSettings = getDefaultSystemGradientAnimation(),
  applyMode: SystemGradientApplyMode = DEFAULT_SYSTEM_GRADIENT_APPLY_MODE,
): string {
  return buildGradientOverrideRule(
    systemKey,
    gradient,
    animationSettings,
    '.system-gradient-modal-simple .system-gradient-preview-tile',
    applyMode,
  )
}

function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 0x6d2b79f5
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const hueUnit = hue / 360
  const sat = saturation / 100
  const light = lightness / 100

  if (sat === 0) {
    const value = Math.round(light * 255)
    const channel = value.toString(16).padStart(2, '0')
    return `#${channel}${channel}${channel}`
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q

  const hueToChannel = (segment: number) => {
    let t = segment
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const red = Math.round(hueToChannel(hueUnit + 1 / 3) * 255)
  const green = Math.round(hueToChannel(hueUnit) * 255)
  const blue = Math.round(hueToChannel(hueUnit - 1 / 3) * 255)

  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`
}

export function createRandomSystemGradient(seed = Date.now()): ThemeGradient {
  const rng = createSeededRng(seed)
  const stopCount = 3 + Math.floor(rng() * 2)
  const startHue = Math.floor(rng() * 360)
  const kind = rng() > 0.76 ? 'radial' : 'linear'
  const direction = kind === 'linear'
    ? ['110deg', '125deg', '135deg', '145deg', '160deg', '45deg'][Math.floor(rng() * 6)]
    : ['circle at center', 'circle at top', 'circle at bottom right', 'circle at left center'][Math.floor(rng() * 4)]

  const stops: ThemeGradientStop[] = Array.from({ length: stopCount }, (_, index) => {
    const hueShift = (index * (28 + Math.floor(rng() * 40))) % 360
    const hue = (startHue + hueShift) % 360
    const saturation = 58 + Math.floor(rng() * 30)
    const lightness = 42 + Math.floor(rng() * 26)

    return {
      color: hslToHex(hue, saturation, lightness),
      position: Math.round((index / Math.max(1, stopCount - 1)) * 100),
    }
  })

  return normalizeGradient({
    kind,
    direction,
    stops,
  })
}

/** Fixed linear direction for the simplified beta gradient editor. */
export const BETA_SYSTEM_GRADIENT_DIRECTION = '135deg'

export function buildTwoColorSystemGradient(colorA: string, colorB: string): ThemeGradient {
  return normalizeGradient({
    kind: 'linear',
    direction: BETA_SYSTEM_GRADIENT_DIRECTION,
    stops: [
      { color: normalizeHexColor(colorA, '#8ec4ff'), position: 0 },
      { color: normalizeHexColor(colorB, '#e78ab8'), position: 100 },
    ],
  })
}

export function buildSystemTileCssVars(
  gradient: ThemeGradient,
  animation: SystemGradientAnimationSettings = getDefaultSystemGradientAnimation(),
): Record<string, string> {
  const tokens = deriveSystemGradientThemeTokens(gradient)
  const normalizedAnimation = normalizeSystemGradientAnimationSettings(animation)
  const speed = Math.max(0.35, normalizedAnimation.speed)

  return {
    '--brand-bg': tokens.brandBackground,
    '--tm-logo-brand-bg': tokens.logoBackground,
    '--tm-logo-low-contrast-light': tokens.logoNeedsLightModeGuard ? '1' : '0',
    '--corner-bg': tokens.cornerBackground,
    '--brand-border': tokens.borderColor,
    '--active-ring': tokens.ringColor,
    '--active-glow': tokens.glowColor,
    '--flat-border-color': tokens.flatBorderColor,
    '--flat-border-color-strong': tokens.flatBorderColorStrong,
    '--flat-border-spin-color-a': tokens.flatBorderSpinColorA,
    '--flat-border-spin-color-b': tokens.flatBorderSpinColorB,
    '--flat-border-spin-gradient': tokens.flatBorderSpinGradient,
    '--flat-icon-border-gradient': tokens.flatIconBorderGradient,
    '--flat-icon-fill-gradient': tokens.flatIconFillGradient,
    '--flat-border-spin-idle-duration': `${(58 / speed).toFixed(2)}s`,
    '--flat-border-spin-hover-duration': `${(30 / speed).toFixed(2)}s`,
    '--flat-border-spin-focus-duration': `${(16 / speed).toFixed(2)}s`,
    '--tm-flat-spin-direction': normalizedAnimation.direction === 'counterclockwise' ? 'reverse' : 'normal',
    '--tm-flat-spin-play-state': normalizedAnimation.enabled ? 'running' : 'paused',
  }
}

export function readTwoColorSystemGradient(
  gradient: ThemeGradient | null | undefined,
  fallback: ThemeGradient,
): [string, string] {
  const source = gradient ? normalizeGradient(gradient) : normalizeGradient(fallback)
  const first = source.stops[0]?.color ?? '#8ec4ff'
  const last = source.stops[Math.max(0, source.stops.length - 1)]?.color ?? first
  return [first, last]
}

export function getBetaSystemGradientAnimation(): SystemGradientAnimationSettings {
  return getDefaultSystemGradientAnimation()
}
