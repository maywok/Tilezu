import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { openDialog } from '../../services/dialogService'
import { resolveDialogDefaultDirectoryFromCandidates } from '../../utils/dialogDefaultPath'
import { autoImportGames as autoImportGamesCommand, readLocalImageAsDataUrl } from '../../services/launcherService'
import { SETTINGS_KEY, STARTER_GAMES, STORAGE_KEY } from '../launcher/constants'
import type { GameEntry, ImportSettings, ImportedGame } from '../launcher/types'
import { normalizeGameTitle } from '../launcher/utils/search'
import { BACKGROUND_INDEX_PENDING_KEY, LOCAL_PROFILE_KEY } from './constants'
import {
  loadOnboardingDraft,
  markOnboardingCompleted,
  saveOnboardingDraft,
  type ImportFileType,
  type OnboardingDraft,
  type OnboardingStep,
} from './storage'
import { OnboardingWaveField, type OnboardingWaveTheme } from './OnboardingWaveField.tsx'
import { useOnboardingSetupMusic } from './hooks/useOnboardingSetupMusic'
import './onboarding.css'

type OnboardingFlowProps = {
  onCompleted: () => void
  layoutMode?: 'fullscreen' | 'overlay'
}

type OnboardingWaveStep = OnboardingStep | 'complete'

type OnboardingPastelTheme = OnboardingWaveTheme & {
  backgroundA: [number, number, number]
  backgroundB: [number, number, number]
  backgroundC: [number, number, number]
  panelAccent: [number, number, number]
}

type OnboardingShellStyle = CSSProperties & {
  '--onboarding-wave-a-rgb': string
  '--onboarding-wave-b-rgb': string
  '--onboarding-wave-glow-rgb': string
  '--onboarding-bg-a-rgb': string
  '--onboarding-bg-b-rgb': string
  '--onboarding-bg-c-rgb': string
  '--onboarding-panel-accent-rgb': string
}

type QuickImportPreset = {
  key: string
  label: string
  path: string
  hint: string
}

const QUICK_IMPORT_PRESETS: QuickImportPreset[] = [
  {
    key: 'documents',
    label: 'Documents',
    path: '~/Documents',
    hint: 'Good for manually added game folders.',
  },
  {
    key: 'desktop',
    label: 'Desktop',
    path: '~/Desktop',
    hint: 'Quick pickup for newly downloaded files.',
  },
  {
    key: 'downloads',
    label: 'Downloads',
    path: '~/Downloads',
    hint: 'Useful for recent installers and archives.',
  },
  {
    key: 'pictures',
    label: 'Pictures',
    path: '~/Pictures',
    hint: 'Optional for artwork and image assets.',
  },
  {
    key: 'videos',
    label: 'Videos',
    path: '~/Videos',
    hint: 'Optional for video media libraries.',
  },
]

const FILE_TYPE_OPTIONS: Array<{ key: ImportFileType; label: string; hint: string }> = [
  { key: 'rom', label: 'ROM files', hint: '.nes .sfc .gba .nds and related cartridge formats' },
  { key: 'disc', label: 'Disc images', hint: '.iso .chd .cue and other disc-based formats' },
  { key: 'exe', label: 'Executables', hint: '.exe launchers and standalone apps' },
  { key: 'launcher', label: 'Launcher entries', hint: 'Steam, Epic, Battle.net and URI entries' },
]

const DISC_EXTENSIONS = new Set(['iso', 'chd', 'cue', 'bin'])

const STEP_ORDER: Array<{ id: OnboardingStep; label: string }> = [
  { id: 'animation', label: 'Unlock' },
  { id: 'profile', label: 'Profile' },
  { id: 'import', label: 'Import' },
  { id: 'review', label: 'Finish' },
]

const ONBOARDING_WAVE_STEPS: OnboardingWaveStep[] = ['animation', 'profile', 'import', 'review', 'complete']

const ONBOARDING_PASTEL_THEMES: OnboardingPastelTheme[] = [
  {
    waveA: [255, 149, 126],
    waveB: [255, 183, 116],
    glow: [255, 168, 132],
    backgroundA: [255, 244, 235],
    backgroundB: [255, 236, 226],
    backgroundC: [237, 246, 255],
    panelAccent: [255, 180, 141],
  },
  {
    waveA: [255, 209, 113],
    waveB: [255, 163, 96],
    glow: [255, 205, 130],
    backgroundA: [255, 249, 230],
    backgroundB: [255, 240, 214],
    backgroundC: [244, 250, 255],
    panelAccent: [255, 208, 122],
  },
  {
    waveA: [113, 188, 255],
    waveB: [88, 146, 245],
    glow: [138, 201, 255],
    backgroundA: [234, 246, 255],
    backgroundB: [222, 238, 255],
    backgroundC: [233, 250, 245],
    panelAccent: [139, 200, 255],
  },
  {
    waveA: [111, 216, 181],
    waveB: [77, 187, 158],
    glow: [139, 227, 197],
    backgroundA: [233, 252, 244],
    backgroundB: [227, 246, 255],
    backgroundC: [241, 252, 235],
    panelAccent: [126, 218, 184],
  },
  {
    waveA: [176, 170, 255],
    waveB: [140, 178, 255],
    glow: [195, 188, 255],
    backgroundA: [241, 238, 255],
    backgroundB: [231, 239, 255],
    backgroundC: [248, 244, 255],
    panelAccent: [188, 184, 255],
  },
  {
    waveA: [255, 161, 155],
    waveB: [116, 210, 189],
    glow: [255, 187, 176],
    backgroundA: [255, 240, 238],
    backgroundB: [236, 249, 246],
    backgroundC: [234, 242, 255],
    panelAccent: [255, 180, 170],
  },
  {
    waveA: [107, 203, 255],
    waveB: [255, 177, 138],
    glow: [146, 217, 255],
    backgroundA: [233, 247, 255],
    backgroundB: [255, 238, 230],
    backgroundC: [233, 252, 247],
    panelAccent: [163, 212, 255],
  },
]

