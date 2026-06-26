import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { RUNGO_UNLOCKED_DEFAULT_IDS, ownedKeychains } from './keychains-data'
import type { Keychain, KeychainAnimationState } from './keychains-data'
import { useKeychainAttachments, type GardenThemeId } from '../features/launcher/hooks/useKeychainAttachments'
import type { GraphicsFidelityMode } from '../features/launcher/types'
import { useSystemTheme } from '../context/SystemThemeContext'
import cursorHoverSprite from '../assets/rungo/assets/CursorHover.png'
import cursorPinchSprite from '../assets/rungo/assets/CursorPinch.png'
import speechBubbleIcon from '../assets/rungo/assets/speechBubble.png'
import favoriteDeselectSound from '../assets/sounds/favoriteDeselect.wav'
import favoriteSelectSound from '../assets/sounds/favoriteSelect.wav'
import iconScrollSound from '../assets/sounds/iconScroll.wav'
import selectedGameSound from '../assets/sounds/selectedGame.wav'
import selectedSystemSound from '../assets/sounds/selectedSystem.wav'
import sidebarCloseSound from '../assets/sounds/defaultClose.wav'
import sidebarOpenSound from '../assets/sounds/defaultOpen.wav'
import { playVariedSoundCue } from '../utils/variedUiSound'
import { emitSignatureRungoReaction } from '../features/launcher/utils/signatureRungoReaction'
import { collectNativeFocusable, focusFirst } from '../features/launcher/utils/controllerFocus'
import { PLAYTIME_PLANET_ENABLED } from '../features/playtime/featureFlags'
import rungoReleaseSound from '../assets/sounds/rungo/rungoRelease.wav'
import {
  AnimatedRungoSprite,
  ROLL_CARD_GAP_PX,
  ROLL_RESOLVE_MS,
  ROLL_TICK_MIN_INTERVAL_MS,
  ROLL_TIER_FLASH_DURATION_MS,
  RungoCollectionGrid,
  RungoCollectionToolbar,
  RungoModalShell,
  RungoRollPanel,
  resolveRungoRarityTier,
  resolveRungoTierLabel,
  resolveSpriteConfig,
  type RungoCollectionFilter,
  type RungoHubTab,
  type RungoRollResultSummary,
  type RungoRarityTier,
} from '../features/rungo'

const DEBUG_MENU_VISIBLE_STORAGE_KEY = 'tm:debugMenuVisible'
const DEBUG_MENU_VISIBILITY_EVENT = 'tm-debug-menu-visibility-changed'
const RUNGO_DRAG_DATA_MIME = 'application/x-tm-rungo-id'
const ACTIVE_RUNGO_DRAG_WINDOW_KEY = '__tmActiveRungoDragId'
const ROLL_COMPACT_CARD_WIDTH_PX = 74
const POINTER_GAMEPLAY_DRAG_START_DISTANCE_PX = 6
const POINTER_GAMEPLAY_CURSOR_RENDER_SIZE_PX = 32
const POINTER_GAMEPLAY_CURSOR_HOVER_FRAME_COUNT = 4
const POINTER_GAMEPLAY_CURSOR_HOVER_FRAME_DURATION_MS = 100
const POINTER_GAMEPLAY_CURSOR_OFFSET_X_PX = -4
const POINTER_GAMEPLAY_CURSOR_OFFSET_Y_PX = -5
const POINTER_GAMEPLAY_CURSOR_HIT_TEST_FRAME_DECIMATION = 2
const POINTER_GAMEPLAY_CURSOR_HIT_TEST_MOVEMENT_THRESHOLD_PX = 6
const POINTER_GAMEPLAY_CLICKABLE_SELECTOR = 'button,[role="button"],a[href],input:not([type="hidden"]),select,textarea,label,[tabindex]:not([tabindex="-1"])'
const RUNGO_CURSOR_DEBUG_SAMPLE_DECIMATION = 1
const GARDEN_BEHAVIOR_TICK_MS = 96
const GARDEN_RUNNER_BASE_BOTTOM_PX = 12
const GARDEN_RUNNER_DEPTH_LIFT_PX = 36
const GARDEN_RUNNER_DROP_GRAVITY_PX_PER_SEC2 = 980
const GARDEN_RUNNER_DROP_MAX_START_OFFSET_PX = 84
const RUNGO_ACTIVITY_LOCK_MS_PLAY = 2000
const GARDEN_VISITOR_LIMIT = 1
const GARDEN_VISITOR_SPAWN_INTERVAL_MS = 11200
const GARDEN_VISITOR_SPAWN_CHANCE = 0.08
const GARDEN_VISITOR_MIN_LIFETIME_MS = 22000
const GARDEN_VISITOR_MAX_LIFETIME_MS = 42000
const GARDEN_TALK_DISTANCE_PX = 62
const GARDEN_BUMP_DISTANCE_PX = 22
const GARDEN_MAD_CHARGE_DISTANCE_PX = 56
const GARDEN_MAD_CHARGE_CHANCE = 0.34
const GARDEN_BUMP_BOTH_FALL_CHANCE = 0.44
const GARDEN_FALL_DURATION_MS = 760
const GARDEN_FALL_BACK_SPEED_PX_PER_SEC = 42
const GARDEN_TALK_COOLDOWN_MS = 3600
const GARDEN_BUBBLE_DURATION_MS = 2100
const RUNGO_RANGE_DEFAULT_NAME = 'Rungo Range'
const RUNGO_RANGE_NAME_STORAGE_KEY = 'tm:rungoRangeName'
const RUNGO_RANGE_WINDOW_POSITION_STORAGE_KEY = 'tm:rungoRangeWindowPosition'
const RUNGO_RANGE_WINDOW_WIDTH_PX = 364
const RUNGO_RANGE_WINDOW_HEIGHT_PX = 320
const RUNGO_RANGE_WINDOW_MARGIN_PX = 16
const RUNGO_LAST_VIEW_STORAGE_KEY = 'tm:rungoLastView'
const RUNGO_RANGE_DISCOVERY_HINT_SEEN_STORAGE_KEY = 'tm:rungoRangeDiscoveryHintSeen'
const RUNGO_INTERACTION_IDLE_TIMEOUT_LITE_MS = 220
const RUNGO_INTERACTION_IDLE_TIMEOUT_ULTRA_MS = 320
const RUNGO_DRAG_GHOST_SIZE_PX = 2

export type RungoModalInitialView = 'compact' | 'range'

function formatGardenThemeShortName(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0]
  return firstWord || name
}

function applyTinyDragGhost(dataTransfer: DataTransfer) {
  if (typeof document === 'undefined' || typeof dataTransfer.setDragImage !== 'function') {
    return
  }

  let dragGhostNode = document.getElementById('tm-rungo-drag-ghost') as HTMLDivElement | null
  if (!dragGhostNode) {
    dragGhostNode = document.createElement('div')
    dragGhostNode.id = 'tm-rungo-drag-ghost'
    dragGhostNode.style.width = `${RUNGO_DRAG_GHOST_SIZE_PX}px`
    dragGhostNode.style.height = `${RUNGO_DRAG_GHOST_SIZE_PX}px`
    dragGhostNode.style.position = 'fixed'
    dragGhostNode.style.left = '-100px'
    dragGhostNode.style.top = '-100px'
    dragGhostNode.style.opacity = '0.01'
    dragGhostNode.style.pointerEvents = 'none'
    dragGhostNode.style.background = 'transparent'
    dragGhostNode.style.border = '0'
    dragGhostNode.style.zIndex = '-1'
    document.body.appendChild(dragGhostNode)
  }

  dataTransfer.setDragImage(dragGhostNode, 0, 0)
}

function setRungoDragPayload(dataTransfer: DataTransfer, rungoId: string) {
  const normalizedRungoId = rungoId.trim()
  if (!normalizedRungoId) {
    return
  }

  dataTransfer.setData(RUNGO_DRAG_DATA_MIME, normalizedRungoId)
  if (typeof window !== 'undefined') {
    const hostWindow = window as unknown as { __tmActiveRungoDragId?: string }
    hostWindow[ACTIVE_RUNGO_DRAG_WINDOW_KEY] = normalizedRungoId
  }
  dataTransfer.effectAllowed = 'copyMove'
  applyTinyDragGhost(dataTransfer)
}

type RungoViewPreference = 'compact' | 'roll' | 'collection' | 'range'
type GardenSpeechMood = 'happy' | 'mad' | 'neutral'
type GardenRunnerMode = 'running' | 'idle' | 'sit' | 'bump' | 'fall'
type GameplayDragKind = 'rungo'
type RungoPointerDragSource = 'runner' | 'roster' | 'unknown'

type GardenVisitorEntry = {
  key: string
  rungoId: string
  expiresAt: number
}

type RangeWindowPosition = {
  x: number
  y: number
}

type GardenRunnerState = {
  key: string
  rungoId: string
  role: 'resident' | 'visitor'
  slotIndex: number | null
  x: number
  lane: number
  depthPercent: number
  dropFallOffsetPx: number
  dropFallVelocityPxPerSec: number
  direction: 1 | -1
  speedPxPerSec: number
  mode: GardenRunnerMode
  nextModeAt: number
  nextDirectionShiftAt: number
  nextTalkAt: number
  bubbleText: string | null
  bubbleMood: GardenSpeechMood
  bubbleUntil: number
  bumpUntil: number
  fallUntil: number
  fallBackDirection: 1 | -1
  conversationPartnerKey: string | null
  conversationTurnsLeft: number
  conversationNextBubbleAt: number
  conversationMood: GardenSpeechMood
  conversationOutcomeMood: GardenSpeechMood
  conversationEndsAt: number
  nextToySeekAt: number
  activityLockUntil: number
}

type ActiveModalDrag = {
  kind: GameplayDragKind
  id: string
}

type PendingPointerGameplayDrag = {
  kind: GameplayDragKind
  id: string
  source: RungoPointerDragSource
  runnerKey: string | null
  pointerId: number
  startX: number
  startY: number
}

type ActivePointerGameplayDrag = {
  kind: GameplayDragKind
  id: string
  source: RungoPointerDragSource
  runnerKey: string | null
  pointerId: number
  x: number
  y: number
}

type PointerGameplayDropTarget =
  | { kind: 'habitat' }
  | { kind: 'runner'; rungoId: string }
  | { kind: 'slot'; slotIndex: number; isUnlockedSlot: boolean }

type PointerPosition = {
  x: number
  y: number
}

function clampGardenDepthPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function resolveGardenDepthPercentFromLane(lane: number): number {
  const normalizedLane = Math.max(0, Math.min(2, lane % 3))
  return clampGardenDepthPercent((normalizedLane / 2) * 100)
}

function resolveGardenRunnerBottomPx(runner: Pick<GardenRunnerState, 'depthPercent' | 'dropFallOffsetPx'>): number {
  const depthLiftPx = (clampGardenDepthPercent(runner.depthPercent) / 100) * GARDEN_RUNNER_DEPTH_LIFT_PX
  return GARDEN_RUNNER_BASE_BOTTOM_PX + depthLiftPx + Math.max(0, runner.dropFallOffsetPx)
}

function deterministicUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function resolveNextGardenDirectionShiftAt(index: number, runnerCount: number, now: number): number {
  const shiftSeed = deterministicUnit((index + 1) * 619 + runnerCount * 47 + Math.floor(now / 500))
  const shiftWindowMs = 12000 + shiftSeed * 10000
  return now + shiftWindowMs
}

const GARDEN_SPEECH_EMOJIS: Record<GardenSpeechMood, string[]> = {
  happy: ['😄', '😊', '✨', '🌈', '🥳', '😁', '😸', '💖', '🎉', '🌟'],
  mad: ['😠', '😡', '💢', '😤', '🤬', '👿', '😾', '🔥', '⚡', '🙄'],
  neutral: ['🙂', '😶', '🤔', '👀', '😐', '🫧', '⭐', '🍃', '🐾', '💬'],
}

function createGardenEmojiSpeech(mood: GardenSpeechMood, seed: number): string {
  const pool = GARDEN_SPEECH_EMOJIS[mood]
  const count = 1 + Math.floor(deterministicUnit(seed) * 3)
  const parts = Array.from({ length: count }, (_, index) => {
    const emojiIndex = Math.floor(deterministicUnit(seed + (index + 1) * 137) * pool.length)
    return pool[emojiIndex] ?? pool[0] ?? '🙂'
  })
  return parts.join('')
}

function formatAnimationModeLabel(mode: KeychainAnimationState): string {
  if (mode === 'running') {
    return 'Running'
  }

  if (mode === 'idle') {
    return 'Idle'
  }

  if (mode === 'sit') {
    return 'Sit'
  }

  if (mode === 'bump') {
    return 'Bump'
  }

  return 'Fall'
}

function pickWeightedRungoForReel(): Keychain {
  const spawnEligible = ownedKeychains.filter((entry) => entry.isSpawnEligible)
  const fallback = ownedKeychains[0]
  if (!fallback) {
    throw new Error('No Rungos configured in catalog.')
  }

  if (spawnEligible.length === 0) {
    return fallback
  }

  const totalWeight = spawnEligible.reduce((total, entry) => total + Math.max(0.001, entry.rarityWeight), 0)
  let cursor = Math.random() * totalWeight
  for (const entry of spawnEligible) {
    cursor -= Math.max(0.001, entry.rarityWeight)
    if (cursor <= 0) {
      return entry
    }
  }

  return spawnEligible[spawnEligible.length - 1] ?? fallback
}

function buildRollStrip(awardedRungoId: string): { strip: string[]; winnerIndex: number } {
  const totalCards = 25
  const winnerIndex = 16
  const strip = Array.from({ length: totalCards }, () => pickWeightedRungoForReel().id)
  strip[winnerIndex] = awardedRungoId
  return { strip, winnerIndex }
}

function readDebugMenuVisibility(): boolean {
  if (!import.meta.env.DEV) {
    return false
  }

  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(DEBUG_MENU_VISIBLE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function readRangeWindowName(): string {
  if (typeof window === 'undefined') {
    return RUNGO_RANGE_DEFAULT_NAME
  }

  try {
    const stored = window.localStorage.getItem(RUNGO_RANGE_NAME_STORAGE_KEY)
    const normalized = stored?.trim()
    return normalized ? normalized : RUNGO_RANGE_DEFAULT_NAME
  } catch {
    return RUNGO_RANGE_DEFAULT_NAME
  }
}

function getDefaultRangeWindowPosition(): RangeWindowPosition {
  if (typeof window === 'undefined') {
    return {
      x: RUNGO_RANGE_WINDOW_MARGIN_PX,
      y: RUNGO_RANGE_WINDOW_MARGIN_PX,
    }
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  return {
    x: Math.max(RUNGO_RANGE_WINDOW_MARGIN_PX, viewportWidth - RUNGO_RANGE_WINDOW_WIDTH_PX - 34),
    y: Math.max(RUNGO_RANGE_WINDOW_MARGIN_PX, viewportHeight - RUNGO_RANGE_WINDOW_HEIGHT_PX - 46),
  }
}

function clampRangeWindowPosition(position: RangeWindowPosition): RangeWindowPosition {
  if (typeof window === 'undefined') {
    return position
  }

  const maxX = Math.max(RUNGO_RANGE_WINDOW_MARGIN_PX, window.innerWidth - RUNGO_RANGE_WINDOW_WIDTH_PX - RUNGO_RANGE_WINDOW_MARGIN_PX)
  const maxY = Math.max(RUNGO_RANGE_WINDOW_MARGIN_PX, window.innerHeight - RUNGO_RANGE_WINDOW_HEIGHT_PX - RUNGO_RANGE_WINDOW_MARGIN_PX)
  return {
    x: Math.max(RUNGO_RANGE_WINDOW_MARGIN_PX, Math.min(position.x, maxX)),
    y: Math.max(RUNGO_RANGE_WINDOW_MARGIN_PX, Math.min(position.y, maxY)),
  }
}

function readRangeWindowPosition(): RangeWindowPosition {
  const fallback = getDefaultRangeWindowPosition()
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const stored = window.localStorage.getItem(RUNGO_RANGE_WINDOW_POSITION_STORAGE_KEY)
    if (!stored) {
      return fallback
    }

    const parsed = JSON.parse(stored) as Partial<RangeWindowPosition>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return fallback
    }

    return clampRangeWindowPosition({ x: parsed.x, y: parsed.y })
  } catch {
    return fallback
  }
}

function writeRangeWindowPosition(position: RangeWindowPosition) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RUNGO_RANGE_WINDOW_POSITION_STORAGE_KEY, JSON.stringify(position))
  } catch {
    // Ignore storage errors for this optional preference.
  }
}

