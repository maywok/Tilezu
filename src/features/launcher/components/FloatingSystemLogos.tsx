import { useMemo } from 'react'
import type { ThemeGradient } from '../../appearance/types'
import { normalizeGradient } from '../../appearance/utils/theme'
import type { CategoryMeta } from '../types'
import type { SystemGradientThemeTokens } from '../utils/systemGradient'

type FloatingSystemLogosProps = {
  categories: CategoryMeta[]
  brandKey: string
  gradient: ThemeGradient
  themeTokens: SystemGradientThemeTokens
  reducedMotion?: boolean
}

type FloatingDustSpec = {
  id: number
  color: string
  left: number
  top: number
  size: number
  delay: number
  duration: number
  driftX: number
  driftY: number
}

type FloatingGhostLogo = {
  id: string
  logoPath: string
  left: number
  top: number
  size: number
  delay: number
  duration: number
  driftX: number
  driftY: number
}

const DUST_COUNT = 14
const DUST_COUNT_LITE = 10
const LOGO_COUNT = 3
const LOGO_COUNT_LITE = 2

function buildGradientPalette(gradient: ThemeGradient, themeTokens: SystemGradientThemeTokens) {
  const normalized = normalizeGradient(gradient)
  const stopColors = normalized.stops.map((stop) => stop.color)
  return [...new Set([...stopColors, themeTokens.waveColorA, themeTokens.waveColorB, themeTokens.waveColorC])]
}

function buildFloatingDust(palette: string[], count: number): FloatingDustSpec[] {
  if (palette.length === 0 || count <= 0) {
    return []
  }

  return Array.from({ length: count }, (_, index) => {
    const left = ((index * 37 + 11) % 92) + 4
    const top = ((index * 53 + 17) % 86) + 7
    const size = 3.6 + (index % 3) * 1.1
    const delay = -((index * 1.47) % 11)
    const duration = 8 + (index % 4) * 1.8
    const driftX = ((index % 5) - 2) * 14
    const driftY = -12 - (index % 4) * 8

    return {
      id: index,
      color: palette[index % palette.length],
      left,
      top,
      size,
      delay,
      duration,
      driftX,
      driftY,
    }
  })
}

function buildFloatingGhostLogos(categories: CategoryMeta[], count: number): FloatingGhostLogo[] {
  const uniqueCategories = categories.filter(
    (category, index, list) => list.findIndex((entry) => entry.logoPath === category.logoPath) === index,
  )

  if (uniqueCategories.length === 0 || count <= 0) {
    return []
  }

  const sortedCategories = [...uniqueCategories].sort((left, right) => left.key.localeCompare(right.key))
  const slotCount = Math.min(count, sortedCategories.length)

  return Array.from({ length: slotCount }, (_, index) => {
    const category = sortedCategories[(index * 2 + 1) % sortedCategories.length]
    const left = ((index * 43 + 21) % 86) + 7
    const top = ((index * 31 + 19) % 80) + 10
    const size = 42 + (index % 2) * 12

    return {
      id: `${category.key}-${index}`,
      logoPath: category.logoPath,
      left,
      top,
      size,
      delay: -((index * 2.35) % 13),
      duration: 12 + (index % 3) * 2.4,
      driftX: ((index % 4) - 1.5) * 18,
      driftY: -14 - (index % 3) * 10,
    }
  })
}

export function FloatingSystemLogos({
  categories,
  brandKey,
  gradient,
  themeTokens,
  reducedMotion = false,
}: FloatingSystemLogosProps) {
  const palette = useMemo(
    () => buildGradientPalette(gradient, themeTokens),
    [gradient, themeTokens],
  )

  const dustSpecs = useMemo(() => {
    const count = reducedMotion ? DUST_COUNT_LITE : DUST_COUNT
    return buildFloatingDust(palette, count)
  }, [palette, reducedMotion])

  const ghostLogos = useMemo(() => {
    const count = reducedMotion ? LOGO_COUNT_LITE : LOGO_COUNT
    return buildFloatingGhostLogos(categories, count)
  }, [categories, reducedMotion])

  if (dustSpecs.length === 0 && ghostLogos.length === 0) {
    return null
  }

  return (
    <div
      key={brandKey}
      className="floating-system-ambient"
      aria-hidden="true"
      style={{
        ['--ambient-gradient' as string]: themeTokens.gradientCss,
      }}
    >
      <div className="floating-system-specs">
        {dustSpecs.map((spec) => (
          <span
            key={spec.id}
            className="floating-system-dust"
            style={{
              left: `${spec.left}%`,
              top: `${spec.top}%`,
              width: spec.size,
              height: spec.size,
              backgroundColor: spec.color,
              ['--dust-glow' as string]: spec.color,
              ['--spec-delay' as string]: `${spec.delay}s`,
              ['--spec-duration' as string]: `${spec.duration}s`,
              ['--spec-drift-x' as string]: `${spec.driftX}px`,
              ['--spec-drift-y' as string]: `${spec.driftY}px`,
            }}
          />
        ))}
      </div>
      <div className="floating-system-logos">
        {ghostLogos.map((logo) => (
          <span
            key={logo.id}
            className="floating-system-logo-ghost"
            style={{
              left: `${logo.left}%`,
              top: `${logo.top}%`,
              width: logo.size,
              height: logo.size,
              ['--spec-delay' as string]: `${logo.delay}s`,
              ['--spec-duration' as string]: `${logo.duration}s`,
              ['--spec-drift-x' as string]: `${logo.driftX}px`,
              ['--spec-drift-y' as string]: `${logo.driftY}px`,
            }}
          >
            <img src={logo.logoPath} alt="" draggable={false} decoding="async" />
          </span>
        ))}
      </div>
    </div>
  )
}