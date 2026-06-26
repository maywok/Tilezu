import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { formatPlaytimeMinutes } from '../../features/launcher/utils/category'
import { RUNGO_UNLOCKED_DEFAULT_IDS, ownedKeychains } from '../keychains-data'
import type { Keychain, KeychainAnimationState, KeychainSpriteState } from '../keychains-data'

type PlaytimeOrbProps = {
  title: string
  totalMinutes: number
  subtitle: string
  isExpanded: boolean
  showRunners?: boolean
  runnerIconSrc?: string | null
  activeRungoIds?: string[]
  signatureRungoId?: string | null
  rungoRoleById?: Partial<Record<string, RungoTrioRole>>
  rungoNameOverridesById?: Record<string, string>
  runnerAnchorByKey?: Record<string, string>
  runnerDropTargetCenters?: Record<string, RunnerDropTargetCenter>
  onRunnerDragStateChange?: (state: RunnerDragStatePayload) => void
  onRunnerAssignAnchor?: (runnerKey: string, targetId: string, rungoId?: string) => void
  onToggle: () => void
  children?: React.ReactNode
}

type RunnerDropTargetCenter = {
  x: number
  y: number
  width: number
  height: number
  label: string
}

type RunnerDragStatePayload = {
  isDragging: boolean
  runnerKey: string | null
  activeTargetId?: string | null
  clientX?: number
  clientY?: number
}

type RungoTrioRole = 'leader' | 'mood' | 'hype'

type RunnerAnimationState = KeychainAnimationState

type OrbRunnerModel = {
  key: string
  index: number
  angleDeg: number
  orbitSeconds: number
  orbitDirection: 1 | -1
  orbitDelayMs: number
  bobMs: number
  strideMs: number
  strideRightMs: number
  strideDelayMs: number
  radiusNudgePx: number
}

const ORB_CENTER_TARGET_ID = 'orb-center'
const RUNNER_NAMES_STORAGE_KEY = 'tm-playtime-runner-names-v1'
const RUNGO_UNLOCKED_STORAGE_KEY = 'tm:rungoUnlocked'
const RUNNER_BEHAVIOR_TICK_MS = 96
const POINTER_DRAG_START_PX = 6
const RUNGO_SPRITE_SIZE_PX = 16
const RUNGO_SPRITE_RENDER_SIZE_PX = 22
const RUNGO_COLLISION_DISTANCE_PX = 11
const RUNGO_COLLISION_APPROACH_DOT_MIN = 0.3
const RUNGO_BUMP_DURATION_MS = 130
const RUNGO_FALL_DURATION_MS = 620
const RUNGO_COLLISION_COOLDOWN_MS = 1650
const RUNGO_DIRECTION_SHIFT_MIN_MS = 12000
const RUNGO_DIRECTION_SHIFT_MAX_MS = 22000
const RUNGO_DIRECTION_SHIFT_CHANCE = 0
const RUNGO_BUMP_KNOCKBACK_PX = 9
const RUNGO_TRIO_ROLE_LABELS: Record<RungoTrioRole, string> = {
  leader: 'Leader',
  mood: 'Mood',
  hype: 'Hype',
}

type RunnerBehaviorMode = RunnerAnimationState

type RunnerBehaviorState = {
  mode: RunnerBehaviorMode
  strideScale: number
  nextSwitchAt: number
  animationStartedAt: number
  collisionCooldownUntil: number
  orbitDirection: 1 | -1
  angleOffsetDeg: number
  nextDirectionShiftAt: number
  impactOffsetX: number
  impactOffsetY: number
  orbitFrozenAngleDeg: number | null
}

type RungoSpriteConfig = {
  sheetUrl: string
  frameSizePx: number
  frameCount: number
  frameDurationMs: number
  loop: boolean
}

const RUNGO_BY_ID = ownedKeychains.reduce<Record<string, Keychain>>((lookup, entry) => {
  lookup[entry.id] = entry
  return lookup
}, {})

function resolveBaseRungo(): Keychain | null {
  return RUNGO_BY_ID.base ?? ownedKeychains[0] ?? null
}

function toSpriteConfig(state: KeychainSpriteState | undefined): RungoSpriteConfig | null {
  if (!state) {
    return null
  }

  return {
    sheetUrl: state.sheetUrl,
    frameSizePx: state.frameSizePx,
    frameCount: state.frameCount,
    frameDurationMs: state.frameDurationMs,
    loop: state.loop,
  }
}

function resolveSpriteConfigForRungo(rungoId: string, mode: RunnerAnimationState): RungoSpriteConfig {
  const selected = RUNGO_BY_ID[rungoId]
  const selectedSprite = toSpriteConfig(selected?.sprites?.[mode] ?? selected?.sprites?.idle)
  if (selectedSprite) {
    return selectedSprite
  }

  const fallback = resolveBaseRungo()
  const fallbackSprite = toSpriteConfig(fallback?.sprites?.[mode] ?? fallback?.sprites?.idle)
  if (fallbackSprite) {
    return fallbackSprite
  }

  return {
    sheetUrl: '',
    frameSizePx: RUNGO_SPRITE_SIZE_PX,
    frameCount: 1,
    frameDurationMs: 100,
    loop: false,
  }
}

function resolveDisplayNameForRungo(rungoId: string): string {
  return RUNGO_BY_ID[rungoId]?.name ?? 'Base Rungo'
}

function resolveWeightedRungoId(
  candidates: Keychain[],
  seededUnit: number,
): string {
  if (candidates.length <= 0) {
    return RUNGO_UNLOCKED_DEFAULT_IDS[0] ?? 'base'
  }

  const totalWeight = candidates.reduce((total, candidate) => total + Math.max(0.001, candidate.rarityWeight), 0)
  let cursor = Math.max(0, Math.min(1, seededUnit)) * totalWeight

  for (const candidate of candidates) {
    cursor -= Math.max(0.001, candidate.rarityWeight)
    if (cursor <= 0) {
      return candidate.id
    }
  }

  return candidates[candidates.length - 1]?.id ?? (RUNGO_UNLOCKED_DEFAULT_IDS[0] ?? 'base')
}

function resolveRunnerCount(totalMinutes: number): number {
  const hours = Math.max(0, Math.floor(totalMinutes / 60))
  const base = Math.min(10, Math.floor(hours / 10))
  const bonus = (hours >= 500 ? 1 : 0) + (hours >= 1000 ? 1 : 0)
  return Math.min(12, base + bonus)
}

function deterministicUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function createDefaultRunnerName(): string {
  return 'Prungo'
}

