import { useMemo } from 'react'
import type { CSSProperties } from 'react'

import type { AppearanceTheme } from '../types'
import { gradientToCss } from '../utils/theme'

interface RuntimeShape {
  key: string
  left: string
  top: string
  size: string
  drift: string
  delay: string
  opacity: string
}

function seededUnit(index: number, offset: number): number {
  const value = Math.sin(index * 51.213 + offset * 37.791) * 10000.9821
  return value - Math.floor(value)
}

function buildShape(index: number): RuntimeShape {
  const left = `${Math.round(4 + seededUnit(index, 1) * 92)}%`
  const top = `${Math.round(8 + seededUnit(index, 2) * 82)}%`
  const size = `${Math.round(16 + seededUnit(index, 3) * 160)}px`
  const drift = `${(8.2 + seededUnit(index, 4) * 13.8).toFixed(2)}s`
  const delay = `${(-seededUnit(index, 5) * 6.4).toFixed(2)}s`
  const opacity = `${(0.1 + seededUnit(index, 6) * 0.38).toFixed(3)}`

  return {
    key: `runtime-shape-${index}`,
    left,
    top,
    size,
    drift,
    delay,
    opacity,
  }
}

interface AppearanceRuntimeBackdropProps {
  theme: AppearanceTheme
}

export function AppearanceRuntimeBackdrop({ theme }: AppearanceRuntimeBackdropProps) {
  const backgroundImage = theme.backgroundImage
  const shapeCount = Math.max(3, Math.round(4 + theme.animation.density * 12))
  const shapes = useMemo(() => Array.from({ length: shapeCount }, (_, index) => buildShape(index + 1)), [shapeCount])

  const backdropStyle = {
    '--tm-runtime-accent': theme.accentColor,
    '--tm-runtime-highlight': theme.highlightColor,
    '--tm-runtime-gradient': gradientToCss(theme.backgroundGradient),
    '--tm-runtime-speed': `${(0.52 + theme.animation.speed * 1.4).toFixed(3)}`,
    '--tm-runtime-density': `${(0.22 + theme.animation.density * 0.78).toFixed(3)}`,
    '--tm-runtime-opacity': `${theme.animation.opacity.toFixed(3)}`,
  } as CSSProperties

  return (
    <div
      className={`appearance-runtime-backdrop animation-${theme.animation.type}${backgroundImage ? ' has-custom-image' : ''}`}
      style={backdropStyle}
      aria-hidden="true"
    >
      {backgroundImage ? (
        <div className="appearance-runtime-image-layer">
          <img
            src={backgroundImage.dataUrl}
            alt=""
            aria-hidden="true"
            style={{
              objectFit: backgroundImage.fit,
              opacity: backgroundImage.opacity,
            }}
          />
        </div>
      ) : null}
      <div className="appearance-runtime-gradient-layer" />
      <div className="appearance-runtime-wave-layer" />
      <div className="appearance-runtime-dot-layer" />
      <div className="appearance-runtime-shape-layer">
        {shapes.map((shape) => {
          const style = {
            '--shape-left': shape.left,
            '--shape-top': shape.top,
            '--shape-size': shape.size,
            '--shape-drift': shape.drift,
            '--shape-delay': shape.delay,
            '--shape-opacity': shape.opacity,
          } as CSSProperties

          return <span key={shape.key} className="appearance-runtime-shape" style={style} />
        })}
      </div>
    </div>
  )
}
