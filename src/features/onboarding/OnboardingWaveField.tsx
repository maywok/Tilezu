import { useEffect, useRef } from 'react'

type WaveFieldProps = {
  theme: OnboardingWaveTheme
  reducedMotion: boolean
}

type RGB = [number, number, number]

export type OnboardingWaveTheme = {
  waveA: RGB
  waveB: RGB
  glow: RGB
}

type WaveLine = {
  yBase: number
  amplitudeA: number
  amplitudeB: number
  frequencyA: number
  frequencyB: number
  speedA: number
  speedB: number
  phaseA: number
  phaseB: number
  driftAmplitude: number
  driftSpeed: number
  thickness: number
  tintMix: number
  glowBlur: number
}

function clonePalette(source: OnboardingWaveTheme): OnboardingWaveTheme {
  return {
    waveA: [...source.waveA] as RGB,
    waveB: [...source.waveB] as RGB,
    glow: [...source.glow] as RGB,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

function lerpRgb(from: RGB, to: RGB, amount: number): RGB {
  return [
    lerp(from[0], to[0], amount),
    lerp(from[1], to[1], amount),
    lerp(from[2], to[2], amount),
  ]
}

function mixRgb(a: RGB, b: RGB, amount: number): RGB {
  const clamped = clamp01(amount)
  return [
    a[0] + (b[0] - a[0]) * clamped,
    a[1] + (b[1] - a[1]) * clamped,
    a[2] + (b[2] - a[2]) * clamped,
  ]
}

function toCssRgba(rgb: RGB, alpha: number): string {
  const [r, g, b] = rgb
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}

function createWaveLines(height: number): WaveLine[] {
  const lineCount = Math.max(5, Math.min(6, Math.round(height / 180)))
  const gap = height / (lineCount + 1)

  return Array.from({ length: lineCount }, (_, index) => {
    const jitter = (Math.random() - 0.5) * gap * 0.42

    return {
      yBase: gap * (index + 1) + jitter,
      amplitudeA: 18 + Math.random() * 24,
      amplitudeB: 6 + Math.random() * 12,
      frequencyA: 0.0048 + Math.random() * 0.0044,
      frequencyB: 0.0078 + Math.random() * 0.0054,
      speedA: 0.0002 + Math.random() * 0.00036,
      speedB: 0.00016 + Math.random() * 0.0003,
      phaseA: Math.random() * Math.PI * 2,
      phaseB: Math.random() * Math.PI * 2,
      driftAmplitude: 6 + Math.random() * 11,
      driftSpeed: 0.00006 + Math.random() * 0.00016,
      thickness: 14 + Math.random() * 10,
      tintMix: Math.random(),
      glowBlur: 12 + Math.random() * 14,
    }
  })
}

export function OnboardingWaveField({ theme, reducedMotion }: WaveFieldProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawFrameRef = useRef<((time: number) => void) | null>(null)
  const targetPaletteRef = useRef<OnboardingWaveTheme>(clonePalette(theme))
  const activePaletteRef = useRef<OnboardingWaveTheme>(clonePalette(theme))

  useEffect(() => {
    targetPaletteRef.current = clonePalette(theme)

    if (reducedMotion) {
      activePaletteRef.current = clonePalette(targetPaletteRef.current)
      drawFrameRef.current?.(performance.now())
    }
  }, [reducedMotion, theme])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    let animationFrameId = 0
    let width = 0
    let height = 0
    let lines = createWaveLines(720)

    const render = (time: number) => {
      if (width <= 0 || height <= 0) {
        return
      }

      if (!reducedMotion) {
        const target = targetPaletteRef.current
        const active = activePaletteRef.current

        active.waveA = lerpRgb(active.waveA, target.waveA, 0.1)
        active.waveB = lerpRgb(active.waveB, target.waveB, 0.1)
        active.glow = lerpRgb(active.glow, target.glow, 0.1)
      }

      const palette = activePaletteRef.current
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        const normalizedIndex = index / Math.max(1, lines.length - 1)
        const tintPhase = Math.sin(time * 0.0005 + line.phaseA) * 0.06
        const tint = clamp01(0.14 + normalizedIndex * 0.68 + line.tintMix * 0.08 + tintPhase)
        const strokeRgb = mixRgb(palette.waveA, palette.waveB, tint)
        const highlightRgb = mixRgb([255, 246, 252], strokeRgb, 0.52)

        const drift = Math.sin(time * line.driftSpeed + line.phaseB) * line.driftAmplitude
        const waveTimeA = time * line.speedA + line.phaseA
        const waveTimeB = time * line.speedB + line.phaseB

        ctx.beginPath()

        const startX = -84
        const endX = width + 84
        const xStep = 14

        for (let x = startX; x <= endX; x += xStep) {
          const y =
            line.yBase +
            drift +
            Math.sin(x * line.frequencyA + waveTimeA) * line.amplitudeA +
            Math.sin(x * line.frequencyB - waveTimeB) * line.amplitudeB

          if (x === startX) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        ctx.lineWidth = line.thickness
        ctx.globalAlpha = 0.98
        ctx.shadowColor = toCssRgba(palette.glow, 0.68)
        ctx.shadowBlur = line.glowBlur
        ctx.strokeStyle = toCssRgba(strokeRgb, 0.98)
        ctx.stroke()

        ctx.shadowBlur = 0
        ctx.globalAlpha = 0.42
        ctx.lineWidth = Math.max(1.4, line.thickness * 0.24)
        ctx.strokeStyle = toCssRgba(highlightRgb, 0.56)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      ctx.shadowColor = 'rgba(0, 0, 0, 0)'
    }

    drawFrameRef.current = render

    const resize = () => {
      const rect = host.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lines = createWaveLines(height)
      render(performance.now())
    }

    const step = (time: number) => {
      render(time)
      animationFrameId = window.requestAnimationFrame(step)
    }

    resize()

    const supportsResizeObserver = typeof ResizeObserver !== 'undefined'
    const resizeObserver = supportsResizeObserver ? new ResizeObserver(resize) : null
    resizeObserver?.observe(host)

    if (!supportsResizeObserver) {
      window.addEventListener('resize', resize)
    }

    if (!reducedMotion) {
      animationFrameId = window.requestAnimationFrame(step)
    }

    return () => {
      drawFrameRef.current = null
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver?.disconnect()
      if (!supportsResizeObserver) {
        window.removeEventListener('resize', resize)
      }
    }
  }, [reducedMotion])

  return (
    <div className="onboarding-wavefield" ref={hostRef} aria-hidden="true">
      <canvas className="onboarding-wave-canvas" ref={canvasRef} />
    </div>
  )
}
