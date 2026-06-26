import type { CSSProperties } from 'react'

import { TILE_MOTION_STYLE_CACHE_LIMIT } from '../constants'

const tileMotionStyleCache = new Map<string, CSSProperties>()

export function shouldShowCornerDew(seed: string): boolean {
  if (!seed) {
    return false
  }

  let score = 0
  for (let index = 0; index < seed.length; index += 1) {
    score = (score + seed.charCodeAt(index) * (index + 3)) % 97
  }

  return score % 3 === 0
}

function hashSelectionHue(seed: string): number {
  if (!seed) {
    return 210
  }

  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) % 360
  }

  return hash
}

function seededMotionValue(seed: string, salt: number): number {
  let hash = 2166136261 ^ salt
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 4294967295
}

export function buildTileMotionStyle(seed: string, existing?: CSSProperties): CSSProperties {
  const cached = tileMotionStyleCache.get(seed)
  if (cached) {
    return existing ? { ...cached, ...existing } : cached
  }

  const phase = seededMotionValue(seed, 11)
  const speed = 7.1 + seededMotionValue(seed, 23) * 3.3
  const floatAmp = 0.7 + seededMotionValue(seed, 37) * 1.2
  const swayAmp = 0.45 + seededMotionValue(seed, 41) * 1.15
  const driftAmp = 0.3 + seededMotionValue(seed, 53) * 1.25
  const spinAmp = 0.22 + seededMotionValue(seed, 67) * 0.95
  const breatheMin = 0.988 + seededMotionValue(seed, 79) * 0.01
  const breatheMax = 1.012 + seededMotionValue(seed, 97) * 0.016
  const direction = seededMotionValue(seed, 131) > 0.5 ? 1 : -1

  const baseStyle: CSSProperties = {
    ['--tile-float-delay' as string]: `${-(phase * 9.6).toFixed(2)}s`,
    ['--tile-float-speed' as string]: `${speed.toFixed(2)}s`,
    ['--tile-float-amp' as string]: `${(floatAmp * direction).toFixed(3)}px`,
    ['--tile-sway-amp' as string]: `${(swayAmp * direction).toFixed(3)}px`,
    ['--tile-drift-amp' as string]: `${(driftAmp * direction).toFixed(3)}px`,
    ['--tile-spin-amp' as string]: `${(spinAmp * direction).toFixed(3)}deg`,
    ['--tile-breathe-min' as string]: breatheMin.toFixed(4),
    ['--tile-breathe-max' as string]: breatheMax.toFixed(4),
  }

  if (tileMotionStyleCache.size >= TILE_MOTION_STYLE_CACHE_LIMIT) {
    const oldestSeed = tileMotionStyleCache.keys().next().value
    if (oldestSeed !== undefined) {
      tileMotionStyleCache.delete(oldestSeed)
    }
  }

  tileMotionStyleCache.set(seed, baseStyle)

  return existing ? { ...baseStyle, ...existing } : baseStyle
}

export function getBrandBackdropGradient(brandKey: string): string {
  switch (brandKey) {
    case 'steam':
      return 'linear-gradient(162deg, rgba(8, 34, 76, 0.86) 0%, rgba(24, 86, 168, 0.78) 46%, rgba(243, 162, 88, 0.8) 100%)'
    case 'epic':
      return 'linear-gradient(162deg, rgba(230, 212, 184, 0.8) 0%, rgba(182, 216, 245, 0.72) 52%, rgba(126, 182, 232, 0.74) 100%)'
    case 'battle-net':
      return 'linear-gradient(162deg, rgba(255, 222, 86, 0.82) 0%, rgba(255, 184, 42, 0.78) 48%, rgba(255, 118, 22, 0.76) 100%)'
    case 'xbox':
      return 'linear-gradient(162deg, rgba(24, 123, 60, 0.84) 0%, rgba(47, 165, 90, 0.76) 48%, rgba(184, 188, 198, 0.74) 100%)'
    case 'roblox':
      return 'linear-gradient(162deg, rgba(255, 248, 252, 0.78) 0%, rgba(255, 204, 221, 0.74) 52%, rgba(255, 84, 116, 0.74) 100%)'
    case 'riot':
      return 'linear-gradient(162deg, rgba(7, 5, 7, 0.9) 0%, rgba(47, 10, 18, 0.84) 56%, rgba(140, 16, 42, 0.8) 100%)'
    case 'minecraft':
      return 'linear-gradient(162deg, rgba(136, 208, 86, 0.8) 0%, rgba(108, 170, 66, 0.76) 52%, rgba(122, 86, 59, 0.7) 100%)'
    case 'nes':
      return 'linear-gradient(162deg, rgba(255, 196, 210, 0.76) 0%, rgba(157, 206, 255, 0.7) 48%, rgba(255, 226, 140, 0.68) 100%)'
    case 'snes':
      return 'linear-gradient(162deg, rgba(214, 186, 255, 0.76) 0%, rgba(148, 199, 255, 0.7) 48%, rgba(255, 205, 146, 0.68) 100%)'
    case 'n64':
      return 'linear-gradient(162deg, rgba(142, 213, 255, 0.76) 0%, rgba(149, 233, 179, 0.7) 48%, rgba(255, 212, 124, 0.68) 100%)'
    case 'handheld':
      return 'linear-gradient(162deg, rgba(255, 188, 224, 0.74) 0%, rgba(162, 210, 255, 0.7) 50%, rgba(167, 236, 194, 0.68) 100%)'
    case 'ds':
      return 'linear-gradient(162deg, rgba(255, 68, 92, 0.78) 0%, rgba(255, 104, 64, 0.72) 30%, rgba(70, 162, 255, 0.72) 68%, rgba(0, 114, 255, 0.78) 100%)'
    default:
      return 'linear-gradient(162deg, rgba(255, 188, 220, 0.74) 0%, rgba(143, 210, 255, 0.72) 28%, rgba(153, 233, 189, 0.68) 62%, rgba(255, 223, 129, 0.7) 100%)'
  }
}

export function getSelectionAccentGradient(selectionKey: string): string {
  const hue = hashSelectionHue(selectionKey)
  const secondaryHue = (hue + 52) % 360
  return `radial-gradient(ellipse 68% 52% at 78% 16%, hsla(${hue}, 74%, 66%, 0.24), transparent 72%), radial-gradient(ellipse 56% 46% at 18% 82%, hsla(${secondaryHue}, 70%, 62%, 0.2), transparent 74%)`
}

export function getFavoriteStarTone(brandKey: string): 'light' | 'dark' {
  const lightBrands = new Set([
    'all',
    'epic',
    'roblox',
    'battle-net',
    'links',
    'executable',
    'applications',
    'emulator',
    'nes',
    'snes',
    'n64',
    'handheld',
    'ds',
  ])

  return lightBrands.has(brandKey) ? 'dark' : 'light'
}