const AVATAR_CROP_VIEW_SIZE = 232
const AVATAR_CROP_OUTPUT_SIZE = 320
const AVATAR_MIN_ZOOM = 1
const AVATAR_MAX_ZOOM = 3

function shuffleArray<T>(values: readonly T[]): T[] {
  const shuffled = [...values]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

function buildOnboardingWaveThemeMap(
  steps: readonly OnboardingWaveStep[],
  themes: readonly OnboardingPastelTheme[],
): Record<OnboardingWaveStep, OnboardingPastelTheme> {
  const assignedThemes: OnboardingPastelTheme[] = []

  while (assignedThemes.length < steps.length) {
    const cycle = shuffleArray(themes)

    if (assignedThemes.length > 0 && cycle.length > 1 && cycle[0] === assignedThemes[assignedThemes.length - 1]) {
      ;[cycle[0], cycle[1]] = [cycle[1], cycle[0]]
    }

    assignedThemes.push(...cycle)
  }

  const nextMap = {} as Record<OnboardingWaveStep, OnboardingPastelTheme>

  for (let index = 0; index < steps.length; index += 1) {
    nextMap[steps[index]] = assignedThemes[index]
  }

  return nextMap
}

function toRgbCssValue(value: [number, number, number]): string {
  const [red, green, blue] = value
  return `${red}, ${green}, ${blue}`
}

function createOnboardingShellStyle(theme: OnboardingPastelTheme): OnboardingShellStyle {
  return {
    '--onboarding-wave-a-rgb': toRgbCssValue(theme.waveA),
    '--onboarding-wave-b-rgb': toRgbCssValue(theme.waveB),
    '--onboarding-wave-glow-rgb': toRgbCssValue(theme.glow),
    '--onboarding-bg-a-rgb': toRgbCssValue(theme.backgroundA),
    '--onboarding-bg-b-rgb': toRgbCssValue(theme.backgroundB),
    '--onboarding-bg-c-rgb': toRgbCssValue(theme.backgroundC),
    '--onboarding-panel-accent-rgb': toRgbCssValue(theme.panelAccent),
  }
}

type AvatarCropDraft = {
  sourceDataUrl: string
  naturalWidth: number
  naturalHeight: number
  zoom: number
  offsetX: number
  offsetY: number
}

function uniquePaths(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image decode failed'))
    image.src = dataUrl
  })
}

function getAvatarCropMetrics(naturalWidth: number, naturalHeight: number, zoom: number) {
  const boundedZoom = Math.max(AVATAR_MIN_ZOOM, Math.min(AVATAR_MAX_ZOOM, zoom))
  const baseScale = Math.max(AVATAR_CROP_VIEW_SIZE / naturalWidth, AVATAR_CROP_VIEW_SIZE / naturalHeight)
  const displayScale = baseScale * boundedZoom
  const displayWidth = naturalWidth * displayScale
  const displayHeight = naturalHeight * displayScale
  const maxOffsetX = Math.max(0, (displayWidth - AVATAR_CROP_VIEW_SIZE) / 2)
  const maxOffsetY = Math.max(0, (displayHeight - AVATAR_CROP_VIEW_SIZE) / 2)

  return {
    displayScale,
    displayWidth,
    displayHeight,
    maxOffsetX,
    maxOffsetY,
  }
}

function clampAvatarCropDraft(draft: AvatarCropDraft): AvatarCropDraft {
  const metrics = getAvatarCropMetrics(draft.naturalWidth, draft.naturalHeight, draft.zoom)
  const clampedOffsetX = Math.max(-metrics.maxOffsetX, Math.min(metrics.maxOffsetX, draft.offsetX))
  const clampedOffsetY = Math.max(-metrics.maxOffsetY, Math.min(metrics.maxOffsetY, draft.offsetY))

  return {
    ...draft,
    zoom: Math.max(AVATAR_MIN_ZOOM, Math.min(AVATAR_MAX_ZOOM, draft.zoom)),
    offsetX: clampedOffsetX,
    offsetY: clampedOffsetY,
  }
}