function normalizeRunnerName(rawName: string | undefined): string {
  const normalized = (rawName ?? '').trim()
  if (!normalized || /^guy\s+\d+$/i.test(normalized)) {
    return createDefaultRunnerName()
  }

  return normalized
}

function pickPauseMode(index: number, runnerCount: number, now: number): 'idle' | 'sit' {
  const sitSeed = deterministicUnit((index + 1) * 281 + runnerCount * 59 + Math.floor(now / 1180))
  return sitSeed < 0.38 ? 'sit' : 'idle'
}

function resolveNextDirectionShiftAt(index: number, runnerCount: number, now: number): number {
  const shiftSeed = deterministicUnit((index + 1) * 619 + runnerCount * 47 + Math.floor(now / 500))
  const shiftWindowMs = RUNGO_DIRECTION_SHIFT_MIN_MS
    + shiftSeed * (RUNGO_DIRECTION_SHIFT_MAX_MS - RUNGO_DIRECTION_SHIFT_MIN_MS)
  return now + shiftWindowMs
}

function resolveSpriteFrameIndex(sprite: RungoSpriteConfig, animationStartedAt: number, now: number): number {
  if (!sprite || sprite.frameCount <= 1) {
    return 0
  }

  const elapsed = Math.max(0, now - animationStartedAt)
  const frameProgress = Math.floor(elapsed / sprite.frameDurationMs)
  if (sprite.loop) {
    return frameProgress % sprite.frameCount
  }

  return Math.min(sprite.frameCount - 1, frameProgress)
}

function resolveRunnerOrbitProgress(runner: OrbRunnerModel, now: number): number {
  const orbitDurationMs = Math.max(1800, runner.orbitSeconds * 1000)
  return ((((now - runner.orbitDelayMs) % orbitDurationMs) + orbitDurationMs) % orbitDurationMs) / orbitDurationMs
}

function resolveRunnerOrbitAngleDeg(
  runner: OrbRunnerModel,
  orbitDirection: 1 | -1,
  angleOffsetDeg: number,
  now: number,
): number {
  const progress = resolveRunnerOrbitProgress(runner, now)
  return runner.angleDeg + angleOffsetDeg + (360 * orbitDirection * progress)
}

function resolveRunnerAngleOffsetDeg(
  runner: OrbRunnerModel,
  orbitDirection: 1 | -1,
  now: number,
  orbitAngleDeg: number,
): number {
  const progress = resolveRunnerOrbitProgress(runner, now)
  return orbitAngleDeg - runner.angleDeg - (360 * orbitDirection * progress)
}

function resolveRunnerOrbitAngleDegForBehavior(
  runner: OrbRunnerModel,
  behavior: RunnerBehaviorState,
  now: number,
): number {
  if (behavior.orbitFrozenAngleDeg !== null) {
    return behavior.orbitFrozenAngleDeg
  }

  return resolveRunnerOrbitAngleDeg(runner, behavior.orbitDirection, behavior.angleOffsetDeg, now)
}

function resolveRunnerTravelVector(
  orbitDirection: 1 | -1,
  pathScaleX: number,
  pathScaleY: number,
  orbitAngleDeg: number,
): { x: number; y: number } {
  const orbitAngleRad = (orbitAngleDeg * Math.PI) / 180
  const velocityX = orbitDirection * pathScaleX * Math.cos(orbitAngleRad)
  const velocityY = orbitDirection * pathScaleY * Math.sin(orbitAngleRad)
  const velocityMagnitude = Math.hypot(velocityX, velocityY)
  if (velocityMagnitude < 0.0001) {
    return { x: orbitDirection, y: 0 }
  }

  return {
    x: velocityX / velocityMagnitude,
    y: velocityY / velocityMagnitude,
  }
}

function resolveRunnerOrbitPosition(
  runner: OrbRunnerModel,
  anchor: {
    x: number
    y: number
    radius: number
    allowRadiusNudge: boolean
    pathScaleX: number
    pathScaleY: number
  },
  orbitDirection: 1 | -1,
  angleOffsetDeg: number,
  now: number,
): { x: number; y: number } {
  const angleDeg = resolveRunnerOrbitAngleDeg(runner, orbitDirection, angleOffsetDeg, now)
  const angleRad = (angleDeg * Math.PI) / 180
  const radiusNudge = anchor.allowRadiusNudge ? runner.radiusNudgePx : 0
  const radius = Math.max(20, anchor.radius + radiusNudge)

  return {
    x: anchor.x + (Math.sin(angleRad) * radius * anchor.pathScaleX),
    y: anchor.y - (Math.cos(angleRad) * radius * anchor.pathScaleY),
  }
}

function createBehaviorState(
  index: number,
  runnerCount: number,
  now: number,
  mode?: RunnerBehaviorMode,
  modeDurationMs?: number,
): RunnerBehaviorState {
  const cycle = Math.floor(now / 1450)
  const modeSeed = deterministicUnit((index + 1) * 131 + runnerCount * 37 + cycle * 53)
  const strideSeed = deterministicUnit((index + 1) * 83 + runnerCount * 23 + cycle * 61)
  const resolvedMode: RunnerBehaviorMode = mode ?? (modeSeed > 0.58 ? 'running' : pickPauseMode(index, runnerCount, now))
  const nextDuration = (() => {
    if (resolvedMode === 'running') {
      return 1800 + modeSeed * 2600
    }

    if (resolvedMode === 'idle') {
      return 2200 + modeSeed * 3800
    }

    if (resolvedMode === 'sit') {
      return 2800 + modeSeed * 4600
    }

    if (resolvedMode === 'bump') {
      return modeDurationMs ?? RUNGO_BUMP_DURATION_MS
    }

    return modeDurationMs ?? RUNGO_FALL_DURATION_MS
  })()

  return {
    mode: resolvedMode,
    strideScale: 0.84 + strideSeed * 0.52,
    nextSwitchAt: now + nextDuration,
    animationStartedAt: now,
    collisionCooldownUntil: 0,
    orbitDirection: index % 4 === 0 ? -1 : 1,
    angleOffsetDeg: 0,
    nextDirectionShiftAt: resolveNextDirectionShiftAt(index, runnerCount, now),
    impactOffsetX: 0,
    impactOffsetY: 0,
    orbitFrozenAngleDeg: null,
  }
}

