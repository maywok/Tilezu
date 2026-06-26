import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'

import styles from './SystemCard.module.css'
import { getCachedSystemCollageUrl, resolveSystemCollageUrl } from './systemCollageCache'

type SystemCardProps = {
  className?: string
  style?: CSSProperties
  label: string
  logoPath: string
  systemKey?: string
  shortLabel: string
  disableCollage?: boolean
  collageOverrideDataUrl?: string
  hideLogo?: boolean
  useNativeLogoColors?: boolean
}

function shouldUseMonogramFallback(_logoPath: string): boolean {
  return false
}

function cleanShortLabel(value: string): string {
  const match = value.trim().match(/[A-Za-z0-9]/)
  if (!match) {
    return ''
  }

  return match[0].toUpperCase()
}

function fallbackFromLabel(label: string): string {
  const match = label.trim().match(/[A-Za-z0-9]/)
  if (!match) {
    return 'S'
  }

  return match[0].toUpperCase()
}

function isLogoRenderable(image: HTMLImageElement): boolean {
  const sourcePath = (image.currentSrc || image.src || '').toLowerCase()
  if (sourcePath.endsWith('.svg')) {
    return true
  }

  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return false
  }

  // Treat tiny placeholder images as missing so initials remain visible.
  return width >= 16 && height >= 16
}

type Rgb = {
  r: number
  g: number
  b: number
}

function parseHexColor(value: string): Rgb | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match?.[1]) {
    return null
  }

  const raw = match[1]
  const expanded = raw.length === 3
    ? raw.split('').map((channel) => channel + channel).join('')
    : raw

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) {
    return null
  }

  return { r: red, g: green, b: blue }
}

function parseRgbFunctionColor(value: string): Rgb | null {
  const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim())
  if (!match?.[1]) {
    return null
  }

  const channels = match[1]
    .split(',')
    .map((part) => Number.parseFloat(part.trim()))

  if (channels.length < 3) {
    return null
  }

  const red = channels[0]
  const green = channels[1]
  const blue = channels[2]

  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) {
    return null
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(red))),
    g: Math.max(0, Math.min(255, Math.round(green))),
    b: Math.max(0, Math.min(255, Math.round(blue))),
  }
}

function extractCssColors(value: string): Rgb[] {
  const colors: Rgb[] = []

  const hexMatches = value.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi) ?? []
  for (const hex of hexMatches) {
    const parsed = parseHexColor(hex)
    if (parsed) {
      colors.push(parsed)
    }
  }

  const rgbMatches = value.match(/rgba?\([^)]*\)/gi) ?? []
  for (const rgbValue of rgbMatches) {
    const parsed = parseRgbFunctionColor(rgbValue)
    if (parsed) {
      colors.push(parsed)
    }
  }

  return colors
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

function contrastRatioWithWhite(color: Rgb): number {
  const luminance = relativeLuminance(color)
  return 1.05 / (luminance + 0.05)
}

function isLowContrastGradient(gradientCss: string): boolean {
  const colors = extractCssColors(gradientCss)
  if (colors.length === 0) {
    return false
  }

  const luminanceValues = colors.map((color) => relativeLuminance(color))
  const averageLuminance = luminanceValues.reduce((sum, value) => sum + value, 0) / luminanceValues.length
  const brightestLuminance = Math.max(...luminanceValues)
  const weakestContrastToWhite = Math.min(...colors.map((color) => contrastRatioWithWhite(color)))

  return averageLuminance > 0.66 || brightestLuminance > 0.84 || weakestContrastToWhite < 1.95
}