async function cropAvatarToDataUrl(cropDraft: AvatarCropDraft): Promise<string> {
  const image = await loadImageElement(cropDraft.sourceDataUrl)
  const normalized = clampAvatarCropDraft(cropDraft)
  const metrics = getAvatarCropMetrics(normalized.naturalWidth, normalized.naturalHeight, normalized.zoom)
  const left = (AVATAR_CROP_VIEW_SIZE - metrics.displayWidth) / 2 + normalized.offsetX
  const top = (AVATAR_CROP_VIEW_SIZE - metrics.displayHeight) / 2 + normalized.offsetY

  const sourceX = Math.max(0, -left / metrics.displayScale)
  const sourceY = Math.max(0, -top / metrics.displayScale)
  const sourceSize = AVATAR_CROP_VIEW_SIZE / metrics.displayScale

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_CROP_OUTPUT_SIZE
  canvas.height = AVATAR_CROP_OUTPUT_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Crop rendering context unavailable')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_CROP_OUTPUT_SIZE,
    AVATAR_CROP_OUTPUT_SIZE,
  )

  try {
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return canvas.toDataURL()
  }
}

function getFileExtension(target: string): string {
  const normalizedTarget = target.split('#')[0].split('?')[0]
  const filename = normalizedTarget.split(/[\\/]/).pop() ?? normalizedTarget
  const extensionIndex = filename.lastIndexOf('.')

  if (extensionIndex <= 0 || extensionIndex >= filename.length - 1) {
    return ''
  }

  return filename.slice(extensionIndex + 1).toLowerCase()
}

function getImportedGameBucket(entry: ImportedGame): ImportFileType {
  if (entry.kind === 'steam' || entry.kind === 'epic' || entry.kind === 'battle_net' || entry.kind === 'uri') {
    return 'launcher'
  }

  if (entry.kind === 'executable') {
    return 'exe'
  }

  if (entry.kind === 'emulator') {
    const extension = getFileExtension(entry.target)
    if (DISC_EXTENSIONS.has(extension)) {
      return 'disc'
    }

    return 'rom'
  }

  return 'launcher'
}

function isImportedGameSelected(entry: ImportedGame, selectedFileTypes: ImportFileType[]): boolean {
  const selected = new Set(selectedFileTypes)
  return selected.has(getImportedGameBucket(entry))
}

function createLibraryKey(entry: {
  kind: string
  target: string
  title: string
  args?: string[]
  emulatorKey?: string
  manualSystemKey?: string
}): string {
  const normalizedTitle = normalizeGameTitle(entry.title)
  const emulatorKey = entry.emulatorKey?.trim().toLowerCase() ?? ''
  const manualSystemKey = entry.manualSystemKey?.trim().toLowerCase() ?? ''

  return `${entry.kind}::${entry.target}::${normalizedTitle}::${(entry.args ?? []).join('|')}::${emulatorKey}::${manualSystemKey}`
}

function readStoredLibrary(): GameEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return [...STARTER_GAMES]
  }

  try {
    const parsed = JSON.parse(raw) as GameEntry[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
  } catch {
    // Fall through to starter games.
  }

  return [...STARTER_GAMES]
}

function getDedupePreview(existingLibrary: GameEntry[], importedGames: ImportedGame[]): { newCount: number; duplicateCount: number } {
  const seen = new Set(existingLibrary.map((entry) => createLibraryKey(entry)))
  let duplicateCount = 0
  let newCount = 0

  for (const entry of importedGames) {
    const key = createLibraryKey(entry)
    if (seen.has(key)) {
      duplicateCount += 1
      continue
    }

    seen.add(key)
    newCount += 1
  }

  return { newCount, duplicateCount }
}

function mergeImportedLibrary(existingLibrary: GameEntry[], importedGames: ImportedGame[]): { nextLibrary: GameEntry[]; addedCount: number } {
  const seen = new Set(existingLibrary.map((entry) => createLibraryKey(entry)))
  const additions: GameEntry[] = []

  for (const entry of importedGames) {
    const key = createLibraryKey(entry)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    additions.push({
      id: crypto.randomUUID(),
      title: normalizeGameTitle(entry.title),
      kind: entry.kind,
      target: entry.target,
      args: entry.args,
      emulatorKey: entry.emulatorKey,
      manualSystemKey: entry.manualSystemKey,
    })
  }

  return {
    nextLibrary: [...additions, ...existingLibrary],
    addedCount: additions.length,
  }
}

function saveImportSettings(romDirs: string[]): void {
  const raw = localStorage.getItem(SETTINGS_KEY)
  let parsed: Record<string, unknown> = {}

  if (raw) {
    try {
      const candidate = JSON.parse(raw) as unknown
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>
      }
    } catch {
      parsed = {}
    }
  }

  const nextSettings: Record<string, unknown> = {
    ...parsed,
    romDirsText: romDirs.join('\n'),
  }

  if (!Object.prototype.hasOwnProperty.call(nextSettings, 'emulatorPaths')) {
    nextSettings.emulatorPaths = {}
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings))
}