function writeRangeWindowName(name: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RUNGO_RANGE_NAME_STORAGE_KEY, name)
  } catch {
    // Ignore storage errors for this optional preference.
  }
}

function playSoundCue(soundUrl: string, volume = 0.56) {
  playVariedSoundCue(soundUrl, volume)
}

function resolveHubTabFromPreference(preference: RungoViewPreference): RungoHubTab {
  if (preference === 'range') {
    return 'garden'
  }

  return 'collection'
}

function readLastRungoViewPreference(initialView?: RungoModalInitialView): RungoViewPreference {
  if (initialView === 'range') {
    return 'range'
  }

  if (typeof window === 'undefined') {
    return 'compact'
  }

  try {
    const stored = window.localStorage.getItem(RUNGO_LAST_VIEW_STORAGE_KEY)
    if (stored === 'roll') {
      return 'collection'
    }

    if (stored === 'collection' || stored === 'range' || stored === 'compact') {
      return stored
    }
  } catch {
    // Ignore storage errors and fall back to compact mode.
  }

  return 'compact'
}

function writeLastRungoViewPreference(value: RungoViewPreference) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RUNGO_LAST_VIEW_STORAGE_KEY, value)
  } catch {
    // Ignore storage errors for this optional preference.
  }
}

function readRangeDiscoveryHintSeen(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    return window.localStorage.getItem(RUNGO_RANGE_DISCOVERY_HINT_SEEN_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function writeRangeDiscoveryHintSeen() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RUNGO_RANGE_DISCOVERY_HINT_SEEN_STORAGE_KEY, '1')
  } catch {
    // Ignore storage errors for this optional preference.
  }
}