const PlaytimeOrbBase: React.FC<PlaytimeOrbProps> = ({
  title,
  totalMinutes,
  subtitle,
  isExpanded,
  showRunners = false,
  activeRungoIds,
  signatureRungoId,
  rungoRoleById,
  rungoNameOverridesById,
  runnerAnchorByKey,
  runnerDropTargetCenters,
  onRunnerDragStateChange,
  onRunnerAssignAnchor,
  onToggle,
  children,
}) => {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pointerDragRef = useRef<{
    runnerKey: string
    pointerId: number
    startX: number
    startY: number
    hasStarted: boolean
  } | null>(null)
  const [stageRect, setStageRect] = useState<DOMRect | null>(null)
  const [hoveredRunnerKey, setHoveredRunnerKey] = useState<string | null>(null)
  const [draggingRunnerKey, setDraggingRunnerKey] = useState<string | null>(null)
  const [dragPointerClient, setDragPointerClient] = useState<{ x: number; y: number } | null>(null)
  const [editingRunnerKey, setEditingRunnerKey] = useState<string | null>(null)
  const [draftRunnerName, setDraftRunnerName] = useState('')
  const [runnerNames, setRunnerNames] = useState<Record<string, string>>({})
  const [runnerBehaviorByKey, setRunnerBehaviorByKey] = useState<Record<string, RunnerBehaviorState>>({})
  const [runnerAnimationNow, setRunnerAnimationNow] = useState<number>(() => Date.now())
  const [unlockedRungoIds, setUnlockedRungoIds] = useState<string[]>([...RUNGO_UNLOCKED_DEFAULT_IDS])
  const [runnerSpeciesByKey, setRunnerSpeciesByKey] = useState<Record<string, string>>({})

  const resolvedActiveRungoIds = useMemo(() => {
    if (activeRungoIds === undefined) {
      return []
    }

    return activeRungoIds
      .map((entry) => entry.trim())
      .filter((entry) => Boolean(entry) && Boolean(RUNGO_BY_ID[entry]))
  }, [activeRungoIds])

  const hasExplicitActiveRungos = activeRungoIds !== undefined

  const runnerModels = useMemo<OrbRunnerModel[]>(() => {
    if (!showRunners) {
      return []
    }

    const capacity = resolveRunnerCount(totalMinutes)
    const runnerCount = hasExplicitActiveRungos
      ? Math.min(capacity, resolvedActiveRungoIds.length)
      : capacity
    if (runnerCount <= 0) {
      return []
    }

    return Array.from({ length: runnerCount }, (_, index) => {
      const orbitSeconds = Number((17.2 + (((index * 37 + runnerCount * 11) % 11) * 1.22)).toFixed(2))
      const orbitDelayMs = Math.round((index / runnerCount) * -2200 - (index % 3) * 90)
      const bobMs = 460 + ((index * 43) % 250)
      const baseStrideMs = 460 + ((index * 61) % 320)
      const strideMs = Math.max(420, Math.round(baseStrideMs))
      const strideRightMs = Math.max(440, Math.round(baseStrideMs + 64 + ((index * 17) % 90)))
      const strideDelayMs = (index % 4) * 150
      const radiusNudgePx = ((index * 17 + runnerCount * 7) % 7) - 3

      return {
        key: `runner-${index}`,
        index,
        angleDeg: (index / runnerCount) * 360,
        orbitSeconds,
        orbitDirection: index % 4 === 0 ? -1 : 1,
        orbitDelayMs,
        bobMs,
        strideMs,
        strideRightMs,
        strideDelayMs,
        radiusNudgePx,
      }
    })
  }, [hasExplicitActiveRungos, resolvedActiveRungoIds.length, showRunners, totalMinutes])

  const unlockedSpawnCandidates = useMemo(() => {
    const unlockedSet = new Set(unlockedRungoIds)
    const spawnable = ownedKeychains.filter((entry) => {
      return unlockedSet.has(entry.id) && entry.isSpawnEligible && Boolean(entry.sprites)
    })

    if (spawnable.length > 0) {
      return spawnable
    }

    const base = resolveBaseRungo()
    return base ? [base] : []
  }, [unlockedRungoIds])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const parseUnlocked = (raw: string | null): string[] => {
      if (!raw) {
        return [...RUNGO_UNLOCKED_DEFAULT_IDS]
      }

      try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) {
          return [...RUNGO_UNLOCKED_DEFAULT_IDS]
        }

        const knownIds = new Set(ownedKeychains.map((entry) => entry.id))
        const fromStorage = parsed
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry): entry is string => Boolean(entry) && knownIds.has(entry))

        return [...new Set([...RUNGO_UNLOCKED_DEFAULT_IDS, ...fromStorage])]
      } catch {
        return [...RUNGO_UNLOCKED_DEFAULT_IDS]
      }
    }

    const normalizeUnlocked = (value: unknown): string[] => {
      const knownIds = new Set(ownedKeychains.map((entry) => entry.id))
      if (!Array.isArray(value)) {
        return [...RUNGO_UNLOCKED_DEFAULT_IDS]
      }

      const fromValue = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry): entry is string => Boolean(entry) && knownIds.has(entry))

      return [...new Set([...RUNGO_UNLOCKED_DEFAULT_IDS, ...fromValue])]
    }

    setUnlockedRungoIds(parseUnlocked(window.localStorage.getItem(RUNGO_UNLOCKED_STORAGE_KEY)))

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== RUNGO_UNLOCKED_STORAGE_KEY) {
        return
      }
      setUnlockedRungoIds(parseUnlocked(event.newValue))
    }

    const handleUnlockedEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ unlockedRungoIds?: unknown }>
      const nextValue = customEvent.detail?.unlockedRungoIds
      setUnlockedRungoIds(normalizeUnlocked(nextValue))
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('tm-rungo-unlocked-updated', handleUnlockedEvent as EventListener)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('tm-rungo-unlocked-updated', handleUnlockedEvent as EventListener)
    }
  }, [])

  useEffect(() => {
    if (hasExplicitActiveRungos) {
      setRunnerSpeciesByKey(() => {
        const next: Record<string, string> = {}
        runnerModels.forEach((runner, index) => {
          const explicitRungoId = resolvedActiveRungoIds[index]
          if (explicitRungoId && RUNGO_BY_ID[explicitRungoId]) {
            next[runner.key] = explicitRungoId
          }
        })

        return next
      })
      return
    }

    setRunnerSpeciesByKey((previous) => {
      const next: Record<string, string> = {}
      const candidateList = unlockedSpawnCandidates

      runnerModels.forEach((runner) => {
        const existingSpeciesId = previous[runner.key]
        if (existingSpeciesId && candidateList.some((candidate) => candidate.id === existingSpeciesId)) {
          next[runner.key] = existingSpeciesId
          return
        }

        const seedUnit = deterministicUnit((runner.index + 1) * 173 + runnerModels.length * 67 + unlockedRungoIds.length * 23)
        next[runner.key] = resolveWeightedRungoId(candidateList, seedUnit)
      })

      return next
    })
  }, [hasExplicitActiveRungos, resolvedActiveRungoIds, runnerModels, unlockedRungoIds.length, unlockedSpawnCandidates])

  useEffect(() => {
    if (!showRunners || runnerModels.length === 0 || typeof window === 'undefined') {
      return
    }

    let animationFrameId = 0
    const animate = () => {
      setRunnerAnimationNow(Date.now())
      animationFrameId = window.requestAnimationFrame(animate)
    }

    animationFrameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [runnerModels.length, showRunners])

  const resolveRunnerName = useCallback((runnerKey: string) => {
    return normalizeRunnerName(runnerNames[runnerKey])
  }, [runnerNames])

  const resolveAnchorOffset = useCallback((runnerKey: string): {
    x: number
    y: number
    radius: number
    allowRadiusNudge: boolean
    pathScaleX: number
    pathScaleY: number
    pathUnscaleX: number
    pathUnscaleY: number
  } => {
    const defaultRadius = stageRect ? Math.max(92, (stageRect.width / 2) + 8) : 156
    const targetId = runnerAnchorByKey?.[runnerKey] ?? ORB_CENTER_TARGET_ID
    if (targetId === ORB_CENTER_TARGET_ID || !stageRect) {
      return {
        x: 0,
        y: 0,
        radius: defaultRadius,
        allowRadiusNudge: false,
        pathScaleX: 1,
        pathScaleY: 1,
        pathUnscaleX: 1,
        pathUnscaleY: 1,
      }
    }

    const target = runnerDropTargetCenters?.[targetId]
    if (!target) {
      return {
        x: 0,
        y: 0,
        radius: defaultRadius,
        allowRadiusNudge: false,
        pathScaleX: 1,
        pathScaleY: 1,
        pathUnscaleX: 1,
        pathUnscaleY: 1,
      }
    }

    const stageCenterX = stageRect.left + stageRect.width / 2
    const stageCenterY = stageRect.top + stageRect.height / 2
    const pathRadiusX = Math.max(34, (target.width / 2) + 14)
    const pathRadiusY = Math.max(34, (target.height / 2) + 14)
    const radiusFromTarget = Math.min(pathRadiusX, pathRadiusY)
    const pathScaleX = Math.max(1, Math.min(3.3, pathRadiusX / radiusFromTarget))
    const pathScaleY = Math.max(1, Math.min(3.3, pathRadiusY / radiusFromTarget))

    return {
      x: Math.max(-420, Math.min(420, target.x - stageCenterX)),
      y: Math.max(-420, Math.min(420, target.y - stageCenterY)),
      radius: radiusFromTarget,
      allowRadiusNudge: true,
      pathScaleX,
      pathScaleY,
      pathUnscaleX: Number((1 / pathScaleX).toFixed(5)),
      pathUnscaleY: Number((1 / pathScaleY).toFixed(5)),
    }
  }, [runnerAnchorByKey, runnerDropTargetCenters, stageRect])

  const startRunnerRename = useCallback((runnerKey: string, currentName: string, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setEditingRunnerKey(runnerKey)
    setDraftRunnerName(currentName)
    setHoveredRunnerKey(runnerKey)
  }, [])

  const cancelRunnerRename = useCallback(() => {
    setEditingRunnerKey(null)
    setDraftRunnerName('')
  }, [])

  const commitRunnerRename = useCallback((runnerKey: string, fallbackName: string) => {
    const nextName = normalizeRunnerName(draftRunnerName || fallbackName)
    setRunnerNames((previous) => ({
      ...previous,
      [runnerKey]: nextName,
    }))
    setEditingRunnerKey(null)
    setDraftRunnerName('')
  }, [draftRunnerName])

  const resolveDropTargetIdForPoint = useCallback((clientX: number, clientY: number): string => {
    const targetEntries = Object.entries(runnerDropTargetCenters ?? {})
    if (targetEntries.length === 0) {
      return ORB_CENTER_TARGET_ID
    }

    const hitPadding = 10
    const hitTarget = targetEntries.find(([, target]) => {
      const halfWidth = (target.width / 2) + hitPadding
      const halfHeight = (target.height / 2) + hitPadding
      return (
        clientX >= target.x - halfWidth
        && clientX <= target.x + halfWidth
        && clientY >= target.y - halfHeight
        && clientY <= target.y + halfHeight
      )
    })

    if (hitTarget) {
      return hitTarget[0]
    }

    if (runnerDropTargetCenters?.[ORB_CENTER_TARGET_ID]) {
      return ORB_CENTER_TARGET_ID
    }

    let nearestTargetId = ORB_CENTER_TARGET_ID
    let nearestDistance = Number.POSITIVE_INFINITY
    targetEntries.forEach(([targetId, target]) => {
      const deltaX = clientX - target.x
      const deltaY = clientY - target.y
      const distance = (deltaX * deltaX) + (deltaY * deltaY)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestTargetId = targetId
      }
    })

    return nearestTargetId
  }, [runnerDropTargetCenters])

  const beginRunnerPointerDrag = useCallback((runnerKey: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    pointerDragRef.current = {
      runnerKey,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      hasStarted: false,
    }
    setDragPointerClient({
      x: event.clientX,
      y: event.clientY,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
    setHoveredRunnerKey(runnerKey)
  }, [])

  const updateRunnerPointerDrag = useCallback((runnerKey: string, event: React.PointerEvent<HTMLButtonElement>) => {
    const pendingDrag = pointerDragRef.current
    if (!pendingDrag || pendingDrag.runnerKey !== runnerKey || pendingDrag.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const deltaX = event.clientX - pendingDrag.startX
    const deltaY = event.clientY - pendingDrag.startY
    if (!pendingDrag.hasStarted && Math.hypot(deltaX, deltaY) < POINTER_DRAG_START_PX) {
      return
    }

    const activeTargetId = resolveDropTargetIdForPoint(event.clientX, event.clientY)
    if (!pendingDrag.hasStarted) {
      pendingDrag.hasStarted = true
      setDraggingRunnerKey(runnerKey)
    }

    setDragPointerClient({
      x: event.clientX,
      y: event.clientY,
    })

    onRunnerDragStateChange?.({
      isDragging: true,
      runnerKey,
      activeTargetId,
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }, [onRunnerDragStateChange, resolveDropTargetIdForPoint])

  const endRunnerPointerDrag = useCallback((runnerKey: string, event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const pendingDrag = pointerDragRef.current
    if (!pendingDrag || pendingDrag.runnerKey !== runnerKey || pendingDrag.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    pointerDragRef.current = null
    setDragPointerClient(null)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (pendingDrag.hasStarted) {
      if (!cancelled) {
        const targetId = resolveDropTargetIdForPoint(event.clientX, event.clientY)
        const runnerSpeciesId = runnerSpeciesByKey[runnerKey]
        onRunnerAssignAnchor?.(runnerKey, targetId, runnerSpeciesId)
      }

      setDraggingRunnerKey(null)
      onRunnerDragStateChange?.({
        isDragging: false,
        runnerKey: null,
        activeTargetId: null,
        clientX: event.clientX,
        clientY: event.clientY,
      })
    }
  }, [onRunnerAssignAnchor, onRunnerDragStateChange, resolveDropTargetIdForPoint, runnerSpeciesByKey])

  useEffect(() => {
    if (!isExpanded) {
      if (draggingRunnerKey) {
        onRunnerDragStateChange?.({
          isDragging: false,
          runnerKey: null,
          activeTargetId: null,
        })
      }
      pointerDragRef.current = null
      setDragPointerClient(null)
      setHoveredRunnerKey(null)
      setEditingRunnerKey(null)
      setDraftRunnerName('')
      setDraggingRunnerKey(null)
    }
  }, [draggingRunnerKey, isExpanded, onRunnerDragStateChange])

  useEffect(() => {
    if (!showRunners || runnerModels.length === 0) {
      if (draggingRunnerKey) {
        onRunnerDragStateChange?.({
          isDragging: false,
          runnerKey: null,
          activeTargetId: null,
        })
      }
      pointerDragRef.current = null
      setDragPointerClient(null)
      setHoveredRunnerKey(null)
      setEditingRunnerKey(null)
      setDraggingRunnerKey(null)
      setRunnerBehaviorByKey({})
      return
    }

    if (hoveredRunnerKey && !runnerModels.some((runner) => runner.key === hoveredRunnerKey)) {
      setHoveredRunnerKey(null)
    }

    if (editingRunnerKey && !runnerModels.some((runner) => runner.key === editingRunnerKey)) {
      setEditingRunnerKey(null)
      setDraftRunnerName('')
    }

    if (draggingRunnerKey && !runnerModels.some((runner) => runner.key === draggingRunnerKey)) {
      setDraggingRunnerKey(null)
    }
  }, [draggingRunnerKey, editingRunnerKey, hoveredRunnerKey, onRunnerDragStateChange, runnerModels, showRunners])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const raw = window.localStorage.getItem(RUNNER_NAMES_STORAGE_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        setRunnerNames(parsed as Record<string, string>)
      }
    } catch {
      // ignore corrupted storage payloads
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(RUNNER_NAMES_STORAGE_KEY, JSON.stringify(runnerNames))
    } catch {
      // ignore write failures
    }
  }, [runnerNames])

  useEffect(() => {
    if (!showRunners || runnerModels.length === 0 || typeof window === 'undefined') {
      return
    }

    const updateStageRect = () => {
      if (!stageRef.current) {
        return
      }

      setStageRect(stageRef.current.getBoundingClientRect())
    }

    updateStageRect()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        updateStageRect()
      })
      : null

    if (resizeObserver && stageRef.current) {
      resizeObserver.observe(stageRef.current)
    }

    window.addEventListener('resize', updateStageRect)
    window.addEventListener('scroll', updateStageRect, true)

    return () => {
      window.removeEventListener('resize', updateStageRect)
      window.removeEventListener('scroll', updateStageRect, true)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [showRunners, isExpanded, runnerDropTargetCenters])

  useEffect(() => {
    if (!showRunners || runnerModels.length === 0 || typeof window === 'undefined') {
      return
    }

    const now = Date.now()
    setRunnerBehaviorByKey((previous) => {
      const next = { ...previous }
      let changed = false

      runnerModels.forEach((runner) => {
        if (!next[runner.key]) {
          next[runner.key] = createBehaviorState(runner.index, runnerModels.length, now)
          changed = true
        }
      })

      Object.keys(next).forEach((runnerKey) => {
        if (!runnerModels.some((runner) => runner.key === runnerKey)) {
          delete next[runnerKey]
          changed = true
        }
      })

      return changed ? next : previous
    })

    const interval = window.setInterval(() => {
      const tickNow = Date.now()
      setRunnerBehaviorByKey((previous) => {
        const next = { ...previous }
        let changed = false
        const runnerCount = runnerModels.length

        runnerModels.forEach((runner) => {
          let state = next[runner.key] ?? createBehaviorState(runner.index, runnerCount, tickNow)
          let stateChanged = !next[runner.key]
          const isUiPaused = runner.key === hoveredRunnerKey
            || runner.key === editingRunnerKey
            || runner.key === draggingRunnerKey

          if (state.mode === 'running' && !isUiPaused && tickNow >= state.nextDirectionShiftAt) {
            const currentAngleDeg = resolveRunnerOrbitAngleDegForBehavior(runner, state, tickNow)
            const shouldFlipDirection = Math.random() < RUNGO_DIRECTION_SHIFT_CHANCE
            const orbitDirection = shouldFlipDirection
              ? (state.orbitDirection === 1 ? -1 : 1)
              : state.orbitDirection
            state = {
              ...state,
              orbitDirection,
              angleOffsetDeg: shouldFlipDirection
                ? resolveRunnerAngleOffsetDeg(runner, orbitDirection, tickNow, currentAngleDeg)
                : state.angleOffsetDeg,
              nextDirectionShiftAt: resolveNextDirectionShiftAt(runner.index, runnerCount, tickNow),
              orbitFrozenAngleDeg: null,
            }
            stateChanged = true
          }

          if (tickNow >= state.nextSwitchAt) {
            const currentAngleDeg = resolveRunnerOrbitAngleDegForBehavior(runner, state, tickNow)

            if (state.mode === 'bump') {
              const speciesId = runnerSpeciesByKey[runner.key]
                ?? (hasExplicitActiveRungos ? resolvedActiveRungoIds[runner.index] : undefined)
                ?? unlockedSpawnCandidates[0]?.id
                ?? (RUNGO_UNLOCKED_DEFAULT_IDS[0] ?? 'base')
              const fallSprite = resolveSpriteConfigForRungo(speciesId, 'fall')
              const fallDurationMs = Math.max(
                RUNGO_FALL_DURATION_MS,
                fallSprite.frameCount * fallSprite.frameDurationMs,
              )
              const nextFallState = createBehaviorState(runner.index, runnerCount, tickNow, 'fall', fallDurationMs)
              state = {
                ...nextFallState,
                collisionCooldownUntil: Math.max(state.collisionCooldownUntil, tickNow + RUNGO_COLLISION_COOLDOWN_MS),
                orbitDirection: state.orbitDirection,
                angleOffsetDeg: resolveRunnerAngleOffsetDeg(runner, state.orbitDirection, tickNow, currentAngleDeg),
                nextDirectionShiftAt: state.nextDirectionShiftAt,
                impactOffsetX: state.impactOffsetX * 0.42,
                impactOffsetY: state.impactOffsetY * 0.42,
                orbitFrozenAngleDeg: currentAngleDeg,
              }
            } else if (state.mode === 'fall') {
              const recoveredState = createBehaviorState(runner.index, runnerCount, tickNow)
              const shouldFreezeRecovered = recoveredState.mode !== 'running'
              state = {
                ...recoveredState,
                collisionCooldownUntil: state.collisionCooldownUntil,
                orbitDirection: state.orbitDirection,
                angleOffsetDeg: resolveRunnerAngleOffsetDeg(runner, state.orbitDirection, tickNow, currentAngleDeg),
                nextDirectionShiftAt: shouldFreezeRecovered
                  ? state.nextDirectionShiftAt
                  : resolveNextDirectionShiftAt(runner.index, runnerCount, tickNow),
                impactOffsetX: 0,
                impactOffsetY: 0,
                orbitFrozenAngleDeg: shouldFreezeRecovered ? currentAngleDeg : null,
              }
            } else {
              const nextState = createBehaviorState(runner.index, runnerCount, tickNow)
              const shouldFreezeNext = nextState.mode !== 'running'
              state = {
                ...nextState,
                collisionCooldownUntil: state.collisionCooldownUntil,
                orbitDirection: state.orbitDirection,
                angleOffsetDeg: resolveRunnerAngleOffsetDeg(runner, state.orbitDirection, tickNow, currentAngleDeg),
                nextDirectionShiftAt: shouldFreezeNext
                  ? state.nextDirectionShiftAt
                  : resolveNextDirectionShiftAt(runner.index, runnerCount, tickNow),
                impactOffsetX: 0,
                impactOffsetY: 0,
                orbitFrozenAngleDeg: shouldFreezeNext ? currentAngleDeg : null,
              }
            }

            stateChanged = true
          }

          if ((state.mode !== 'running' || isUiPaused) && state.orbitFrozenAngleDeg === null) {
            const frozenAngleDeg = resolveRunnerOrbitAngleDegForBehavior(runner, state, tickNow)
            state = {
              ...state,
              angleOffsetDeg: resolveRunnerAngleOffsetDeg(runner, state.orbitDirection, tickNow, frozenAngleDeg),
              orbitFrozenAngleDeg: frozenAngleDeg,
            }
            stateChanged = true
          }

          if (state.mode === 'running' && !isUiPaused && state.orbitFrozenAngleDeg !== null) {
            state = {
              ...state,
              angleOffsetDeg: resolveRunnerAngleOffsetDeg(runner, state.orbitDirection, tickNow, state.orbitFrozenAngleDeg),
              nextDirectionShiftAt: resolveNextDirectionShiftAt(runner.index, runnerCount, tickNow),
              orbitFrozenAngleDeg: null,
            }
            stateChanged = true
          }

          if (stateChanged) {
            next[runner.key] = state
            changed = true
          }
        })

        if (!draggingRunnerKey && stageRect && runnerCount > 1) {
          const thresholdSquared = RUNGO_COLLISION_DISTANCE_PX * RUNGO_COLLISION_DISTANCE_PX
          const targetByRunnerKey: Record<string, string> = {}
          const isVisuallyMovingByRunnerKey: Record<string, boolean> = {}
          const movementByRunnerKey: Record<string, { x: number; y: number }> = {}
          const positionByRunnerKey: Record<string, { x: number; y: number }> = {}

          runnerModels.forEach((runner) => {
            targetByRunnerKey[runner.key] = runnerAnchorByKey?.[runner.key] ?? ORB_CENTER_TARGET_ID
            const runnerState = next[runner.key]
            const orbitDirection = runnerState?.orbitDirection ?? runner.orbitDirection
            const angleOffsetDeg = runnerState?.angleOffsetDeg ?? 0
            const isUiPaused = runner.key === hoveredRunnerKey
              || runner.key === editingRunnerKey
              || runner.key === draggingRunnerKey
            isVisuallyMovingByRunnerKey[runner.key] = Boolean(runnerState?.mode === 'running' && !isUiPaused)
            const anchorOffset = resolveAnchorOffset(runner.key)
            const orbitAngleDeg = runnerState
              ? resolveRunnerOrbitAngleDegForBehavior(runner, runnerState, tickNow)
              : resolveRunnerOrbitAngleDeg(runner, orbitDirection, angleOffsetDeg, tickNow)
            movementByRunnerKey[runner.key] = resolveRunnerTravelVector(
              orbitDirection,
              anchorOffset.pathScaleX,
              anchorOffset.pathScaleY,
              orbitAngleDeg,
            )
            positionByRunnerKey[runner.key] = resolveRunnerOrbitPosition(
              runner,
              anchorOffset,
              orbitDirection,
              angleOffsetDeg,
              tickNow,
            )
          })

          const collisionLockedKeys = new Set<string>()
          for (let index = 0; index < runnerModels.length; index += 1) {
            const runnerA = runnerModels[index]
            if (collisionLockedKeys.has(runnerA.key)) {
              continue
            }

            for (let compareIndex = index + 1; compareIndex < runnerModels.length; compareIndex += 1) {
              const runnerB = runnerModels[compareIndex]
              if (collisionLockedKeys.has(runnerA.key) || collisionLockedKeys.has(runnerB.key)) {
                continue
              }

              const stateA = next[runnerA.key]
              const stateB = next[runnerB.key]
              if (!stateA || !stateB) {
                continue
              }

              if (targetByRunnerKey[runnerA.key] !== targetByRunnerKey[runnerB.key]) {
                continue
              }

              if (targetByRunnerKey[runnerA.key] !== ORB_CENTER_TARGET_ID) {
                continue
              }

              if (!isVisuallyMovingByRunnerKey[runnerA.key] || !isVisuallyMovingByRunnerKey[runnerB.key]) {
                continue
              }

              if (tickNow < stateA.collisionCooldownUntil || tickNow < stateB.collisionCooldownUntil) {
                continue
              }

              const positionA = positionByRunnerKey[runnerA.key]
              const positionB = positionByRunnerKey[runnerB.key]
              if (!positionA || !positionB) {
                continue
              }

              const deltaX = positionA.x - positionB.x
              const deltaY = positionA.y - positionB.y
              const distanceSquared = (deltaX * deltaX) + (deltaY * deltaY)
              if (distanceSquared > thresholdSquared) {
                continue
              }

              const movementA = movementByRunnerKey[runnerA.key] ?? { x: stateA.orbitDirection, y: 0 }
              const movementB = movementByRunnerKey[runnerB.key] ?? { x: stateB.orbitDirection, y: 0 }
              const distance = Math.sqrt(distanceSquared)
              if (distance < 0.001) {
                continue
              }

              const towardBFromA = {
                x: (positionB.x - positionA.x) / distance,
                y: (positionB.y - positionA.y) / distance,
              }
              const approachA = (movementA.x * towardBFromA.x) + (movementA.y * towardBFromA.y)
              const approachB = (movementB.x * -towardBFromA.x) + (movementB.y * -towardBFromA.y)
              if (approachA <= 0.06 || approachB <= 0.06) {
                continue
              }

              if ((approachA + approachB) < RUNGO_COLLISION_APPROACH_DOT_MIN) {
                continue
              }

              collisionLockedKeys.add(runnerA.key)
              collisionLockedKeys.add(runnerB.key)

              const orbitAngleA = resolveRunnerOrbitAngleDegForBehavior(runnerA, stateA, tickNow)
              const orbitAngleB = resolveRunnerOrbitAngleDegForBehavior(runnerB, stateB, tickNow)

              next[runnerA.key] = {
                ...createBehaviorState(runnerA.index, runnerCount, tickNow, 'bump'),
                collisionCooldownUntil: tickNow + RUNGO_COLLISION_COOLDOWN_MS,
                orbitDirection: stateA.orbitDirection,
                angleOffsetDeg: resolveRunnerAngleOffsetDeg(runnerA, stateA.orbitDirection, tickNow, orbitAngleA),
                nextDirectionShiftAt: stateA.nextDirectionShiftAt,
                impactOffsetX: -movementA.x * RUNGO_BUMP_KNOCKBACK_PX,
                impactOffsetY: -movementA.y * RUNGO_BUMP_KNOCKBACK_PX,
                orbitFrozenAngleDeg: orbitAngleA,
              }
              next[runnerB.key] = {
                ...createBehaviorState(runnerB.index, runnerCount, tickNow, 'bump'),
                collisionCooldownUntil: tickNow + RUNGO_COLLISION_COOLDOWN_MS,
                orbitDirection: stateB.orbitDirection,
                angleOffsetDeg: resolveRunnerAngleOffsetDeg(runnerB, stateB.orbitDirection, tickNow, orbitAngleB),
                nextDirectionShiftAt: stateB.nextDirectionShiftAt,
                impactOffsetX: -movementB.x * RUNGO_BUMP_KNOCKBACK_PX,
                impactOffsetY: -movementB.y * RUNGO_BUMP_KNOCKBACK_PX,
                orbitFrozenAngleDeg: orbitAngleB,
              }
              changed = true
            }
          }
        }

        return changed ? next : previous
      })
    }, RUNNER_BEHAVIOR_TICK_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [
    draggingRunnerKey,
    editingRunnerKey,
    hasExplicitActiveRungos,
    hoveredRunnerKey,
    resolvedActiveRungoIds,
    resolveAnchorOffset,
    runnerAnchorByKey,
    runnerModels,
    runnerSpeciesByKey,
    showRunners,
    stageRect,
    unlockedSpawnCandidates,
  ])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = Boolean(entries[0]?.isIntersecting)
        shell.dataset.orbVisible = isVisible ? 'true' : 'false'
      },
      {
        threshold: 0.12,
      },
    )

    observer.observe(shell)
    return () => {
      observer.disconnect()
    }
  }, [])

  const renderNow = runnerAnimationNow

  return (
    <div
      ref={shellRef}
      className={isExpanded ? 'playtime-orb-shell is-expanded' : 'playtime-orb-shell'}
      data-orb-visible="true"
    >
      <div ref={stageRef} className="playtime-orb-stage" data-runner-count={runnerModels.length}>
        <button
          type="button"
          className={isExpanded ? 'playtime-orb is-expanded' : 'playtime-orb'}
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={`${title} playtime orb`}
        >
          <span className="playtime-orb-gradient" aria-hidden="true" />
          <span className="playtime-orb-particles" aria-hidden="true" />
          <span className="playtime-orb-refraction" aria-hidden="true" />
          <strong>{formatPlaytimeMinutes(totalMinutes)}</strong>
          <span className="playtime-orb-subtitle">{subtitle}</span>
          <span className="playtime-orb-action">{isExpanded ? 'Click to collapse details' : 'Click to expand details'}</span>
        </button>

        {runnerModels.length > 0 && (
          <div className="playtime-runners-overlay" role="group" aria-label="Playtime runners">
            <span className="playtime-runner-track">
              {runnerModels.map((runner) => {
                const behavior = runnerBehaviorByKey[runner.key] ?? createBehaviorState(runner.index, runnerModels.length, renderNow)
                const anchorOffset = resolveAnchorOffset(runner.key)
                const storedRunnerName = resolveRunnerName(runner.key)
                const isDragging = draggingRunnerKey === runner.key
                const isEditing = editingRunnerKey === runner.key
                const isHovered = hoveredRunnerKey === runner.key
                const orbitDirection = behavior.orbitDirection ?? runner.orbitDirection
                const orbitAngleDeg = resolveRunnerOrbitAngleDegForBehavior(runner, behavior, renderNow)
                const effectiveRunMode: RunnerBehaviorMode =
                  behavior.mode === 'bump' || behavior.mode === 'fall'
                    ? behavior.mode
                    : isHovered || isEditing || isDragging
                      ? 'idle'
                      : behavior.mode
                const shouldFreezeOrbit = effectiveRunMode !== 'running'
                const shouldShowTooltip = (isHovered || isEditing) && !isDragging
                const speciesId = runnerSpeciesByKey[runner.key]
                  ?? (hasExplicitActiveRungos ? resolvedActiveRungoIds[runner.index] : undefined)
                  ?? unlockedSpawnCandidates[0]?.id
                  ?? (RUNGO_UNLOCKED_DEFAULT_IDS[0] ?? 'base')
                const overrideRunnerName = rungoNameOverridesById?.[speciesId]?.trim()
                const runnerName = overrideRunnerName || storedRunnerName
                const speciesLabel = resolveDisplayNameForRungo(speciesId)
                const trioRole = rungoRoleById?.[speciesId]
                const trioRoleLabel = trioRole ? RUNGO_TRIO_ROLE_LABELS[trioRole] : null
                const isSignature = Boolean(signatureRungoId && speciesId === signatureRungoId)
                const spriteConfig = resolveSpriteConfigForRungo(speciesId, effectiveRunMode)
                const spriteFrameIndex = resolveSpriteFrameIndex(spriteConfig, behavior.animationStartedAt, renderNow)
                const spriteScale = spriteConfig.frameSizePx === 32 ? 2 : 1
                const runnerDataLabel = `${runnerName} . ${speciesLabel}`
                const dragOffset = isDragging && dragPointerClient && stageRect
                  ? {
                      x: Math.max(-560, Math.min(560, dragPointerClient.x - (stageRect.left + stageRect.width / 2))),
                      y: Math.max(-560, Math.min(560, dragPointerClient.y - (stageRect.top + stageRect.height / 2))),
                    }
                  : null

                return (
                  <span
                    key={runner.key}
                    className={[
                      'playtime-runner',
                      isDragging ? 'is-dragging' : '',
                      isSignature ? 'is-signature' : '',
                      trioRole ? `role-${trioRole}` : '',
                    ].filter(Boolean).join(' ')}
                    data-run-mode={effectiveRunMode}
                    style={
                      {
                        '--runner-angle': `${orbitAngleDeg.toFixed(4)}deg`,
                        '--runner-anchor-offset-x': `${anchorOffset.x.toFixed(2)}px`,
                        '--runner-anchor-offset-y': `${anchorOffset.y.toFixed(2)}px`,
                        '--runner-drag-offset-x': `${(dragOffset?.x ?? anchorOffset.x).toFixed(2)}px`,
                        '--runner-drag-offset-y': `${(dragOffset?.y ?? anchorOffset.y).toFixed(2)}px`,
                        '--runner-orbit-duration': `${runner.orbitSeconds}s`,
                        '--runner-orbit-direction': `${orbitDirection}`,
                        '--runner-orbit-delay': `${runner.orbitDelayMs}ms`,
                        '--runner-target-radius': `${anchorOffset.radius.toFixed(2)}px`,
                        '--runner-path-scale-x': `${anchorOffset.pathScaleX.toFixed(5)}`,
                        '--runner-path-scale-y': `${anchorOffset.pathScaleY.toFixed(5)}`,
                        '--runner-path-unscale-x': `${anchorOffset.pathUnscaleX.toFixed(5)}`,
                        '--runner-path-unscale-y': `${anchorOffset.pathUnscaleY.toFixed(5)}`,
                        '--runner-bob-duration': `${runner.bobMs}ms`,
                        '--runner-play-state': shouldFreezeOrbit ? 'paused' : 'running',
                        '--runner-leg-duration': `${runner.strideMs}ms`,
                        '--runner-leg-right-duration': `${runner.strideRightMs}ms`,
                        '--runner-stride-delay': `${runner.strideDelayMs}ms`,
                        '--runner-radius-nudge': `${runner.radiusNudgePx}px`,
                        '--runner-impact-offset-x': `${(isDragging ? 0 : behavior.impactOffsetX).toFixed(2)}px`,
                        '--runner-impact-offset-y': `${(isDragging ? 0 : behavior.impactOffsetY).toFixed(2)}px`,
                        '--runner-sprite-scale': `${spriteScale}`,
                      } as React.CSSProperties
                    }
                  >
                    <button
                      type="button"
                      className={[
                        'playtime-runner-hit',
                        shouldShowTooltip ? 'is-hovered' : '',
                        isDragging ? 'is-dragging' : '',
                      ].filter(Boolean).join(' ')}
                      onPointerDown={(event) => beginRunnerPointerDrag(runner.key, event)}
                      onPointerMove={(event) => updateRunnerPointerDrag(runner.key, event)}
                      onPointerUp={(event) => endRunnerPointerDrag(runner.key, event)}
                      onPointerCancel={(event) => endRunnerPointerDrag(runner.key, event, true)}
                      onPointerEnter={() => {
                        setHoveredRunnerKey(runner.key)
                      }}
                      onPointerLeave={() => {
                        if (editingRunnerKey === runner.key || draggingRunnerKey === runner.key) {
                          return
                        }
                        setHoveredRunnerKey((previous) => (previous === runner.key ? null : previous))
                      }}
                      onDoubleClick={(event) => startRunnerRename(runner.key, runnerName, event)}
                      tabIndex={-1}
                      aria-label={`${runnerName}: ${speciesLabel}`}
                    >
                      <span className="playtime-runner-pose">
                        <span className="playtime-runner-body">
                          <span
                            className="playtime-runner-sprite"
                            style={
                              {
                                backgroundImage: `url(${spriteConfig.sheetUrl})`,
                                backgroundPosition: `${(-1 * spriteFrameIndex * RUNGO_SPRITE_RENDER_SIZE_PX)}px 0px`,
                                backgroundSize: `${spriteConfig.frameCount * RUNGO_SPRITE_RENDER_SIZE_PX}px ${RUNGO_SPRITE_RENDER_SIZE_PX}px`,
                              } as React.CSSProperties
                            }
                          />
                          <span className="playtime-runner-tears" aria-hidden="true" />
                        </span>
                        {shouldShowTooltip ? (
                          <span
                            className={isEditing ? 'playtime-runner-tooltip is-editing' : 'playtime-runner-tooltip'}
                            role="status"
                            aria-live="polite"
                          >
                            {isEditing ? (
                              <input
                                className="playtime-runner-tooltip-input"
                                value={draftRunnerName}
                                autoFocus
                                onClick={(event) => {
                                  event.stopPropagation()
                                }}
                                onChange={(event) => {
                                  setDraftRunnerName(event.target.value)
                                }}
                                onBlur={() => {
                                  commitRunnerRename(runner.key, runnerName)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    commitRunnerRename(runner.key, runnerName)
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault()
                                    cancelRunnerRename()
                                  }
                                }}
                                placeholder="Name"
                              />
                            ) : (
                              <>
                                <span className="playtime-runner-tooltip-data" title="Double-click runner to rename">
                                  {runnerDataLabel}
                                </span>
                                {trioRoleLabel ? <span className="playtime-runner-tooltip-role">{trioRoleLabel}</span> : null}
                                {isSignature ? <span className="playtime-runner-tooltip-signature">Signature</span> : null}
                              </>
                            )}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </span>
                )
              })}
            </span>
          </div>
        )}
      </div>

      <div className={isExpanded ? 'playtime-orb-details-wrap is-expanded' : 'playtime-orb-details-wrap'}>
        <div className="playtime-orb-details">{children}</div>
      </div>
    </div>
  )
}

export const PlaytimeOrb = memo(PlaytimeOrbBase)
PlaytimeOrb.displayName = 'PlaytimeOrb'
