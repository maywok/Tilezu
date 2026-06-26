import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

import type { ThemeGradient, ThemeGradientStop } from '../../appearance/types'
import { gradientToCss, normalizeGradient, normalizeHexColor } from '../../appearance/utils/theme'
import type { LauncherCategory } from '../types'
import {
  createRandomSystemGradient,
  deriveSystemGradientThemeTokens,
  getDefaultSystemGradient,
  getDefaultSystemGradientAnimation,
  normalizeSystemGradientAnimationSettings,
  type SystemGradientAnimationSettings,
} from '../utils/systemGradient'

interface SystemGradientDialogProps {
  isOpen: boolean
  systemKey: LauncherCategory | null
  systemLabel: string
  systemShort: string
  logoPath: string
  initialGradient: ThemeGradient | null
  initialAnimation: SystemGradientAnimationSettings | null
  initialLogoBorder: boolean
  onClose: () => void
  onSave: (
    systemKey: LauncherCategory,
    gradient: ThemeGradient,
    animation: SystemGradientAnimationSettings,
    logoBorder: boolean,
  ) => void
  onReset: (systemKey: LauncherCategory) => void
}

type PresetOption = {
  id: string
  label: string
  gradient: ThemeGradient
}

const LINEAR_DIRECTION_OPTIONS = [
  { value: '135deg', label: 'Diagonal' },
  { value: '90deg', label: 'Horizontal' },
  { value: '180deg', label: 'Vertical' },
  { value: '45deg', label: 'Reverse Diagonal' },
  { value: '155deg', label: 'Soft Tilt' },
]

const RADIAL_DIRECTION_OPTIONS = [
  { value: 'circle at center', label: 'Center' },
  { value: 'circle at top', label: 'Top' },
  { value: 'circle at bottom right', label: 'Bottom Right' },
  { value: 'circle at left center', label: 'Left Edge' },
]

const PRESET_PALETTE: PresetOption[] = [
  {
    id: 'sunset-pop',
    label: 'Sunset Pop',
    gradient: {
      kind: 'linear',
      direction: '145deg',
      stops: [
        { color: '#ff7c7a', position: 0 },
        { color: '#ffb072', position: 46 },
        { color: '#ffd57a', position: 100 },
      ],
    },
  },
  {
    id: 'cosmic-soda',
    label: 'Cosmic Soda',
    gradient: {
      kind: 'linear',
      direction: '140deg',
      stops: [
        { color: '#6e72ff', position: 0 },
        { color: '#8f7fff', position: 48 },
        { color: '#e37ac7', position: 100 },
      ],
    },
  },
  {
    id: 'aurora-ice',
    label: 'Aurora Ice',
    gradient: {
      kind: 'linear',
      direction: '150deg',
      stops: [
        { color: '#76b6ff', position: 0 },
        { color: '#7fe3d5', position: 50 },
        { color: '#93f4af', position: 100 },
      ],
    },
  },
  {
    id: 'midnight-glass',
    label: 'Midnight Glass',
    gradient: {
      kind: 'linear',
      direction: '150deg',
      stops: [
        { color: '#273a61', position: 0 },
        { color: '#324f83', position: 52 },
        { color: '#4e6eaa', position: 100 },
      ],
    },
  },
  {
    id: 'soft-prism',
    label: 'Soft Prism',
    gradient: {
      kind: 'radial',
      direction: 'circle at top',
      stops: [
        { color: '#ffa9d2', position: 0 },
        { color: '#8ad3ff', position: 52 },
        { color: '#94f3cb', position: 100 },
      ],
    },
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toMonogram(value: string, fallback = 'S'): string {
  const match = value.trim().match(/[A-Za-z0-9]/)
  return match ? match[0].toUpperCase() : fallback
}

function splitGradientArgs(raw: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''

  for (const character of raw) {
    if (character === '(') {
      depth += 1
      current += character
      continue
    }

    if (character === ')') {
      depth = Math.max(0, depth - 1)
      current += character
      continue
    }

    if (character === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }

    current += character
  }

  if (current.trim().length > 0) {
    parts.push(current.trim())
  }

  return parts
}

function parseGradientCss(input: string): ThemeGradient | null {
  const match = input.trim().match(/^(linear|radial)-gradient\((.+)\)$/i)
  if (!match?.[1] || !match[2]) {
    return null
  }

  const kind = match[1].toLowerCase() === 'radial' ? 'radial' : 'linear'
  const args = splitGradientArgs(match[2])
  if (args.length < 3) {
    return null
  }

  const direction = args[0]
  const stops: ThemeGradientStop[] = []

  for (const stopText of args.slice(1)) {
    const stopMatch = stopText.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)%$/)
    if (!stopMatch?.[1] || !stopMatch[2]) {
      return null
    }

    const color = normalizeHexColor(stopMatch[1].trim(), '')
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      return null
    }

    const position = Number(stopMatch[2])
    if (!Number.isFinite(position)) {
      return null
    }

    stops.push({
      color,
      position: clamp(position, 0, 100),
    })
  }

  if (stops.length < 2) {
    return null
  }

  return normalizeGradient({ kind, direction, stops })
}

type ImportedGradientPayload = {
  gradient: ThemeGradient
  animation: SystemGradientAnimationSettings | null
}