export function SystemCard({
  className,
  style,
  label,
  logoPath,
  systemKey,
  shortLabel,
  disableCollage = false,
  collageOverrideDataUrl,
  hideLogo = false,
  useNativeLogoColors = false,
}: SystemCardProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const safeLogoPath = logoPath.trim()
  const hasLogo = !hideLogo && safeLogoPath.length > 0 && !shouldUseMonogramFallback(safeLogoPath)
  const variantClassName = hasLogo ? 'system-card-has-logo' : 'system-card-no-logo'
  const [showFallback, setShowFallback] = useState(!hasLogo && !hideLogo)
  const [collagePath, setCollagePath] = useState<string | null>(null)
  const [isLogoLowContrast, setIsLogoLowContrast] = useState(false)

  const rootClassName = [
    styles.root,
    className,
    variantClassName,
    isLogoLowContrast ? 'is-logo-low-contrast' : null,
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    setShowFallback(!hasLogo && !hideLogo)
  }, [hasLogo, hideLogo, safeLogoPath])

  useEffect(() => {
    let canceled = false

    async function resolveCollagePath(): Promise<void> {
      const overrideCollage = collageOverrideDataUrl?.trim() ?? ''
      if (overrideCollage) {
        setCollagePath(overrideCollage)
        return
      }

      if (!hasLogo || disableCollage) {
        setCollagePath(null)
        return
      }

      const cachedCollage = getCachedSystemCollageUrl(systemKey)
      if (cachedCollage !== undefined) {
        setCollagePath(cachedCollage)
        return
      }

      const resolvedCollage = await resolveSystemCollageUrl(systemKey)
      if (!canceled) {
        setCollagePath(resolvedCollage)
      }
    }

    void resolveCollagePath()

    return () => {
      canceled = true
    }
  }, [collageOverrideDataUrl, disableCollage, hasLogo, systemKey])

  useEffect(() => {
    if (!hasLogo || showFallback) {
      setIsLogoLowContrast(false)
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const rootElement = rootRef.current
    if (!rootElement) {
      return
    }

    const tone = document.body.dataset.tmTone
    if (tone === 'dark') {
      setIsLogoLowContrast(false)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const computedStyle = window.getComputedStyle(rootElement)
      const contrastFlag = Number.parseFloat(computedStyle.getPropertyValue('--tm-logo-low-contrast-light').trim())
      if (Number.isFinite(contrastFlag) && contrastFlag >= 0.5) {
        setIsLogoLowContrast(true)
        return
      }

      const logoGradient = computedStyle.getPropertyValue('--tm-logo-brand-bg').trim()
      const brandGradient = computedStyle.getPropertyValue('--brand-bg').trim()
      const gradientSource = logoGradient || brandGradient

      setIsLogoLowContrast(isLowContrastGradient(gradientSource))
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [hasLogo, showFallback, style, systemKey, collagePath])

  const logoBrandBackground = typeof (style as Record<string, string | number | undefined>)?.['--tm-logo-brand-bg'] === 'string'
    ? (style as Record<string, string>)['--tm-logo-brand-bg']
    : typeof (style as Record<string, string | number | undefined>)?.['--brand-bg'] === 'string'
      ? (style as Record<string, string>)['--brand-bg']
      : ''
  const logoMaskGradientStyle: CSSProperties | undefined = logoBrandBackground
    ? ({
        background: logoBrandBackground,
        backgroundBlendMode: 'normal',
      } as CSSProperties)
    : undefined

  const fallbackLabel = cleanShortLabel(shortLabel) || fallbackFromLabel(label)
  const logoMaskStyle: CSSProperties = {
    opacity: showFallback ? 0 : 1,
    '--tm-logo-mask-url': `url("${safeLogoPath}")`,
    ...logoMaskGradientStyle,
  } as CSSProperties
  const collageStyle: CSSProperties | undefined = collagePath
    ? ({
        '--tm-collage-url': `url("${collagePath}")`,
      } as CSSProperties)
    : undefined

  return (
    <span className={rootClassName} ref={rootRef} style={style}>
      {collagePath && (
        <span
          className="category-collage-backdrop"
          aria-hidden="true"
          style={collageStyle}
        />
      )}
      {hasLogo ? (
        useNativeLogoColors ? (
          <img
            className="category-icon"
            src={safeLogoPath}
            alt={label ? `${label} icon` : ''}
            loading="lazy"
            style={{ opacity: showFallback ? 0 : 1 }}
            onLoad={(event) => {
              if (!isLogoRenderable(event.currentTarget)) {
                event.currentTarget.dataset.error = 'true'
                setShowFallback(true)
                return
              }

              delete event.currentTarget.dataset.error
              setShowFallback(false)
            }}
            onError={(event) => {
              event.currentTarget.dataset.error = 'true'
              setShowFallback(true)
            }}
          />
        ) : (
          <>
            <span
              className="category-icon-stroke"
              aria-hidden="true"
              style={logoMaskStyle}
            />
            <span
              className={`category-icon-mask ${styles.logo}`}
              aria-hidden="true"
              style={logoMaskStyle}
            />
            <img
              className="category-icon category-icon-probe"
              src={safeLogoPath}
              alt={label ? `${label} icon` : ''}
              loading="lazy"
              onLoad={(event) => {
                if (!isLogoRenderable(event.currentTarget)) {
                  event.currentTarget.dataset.error = 'true'
                  setShowFallback(true)
                  return
                }

                delete event.currentTarget.dataset.error
                setShowFallback(false)
              }}
              onError={(event) => {
                event.currentTarget.dataset.error = 'true'
                setShowFallback(true)
              }}
            />
          </>
        )
      ) : null}
      <span
        className={`category-fallback ${styles.fallback}`}
        aria-hidden={hideLogo || !showFallback}
        style={{ opacity: hideLogo ? 0 : showFallback ? 1 : 0 }}
      >
        {fallbackLabel}
      </span>
    </span>
  )
}