export function OnboardingFlow({ onCompleted, layoutMode = 'fullscreen' }: OnboardingFlowProps) {
  const plipAudioContextRef = useRef<AudioContext | null>(null)
  useOnboardingSetupMusic({
    isActive: true,
    plipAudioContextRef,
  })

  const [draft, setDraft] = useState<OnboardingDraft>(() => loadOnboardingDraft())
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'orbit' | 'unlock'>('orbit')
  const [animationProgress, setAnimationProgress] = useState(12)
  const [previewImportedGames, setPreviewImportedGames] = useState<ImportedGame[]>([])
  const [isScanningPreview, setIsScanningPreview] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isApplyingAvatarCrop, setIsApplyingAvatarCrop] = useState(false)
  const [avatarCropDraft, setAvatarCropDraft] = useState<AvatarCropDraft | null>(null)
  const [stepError, setStepError] = useState('')
  const [completionMessage, setCompletionMessage] = useState<string | null>(null)
  const finishTimerRef = useRef<number | null>(null)
  const avatarPointerDragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startOffsetX: number
    startOffsetY: number
  } | null>(null)

  const selectedImportFolders = useMemo(() => {
    const quickPresetPaths = QUICK_IMPORT_PRESETS
      .filter((preset) => draft.import.selectedQuickPresetKeys.includes(preset.key))
      .map((preset) => preset.path)

    return uniquePaths([...quickPresetPaths, ...draft.import.customFolders])
  }, [draft.import.customFolders, draft.import.selectedQuickPresetKeys])

  const currentStepIndex = useMemo(
    () => STEP_ORDER.findIndex((step) => step.id === draft.currentStep),
    [draft.currentStep],
  )

  const waveThemeByStep = useMemo(
    () => buildOnboardingWaveThemeMap(ONBOARDING_WAVE_STEPS, ONBOARDING_PASTEL_THEMES),
    [],
  )

  const activeWaveTheme = useMemo(() => waveThemeByStep[draft.currentStep], [draft.currentStep, waveThemeByStep])
  const completeWaveTheme = useMemo(() => waveThemeByStep.complete, [waveThemeByStep])
  const activeShellStyle = useMemo(() => createOnboardingShellStyle(activeWaveTheme), [activeWaveTheme])
  const completeShellStyle = useMemo(() => createOnboardingShellStyle(completeWaveTheme), [completeWaveTheme])

  const avatarCropMetrics = useMemo(() => {
    if (!avatarCropDraft) {
      return null
    }

    return getAvatarCropMetrics(avatarCropDraft.naturalWidth, avatarCropDraft.naturalHeight, avatarCropDraft.zoom)
  }, [avatarCropDraft])

  const updateDraft = useCallback((updater: (current: OnboardingDraft) => OnboardingDraft) => {
    setDraft((current) => updater(current))
  }, [])

  useEffect(() => {
    try {
      saveOnboardingDraft(draft)
    } catch {
      // Do not crash onboarding if local storage is temporarily unavailable.
    }
  }, [draft])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handlePreferenceChange = () => setIsReducedMotion(mediaQuery.matches)

    handlePreferenceChange()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handlePreferenceChange)
      return () => mediaQuery.removeEventListener('change', handlePreferenceChange)
    }

    mediaQuery.addListener(handlePreferenceChange)
    return () => mediaQuery.removeListener(handlePreferenceChange)
  }, [])

  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current)
      }
    }
  }, [])

  const completeAnimationStep = useCallback(
    (wasSkipped: boolean) => {
      updateDraft((current) => ({
        ...current,
        hasSkippedAnimation: current.hasSkippedAnimation || wasSkipped,
        currentStep: 'profile',
        completedSteps: current.completedSteps.includes('animation')
          ? current.completedSteps
          : [...current.completedSteps, 'animation'],
      }))
      setStepError('')
    },
    [updateDraft],
  )

  useEffect(() => {
    if (draft.currentStep !== 'animation') {
      return
    }

    setAnimationPhase('orbit')
    setAnimationProgress(12)

    if (isReducedMotion) {
      const reducedTimer = window.setTimeout(() => {
        setAnimationProgress(100)
        completeAnimationStep(false)
      }, 560)

      return () => {
        window.clearTimeout(reducedTimer)
      }
    }

    const progressKickoffTimer = window.setTimeout(() => {
      setAnimationProgress(74)
    }, 60)

    const unlockTimer = window.setTimeout(() => {
      setAnimationPhase('unlock')
      setAnimationProgress(100)
    }, 1320)

    const completeTimer = window.setTimeout(() => {
      completeAnimationStep(false)
    }, 1960)

    return () => {
      window.clearTimeout(progressKickoffTimer)
      window.clearTimeout(unlockTimer)
      window.clearTimeout(completeTimer)
    }
  }, [completeAnimationStep, draft.currentStep, isReducedMotion])

  const handleSkipAnimation = () => {
    completeAnimationStep(true)
  }

  const handlePickAvatar = async () => {
    setStepError('')

    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'avif', 'jfif'] }],
      })

      if (!selected || Array.isArray(selected)) {
        return
      }

      const dataUrl = await readLocalImageAsDataUrl(selected)
      const decodedImage = await loadImageElement(dataUrl)

      if (decodedImage.naturalWidth < 8 || decodedImage.naturalHeight < 8) {
        throw new Error('Image is too small to use as an avatar.')
      }

      setAvatarCropDraft(
        clampAvatarCropDraft({
          sourceDataUrl: dataUrl,
          naturalWidth: decodedImage.naturalWidth,
          naturalHeight: decodedImage.naturalHeight,
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStepError(`Avatar selection failed: ${message}. Try PNG, JPG, WEBP, or AVIF.`)
    }
  }

  const handleAvatarCropZoomChange = (nextZoom: number) => {
    setAvatarCropDraft((current) => {
      if (!current) {
        return current
      }

      return clampAvatarCropDraft({
        ...current,
        zoom: nextZoom,
      })
    })
  }

  const handleAvatarCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!avatarCropDraft) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    avatarPointerDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: avatarCropDraft.offsetX,
      startOffsetY: avatarCropDraft.offsetY,
    }
  }

  const handleAvatarCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = avatarPointerDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - drag.startClientX
    const deltaY = event.clientY - drag.startClientY

    setAvatarCropDraft((current) => {
      if (!current) {
        return current
      }

      return clampAvatarCropDraft({
        ...current,
        offsetX: drag.startOffsetX + deltaX,
        offsetY: drag.startOffsetY + deltaY,
      })
    })
  }

  const handleAvatarCropPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = avatarPointerDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    avatarPointerDragRef.current = null
  }

  const handleApplyAvatarCrop = async () => {
    if (!avatarCropDraft || isApplyingAvatarCrop) {
      return
    }

    setIsApplyingAvatarCrop(true)
    setStepError('')

    try {
      const croppedDataUrl = await cropAvatarToDataUrl(avatarCropDraft)
      updateDraft((current) => ({
        ...current,
        profile: {
          ...current.profile,
          avatarDataUrl: croppedDataUrl,
        },
      }))
      setAvatarCropDraft(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStepError(`Avatar crop failed: ${message}`)
    } finally {
      setIsApplyingAvatarCrop(false)
    }
  }

  const handleProfileContinue = () => {
    if (avatarCropDraft) {
      setStepError('Apply or cancel avatar crop before continuing.')
      return
    }

    const nextName = draft.profile.displayName.trim()
    if (nextName.length < 2) {
      setStepError('Please enter a display name with at least 2 characters.')
      return
    }

    setStepError('')

    updateDraft((current) => ({
      ...current,
      currentStep: 'import',
      completedSteps: current.completedSteps.includes('profile')
        ? current.completedSteps
        : [...current.completedSteps, 'profile'],
      profile: {
        ...current.profile,
        displayName: nextName,
      },
    }))
  }

  const toggleQuickPreset = (presetKey: string) => {
    updateDraft((current) => {
      const selected = new Set(current.import.selectedQuickPresetKeys)
      if (selected.has(presetKey)) {
        selected.delete(presetKey)
      } else {
        selected.add(presetKey)
      }

      return {
        ...current,
        import: {
          ...current.import,
          selectedQuickPresetKeys: [...selected],
        },
      }
    })
  }

  const handleAddFolders = async () => {
    setStepError('')

    try {
      const defaultPath = await resolveDialogDefaultDirectoryFromCandidates(draft.import.customFolders)
      const selected = await openDialog({
        directory: true,
        multiple: true,
        ...(defaultPath ? { defaultPath } : {}),
      })

      if (!selected) {
        return
      }

      const selectedFolders = Array.isArray(selected) ? selected : [selected]
      updateDraft((current) => ({
        ...current,
        import: {
          ...current.import,
          customFolders: uniquePaths([...current.import.customFolders, ...selectedFolders]),
        },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStepError(`Folder picker failed: ${message}`)
    }
  }

  const handleRemoveFolder = (folderPath: string) => {
    updateDraft((current) => ({
      ...current,
      import: {
        ...current.import,
        customFolders: current.import.customFolders.filter((entry) => entry !== folderPath),
      },
    }))
  }

  const toggleFileType = (fileType: ImportFileType) => {
    updateDraft((current) => {
      const selected = new Set(current.import.selectedFileTypes)

      if (selected.has(fileType) && selected.size === 1) {
        return current
      }

      if (selected.has(fileType)) {
        selected.delete(fileType)
      } else {
        selected.add(fileType)
      }

      return {
        ...current,
        import: {
          ...current.import,
          selectedFileTypes: [...selected],
        },
      }
    })
  }

  const handleRunImportPreview = async () => {
    if (selectedImportFolders.length === 0) {
      setStepError('Choose at least one quick preset or custom folder before scanning.')
      return
    }

    setStepError('')
    setIsScanningPreview(true)

    try {
      const settings: ImportSettings = {
        romDirs: selectedImportFolders,
        emulatorPaths: {},
      }

      const imported = await autoImportGamesCommand(settings)
      const filtered = imported.filter((entry) => isImportedGameSelected(entry, draft.import.selectedFileTypes))
      const existingLibrary = readStoredLibrary()
      const { newCount, duplicateCount } = getDedupePreview(existingLibrary, filtered)

      const preview = {
        scannedAt: Date.now(),
        discoveredCount: filtered.length,
        estimatedNewCount: newCount,
        duplicateCount,
        sampleTitles: filtered.slice(0, 8).map((entry) => normalizeGameTitle(entry.title)),
      }

      setPreviewImportedGames(filtered)
      updateDraft((current) => ({
        ...current,
        import: {
          ...current.import,
          preview,
        },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStepError(`Scan failed: ${message}`)
    } finally {
      setIsScanningPreview(false)
    }
  }

  const handleImportContinue = () => {
    setStepError('')
    updateDraft((current) => ({
      ...current,
      currentStep: 'review',
      completedSteps: current.completedSteps.includes('import')
        ? current.completedSteps
        : [...current.completedSteps, 'import'],
    }))
  }

  const handleBackToProfile = () => {
    setStepError('')
    updateDraft((current) => ({
      ...current,
      currentStep: 'profile',
    }))
  }

  const handleBackToImport = () => {
    setStepError('')
    updateDraft((current) => ({
      ...current,
      currentStep: 'import',
    }))
  }

  const handleFinish = async () => {
    if (isFinishing) {
      return
    }

    const profileName = draft.profile.displayName.trim()
    if (profileName.length < 2) {
      setStepError('Please set up your profile name before finishing.')
      updateDraft((current) => ({
        ...current,
        currentStep: 'profile',
      }))
      return
    }

    setStepError('')
    setIsFinishing(true)

    try {
      localStorage.setItem(
        LOCAL_PROFILE_KEY,
        JSON.stringify({
          displayName: profileName,
          avatarDataUrl: draft.profile.avatarDataUrl,
          wantsOnlineLater: draft.profile.wantsOnlineLater,
          updatedAt: Date.now(),
        }),
      )

      saveImportSettings(selectedImportFolders)

      let completionCopy = 'Ready to go.'

      if (selectedImportFolders.length > 0) {
        if (draft.import.backgroundIndexing) {
          localStorage.setItem(BACKGROUND_INDEX_PENDING_KEY, '1')
          completionCopy = 'Indexing will continue in the background.'
        } else {
          let imported = previewImportedGames

          if (imported.length === 0) {
            const settings: ImportSettings = {
              romDirs: selectedImportFolders,
              emulatorPaths: {},
            }

            const scanned = await autoImportGamesCommand(settings)
            imported = scanned.filter((entry) => isImportedGameSelected(entry, draft.import.selectedFileTypes))
          }

          const existingLibrary = readStoredLibrary()
          const { nextLibrary, addedCount } = mergeImportedLibrary(existingLibrary, imported)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLibrary))

          if (addedCount > 0) {
            completionCopy = `Added ${addedCount} ${addedCount === 1 ? 'entry' : 'entries'} to your library.`
          }
        }
      }

      markOnboardingCompleted()
      setCompletionMessage(completionCopy)

      finishTimerRef.current = window.setTimeout(() => {
        onCompleted()
      }, 940)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStepError(`Setup finish failed: ${message}`)
      setIsFinishing(false)
    }
  }

  const shellClassName = layoutMode === 'overlay' ? 'onboarding-shell onboarding-shell-overlay' : 'onboarding-shell'
  const waveFieldReducedMotion = false

  if (completionMessage) {
    return (
      <div className={shellClassName} data-step="complete" style={completeShellStyle}>
        <OnboardingWaveField theme={completeWaveTheme} reducedMotion={waveFieldReducedMotion} />
        <div className="onboarding-complete-card" role="status" aria-live="polite">
          <div className="onboarding-complete-mark" aria-hidden="true">
            <span className="onboarding-complete-ring" />
            <span className="onboarding-complete-check">UNLOCKED</span>
          </div>
          <h1>Setup Complete</h1>
          <p>{completionMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={shellClassName} data-step={draft.currentStep} style={activeShellStyle}>
      <OnboardingWaveField theme={activeWaveTheme} reducedMotion={waveFieldReducedMotion} />
      <main className="onboarding-card" aria-live="polite">
        <header className="onboarding-header">
          <p className="onboarding-kicker">First-time setup</p>
          <h1>Set up Tilezu</h1>
          <p className="onboarding-subtext">Local by default. Link an account later if you want.</p>
          <ol className="onboarding-step-track" aria-label="Onboarding progress">
            {STEP_ORDER.map((step, index) => {
              const isActive = step.id === draft.currentStep
              const isComplete = draft.completedSteps.includes(step.id)
              const isPast = index < currentStepIndex

              return (
                <li key={step.id} className={isActive ? 'is-active' : isComplete || isPast ? 'is-complete' : ''}>
                  <span className="step-dot" aria-hidden="true" />
                  <span className="step-label">{step.label}</span>
                </li>
              )
            })}
          </ol>
        </header>

        {draft.currentStep === 'animation' && (
          <section className="onboarding-step-content onboarding-step-animation">
            <div className={`unlock-stage phase-${animationPhase}${isReducedMotion ? ' reduced-motion' : ''}`}>
              <span className="unlock-glow" aria-hidden="true" />
              <span className="unlock-burst" aria-hidden="true" />
              <span className="unlock-ring" aria-hidden="true">
                <span className="unlock-orbiter" />
              </span>
              <span className="unlock-lock" aria-hidden="true">
                <span className="lock-shackle" />
                <span className="lock-body" />
              </span>
            </div>

            <p className="onboarding-animation-label">Preparing local profile and startup preferences...</p>
            <div className="onboarding-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={animationProgress}>
              <span style={{ width: `${animationProgress}%` }} />
            </div>

            <div className="onboarding-actions-row single">
              <button type="button" className="onboarding-ghost" onClick={handleSkipAnimation}>
                Skip animation
              </button>
            </div>
          </section>
        )}

        {draft.currentStep === 'profile' && (
          <section className="onboarding-step-content">
            <div className="onboarding-profile-grid">
              <label className="onboarding-field">
                <span>Display name</span>
                <input
                  value={draft.profile.displayName}
                  placeholder="Player One"
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        displayName: event.target.value,
                      },
                    }))
                  }
                />
              </label>

              <div className="onboarding-avatar-block">
                <span className="onboarding-avatar-preview" aria-label="Profile avatar preview">
                  {draft.profile.avatarDataUrl ? <img src={draft.profile.avatarDataUrl} alt="" /> : profileNameInitial(draft.profile.displayName)}
                </span>
                <div className="onboarding-avatar-actions">
                  <button type="button" className="onboarding-ghost" onClick={handlePickAvatar}>
                    Choose avatar
                  </button>
                  {draft.profile.avatarDataUrl && (
                    <button
                      type="button"
                      className="onboarding-ghost"
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          profile: {
                            ...current.profile,
                            avatarDataUrl: '',
                          },
                        }))
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {avatarCropDraft && (
              <div className="onboarding-avatar-cropper" role="dialog" aria-modal="true" aria-label="Crop avatar image">
                <div
                  className="avatar-crop-surface"
                  onPointerDown={handleAvatarCropPointerDown}
                  onPointerMove={handleAvatarCropPointerMove}
                  onPointerUp={handleAvatarCropPointerUp}
                  onPointerCancel={handleAvatarCropPointerUp}
                >
                  <img
                    src={avatarCropDraft.sourceDataUrl}
                    alt="Avatar crop source"
                    style={{
                      width: `${avatarCropMetrics?.displayWidth ?? AVATAR_CROP_VIEW_SIZE}px`,
                      height: `${avatarCropMetrics?.displayHeight ?? AVATAR_CROP_VIEW_SIZE}px`,
                      transform: `translate(calc(-50% + ${avatarCropDraft.offsetX}px), calc(-50% + ${avatarCropDraft.offsetY}px))`,
                    }}
                    draggable={false}
                  />
                  <span className="avatar-crop-frame" aria-hidden="true" />
                </div>

                <label className="avatar-crop-zoom-row">
                  <span>Zoom</span>
                  <input
                    type="range"
                    min={AVATAR_MIN_ZOOM}
                    max={AVATAR_MAX_ZOOM}
                    step={0.01}
                    value={avatarCropDraft.zoom}
                    onChange={(event) => handleAvatarCropZoomChange(Number(event.target.value))}
                  />
                </label>

                <p className="onboarding-note">Drag to position. Zoom in or out, then apply crop.</p>

                <div className="onboarding-actions-row">
                  <button
                    type="button"
                    className="onboarding-ghost"
                    onClick={() => {
                      setAvatarCropDraft(null)
                      setStepError('')
                    }}
                    disabled={isApplyingAvatarCrop}
                  >
                    Cancel
                  </button>
                  <button type="button" className="onboarding-primary" onClick={handleApplyAvatarCrop} disabled={isApplyingAvatarCrop}>
                    {isApplyingAvatarCrop ? 'Applying...' : 'Apply crop'}
                  </button>
                </div>
              </div>
            )}

            <label className="onboarding-toggle-row">
              <input
                type="checkbox"
                checked={draft.profile.wantsOnlineLater}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    profile: {
                      ...current.profile,
                      wantsOnlineLater: event.target.checked,
                    },
                  }))
                }
              />
              <span>I may take this account online later (optional, still local for now).</span>
            </label>

            <p className="onboarding-note">No password and no online connection required right now.</p>

            <div className="onboarding-actions-row">
              <button type="button" className="onboarding-primary onboarding-primary-cta" onClick={handleProfileContinue}>
                Continue to Import
              </button>
            </div>
          </section>
        )}

        {draft.currentStep === 'import' && (
          <section className="onboarding-step-content">
            <div className="onboarding-section-block">
              <h2>Quick Import Presets</h2>
              <div className="onboarding-chip-grid">
                {QUICK_IMPORT_PRESETS.map((preset) => {
                  const isSelected = draft.import.selectedQuickPresetKeys.includes(preset.key)

                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className={isSelected ? 'onboarding-chip is-active' : 'onboarding-chip'}
                      onClick={() => toggleQuickPreset(preset.key)}
                    >
                      <span className="chip-label">{preset.label}</span>
                      <span className="chip-path">{preset.path}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="onboarding-section-block">
              <h2>Advanced Folders</h2>
              <div className="onboarding-folder-list">
                {draft.import.customFolders.length === 0 && <p className="onboarding-muted">No custom folders selected yet.</p>}
                {draft.import.customFolders.map((folder) => (
                  <div key={folder} className="folder-row">
                    <span>{folder}</span>
                    <button type="button" className="onboarding-ghost" onClick={() => handleRemoveFolder(folder)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="onboarding-ghost" onClick={handleAddFolders}>
                Choose folders
              </button>
            </div>

            <div className="onboarding-section-block">
              <h2>File Types</h2>
              <div className="onboarding-checkbox-grid">
                {FILE_TYPE_OPTIONS.map((option) => {
                  const isChecked = draft.import.selectedFileTypes.includes(option.key)
                  return (
                    <label key={option.key} className="onboarding-checkbox-card">
                      <input type="checkbox" checked={isChecked} onChange={() => toggleFileType(option.key)} />
                      <span className="checkbox-copy">
                        <strong>{option.label}</strong>
                        <small>{option.hint}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="onboarding-section-block">
              <h2>Preview</h2>
              <p className="onboarding-note">Run a scan to preview dedupe and estimated additions before finishing.</p>
              <button type="button" className="onboarding-primary" onClick={handleRunImportPreview} disabled={isScanningPreview}>
                {isScanningPreview ? 'Scanning...' : 'Run preview scan'}
              </button>

              {draft.import.preview && (
                <div className="onboarding-preview-card" aria-live="polite">
                  <p>
                    Found <strong>{draft.import.preview.discoveredCount}</strong> matching entries.
                  </p>
                  <p>
                    Estimated new: <strong>{draft.import.preview.estimatedNewCount}</strong> | duplicates: <strong>{draft.import.preview.duplicateCount}</strong>
                  </p>
                  {draft.import.preview.sampleTitles.length > 0 && (
                    <ul>
                      {draft.import.preview.sampleTitles.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <label className="onboarding-toggle-row">
              <input
                type="checkbox"
                checked={draft.import.backgroundIndexing}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    import: {
                      ...current.import,
                      backgroundIndexing: event.target.checked,
                    },
                  }))
                }
              />
              <span>Continue indexing in the background after setup (recommended).</span>
            </label>

            <p className="onboarding-note">You can re-import anytime from settings after setup.</p>

            <div className="onboarding-actions-row">
              <button type="button" className="onboarding-ghost" onClick={handleBackToProfile}>
                Back
              </button>
              <button type="button" className="onboarding-primary onboarding-primary-cta" onClick={handleImportContinue}>
                Continue to Review
              </button>
            </div>
          </section>
        )}

        {draft.currentStep === 'review' && (
          <section className="onboarding-step-content">
            <div className="onboarding-review-grid">
              <article className="onboarding-review-card">
                <h2>Profile</h2>
                <p>
                  Name: <strong>{draft.profile.displayName || 'Not set'}</strong>
                </p>
                <p>{draft.profile.wantsOnlineLater ? 'Online features can be linked later.' : 'Local-only mode enabled.'}</p>
              </article>

              <article className="onboarding-review-card">
                <h2>Import Plan</h2>
                <p>
                  Selected folders: <strong>{selectedImportFolders.length}</strong>
                </p>
                <p>
                  File types: <strong>{draft.import.selectedFileTypes.join(', ')}</strong>
                </p>
                <p>{draft.import.backgroundIndexing ? 'Background indexing: On' : 'Background indexing: Off'}</p>
              </article>

              <article className="onboarding-review-card">
                <h2>Preview Summary</h2>
                {draft.import.preview ? (
                  <>
                    <p>
                      Found: <strong>{draft.import.preview.discoveredCount}</strong>
                    </p>
                    <p>
                      Estimated new: <strong>{draft.import.preview.estimatedNewCount}</strong>
                    </p>
                    <p>
                      Duplicates: <strong>{draft.import.preview.duplicateCount}</strong>
                    </p>
                  </>
                ) : (
                  <p>No preview scan yet. Setup can still continue safely.</p>
                )}
              </article>
            </div>

            <p className="onboarding-note">You can edit profile and run imports again later from settings.</p>

            <div className="onboarding-actions-row">
              <button type="button" className="onboarding-ghost" onClick={handleBackToImport} disabled={isFinishing}>
                Back
              </button>
              <button type="button" className="onboarding-primary onboarding-primary-cta" onClick={handleFinish} disabled={isFinishing}>
                {isFinishing ? 'Finalizing setup...' : 'Finish Setup'}
              </button>
            </div>
          </section>
        )}

        {stepError && <p className="onboarding-error">{stepError}</p>}
      </main>
    </div>
  )
}

function profileNameInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return 'TM'
  }

  const segments = trimmed.split(/\s+/).filter(Boolean)
  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase()
  }

  return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase()
}