function parseGradientCandidate(value: unknown): ThemeGradient | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<ThemeGradient>
  if (!Array.isArray(candidate.stops) || typeof candidate.direction !== 'string') {
    return null
  }

  return normalizeGradient({
    kind: candidate.kind === 'radial' ? 'radial' : 'linear',
    direction: candidate.direction,
    stops: candidate.stops.map((stop) => {
      const nextStop = stop as Partial<ThemeGradientStop>
      const parsedPosition = Number(nextStop.position ?? 0)
      return {
        color: normalizeHexColor(typeof nextStop.color === 'string' ? nextStop.color : '#79b5f8', '#79b5f8'),
        position: Number.isFinite(parsedPosition) ? clamp(parsedPosition, 0, 100) : 0,
      }
    }),
  })
}

function parseImportedGradient(raw: string): ImportedGradientPayload | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as {
        gradient?: unknown
        animation?: Partial<SystemGradientAnimationSettings>
      }

      const nestedGradient = parseGradientCandidate(record.gradient)
      if (nestedGradient) {
        return {
          gradient: nestedGradient,
          animation: record.animation
            ? normalizeSystemGradientAnimationSettings(record.animation)
            : null,
        }
      }

      const directGradient = parseGradientCandidate(parsed)
      if (directGradient) {
        return {
          gradient: directGradient,
          animation: null,
        }
      }
    }
  } catch {
    // Continue and attempt CSS parse below.
  }

  const cssGradient = parseGradientCss(trimmed)
  if (!cssGradient) {
    return null
  }

  return {
    gradient: cssGradient,
    animation: null,
  }
}

type Rgb = { r: number; g: number; b: number }

function parseHexColor(value: string): Rgb | null {
  const hex = normalizeHexColor(value, '')
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match?.[1]) {
    return null
  }

  const channels = match[1]
  return {
    r: Number.parseInt(channels.slice(0, 2), 16),
    g: Number.parseInt(channels.slice(2, 4), 16),
    b: Number.parseInt(channels.slice(4, 6), 16),
  }
}