export function KeychainAttachmentPreview({
  keychainId,
  size = 92,
}: {
  keychainId: string
  size?: number
}) {
  const keychain = useMemo(() => ownedKeychains.find((entry) => entry.id === keychainId) ?? null, [keychainId])
  if (!keychain) {
    return null
  }

  return (
    <div
      className="keychain-attachment-preview"
      style={{
        width: size,
        height: size,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <div
        className="keychain-attachment-preview-inner"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span className="keychain-anchor-pin" aria-hidden="true" />
        <span className="keychain-attachment-preview-runner" aria-hidden="true">
          <AnimatedRungoSprite keychain={keychain} mode="running" size={Math.round(size * 0.34)} isAnimated />
        </span>
      </div>
    </div>
  )
}

function KeychainDetail({
  keychain,
  isUnlocked,
  isSignature,
  onSetSignature,
}: {
  keychain: Keychain
  isUnlocked: boolean
  isSignature: boolean
  onSetSignature?: () => void
}) {
  const availableAnimationModes = useMemo<KeychainAnimationState[]>(() => {
    const allModes: KeychainAnimationState[] = ['running', 'idle', 'sit', 'bump', 'fall']
    return allModes.filter((mode) => Boolean(resolveSpriteConfig(keychain, mode)))
  }, [keychain])
  const [activeAnimationMode, setActiveAnimationMode] = useState<KeychainAnimationState>('running')

  useEffect(() => {
    if (availableAnimationModes.includes(activeAnimationMode)) {
      return
    }

    setActiveAnimationMode(availableAnimationModes[0] ?? 'running')
  }, [activeAnimationMode, availableAnimationModes])

  const rarityTier = resolveRungoRarityTier(keychain)

  return (
    <div className="keychain-detail-modal">
      <div className="keychain-detail-body is-stacked">
        <div
          className={[
            'rungo-detail-card',
            `tier-${rarityTier}`,
            isUnlocked ? '' : 'is-locked',
          ].filter(Boolean).join(' ')}
        >
          <AnimatedRungoSprite keychain={keychain} mode={activeAnimationMode} size={132} isLocked={!isUnlocked} isAnimated />
          {!isUnlocked ? <span className="rungo-detail-lock">🔒</span> : null}
        </div>

        <div className="rungo-detail-meta">
          <div className="rungo-key-detail-title-row">
            <div className="rungo-key-detail-title">
              {isUnlocked ? keychain.name : `??? ${keychain.name}`}
            </div>
            <span className={`rungo-rarity-inline tier-${rarityTier}`}>
              {resolveRungoTierLabel(rarityTier)}
            </span>
            {isUnlocked ? (
              <button
                type="button"
                className={isSignature ? 'rungo-key-detail-signature-button is-active' : 'rungo-key-detail-signature-button'}
                onClick={() => {
                  onSetSignature?.()
                }}
              >
                {isSignature ? 'Signature' : 'Set signature'}
              </button>
            ) : null}
          </div>
          {(isUnlocked ? keychain.description.trim() : keychain.unlockHint.trim()) ? (
            <div className="rungo-key-detail-description">
              {isUnlocked ? keychain.description.trim() : keychain.unlockHint.trim()}
            </div>
          ) : null}
          {availableAnimationModes.length > 1 ? (
            <div className="rungo-animation-viewer" aria-label="Animations">
              <div className="rungo-animation-viewer-grid">
                {availableAnimationModes.map((mode) => {
                  const isSelectedMode = activeAnimationMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      className={isSelectedMode ? 'rungo-animation-chip is-active' : 'rungo-animation-chip'}
                      onClick={() => {
                        setActiveAnimationMode(mode)
                      }}
                      aria-pressed={isSelectedMode}
                      aria-label={formatAnimationModeLabel(mode)}
                      title={formatAnimationModeLabel(mode)}
                    >
                      {formatAnimationModeLabel(mode).slice(0, 1)}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type GameplayPointerCursorProps = {
  isVisible: boolean
  className: string
  sizePx: number
  spriteUrl: string
  frameIndex: number
  sheetFrameCount: number
  draggedRungo: Keychain | null
  cursorRef: (node: HTMLDivElement | null) => void
}

const GameplayPointerCursor = memo(function GameplayPointerCursor({
  isVisible,
  className,
  sizePx,
  spriteUrl,
  frameIndex,
  sheetFrameCount,
  draggedRungo,
  cursorRef,
}: GameplayPointerCursorProps) {
  if (!isVisible || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      ref={cursorRef}
      className={className}
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
      }}
      aria-hidden="true"
    >
      <span
        className="rungo-pointer-drag-cursor-sprite"
        style={{
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          backgroundImage: `url(${spriteUrl})`,
          backgroundPosition: `${-1 * frameIndex * sizePx}px 0px`,
          backgroundSize: `${sheetFrameCount * sizePx}px ${sizePx}px`,
        }}
      />
      {draggedRungo ? (
        <span className="rungo-pointer-drag-carry">
          <AnimatedRungoSprite
            keychain={draggedRungo}
            mode="running"
            size={40}
            isAnimated
            centered
          />
        </span>
      ) : null}
    </div>,
    document.body,
  )
})

GameplayPointerCursor.displayName = 'GameplayPointerCursor'

export function KeychainGalleryModal({
  onClose,
  initialView,
  graphicsFidelity = 'normal',
}: {
  onClose: () => void
  initialView?: RungoModalInitialView
  graphicsFidelity?: GraphicsFidelityMode
}) {
  const systemTheme = useSystemTheme()
  const {
    unlockedRungoIds,
    isRungoUnlocked,
    unlockRungo,
    lockRungo,
    debugRollRungo,
    rungoTokenBalance,
    gardenSeedBalance,
    gardenUnlockedSlotCount,
    gardenMaxSlotCount,
    gardenSlotAssignments,
    getGardenSlotUnlockCost,
    unlockNextGardenSlot,
    setGardenSlotRungo,
    gardenThemes,
    gardenUnlockedThemeIds,
    activeGardenThemeId,
    setActiveGardenTheme,
    rangeProgression,
    hasRangePerk,
    rollRungoWithToken,
    signatureRungoId,
    setSignatureRungoId,
  } = useKeychainAttachments()
  const initialViewPreference = useMemo(() => readLastRungoViewPreference(initialView), [initialView])
  const initialHubTab = useMemo(() => resolveHubTabFromPreference(initialViewPreference), [initialViewPreference])
  const isRungoUltraLite = graphicsFidelity === 'ultra-lite'
  const interactionIdleTimeoutMs = isRungoUltraLite
    ? RUNGO_INTERACTION_IDLE_TIMEOUT_ULTRA_MS
    : RUNGO_INTERACTION_IDLE_TIMEOUT_LITE_MS
  const [selectedKeychainId, setSelectedKeychainId] = useState<string | null>(ownedKeychains[0]?.id ?? null)

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const modal = document.querySelector<HTMLElement>('.keychain-gallery-modal')
      if (!modal) {
        return
      }

      focusFirst(collectNativeFocusable(modal), false)
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [])

  const [hubTab, setHubTab] = useState<RungoHubTab>(() => initialHubTab)
  const [isDebugMode, setIsDebugMode] = useState<boolean>(() => readDebugMenuVisibility())
  const [debugRollStatus, setDebugRollStatus] = useState('')
  const [rollStatus, setRollStatus] = useState('')
  const [gardenStatus, setGardenStatus] = useState('')
  const [selectedGardenRungoId, setSelectedGardenRungoId] = useState<string | null>(null)
  const [selectedGardenSlotIndex, setSelectedGardenSlotIndex] = useState<number | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [rollStripIds, setRollStripIds] = useState<string[]>([])
  const [rollWinnerIndex, setRollWinnerIndex] = useState<number | null>(null)
  const [rollAnimationKey, setRollAnimationKey] = useState(0)
  const [lastRolledRungoId, setLastRolledRungoId] = useState<string | null>(null)
  const [rollTierFlashTier, setRollTierFlashTier] = useState<RungoRarityTier | null>(null)
  const [collectionSearch, setCollectionSearch] = useState('')
  const deferredCollectionSearch = useDeferredValue(collectionSearch)
  const [collectionFilter, setCollectionFilter] = useState<RungoCollectionFilter>('all')
  const [rollResultSummary, setRollResultSummary] = useState<RungoRollResultSummary | null>(null)
  const [rollReelMetrics, setRollReelMetrics] = useState({
    width: 0,
    paddingLeft: 0,
    cardWidth: 0,
    cardGap: ROLL_CARD_GAP_PX,
  })
  const [gardenHabitatMetrics, setGardenHabitatMetrics] = useState({
    width: 760,
    height: 320,
  })
  const [gardenVisitors, setGardenVisitors] = useState<GardenVisitorEntry[]>([])
  const [gardenRunnerStates, setGardenRunnerStates] = useState<GardenRunnerState[]>([])
  const [gardenNow, setGardenNow] = useState<number>(() => Date.now())
  const [rungoRangeName, setRungoRangeName] = useState<string>(() => readRangeWindowName())
  const [rungoRangeDraftName, setRungoRangeDraftName] = useState<string>(() => readRangeWindowName())
  const [isEditingRangeName, setIsEditingRangeName] = useState(false)
  const [isRangePopupOpen, setIsRangePopupOpen] = useState(false)
  const [isPanelMinimized, setIsPanelMinimized] = useState(false)
  const [isRangeDiscoveryHintVisible, setIsRangeDiscoveryHintVisible] = useState(() => !readRangeDiscoveryHintSeen())
  const [isGardenItemDragOver, setIsGardenItemDragOver] = useState(false)
  const [activeGardenRunnerDropRungoId, setActiveGardenRunnerDropRungoId] = useState<string | null>(null)
  const [activeGardenSlotDropIndex, setActiveGardenSlotDropIndex] = useState<number | null>(null)
  const [isRungoDragActive, setIsRungoDragActive] = useState(false)
  const [isRungoInteractionActive, setIsRungoInteractionActive] = useState(false)
  const [activeNativeDragPreview, setActiveNativeDragPreview] = useState<ActiveModalDrag | null>(null)
  const [activePointerGameplayDrag, setActivePointerGameplayDrag] = useState<ActivePointerGameplayDrag | null>(null)
  const [activePointerGameplayDropTarget, setActivePointerGameplayDropTarget] = useState<PointerGameplayDropTarget | null>(null)
  const [hasPointerGameplayCursorPosition, setHasPointerGameplayCursorPosition] = useState(false)
  const [isPointerInGameplayArea, setIsPointerInGameplayArea] = useState(false)
  const [isPointerOverGameplayMovable, setIsPointerOverGameplayMovable] = useState(false)
  const [pointerGameplayCursorDebugLastPosition, setPointerGameplayCursorDebugLastPosition] = useState<PointerPosition | null>(null)
  const [pointerGameplayHoverFrame, setPointerGameplayHoverFrame] = useState(0)
  const [isPointerGameplayTracking, setIsPointerGameplayTracking] = useState(false)
  const [isDraggingRangePopup, setIsDraggingRangePopup] = useState(false)
  const [rangePopupPosition, setRangePopupPosition] = useState<RangeWindowPosition>(() => readRangeWindowPosition())
  const rollResolveTimerRef = useRef<number | null>(null)
  const pendingRollRef = useRef<{
    awardedRungo: Keychain
    result: ReturnType<typeof rollRungoWithToken>
  } | null>(null)
  const [rollStartRequestKey, setRollStartRequestKey] = useState(0)
  const [rollLockedTrackOffsetPx, setRollLockedTrackOffsetPx] = useState<number | null>(null)
  const rollTierFlashTimerRef = useRef<number | null>(null)
  const interactionIdleTimeoutRef = useRef<number | null>(null)
  const rollReelShellRef = useRef<HTMLDivElement | null>(null)
  const gardenHabitatRef = useRef<HTMLDivElement | null>(null)
  const gardenRunnerStatesRef = useRef<GardenRunnerState[]>([])
  const hasCozyChatPerkRef = useRef(hasRangePerk('cozy-chat'))
  const rangePopupRef = useRef<HTMLDivElement | null>(null)
  const rangePopupDragOffsetRef = useRef<RangeWindowPosition>({ x: 0, y: 0 })
  const rangePopupPositionRef = useRef<RangeWindowPosition>(rangePopupPosition)
  const rangePopupDragPointerRef = useRef<{ x: number; y: number } | null>(null)
  const rangePopupDragAnimationFrameRef = useRef<number | null>(null)
  const activeModalDragRef = useRef<ActiveModalDrag | null>(null)
  const pendingPointerGameplayDragRef = useRef<PendingPointerGameplayDrag | null>(null)
  const activePointerGameplayDragRef = useRef<ActivePointerGameplayDrag | null>(null)
  const activePointerGameplayDropTargetRef = useRef<PointerGameplayDropTarget | null>(null)
  const pointerGameplayCursorPositionRef = useRef<PointerPosition | null>(null)
  const pointerGameplayCursorNodeRef = useRef<HTMLDivElement | null>(null)
  const pointerGameplayCursorAnimationFrameRef = useRef<number | null>(null)
  const pointerGameplayCursorDebugSampleFrameRef = useRef(0)
  const pointerGameplayHitTestFrameRef = useRef(0)
  const pointerGameplayLastHitTestPositionRef = useRef<PointerPosition | null>(null)
  const pointerGameplayLastHitStackRef = useRef<Element[]>([])

  const clearInteractionIdleTimeout = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (interactionIdleTimeoutRef.current !== null) {
      window.clearTimeout(interactionIdleTimeoutRef.current)
      interactionIdleTimeoutRef.current = null
    }
  }, [])

  const markRungoInteractionActive = useCallback(() => {
    clearInteractionIdleTimeout()
    setIsRungoInteractionActive(true)
  }, [clearInteractionIdleTimeout])

  const scheduleRungoInteractionIdle = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    clearInteractionIdleTimeout()
    interactionIdleTimeoutRef.current = window.setTimeout(() => {
      setIsRungoInteractionActive(false)
      interactionIdleTimeoutRef.current = null
    }, interactionIdleTimeoutMs)
  }, [clearInteractionIdleTimeout, interactionIdleTimeoutMs])

  const beginRungoDragInteraction = useCallback(() => {
    markRungoInteractionActive()
    setIsRungoDragActive(true)
  }, [markRungoInteractionActive])

  const clearPointerGameplayDragState = useCallback(() => {
    pendingPointerGameplayDragRef.current = null
    activePointerGameplayDragRef.current = null
    activePointerGameplayDropTargetRef.current = null
    pointerGameplayHitTestFrameRef.current = 0
    pointerGameplayLastHitTestPositionRef.current = null
    pointerGameplayLastHitStackRef.current = []
    setIsPointerGameplayTracking(false)
    setActivePointerGameplayDrag(null)
    setActivePointerGameplayDropTarget(null)
    setIsGardenItemDragOver(false)
    setActiveGardenRunnerDropRungoId(null)
    setActiveGardenSlotDropIndex(null)
  }, [])

  const endRungoDragInteraction = useCallback(() => {
    clearPointerGameplayDragState()
    if (typeof window !== 'undefined') {
      const hostWindow = window as unknown as { __tmActiveRungoDragId?: string }
      delete hostWindow[ACTIVE_RUNGO_DRAG_WINDOW_KEY]
    }
    setActiveNativeDragPreview(null)
    setIsRungoDragActive(false)
    activeModalDragRef.current = null
    scheduleRungoInteractionIdle()
  }, [clearPointerGameplayDragState, scheduleRungoInteractionIdle])

  const applyPointerGameplayCursorTransformNow = useCallback((pointerPosition: PointerPosition | null) => {
    const cursorNode = pointerGameplayCursorNodeRef.current
    if (!cursorNode || !pointerPosition) {
      return
    }

    let renderX = pointerPosition.x + POINTER_GAMEPLAY_CURSOR_OFFSET_X_PX
    let renderY = pointerPosition.y + POINTER_GAMEPLAY_CURSOR_OFFSET_Y_PX

    if (typeof window !== 'undefined') {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const fallbackMargin = POINTER_GAMEPLAY_CURSOR_RENDER_SIZE_PX

      const isLikelyOutsideViewport = (
        renderX < -fallbackMargin
        || renderY < -fallbackMargin
        || renderX > viewportWidth + fallbackMargin
        || renderY > viewportHeight + fallbackMargin
      )

      if (isLikelyOutsideViewport && dpr > 1) {
        renderX /= dpr
        renderY /= dpr
      }

      renderX = Math.min(Math.max(renderX, -fallbackMargin), viewportWidth + fallbackMargin)
      renderY = Math.min(Math.max(renderY, -fallbackMargin), viewportHeight + fallbackMargin)
    }

    cursorNode.style.left = `${renderX.toFixed(1)}px`
    cursorNode.style.top = `${renderY.toFixed(1)}px`
    cursorNode.style.transform = 'translate3d(0, 0, 0)'
  }, [])

  const queuePointerGameplayCursorTransform = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (pointerGameplayCursorAnimationFrameRef.current !== null) {
      return
    }

    pointerGameplayCursorAnimationFrameRef.current = window.requestAnimationFrame(() => {
      pointerGameplayCursorAnimationFrameRef.current = null
      applyPointerGameplayCursorTransformNow(pointerGameplayCursorPositionRef.current)
    })
  }, [applyPointerGameplayCursorTransformNow])

  const setPointerGameplayCursorPositionRef = useCallback((pointerPosition: PointerPosition | null) => {
    pointerGameplayCursorPositionRef.current = pointerPosition
    setHasPointerGameplayCursorPosition((previous) => {
      const next = Boolean(pointerPosition)
      return previous === next ? previous : next
    })

    if (isDebugMode && pointerPosition) {
      pointerGameplayCursorDebugSampleFrameRef.current += 1
      if (pointerGameplayCursorDebugSampleFrameRef.current % RUNGO_CURSOR_DEBUG_SAMPLE_DECIMATION === 0) {
        setPointerGameplayCursorDebugLastPosition({
          x: Math.round(pointerPosition.x),
          y: Math.round(pointerPosition.y),
        })
      }
    }

    if (pointerPosition) {
      queuePointerGameplayCursorTransform()
    }
  }, [isDebugMode, queuePointerGameplayCursorTransform])

  useEffect(() => {
    if (isDebugMode) {
      return
    }

    pointerGameplayCursorDebugSampleFrameRef.current = 0
    setPointerGameplayCursorDebugLastPosition(null)
  }, [isDebugMode])

  const setPointerGameplayCursorNode = useCallback((node: HTMLDivElement | null) => {
    pointerGameplayCursorNodeRef.current = node
    if (!node) {
      return
    }

    applyPointerGameplayCursorTransformNow(pointerGameplayCursorPositionRef.current)
  }, [applyPointerGameplayCursorTransformNow])

  const resetPointerGameplayHitSampling = useCallback(() => {
    pointerGameplayHitTestFrameRef.current = 0
    pointerGameplayLastHitTestPositionRef.current = null
    pointerGameplayLastHitStackRef.current = []
  }, [])

  const resolvePointerGameplayHitStack = useCallback((pointerPosition: PointerPosition, force = false): Element[] => {
    if (typeof document === 'undefined') {
      return []
    }

    pointerGameplayHitTestFrameRef.current += 1
    const lastPosition = pointerGameplayLastHitTestPositionRef.current
    const movedDistance = lastPosition
      ? Math.hypot(pointerPosition.x - lastPosition.x, pointerPosition.y - lastPosition.y)
      : Number.POSITIVE_INFINITY
    const shouldSample = force
      || pointerGameplayLastHitStackRef.current.length === 0
      || movedDistance >= POINTER_GAMEPLAY_CURSOR_HIT_TEST_MOVEMENT_THRESHOLD_PX
      || (pointerGameplayHitTestFrameRef.current % POINTER_GAMEPLAY_CURSOR_HIT_TEST_FRAME_DECIMATION === 0)

    if (!shouldSample) {
      return pointerGameplayLastHitStackRef.current
    }

    const hitStack = document.elementsFromPoint(pointerPosition.x, pointerPosition.y)
    pointerGameplayLastHitTestPositionRef.current = pointerPosition
    pointerGameplayLastHitStackRef.current = hitStack
    return hitStack
  }, [])

  const applyRangePopupTransform = useCallback((position: RangeWindowPosition) => {
    const popupNode = rangePopupRef.current
    if (!popupNode) {
      return
    }

    popupNode.style.setProperty('--rungo-popup-x', `${position.x}px`)
    popupNode.style.setProperty('--rungo-popup-y', `${position.y}px`)
  }, [])

  useEffect(() => {
    return () => {
      if (interactionIdleTimeoutRef.current !== null) {
        window.clearTimeout(interactionIdleTimeoutRef.current)
        interactionIdleTimeoutRef.current = null
      }

      if (rollTierFlashTimerRef.current !== null) {
        window.clearTimeout(rollTierFlashTimerRef.current)
        rollTierFlashTimerRef.current = null
      }

      if (pointerGameplayCursorAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerGameplayCursorAnimationFrameRef.current)
        pointerGameplayCursorAnimationFrameRef.current = null
      }

      if (rangePopupDragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(rangePopupDragAnimationFrameRef.current)
        rangePopupDragAnimationFrameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const syncDebugState = () => {
      setIsDebugMode(readDebugMenuVisibility())
    }

    const handleDebugVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<{ visible?: unknown }>
      if (typeof customEvent.detail?.visible === 'boolean') {
        setIsDebugMode(customEvent.detail.visible)
        return
      }

      syncDebugState()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEBUG_MENU_VISIBLE_STORAGE_KEY) {
        syncDebugState()
      }
    }

    syncDebugState()
    window.addEventListener(DEBUG_MENU_VISIBILITY_EVENT, handleDebugVisibility as EventListener)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(DEBUG_MENU_VISIBILITY_EVENT, handleDebugVisibility as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    playSoundCue(sidebarOpenSound, 0.52)

    return () => {
      playSoundCue(sidebarCloseSound, 0.52)

      if (rollResolveTimerRef.current) {
        window.clearTimeout(rollResolveTimerRef.current)
        rollResolveTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const viewPreference: RungoViewPreference = hubTab === 'garden' ? 'range' : 'compact'
    writeLastRungoViewPreference(viewPreference)
  }, [hubTab])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.body.classList.add('rungo-panel-open')
    return () => {
      document.body.classList.remove('rungo-panel-open')
    }
  }, [])

  useEffect(() => {
    setRungoRangeDraftName(rungoRangeName)
  }, [rungoRangeName])

  useEffect(() => {
    rangePopupPositionRef.current = rangePopupPosition
  }, [rangePopupPosition])

  useEffect(() => {
    if (!isRangePopupOpen) {
      return
    }

    applyRangePopupTransform(rangePopupPosition)
  }, [applyRangePopupTransform, isRangePopupOpen, rangePopupPosition])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isDraggingRangePopup) {
      return
    }

    const flushRangePopupDrag = () => {
      rangePopupDragAnimationFrameRef.current = null

      const pointer = rangePopupDragPointerRef.current
      if (!pointer) {
        return
      }

      const nextPosition = clampRangeWindowPosition({
        x: pointer.x - rangePopupDragOffsetRef.current.x,
        y: pointer.y - rangePopupDragOffsetRef.current.y,
      })
      rangePopupPositionRef.current = nextPosition
      applyRangePopupTransform(nextPosition)
    }

    const queueRangePopupDrag = () => {
      if (rangePopupDragAnimationFrameRef.current !== null) {
        return
      }

      rangePopupDragAnimationFrameRef.current = window.requestAnimationFrame(flushRangePopupDrag)
    }

    const handlePointerMove = (event: PointerEvent) => {
      rangePopupDragPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
      queueRangePopupDrag()
    }

    const stopDragging = () => {
      if (rangePopupDragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(rangePopupDragAnimationFrameRef.current)
        rangePopupDragAnimationFrameRef.current = null
      }

      const pointer = rangePopupDragPointerRef.current
      if (pointer) {
        const nextPosition = clampRangeWindowPosition({
          x: pointer.x - rangePopupDragOffsetRef.current.x,
          y: pointer.y - rangePopupDragOffsetRef.current.y,
        })
        rangePopupPositionRef.current = nextPosition
        applyRangePopupTransform(nextPosition)
      }

      rangePopupDragPointerRef.current = null
      setIsDraggingRangePopup(false)
      endRungoDragInteraction()

      const committedPosition = rangePopupPositionRef.current
      setRangePopupPosition((previous) => {
        if (previous.x === committedPosition.x && previous.y === committedPosition.y) {
          return previous
        }

        return committedPosition
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)

      if (rangePopupDragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(rangePopupDragAnimationFrameRef.current)
        rangePopupDragAnimationFrameRef.current = null
      }
    }
  }, [applyRangePopupTransform, endRungoDragInteraction, isDraggingRangePopup])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setRangePopupPosition((previous) => clampRangeWindowPosition(previous))
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const clearDragMode = () => {
      endRungoDragInteraction()
    }

    window.addEventListener('dragend', clearDragMode)

    return () => {
      window.removeEventListener('dragend', clearDragMode)
    }
  }, [endRungoDragInteraction])

  useEffect(() => {
    writeRangeWindowPosition(rangePopupPosition)
  }, [rangePopupPosition])

  useEffect(() => {
    gardenRunnerStatesRef.current = gardenRunnerStates
  }, [gardenRunnerStates])

  useEffect(() => {
    hasCozyChatPerkRef.current = hasRangePerk('cozy-chat')
  }, [hasRangePerk, rangeProgression.unlockedPerkIds])

  const unlockedCount = useMemo(() => {
    return ownedKeychains.filter((entry) => unlockedRungoIds.includes(entry.id)).length
  }, [unlockedRungoIds])

  const selectedKeychain = useMemo(
    () => ownedKeychains.find((entry) => entry.id === selectedKeychainId) ?? null,
    [selectedKeychainId],
  )

  const rungoById = useMemo(() => {
    return ownedKeychains.reduce<Record<string, Keychain>>((map, entry) => {
      map[entry.id] = entry
      return map
    }, {})
  }, [])

  const filteredCollectionRungos = useMemo(() => {
    let list = ownedKeychains

    if (collectionFilter === 'unlocked') {
      list = list.filter((entry) => unlockedRungoIds.includes(entry.id))
    } else if (collectionFilter === 'locked') {
      list = list.filter((entry) => !unlockedRungoIds.includes(entry.id))
    } else if (collectionFilter === 'rare+') {
      list = list.filter((entry) => {
        const tier = resolveRungoRarityTier(entry)
        return tier === 'rare' || tier === 'legendary' || tier === 'mythical'
      })
    }

    const query = deferredCollectionSearch.trim().toLowerCase()
    if (query) {
      list = list.filter((entry) => {
        return entry.name.toLowerCase().includes(query)
          || entry.description.toLowerCase().includes(query)
          || entry.unlockHint.toLowerCase().includes(query)
      })
    }

    return list
  }, [collectionFilter, deferredCollectionSearch, unlockedRungoIds])

  const collectionGridEntries = useMemo(() => {
    return filteredCollectionRungos.map((entry) => ({
      keychain: entry,
      isUnlocked: unlockedRungoIds.includes(entry.id),
      isSelected: selectedKeychainId === entry.id,
      isSignature: signatureRungoId === entry.id,
    }))
  }, [filteredCollectionRungos, selectedKeychainId, signatureRungoId, unlockedRungoIds])

  const unlockedRungoSet = useMemo(() => new Set(unlockedRungoIds), [unlockedRungoIds])

  const gardenSlotIndexByRungoId = useMemo(() => {
    const map: Record<string, number> = {}
    Object.entries(gardenSlotAssignments).forEach(([slotKey, rungoId]) => {
      if (!rungoId) {
        return
      }

      map[rungoId] = Number(slotKey)
    })

    return map
  }, [gardenSlotAssignments])

  const gardenPlacedCount = useMemo(() => {
    return Object.keys(gardenSlotAssignments).length
  }, [gardenSlotAssignments])

  const gardenAvailableRungos = useMemo(() => {
    return ownedKeychains.filter((entry) => unlockedRungoSet.has(entry.id))
  }, [unlockedRungoSet])

  const selectedGardenRungo = useMemo(() => {
    if (selectedGardenRungoId && unlockedRungoSet.has(selectedGardenRungoId)) {
      return rungoById[selectedGardenRungoId] ?? null
    }

    return gardenAvailableRungos[0] ?? null
  }, [gardenAvailableRungos, rungoById, selectedGardenRungoId, unlockedRungoSet])

  const isGardenSimulationVisible = (hubTab === 'garden' && !isPanelMinimized) || isRangePopupOpen

  const nextGardenSlotCost = getGardenSlotUnlockCost()

  const placedGardenResidents = useMemo(() => {
    const residents: Array<{ slotIndex: number; rungoId: string }> = []
    for (let slotIndex = 0; slotIndex < gardenUnlockedSlotCount; slotIndex += 1) {
      const rungoId = gardenSlotAssignments[slotIndex]
      if (typeof rungoId !== 'string' || !unlockedRungoSet.has(rungoId)) {
        continue
      }

      residents.push({ slotIndex, rungoId })
    }

    return residents
  }, [gardenSlotAssignments, gardenUnlockedSlotCount, unlockedRungoSet])

  const placedGardenRungoIdSet = useMemo(() => {
    return new Set(placedGardenResidents.map((entry) => entry.rungoId))
  }, [placedGardenResidents])

  const visitorCandidateIds = useMemo(() => {
    const uniqueCandidateIds = new Set<string>()
    unlockedRungoIds.forEach((rungoId) => {
      if (placedGardenRungoIdSet.has(rungoId)) {
        return
      }

      uniqueCandidateIds.add(rungoId)
    })

    return [...uniqueCandidateIds]
  }, [placedGardenRungoIdSet, unlockedRungoIds])

  const habitatRunnerDefinitions = useMemo(() => {
    const residentDefinitions = placedGardenResidents
      .filter((entry) => Boolean(rungoById[entry.rungoId]))
      .map((entry) => ({
        key: `resident-${entry.slotIndex}-${entry.rungoId}`,
        rungoId: entry.rungoId,
        role: 'resident' as const,
        slotIndex: entry.slotIndex,
        lane: entry.slotIndex % 3,
      }))

    const visitorDefinitions = gardenVisitors
      .filter((entry) => Boolean(rungoById[entry.rungoId]))
      .map((entry, visitorIndex) => ({
        key: entry.key,
        rungoId: entry.rungoId,
        role: 'visitor' as const,
        slotIndex: null,
        lane: visitorIndex % 3,
      }))

    return [...residentDefinitions, ...visitorDefinitions]
  }, [gardenVisitors, placedGardenResidents, rungoById])

  useEffect(() => {
    const candidateSet = new Set(visitorCandidateIds)
    setGardenVisitors((previous) => {
      return previous
        .filter((entry) => candidateSet.has(entry.rungoId))
        .slice(0, GARDEN_VISITOR_LIMIT)
    })
  }, [visitorCandidateIds])

  useEffect(() => {
    if (!isGardenSimulationVisible) {
      return
    }

    const visitorInterval = window.setInterval(() => {
      const candidateSet = new Set(visitorCandidateIds)
      setGardenVisitors((previous) => {
        const now = Date.now()
        const activeVisitors = previous.filter((entry) => entry.expiresAt > now && candidateSet.has(entry.rungoId))
        const activeVisitorIdSet = new Set(activeVisitors.map((entry) => entry.rungoId))
        const nextVisitors = [...activeVisitors]

        if (nextVisitors.length < GARDEN_VISITOR_LIMIT && Math.random() < GARDEN_VISITOR_SPAWN_CHANCE) {
          const availableIds = visitorCandidateIds.filter((entry) => !activeVisitorIdSet.has(entry))
          if (availableIds.length > 0) {
            const selectedId = availableIds[Math.floor(Math.random() * availableIds.length)]
            const lifetimeMs = GARDEN_VISITOR_MIN_LIFETIME_MS
              + Math.random() * (GARDEN_VISITOR_MAX_LIFETIME_MS - GARDEN_VISITOR_MIN_LIFETIME_MS)
            nextVisitors.push({
              key: `visitor-${selectedId}-${Math.floor(now)}`,
              rungoId: selectedId,
              expiresAt: now + lifetimeMs,
            })
          }
        }

        return nextVisitors
      })
    }, GARDEN_VISITOR_SPAWN_INTERVAL_MS)

    return () => {
      window.clearInterval(visitorInterval)
    }
  }, [isGardenSimulationVisible, visitorCandidateIds])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateMetrics = () => {
      const habitatNode = gardenHabitatRef.current
      if (!habitatNode) {
        return
      }

      setGardenHabitatMetrics({
        width: Math.max(320, habitatNode.clientWidth),
        height: Math.max(200, habitatNode.clientHeight),
      })
    }

    updateMetrics()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        updateMetrics()
      })
      : null

    if (resizeObserver && gardenHabitatRef.current) {
      resizeObserver.observe(gardenHabitatRef.current)
    }

    window.addEventListener('resize', updateMetrics)
    return () => {
      window.removeEventListener('resize', updateMetrics)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [isGardenSimulationVisible])

  useEffect(() => {
    const now = Date.now()
    const stageWidth = Math.max(320, gardenHabitatMetrics.width)
    setGardenRunnerStates((previous) => {
      const previousByKey = new Map(previous.map((entry) => [entry.key, entry]))
      return habitatRunnerDefinitions.map((definition, index) => {
        const existing = previousByKey.get(definition.key)
        if (existing && existing.rungoId === definition.rungoId) {
          return {
            ...existing,
            role: definition.role,
            slotIndex: definition.slotIndex,
            lane: definition.lane,
            depthPercent: clampGardenDepthPercent(existing.depthPercent ?? resolveGardenDepthPercentFromLane(definition.lane)),
            dropFallOffsetPx: Math.max(0, existing.dropFallOffsetPx ?? 0),
            dropFallVelocityPxPerSec: Math.max(0, existing.dropFallVelocityPxPerSec ?? 0),
            fallUntil: existing.fallUntil ?? 0,
            fallBackDirection: existing.fallBackDirection ?? (existing.direction === 1 ? -1 : 1),
            nextToySeekAt: existing.nextToySeekAt ?? now + 3200,
            activityLockUntil: existing.activityLockUntil ?? 0,
          }
        }

        const spawnSeed = deterministicUnit((index + 1) * 173 + definition.key.length * 37 + now * 0.001)
        const startX = 26 + spawnSeed * Math.max(40, stageWidth - 52)
        const direction = deterministicUnit((index + 1) * 227 + now * 0.0007) > 0.5 ? 1 : -1
        const speedPxPerSec = 18 + deterministicUnit((index + 1) * 307 + now * 0.0013) * 18
        return {
          key: definition.key,
          rungoId: definition.rungoId,
          role: definition.role,
          slotIndex: definition.slotIndex,
          x: startX,
          lane: definition.lane,
          depthPercent: resolveGardenDepthPercentFromLane(definition.lane),
          dropFallOffsetPx: 0,
          dropFallVelocityPxPerSec: 0,
          direction,
          speedPxPerSec,
          mode: 'running',
          nextModeAt: now + 1800 + deterministicUnit((index + 1) * 421 + now * 0.001) * 2600,
          nextDirectionShiftAt: resolveNextGardenDirectionShiftAt(index, habitatRunnerDefinitions.length, now),
          nextTalkAt: now + 900 + deterministicUnit((index + 1) * 553 + now * 0.0012) * 2000,
          bubbleText: null,
          bubbleMood: 'neutral',
          bubbleUntil: 0,
          bumpUntil: 0,
          fallUntil: 0,
          fallBackDirection: direction === 1 ? -1 : 1,
          conversationPartnerKey: null,
          conversationTurnsLeft: 0,
          conversationNextBubbleAt: 0,
          conversationMood: 'neutral',
          conversationOutcomeMood: 'neutral',
          conversationEndsAt: 0,
          nextToySeekAt: now + 1800 + deterministicUnit((index + 1) * 709 + now * 0.0016) * 5200,
          activityLockUntil: 0,
        }
      })
    })
  }, [gardenHabitatMetrics.width, habitatRunnerDefinitions])

  useEffect(() => {
    if (!isGardenSimulationVisible) {
      return
    }

    const behaviorTickMs = isRungoUltraLite ? GARDEN_BEHAVIOR_TICK_MS * 2 : GARDEN_BEHAVIOR_TICK_MS

    const behaviorInterval = window.setInterval(() => {
      const tickNow = Date.now()
      setGardenNow(tickNow)

      setGardenRunnerStates((previous) => {
        if (previous.length === 0) {
          return previous
        }

        const stageWidth = Math.max(320, gardenHabitatMetrics.width)
        const minX = 24
        const maxX = Math.max(minX + 28, stageWidth - 24)
        const dtSeconds = behaviorTickMs / 1000
        const activePointerDrag = activePointerGameplayDragRef.current
        const carriedRunnerKey = activePointerDrag?.kind === 'rungo' && activePointerDrag.source === 'runner'
          ? activePointerDrag.runnerKey
          : null

        const next = previous.map((runner, index) => {
          const updated: GardenRunnerState = { ...runner }
          if (updated.bubbleUntil <= tickNow) {
            updated.bubbleText = null
          }

          const isCarriedRunner = carriedRunnerKey !== null && updated.key === carriedRunnerKey
          if (isCarriedRunner) {
            const carryLockUntil = tickNow + RUNGO_ACTIVITY_LOCK_MS_PLAY
            updated.mode = 'idle'
            updated.speedPxPerSec = 0
            updated.activityLockUntil = Math.max(updated.activityLockUntil, carryLockUntil)
            updated.conversationPartnerKey = null
            updated.conversationTurnsLeft = 0
            updated.conversationNextBubbleAt = 0
            updated.conversationEndsAt = 0
            updated.bubbleText = null
            updated.bubbleUntil = 0
            updated.nextTalkAt = Math.max(updated.nextTalkAt, carryLockUntil + 220)
            return updated
          }

          const isLockedInActivity = tickNow < updated.activityLockUntil
          if (isLockedInActivity) {
            updated.nextTalkAt = Math.max(updated.nextTalkAt, updated.activityLockUntil + 200)
            if (updated.conversationPartnerKey !== null) {
              updated.conversationPartnerKey = null
              updated.conversationTurnsLeft = 0
              updated.conversationNextBubbleAt = 0
              updated.conversationEndsAt = 0
              updated.bubbleText = null
              updated.bubbleUntil = 0
            }
          }

          const isInConversation = !isLockedInActivity
            && updated.conversationPartnerKey !== null
            && updated.conversationEndsAt > tickNow
          if (isInConversation) {
            updated.mode = 'idle'
            updated.speedPxPerSec = 0
            if (updated.conversationTurnsLeft > 0 && tickNow >= updated.conversationNextBubbleAt) {
              const speechSeed = (index + 1) * 947 + tickNow * 0.0013 + updated.conversationTurnsLeft * 31
              updated.bubbleText = createGardenEmojiSpeech(updated.conversationMood, speechSeed)
              updated.bubbleMood = updated.conversationMood
              updated.bubbleUntil = tickNow + GARDEN_BUBBLE_DURATION_MS
              updated.conversationTurnsLeft -= 1
              updated.conversationNextBubbleAt = tickNow + 520 + deterministicUnit(speechSeed + 281) * 540
            }
          }

          if (updated.conversationPartnerKey !== null && updated.conversationEndsAt <= tickNow) {
            const outcomeSeed = (index + 1) * 683 + tickNow * 0.0011
            updated.bubbleMood = updated.conversationOutcomeMood
            updated.bubbleText = createGardenEmojiSpeech(updated.conversationOutcomeMood, outcomeSeed)
            updated.bubbleUntil = tickNow + 920
            updated.conversationPartnerKey = null
            updated.conversationTurnsLeft = 0
            updated.conversationNextBubbleAt = 0
            updated.conversationEndsAt = 0
            updated.mode = 'running'
            updated.speedPxPerSec = 15 + deterministicUnit(outcomeSeed + 97) * 20
            updated.nextModeAt = tickNow + 2600 + deterministicUnit(outcomeSeed + 173) * 2200
            updated.nextTalkAt = tickNow + GARDEN_TALK_COOLDOWN_MS + deterministicUnit(outcomeSeed + 239) * 2200


          }

          if (updated.dropFallOffsetPx > 0) {
            const nextFallVelocity = updated.dropFallVelocityPxPerSec + GARDEN_RUNNER_DROP_GRAVITY_PX_PER_SEC2 * dtSeconds
            const nextFallOffset = Math.max(0, updated.dropFallOffsetPx - nextFallVelocity * dtSeconds)
            const didLandFromDrop = nextFallOffset <= 0

            updated.dropFallOffsetPx = nextFallOffset
            updated.dropFallVelocityPxPerSec = didLandFromDrop ? 0 : nextFallVelocity
            updated.mode = didLandFromDrop ? 'running' : 'idle'
            updated.speedPxPerSec = didLandFromDrop
              ? Math.max(16, updated.speedPxPerSec)
              : 0
            updated.nextModeAt = didLandFromDrop
              ? tickNow + 1400 + deterministicUnit((index + 1) * 373 + tickNow * 0.0011) * 1400
              : Math.max(updated.nextModeAt, tickNow + 620)
            updated.nextTalkAt = Math.max(updated.nextTalkAt, tickNow + 900)
            updated.conversationPartnerKey = null
            updated.conversationTurnsLeft = 0
            updated.conversationNextBubbleAt = 0
            updated.conversationEndsAt = 0
          } else if (updated.bumpUntil > tickNow) {
            updated.mode = 'bump'
            updated.speedPxPerSec = 0
          } else if (updated.fallUntil > tickNow) {
            updated.mode = 'fall'
            updated.speedPxPerSec = 0
            updated.x += updated.fallBackDirection * GARDEN_FALL_BACK_SPEED_PX_PER_SEC * dtSeconds
          } else {
            if (updated.mode === 'bump' || updated.mode === 'fall') {
              updated.mode = 'running'
              updated.fallUntil = 0
              updated.speedPxPerSec = 16 + deterministicUnit((index + 1) * 293 + tickNow * 0.0014) * 18
              updated.nextModeAt = tickNow + 1700 + deterministicUnit((index + 1) * 377 + tickNow * 0.0011) * 2300
            }

            if (updated.conversationPartnerKey === null && tickNow >= updated.nextModeAt) {
              if (updated.mode === 'running') {
                const shouldSit = deterministicUnit((index + 1) * 761 + tickNow * 0.0015) < 0.42
                updated.mode = shouldSit ? 'sit' : 'idle'
                updated.speedPxPerSec = 0
                updated.nextModeAt = tickNow + 4200 + deterministicUnit((index + 1) * 467 + tickNow * 0.0012) * 6800
              } else {
                updated.mode = 'running'
                updated.speedPxPerSec = 16 + deterministicUnit((index + 1) * 557 + tickNow * 0.0018) * 20
                updated.nextModeAt = tickNow + 2200 + deterministicUnit((index + 1) * 587 + tickNow * 0.0014) * 3200
              }
            }

            if (updated.mode === 'running' && updated.conversationPartnerKey === null) {
              if (tickNow >= updated.nextDirectionShiftAt) {
                const shouldFlip = deterministicUnit((index + 1) * 613 + tickNow * 0.0008) > 0.45
                if (shouldFlip) {
                  updated.direction = updated.direction === 1 ? -1 : 1
                }
                updated.nextDirectionShiftAt = resolveNextGardenDirectionShiftAt(index, previous.length, tickNow)
              }

              updated.x += updated.direction * updated.speedPxPerSec * dtSeconds
            }
          }

          if (updated.x < minX) {
            updated.x = minX
            updated.direction = 1
            updated.nextDirectionShiftAt = resolveNextGardenDirectionShiftAt(index, previous.length, tickNow)
          } else if (updated.x > maxX) {
            updated.x = maxX
            updated.direction = -1
            updated.nextDirectionShiftAt = resolveNextGardenDirectionShiftAt(index, previous.length, tickNow)
          }

          return updated
        })

        for (let firstIndex = 0; firstIndex < next.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < next.length; secondIndex += 1) {
            const firstRunner = next[firstIndex]
            const secondRunner = next[secondIndex]

            const firstBusy = firstRunner.conversationPartnerKey !== null && firstRunner.conversationEndsAt > tickNow
            const secondBusy = secondRunner.conversationPartnerKey !== null && secondRunner.conversationEndsAt > tickNow
            if (firstBusy || secondBusy) {
              continue
            }

            if (firstRunner.dropFallOffsetPx > 0 || secondRunner.dropFallOffsetPx > 0) {
              continue
            }

            if (tickNow < firstRunner.activityLockUntil || tickNow < secondRunner.activityLockUntil) {
              continue
            }

            if (tickNow < firstRunner.nextTalkAt || tickNow < secondRunner.nextTalkAt) {
              continue
            }

            const distance = Math.abs(firstRunner.x - secondRunner.x)
            if (distance > GARDEN_TALK_DISTANCE_PX) {
              continue
            }

            let mood: GardenSpeechMood = 'neutral'
            if (distance <= GARDEN_BUMP_DISTANCE_PX) {
              mood = 'mad'
            } else if (hasCozyChatPerkRef.current) {
              mood = 'happy'
            } else if (firstRunner.direction === secondRunner.direction) {
              mood = 'happy'
            }

            const speechSeed = (firstIndex + 1) * 911 + (secondIndex + 1) * 683 + tickNow * 0.001
            const shouldMadCharge = mood === 'mad'
              && distance <= GARDEN_MAD_CHARGE_DISTANCE_PX
              && deterministicUnit(speechSeed + 211) < GARDEN_MAD_CHARGE_CHANCE
            const shouldChargeRun = shouldMadCharge && distance > GARDEN_BUMP_DISTANCE_PX + 4
            const shouldBump = distance <= GARDEN_BUMP_DISTANCE_PX

            if (firstRunner.x <= secondRunner.x) {
              firstRunner.direction = 1
              secondRunner.direction = -1
            } else {
              firstRunner.direction = -1
              secondRunner.direction = 1
            }

            if (shouldChargeRun) {
              firstRunner.mode = 'running'
              secondRunner.mode = 'running'
              firstRunner.speedPxPerSec = Math.max(firstRunner.speedPxPerSec, 38)
              secondRunner.speedPxPerSec = Math.max(secondRunner.speedPxPerSec, 38)
              firstRunner.nextModeAt = tickNow + 920
              secondRunner.nextModeAt = tickNow + 920
              firstRunner.nextTalkAt = tickNow + 140
              secondRunner.nextTalkAt = tickNow + 140
              continue
            }

            if (shouldBump) {
              const bumpDurationMs = shouldMadCharge ? 330 : 260
              const fallDurationMs = GARDEN_FALL_DURATION_MS + deterministicUnit(speechSeed + 271) * 220
              const bothFallChance = Math.min(
                0.9,
                GARDEN_BUMP_BOTH_FALL_CHANCE + (shouldMadCharge ? 0.18 : 0),
              )
              const bothFall = deterministicUnit(speechSeed + 307) < bothFallChance
              const firstFallsOnly = deterministicUnit(speechSeed + 331) >= 0.5
              const firstFalls = bothFall || firstFallsOnly
              const secondFalls = bothFall || !firstFallsOnly

              firstRunner.mode = 'bump'
              secondRunner.mode = 'bump'
              firstRunner.bumpUntil = tickNow + bumpDurationMs
              secondRunner.bumpUntil = tickNow + bumpDurationMs
              firstRunner.fallUntil = firstFalls ? tickNow + bumpDurationMs + fallDurationMs : 0
              secondRunner.fallUntil = secondFalls ? tickNow + bumpDurationMs + fallDurationMs : 0
              firstRunner.fallBackDirection = firstRunner.direction === 1 ? -1 : 1
              secondRunner.fallBackDirection = secondRunner.direction === 1 ? -1 : 1
              firstRunner.speedPxPerSec = 0
              secondRunner.speedPxPerSec = 0

              const midpoint = (firstRunner.x + secondRunner.x) / 2
              const splitDistance = Math.max(8, Math.min(16, distance * 0.5 + 3))
              if (firstRunner.x <= secondRunner.x) {
                firstRunner.x = Math.max(minX, midpoint - splitDistance)
                secondRunner.x = Math.min(maxX, midpoint + splitDistance)
              } else {
                firstRunner.x = Math.min(maxX, midpoint + splitDistance)
                secondRunner.x = Math.max(minX, midpoint - splitDistance)
              }

              firstRunner.conversationPartnerKey = null
              secondRunner.conversationPartnerKey = null
              firstRunner.conversationTurnsLeft = 0
              secondRunner.conversationTurnsLeft = 0
              firstRunner.conversationNextBubbleAt = 0
              secondRunner.conversationNextBubbleAt = 0
              firstRunner.conversationEndsAt = 0
              secondRunner.conversationEndsAt = 0
              firstRunner.nextTalkAt = tickNow + Math.round((shouldMadCharge ? 0.86 : 1) * GARDEN_TALK_COOLDOWN_MS)
              secondRunner.nextTalkAt = tickNow + Math.round((shouldMadCharge ? 0.86 : 1) * GARDEN_TALK_COOLDOWN_MS)
              firstRunner.bubbleMood = 'mad'
              secondRunner.bubbleMood = 'mad'
              firstRunner.bubbleText = createGardenEmojiSpeech('mad', speechSeed + 359)
              secondRunner.bubbleText = createGardenEmojiSpeech('mad', speechSeed + 397)
              firstRunner.bubbleUntil = tickNow + 520
              secondRunner.bubbleUntil = tickNow + 520

              if (firstFalls) {
              }

              if (secondFalls) {
              }

              continue
            }

            const turns = 2 + Math.floor(deterministicUnit(speechSeed + 43) * 3)
            const durationMs = 1100 + turns * (760 + deterministicUnit(speechSeed + 71) * 220)
            const outcomeRoll = deterministicUnit(speechSeed + 151)
            const outcomeMood: GardenSpeechMood = outcomeRoll < 0.28 ? 'mad' : outcomeRoll < 0.74 ? 'happy' : 'neutral'
            const firstInitiates = deterministicUnit(speechSeed + 191) >= 0.5
            const talkCooldownMs = mood === 'mad'
              ? Math.round(GARDEN_TALK_COOLDOWN_MS * 0.72)
              : GARDEN_TALK_COOLDOWN_MS

            firstRunner.mode = 'idle'
            secondRunner.mode = 'idle'
            firstRunner.speedPxPerSec = 0
            secondRunner.speedPxPerSec = 0

            firstRunner.conversationPartnerKey = secondRunner.key
            secondRunner.conversationPartnerKey = firstRunner.key
            firstRunner.conversationMood = mood
            secondRunner.conversationMood = mood
            firstRunner.conversationOutcomeMood = outcomeMood
            secondRunner.conversationOutcomeMood = outcomeMood
            firstRunner.conversationTurnsLeft = turns
            secondRunner.conversationTurnsLeft = turns
            firstRunner.conversationEndsAt = tickNow + durationMs
            secondRunner.conversationEndsAt = tickNow + durationMs
            firstRunner.conversationNextBubbleAt = tickNow + (firstInitiates ? 110 : 340)
            secondRunner.conversationNextBubbleAt = tickNow + (firstInitiates ? 340 : 110)
            firstRunner.nextTalkAt = tickNow + durationMs + talkCooldownMs
            secondRunner.nextTalkAt = tickNow + durationMs + talkCooldownMs
          }
        }

        const nextByKey = new Map(next.map((runner) => [runner.key, runner]))
        next.forEach((runner) => {
          if (!runner.conversationPartnerKey || runner.conversationEndsAt <= tickNow) {
            return
          }

          const partner = nextByKey.get(runner.conversationPartnerKey)
          if (!partner || partner.conversationEndsAt <= tickNow || partner.conversationPartnerKey !== runner.key) {
            runner.conversationPartnerKey = null
            runner.conversationTurnsLeft = 0
            runner.conversationNextBubbleAt = 0
            runner.conversationEndsAt = 0
            return
          }

          if (runner.x <= partner.x) {
            runner.direction = 1
            partner.direction = -1
          } else {
            runner.direction = -1
            partner.direction = 1
          }

          runner.mode = runner.mode === 'bump' || runner.mode === 'fall' ? runner.mode : 'idle'
          partner.mode = partner.mode === 'bump' || partner.mode === 'fall' ? partner.mode : 'idle'
        })

        return next
      })
    }, behaviorTickMs)

    return () => {
      window.clearInterval(behaviorInterval)
    }
  }, [
    gardenHabitatMetrics.width,
    isGardenSimulationVisible,
    isRungoUltraLite,
  ])

  useEffect(() => {
    if (!selectedGardenRungoId) {
      return
    }

    if (unlockedRungoSet.has(selectedGardenRungoId)) {
      return
    }

    setSelectedGardenRungoId(null)
  }, [selectedGardenRungoId, unlockedRungoSet])

  useEffect(() => {
    if (selectedGardenSlotIndex === null) {
      return
    }

    if (selectedGardenSlotIndex >= 0 && selectedGardenSlotIndex < gardenUnlockedSlotCount) {
      return
    }

    setSelectedGardenSlotIndex(null)
  }, [gardenUnlockedSlotCount, selectedGardenSlotIndex])

  const computeRollTrackOffsetPx = useCallback((winnerIndex: number) => {
    const cardWidth = ROLL_COMPACT_CARD_WIDTH_PX
    const cardGap = ROLL_CARD_GAP_PX
    const cardSpan = cardWidth + cardGap
    const reelShell = rollReelShellRef.current
    const shellWidth = reelShell?.clientWidth ?? rollReelMetrics.width

    if (shellWidth <= 0) {
      const fallbackCenterIndex = 2
      return -1 * ((winnerIndex * cardSpan) - (fallbackCenterIndex * cardSpan))
    }

    const paddingLeft = reelShell
      ? Number.parseFloat(window.getComputedStyle(reelShell).paddingLeft) || 0
      : rollReelMetrics.paddingLeft
    const viewportCenter = shellWidth / 2
    const winnerCenter = paddingLeft + (winnerIndex * cardSpan) + (cardWidth / 2)
    return viewportCenter - winnerCenter
  }, [rollReelMetrics.paddingLeft, rollReelMetrics.width])

  const rollTrackOffsetPx = useMemo(() => {
    if (rollWinnerIndex === null) {
      return 0
    }

    return computeRollTrackOffsetPx(rollWinnerIndex)
  }, [computeRollTrackOffsetPx, rollWinnerIndex])

  const effectiveRollTrackOffsetPx = rollLockedTrackOffsetPx ?? rollTrackOffsetPx

  const lastRolledTierClassName = useMemo(() => {
    if (!lastRolledRungoId) {
      return ''
    }

    const awarded = rungoById[lastRolledRungoId]
    if (!awarded) {
      return ''
    }

    return `tier-${resolveRungoRarityTier(awarded)}`
  }, [lastRolledRungoId, rungoById])

  const rollTierFlashClassName = rollTierFlashTier ? `is-tier-flash tier-${rollTierFlashTier}` : ''

  const triggerRollTierFeedback = useCallback((tier: RungoRarityTier) => {
    if (typeof window === 'undefined') {
      return
    }

    if (rollTierFlashTimerRef.current !== null) {
      window.clearTimeout(rollTierFlashTimerRef.current)
      rollTierFlashTimerRef.current = null
    }

    setRollTierFlashTier(tier)

    if (tier === 'mythical') {
      playSoundCue(selectedSystemSound, 0.74)
      playSoundCue(selectedGameSound, 0.5)
      playSoundCue(favoriteSelectSound, 0.62)
    } else if (tier === 'legendary') {
      playSoundCue(selectedSystemSound, 0.68)
      playSoundCue(favoriteSelectSound, 0.44)
    } else if (tier === 'rare') {
      playSoundCue(selectedSystemSound, 0.62)
    } else if (tier === 'uncommon') {
      playSoundCue(favoriteSelectSound, 0.58)
    } else {
      playSoundCue(iconScrollSound, 0.5)
    }

    rollTierFlashTimerRef.current = window.setTimeout(() => {
      setRollTierFlashTier((previous) => (previous === tier ? null : previous))
      rollTierFlashTimerRef.current = null
    }, ROLL_TIER_FLASH_DURATION_MS)
  }, [])

  const handleDebugRoll = () => {
    const result = debugRollRungo()
    if (!result.awardedRungoId) {
      setDebugRollStatus('No spawn-eligible Rungos are configured for rolling yet.')
      return
    }

    setSelectedKeychainId(result.awardedRungoId)
    const awardedName = ownedKeychains.find((entry) => entry.id === result.awardedRungoId)?.name ?? result.awardedRungoId
    const awardedRungo = rungoById[result.awardedRungoId]
    if (awardedRungo) {
      triggerRollTierFeedback(resolveRungoRarityTier(awardedRungo))
    }
    setDebugRollStatus(result.duplicate ? `Rolled ${awardedName} (duplicate).` : `Rolled ${awardedName} (new unlock).`)
    if (!result.duplicate) {
      emitSignatureRungoReaction('new-unlock', 'rungo-gallery-debug-roll')
    }
  }

  const handleSetGallerySignature = useCallback((rungoId: string) => {
    const entry = rungoById[rungoId]
    if (!entry || !isRungoUnlocked(rungoId)) {
      return
    }

    if (signatureRungoId === rungoId) {
      setRollStatus(`${entry.name} is already your Signature Rungo.`)
      return
    }

    const didSet = setSignatureRungoId(rungoId)
    if (!didSet) {
      setRollStatus('Unable to set Signature Rungo right now.')
      return
    }

    setRollStatus(`Signature Rungo set to ${entry.name}.`)
    playSoundCue(favoriteSelectSound, 0.72)
  }, [isRungoUnlocked, rungoById, setSignatureRungoId, signatureRungoId])

  const handleRollWithToken = () => {
    if (isRolling) {
      return
    }

    const result = rollRungoWithToken(undefined, { debugInfiniteTokens: isDebugMode })
    if (!result.awardedRungoId) {
      setRollStatus(result.error ?? 'Unable to roll right now.')
      return
    }

    const awardedRungo = rungoById[result.awardedRungoId]
    if (!awardedRungo) {
      setRollStatus('Rolled an unknown Rungo entry. Check catalog data.')
      return
    }

    playSoundCue(selectedGameSound, 0.6)

    const { strip, winnerIndex } = buildRollStrip(result.awardedRungoId)
    pendingRollRef.current = { awardedRungo, result }
    setRollStripIds(strip)
    setRollWinnerIndex(winnerIndex)
    setRollAnimationKey((previous) => previous + 1)
    setRollLockedTrackOffsetPx(null)
    setRollStatus('')
    setRollResultSummary(null)

    if (rollResolveTimerRef.current) {
      window.clearTimeout(rollResolveTimerRef.current)
      rollResolveTimerRef.current = null
    }

    setRollStartRequestKey((previous) => previous + 1)
  }

  useEffect(() => {
    if (rollStartRequestKey === 0 || rollWinnerIndex === null) {
      return
    }

    const pending = pendingRollRef.current
    if (!pending) {
      return
    }

    let cancelled = false
    let resolveTimer: number | null = null
    let animationFrame = 0

    const startRollAnimation = () => {
      if (cancelled) {
        return
      }

      const offset = computeRollTrackOffsetPx(rollWinnerIndex)
      setRollLockedTrackOffsetPx(offset)
      setIsRolling(true)

      resolveTimer = window.setTimeout(() => {
        if (cancelled) {
          return
        }

        const { awardedRungo, result } = pending
        setIsRolling(false)
        setLastRolledRungoId(awardedRungo.id)
        setSelectedKeychainId(awardedRungo.id)

        const duplicateSeedSuffix = result.duplicate && result.awardedSeeds > 0
          ? ` +${result.awardedSeeds} Garden Seed${result.awardedSeeds === 1 ? '' : 's'}.`
          : ''
        triggerRollTierFeedback(resolveRungoRarityTier(awardedRungo))
        setRollResultSummary({
          name: awardedRungo.name,
          duplicate: result.duplicate,
          awardedSeeds: result.awardedSeeds,
          tier: resolveRungoRarityTier(awardedRungo),
        })
        setRollStatus(result.duplicate
          ? `Rolled ${awardedRungo.name} (duplicate).${duplicateSeedSuffix}`
          : `Rolled ${awardedRungo.name} (new unlock).`)
        if (!result.duplicate) {
          emitSignatureRungoReaction('new-unlock', 'rungo-gallery-roll')
        }
        pendingRollRef.current = null
        rollResolveTimerRef.current = null
      }, ROLL_RESOLVE_MS)

      rollResolveTimerRef.current = resolveTimer
    }

    animationFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(startRollAnimation)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(animationFrame)
      if (resolveTimer !== null) {
        window.clearTimeout(resolveTimer)
      }
    }
  }, [rollStartRequestKey, triggerRollTierFeedback])

  useEffect(() => {
    if (!isRolling || typeof window === 'undefined') {
      return
    }

    let frameId = 0
    let lastCenterIndex: number | null = null
    let lastTickAt = 0

    const sampleRollTicks = () => {
      const reelShell = rollReelShellRef.current
      const track = reelShell?.querySelector('.rungo-roll-track') as HTMLElement | null
      if (!reelShell || !track) {
        frameId = window.requestAnimationFrame(sampleRollTicks)
        return
      }

      const centerX = reelShell.getBoundingClientRect().left + (reelShell.clientWidth / 2)
      const cards = track.querySelectorAll('.rungo-roll-card')
      let centerIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect()
        const cardCenter = rect.left + (rect.width / 2)
        const distance = Math.abs(cardCenter - centerX)
        if (distance < nearestDistance) {
          nearestDistance = distance
          centerIndex = index
        }
      })

      const now = performance.now()
      if (lastCenterIndex !== null && centerIndex !== lastCenterIndex && now - lastTickAt >= ROLL_TICK_MIN_INTERVAL_MS) {
        playSoundCue(rungoReleaseSound, 0.42)
        lastTickAt = now
      }

      lastCenterIndex = centerIndex
      frameId = window.requestAnimationFrame(sampleRollTicks)
    }

    frameId = window.requestAnimationFrame(sampleRollTicks)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isRolling, rollAnimationKey])

  const handleUnlockGardenSlot = () => {
    const result = unlockNextGardenSlot()
    if (!result.updated) {
      if (result.reason === 'maxed') {
        setGardenStatus('All Range slots are already unlocked.')
        return
      }

      if (result.reason === 'insufficient') {
        const needed = result.nextCost ?? 0
        setGardenStatus(`Not enough Seeds. Need ${needed}, have ${result.seedBalance}.`)
        return
      }
    }

    setGardenStatus(`Unlocked Range slot ${result.nextSlotCount}. Spent ${result.spentSeeds} Seeds.`)
  }

  const handlePlaceSelectedGardenRungo = () => {
    if (selectedGardenSlotIndex === null) {
      setGardenStatus('Select a slot first, then choose a Rungo to place.')
      return
    }

    if (!selectedGardenRungo) {
      setGardenStatus('No unlocked Rungos are available to place yet.')
      return
    }

    const didUpdate = setGardenSlotRungo(selectedGardenSlotIndex, selectedGardenRungo.id)
    if (!didUpdate) {
      setGardenStatus('Unable to place that Rungo in the selected slot.')
      return
    }

    setGardenStatus(`Placed ${selectedGardenRungo.name} in slot ${selectedGardenSlotIndex + 1}.`)
    playSoundCue(favoriteSelectSound, 0.68)
  }

  const handleClearGardenSlot = () => {
    if (selectedGardenSlotIndex === null) {
      setGardenStatus('Select a slot to clear first.')
      return
    }

    const didUpdate = setGardenSlotRungo(selectedGardenSlotIndex, null)
    if (!didUpdate) {
      setGardenStatus('That slot is already empty.')
      return
    }

    setGardenStatus(`Cleared slot ${selectedGardenSlotIndex + 1}.`)
    playSoundCue(favoriteDeselectSound, 0.66)
  }

  const handleChangeGardenTheme = (themeId: GardenThemeId) => {
    const didUpdate = setActiveGardenTheme(themeId)
    if (!didUpdate) {
      setGardenStatus('Theme locked. Earn more playtime first.')
      return
    }

    const themeName = formatGardenThemeShortName(gardenThemes.find((theme) => theme.id === themeId)?.name ?? 'Theme')
    setGardenStatus(`Range theme switched to ${themeName}.`)
  }

  const commitRangeName = () => {
    const nextName = rungoRangeDraftName.trim().slice(0, 32) || RUNGO_RANGE_DEFAULT_NAME
    setRungoRangeName(nextName)
    setRungoRangeDraftName(nextName)
    setIsEditingRangeName(false)
    writeRangeWindowName(nextName)
    setGardenStatus(`Renamed to ${nextName}.`)
  }

  const handleOpenRangePopup = () => {
    setHubTab('garden')
    setIsRangePopupOpen(true)
    setIsPanelMinimized(true)
    setGardenStatus('Range floated.')
    playSoundCue(selectedSystemSound, 0.62)
  }

  const handleRestoreRangePanel = () => {
    setIsPanelMinimized(false)
    setIsRangePopupOpen(false)
    setHubTab('garden')
    playSoundCue(selectedSystemSound, 0.62)
  }

  const dismissRangeDiscoveryHint = () => {
    setIsRangeDiscoveryHintVisible(false)
    writeRangeDiscoveryHintSeen()
  }

  const applyPointerGameplayDropTarget = useCallback((target: PointerGameplayDropTarget | null) => {
    activePointerGameplayDropTargetRef.current = target
    setActivePointerGameplayDropTarget(target)

    if (!target) {
      setIsGardenItemDragOver(false)
      setActiveGardenRunnerDropRungoId(null)
      setActiveGardenSlotDropIndex(null)
      return
    }

    if (target.kind === 'habitat') {
      setIsGardenItemDragOver(true)
      setActiveGardenRunnerDropRungoId(null)
      setActiveGardenSlotDropIndex(null)
      return
    }

    if (target.kind === 'runner') {
      setIsGardenItemDragOver(false)
      setActiveGardenRunnerDropRungoId(target.rungoId)
      setActiveGardenSlotDropIndex(null)
      return
    }

    setIsGardenItemDragOver(false)
    setActiveGardenRunnerDropRungoId(null)
    setActiveGardenSlotDropIndex(target.isUnlockedSlot ? target.slotIndex : null)
  }, [])

  const resolvePointerGameplayDropTarget = useCallback((
    _dragKind: GameplayDragKind,
    pointerPosition: PointerPosition,
    hitStackOverride?: Element[],
  ): PointerGameplayDropTarget | null => {
    const hitStack = hitStackOverride ?? resolvePointerGameplayHitStack(pointerPosition, true)

    for (const node of hitStack) {
      const slotNode = node.closest<HTMLElement>('[data-pointer-drop-slot-index]')
      if (!slotNode) {
        continue
      }

      const slotIndexRaw = slotNode.dataset.pointerDropSlotIndex ?? ''
      const parsedSlotIndex = Number.parseInt(slotIndexRaw, 10)
      if (!Number.isFinite(parsedSlotIndex)) {
        continue
      }

      return {
        kind: 'slot',
        slotIndex: parsedSlotIndex,
        isUnlockedSlot: slotNode.dataset.pointerDropSlotUnlocked === 'true',
      }
    }

    return null
  }, [resolvePointerGameplayHitStack])

  const resolvePointerGameplayCursorContext = useCallback((
    pointerPosition: PointerPosition,
    hitStackOverride?: Element[],
  ) => {
    if (typeof document === 'undefined') {
      return {
        isInGameplayArea: false,
        isOverMovableSource: false,
      }
    }

    const hitStack = hitStackOverride ?? resolvePointerGameplayHitStack(pointerPosition, true)
    const isOverGameplayZone = hitStack.some((node) => Boolean(node.closest<HTMLElement>('[data-gameplay-cursor-zone="true"]')))
    const clickableInModalNode = hitStack.find((node) => {
      const clickableNode = node.closest<HTMLElement>(POINTER_GAMEPLAY_CLICKABLE_SELECTOR)
      return Boolean(clickableNode?.closest<HTMLElement>('.keychain-gallery-modal'))
    })
    const isInGameplayArea = isOverGameplayZone || Boolean(clickableInModalNode)
    if (!isInGameplayArea) {
      return {
        isInGameplayArea: false,
        isOverMovableSource: false,
      }
    }

    const isOverMovableSource = hitStack.some((node) => Boolean(node.closest<HTMLElement>('[data-pointer-drag-source="true"]')))
      || Boolean(clickableInModalNode)
    return {
      isInGameplayArea,
      isOverMovableSource,
    }
  }, [resolvePointerGameplayHitStack])

  const startPendingPointerGameplayDrag = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    kind: GameplayDragKind,
    id: string,
    options?: {
      source?: RungoPointerDragSource
      runnerKey?: string | null
    },
  ) => {
    if (event.button !== 0) {
      return
    }

    if (activePointerGameplayDragRef.current || pendingPointerGameplayDragRef.current) {
      return
    }

    const normalizedId = id.trim()
    if (!normalizedId) {
      return
    }

    pendingPointerGameplayDragRef.current = {
      kind,
      id: normalizedId,
      source: options?.source ?? 'unknown',
      runnerKey: options?.runnerKey ?? null,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }

    activePointerGameplayDragRef.current = null
    setActivePointerGameplayDrag(null)
    setPointerGameplayCursorPositionRef(null)
    applyPointerGameplayDropTarget(null)
    setIsPointerGameplayTracking(true)
  }, [applyPointerGameplayDropTarget, setPointerGameplayCursorPositionRef])

  const handleRungoPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    rungoId: string,
    options?: {
      source?: RungoPointerDragSource
      runnerKey?: string | null
    },
  ) => {
    startPendingPointerGameplayDrag(event, 'rungo', rungoId, options)
  }

  const commitRungoDropOnSlot = useCallback((draggedRungoId: string, slotIndex: number, isUnlockedSlot: boolean) => {
    if (!isUnlockedSlot) {
      return
    }

    const didUpdate = setGardenSlotRungo(slotIndex, draggedRungoId)
    if (!didUpdate) {
      setGardenStatus('Unable to place that Rungo in this slot.')
      return
    }

    const draggedRungoName = rungoById[draggedRungoId]?.name ?? 'Rungo'
    setSelectedGardenSlotIndex(slotIndex)
    setSelectedGardenRungoId(draggedRungoId)
    setGardenStatus(`Placed ${draggedRungoName} in slot ${slotIndex + 1}.`)
  }, [rungoById, setGardenSlotRungo])

  const commitRungoDropInHabitat = useCallback((
    draggedRungoId: string,
    pointerPosition: PointerPosition,
    runnerKey: string | null,
  ) => {
    const habitatRect = gardenHabitatRef.current?.getBoundingClientRect()
    if (!habitatRect) {
      return
    }

    const minX = 24
    const maxX = Math.max(minX + 28, habitatRect.width - 24)
    const relativeX = Math.max(minX, Math.min(maxX, pointerPosition.x - habitatRect.left))
    const relativeY = Math.max(0, Math.min(habitatRect.height, pointerPosition.y - habitatRect.top))
    const normalizedHeight = Math.max(1, habitatRect.height)
    const depthPercent = clampGardenDepthPercent((1 - (relativeY / normalizedHeight)) * 100)
    const lane = Math.max(0, Math.min(2, Math.round((depthPercent / 100) * 2)))
    const restingBottomPx = GARDEN_RUNNER_BASE_BOTTOM_PX + (depthPercent / 100) * GARDEN_RUNNER_DEPTH_LIFT_PX
    const pointerBottomPx = Math.max(0, normalizedHeight - relativeY)
    const dropFallOffsetPx = Math.max(
      0,
      Math.min(
        GARDEN_RUNNER_DROP_MAX_START_OFFSET_PX,
        (pointerBottomPx - restingBottomPx) * 0.32,
      ),
    )

    const targetRunner = runnerKey
      ? gardenRunnerStatesRef.current.find((runner) => runner.key === runnerKey)
      : gardenRunnerStatesRef.current.find((runner) => runner.rungoId === draggedRungoId)
    if (!targetRunner) {
      return
    }

    const settledAt = Date.now()
    setGardenRunnerStates((previous) => {
      return previous.map((runner) => {
        if (runner.key !== targetRunner.key) {
          return runner
        }

        const settleLockUntil = settledAt + RUNGO_ACTIVITY_LOCK_MS_PLAY
        return {
          ...runner,
          x: relativeX,
          lane,
          depthPercent,
          dropFallOffsetPx,
          dropFallVelocityPxPerSec: 0,
          mode: dropFallOffsetPx > 0 ? 'idle' : 'running',
          speedPxPerSec: dropFallOffsetPx > 0 ? 0 : Math.max(18, runner.speedPxPerSec),
          bumpUntil: 0,
          fallUntil: 0,
          conversationPartnerKey: null,
          conversationTurnsLeft: 0,
          conversationNextBubbleAt: 0,
          conversationEndsAt: 0,
          activityLockUntil: Math.max(runner.activityLockUntil, settleLockUntil),
          nextTalkAt: Math.max(settledAt + 920, settleLockUntil + 220),
          nextModeAt: settledAt + 1700,
        }
      })
    })

    const draggedRungoName = rungoById[draggedRungoId]?.name ?? 'Rungo'
    setGardenStatus(`Moved ${draggedRungoName} in the Range.`)
  }, [rungoById])

  useEffect(() => {
    if (typeof window === 'undefined' || !isPointerGameplayTracking) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const activeDrag = activePointerGameplayDragRef.current
      if (activeDrag && activeDrag.pointerId === event.pointerId) {
        const nextPointerPosition: PointerPosition = {
          x: event.clientX,
          y: event.clientY,
        }

        const nextDragState: ActivePointerGameplayDrag = {
          ...activeDrag,
          x: nextPointerPosition.x,
          y: nextPointerPosition.y,
        }

        activePointerGameplayDragRef.current = nextDragState
        setActivePointerGameplayDrag(nextDragState)
        setPointerGameplayCursorPositionRef(nextPointerPosition)
        const hitStack = resolvePointerGameplayHitStack(nextPointerPosition)
        const cursorContext = resolvePointerGameplayCursorContext(nextPointerPosition, hitStack)
        setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
        setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
        applyPointerGameplayDropTarget(resolvePointerGameplayDropTarget(nextDragState.kind, nextPointerPosition, hitStack))
        return
      }

      const pendingDrag = pendingPointerGameplayDragRef.current
      if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) {
        return
      }

      const moveDistance = Math.hypot(
        event.clientX - pendingDrag.startX,
        event.clientY - pendingDrag.startY,
      )

      if (moveDistance < POINTER_GAMEPLAY_DRAG_START_DISTANCE_PX) {
        return
      }

      const nextPointerPosition: PointerPosition = {
        x: event.clientX,
        y: event.clientY,
      }
      const nextDragState: ActivePointerGameplayDrag = {
        kind: pendingDrag.kind,
        id: pendingDrag.id,
        source: pendingDrag.source,
        runnerKey: pendingDrag.runnerKey,
        pointerId: pendingDrag.pointerId,
        x: nextPointerPosition.x,
        y: nextPointerPosition.y,
      }

      pendingPointerGameplayDragRef.current = null
      activePointerGameplayDragRef.current = nextDragState
      setActivePointerGameplayDrag(nextDragState)
      setPointerGameplayCursorPositionRef(nextPointerPosition)
      const hitStack = resolvePointerGameplayHitStack(nextPointerPosition)
      const cursorContext = resolvePointerGameplayCursorContext(nextPointerPosition, hitStack)
      setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
      setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
      beginRungoDragInteraction()
      applyPointerGameplayDropTarget(resolvePointerGameplayDropTarget(nextDragState.kind, nextPointerPosition, hitStack))
    }

    const handlePointerUpOrCancel = (event: PointerEvent) => {
      const activeDrag = activePointerGameplayDragRef.current
      if (activeDrag && activeDrag.pointerId === event.pointerId) {
        const finalPointerPosition: PointerPosition = {
          x: event.clientX,
          y: event.clientY,
        }
        const hitStack = resolvePointerGameplayHitStack(finalPointerPosition, true)
        const cursorContext = resolvePointerGameplayCursorContext(finalPointerPosition, hitStack)
        setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
        setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
        setPointerGameplayCursorPositionRef(cursorContext.isInGameplayArea ? finalPointerPosition : null)
        const dropTarget = resolvePointerGameplayDropTarget(activeDrag.kind, finalPointerPosition, hitStack)

        if (dropTarget?.kind === 'slot') {
          commitRungoDropOnSlot(activeDrag.id, dropTarget.slotIndex, dropTarget.isUnlockedSlot)
        } else if (activeDrag.source === 'runner') {
          commitRungoDropInHabitat(activeDrag.id, finalPointerPosition, activeDrag.runnerKey)
        }

        endRungoDragInteraction()
        return
      }

      const pendingDrag = pendingPointerGameplayDragRef.current
      if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) {
        return
      }

      const finalPointerPosition: PointerPosition = {
        x: event.clientX,
        y: event.clientY,
      }
      const hitStack = resolvePointerGameplayHitStack(finalPointerPosition, true)
      const cursorContext = resolvePointerGameplayCursorContext(finalPointerPosition, hitStack)
      setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
      setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
      setPointerGameplayCursorPositionRef(cursorContext.isInGameplayArea ? finalPointerPosition : null)

      clearPointerGameplayDragState()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUpOrCancel)
    window.addEventListener('pointercancel', handlePointerUpOrCancel)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUpOrCancel)
      window.removeEventListener('pointercancel', handlePointerUpOrCancel)
    }
  }, [
    applyPointerGameplayDropTarget,
    beginRungoDragInteraction,
    clearPointerGameplayDragState,
    commitRungoDropInHabitat,
    commitRungoDropOnSlot,
    endRungoDragInteraction,
    isPointerGameplayTracking,
    resolvePointerGameplayCursorContext,
    resolvePointerGameplayDropTarget,
    resolvePointerGameplayHitStack,
    setPointerGameplayCursorPositionRef,
  ])

  const handleRangePopupHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement
    if (target.closest('button, input, select, textarea, label')) {
      return
    }

    const popupNode = rangePopupRef.current
    if (!popupNode) {
      return
    }

    const rect = popupNode.getBoundingClientRect()
    rangePopupDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const clampedPosition = clampRangeWindowPosition({
      x: rect.left,
      y: rect.top,
    })
    rangePopupPositionRef.current = clampedPosition
    rangePopupDragPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    applyRangePopupTransform(clampedPosition)

    beginRungoDragInteraction()
    setIsDraggingRangePopup(true)
  }

  const displayRollStripIds = rollStripIds.length > 0
    ? rollStripIds
    : Array.from({ length: 12 }, (_, index) => ownedKeychains[index % Math.max(1, ownedKeychains.length)]?.id ?? 'base')

  const rollReelVariant = 'compact' as const

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateRollReelMetrics = () => {
      const reelShell = rollReelShellRef.current
      if (!reelShell) {
        return
      }

      const computed = window.getComputedStyle(reelShell)
      const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0
      const trackNode = reelShell.querySelector('.rungo-roll-track') as HTMLDivElement | null
      const firstCardNode = trackNode?.querySelector('.rungo-roll-card') as HTMLDivElement | null
      const trackComputed = trackNode ? window.getComputedStyle(trackNode) : null
      const measuredGap = trackComputed
        ? Number.parseFloat(trackComputed.columnGap || trackComputed.gap || `${ROLL_CARD_GAP_PX}`)
        : ROLL_CARD_GAP_PX
      const cardGap = Number.isFinite(measuredGap) && measuredGap >= 0 ? measuredGap : ROLL_CARD_GAP_PX
      const cardWidth = firstCardNode?.getBoundingClientRect().width ?? 0
      setRollReelMetrics({
        width: reelShell.clientWidth,
        paddingLeft,
        cardWidth,
        cardGap,
      })
    }

    updateRollReelMetrics()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        updateRollReelMetrics()
      })
      : null

    if (resizeObserver && rollReelShellRef.current) {
      resizeObserver.observe(rollReelShellRef.current)
    }

    window.addEventListener('resize', updateRollReelMetrics)
    return () => {
      window.removeEventListener('resize', updateRollReelMetrics)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [])

  const isTokenRollDisabled = isRolling || (!isDebugMode && rungoTokenBalance <= 0)
  const tokenWalletLabel = isDebugMode ? 'Infinity (Debug)' : String(rungoTokenBalance)
  const activeCursorDrag = activePointerGameplayDrag ?? activeNativeDragPreview
  const activePointerDraggedRungo = activeCursorDrag?.kind === 'rungo'
    ? rungoById[activeCursorDrag.id] ?? null
    : null
  const isPointerGameplayHoverAnimated = isPointerInGameplayArea
    && !activeCursorDrag
    && isPointerOverGameplayMovable
  const isPointerGameplayCursorTracked = hasPointerGameplayCursorPosition
  const isRangeCursorStickyMode = hubTab === 'garden' || isRangePopupOpen
  const shouldShowPointerGameplayCursor = isRangeCursorStickyMode
    ? isPointerGameplayCursorTracked
    : isPointerGameplayCursorTracked && (Boolean(activeCursorDrag) || isPointerInGameplayArea)
  const shouldShowPointerGameplayCursorDebugHud = isDebugMode && (hubTab === 'garden' || isRangePopupOpen)
  const pointerGameplayCursorFrame = activeCursorDrag
    ? 0
    : isPointerGameplayHoverAnimated
      ? pointerGameplayHoverFrame
      : 0
  const pointerGameplayCursorSprite = activeCursorDrag
    ? cursorPinchSprite
    : cursorHoverSprite
  const pointerGameplayCursorSheetFrameCount = activeCursorDrag
    ? 1
    : POINTER_GAMEPLAY_CURSOR_HOVER_FRAME_COUNT
  const pointerGameplayCursorClassName = [
    'rungo-pointer-drag-cursor',
    activeCursorDrag ? 'is-pinch' : 'is-hover',
    isPointerGameplayHoverAnimated ? 'is-hover-animated' : 'is-hover-idle',
    activePointerGameplayDrag
      ? activePointerGameplayDropTarget
        ? 'is-valid-target'
        : 'is-invalid-target'
      : '',
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isPointerGameplayHoverAnimated) {
      setPointerGameplayHoverFrame(0)
      return
    }

    const intervalId = window.setInterval(() => {
      setPointerGameplayHoverFrame((previous) => (previous + 1) % POINTER_GAMEPLAY_CURSOR_HOVER_FRAME_COUNT)
    }, POINTER_GAMEPLAY_CURSOR_HOVER_FRAME_DURATION_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isPointerGameplayHoverAnimated])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    if (activeCursorDrag) {
      document.body.classList.add('tm-rungo-global-cursor-none')
    } else {
      document.body.classList.remove('tm-rungo-global-cursor-none')
    }

    return () => {
      document.body.classList.remove('tm-rungo-global-cursor-none')
    }
  }, [activeCursorDrag])

  useEffect(() => {
    if (typeof window === 'undefined' || !activeNativeDragPreview) {
      return
    }

    const handleNativeDragOver = (event: DragEvent) => {
      const pointerPosition: PointerPosition = {
        x: event.clientX,
        y: event.clientY,
      }
      if (pointerPosition.x <= 0 && pointerPosition.y <= 0) {
        return
      }

      const hitStack = resolvePointerGameplayHitStack(pointerPosition)
      const cursorContext = resolvePointerGameplayCursorContext(pointerPosition, hitStack)
      setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
      setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
      setPointerGameplayCursorPositionRef(pointerPosition)
    }

    const handleNativeDragDone = () => {
      endRungoDragInteraction()
    }

    window.addEventListener('dragover', handleNativeDragOver)
    window.addEventListener('dragend', handleNativeDragDone)
    window.addEventListener('drop', handleNativeDragDone)

    return () => {
      window.removeEventListener('dragover', handleNativeDragOver)
      window.removeEventListener('dragend', handleNativeDragDone)
      window.removeEventListener('drop', handleNativeDragDone)
    }
  }, [
    activeNativeDragPreview,
    endRungoDragInteraction,
    resolvePointerGameplayCursorContext,
    resolvePointerGameplayHitStack,
    setPointerGameplayCursorPositionRef,
  ])

  const resolvePointerGameplayHoverCursorContext = useCallback((
    pointerPosition: PointerPosition,
    options?: {
      forceHitSample?: boolean
      eventTarget?: EventTarget | null
    },
  ) => {
    const hitStack = resolvePointerGameplayHitStack(pointerPosition, options?.forceHitSample ?? false)
    let cursorContext = resolvePointerGameplayCursorContext(pointerPosition, hitStack)

    if (!cursorContext.isInGameplayArea) {
      const targetNode = options?.eventTarget
      if (targetNode instanceof Element) {
        const isTargetInGameplayZone = Boolean(targetNode.closest<HTMLElement>('[data-gameplay-cursor-zone="true"]'))
        const clickableTarget = targetNode.closest<HTMLElement>(POINTER_GAMEPLAY_CLICKABLE_SELECTOR)
        const isTargetClickableInModal = Boolean(clickableTarget?.closest<HTMLElement>('.keychain-gallery-modal'))
        if (isTargetInGameplayZone || isTargetClickableInModal) {
          cursorContext = {
            isInGameplayArea: true,
            isOverMovableSource: cursorContext.isOverMovableSource
              || isTargetClickableInModal
              || Boolean(targetNode.closest<HTMLElement>('[data-pointer-drag-source="true"]')),
          }
        }
      }
    }

    if (!cursorContext.isInGameplayArea && typeof document !== 'undefined') {
      const isPointerInsideGameplayZoneRect = Array.from(
        document.querySelectorAll<HTMLElement>('[data-gameplay-cursor-zone="true"]'),
      ).some((zoneNode) => {
        const rect = zoneNode.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
          return false
        }

        return (
          pointerPosition.x >= rect.left
          && pointerPosition.x <= rect.right
          && pointerPosition.y >= rect.top
          && pointerPosition.y <= rect.bottom
        )
      })

      if (isPointerInsideGameplayZoneRect) {
        cursorContext = {
          isInGameplayArea: true,
          isOverMovableSource: cursorContext.isOverMovableSource,
        }
      }
    }

    return cursorContext
  }, [resolvePointerGameplayCursorContext, resolvePointerGameplayHitStack])

  const handleGameplayCursorPointerMoveCapture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const pointerPosition: PointerPosition = {
      x: event.clientX,
      y: event.clientY,
    }
    const shouldForceHitSample = !hasPointerGameplayCursorPosition || !isPointerInGameplayArea
    const cursorContext = resolvePointerGameplayHoverCursorContext(pointerPosition, {
      forceHitSample: shouldForceHitSample,
      eventTarget: event.target,
    })

    setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
    setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
    setPointerGameplayCursorPositionRef(cursorContext.isInGameplayArea ? pointerPosition : null)
  }, [
    hasPointerGameplayCursorPosition,
    isPointerInGameplayArea,
    resolvePointerGameplayHoverCursorContext,
    setPointerGameplayCursorPositionRef,
  ])

  const handleGameplayCursorZonePointerLeave = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (activePointerGameplayDragRef.current || activeNativeDragPreview) {
      return
    }

    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }

    if (relatedTarget instanceof Element && relatedTarget.closest<HTMLElement>('[data-gameplay-cursor-zone="true"]')) {
      return
    }

    resetPointerGameplayHitSampling()
    setIsPointerInGameplayArea(false)
    setIsPointerOverGameplayMovable(false)
    setPointerGameplayCursorPositionRef(null)
  }, [activeNativeDragPreview, resetPointerGameplayHitSampling, setPointerGameplayCursorPositionRef])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const resetWindowHoverCursorState = () => {
      if (activePointerGameplayDragRef.current || pendingPointerGameplayDragRef.current || activeNativeDragPreview) {
        return
      }

      resetPointerGameplayHitSampling()
      setIsPointerInGameplayArea(false)
      setIsPointerOverGameplayMovable(false)
      setPointerGameplayCursorPositionRef(null)
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        return
      }

      if (activePointerGameplayDragRef.current || pendingPointerGameplayDragRef.current || activeNativeDragPreview) {
        return
      }

      const pointerTarget = event.target
      if (pointerTarget instanceof Element && pointerTarget.closest<HTMLElement>('[data-gameplay-cursor-zone="true"]')) {
        return
      }

      const pointerPosition: PointerPosition = {
        x: event.clientX,
        y: event.clientY,
      }
      if (pointerPosition.x <= 0 && pointerPosition.y <= 0) {
        return
      }

      const shouldForceHitSample = !hasPointerGameplayCursorPosition || !isPointerInGameplayArea
      const cursorContext = resolvePointerGameplayHoverCursorContext(pointerPosition, {
        forceHitSample: shouldForceHitSample,
        eventTarget: event.target,
      })

      setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
      setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
      setPointerGameplayCursorPositionRef(cursorContext.isInGameplayArea ? pointerPosition : null)
    }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true })
    window.addEventListener('blur', resetWindowHoverCursorState)

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('blur', resetWindowHoverCursorState)
    }
  }, [
    activeNativeDragPreview,
    hasPointerGameplayCursorPosition,
    isPointerInGameplayArea,
    resetPointerGameplayHitSampling,
    resolvePointerGameplayHoverCursorContext,
    setPointerGameplayCursorPositionRef,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') {
        return
      }

      if (activePointerGameplayDragRef.current || pendingPointerGameplayDragRef.current) {
        event.preventDefault()
        if (activePointerGameplayDragRef.current) {
          endRungoDragInteraction()
          return
        }

        clearPointerGameplayDragState()
        return
      }

      if (isRangePopupOpen) {
        event.preventDefault()
        handleRestoreRangePanel()
        return
      }

      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    clearPointerGameplayDragState,
    endRungoDragInteraction,
    handleRestoreRangePanel,
    isRangePopupOpen,
    onClose,
  ])

  const renderRangeNameEditor = (compact = false) => (
    <div className={compact ? 'rungo-range-name-row is-compact' : 'rungo-range-name-row'}>
      {isEditingRangeName ? (
        <>
          <input
            type="text"
            className="rungo-range-name-input"
            value={rungoRangeDraftName}
            onChange={(event) => setRungoRangeDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitRangeName()
                return
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                setRungoRangeDraftName(rungoRangeName)
                setIsEditingRangeName(false)
              }
            }}
            onBlur={commitRangeName}
            maxLength={32}
            autoFocus
            aria-label="Rename Rungo Range"
          />
          <button
            type="button"
            className="rungo-range-title-button"
            onClick={commitRangeName}
          >
            Save
          </button>
        </>
      ) : (
        <>
          <strong>{rungoRangeName}</strong>
          <button
            type="button"
            className="rungo-range-title-button"
            onClick={() => {
              setIsEditingRangeName(true)
              setRungoRangeDraftName(rungoRangeName)
            }}
          >
            Rename
          </button>
        </>
      )}
    </div>
  )
  const renderGardenHabitat = (options?: { attachRef?: boolean; isPopup?: boolean }) => {
    const attachRef = options?.attachRef !== false
    const isPopup = options?.isPopup === true

    return (
    <div className={isPopup ? 'rungo-garden-habitat-frame is-popup' : 'rungo-garden-habitat-frame'}>
      <div
        ref={attachRef ? gardenHabitatRef : undefined}
        data-pointer-drop-habitat="true"
        data-garden-theme={activeGardenThemeId}
        className={[
          isPopup ? 'rungo-garden-habitat is-popup' : 'rungo-garden-habitat',
          isGardenItemDragOver ? 'is-item-drag-over' : '',
        ].filter(Boolean).join(' ')}
        onPointerMove={(event) => {
          const pointerPosition: PointerPosition = {
            x: event.clientX,
            y: event.clientY,
          }
          const cursorContext = resolvePointerGameplayHoverCursorContext(pointerPosition, {
            forceHitSample: true,
            eventTarget: event.target,
          })

          setIsPointerInGameplayArea(true)
          setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
          setPointerGameplayCursorPositionRef(pointerPosition)
        }}
        onPointerLeave={(event) => {
          const relatedTarget = event.relatedTarget
          if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
            resetPointerGameplayHitSampling()
            setIsPointerInGameplayArea(false)
            setIsPointerOverGameplayMovable(false)
            setPointerGameplayCursorPositionRef(null)
          }
        }}
        style={{
          ['--speech-bubble-icon' as string]: `url(${speechBubbleIcon})`,
        }}
      >
        <div className="rungo-garden-habitat-clouds" aria-hidden="true" />
        <div className="rungo-garden-habitat-ground" aria-hidden="true" />


        {gardenRunnerStates.length === 0 ? (
          <div className="rungo-garden-habitat-empty">
            Place Rungos in slots. Unplaced unlocks may visit as guests.
          </div>
        ) : null}

        {gardenRunnerStates.map((runner, runnerIndex) => {
          const runnerKeychain = rungoById[runner.rungoId]
          if (!runnerKeychain) {
            return null
          }

          const isRunnerBeingCarried = activePointerGameplayDrag?.kind === 'rungo'
            && activePointerGameplayDrag.source === 'runner'
            && activePointerGameplayDrag.runnerKey === runner.key
          if (isRunnerBeingCarried) {
            return null
          }

          const runnerBottomPx = resolveGardenRunnerBottomPx(runner)
          const runnerDepthPercent = clampGardenDepthPercent(runner.depthPercent)
          const runnerZIndex = 20 + Math.round((100 - runnerDepthPercent) * 2) + runnerIndex
          const runnerClassName = [
            'rungo-garden-runner',
            runner.role === 'visitor' ? 'is-visitor' : '',
            runner.mode === 'running' ? 'is-running' : '',
            activeGardenRunnerDropRungoId === runner.rungoId ? 'is-item-drop-target' : '',
          ].filter(Boolean).join(' ')
          const isSpeaking = Boolean(runner.bubbleText) && runner.bubbleUntil > gardenNow
          const bubbleStyle = runner.bubbleMood === 'happy'
            ? { ['--bubble-hue' as string]: `${Math.round((gardenNow / 18 + runnerIndex * 41) % 360)}` }
            : undefined
          return (
            <div
              key={runner.key}
              className={runnerClassName}
              data-pointer-drag-source="true"
              data-pointer-drop-runner-rungo-id={runner.rungoId}
              onPointerDown={(event) => {
                handleRungoPointerDown(event, runner.rungoId, {
                  source: 'runner',
                  runnerKey: runner.key,
                })
              }}
              style={{
                left: `${runner.x}px`,
                bottom: `${runnerBottomPx}px`,
                zIndex: runnerZIndex,
              }}
            >
              {isSpeaking ? (
                <span className={`rungo-garden-speech mood-${runner.bubbleMood}`} style={bubbleStyle}>
                  <span className="rungo-garden-speech-text">{runner.bubbleText}</span>
                </span>
              ) : null}

              <AnimatedRungoSprite
                keychain={runnerKeychain}
                mode={runner.mode}
                size={42}
                isAnimated
                centered
                flipX={runner.direction === -1}
              />
            </div>
          )
        })}
      </div>
    </div>
    )
  }

  const outerModalBackground = 'transparent'
  const outerModalBackdropFilter = 'none'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rungos"
      className={[
        'keychain-gallery-modal',
        systemTheme.brandClassName,
        shouldShowPointerGameplayCursor ? 'is-gameplay-cursor-visible' : '',
        isRungoDragActive ? 'is-rungo-dragging' : '',
        activePointerGameplayDrag ? 'is-pointer-gameplay-dragging' : '',
        isRungoInteractionActive ? 'is-rungo-interaction-active' : '',
        isRungoUltraLite ? 'is-rungo-ultra-lite' : '',
      ].filter(Boolean).join(' ')}
      onDragStartCapture={(event) => {
        const target = event.target as HTMLElement
        activeModalDragRef.current = null
        let nextNativePreview: ActiveModalDrag | null = null
        const rungoDragId = target
          .closest<HTMLElement>('[data-rungo-drag-id]')
          ?.dataset
          .rungoDragId
          ?.trim() ?? ''
        if (rungoDragId) {
          nextNativePreview = {
            kind: 'rungo',
            id: rungoDragId,
          }
          activeModalDragRef.current = nextNativePreview
          if (typeof window !== 'undefined') {
            const hostWindow = window as unknown as { __tmActiveRungoDragId?: string }
            hostWindow[ACTIVE_RUNGO_DRAG_WINDOW_KEY] = rungoDragId
          }
        }

        if (!nextNativePreview) {
          return
        }

        const pointerPosition: PointerPosition = {
          x: event.clientX,
          y: event.clientY,
        }
        setActiveNativeDragPreview(nextNativePreview)
        if (pointerPosition.x > 0 || pointerPosition.y > 0) {
          const hitStack = resolvePointerGameplayHitStack(pointerPosition)
          const cursorContext = resolvePointerGameplayCursorContext(pointerPosition, hitStack)
          setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
          setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
          setPointerGameplayCursorPositionRef(pointerPosition)
        }

        beginRungoDragInteraction()
      }}
      onDragOverCapture={(event) => {
        if (!activeNativeDragPreview) {
          return
        }

        const pointerPosition: PointerPosition = {
          x: event.clientX,
          y: event.clientY,
        }
        if (pointerPosition.x <= 0 && pointerPosition.y <= 0) {
          return
        }

        const hitStack = resolvePointerGameplayHitStack(pointerPosition)
        const cursorContext = resolvePointerGameplayCursorContext(pointerPosition, hitStack)
        setIsPointerInGameplayArea(cursorContext.isInGameplayArea)
        setIsPointerOverGameplayMovable(cursorContext.isOverMovableSource)
        setPointerGameplayCursorPositionRef(pointerPosition)
      }}
      onDragEndCapture={() => {
        endRungoDragInteraction()
      }}
      onDropCapture={() => {
        endRungoDragInteraction()
      }}
      onPointerMoveCapture={handleGameplayCursorPointerMoveCapture}
      style={{
        ...systemTheme.styleVars,
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: outerModalBackground,
        backdropFilter: outerModalBackdropFilter,
        WebkitBackdropFilter: outerModalBackdropFilter,
        display: 'flex',
        alignItems: isPanelMinimized ? 'stretch' : 'flex-start',
        justifyContent: isPanelMinimized ? 'stretch' : 'flex-end',
        padding: isPanelMinimized ? undefined : '56px 88px 24px 24px',
        pointerEvents: 'none',
      }}
    >
      {!isPanelMinimized ? (
      <div
        className="rungo-hub-shell is-docked"
        data-gameplay-cursor-zone="true"
        onPointerLeave={handleGameplayCursorZonePointerLeave}
      >
        <RungoModalShell
          hubTab={hubTab}
          isExpanded={false}
          showExpandToggle={false}
          unlockedCount={unlockedCount}
          totalCount={ownedKeychains.length}
          tokenBalanceLabel={tokenWalletLabel}
          seedBalance={gardenSeedBalance}
          onTabChange={(tab) => {
            setHubTab(tab)
            if (tab === 'garden' && isRangeDiscoveryHintVisible) {
              dismissRangeDiscoveryHint()
            }
            playSoundCue(iconScrollSound, 0.56)
          }}
          onToggleExpanded={() => {}}
          onClose={onClose}
        >
          {hubTab === 'collection' ? (
            <>
              <div className="tm-rungo-collection-fixed">
                <RungoRollPanel
                  variant={rollReelVariant}
                  reelShellRef={rollReelShellRef}
                  isRolling={isRolling}
                  rollAnimationKey={rollAnimationKey}
                  rollTrackOffsetPx={effectiveRollTrackOffsetPx}
                  displayRollStripIds={displayRollStripIds}
                  rollWinnerIndex={rollWinnerIndex}
                  lastRolledTierClassName={lastRolledTierClassName}
                  rollTierFlashClassName={rollTierFlashClassName}
                  rungoById={rungoById}
                  rollResult={rollResultSummary}
                />

                <RungoCollectionToolbar
                  search={collectionSearch}
                  filter={collectionFilter}
                  isTokenRollDisabled={isTokenRollDisabled}
                  isRolling={isRolling}
                  onSearchChange={setCollectionSearch}
                  onFilterChange={setCollectionFilter}
                  onRoll={handleRollWithToken}
                  collectionCount={filteredCollectionRungos.length}
                />

                {rollStatus && !(rollResultSummary && !isRolling) ? (
                  <div className="rungo-roll-status">{rollStatus}</div>
                ) : null}

                {isDebugMode ? (
                  <div className="rungo-debug-banner">
                    <span className="rungo-debug-banner-copy">
                      Debug mode is active. Right-click any collection tile to lock or unlock it.
                    </span>
                    <button
                      type="button"
                      onClick={handleDebugRoll}
                      className="rungo-debug-banner-action"
                    >
                      Debug Roll
                    </button>
                  </div>
                ) : null}

                {isDebugMode && debugRollStatus ? (
                  <div className="rungo-debug-status">{debugRollStatus}</div>
                ) : null}
              </div>

              <div className="tm-rungo-collection-body">
                <div className="rungo-collection-layout">
                  <div className="rungo-collection-grid-panel">
                    <RungoCollectionGrid
                      entries={collectionGridEntries}
                      onSelect={setSelectedKeychainId}
                      onDragStart={(rungoId, event) => {
                        setRungoDragPayload(event.dataTransfer, rungoId)
                      }}
                      onDebugContextMenu={isDebugMode
                        ? (rungoId, event) => {
                          event.preventDefault()
                          const entry = rungoById[rungoId]
                          if (!entry) {
                            return
                          }

                          const isUnlocked = isRungoUnlocked(rungoId)
                          if (isUnlocked) {
                            if (RUNGO_UNLOCKED_DEFAULT_IDS.includes(rungoId)) {
                              setDebugRollStatus(`${entry.name} is a starter Rungo and stays unlocked.`)
                              return
                            }

                            lockRungo(rungoId)
                            setDebugRollStatus(`Locked ${entry.name}.`)
                            return
                          }

                          unlockRungo(rungoId)
                          setDebugRollStatus(`Unlocked ${entry.name}.`)
                        }
                        : undefined}
                    />
                  </div>

                  <div className="rungo-detail-panel tm-ui-scrollbar">
                    {selectedKeychain ? (
                      <KeychainDetail
                        keychain={selectedKeychain}
                        isUnlocked={isRungoUnlocked(selectedKeychain.id)}
                        isSignature={signatureRungoId === selectedKeychain.id}
                        onSetSignature={isRungoUnlocked(selectedKeychain.id)
                          ? () => {
                            handleSetGallerySignature(selectedKeychain.id)
                          }
                          : undefined}
                      />
                    ) : (
                      <div className="rungo-selection-empty">
                        {PLAYTIME_PLANET_ENABLED
                          ? 'Pick a Rungo, then drag it to a system or Playtime planet.'
                          : 'Pick a Rungo, then drag it to a system.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="tm-rungo-range-body">
            <div
              className="rungo-garden-shell is-compact-range"
              data-garden-theme={activeGardenThemeId}
              data-gameplay-cursor-zone="true"
              onPointerLeave={handleGameplayCursorZonePointerLeave}
            >
              <div className="rungo-garden-toolbar is-compact">
                <div className="rungo-garden-toolbar-title-row">
                  {renderRangeNameEditor(true)}
                  <button
                    type="button"
                    className="rungo-range-title-button"
                    onClick={handleOpenRangePopup}
                  >
                    Float Range
                  </button>
                </div>
                <div className="rungo-garden-toolbar-inline">
                  <span className="rungo-garden-pill">{gardenSeedBalance} seeds</span>
                  <span className="rungo-garden-pill">{gardenPlacedCount}/{gardenUnlockedSlotCount} placed</span>
                  <label className="rungo-garden-theme-picker is-inline">
                    <select
                      className="rungo-garden-theme-select"
                      value={activeGardenThemeId}
                      onChange={(event) => handleChangeGardenTheme(event.target.value as GardenThemeId)}
                      aria-label="Range theme"
                    >
                      {gardenThemes.map((theme) => {
                        const isUnlockedTheme = gardenUnlockedThemeIds.includes(theme.id)
                        const shortName = formatGardenThemeShortName(theme.name)
                        const optionLabel = isUnlockedTheme
                          ? shortName
                          : `${shortName} (${theme.unlockHours}h)`
                        return (
                          <option key={theme.id} value={theme.id} disabled={!isUnlockedTheme}>
                            {optionLabel}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={nextGardenSlotCost !== null && gardenSeedBalance >= nextGardenSlotCost
                      ? 'rungo-garden-action-button is-compact'
                      : 'rungo-garden-action-button is-compact is-disabled'}
                    onClick={handleUnlockGardenSlot}
                    disabled={nextGardenSlotCost === null || gardenSeedBalance < nextGardenSlotCost}
                  >
                    {nextGardenSlotCost === null ? 'Max slots' : `+Slot ${nextGardenSlotCost}`}
                  </button>
                </div>
              </div>

              <div className="rungo-garden-layout is-compact">
                <section className="rungo-garden-stage">
                  {!isRangePopupOpen ? renderGardenHabitat() : null}

                  <div className="rungo-garden-slot-strip" role="list" aria-label="Range residence slots">
                    {Array.from({ length: gardenMaxSlotCount }, (_, slotIndex) => {
                      const slotRungoId = gardenSlotAssignments[slotIndex]
                      const slotRungo = slotRungoId ? rungoById[slotRungoId] ?? null : null
                      const isUnlockedSlot = slotIndex < gardenUnlockedSlotCount
                      const isSelectedSlot = selectedGardenSlotIndex === slotIndex
                      const isDropTargetSlot = activeGardenSlotDropIndex === slotIndex
                      const chipClassName = [
                        'rungo-garden-slot-chip',
                        isUnlockedSlot ? '' : 'is-locked',
                        isSelectedSlot ? 'is-selected' : '',
                        isDropTargetSlot ? 'is-drop-target' : '',
                        slotRungo ? 'is-filled' : '',
                      ].filter(Boolean).join(' ')

                      const label = slotRungo
                        ? slotRungo.name
                        : isUnlockedSlot
                          ? 'Empty'
                          : slotIndex === gardenUnlockedSlotCount && nextGardenSlotCost !== null
                            ? `${nextGardenSlotCost} Seeds`
                            : 'Locked'

                      return (
                        <button
                          key={`garden-slot-chip-${slotIndex}`}
                          type="button"
                          className={chipClassName}
                          data-pointer-drop-slot-index={slotIndex}
                          data-pointer-drop-slot-unlocked={isUnlockedSlot ? 'true' : 'false'}
                          disabled={!isUnlockedSlot}
                          onClick={() => {
                            if (!isUnlockedSlot) {
                              return
                            }

                            setSelectedGardenSlotIndex(slotIndex)
                            setGardenStatus('')
                          }}
                        >
                          <span className="rungo-garden-slot-chip-index">Slot {slotIndex + 1}</span>
                          <span className="rungo-garden-slot-chip-label">{label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="rungo-garden-slot-actions is-compact">
                    <button
                      type="button"
                      className={selectedGardenSlotIndex !== null && selectedGardenRungo
                        ? 'rungo-garden-action-button is-compact'
                        : 'rungo-garden-action-button is-compact is-disabled'}
                      onClick={handlePlaceSelectedGardenRungo}
                      disabled={selectedGardenSlotIndex === null || !selectedGardenRungo}
                    >
                      Place
                    </button>
                    <button
                      type="button"
                      className={selectedGardenSlotIndex !== null
                        && typeof gardenSlotAssignments[selectedGardenSlotIndex] === 'string'
                        ? 'rungo-garden-action-button is-compact'
                        : 'rungo-garden-action-button is-compact is-disabled'}
                      onClick={handleClearGardenSlot}
                      disabled={selectedGardenSlotIndex === null || typeof gardenSlotAssignments[selectedGardenSlotIndex] !== 'string'}
                    >
                      Clear
                    </button>
                  </div>
                </section>

                <aside className="rungo-garden-roster">
                  <div className="rungo-garden-stage-head is-compact">
                    <strong>Roster</strong>
                    <span>{gardenAvailableRungos.length}</span>
                  </div>

                  <div className="rungo-garden-roster-list">
                    {gardenAvailableRungos.length > 0 ? gardenAvailableRungos.map((entry) => {
                      const assignedSlotIndex = gardenSlotIndexByRungoId[entry.id]
                      const isPlaced = typeof assignedSlotIndex === 'number'
                      const isSelectedRungo = selectedGardenRungo?.id === entry.id
                      const className = [
                        'rungo-garden-roster-item',
                        isSelectedRungo ? 'is-selected' : '',
                        isPlaced ? 'is-placed' : '',
                      ].filter(Boolean).join(' ')

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className={className}
                          data-pointer-drag-source="true"
                          onClick={() => {
                            setSelectedGardenRungoId(entry.id)
                            setGardenStatus('')
                          }}
                          onPointerDown={(event) => {
                            handleRungoPointerDown(event, entry.id, {
                              source: 'roster',
                              runnerKey: null,
                            })
                          }}
                        >
                          <span className="rungo-garden-roster-sprite" aria-hidden="true">
                            <AnimatedRungoSprite
                              keychain={entry}
                              mode={isSelectedRungo ? 'running' : 'idle'}
                              size={30}
                              isAnimated={isSelectedRungo}
                              isLocked={isPlaced && !isSelectedRungo}
                              centered
                            />
                          </span>
                          <span className="rungo-garden-roster-copy">
                            <strong>{entry.name}</strong>
                            <span>{isPlaced ? 'Placed' : 'Ready'}</span>
                          </span>
                        </button>
                      )
                    }) : (
                      <div className="rungo-garden-empty-note">
                        Roll Rungos in Collection to fill your Range.
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {gardenStatus ? <div className="rungo-garden-status is-compact">{gardenStatus}</div> : null}
            </div>
            </div>
          )}
        </RungoModalShell>
      </div>
      ) : null}

      {isRangePopupOpen ? (
        <div
          ref={rangePopupRef}
          data-gameplay-cursor-zone="true"
          className={isDraggingRangePopup ? 'rungo-range-popup is-dragging' : 'rungo-range-popup'}
          onPointerLeave={handleGameplayCursorZonePointerLeave}
          style={{
            transform: `translate3d(var(--rungo-popup-x, ${rangePopupPosition.x}px), var(--rungo-popup-y, ${rangePopupPosition.y}px), 0)`,
          }}
        >
          <div className="rungo-range-popup-head" onPointerDown={handleRangePopupHeaderPointerDown}>
            <div className="rungo-range-popup-title-wrap">
              {renderRangeNameEditor(true)}
              <span>{rungoRangeName}</span>
            </div>
            <div className="rungo-range-popup-actions">
              <button
                type="button"
                className="rungo-range-title-button"
                onClick={handleRestoreRangePanel}
              >
                Dock Range
              </button>
              <button
                type="button"
                className="rungo-range-title-button"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>

          {renderGardenHabitat({ isPopup: true })}
        </div>
      ) : null}

      <GameplayPointerCursor
        isVisible={shouldShowPointerGameplayCursor}
        className={pointerGameplayCursorClassName}
        sizePx={POINTER_GAMEPLAY_CURSOR_RENDER_SIZE_PX}
        spriteUrl={pointerGameplayCursorSprite}
        frameIndex={pointerGameplayCursorFrame}
        sheetFrameCount={pointerGameplayCursorSheetFrameCount}
        draggedRungo={activePointerDraggedRungo}
        cursorRef={setPointerGameplayCursorNode}
      />

      {shouldShowPointerGameplayCursorDebugHud ? (
        <div className="rungo-cursor-debug-hud" aria-live="polite">
          <strong>Cursor Debug</strong>
          <span>hasPointerGameplayCursorPosition: {hasPointerGameplayCursorPosition ? '1' : '0'}</span>
          <span>isPointerInGameplayArea: {isPointerInGameplayArea ? '1' : '0'}</span>
          <span>shouldShowPointerGameplayCursor: {shouldShowPointerGameplayCursor ? '1' : '0'}</span>
          <span>
            lastPointer: {pointerGameplayCursorDebugLastPosition
              ? `${pointerGameplayCursorDebugLastPosition.x}, ${pointerGameplayCursorDebugLastPosition.y}`
              : '--'}
          </span>
        </div>
      ) : null}
    </div>
  )
}