function relativeLuminance(color: Rgb): number {
  const toLinear = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  const r = toLinear(color.r)
  const g = toLinear(color.g)
  const b = toLinear(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatioHex(colorA: string, colorB: string): number {
  const rgbA = parseHexColor(colorA)
  const rgbB = parseHexColor(colorB)
  if (!rgbA || !rgbB) {
    return 21
  }

  const luminanceA = relativeLuminance(rgbA)
  const luminanceB = relativeLuminance(rgbB)
  const light = Math.max(luminanceA, luminanceB)
  const dark = Math.min(luminanceA, luminanceB)
  return (light + 0.05) / (dark + 0.05)
}

function analyzeContrastWarnings(gradient: ThemeGradient): string[] {
  const normalized = normalizeGradient(gradient)
  const stopColors = normalized.stops.map((stop) => stop.color)

  if (stopColors.length === 0) {
    return []
  }

  const lightText = '#eef6ff'
  const darkText = '#13243d'

  const perStopBestContrast = stopColors.map((color) => {
    const lightRatio = contrastRatioHex(color, lightText)
    const darkRatio = contrastRatioHex(color, darkText)
    return Math.max(lightRatio, darkRatio)
  })

  const worstBestContrast = Math.min(...perStopBestContrast)
  const averageBestContrast = perStopBestContrast.reduce((sum, value) => sum + value, 0) / perStopBestContrast.length

  const warnings: string[] = []

  if (worstBestContrast < 2.8) {
    warnings.push('Low contrast risk: some gradient areas may hide icons or labels.')
  } else if (worstBestContrast < 3.6 || averageBestContrast < 4.2) {
    warnings.push('Contrast caution: consider adding lighter or darker stops for readability.')
  }

  return warnings
}

export function SystemGradientDialog({
  isOpen,
  systemKey,
  systemLabel,
  systemShort,
  logoPath,
  initialGradient,
  initialAnimation,
  initialLogoBorder,
  onClose,
  onSave,
  onReset,
}: SystemGradientDialogProps) {
  const systemMonogram = useMemo(() => toMonogram(systemShort, toMonogram(systemLabel, 'S')), [systemLabel, systemShort])
  const [draftGradient, setDraftGradient] = useState<ThemeGradient>(() => normalizeGradient(initialGradient ?? getDefaultSystemGradient('all')))
  const [draftAnimation, setDraftAnimation] = useState<SystemGradientAnimationSettings>(() =>
    normalizeSystemGradientAnimationSettings(initialAnimation ?? getDefaultSystemGradientAnimation()),
  )
  const [draftLogoBorder, setDraftLogoBorder] = useState(initialLogoBorder)
  const [isPreviewAnimationEnabled, setIsPreviewAnimationEnabled] = useState(true)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [selectedStopIndex, setSelectedStopIndex] = useState(0)
  const [draggingStopIndex, setDraggingStopIndex] = useState<number | null>(null)
  const [isDragRemoveCandidate, setIsDragRemoveCandidate] = useState(false)
  const [isRandomizeAnimating, setIsRandomizeAnimating] = useState(false)
  const [stopFeedbackPulse, setStopFeedbackPulse] = useState(0)
  const [status, setStatus] = useState('')

  const railRef = useRef<HTMLDivElement | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const dragRemoveRef = useRef(false)
  const dragFrameRef = useRef<number | null>(null)
  const pendingDragPositionRef = useRef<number | null>(null)
  const randomizeTimerRef = useRef<number | null>(null)

  const presets = useMemo<PresetOption[]>(() => {
    const systemDefault = normalizeGradient(systemKey ? getDefaultSystemGradient(systemKey) : getDefaultSystemGradient('all'))
    return [
      {
        id: 'system-default',
        label: 'System Default',
        gradient: systemDefault,
      },
      ...PRESET_PALETTE.map((preset) => ({
        ...preset,
        gradient: normalizeGradient(preset.gradient),
      })),
    ]
  }, [systemKey])

  useEffect(() => {
    if (!isOpen || !systemKey) {
      return
    }

    const nextGradient = normalizeGradient(initialGradient ?? getDefaultSystemGradient(systemKey))
    const nextAnimation = normalizeSystemGradientAnimationSettings(initialAnimation ?? getDefaultSystemGradientAnimation())

    setDraftGradient(nextGradient)
    setDraftAnimation(nextAnimation)
    setDraftLogoBorder(initialLogoBorder)
    setIsPreviewAnimationEnabled(true)
    setSelectedStopIndex(0)
    setDraggingStopIndex(null)
    setIsDragRemoveCandidate(false)
    setIsRandomizeAnimating(false)
    setStopFeedbackPulse(0)
    setStatus('')
    setSelectedPresetId(initialGradient ? 'custom' : 'system-default')
    setIsCustomMode(Boolean(initialGradient))

    dragIndexRef.current = null
    dragRemoveRef.current = false
    pendingDragPositionRef.current = null
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }

    if (randomizeTimerRef.current !== null) {
      window.clearTimeout(randomizeTimerRef.current)
      randomizeTimerRef.current = null
    }
  }, [isOpen, systemKey, initialGradient, initialAnimation])

  useEffect(() => () => {
    if (randomizeTimerRef.current !== null) {
      window.clearTimeout(randomizeTimerRef.current)
      randomizeTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (draggingStopIndex === null) {
      return
    }

    const commitPendingDragPosition = () => {
      const activeIndex = dragIndexRef.current
      const nextPosition = pendingDragPositionRef.current
      pendingDragPositionRef.current = null

      if (activeIndex === null || nextPosition === null) {
        return
      }

      setDraftGradient((previous) => {
        const normalized = normalizeGradient(previous)
        const currentStop = normalized.stops[activeIndex]
        if (!currentStop) {
          return normalized
        }

        const roundedCurrentPosition = Math.round(currentStop.position)
        if (roundedCurrentPosition === nextPosition) {
          return normalized
        }

        const nextStops = normalized.stops.map((stop, index) => {
          if (index !== activeIndex) {
            return stop
          }

          return {
            ...stop,
            position: nextPosition,
          }
        })

        return normalizeGradient({
          ...normalized,
          stops: nextStops,
        })
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rail = railRef.current
      const activeIndex = dragIndexRef.current
      if (!rail || activeIndex === null) {
        return
      }

      const rect = rail.getBoundingClientRect()
      if (!rect.width) {
        return
      }

      const nextPosition = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
      const outsideBounds =
        event.clientY < rect.top - 34 ||
        event.clientY > rect.bottom + 34 ||
        event.clientX < rect.left - 26 ||
        event.clientX > rect.right + 26

      dragRemoveRef.current = outsideBounds
      pendingDragPositionRef.current = Math.round(nextPosition)
      setIsDragRemoveCandidate((previous) => (previous === outsideBounds ? previous : outsideBounds))

      if (dragFrameRef.current !== null) {
        return
      }

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null
        commitPendingDragPosition()
      })
    }

    const completeDrag = () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }

      commitPendingDragPosition()

      const activeIndex = dragIndexRef.current
      if (activeIndex !== null && dragRemoveRef.current) {
        setDraftGradient((previous) => {
          const normalized = normalizeGradient(previous)
          if (normalized.stops.length <= 2) {
            return normalized
          }

          const nextStops = normalized.stops.filter((_, index) => index !== activeIndex)
          return normalizeGradient({
            ...normalized,
            stops: nextStops,
          })
        })

        setStopFeedbackPulse((previous) => previous + 1)
        setStatus('Removed color stop from drag-off gesture.')
      }

      dragIndexRef.current = null
      dragRemoveRef.current = false
      pendingDragPositionRef.current = null
      setDraggingStopIndex(null)
      setIsDragRemoveCandidate(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', completeDrag)
    window.addEventListener('pointercancel', completeDrag)

    return () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', completeDrag)
      window.removeEventListener('pointercancel', completeDrag)
    }
  }, [draggingStopIndex])

  const activeStopIndex = draftGradient.stops.length > 0
    ? clamp(selectedStopIndex, 0, draftGradient.stops.length - 1)
    : 0

  const directionOptions = draftGradient.kind === 'linear' ? LINEAR_DIRECTION_OPTIONS : RADIAL_DIRECTION_OPTIONS

  const previewGradient = useMemo<ThemeGradient>(() => {
    try {
      return normalizeGradient(draftGradient)
    } catch {
      return normalizeGradient(getDefaultSystemGradient(systemKey ?? 'all'))
    }
  }, [draftGradient, systemKey])

  const cssExport = useMemo(() => gradientToCss(previewGradient), [previewGradient])
  const contrastWarnings = useMemo(() => analyzeContrastWarnings(previewGradient), [previewGradient])
  const normalizedAnimation = useMemo(
    () => normalizeSystemGradientAnimationSettings(draftAnimation),
    [draftAnimation],
  )
  const previewThemeTokens = useMemo(
    () => deriveSystemGradientThemeTokens(previewGradient),
    [previewGradient],
  )

  const previewStyle = useMemo(() => {
    const firstColor = previewGradient.stops[0]?.color ?? '#8ec4ff'
    const midColor = previewGradient.stops[Math.floor(previewGradient.stops.length / 2)]?.color ?? '#7faef1'
    const lastColor = previewGradient.stops[previewGradient.stops.length - 1]?.color ?? '#e78ab8'
    const speed = Math.max(0.35, normalizedAnimation.speed)
    const previewShouldAnimate = normalizedAnimation.enabled && isPreviewAnimationEnabled

    return {
      '--system-gradient-wave-a': firstColor,
      '--system-gradient-wave-b': midColor,
      '--system-gradient-wave-c': lastColor,
      '--system-gradient-accent-start': firstColor,
      '--system-gradient-accent-mid': midColor,
      '--system-gradient-accent-end': lastColor,
      '--system-gradient-accent-gradient': cssExport,
      '--brand-bg': previewThemeTokens.brandBackground,
      '--corner-bg': previewThemeTokens.cornerBackground,
      '--brand-border': previewThemeTokens.borderColor,
      '--active-ring': previewThemeTokens.ringColor,
      '--active-glow': previewThemeTokens.glowColor,
      '--flat-border-color': previewThemeTokens.flatBorderColor,
      '--flat-border-color-strong': previewThemeTokens.flatBorderColorStrong,
      '--flat-secondary-color': previewThemeTokens.flatSecondaryColor,
      '--flat-border-spin-color-a': previewThemeTokens.flatBorderSpinColorA,
      '--flat-border-spin-color-b': previewThemeTokens.flatBorderSpinColorB,
      '--flat-icon-border-gradient': previewThemeTokens.flatIconBorderGradient,
      '--flat-icon-fill-gradient': previewThemeTokens.flatIconFillGradient,
      '--flat-border-spin-idle-duration': `${(58 / speed).toFixed(2)}s`,
      '--flat-border-spin-hover-duration': `${(30 / speed).toFixed(2)}s`,
      '--flat-border-spin-focus-duration': `${(16 / speed).toFixed(2)}s`,
      '--tm-flat-spin-direction': normalizedAnimation.direction === 'counterclockwise' ? 'reverse' : 'normal',
      '--tm-flat-spin-play-state': previewShouldAnimate ? 'running' : 'paused',
    } as CSSProperties
  }, [previewGradient, normalizedAnimation, isPreviewAnimationEnabled, previewThemeTokens, cssExport])

  const stylusPosition = useMemo(() => {
    const index = draggingStopIndex ?? activeStopIndex
    const fallback = draftGradient.stops[activeStopIndex]?.position ?? 50
    const value = draftGradient.stops[index]?.position ?? fallback
    return clamp(Math.round(value), 0, 100)
  }, [draggingStopIndex, activeStopIndex, draftGradient])

  const feedbackClassName = stopFeedbackPulse % 2 === 0 ? 'feedback-a' : 'feedback-b'

  const railClassName = useMemo(() => {
    return [
      'system-gradient-rail',
      isDragRemoveCandidate ? 'is-remove-target' : '',
      draggingStopIndex !== null ? 'is-dragging-stop' : '',
      isRandomizeAnimating ? 'is-shuffling' : '',
      feedbackClassName,
    ].filter(Boolean).join(' ')
  }, [isDragRemoveCandidate, draggingStopIndex, isRandomizeAnimating, feedbackClassName])

  const railStyle = useMemo(
    () => ({
      background: cssExport,
      '--system-gradient-stylus-x': `${stylusPosition}%`,
    }) as CSSProperties,
    [cssExport, stylusPosition],
  )

  const triggerStopFeedback = () => {
    setStopFeedbackPulse((previous) => previous + 1)
  }

  const setStopColor = (index: number, color: string) => {
    setDraftGradient((previous) => {
      const normalized = normalizeGradient(previous)
      const nextStops = normalized.stops.map((stop, stopIndex) => {
        if (stopIndex !== index) {
          return stop
        }

        return {
          ...stop,
          color: normalizeHexColor(color, stop.color),
        }
      })

      return normalizeGradient({
        ...normalized,
        stops: nextStops,
      })
    })

    triggerStopFeedback()
  }

  const setStopPosition = (index: number, position: number) => {
    setDraftGradient((previous) => {
      const normalized = normalizeGradient(previous)
      const nextStops = normalized.stops.map((stop, stopIndex) => {
        if (stopIndex !== index) {
          return stop
        }

        return {
          ...stop,
          position: clamp(position, 0, 100),
        }
      })

      return normalizeGradient({
        ...normalized,
        stops: nextStops,
      })
    })
  }

  const addStopAtPosition = (position: number, baseColor?: string) => {
    setSelectedPresetId('custom')
    setIsCustomMode(true)

    setDraftGradient((previous) => {
      const normalized = normalizeGradient(previous)
      if (normalized.stops.length >= 7) {
        return normalized
      }

      const fallbackColor = baseColor
        ?? normalized.stops[activeStopIndex]?.color
        ?? normalized.stops[normalized.stops.length - 1]?.color
        ?? '#8ec4ff'

      const nextStops = [...normalized.stops, {
        color: normalizeHexColor(fallbackColor, '#8ec4ff'),
        position: clamp(Math.round(position), 0, 100),
      }]

      return normalizeGradient({
        ...normalized,
        stops: nextStops,
      })
    })

    triggerStopFeedback()
  }

  const removeStop = (index: number) => {
    setSelectedPresetId('custom')
    setIsCustomMode(true)

    setDraftGradient((previous) => {
      const normalized = normalizeGradient(previous)
      if (normalized.stops.length <= 2) {
        return normalized
      }

      const nextStops = normalized.stops.filter((_, stopIndex) => stopIndex !== index)
      return normalizeGradient({
        ...normalized,
        stops: nextStops,
      })
    })

    triggerStopFeedback()
  }

  const beginStopDrag = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    setSelectedPresetId('custom')
    setIsCustomMode(true)
    dragIndexRef.current = index
    dragRemoveRef.current = false
    setDraggingStopIndex(index)
    setIsDragRemoveCandidate(false)
    setSelectedStopIndex(index)
  }

  const handleRailPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    const rail = railRef.current
    if (!rail) {
      return
    }

    const rect = rail.getBoundingClientRect()
    if (!rect.width) {
      return
    }

    const position = ((event.clientX - rect.left) / rect.width) * 100
    addStopAtPosition(position)
    setStatus('Added color stop.')
  }

  const applyPreset = (preset: PresetOption) => {
    setDraftGradient(normalizeGradient(preset.gradient))
    setSelectedPresetId(preset.id)
    setIsCustomMode(false)
    setStatus(`Applied ${preset.label}.`)
  }

  const randomizeGradient = () => {
    const next = createRandomSystemGradient(Date.now())
    setDraftGradient(next)
    setSelectedPresetId('custom')
    setIsCustomMode(true)
    setIsRandomizeAnimating(true)
    if (randomizeTimerRef.current !== null) {
      window.clearTimeout(randomizeTimerRef.current)
    }
    randomizeTimerRef.current = window.setTimeout(() => {
      setIsRandomizeAnimating(false)
      randomizeTimerRef.current = null
    }, 620)
    setStatus('Randomized gradient.')
  }

  const openImportPicker = () => {
    importFileRef.current?.click()
  }

  const importGradientFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) {
      return
    }

    let fileText = ''
    try {
      fileText = await file.text()
    } catch {
      setStatus('Could not read selected file.')
      event.currentTarget.value = ''
      return
    }

    const parsed = parseImportedGradient(fileText)
    if (!parsed) {
      setStatus('Could not parse selected file. Upload gradient JSON or CSS text.')
      event.currentTarget.value = ''
      return
    }

    setDraftGradient(parsed.gradient)
    if (parsed.animation) {
      setDraftAnimation(parsed.animation)
    }
    setSelectedPresetId('custom')
    setIsCustomMode(true)
    setStatus(parsed.animation ? `Loaded gradient + animation from ${file.name}.` : `Loaded gradient from ${file.name}.`)
    event.currentTarget.value = ''
  }

  const downloadGradientFile = () => {
    try {
      const payload = JSON.stringify(
        {
          version: 2,
          gradient: normalizeGradient(draftGradient),
          animation: normalizeSystemGradientAnimationSettings(draftAnimation),
        },
        null,
        2,
      )
      const blob = new Blob([payload], { type: 'application/json' })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const safeKey = (systemKey ?? 'system').replace(/[^a-z0-9-]/gi, '-').toLowerCase()

      anchor.href = objectUrl
      anchor.download = `${safeKey}-gradient.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
      }, 0)
      setStatus('Downloaded gradient file.')
    } catch {
      setStatus('Could not download gradient file.')
    }
  }

  const handleSave = () => {
    if (!systemKey) {
      return
    }

    onSave(
      systemKey,
      normalizeGradient(draftGradient),
      normalizeSystemGradientAnimationSettings(draftAnimation),
      draftLogoBorder,
    )
    setStatus('Saved gradient for this system.')
  }

  const handleReset = () => {
    if (!systemKey) {
      return
    }

    onReset(systemKey)
    const fallback = normalizeGradient(getDefaultSystemGradient(systemKey))
    setDraftGradient(fallback)
    setDraftAnimation(getDefaultSystemGradientAnimation())
    setDraftLogoBorder(false)
    setIsPreviewAnimationEnabled(true)
    setSelectedPresetId('system-default')
    setIsCustomMode(false)
    setStatus('Reset this system to default gradient.')
  }

  if (!isOpen || !systemKey) {
    return null
  }

  return createPortal(
    <div
      className="system-gradient-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="system-gradient-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Customize ${systemLabel} gradient`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        style={previewStyle}
      >
        <div className="system-gradient-wave-field" aria-hidden="true">
          <span className="system-gradient-wave wave-a" />
          <span className="system-gradient-wave wave-b" />
          <span className="system-gradient-wave wave-c" />
        </div>

        <header className="system-gradient-modal-head">
          <div>
            <p className="system-gradient-kicker">System Gradient</p>
            <h3>Customize {systemLabel}</h3>
          </div>
          <button
            type="button"
            className="ghost system-gradient-tip-target"
            onClick={onClose}
            aria-label="Close gradient editor"
            data-tip="Done for now? Close the editor."
            title="Close editor"
          >
            Close
          </button>
        </header>

        <div className="system-gradient-modal-layout">
          <div className="system-gradient-editor-column">
            <section className="system-gradient-card system-gradient-card-presets" role="group" aria-label="Gradient presets">
              <div className="system-gradient-card-head">
                <h4>Presets</h4>
                <p>Pick a look, then make it yours.</p>
              </div>

              <div className="system-gradient-preset-row">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={selectedPresetId === preset.id ? 'system-gradient-preset system-gradient-tip-target is-selected' : 'system-gradient-preset system-gradient-tip-target'}
                    onClick={() => applyPreset(preset)}
                    data-tip={`Apply the ${preset.label} vibe.`}
                    title={`Apply ${preset.label}`}
                  >
                    <span className="system-gradient-preset-swatch" style={{ background: gradientToCss(preset.gradient) }} aria-hidden="true" />
                    <span>{preset.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={isCustomMode ? 'system-gradient-preset system-gradient-tip-target custom is-selected' : 'system-gradient-preset system-gradient-tip-target custom'}
                  onClick={() => {
                    setSelectedPresetId('custom')
                    setIsCustomMode(true)
                  }}
                  data-tip="Switch to hand-tuned editing."
                  title="Use custom editing"
                >
                  <span className="system-gradient-preset-swatch custom" aria-hidden="true" />
                  <span>Custom</span>
                </button>
                <button
                  type="button"
                  className={isRandomizeAnimating ? 'system-gradient-preset system-gradient-tip-target randomize is-shuffling' : 'system-gradient-preset system-gradient-tip-target randomize'}
                  onClick={randomizeGradient}
                  data-tip="Shuffle into a fresh colorful combo."
                  title="Randomize gradient"
                >
                  <span className="system-gradient-preset-swatch randomize" aria-hidden="true" />
                  <span>Randomize</span>
                </button>
              </div>
            </section>

            <section className="system-gradient-card system-gradient-card-editor" aria-label="Gradient editor">
              <div className="system-gradient-card-head">
                <h4>Color Playground</h4>
                <p>Drag stops, tweak colors, and shape your blend.</p>
              </div>

              <div className="system-gradient-inline-grid">
                <label className="appearance-field">
                  <span>Gradient shape</span>
                  <select
                    className="system-gradient-tip-target"
                    value={draftGradient.kind}
                    data-tip="Choose linear for flow or radial for a bubble look."
                    title="Pick a gradient shape"
                    onChange={(event) => {
                      try {
                        const nextKind = event.currentTarget.value === 'radial' ? 'radial' : 'linear'
                        const nextDirection = nextKind === 'radial' ? 'circle at center' : '135deg'
                        const nextGradient = normalizeGradient({
                          ...draftGradient,
                          kind: nextKind,
                          direction: nextDirection,
                        })
                        setDraftGradient(nextGradient)
                        setSelectedPresetId('custom')
                        setIsCustomMode(true)
                      } catch {
                        setStatus('Could not change gradient type. Reverting to last safe value.')
                      }
                    }}
                  >
                    <option value="linear">Linear</option>
                    <option value="radial">Radial</option>
                  </select>
                </label>

                <label className="appearance-field">
                  <span>Where should colors flow?</span>
                  <select
                    className="system-gradient-tip-target"
                    value={draftGradient.direction}
                    data-tip="Aim the color flow across the icon border."
                    title="Choose gradient flow direction"
                    onChange={(event) => {
                      try {
                        const nextGradient = normalizeGradient({
                          ...draftGradient,
                          direction: event.currentTarget.value,
                        })
                        setDraftGradient(nextGradient)
                        setSelectedPresetId('custom')
                        setIsCustomMode(true)
                      } catch {
                        setStatus('Could not change gradient direction. Reverting to last safe value.')
                      }
                    }}
                  >
                    {directionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="system-gradient-rail-wrap">
                <p className="system-gradient-rail-note">
                  Drag a stop to paint your blend. Click empty rail to add one. Pull away to remove.
                </p>
                <div
                  ref={railRef}
                  className={railClassName}
                  style={railStyle}
                  onPointerDown={handleRailPointerDown}
                >
                  {draftGradient.stops.map((stop, index) => {
                    const tip = `${stop.color.toUpperCase()} \u2022 ${Math.round(stop.position)}%`
                    return (
                      <button
                        key={`stop-${stop.color}-${stop.position}-${index}`}
                        type="button"
                        className={
                          selectedStopIndex === index
                            ? draggingStopIndex === index
                              ? 'system-gradient-stop-handle is-selected is-dragging'
                              : 'system-gradient-stop-handle is-selected'
                            : draggingStopIndex === index
                              ? 'system-gradient-stop-handle is-dragging'
                              : 'system-gradient-stop-handle'
                        }
                        style={{ left: `${stop.position}%`, backgroundColor: stop.color }}
                        onClick={() => setSelectedStopIndex(index)}
                        onPointerDown={(event) => beginStopDrag(index, event)}
                        data-tip={tip}
                        title={tip}
                        aria-label={`Gradient stop ${index + 1} at ${Math.round(stop.position)} percent`}
                      />
                    )
                  })}
                </div>
              </div>

              <div
                className={feedbackClassName === 'feedback-a' ? 'system-gradient-stop-list feedback-a' : 'system-gradient-stop-list feedback-b'}
                role="group"
                aria-label="Color stop controls"
              >
                {draftGradient.stops.map((stop, index) => {
                  const isSelected = activeStopIndex === index
                  return (
                    <div key={`stop-row-${index}`} className={isSelected ? 'system-gradient-stop-row is-selected' : 'system-gradient-stop-row'}>
                      <div className="system-gradient-stop-row-top">
                        <div className="system-gradient-stop-leading">
                          <button
                            type="button"
                            className={isSelected ? 'system-gradient-stop-chip is-selected' : 'system-gradient-stop-chip'}
                            onClick={() => setSelectedStopIndex(index)}
                            title={`Select color ${index + 1}`}
                          >
                            Color {index + 1}
                          </button>

                          <label className="system-gradient-stop-color-field" title={`Pick color ${index + 1}`}>
                            <span className="sr-only">Pick color for stop {index + 1}</span>
                            <input
                              type="color"
                              value={stop.color}
                              onChange={(event) => {
                                setSelectedStopIndex(index)
                                setStopColor(index, event.currentTarget.value)
                                setSelectedPresetId('custom')
                                setIsCustomMode(true)
                              }}
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          className="system-gradient-stop-remove system-gradient-tip-target"
                          disabled={draftGradient.stops.length <= 2}
                          onClick={() => {
                            removeStop(index)
                            setStatus(`Removed color ${index + 1}.`)
                          }}
                          data-tip={`Remove color ${index + 1}`}
                          title={`Remove color ${index + 1}`}
                          aria-label={`Remove color ${index + 1}`}
                        >
                          <span className="sr-only">Remove color {index + 1}</span>
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M5 7h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M9 7V5.9c0-.6.4-.9 1-.9h4c.6 0 1 .3 1 .9V7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M8 9.3v8.4c0 .7.5 1.3 1.2 1.3h5.6c.7 0 1.2-.6 1.2-1.3V9.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>

                      <div className="system-gradient-stop-row-bottom">
                        <input
                          className="system-gradient-stop-range"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(stop.position)}
                          onChange={(event) => {
                            setSelectedStopIndex(index)
                            setStopPosition(index, Number(event.currentTarget.value))
                            setSelectedPresetId('custom')
                            setIsCustomMode(true)
                          }}
                          title={`Position for color ${index + 1}`}
                        />

                        <label className="system-gradient-stop-number-wrap" title={`Numeric position for color ${index + 1}`}>
                          <span className="sr-only">Position for color {index + 1}</span>
                          <input
                            className="system-gradient-stop-number"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(stop.position)}
                            onChange={(event) => {
                              setSelectedStopIndex(index)
                              setStopPosition(index, Number(event.currentTarget.value))
                              setSelectedPresetId('custom')
                              setIsCustomMode(true)
                            }}
                          />
                          <span>%</span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="system-gradient-card system-gradient-card-animation" aria-label="Animation controls">
              <div className="system-gradient-card-head">
                <h4>Border Motion</h4>
                <p>Tune how your icon border flows and spins.</p>
              </div>

              <div className="system-gradient-toggle-row">
                <button
                  type="button"
                  className={draftLogoBorder ? 'system-gradient-toggle system-gradient-tip-target is-on' : 'system-gradient-toggle system-gradient-tip-target'}
                  data-tip="Show or hide the stroke outline around the system logo."
                  title="Enable or disable logo border"
                  onClick={() => setDraftLogoBorder((previous) => !previous)}
                >
                  {draftLogoBorder ? 'Logo border: On' : 'Logo border: Off'}
                </button>

                <button
                  type="button"
                  className={normalizedAnimation.enabled ? 'system-gradient-toggle system-gradient-tip-target is-on' : 'system-gradient-toggle system-gradient-tip-target'}
                  data-tip="Toggle border animation for this system."
                  title="Enable or disable border motion"
                  onClick={() => {
                    setDraftAnimation((previous) => ({
                      ...previous,
                      enabled: !previous.enabled,
                    }))
                  }}
                >
                  {normalizedAnimation.enabled ? 'Border motion: On' : 'Border motion: Off'}
                </button>

                <button
                  type="button"
                  className={isPreviewAnimationEnabled ? 'system-gradient-toggle system-gradient-tip-target is-on' : 'system-gradient-toggle system-gradient-tip-target'}
                  data-tip="Pause or play only the preview animation."
                  title="Pause or play preview"
                  onClick={() => setIsPreviewAnimationEnabled((previous) => !previous)}
                >
                  {isPreviewAnimationEnabled ? 'Preview motion: On' : 'Preview motion: Off'}
                </button>
              </div>

              <label className="appearance-field compact grow">
                <span>How fast should it spin? ({normalizedAnimation.speed.toFixed(2)}x)</span>
                <input
                  className="system-gradient-tip-target"
                  type="range"
                  min={0.35}
                  max={2.5}
                  step={0.05}
                  value={normalizedAnimation.speed}
                  data-tip="Slide for chill to turbo border speed."
                  title="Adjust border spin speed"
                  onChange={(event) => {
                    setDraftAnimation((previous) => ({
                      ...previous,
                      speed: Number(event.currentTarget.value),
                    }))
                  }}
                />
              </label>

              <div className="system-gradient-speed-row" role="group" aria-label="Quick animation speeds">
                {[0.65, 1, 1.4, 1.9].map((speed) => {
                  const isActive = Math.abs(normalizedAnimation.speed - speed) < 0.03
                  return (
                    <button
                      key={`speed-${speed}`}
                      type="button"
                      className={isActive ? 'system-gradient-speed-chip system-gradient-tip-target is-selected' : 'system-gradient-speed-chip system-gradient-tip-target'}
                      data-tip={`Jump to ${speed.toFixed(2)}x speed.`}
                      title={`Set speed to ${speed.toFixed(2)}x`}
                      onClick={() => {
                        setDraftAnimation((previous) => ({
                          ...previous,
                          speed,
                        }))
                      }}
                    >
                      {speed.toFixed(2)}x
                    </button>
                  )
                })}
              </div>

              <label className="appearance-field">
                <span>Which way should it spin?</span>
                <select
                  className="system-gradient-tip-target"
                  value={normalizedAnimation.direction}
                  data-tip="Swap clockwise or counterclockwise flow."
                  title="Set spin direction"
                  onChange={(event) => {
                    setDraftAnimation((previous) => ({
                      ...previous,
                      direction: event.currentTarget.value === 'counterclockwise' ? 'counterclockwise' : 'clockwise',
                    }))
                  }}
                >
                  <option value="clockwise">Clockwise</option>
                  <option value="counterclockwise">Counterclockwise</option>
                </select>
              </label>
            </section>

            <section className="system-gradient-card system-gradient-transfer-card" role="group" aria-label="Gradient import and export">
              <div className="system-gradient-card-head">
                <h4>Share This Look</h4>
                <p>Download or upload files with gradient and motion settings.</p>
              </div>

              <div className="system-gradient-row-actions">
                <button
                  type="button"
                  className="ghost system-gradient-tip-target"
                  onClick={downloadGradientFile}
                  data-tip="Save your current style to a file."
                  title="Download gradient file"
                >
                  Download File
                </button>
                <button
                  type="button"
                  className="ghost system-gradient-tip-target"
                  onClick={openImportPicker}
                  data-tip="Load a saved style from a file."
                  title="Upload gradient file"
                >
                  Upload File
                </button>
              </div>

              <input
                ref={importFileRef}
                className="system-gradient-file-input"
                type="file"
                accept=".json,.txt,application/json,text/plain"
                onChange={(event) => {
                  void importGradientFile(event)
                }}
              />
            </section>

            {contrastWarnings.length > 0 && (
              <div className="system-gradient-contrast-warning" role="status" aria-live="polite">
                {contrastWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            {status ? <p className="system-gradient-status">{status}</p> : null}
          </div>

          <aside className="system-gradient-preview-column" aria-label="Gradient preview">
            <section className="system-gradient-card system-gradient-live-card">
              <div className="system-gradient-card-head">
                <h4>Preview</h4>
              </div>

              <div className="system-gradient-live-stage">
                <div className="mini-system-icon active system-gradient-live-tile" role="img" aria-label={`${systemLabel} icon preview`}>
                  <span className="icon-media">
                    {logoPath.trim().length > 0 ? (
                      <img
                        className="category-icon"
                        src={logoPath}
                        alt=""
                        loading="lazy"
                        onLoad={(event) => {
                          delete event.currentTarget.dataset.error
                        }}
                        onError={(event) => {
                          event.currentTarget.dataset.error = 'true'
                        }}
                      />
                    ) : null}
                    <span className="category-fallback">{systemMonogram}</span>
                    <span className="tile-glass-accent" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <footer className="system-gradient-footer">
          <button
            type="button"
            className="ghost system-gradient-tip-target"
            onClick={handleReset}
            data-tip="Restore this system to its default style."
            title="Reset to default gradient"
          >
            Reset to Default
          </button>
          <div className="system-gradient-footer-right">
            <button
              type="button"
              className="ghost system-gradient-tip-target"
              onClick={onClose}
              data-tip="Close without saving your latest edits."
              title="Cancel changes"
            >
              Cancel
            </button>
            <button
              type="button"
              className="system-gradient-tip-target"
              onClick={handleSave}
              data-tip="Save this gradient and animation for the selected system."
              title="Save gradient"
            >
              Save Gradient
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
