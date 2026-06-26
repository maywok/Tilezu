import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import '../../../App.css'
import { TitleBar } from '../../../components/TitleBar/TitleBar'
import { TopBar } from '../../../components/TopBar'
import { SystemCard } from '../../../components/SystemCard/SystemCard'
import { warmSystemCollageCache } from '../../../components/SystemCard/systemCollageCache'
import { getKeychainById, ownedKeychains } from '../../../components/keychains-data'
import { SystemThemeProvider } from '../../../context/SystemThemeContext'
import { useDeferredStartup } from '../../../hooks/useDeferredStartup'
import { useKeychainAttachments } from './useKeychainAttachments'
import { DetailPanel } from '../components/DetailPanel'
import { CopyContextMenu } from '../components/CopyContextMenu'
import { GameTileContextMenu } from '../components/GameTileContextMenu'
import { AddGamesModal, isUserAddedExecutable } from '../components/addGames'
import type { AddGamesFilter, AddGamesTab, RomImportConfidence, RomImportPreviewFilter, RomImportPreviewRow } from '../components/addGames'
import { CustomCoverCropModal } from '../components/CustomCoverCropModal'
import { LauncherFunctionsBar } from '../components/LauncherFunctionsBar'
import { FloatingSystemLogos } from '../components/FloatingSystemLogos'
import {
  LauncherGrid,
  type LauncherGridDiagnostics,
  type LauncherGridLayoutMetrics,
} from '../components/LauncherGrid'
import { SystemsGrid } from '../components/SystemsGrid'
import {
  DEFAULT_SYSTEM_EMULATOR_MAP,
  DEFAULT_ROM_DIRS,
  EMPTY_EMULATOR_PATHS,
  EMULATOR_FIELDS,
  ROM_SYSTEM_FOLDERS,
  SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY,
  STACK_WHEEL_MOMENTUM_SETTLE_MS,
  STARTER_GAMES,
  STARTUP_DEFERRED_WORK_DELAY_MS,
} from '../constants'
import type {
  AchievementFilter,
  AppTab,
  CategoryMeta,
  CustomSystemDefinition,
  CustomSystemIngestionMode,
  CoverArtMetadata,
  CoverSourceProvenance,
  CoverArtStatus,
  GameUpdateStatus,
  EmulatorKey,
  GameEntry,
  GameLibraryMeta,
  ImportedGame,
  GamesViewMode,
  GraphicsFidelityMode,
  GridGroupMode,
  GridSizeMode,
  GridSortMode,
  LauncherCategory,
  LauncherControllerAction,
  LauncherControllerBindsBySystem,
  LauncherControllerSystemBinds,
  LauncherControllerInput,
  LauncherControllerLayout,
  LauncherGamepadFamily,
  LauncherInputMode,
  LauncherView,
  SceneRouteTransition,
  SteamControllerCoexistenceMode,
  SteamAchievementsResponse,
  SystemsGridSizeMode,
  SystemsGridSortMode,
  SystemsViewMode,
} from '../types'
import { useGameScreenshots } from './useGameScreenshots'
import { useLauncherCatalogModel } from './useLauncherCatalogModel'
import {
  deriveLauncherFlags,
  describeEffectiveFidelity,
  resolveEffectiveFidelity,
  type AutoFidelityDowngrade,
} from '../utils/resolveGraphicsFidelity'
import { useLauncherInteractionEffects } from './useLauncherInteractionEffects'
import { buildAddGamesSystemsPanelProps } from './buildAddGamesSystemsPanelProps'
import { useLauncherLibraryActions } from './useLauncherLibraryActions'
import { useGameTileContextMenu } from './useGameTileContextMenu'
import { useLauncherPersistenceAudioEffects } from './useLauncherPersistenceAudioEffects'
import { useLauncherMenuMusic } from './useLauncherMenuMusic'
import { useLauncherStackModel } from './useLauncherStackModel'
import { BACKGROUND_INDEX_PENDING_KEY, LOCAL_PROFILE_KEY, ONBOARDING_DRAFT_KEY, ONBOARDING_META_KEY } from '../../onboarding/constants'
import {
  DEFAULT_CATEGORY,
  formatPlaytimeMinutes,
  getGameCategory,
  getGameSource,
  isLikelySteamEntry,
  parseSteamAppId,
} from '../utils/category'
import { cleanRomTitleMetadata, normalizeGameTitle } from '../utils/search'
import { AppearanceCustomizerScreen } from '../../appearance/AppearanceCustomizerScreen'
import { APPEARANCE_ADVANCED_ENABLED } from '../../appearance/featureFlags'
import { ProfileScreen } from '../../profile/ProfileScreen'
import { buildSettingsScreenModel } from '../../settings/buildSettingsScreenModel'
import { createSettingsSliderSoundPlayer } from '../../settings/utils/settingsSliderFeedback'
import { SettingsScreen } from '../../settings/components/SettingsScreen'
import { DEFAULT_SETTINGS_SECTION } from '../../settings/settingsRegistry'
import type { QuickSettingsBindings, SettingsSectionId } from '../../settings/types'
import type { PlayerIdIdentity, PlayerIdLayoutPrefs, PlayerIdShowcase, PlayerIdStats, PlayerIdStickerPlacement } from '../../playerId/types'
import { DEFAULT_PLAYER_ID_ACCENT_ID, DEFAULT_PLAYER_ID_FOIL_TYPE } from '../../playerId/constants'
import { normalizePlayerIdStickers } from '../../playerId/playerIdProfileUtils'
import { processStickerStamp } from '../../playerId/processStickerStamp'
import { PlayerIdOverlay } from '../../playerId/PlayerIdOverlay'
import { PLAYER_ID_ENABLED } from '../../playerId/featureFlags'
import { listLibrarySystemOptions, resolvePlayerIdShowcase } from '../../playerId/resolvePlayerIdShowcase'
import { AppearanceRuntimeBackdrop } from '../../appearance/components/AppearanceRuntimeBackdrop'
import { useAppearanceTheme } from '../../appearance/hooks/useAppearanceTheme'
import type { ThemeGradient } from '../../appearance/types'
import { normalizeGradient } from '../../appearance/utils/theme'
import { SystemGradientDialogSimple } from '../components/SystemGradientDialogSimple'
import {
  buildTileMotionStyle,
  getBrandBackdropGradient,
  getFavoriteStarTone,
  getSelectionAccentGradient,
  shouldShowCornerDew,
} from '../utils/visuals'
import {
  assignControllerBinding,
  CONTROLLER_ACTION_ORDER,
  CONTROLLER_ACTION_LABELS,
  CONTROLLER_ESSENTIAL_ACTIONS,
  CONTROLLER_ADVANCED_ACTIONS,
  CONTROLLER_PLATFORM_ACTIONS,
  CONTROLLER_PLATFORM_ACTION_LABELS,
  CONTROLLER_INPUT_LABELS,
  CONTROLLER_INPUT_ORDER,
  CONTROLLER_LAYOUT_OPTIONS,
  createDefaultControllerBindsBySystem,
  createDefaultControllerSystemBinds,
  formatControllerInputForLayout,
  layoutForGamepadFamily,
  remapBindingInputForLayout,
  resolveControllerSystemBinds,
} from '../utils/controllerBindings'
import {
  canAutoEnsureRetroArchCoreForEntries,
  createDefaultPlatformPeripheralsBySystem,
  getPlatformPeripheralOptionsForSystem,
  resolvePlatformPeripheralsForSystem,
} from '../utils/platformPeripherals'
import {
  applyLeftStickYOrientation,
  isDirectionalActionPressed,
  isNavigationStickActive,
  pickExclusiveStickNavigationAction,
  processStickNavigationHold,
  resolveBoundStickMagnitude,
  resolveDirectionalInputSource,
  resolveEffectiveStickInput,
  type GamepadStickNavState,
} from '../utils/gamepadStickNavigation'
import {
  resolveAxisDirection,
  resolveRightStickAxes,
  type GamepadAxisState,
} from '../utils/gamepadStickReading'
import { resolveControllerInputContext } from '../utils/controllerInputContext'
import { focusElement, focusFirst, clearControllerFocusHighlights, moveFocusSpatial, pickDirectionalSpatialTarget, type DirectionalMove, type DirectionalSpatialTarget } from '../utils/controllerFocus'
import { setupModalDialogControllerNavigation } from '../utils/controllerModalHandler'
import {
  getControllerPromptContextLabel,
  handleControllerActionForContext,
  type ControllerInputHandlerDeps,
} from './useLauncherControllerInput'
import { decodeLaunchError } from '../utils/launchErrors'
import {
  buildSystemGradientOverrideCss,
  deriveSystemGradientThemeTokens,
  getDefaultSystemGradient,
  getDefaultSystemGradientAnimation,
  getSystemGradientApplyMode,
  loadSystemGradientAnimationMap,
  loadSystemGradientApplyModeMap,
  loadSystemGradientMap,
  loadSystemLogoBorderMap,
  normalizeSystemGradientAnimationSettings,
  persistSystemGradientAnimationMap,
  persistSystemGradientApplyModeMap,
  persistSystemGradientMap,
  persistSystemLogoBorderMap,
  buildLogoBorderOverrideCss,
  type SystemGradientAnimationSettings,
  type SystemGradientApplyMode,
  type SystemGradientApplyModeMap,
  type SystemLogoBorderMap,
} from '../utils/systemGradient'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'
import {
  autoImportGamesOrchestrated,
  clearCoverThumbnailCache,
  enterLowPowerMode,
  getGameUpdateStates,
  launchGame as launchGameCommand,
  setCloseToTrayEnabled,
  testRaConnection,
  getRaRecentAchievements,
  getRaUserAwards,
  wakeFromLowPowerMode,
  ensureRomFolders,
} from '../../../services/launcherService'
import type { RaUserProfile, RaRecentAchievement, RaAward } from '../types'
import { emitSignatureRungoReaction } from '../utils/signatureRungoReaction'
import {
  buildCustomSystemKey,
  deriveCustomSystemShortLabel,
  filterUserCustomSystems,
  isFactorySystemKey,
  loadCustomSystems,
  mergeLauncherCustomSystems,
  normalizeHexColor,
  sanitizeCustomSystemName,
  saveCustomSystems,
  toCustomSystemCategory,
  FACTORY_SYSTEM_DEFINITIONS,
} from '../utils/customSystems'
import { markBootStage, timeBootAsync, timeBootSync } from '../../../utils/bootPerf'
import { applyVariationToAudio, playVariedClone, sampleSoundVariation } from '../../../utils/variedUiSound'
import type { SettingsUiSoundKind } from '../../../assets/sounds/settings'
import { playSettingsUiSound, type SettingsUiSoundRefs } from '../utils/settingsUiSound'

const AchievementModal = lazy(async () => {
  const module = await import('../../../components/AchievementModal')
  return { default: module.AchievementModal }
})

const PlaytimeModal = lazy(async () => {
  const module = await import('../../../components/PlaytimeModal')
  return { default: module.PlaytimeModal }
})

const Sidebar = lazy(async () => {
  const module = await import('../../../components/Sidebar')
  return { default: module.Sidebar }
})

type GameClickDroplet = { x: number; y: number; scale: number; delay: number }

const BACKDROP_FADE_DURATION_MS = 840
const FRAME_BUDGET_SAMPLE_WINDOW = 72
const FRAME_BUDGET_MIN_SAMPLES = 24
const FRAME_BUDGET_RECOVER_AVG_MS = 16.9
const FRAME_BUDGET_RECOVER_P75_MS = 18.1
const FRAME_BUDGET_POOR_AVG_MS = 24.4
const FRAME_BUDGET_POOR_P75_MS = 27.6
const FRAME_BUDGET_HINT_POOR_MS = 12_000
const AUTO_DOWNGRADE_TO_LITE_MS = 45_000
const AUTO_DOWNGRADE_TO_ULTRA_LITE_MS = 90_000
const AUTO_RECOVER_TO_NORMAL_MS = 180_000
const DEBUG_MENU_VISIBLE_STORAGE_KEY = 'tm:debugMenuVisible'
const DEBUG_MENU_VISIBILITY_EVENT = 'tm-debug-menu-visibility-changed'
const DEFAULT_CUSTOM_SYSTEM_PRIMARY = '#3c9bf5'
const DEFAULT_CUSTOM_SYSTEM_SECONDARY = '#69dcff'
const CUSTOM_SYSTEM_ASSIGNMENTS_STORAGE_KEY = 'tile-manager-custom-system-assignments'
const CUSTOM_SYSTEM_AUTO_SORT_EXCLUSIONS_STORAGE_KEY = 'tile-manager-custom-system-auto-sort-exclusions'
const COLLAGE_STUDIO_DRAFTS_STORAGE_KEY = 'tile-manager-collage-studio-drafts-v1'
const DEFAULT_COLLAGE_DRAW_COLOR = '#2a4f7a'
const DEFAULT_COLLAGE_TEXT_COLOR = '#1f365d'
const DEFAULT_COLLAGE_DRAW_SIZE = 4
const DEFAULT_COLLAGE_TEXT_SIZE = 32
const DEFAULT_COLLAGE_ERASER_SIZE = 24
const DEFAULT_COLLAGE_LAYER_POSITION = 0.5
const DEFAULT_COLLAGE_LAYER_SIZE = 1
const DEFAULT_COLLAGE_LAYER_ROTATION = 0
const MIN_COLLAGE_LAYER_SIZE = 0.08
const MAX_COLLAGE_LAYER_SIZE = 2
const COLLAGE_DRAW_RENDER_SIZE = 1000
const GAMEPAD_POLL_INTERVAL_MS = 16
const STICK_NAV_TAP_DEBOUNCE_MS = 45

function readProfileQuickPanelState(): { isQuickCustomizeOpen: boolean; isQuickSettingsOpen: boolean } {
  return {
    isQuickCustomizeOpen: Boolean(document.getElementById('sidebar-quick-customize')?.classList.contains('is-open')),
    isQuickSettingsOpen: ['sidebar-quick-settings', 'titlebar-quick-settings'].some(
      (panelId) => Boolean(document.getElementById(panelId)?.classList.contains('is-open')),
    ),
  }
}
const GAMEPAD_POPUP_FADE_IN_MS = 180
const GAMEPAD_POPUP_VISIBLE_MS = 1500
const GAMEPAD_POPUP_FADE_OUT_MS = 220
const GAMEPAD_PROMPT_IDLE_DELAY_MS = 4000
const LAUNCHER_IDLE_TASK_TIMEOUT_MS = 5000
const UPDATE_STATUS_INITIAL_REFRESH_DELAY_MS = 3000
const UPDATE_STATUS_FETCH_DELAY_MS = 220
const UPDATE_STATUS_CADENCE_FOREGROUND_MS = 150_000
const UPDATE_STATUS_CADENCE_BACKGROUND_MS = 420_000
const UPDATE_STATUS_BATCH_SIZE = 24
const UPDATE_STATUS_BATCH_SPACING_MS = 140
const UPDATE_STATUS_ACTIVE_INPUT_GRACE_MS = 2500
const STARTUP_SET_CLOSE_TO_TRAY_DELAY_MS = 1600
const STARTUP_ENSURE_ROM_FOLDERS_DELAY_MS = 5200
const STARTUP_VISUAL_TIER_DURATION_MS = 4200
const SCREEN_FRAME_DIAGNOSTICS_WINDOW_MS = 5000
const SCREEN_LONGTASK_LOG_LIMIT = 24

type GamepadPromptHudVisibility = 'visible' | 'idle'

type ControllerVirtualKeyboardAction = 'shift' | 'space' | 'backspace' | 'clear' | 'done' | 'cancel'

type ControllerVirtualKeyboardKey = {
  id: string
  label: string
  value?: string
  action?: ControllerVirtualKeyboardAction
}

type ConnectedGamepadCandidate = {
  pad: Gamepad
  signature: string
  activityScore: number
}

type GamepadLiveCalibration = {
  neutralAxisPeak: number
  sampleCount: number
}

type GamepadInputTuning = {
  axisArmDeadzone: number
  axisCommitThreshold: number
  axisReleaseDeadzone: number
  navigationCommitThreshold: number
  navigationReleaseDeadzone: number
  navigationHoldDelayMs: number
  invertLeftStickY: boolean
  triggerThreshold: number
  repeatInitialDelayMs: number
  repeatMinIntervalMs: number
  repeatMaxIntervalMs: number
}

const DEFAULT_GAMEPAD_AXIS_STATE: GamepadAxisState = {
  horizontal: 0,
  vertical: 0,
  rightHorizontal: 0,
  rightVertical: 0,
}

const DEFAULT_GAMEPAD_LIVE_CALIBRATION: GamepadLiveCalibration = {
  neutralAxisPeak: 0,
  sampleCount: 0,
}

const GAMEPAD_INPUT_TUNING_BY_FAMILY: Record<LauncherGamepadFamily, GamepadInputTuning> = {
  xbox: {
    axisArmDeadzone: 0.14,
    axisCommitThreshold: 0.28,
    axisReleaseDeadzone: 0.13,
    navigationCommitThreshold: 0.33,
    navigationReleaseDeadzone: 0.15,
    navigationHoldDelayMs: 290,
    invertLeftStickY: false,
    triggerThreshold: 0.5,
    repeatInitialDelayMs: 170,
    repeatMinIntervalMs: 82,
    repeatMaxIntervalMs: 250,
  },
  playstation: {
    axisArmDeadzone: 0.13,
    axisCommitThreshold: 0.27,
    axisReleaseDeadzone: 0.12,
    navigationCommitThreshold: 0.32,
    navigationReleaseDeadzone: 0.14,
    navigationHoldDelayMs: 285,
    invertLeftStickY: false,
    triggerThreshold: 0.48,
    repeatInitialDelayMs: 168,
    repeatMinIntervalMs: 80,
    repeatMaxIntervalMs: 245,
  },
  nintendo: {
    axisArmDeadzone: 0.12,
    axisCommitThreshold: 0.26,
    axisReleaseDeadzone: 0.11,
    navigationCommitThreshold: 0.31,
    navigationReleaseDeadzone: 0.14,
    navigationHoldDelayMs: 280,
    invertLeftStickY: false,
    triggerThreshold: 0.42,
    repeatInitialDelayMs: 165,
    repeatMinIntervalMs: 78,
    repeatMaxIntervalMs: 240,
  },
  generic: {
    axisArmDeadzone: 0.16,
    axisCommitThreshold: 0.30,
    axisReleaseDeadzone: 0.14,
    navigationCommitThreshold: 0.34,
    navigationReleaseDeadzone: 0.16,
    navigationHoldDelayMs: 300,
    invertLeftStickY: false,
    triggerThreshold: 0.5,
    repeatInitialDelayMs: 175,
    repeatMinIntervalMs: 85,
    repeatMaxIntervalMs: 255,
  },
}

const REPEATABLE_CONTROLLER_ACTIONS = new Set<LauncherControllerAction>([
  'navigate_up',
  'navigate_down',
  'navigate_left',
  'navigate_right',
])

const DIRECTIONAL_CONTROLLER_ACTIONS = new Set<LauncherControllerAction>([
  'navigate_up',
  'navigate_down',
  'navigate_left',
  'navigate_right',
])

type GamepadPopupState = {
  id: string
  family: LauncherGamepadFamily
  label: string
  isExiting: boolean
}

type GridNavigationSlot = {
  gameId: string
  row: number
  column: number
}

type GridNavigationLayout = {
  slotsByGameId: Record<string, GridNavigationSlot>
  slotsByRow: Map<number, GridNavigationSlot[]>
  maxRow: number
}

type QuickOverlayActionId =
  | 'resume-game'
  | 'force-return'
  | 'retry-session-detect'
  | 'open-launcher'
  | 'open-settings'
  | 'close-overlay'

type QuickOverlayAction = {
  id: QuickOverlayActionId
  label: string
  description: string
}

const CONTROLLER_VIRTUAL_KEYBOARD_ROWS: ControllerVirtualKeyboardKey[][] = [
  [
    { id: 'vk-1', label: '1', value: '1' },
    { id: 'vk-2', label: '2', value: '2' },
    { id: 'vk-3', label: '3', value: '3' },
    { id: 'vk-4', label: '4', value: '4' },
    { id: 'vk-5', label: '5', value: '5' },
    { id: 'vk-6', label: '6', value: '6' },
    { id: 'vk-7', label: '7', value: '7' },
    { id: 'vk-8', label: '8', value: '8' },
    { id: 'vk-9', label: '9', value: '9' },
    { id: 'vk-0', label: '0', value: '0' },
  ],
  [
    { id: 'vk-q', label: 'Q', value: 'q' },
    { id: 'vk-w', label: 'W', value: 'w' },
    { id: 'vk-e', label: 'E', value: 'e' },
    { id: 'vk-r', label: 'R', value: 'r' },
    { id: 'vk-t', label: 'T', value: 't' },
    { id: 'vk-y', label: 'Y', value: 'y' },
    { id: 'vk-u', label: 'U', value: 'u' },
    { id: 'vk-i', label: 'I', value: 'i' },
    { id: 'vk-o', label: 'O', value: 'o' },
    { id: 'vk-p', label: 'P', value: 'p' },
  ],
  [
    { id: 'vk-a', label: 'A', value: 'a' },
    { id: 'vk-s', label: 'S', value: 's' },
    { id: 'vk-d', label: 'D', value: 'd' },
    { id: 'vk-f', label: 'F', value: 'f' },
    { id: 'vk-g', label: 'G', value: 'g' },
    { id: 'vk-h', label: 'H', value: 'h' },
    { id: 'vk-j', label: 'J', value: 'j' },
    { id: 'vk-k', label: 'K', value: 'k' },
    { id: 'vk-l', label: 'L', value: 'l' },
  ],
  [
    { id: 'vk-shift', label: 'Shift', action: 'shift' },
    { id: 'vk-z', label: 'Z', value: 'z' },
    { id: 'vk-x', label: 'X', value: 'x' },
    { id: 'vk-c', label: 'C', value: 'c' },
    { id: 'vk-v', label: 'V', value: 'v' },
    { id: 'vk-b', label: 'B', value: 'b' },
    { id: 'vk-n', label: 'N', value: 'n' },
    { id: 'vk-m', label: 'M', value: 'm' },
    { id: 'vk-backspace', label: 'Back', action: 'backspace' },
  ],
  [
    { id: 'vk-space', label: 'Space', action: 'space' },
    { id: 'vk-clear', label: 'Clear', action: 'clear' },
    { id: 'vk-done', label: 'Done', action: 'done' },
    { id: 'vk-cancel', label: 'Cancel', action: 'cancel' },
  ],
]

const STEAM_COEXISTENCE_MODE_LABELS: Record<SteamControllerCoexistenceMode, string> = {
  balanced: 'Balanced',
  prefer_steam: 'Prefer Steam',
  prefer_tilezu: 'Prefer Tilezu',
}

const BUILT_IN_SYSTEM_CATEGORY_KEYS = new Set<string>([
  'all',
  'steam',
  'epic',
  'battle-net',
  'xbox',
  'minecraft',
  'roblox',
  'riot',
  'ds',
  '3ds',
  'gba',
  'gameboy',
  'nes',
  'snes',
  'n64',
  'gamecube',
  'wii',
  'wiiu',
  'switch',
  'ps1',
  'ps2',
  'ps3',
  'psp',
  'genesis',
  'dreamcast',
  'emulator',
  'links',
])

type SystemEmulatorSummary = {
  tone: 'configured' | 'missing' | 'mixed' | 'needs-core' | 'idle'
  label: string
  status: string
  selectedKey: EmulatorKey | null
}

function normalizeEmulatorKey(value: unknown): EmulatorKey | null {
  switch (value) {
    case '3ds':
    case 'eden':
    case 'retroarch':
    case 'dolphin':
    case 'pcsx2':
    case 'ppsspp':
    case 'cemu':
    case 'rpcs3':
    case 'ds':
      return value
    default:
      return null
  }
}

function emulatorKeyFromProfileArg(args: string[]): EmulatorKey | null {
  for (const rawArg of args) {
    const normalizedArg = rawArg.trim().toLowerCase()
    if (!normalizedArg.startsWith('--tm-profile=')) {
      continue
    }

    const profileValue = normalizedArg.slice('--tm-profile='.length)
    switch (profileValue) {
      case '3ds':
        return '3ds'
      case 'switch':
      case 'eden':
        return 'eden'
      case 'dreamcast':
      case 'retroarch':
        return 'retroarch'
      case 'dolphin':
        return 'dolphin'
      case 'ps2':
      case 'pcsx2':
        return 'pcsx2'
      case 'psp':
      case 'ppsspp':
        return 'ppsspp'
      case 'cemu':
        return 'cemu'
      case 'rpcs3':
        return 'rpcs3'
      case 'ds':
        return 'ds'
      default:
        continue
    }
  }

  return null
}

function inferEmulatorKeyFromTarget(target: string): EmulatorKey | null {
  const normalizedTarget = target.trim().toLowerCase()
  if (!normalizedTarget) {
    return null
  }

  if (normalizedTarget.includes('azahar') || normalizedTarget.includes('citra')) {
    return '3ds'
  }
  if (normalizedTarget.includes('retroarch')) {
    return 'retroarch'
  }
  if (normalizedTarget.includes('eden')) {
    return 'eden'
  }
  if (normalizedTarget.includes('dolphin')) {
    return 'dolphin'
  }
  if (normalizedTarget.includes('pcsx2')) {
    return 'pcsx2'
  }
  if (normalizedTarget.includes('ppsspp')) {
    return 'ppsspp'
  }
  if (normalizedTarget.includes('cemu')) {
    return 'cemu'
  }
  if (normalizedTarget.includes('rpcs3')) {
    return 'rpcs3'
  }
  if (normalizedTarget.includes('melonds') || normalizedTarget.includes('desmume')) {
    return 'ds'
  }

  return null
}

function resolveEmulatorKeyForEntry(entry: GameEntry): EmulatorKey | null {
  return normalizeEmulatorKey(entry.emulatorKey)
    ?? emulatorKeyFromProfileArg(entry.args)
    ?? inferEmulatorKeyFromTarget(entry.target)
}

function hasRetroArchCoreArg(args: string[]): boolean {
  return args.some((arg) => arg.trim().toLowerCase().startsWith('--tm-core='))
}

function managedArgValue(args: string[], key: string): string | null {
  const prefix = `--tm-${key.toLowerCase()}=`
  for (const rawArg of args) {
    const value = rawArg.trim()
    if (!value.toLowerCase().startsWith(prefix)) {
      continue
    }

    const parsed = value.slice(prefix.length).trim()
    if (parsed.length > 0) {
      return parsed
    }
  }

  return null
}

function firstManagedLaunchArg(args: string[]): string {
  for (const rawArg of args) {
    const value = rawArg.trim()
    if (!value || value.startsWith('--tm-')) {
      continue
    }

    return value
  }

  return ''
}

function isPlaceholderTarget(target: string): boolean {
  const trimmed = target.trim()
  return trimmed.startsWith('__') && trimmed.endsWith('__')
}

function romIdentityKey(entry: Pick<GameEntry, 'kind' | 'target' | 'args' | 'title'>): string {
  const normalizedTarget = entry.target.trim().toLowerCase()
  const normalizedProfile = (managedArgValue(entry.args, 'profile') ?? '').trim().toLowerCase()
  const normalizedRomPath = firstManagedLaunchArg(entry.args).trim().toLowerCase()
  const normalizedTitle = normalizeGameTitle(entry.title).trim().toLowerCase()

  return `${entry.kind}|${normalizedTarget}|${normalizedProfile}|${normalizedRomPath || normalizedTitle}`
}

function normalizedRomImportTitle(title: string, args: string[], romTitleCleanupEnabled: boolean): string {
  const normalized = normalizeGameTitle(title)
  if (!romTitleCleanupEnabled) {
    return normalized
  }

  const source = (managedArgValue(args, 'source') ?? '').toLowerCase()
  if (source !== 'rom') {
    return normalized
  }

  return cleanRomTitleMetadata(normalized)
}

function romProfileLabel(profile: string): string {
  switch (profile.trim().toLowerCase()) {
    case 'ds':
      return 'Nintendo DS'
    case '3ds':
      return 'Nintendo 3DS'
    case 'dolphin':
      return 'Wii / GameCube'
    case 'cemu':
      return 'Wii U'
    case 'rpcs3':
      return 'PlayStation 3'
    case 'ps2':
      return 'PlayStation 2'
    case 'psp':
      return 'PlayStation Portable'
    case 'switch':
      return 'Nintendo Switch'
    case 'dreamcast':
      return 'Sega Dreamcast'
    case 'retroarch':
      return 'RetroArch'
    default:
      return profile.trim() || 'Unknown System'
  }
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'textarea' || tagName === 'select') {
    return true
  }

  if (tagName !== 'input') {
    return false
  }

  const input = target as HTMLInputElement
  const nonTextInputTypes = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ])

  return !nonTextInputTypes.has(input.type)
}

function isControllerTextEntryElement(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled && !target.readOnly
  }

  if (!(target instanceof HTMLInputElement)) {
    return false
  }

  if (target.disabled || target.readOnly) {
    return false
  }

  const type = target.type.toLowerCase()
  const supportedInputTypes = new Set([
    'text',
    'search',
    'email',
    'url',
    'tel',
    'password',
  ])

  return supportedInputTypes.has(type) || type === ''
}

function setControlledInputValue(target: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = Object.getPrototypeOf(target) as { value?: { set?: (this: unknown, value: string) => void } }
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  if (descriptor?.set) {
    descriptor.set.call(target, value)
  } else {
    target.value = value
  }

  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.dispatchEvent(new Event('change', { bubbles: true }))
}

function detectGamepadFamily(gamepadId: string): LauncherGamepadFamily {
  const normalized = gamepadId.trim().toLowerCase()
  const hasVendorId = (vendorId: string): boolean => {
    return normalized.includes(`vendor: ${vendorId}`)
      || normalized.includes(`vendor ${vendorId}`)
      || normalized.includes(`vid_${vendorId}`)
      || normalized.includes(`${vendorId}-`)
  }

  if (
    normalized.includes('xbox')
    || normalized.includes('xinput')
    || normalized.includes('x-box')
    || normalized.includes('360 controller')
    || hasVendorId('045e')
  ) {
    return 'xbox'
  }

  if (
    normalized.includes('nintendo')
    || normalized.includes('joy-con')
    || normalized.includes('switch pro')
    || normalized.includes('pro controller')
    || hasVendorId('057e')
  ) {
    return 'nintendo'
  }

  if (
    normalized.includes('playstation')
    || normalized.includes('dualshock')
    || normalized.includes('dualsense')
    || hasVendorId('054c')
    || (normalized.includes('wireless controller') && hasVendorId('054c'))
  ) {
    return 'playstation'
  }

  return 'generic'
}

function gamepadFamilyDisplayName(family: LauncherGamepadFamily): string {
  switch (family) {
    case 'xbox':
      return 'Xbox Controller'
    case 'playstation':
      return 'PlayStation Controller'
    case 'nintendo':
      return 'Nintendo Controller'
    default:
      return 'Game Controller'
  }
}

function readGamepadInputSnapshot(
  gamepad: Gamepad,
  tuning: GamepadInputTuning,
  previousAxisState: GamepadAxisState,
): { snapshot: Record<LauncherControllerInput, boolean>; axisState: GamepadAxisState } {
  const buttons = gamepad.buttons ?? []
  const axes = gamepad.axes ?? []
  const homePressed = Boolean(buttons[16]?.pressed)
  const axis0 = Number.isFinite(axes[0]) ? axes[0] : 0
  const axis1 = applyLeftStickYOrientation(Number.isFinite(axes[1]) ? axes[1] : 0, tuning)
  const axis2 = Number.isFinite(axes[2]) ? axes[2] : 0
  const axis3 = Number.isFinite(axes[3]) ? axes[3] : 0
  const axis6 = Number.isFinite(axes[6]) ? axes[6] : 0
  const axis7 = Number.isFinite(axes[7]) ? axes[7] : 0

  const dpadUpFromButtons = Boolean(buttons[12]?.pressed)
  const dpadDownFromButtons = Boolean(buttons[13]?.pressed)
  const dpadLeftFromButtons = Boolean(buttons[14]?.pressed)
  const dpadRightFromButtons = Boolean(buttons[15]?.pressed)

  const dpadHasButtonSignal = dpadUpFromButtons || dpadDownFromButtons || dpadLeftFromButtons || dpadRightFromButtons
  const dpadUp = dpadHasButtonSignal ? dpadUpFromButtons : axis7 <= -0.5
  const dpadDown = dpadHasButtonSignal ? dpadDownFromButtons : axis7 >= 0.5
  const dpadLeft = dpadHasButtonSignal ? dpadLeftFromButtons : axis6 <= -0.5
  const dpadRight = dpadHasButtonSignal ? dpadRightFromButtons : axis6 >= 0.5

  const nextAxisState: GamepadAxisState = {
    horizontal: resolveAxisDirection(
      axis0,
      previousAxisState.horizontal,
      tuning.navigationCommitThreshold,
      tuning.navigationReleaseDeadzone,
    ),
    vertical: resolveAxisDirection(
      axis1,
      previousAxisState.vertical,
      tuning.navigationCommitThreshold,
      tuning.navigationReleaseDeadzone,
    ),
    rightHorizontal: resolveAxisDirection(axis2, previousAxisState.rightHorizontal, tuning.axisCommitThreshold, tuning.axisReleaseDeadzone),
    rightVertical: resolveAxisDirection(axis3, previousAxisState.rightVertical, tuning.axisCommitThreshold, tuning.axisReleaseDeadzone),
  }

  const cardinalAxisState: GamepadAxisState = {
    horizontal: nextAxisState.horizontal,
    vertical: nextAxisState.vertical,
    rightHorizontal: nextAxisState.rightHorizontal,
    rightVertical: nextAxisState.rightVertical,
  }

  // Grid navigation expects cardinal intent. If stick reports both axes,
  // keep only the dominant axis to prevent accidental diagonal hops.
  if (cardinalAxisState.horizontal !== 0 && cardinalAxisState.vertical !== 0) {
    const horizontalMagnitude = Math.abs(axis0)
    const verticalMagnitude = Math.abs(axis1)
    const tieTolerance = 0.08

    if (horizontalMagnitude > verticalMagnitude + tieTolerance) {
      cardinalAxisState.vertical = 0
    } else if (verticalMagnitude > horizontalMagnitude + tieTolerance) {
      cardinalAxisState.horizontal = 0
    } else if (previousAxisState.horizontal !== 0 && previousAxisState.vertical === 0) {
      cardinalAxisState.vertical = 0
    } else if (previousAxisState.vertical !== 0 && previousAxisState.horizontal === 0) {
      cardinalAxisState.horizontal = 0
    } else if (horizontalMagnitude >= verticalMagnitude) {
      cardinalAxisState.vertical = 0
    } else {
      cardinalAxisState.horizontal = 0
    }
  }

  if (cardinalAxisState.rightHorizontal !== 0 && cardinalAxisState.rightVertical !== 0) {
    const horizontalMagnitude = Math.abs(axis2)
    const verticalMagnitude = Math.abs(axis3)
    const tieTolerance = 0.08

    if (horizontalMagnitude > verticalMagnitude + tieTolerance) {
      cardinalAxisState.rightVertical = 0
    } else if (verticalMagnitude > horizontalMagnitude + tieTolerance) {
      cardinalAxisState.rightHorizontal = 0
    } else if (previousAxisState.rightHorizontal !== 0 && previousAxisState.rightVertical === 0) {
      cardinalAxisState.rightVertical = 0
    } else if (previousAxisState.rightVertical !== 0 && previousAxisState.rightHorizontal === 0) {
      cardinalAxisState.rightHorizontal = 0
    } else if (horizontalMagnitude >= verticalMagnitude) {
      cardinalAxisState.rightVertical = 0
    } else {
      cardinalAxisState.rightHorizontal = 0
    }
  }

  return {
    snapshot: {
      unbound: false,
      dpad_up: dpadUp,
      dpad_down: dpadDown,
      dpad_left: dpadLeft,
      dpad_right: dpadRight,
      left_stick_up: cardinalAxisState.vertical === -1,
      left_stick_down: cardinalAxisState.vertical === 1,
      left_stick_left: cardinalAxisState.horizontal === -1,
      left_stick_right: cardinalAxisState.horizontal === 1,
      right_stick_up: cardinalAxisState.rightVertical === -1,
      right_stick_down: cardinalAxisState.rightVertical === 1,
      right_stick_left: cardinalAxisState.rightHorizontal === -1,
      right_stick_right: cardinalAxisState.rightHorizontal === 1,
      face_south: Boolean(buttons[0]?.pressed),
      face_east: Boolean(buttons[1]?.pressed),
      face_west: Boolean(buttons[2]?.pressed),
      face_north: Boolean(buttons[3]?.pressed),
      left_shoulder: Boolean(buttons[4]?.pressed),
      right_shoulder: Boolean(buttons[5]?.pressed),
      left_trigger: (buttons[6]?.value ?? 0) >= tuning.triggerThreshold || Boolean(buttons[6]?.pressed),
      right_trigger: (buttons[7]?.value ?? 0) >= tuning.triggerThreshold || Boolean(buttons[7]?.pressed),
      left_stick_press: Boolean(buttons[10]?.pressed),
      right_stick_press: Boolean(buttons[11]?.pressed),
      start: Boolean(buttons[9]?.pressed),
      select: Boolean(buttons[8]?.pressed) || homePressed,
    },
    axisState: cardinalAxisState,
  }
}

function scoreConnectedGamepadActivity(pad: Gamepad): number {
  const buttons = pad.buttons ?? []
  const axes = pad.axes ?? []

  const pressedButtons = buttons.reduce((count, button) => count + (button?.pressed ? 1 : 0), 0)
  const buttonValuePeak = buttons.reduce((peak, button) => Math.max(peak, button?.value ?? 0), 0)
  const axisPeak = axes.reduce((peak, axis) => Math.max(peak, Math.abs(Number.isFinite(axis) ? axis : 0)), 0)

  return (pressedButtons * 4) + (buttonValuePeak * 2) + axisPeak
}

const KNOWN_ROM_EXTENSIONS = new Set([
  'nds', 'dsi', 'srl',
  '3ds', '3dsx', 'cia', 'cci', 'cxi', 'app',
  'nsp', 'xci', 'nsz', 'nca',
  'gcm', 'gcz', 'wbfs', 'rvz', 'rvs', 'wia', 'dol', 'iso',
  'wud', 'wux', 'rpx', 'wua',
  'pkg', 'ps3',
  'cso', 'prx', 'pbp',
  'bin', 'cue', 'chd', 'mdf', 'nrg',
  'nes', 'fds', 'sfc', 'smc', 'fig', 'gb', 'gbc', 'dmg', 'gba', 'agb',
  'n64', 'z64', 'v64', 'gen', 'md', 'smd', 'gdi', 'cdi',
])

const DROP_EXECUTABLE_EXTENSIONS = new Set(['exe', 'lnk', 'bat', 'cmd', 'ps1', 'url'])

function romExtensionFromPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed.includes('.')) {
    return ''
  }

  return trimmed.slice(trimmed.lastIndexOf('.') + 1).trim().toLowerCase()
}

function normalizeDroppedPath(path: string): string {
  const trimmed = path.trim().replace(/^"+|"+$/g, '')
  return trimmed.replace(/[\/]+$/g, '')
}

function basenameFromPath(path: string): string {
  const normalized = normalizeDroppedPath(path)
  const parts = normalized.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : normalized
}

function parentDirFromPath(path: string): string {
  const normalized = normalizeDroppedPath(path)
  const slash = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  if (slash < 0) {
    return ''
  }

  return normalized.slice(0, slash)
}

function isDirectoryLikeDroppedPath(path: string): boolean {
  const normalized = normalizeDroppedPath(path)
  if (!normalized) {
    return false
  }

  const name = basenameFromPath(normalized)
  return !name.includes('.')
}

function extractDroppedPaths(dataTransfer: DataTransfer): string[] {
  const collected: string[] = []
  const seen = new Set<string>()

  const push = (candidate: string | undefined | null) => {
    const normalized = normalizeDroppedPath(candidate ?? '')
    if (!normalized) {
      return
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    collected.push(normalized)
  }

  for (const file of Array.from(dataTransfer.files ?? [])) {
    const withPath = file as File & { path?: string }
    push(withPath.path)
  }

  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== 'file') {
      continue
    }

    const file = item.getAsFile() as (File & { path?: string }) | null
    if (file) {
      push(file.path)
    }
  }

  return collected
}

function resolveRomImportConfidence(
  row: Pick<RomImportPreviewRow, 'title' | 'profile' | 'romPath' | 'duplicate' | 'unresolved'>,
): { confidence: RomImportConfidence; reason: string } {
  if (row.unresolved) {
    return {
      confidence: 'low',
      reason: 'Emulator path is not configured for this ROM profile.',
    }
  }

  const profile = row.profile.trim().toLowerCase()
  if (!profile) {
    return {
      confidence: 'low',
      reason: 'ROM profile could not be inferred from extension or metadata.',
    }
  }

  const extension = romExtensionFromPath(row.romPath)
  if (extension && !KNOWN_ROM_EXTENSIONS.has(extension)) {
    return {
      confidence: 'low',
      reason: `File extension .${extension} is uncommon for known ROM formats.`,
    }
  }

  const normalizedTitle = normalizeGameTitle(row.title).trim().toLowerCase()
  if (
    normalizedTitle.length < 3
    || normalizedTitle === 'rom'
    || normalizedTitle === 'game'
    || normalizedTitle.startsWith('disc ')
  ) {
    return {
      confidence: 'low',
      reason: 'Title quality is weak and may produce mismatched art.',
    }
  }

  if (row.duplicate) {
    return {
      confidence: 'medium',
      reason: 'Matches an existing library identity.',
    }
  }

  return {
    confidence: 'high',
    reason: 'Profile and file format are consistent for auto-import.',
  }
}

type CollageStudioLayerKind = 'background' | 'image' | 'draw' | 'shape' | 'text' | 'sticker' | 'logo'

type CollageStudioPoint = {
  x: number
  y: number
}

type CollageStudioStroke = {
  id: string
  points: CollageStudioPoint[]
  color: string
  size: number
}

type CollageStudioTextItem = {
  id: string
  text: string
  x: number
  y: number
  color: string
  size: number
}

type CollageStudioShapeKind = 'rect' | 'circle' | 'triangle' | 'star' | 'hexagon'

const COLLAGE_STUDIO_SHAPE_KINDS: CollageStudioShapeKind[] = ['rect', 'circle', 'triangle', 'star', 'hexagon']
const DEFAULT_COLLAGE_SHAPE_KIND: CollageStudioShapeKind = 'rect'
const DEFAULT_COLLAGE_SHAPE_COLOR = '#2a4f7a'

type CollageStudioLayerDraft = {
  id: string
  name: string
  kind: CollageStudioLayerKind
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: string
  positionX: number
  positionY: number
  width: number
  height: number
  rotation: number
  drawColor?: string
  drawSize?: number
  strokes?: CollageStudioStroke[]
  textColor?: string
  textSize?: number
  textItems?: CollageStudioTextItem[]
  shapeKind?: CollageStudioShapeKind
  shapeColor?: string
  imageDataUrl?: string
  stickerSourceDataUrl?: string
  stickerOutlineDataUrl?: string
}

type CollageStudioDraft = {
  version: 1
  systemKey: string
  updatedAt: number
  backgroundDataUrl: string
  layers: CollageStudioLayerDraft[]
}

type CollageStudioTool = 'select' | 'draw' | 'eraser' | 'image' | 'shape' | 'text' | 'sticker'

type CollageStudioLayerTransformMode = 'move' | 'resize' | 'rotate'

type CollageStudioLayerTransformSession = {
  layerId: string
  mode: CollageStudioLayerTransformMode
  pointerId: number
  startPoint: CollageStudioPoint
  startPositionX: number
  startPositionY: number
  startWidth: number
  startHeight: number
  startRotation: number
}

const COLLAGE_STUDIO_LAYER_KINDS: CollageStudioLayerKind[] = [
  'background',
  'image',
  'draw',
  'shape',
  'text',
  'sticker',
  'logo',
]

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.max(0, Math.min(1, value))
}

function clampCollageStudioScalar(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(min, Math.min(max, value))
}

function clampCollageStudioCoord(value: number): number {
  return clampCollageStudioScalar(value, 0, 1, 0)
}

function clampCollageStudioLayerSize(value: number): number {
  return clampCollageStudioScalar(value, MIN_COLLAGE_LAYER_SIZE, MAX_COLLAGE_LAYER_SIZE, DEFAULT_COLLAGE_LAYER_SIZE)
}

function normalizeCollageStudioRotation(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COLLAGE_LAYER_ROTATION
  }

  const normalized = value % 360
  if (normalized > 180) {
    return normalized - 360
  }

  if (normalized < -180) {
    return normalized + 360
  }

  return normalized
}

function projectCollageStudioCanvasPointToLayerLocal(
  point: CollageStudioPoint,
  layer: Pick<CollageStudioLayerDraft, 'positionX' | 'positionY' | 'width' | 'height' | 'rotation'>,
): CollageStudioPoint {
  const width = clampCollageStudioLayerSize(Number(layer.width))
  const height = clampCollageStudioLayerSize(Number(layer.height))
  const centerX = clampCollageStudioCoord(Number(layer.positionX))
  const centerY = clampCollageStudioCoord(Number(layer.positionY))
  const radians = normalizeCollageStudioRotation(Number(layer.rotation)) * (Math.PI / 180)
  const cosTheta = Math.cos(radians)
  const sinTheta = Math.sin(radians)
  const dx = point.x - centerX
  const dy = point.y - centerY
  const rotatedX = dx * cosTheta + dy * sinTheta
  const rotatedY = -dx * sinTheta + dy * cosTheta

  return {
    x: clampCollageStudioCoord(rotatedX / width + 0.5),
    y: clampCollageStudioCoord(rotatedY / height + 0.5),
  }
}

function normalizeCollageStudioColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  if (!normalized) {
    return fallback
  }

  return normalized
}

function normalizeCollageStudioPoint(value: unknown): CollageStudioPoint | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const x = Number(record.x)
  const y = Number(record.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }

  return {
    x: clampCollageStudioCoord(x),
    y: clampCollageStudioCoord(y),
  }
}

function normalizeCollageStudioStroke(value: unknown, index: number): CollageStudioStroke | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const pointsRaw = Array.isArray(record.points) ? record.points : []
  const points = pointsRaw
    .map((point) => normalizeCollageStudioPoint(point))
    .filter((point): point is CollageStudioPoint => Boolean(point))

  if (points.length === 0) {
    return null
  }

  const id = typeof record.id === 'string' && record.id.trim().length > 0
    ? record.id.trim()
    : `stroke-${index + 1}`

  return {
    id,
    points,
    color: normalizeCollageStudioColor(record.color, DEFAULT_COLLAGE_DRAW_COLOR),
    size: clampCollageStudioScalar(Number(record.size), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE),
  }
}

function normalizeCollageStudioTextItem(value: unknown, index: number): CollageStudioTextItem | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' && record.id.trim().length > 0
    ? record.id.trim()
    : `text-item-${index + 1}`
  const text = typeof record.text === 'string' ? record.text : 'Text'
  const x = Number(record.x)
  const y = Number(record.y)

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }

  return {
    id,
    text,
    x: clampCollageStudioCoord(x),
    y: clampCollageStudioCoord(y),
    color: normalizeCollageStudioColor(record.color, DEFAULT_COLLAGE_TEXT_COLOR),
    size: clampCollageStudioScalar(Number(record.size), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE),
  }
}

function normalizeCollageStudioSystemKey(value: string): string {
  const normalized = value.trim().toLowerCase()
  return normalized || 'custom-system'
}

function createDefaultCollageStudioLayers(): CollageStudioLayerDraft[] {
  return [
    {
      id: 'layer-background',
      name: 'Background',
      kind: 'background',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      positionX: DEFAULT_COLLAGE_LAYER_POSITION,
      positionY: DEFAULT_COLLAGE_LAYER_POSITION,
      width: DEFAULT_COLLAGE_LAYER_SIZE,
      height: DEFAULT_COLLAGE_LAYER_SIZE,
      rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
    },
    {
      id: 'layer-logo',
      name: 'System Logo (Locked)',
      kind: 'logo',
      visible: true,
      locked: true,
      opacity: 1,
      blendMode: 'normal',
      positionX: DEFAULT_COLLAGE_LAYER_POSITION,
      positionY: DEFAULT_COLLAGE_LAYER_POSITION,
      width: DEFAULT_COLLAGE_LAYER_SIZE,
      height: DEFAULT_COLLAGE_LAYER_SIZE,
      rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
    },
  ]
}

function ensureCollageStudioBaseLayers(layers: CollageStudioLayerDraft[]): CollageStudioLayerDraft[] {
  const next = [...layers]

  if (!next.some((layer) => layer.kind === 'background')) {
    next.unshift({
      id: 'layer-background',
      name: 'Background',
      kind: 'background',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      positionX: DEFAULT_COLLAGE_LAYER_POSITION,
      positionY: DEFAULT_COLLAGE_LAYER_POSITION,
      width: DEFAULT_COLLAGE_LAYER_SIZE,
      height: DEFAULT_COLLAGE_LAYER_SIZE,
      rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
    })
  }

  const logoLayerIndex = next.findIndex((layer) => layer.kind === 'logo')
  if (logoLayerIndex === -1) {
    next.push({
      id: 'layer-logo',
      name: 'System Logo (Locked)',
      kind: 'logo',
      visible: true,
      locked: true,
      opacity: 1,
      blendMode: 'normal',
      positionX: DEFAULT_COLLAGE_LAYER_POSITION,
      positionY: DEFAULT_COLLAGE_LAYER_POSITION,
      width: DEFAULT_COLLAGE_LAYER_SIZE,
      height: DEFAULT_COLLAGE_LAYER_SIZE,
      rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
    })
  } else {
    const existing = next[logoLayerIndex]
    next[logoLayerIndex] = {
      ...existing,
      id: existing.id || 'layer-logo',
      name: existing.name || 'System Logo (Locked)',
      kind: 'logo',
      visible: true,
      locked: true,
      opacity: 1,
      blendMode: 'normal',
      positionX: DEFAULT_COLLAGE_LAYER_POSITION,
      positionY: DEFAULT_COLLAGE_LAYER_POSITION,
      width: DEFAULT_COLLAGE_LAYER_SIZE,
      height: DEFAULT_COLLAGE_LAYER_SIZE,
      rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
    }
  }

  return next
}

function createCollageStudioDraft(systemKey: string, backgroundDataUrl = ''): CollageStudioDraft {
  return {
    version: 1,
    systemKey: normalizeCollageStudioSystemKey(systemKey),
    updatedAt: Date.now(),
    backgroundDataUrl: backgroundDataUrl.trim(),
    layers: createDefaultCollageStudioLayers(),
  }
}

function resolveCollageStudioCanvasBlendMode(value: string): GlobalCompositeOperation {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'multiply' || normalized === 'screen' || normalized === 'overlay') {
    return normalized
  }

  return 'source-over'
}

function loadCollageStudioImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load collage background image.'))
    image.src = src
  })
}

async function processCollageStudioStickerStamp(sourceDataUrl: string): Promise<string> {
  return processStickerStamp(sourceDataUrl)
}

async function renderCollageStudioDraftToDataUrl(draft: CollageStudioDraft): Promise<string> {
  if (typeof document === 'undefined') {
    return ''
  }

  const layers = ensureCollageStudioBaseLayers(draft.layers)
  const backgroundLayer = layers.find((layer) => layer.kind === 'background')
  const hasVisibleBackground = backgroundLayer?.visible !== false && Boolean(draft.backgroundDataUrl.trim())
  const hasVisibleDrawContent = layers.some((layer) => layer.kind === 'draw' && layer.visible && (layer.strokes?.length ?? 0) > 0)
  const hasVisibleTextContent = layers.some((layer) => layer.kind === 'text' && layer.visible && (layer.textItems?.length ?? 0) > 0)
  const hasVisibleImageContent = layers.some((layer) => layer.kind === 'image' && layer.visible && Boolean(layer.imageDataUrl?.trim()))
  const hasVisibleShapeContent = layers.some((layer) => layer.kind === 'shape' && layer.visible)
  const hasVisibleStickerContent = layers.some((layer) => layer.kind === 'sticker' && layer.visible && Boolean((layer.stickerOutlineDataUrl ?? layer.stickerSourceDataUrl)?.trim()))

  if (!hasVisibleBackground && !hasVisibleDrawContent && !hasVisibleTextContent && !hasVisibleImageContent && !hasVisibleShapeContent && !hasVisibleStickerContent) {
    return ''
  }

  const canvas = document.createElement('canvas')
  const size = 1024
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    return ''
  }

  if (hasVisibleBackground) {
    try {
      const image = await loadCollageStudioImage(draft.backgroundDataUrl.trim())
      context.drawImage(image, 0, 0, size, size)
    } catch {
      // Keep rendering overlays even when the background image cannot be decoded.
    }
  }

  for (const layer of layers) {
    if (!layer.visible || layer.kind === 'background' || layer.kind === 'logo') {
      continue
    }

    const layerCenterX = clampCollageStudioCoord(Number(layer.positionX)) * size
    const layerCenterY = clampCollageStudioCoord(Number(layer.positionY)) * size
    const layerWidth = clampCollageStudioLayerSize(Number(layer.width)) * size
    const layerHeight = clampCollageStudioLayerSize(Number(layer.height)) * size
    const layerScale = Math.max(layerWidth, layerHeight) / size
    const rotationRadians = normalizeCollageStudioRotation(Number(layer.rotation)) * (Math.PI / 180)

    context.save()
    context.globalAlpha = clampUnitInterval(layer.opacity)
    context.globalCompositeOperation = resolveCollageStudioCanvasBlendMode(layer.blendMode)
    context.translate(layerCenterX, layerCenterY)
    context.rotate(rotationRadians)
    context.translate(-layerWidth / 2, -layerHeight / 2)

    if (layer.kind === 'draw') {
      for (const stroke of layer.strokes ?? []) {
        if (stroke.points.length === 0) {
          continue
        }

        context.strokeStyle = normalizeCollageStudioColor(stroke.color, DEFAULT_COLLAGE_DRAW_COLOR)
        context.fillStyle = normalizeCollageStudioColor(stroke.color, DEFAULT_COLLAGE_DRAW_COLOR)
        context.lineWidth = clampCollageStudioScalar(Number(stroke.size), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE) * layerScale
        context.lineJoin = 'round'
        context.lineCap = 'round'

        if (stroke.points.length === 1) {
          const point = stroke.points[0]
          context.beginPath()
          context.arc(point.x * layerWidth, point.y * layerHeight, Math.max(0.5, context.lineWidth / 2), 0, Math.PI * 2)
          context.fill()
          continue
        }

        context.beginPath()
        stroke.points.forEach((point, index) => {
          const x = point.x * layerWidth
          const y = point.y * layerHeight
          if (index === 0) {
            context.moveTo(x, y)
            return
          }

          context.lineTo(x, y)
        })
        context.stroke()
      }
    }

    if (layer.kind === 'text') {
      for (const item of layer.textItems ?? []) {
        const textSize = clampCollageStudioScalar(Number(item.size), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE) * layerScale
        context.fillStyle = normalizeCollageStudioColor(item.color, DEFAULT_COLLAGE_TEXT_COLOR)
        context.font = `${textSize}px "Segoe UI", "Trebuchet MS", sans-serif`
        context.textAlign = 'left'
        context.textBaseline = 'top'

        const x = clampCollageStudioCoord(item.x) * layerWidth
        const y = clampCollageStudioCoord(item.y) * layerHeight
        const lines = String(item.text ?? '')
          .split(/\r?\n/g)
          .map((line) => line.trimEnd())

        if (lines.length === 0) {
          continue
        }

        lines.forEach((line, lineIndex) => {
          context.fillText(line, x, y + lineIndex * textSize * 1.2)
        })
      }
    }

    if (layer.kind === 'image' && layer.imageDataUrl?.trim()) {
      try {
        const img = await loadCollageStudioImage(layer.imageDataUrl.trim())
        context.drawImage(img, 0, 0, layerWidth, layerHeight)
      } catch {
        // Skip unloadable image layer
      }
    }

    if (layer.kind === 'sticker') {
      const stickerSrc = (layer.stickerOutlineDataUrl ?? layer.stickerSourceDataUrl ?? '').trim()
      if (stickerSrc) {
        try {
          const img = await loadCollageStudioImage(stickerSrc)
          context.drawImage(img, 0, 0, layerWidth, layerHeight)
        } catch {
          // Skip unloadable sticker
        }
      }
    }

    if (layer.kind === 'shape') {
      const shapeKind = COLLAGE_STUDIO_SHAPE_KINDS.includes(layer.shapeKind as CollageStudioShapeKind)
        ? (layer.shapeKind as CollageStudioShapeKind)
        : DEFAULT_COLLAGE_SHAPE_KIND
      const shapeColor = normalizeCollageStudioColor(layer.shapeColor, DEFAULT_COLLAGE_SHAPE_COLOR)
      context.fillStyle = shapeColor
      context.strokeStyle = shapeColor

      const cx = layerWidth / 2
      const cy = layerHeight / 2
      const rx = layerWidth / 2
      const ry = layerHeight / 2

      context.beginPath()
      if (shapeKind === 'circle') {
        context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      } else if (shapeKind === 'triangle') {
        context.moveTo(cx, 0)
        context.lineTo(layerWidth, layerHeight)
        context.lineTo(0, layerHeight)
        context.closePath()
      } else if (shapeKind === 'star') {
        const points = 5
        const outerR = Math.min(rx, ry)
        const innerR = outerR * 0.4
        for (let i = 0; i < points * 2; i++) {
          const angle = (i * Math.PI) / points - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          const sx = cx + Math.cos(angle) * r
          const sy = cy + Math.sin(angle) * r
          if (i === 0) {
            context.moveTo(sx, sy)
          } else {
            context.lineTo(sx, sy)
          }
        }
        context.closePath()
      } else if (shapeKind === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6
          const sx = cx + Math.cos(angle) * Math.min(rx, ry)
          const sy = cy + Math.sin(angle) * Math.min(rx, ry)
          if (i === 0) {
            context.moveTo(sx, sy)
          } else {
            context.lineTo(sx, sy)
          }
        }
        context.closePath()
      } else {
        // rect
        context.rect(0, 0, layerWidth, layerHeight)
      }
      context.fill()
    }

    context.restore()
  }

  return canvas.toDataURL('image/png')
}

function normalizeCollageStudioLayer(value: unknown, index: number): CollageStudioLayerDraft | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const kindCandidate = typeof record.kind === 'string' ? record.kind.trim().toLowerCase() : ''
  const kind = COLLAGE_STUDIO_LAYER_KINDS.includes(kindCandidate as CollageStudioLayerKind)
    ? (kindCandidate as CollageStudioLayerKind)
    : 'image'

  const id = typeof record.id === 'string' && record.id.trim().length > 0
    ? record.id.trim()
    : `layer-${index + 1}`

  const name = typeof record.name === 'string' && record.name.trim().length > 0
    ? record.name.trim()
    : kind === 'logo'
      ? 'System Logo (Locked)'
      : `Layer ${index + 1}`

  const blendMode = typeof record.blendMode === 'string' && record.blendMode.trim().length > 0
    ? record.blendMode.trim()
    : 'normal'

  const baseLayer: CollageStudioLayerDraft = {
    id,
    name,
    kind,
    visible: typeof record.visible === 'boolean' ? record.visible : true,
    locked: kind === 'logo' ? true : typeof record.locked === 'boolean' ? record.locked : false,
    opacity: clampUnitInterval(Number(record.opacity)),
    blendMode,
    positionX: clampCollageStudioScalar(Number(record.positionX), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION),
    positionY: clampCollageStudioScalar(Number(record.positionY), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION),
    width: clampCollageStudioLayerSize(Number(record.width)),
    height: clampCollageStudioLayerSize(Number(record.height)),
    rotation: normalizeCollageStudioRotation(Number(record.rotation)),
  }

  if (kind === 'draw') {
    const strokesRaw = Array.isArray(record.strokes) ? record.strokes : []
    return {
      ...baseLayer,
      drawColor: normalizeCollageStudioColor(record.drawColor, DEFAULT_COLLAGE_DRAW_COLOR),
      drawSize: clampCollageStudioScalar(Number(record.drawSize), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE),
      strokes: strokesRaw
        .map((stroke, strokeIndex) => normalizeCollageStudioStroke(stroke, strokeIndex))
        .filter((stroke): stroke is CollageStudioStroke => Boolean(stroke)),
    }
  }

  if (kind === 'text') {
    const textItemsRaw = Array.isArray(record.textItems) ? record.textItems : []
    return {
      ...baseLayer,
      textColor: normalizeCollageStudioColor(record.textColor, DEFAULT_COLLAGE_TEXT_COLOR),
      textSize: clampCollageStudioScalar(Number(record.textSize), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE),
      textItems: textItemsRaw
        .map((item, itemIndex) => normalizeCollageStudioTextItem(item, itemIndex))
        .filter((item): item is CollageStudioTextItem => Boolean(item)),
    }
  }

  if (kind === 'shape') {
    const shapeKindCandidate = typeof record.shapeKind === 'string' ? record.shapeKind.trim() : ''
    return {
      ...baseLayer,
      shapeKind: COLLAGE_STUDIO_SHAPE_KINDS.includes(shapeKindCandidate as CollageStudioShapeKind)
        ? (shapeKindCandidate as CollageStudioShapeKind)
        : DEFAULT_COLLAGE_SHAPE_KIND,
      shapeColor: normalizeCollageStudioColor(record.shapeColor, DEFAULT_COLLAGE_SHAPE_COLOR),
    }
  }

  if (kind === 'image') {
    return {
      ...baseLayer,
      imageDataUrl: typeof record.imageDataUrl === 'string' ? record.imageDataUrl : '',
    }
  }

  if (kind === 'sticker') {
    return {
      ...baseLayer,
      stickerSourceDataUrl: typeof record.stickerSourceDataUrl === 'string' ? record.stickerSourceDataUrl : '',
      stickerOutlineDataUrl: typeof record.stickerOutlineDataUrl === 'string' ? record.stickerOutlineDataUrl : '',
    }
  }

  return baseLayer
}

function loadCollageStudioDraftsBySystemKey(): Record<string, CollageStudioDraft> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(COLLAGE_STUDIO_DRAFTS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const normalized: Record<string, CollageStudioDraft> = {}
    let removedFactoryKeys = false

    Object.entries(parsed as Record<string, unknown>).forEach(([systemKey, value]) => {
      if (isFactorySystemKey(systemKey)) {
        removedFactoryKeys = true
        return
      }

      if (!value || typeof value !== 'object') {
        return
      }

      const normalizedSystemKey = normalizeCollageStudioSystemKey(systemKey)
      const record = value as Record<string, unknown>
      const backgroundDataUrl = typeof record.backgroundDataUrl === 'string'
        ? record.backgroundDataUrl.trim()
        : ''
      const updatedAtRaw = Number(record.updatedAt)
      const rawLayers = Array.isArray(record.layers) ? record.layers : []
      const layers = ensureCollageStudioBaseLayers(
        rawLayers
          .map((entry, index) => normalizeCollageStudioLayer(entry, index))
          .filter((entry): entry is CollageStudioLayerDraft => Boolean(entry)),
      )

      normalized[normalizedSystemKey] = {
        version: 1,
        systemKey: normalizedSystemKey,
        updatedAt: Number.isFinite(updatedAtRaw) && updatedAtRaw > 0 ? updatedAtRaw : Date.now(),
        backgroundDataUrl,
        layers,
      }
    })

    if (removedFactoryKeys) {
      saveCollageStudioDraftsBySystemKey(normalized)
    }

    return normalized
  } catch {
    return {}
  }
}

function saveCollageStudioDraftsBySystemKey(value: Record<string, CollageStudioDraft>): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(COLLAGE_STUDIO_DRAFTS_STORAGE_KEY, JSON.stringify(value))
  } catch {
  }
}

const CUSTOM_SYSTEM_RULE_PRESETS: Array<{
  key: string
  label: string
  sources: string[]
  pathHints: string[]
  extensions: string[]
}> = [
  {
    key: 'steam',
    label: 'Steam',
    sources: ['steam'],
    pathHints: [],
    extensions: [],
  },
  {
    key: 'epic',
    label: 'Epic',
    sources: ['epic'],
    pathHints: [],
    extensions: [],
  },
  {
    key: 'xbox',
    label: 'Xbox',
    sources: ['xbox_app'],
    pathHints: ['xboxgames'],
    extensions: [],
  },
  {
    key: 'emulators',
    label: 'Emulators',
    sources: ['rom'],
    pathHints: ['roms', 'emulator'],
    extensions: ['zip', '7z', 'iso', 'cue', 'bin'],
  },
  {
    key: 'exe',
    label: 'EXE Files',
    sources: [],
    pathHints: [],
    extensions: ['exe'],
  },
]

const CUSTOM_SYSTEM_TEMPLATES: Array<{
  key: string
  name: string
  description: string
  accentPrimary: string
  accentSecondary: string
  rules: {
    includeSources: string[]
    includePathHints: string[]
    includeExtensions: string[]
  }
}> = [
  {
    key: 'cozy-indies',
    name: 'Cozy Indies',
    description: 'Relaxed and comfort-first games with soft aesthetics.',
    accentPrimary: '#6f8ae9',
    accentSecondary: '#9ce3ff',
    rules: {
      includeSources: ['steam'],
      includePathHints: ['cozy', 'farm', 'story', 'life-sim'],
      includeExtensions: ['exe'],
    },
  },
  {
    key: 'competitive',
    name: 'Competitive',
    description: 'Ranked, PvP, and skill-focused sessions.',
    accentPrimary: '#c74444',
    accentSecondary: '#f8b46f',
    rules: {
      includeSources: ['steam', 'battle_net', 'riot'],
      includePathHints: ['ranked', 'competitive', 'pvp'],
      includeExtensions: ['exe'],
    },
  },
  {
    key: 'retro-collection',
    name: 'Retro Collection',
    description: 'Emulated classics and throwback libraries.',
    accentPrimary: '#845ef2',
    accentSecondary: '#c29aff',
    rules: {
      includeSources: ['rom'],
      includePathHints: ['retro', 'roms'],
      includeExtensions: ['zip', '7z', 'iso', 'cue', 'bin'],
    },
  },
  {
    key: 'family-friendly',
    name: 'Family Friendly',
    description: 'Easy pickup games for all ages.',
    accentPrimary: '#3fbf88',
    accentSecondary: '#a9f39e',
    rules: {
      includeSources: ['steam', 'epic'],
      includePathHints: ['kids', 'family', 'party'],
      includeExtensions: ['exe'],
    },
  },
  {
    key: 'xbox-library',
    name: 'Xbox',
    description: 'Microsoft Store and PC Game Pass titles installed through Xbox.',
    accentPrimary: '#187B3C',
    accentSecondary: '#B8BCC6',
    rules: {
      includeSources: ['xbox_app'],
      includePathHints: ['xboxgames'],
      includeExtensions: [],
    },
  },
  {
    key: 'utilities-and-launchers',
    name: 'Utilities and Launchers',
    description: 'Support tools, mods, launchers, and helpers.',
    accentPrimary: '#4a6a92',
    accentSecondary: '#89a7c8',
    rules: {
      includeSources: ['uri'],
      includePathHints: ['tool', 'launcher', 'mod'],
      includeExtensions: ['exe'],
    },
  },
]

const DEBUG_SYSTEM_IMPORT_PRESETS: Array<{
  key: string
  name: string
  description: string
  logoPath: string
  accentPrimary: string
  accentSecondary: string
}> = [
  {
    key: 'steam',
    name: 'Steam',
    description: 'Desktop Steam library shell for logo, color, and collage customization.',
    logoPath: '/platforms/steam.svg',
    accentPrimary: '#1b4a8f',
    accentSecondary: '#58a6ff',
  },
  {
    key: 'epic',
    name: 'Epic',
    description: 'Epic Games shell for visual customization and manual assignment.',
    logoPath: '/platforms/epic.svg',
    accentPrimary: '#111317',
    accentSecondary: '#6f7685',
  },
  {
    key: 'battle-net',
    name: 'Battle.net',
    description: 'Battle.net shell for debugging tile behavior without launcher bindings.',
    logoPath: '/platforms/battlenet.svg',
    accentPrimary: '#0a2f63',
    accentSecondary: '#2ea2ff',
  },
  {
    key: 'xbox',
    name: 'Xbox',
    description: 'Microsoft Store and PC Game Pass shell for Xbox-native library styling.',
    logoPath: '/platforms/xbox.svg',
    accentPrimary: '#187B3C',
    accentSecondary: '#B8BCC6',
  },
  {
    key: 'minecraft',
    name: 'Minecraft',
    description: 'Minecraft shell with locked logo and editable collage background.',
    logoPath: '/platforms/minecraft.svg',
    accentPrimary: '#2f7d32',
    accentSecondary: '#8bc34a',
  },
  {
    key: 'roblox',
    name: 'Roblox',
    description: 'Roblox shell for quick draft and preview iteration.',
    logoPath: '/platforms/roblox.svg',
    accentPrimary: '#181818',
    accentSecondary: '#ff4545',
  },
  {
    key: 'riot',
    name: 'Riot Games',
    description: 'Riot shell for custom tile tuning while launch integration is missing.',
    logoPath: '/platforms/riot.svg',
    accentPrimary: '#5f1212',
    accentSecondary: '#ff4d4d',
  },
  {
    key: 'emulator',
    name: 'Emulator',
    description: 'Generic emulator shell for ROM-focused custom layouts.',
    logoPath: '/platforms/emulator.svg',
    accentPrimary: '#512872',
    accentSecondary: '#9d7bff',
  },
  {
    key: 'ds',
    name: 'Nintendo DS',
    description: 'Nintendo DS shell for handheld ROM collections.',
    logoPath: '/platforms/DS.svg',
    accentPrimary: '#3b3f8f',
    accentSecondary: '#8fb0ff',
  },
  {
    key: 'n64',
    name: 'Nintendo 64',
    description: 'Nintendo 64 shell for retro grouping and preview polish.',
    logoPath: '/platforms/n64.svg',
    accentPrimary: '#3b5f2f',
    accentSecondary: '#8bcf5f',
  },
  {
    key: 'nes',
    name: 'NES',
    description: 'NES shell for classic library styling and manual grouping.',
    logoPath: '/platforms/nes.svg',
    accentPrimary: '#616161',
    accentSecondary: '#d2d2d2',
  },
  {
    key: 'snes',
    name: 'SNES',
    description: 'SNES shell for retro curation with custom gradients.',
    logoPath: '/platforms/snes.svg',
    accentPrimary: '#6c3ba8',
    accentSecondary: '#b39dff',
  },
  {
    key: 'handheld',
    name: 'Handheld',
    description: 'Handheld shell for portable platform groupings.',
    logoPath: '/platforms/handheld.svg',
    accentPrimary: '#2a6f64',
    accentSecondary: '#8ce3d8',
  },
  {
    key: 'gameboy',
    name: 'Game Boy',
    description: 'Game Boy and Game Boy Color shell for classic handheld collections.',
    logoPath: '/platforms/gameboy.svg',
    accentPrimary: '#2a6b00',
    accentSecondary: '#7bc817',
  },
  {
    key: 'gba',
    name: 'Game Boy Advance',
    description: 'Game Boy Advance shell for GBA library curation.',
    logoPath: '/platforms/gameboyadvance.svg',
    accentPrimary: '#5a2e78',
    accentSecondary: '#9b77c7',
  },
  {
    key: '3ds',
    name: 'Nintendo 3DS',
    description: 'Nintendo 3DS shell for 3DS library curation.',
    logoPath: '/platforms/3DS.svg',
    accentPrimary: '#c0001a',
    accentSecondary: '#ff3333',
  },
  {
    key: 'gamecube',
    name: 'GameCube',
    description: 'GameCube shell for cube-era library curation.',
    logoPath: '/platforms/gamecube.svg',
    accentPrimary: '#6a0dad',
    accentSecondary: '#9b77c7',
  },
  {
    key: 'wii',
    name: 'Wii',
    description: 'Wii shell for motion-era game collections.',
    logoPath: '/platforms/wii.svg',
    accentPrimary: '#5a8fa8',
    accentSecondary: '#d4e6f0',
  },
  {
    key: 'wiiu',
    name: 'Wii U',
    description: 'Wii U shell for Wii U library and testing.',
    logoPath: '/platforms/wiiu.svg',
    accentPrimary: '#007aa0',
    accentSecondary: '#c0e8f8',
  },
  {
    key: 'switch',
    name: 'Nintendo Switch',
    description: 'Nintendo Switch shell for Switch library curation.',
    logoPath: '/platforms/switch.svg',
    accentPrimary: '#cc0000',
    accentSecondary: '#0033ff',
  },
  {
    key: 'genesis',
    name: 'Sega Genesis',
    description: 'Sega Genesis / Mega Drive shell for retro Sega collections.',
    logoPath: '/platforms/genesis.svg',
    accentPrimary: '#8b0000',
    accentSecondary: '#ffd700',
  },
  {
    key: 'dreamcast',
    name: 'Sega Dreamcast',
    description: 'Sega Dreamcast shell for DC library curation.',
    logoPath: '/platforms/dreamcast.svg',
    accentPrimary: '#c87000',
    accentSecondary: '#f5e6c8',
  },
  {
    key: 'ps1',
    name: 'PlayStation',
    description: 'Original PlayStation shell for PS1 game collections.',
    logoPath: '/platforms/ps1.svg',
    accentPrimary: '#004aad',
    accentSecondary: '#00a550',
  },
  {
    key: 'ps2',
    name: 'PlayStation 2',
    description: 'PlayStation 2 shell for the greatest library of all time.',
    logoPath: '/platforms/ps2.svg',
    accentPrimary: '#0a0a2e',
    accentSecondary: '#5010cc',
  },
  {
    key: 'ps3',
    name: 'PlayStation 3',
    description: 'PlayStation 3 shell for PS3 library curation.',
    logoPath: '/platforms/ps3.svg',
    accentPrimary: '#002f6c',
    accentSecondary: '#7ec8e3',
  },
  {
    key: 'psp',
    name: 'PSP',
    description: 'PlayStation Portable shell for PSP game collections.',
    logoPath: '/platforms/psp.svg',
    accentPrimary: '#111111',
    accentSecondary: '#c0c0c0',
  },
  {
    key: 'links',
    name: 'Links',
    description: 'URI and web launcher shell for utility shortcuts.',
    logoPath: '/platforms/uri.svg',
    accentPrimary: '#2c5a6b',
    accentSecondary: '#88b9d9',
  },
]

type CustomSystemDraft = {
  name: string
  iconPath: string
  collageDataUrl: string
  accentPrimary: string
  accentSecondary: string
  description: string
  ingestionMode: CustomSystemIngestionMode
  includeSourcesText: string
  includePathHintsText: string
  includeExtensionsText: string
}

type SimulatedImportSourcePreset = 'steam-library' | 'emulator-rom-folder' | 'retroarch-playlist' | 'start-menu-apps' | 'custom'
type SimulatedImportProfilePreset = 'small-clean' | 'duplicate-heavy' | 'corrupt-metadata' | 'huge-mixed'

type SimulatedImportPreviewRow = {
  id: string
  title: string
  platform: string
  sourceLabel: string
  pathValidity: 'valid' | 'invalid'
  duplicate: boolean
  entry: GameEntry
}

const SIMULATED_IMPORT_SOURCE_PRESETS: Array<{ key: SimulatedImportSourcePreset; label: string }> = [
  { key: 'steam-library', label: 'Steam Library' },
  { key: 'emulator-rom-folder', label: 'Emulator ROM Folder' },
  { key: 'retroarch-playlist', label: 'RetroArch Playlist' },
  { key: 'start-menu-apps', label: 'Windows Start Menu Apps' },
  { key: 'custom', label: 'Custom' },
]

const SIMULATED_IMPORT_PROFILE_PRESETS: Array<{ key: SimulatedImportProfilePreset; label: string }> = [
  { key: 'small-clean', label: 'Small clean library' },
  { key: 'duplicate-heavy', label: 'Messy duplicate-heavy library' },
  { key: 'corrupt-metadata', label: 'Corrupt metadata library' },
  { key: 'huge-mixed', label: 'Huge mixed library' },
]

const SIMULATED_IMPORT_LANG_VARIANTS = ['Aventura', 'Jogo', 'Spiel', 'Jeu', 'Juego', '冒険', 'игра', '게임']
const SIMULATED_IMPORT_BASE_TITLES = [
  'Skyline Drift',
  'Arc Runner',
  'Neon Harbor',
  'Dungeon Relay',
  'Pixel Forge',
  'Turbo Circuit',
  'Crystal Vale',
  'Nova Trial',
  'Retro Pulse',
  'Mythic Engine',
  'Signal Breaker',
  'Garden Colony',
]

function createEmptyCustomSystemDraft(): CustomSystemDraft {
  return {
    name: '',
    iconPath: '',
    collageDataUrl: '',
    accentPrimary: DEFAULT_CUSTOM_SYSTEM_PRIMARY,
    accentSecondary: DEFAULT_CUSTOM_SYSTEM_SECONDARY,
    description: '',
    ingestionMode: 'manual',
    includeSourcesText: '',
    includePathHintsText: '',
    includeExtensionsText: '',
  }
}

function splitMultilineValues(value: string): string[] {
  const normalized = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  return Array.from(new Set(normalized))
}

function joinMultilineValues(values: string[]): string {
  return values.join('\n')
}

function toCustomSystemDraft(system: CustomSystemDefinition): CustomSystemDraft {
  return {
    name: system.name,
    iconPath: system.iconPath,
    collageDataUrl: system.collageDataUrl,
    accentPrimary: system.accentPrimary,
    accentSecondary: system.accentSecondary,
    description: system.description,
    ingestionMode: system.ingestionMode,
    includeSourcesText: joinMultilineValues(system.rules.includeSources),
    includePathHintsText: joinMultilineValues(system.rules.includePathHints),
    includeExtensionsText: joinMultilineValues(system.rules.includeExtensions),
  }
}

function toCustomSystemDraftGradient(draft: CustomSystemDraft): ThemeGradient {
  const primary = normalizeHexColor(draft.accentPrimary, DEFAULT_CUSTOM_SYSTEM_PRIMARY)
  const secondary = normalizeHexColor(draft.accentSecondary, DEFAULT_CUSTOM_SYSTEM_SECONDARY)

  return {
    kind: 'linear',
    direction: '135deg',
    stops: [
      { color: primary, position: 0 },
      { color: secondary, position: 100 },
    ],
  }
}

function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image file.'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('Could not decode image data.'))
        return
      }

      resolve(result)
    }

    reader.readAsDataURL(file)
  })
}

function loadCustomSystemAssignmentsBySystemKey(): Record<string, string[]> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_SYSTEM_ASSIGNMENTS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const normalized: Record<string, string[]> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([systemKey, gameIds]) => {
      if (!systemKey.trim() || !Array.isArray(gameIds)) {
        return
      }

      const uniqueIds = Array.from(new Set(
        gameIds
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => Boolean(entry)),
      ))

      if (uniqueIds.length > 0) {
        normalized[systemKey] = uniqueIds
      }
    })

    return normalized
  } catch {
    return {}
  }
}

function saveCustomSystemAssignmentsBySystemKey(value: Record<string, string[]>): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CUSTOM_SYSTEM_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(value))
  } catch {
  }
}

function loadCustomSystemAutoSortExclusionsBySystemKey(): Record<string, string[]> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_SYSTEM_AUTO_SORT_EXCLUSIONS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const normalized: Record<string, string[]> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([systemKey, gameIds]) => {
      if (!systemKey.trim() || !Array.isArray(gameIds)) {
        return
      }

      const uniqueIds = Array.from(new Set(
        gameIds
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => Boolean(entry)),
      ))

      if (uniqueIds.length > 0) {
        normalized[systemKey] = uniqueIds
      }
    })

    return normalized
  } catch {
    return {}
  }
}

function saveCustomSystemAutoSortExclusionsBySystemKey(value: Record<string, string[]>): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CUSTOM_SYSTEM_AUTO_SORT_EXCLUSIONS_STORAGE_KEY, JSON.stringify(value))
  } catch {
  }
}

type FrameBudgetSnapshot = {
  averageMs: number
  p75Ms: number
  fps: number
  sampleCount: number
}

type CoverDiagnosticsProviderKey = 'steam' | 'epic' | 'battle_net' | 'other'

type CoverDiagnosticsBucket = {
  key: CoverDiagnosticsProviderKey
  label: string
  total: number
  withArt: number
  custom: number
  pending: number
  loading: number
  retrying: number
  success: number
  failedTransient: number
  failedPermanent: number
}

const COVER_DIAGNOSTICS_PROVIDER_ORDER: CoverDiagnosticsProviderKey[] = ['steam', 'epic', 'battle_net', 'other']

const COVER_DIAGNOSTICS_PROVIDER_LABELS: Record<CoverDiagnosticsProviderKey, string> = {
  steam: 'Steam',
  epic: 'Epic',
  battle_net: 'Battle.net',
  other: 'Other',
}

function createCoverDiagnosticsBucket(key: CoverDiagnosticsProviderKey): CoverDiagnosticsBucket {
  return {
    key,
    label: COVER_DIAGNOSTICS_PROVIDER_LABELS[key],
    total: 0,
    withArt: 0,
    custom: 0,
    pending: 0,
    loading: 0,
    retrying: 0,
    success: 0,
    failedTransient: 0,
    failedPermanent: 0,
  }
}

function resolveCoverDiagnosticsProvider(entry: GameEntry): CoverDiagnosticsProviderKey {
  const source = getGameSource(entry)
  if (source === 'steam' || isLikelySteamEntry(entry)) {
    return 'steam'
  }

  if (source === 'epic') {
    return 'epic'
  }

  if (source === 'battle_net') {
    return 'battle_net'
  }

  return 'other'
}

function incrementCoverStatusCounter(bucket: CoverDiagnosticsBucket, status: CoverArtStatus | undefined): void {
  switch (status ?? 'pending') {
    case 'pending':
      bucket.pending += 1
      return
    case 'loading':
      bucket.loading += 1
      return
    case 'retrying':
      bucket.retrying += 1
      return
    case 'success':
      bucket.success += 1
      return
    case 'failed-transient':
      bucket.failedTransient += 1
      return
    case 'failed-permanent':
      bucket.failedPermanent += 1
      return
    default:
      bucket.pending += 1
  }
}


function createRandomGameClickDroplets(): GameClickDroplet[] {
  const dropletCount = 2 + Math.floor(Math.random() * 2)

  return Array.from({ length: dropletCount }, (_, index) => {
    const angle = -0.85 + index * 0.8 + (Math.random() - 0.5) * 0.38
    const distance = 16 + Math.random() * 18
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: 0.78 + Math.random() * 0.44,
      delay: Math.random() * 0.08,
    }
  })
}

type UseLauncherControllerOptions = {
  isSetupMode?: boolean
}

export function useLauncherController(options: UseLauncherControllerOptions = {}) {
  const isSetupMode = options.isSetupMode ?? false
  ;(window as any).__tmSetStatus?.('useLauncherController')

  type BackdropFadePhase = 'idle' | 'prepare' | 'fade'
  const [activeTab, setActiveTab] = useState<AppTab>('launcher')
  const [profileIsExiting, setProfileIsExiting] = useState(false)

  type LocalProfile = {
    displayName: string
    avatarDataUrl: string
    bio: string
    statusLine: string
    favoriteGenres: string[]
    featuredImageUrls: string[]
    profileTheme: 'frost' | 'aurora' | 'midnight'
    collageLayout: 'grid' | 'polaroid' | 'stack'
    raUsername: string
    raApiKey: string
    licenseAccentId: PlayerIdLayoutPrefs['accentId']
    licenseFoilType: PlayerIdLayoutPrefs['foilType']
    licenseStickerImageUrl: string
    avatarFoilType: PlayerIdLayoutPrefs['foilType']
    avatarStickerImageUrl: string
    heroGameId: string
    showcaseGameIds: [string, string, string]
    featuredSystemKey: string
    bannerDataUrl: string
    idStickers: PlayerIdStickerPlacement[]
  }

  const readLocalProfile = (): LocalProfile => {
    return timeBootSync('launcher-controller:read-local-profile', () => {
      try {
        const raw = localStorage.getItem(LOCAL_PROFILE_KEY)
        if (!raw) {
          return {
            displayName: 'Player',
            avatarDataUrl: '',
            bio: '',
            statusLine: '',
            favoriteGenres: [] as string[],
            featuredImageUrls: ['', '', ''] as string[],
            profileTheme: 'frost' as 'frost' | 'aurora' | 'midnight',
            collageLayout: 'grid' as 'grid' | 'polaroid' | 'stack',
            raUsername: '',
            raApiKey: '',
            licenseAccentId: DEFAULT_PLAYER_ID_ACCENT_ID,
            licenseFoilType: DEFAULT_PLAYER_ID_FOIL_TYPE,
            licenseStickerImageUrl: '',
            avatarFoilType: DEFAULT_PLAYER_ID_FOIL_TYPE,
            avatarStickerImageUrl: '',
            heroGameId: '',
            showcaseGameIds: ['', '', ''] as [string, string, string],
            featuredSystemKey: '',
            bannerDataUrl: '',
            idStickers: [] as PlayerIdStickerPlacement[],
          }
        }

        const parsed = JSON.parse(raw) as {
          displayName?: string
          avatarDataUrl?: string
          bio?: string
          statusLine?: string
          favoriteGenres?: string[]
          featuredImageUrls?: string[]
          profileTheme?: 'frost' | 'aurora' | 'midnight'
          collageLayout?: 'grid' | 'polaroid' | 'stack'
          raUsername?: string
          raApiKey?: string
          licenseAccentId?: PlayerIdLayoutPrefs['accentId']
          licenseFoilType?: PlayerIdLayoutPrefs['foilType']
          licenseStickerImageUrl?: string
          avatarFoilType?: PlayerIdLayoutPrefs['foilType']
          avatarStickerImageUrl?: string
          heroGameId?: string
          showcaseGameIds?: string[]
          featuredSystemKey?: string
          bannerDataUrl?: string
          idStickers?: unknown
          stickers?: unknown
        }
        const normalized = parsed.avatarDataUrl?.trim() ?? ''
        const normalizedFeatured = Array.from({ length: 3 }, (_, index) => {
          const value = parsed.featuredImageUrls?.[index]?.trim() ?? ''
          return value.startsWith('data:image/') && value.length <= 4_000_000 ? value : ''
        })
        const normalizedShowcaseGameIds = Array.from({ length: 3 }, (_, index) => {
          const value = parsed.showcaseGameIds?.[index]
          return typeof value === 'string' ? value.trim() : ''
        }) as [string, string, string]
        const legacyStickerUrl =
          typeof parsed.licenseStickerImageUrl === 'string'
          && parsed.licenseStickerImageUrl.startsWith('data:image/')
          && parsed.licenseStickerImageUrl.length <= 4_000_000
            ? parsed.licenseStickerImageUrl
            : typeof parsed.avatarStickerImageUrl === 'string'
            && parsed.avatarStickerImageUrl.startsWith('data:image/')
            && parsed.avatarStickerImageUrl.length <= 4_000_000
              ? parsed.avatarStickerImageUrl
              : ''
        const normalizedFoilType =
          parsed.licenseFoilType === 'none'
          || parsed.licenseFoilType === 'aurora'
          || parsed.licenseFoilType === 'ripple'
          || parsed.licenseFoilType === 'holographic'
            ? parsed.licenseFoilType
            : parsed.avatarFoilType === 'none'
            || parsed.avatarFoilType === 'aurora'
            || parsed.avatarFoilType === 'ripple'
            || parsed.avatarFoilType === 'holographic'
              ? parsed.avatarFoilType
              : DEFAULT_PLAYER_ID_FOIL_TYPE
        const normalizedBanner =
          typeof parsed.bannerDataUrl === 'string'
          && parsed.bannerDataUrl.startsWith('data:image/')
          && parsed.bannerDataUrl.length <= 4_000_000
            ? parsed.bannerDataUrl
            : ''
        const normalizedStickers = normalizePlayerIdStickers(
          parsed.idStickers ?? parsed.stickers,
          legacyStickerUrl,
          normalizedFoilType,
        )
        return {
          displayName: parsed.displayName?.trim() || 'Player',
          avatarDataUrl: normalized.startsWith('data:image/') && normalized.length <= 4_000_000 ? normalized : '',
          bio: parsed.bio?.trim() ?? '',
          statusLine: parsed.statusLine?.trim() ?? '',
          favoriteGenres: Array.isArray(parsed.favoriteGenres)
            ? parsed.favoriteGenres.map((entry) => entry.trim()).filter(Boolean).slice(0, 8)
            : [],
          featuredImageUrls: normalizedFeatured,
          profileTheme: parsed.profileTheme === 'aurora' || parsed.profileTheme === 'midnight' ? parsed.profileTheme : 'frost',
          collageLayout: parsed.collageLayout === 'polaroid' || parsed.collageLayout === 'stack' ? parsed.collageLayout : 'grid',
          raUsername: parsed.raUsername?.trim() ?? '',
          raApiKey: parsed.raApiKey?.trim() ?? '',
          licenseAccentId:
            parsed.licenseAccentId === 'rose'
            || parsed.licenseAccentId === 'mint'
            || parsed.licenseAccentId === 'sunset'
            || parsed.licenseAccentId === 'violet'
            || parsed.licenseAccentId === 'slate'
            || parsed.licenseAccentId === 'gold'
            || parsed.licenseAccentId === 'ember'
              ? parsed.licenseAccentId
              : DEFAULT_PLAYER_ID_ACCENT_ID,
          licenseFoilType:
            parsed.licenseFoilType === 'none'
            || parsed.licenseFoilType === 'aurora'
            || parsed.licenseFoilType === 'ripple'
            || parsed.licenseFoilType === 'holographic'
              ? parsed.licenseFoilType
              : DEFAULT_PLAYER_ID_FOIL_TYPE,
          licenseStickerImageUrl:
            typeof parsed.licenseStickerImageUrl === 'string'
            && parsed.licenseStickerImageUrl.startsWith('data:image/')
            && parsed.licenseStickerImageUrl.length <= 4_000_000
              ? parsed.licenseStickerImageUrl
              : '',
          avatarFoilType:
            parsed.avatarFoilType === 'none'
            || parsed.avatarFoilType === 'aurora'
            || parsed.avatarFoilType === 'ripple'
            || parsed.avatarFoilType === 'holographic'
              ? parsed.avatarFoilType
              : DEFAULT_PLAYER_ID_FOIL_TYPE,
          avatarStickerImageUrl:
            typeof parsed.avatarStickerImageUrl === 'string'
            && parsed.avatarStickerImageUrl.startsWith('data:image/')
            && parsed.avatarStickerImageUrl.length <= 4_000_000
              ? parsed.avatarStickerImageUrl
              : '',
          heroGameId: parsed.heroGameId?.trim() ?? '',
          showcaseGameIds: normalizedShowcaseGameIds,
          featuredSystemKey: parsed.featuredSystemKey?.trim() ?? '',
          bannerDataUrl: normalizedBanner,
          idStickers: normalizedStickers,
        }
      } catch {
        return {
          displayName: 'Player',
          avatarDataUrl: '',
          bio: '',
          statusLine: '',
          favoriteGenres: [] as string[],
          featuredImageUrls: ['', '', ''] as string[],
          profileTheme: 'frost' as 'frost' | 'aurora' | 'midnight',
          collageLayout: 'grid' as 'grid' | 'polaroid' | 'stack',
          raUsername: '',
          raApiKey: '',
          licenseAccentId: DEFAULT_PLAYER_ID_ACCENT_ID,
          licenseFoilType: DEFAULT_PLAYER_ID_FOIL_TYPE,
          licenseStickerImageUrl: '',
          avatarFoilType: DEFAULT_PLAYER_ID_FOIL_TYPE,
          avatarStickerImageUrl: '',
          heroGameId: '',
          showcaseGameIds: ['', '', ''] as [string, string, string],
          featuredSystemKey: '',
          bannerDataUrl: '',
          idStickers: [] as PlayerIdStickerPlacement[],
        }
      }
    })
  }

  const [localProfile, setLocalProfile] = useState<LocalProfile>(readLocalProfile)

  const handleProfileSaved = useCallback((update: Partial<LocalProfile>) => {
    const current = readLocalProfile()
    const next = { ...current, ...update }
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify({ ...next, updatedAt: Date.now() }))
    setLocalProfile(next)
    window.dispatchEvent(new Event('tile-manager-profile-updated'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  type RaStatus = 'idle' | 'loading' | 'connected' | 'error'
  const [raProfile, setRaProfile] = useState<RaUserProfile | null>(null)
  const [raRecentAchievements, setRaRecentAchievements] = useState<RaRecentAchievement[]>([])
  const [raAwards, setRaAwards] = useState<RaAward[]>([])
  const [raStatus, setRaStatus] = useState<RaStatus>('idle')
  const [raError, setRaError] = useState('')

  useEffect(() => {
    markBootStage('launcher-controller:mounted', { isSetupMode })
  }, [isSetupMode])

  const fetchRaData = useCallback(async (username: string, apiKey: string): Promise<boolean> => {
    if (!username || !apiKey) {
      return false
    }

    setRaStatus('loading')
    setRaError('')
    try {
      const [profile, achievements, awards] = await timeBootAsync('launcher-controller:ra-fetch-all', () => Promise.all([
        testRaConnection({ username, apiKey }),
        getRaRecentAchievements({ username, apiKey, count: 10 }),
        getRaUserAwards({ username, apiKey }),
      ]), {
        hasUsername: username.length > 0,
      })
      setRaProfile(profile)
      setRaRecentAchievements(achievements)
      setRaAwards(awards)
      setRaStatus('connected')
      return true
    } catch (err) {
      setRaStatus('error')
      setRaError(typeof err === 'string' ? err : 'Failed to connect to RetroAchievements')
      return false
    }
  }, [])

  useEffect(() => {
    const syncRaFromProfile = () => {
      const { raUsername, raApiKey } = readLocalProfile()
      if (raUsername && raApiKey) {
        void fetchRaData(raUsername, raApiKey)
      }
    }

    syncRaFromProfile()
    window.addEventListener('tile-manager-profile-updated', syncRaFromProfile)
    return () => {
      window.removeEventListener('tile-manager-profile-updated', syncRaFromProfile)
    }
  }, [fetchRaData])

  const handleRaConnect = useCallback(async (username: string, apiKey: string) => {
    const connected = await fetchRaData(username, apiKey)
    if (connected) {
      handleProfileSaved({ raUsername: username, raApiKey: apiKey })
    }
  }, [fetchRaData, handleProfileSaved])

  const handleRaDisconnect = useCallback(() => {
    setRaProfile(null)
    setRaRecentAchievements([])
    setRaAwards([])
    setRaStatus('idle')
    setRaError('')
    handleProfileSaved({ raUsername: '', raApiKey: '' })
  }, [handleProfileSaved])

  const [launcherView, setLauncherView] = useState<LauncherView>('systems')
  const frameBudgetMetricsRef = useRef<FrameBudgetSnapshot>({
    averageMs: 0,
    p75Ms: 0,
    fps: 0,
    sampleCount: 0,
  })
  const [frameBudgetSnapshot, setFrameBudgetSnapshot] = useState<FrameBudgetSnapshot>({
    averageMs: 0,
    p75Ms: 0,
    fps: 0,
    sampleCount: 0,
  })
  const [systemsViewMode, setSystemsViewMode] = useState<SystemsViewMode>('stack')
  const [systemsGridSortMode, setSystemsGridSortMode] = useState<SystemsGridSortMode>('title-asc')
  const [systemsGridSizeMode, setSystemsGridSizeMode] = useState<SystemsGridSizeMode>('compact')
  const [gamesViewMode, setGamesViewMode] = useState<GamesViewMode>('list')
  const [gridSortMode, setGridSortMode] = useState<GridSortMode>('title-asc')
  const [gridGroupMode, setGridGroupMode] = useState<GridGroupMode>('platform')
  const [gridSizeMode, setGridSizeMode] = useState<GridSizeMode>('compact')
  const [isDebugMenuVisible, setIsDebugMenuVisible] = useState(false)
  const [hiddenMediaDebugSummary, setHiddenMediaDebugSummary] = useState('hidden-mode inactive')
  const [hiddenMediaDebugRows, setHiddenMediaDebugRows] = useState<Array<{
    label: string
    rect: string
    style: string
  }>>([])
  const [gameMetaById, setGameMetaById] = useState<Record<string, GameLibraryMeta>>({})
  const [isGamesViewSwitching, setIsGamesViewSwitching] = useState(false)
  const [sceneRouteTransition, setSceneRouteTransition] = useState<SceneRouteTransition>(null)
  const [activeCategory, setActiveCategory] = useState<LauncherCategory>('all')
  const [focusedGameId, setFocusedGameId] = useState<string | null>(null)
  const categoryScrollRef = useRef<HTMLDivElement | null>(null)
  const gameStackListRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<HTMLElement | null>(null)
  const selectedSystemAudioRef = useRef<HTMLAudioElement | null>(null)
  const selectedGameAudioRef = useRef<HTMLAudioElement | null>(null)
  const iconScrollAudioRef = useRef<HTMLAudioElement | null>(null)
  const functionsBarHoverAudioRef = useRef<HTMLAudioElement | null>(null)
  const functionsBarSelectAudioRef = useRef<HTMLAudioElement | null>(null)
  const favoriteSelectAudioRef = useRef<HTMLAudioElement | null>(null)
  const favoriteDeselectAudioRef = useRef<HTMLAudioElement | null>(null)
  const settingsSelectTabAudioRef = useRef<HTMLAudioElement | null>(null)
  const settingsSwitchOptionAudioRef = useRef<HTMLAudioElement | null>(null)
  const settingsHoverAudioRef = useRef<HTMLAudioElement | null>(null)
  const settingsIconVineAudioRef = useRef<HTMLAudioElement | null>(null)
  const settingsSystemCollageAudioRef = useRef<HTMLAudioElement | null>(null)
  const settingsErrorAudioRef = useRef<HTMLAudioElement | null>(null)
  const settingsSliderAudioRef = useRef<HTMLAudioElement | null>(null)
  const activeUiOneShotAudioRef = useRef<Set<HTMLAudioElement>>(new Set())
  const plipAudioContextRef = useRef<AudioContext | null>(null)
  const menuMusicStopRef = useRef<(() => void) | null>(null)
  const rainBedSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const rainBedGainRef = useRef<GainNode | null>(null)
  const rainBedFilterRef = useRef<BiquadFilterNode | null>(null)
  const gameClickEffectTimersRef = useRef<number[]>([])
  const sceneTrailFadeTimerRef = useRef<number | null>(null)
  const scrollGlassResetTimerRef = useRef<number | null>(null)
  const focusedGameIdRef = useRef<string | null>(null)
  const gameStackMomentumRef = useRef(0)
  const gameStackWheelAccumulatorRef = useRef(0)
  const gameStackScrollDirectionRef = useRef<-1 | 1>(1)
  const gameStackLastStepAtRef = useRef(0)
  const gameStackMomentumFrameRef = useRef<number | null>(null)
  const gameStackMomentumSettleTimerRef = useRef<number | null>(null)
  const systemStackMomentumTimerRef = useRef<number | null>(null)
  const lastWheelGameStepSoundAtRef = useRef(0)
  const lastIconScrollUiSoundAtRef = useRef(0)
  const lastSettingsHoverSoundAtRef = useRef(0)
  const launchWipeTimerRef = useRef<number | null>(null)
  const lastScenePointerRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const pendingScenePointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const sceneTrailFrameRef = useRef<number | null>(null)
  const pendingGlassWeightRef = useRef<{ direction: -1 | 1; wheelDelta: number } | null>(null)
  const applyGlassFrameRef = useRef<number | null>(null)
  const gamepadPressedActionsRef = useRef<Partial<Record<LauncherControllerAction, boolean>>>({})
  const gamepadActionRepeatAtRef = useRef<Partial<Record<LauncherControllerAction, number>>>({})
  const gamepadPromptHudIdleTimerRef = useRef<number | null>(null)
  const isGameActionLayerEngagedRef = useRef(false)
  const virtualKeyboardTargetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const virtualKeyboardSuppressFocusTargetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const virtualKeyboardLastFocusedGameIdRef = useRef<string | null>(null)
  const gamepadAxisStateRef = useRef<GamepadAxisState>({ ...DEFAULT_GAMEPAD_AXIS_STATE })
  const gamepadStickNavStateRef = useRef<Partial<Record<LauncherControllerAction, GamepadStickNavState>>>({})
  const gamepadStickActiveRef = useRef<Partial<Record<LauncherControllerAction, boolean>>>({})
  const gamepadNavTapAtRef = useRef<Partial<Record<LauncherControllerAction, number>>>({})
  const gamepadLiveCalibrationBySignatureRef = useRef<Record<string, GamepadLiveCalibration>>({})
  const activeGamepadSignatureRef = useRef<string | null>(null)
  const controllerInputLockActiveRef = useRef(false)
  const gamepadPopupExitTimerRef = useRef<number | null>(null)
  const gamepadPopupClearTimerRef = useRef<number | null>(null)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isGameStackMomentumActive, setIsGameStackMomentumActive] = useState(false)
  const [isSystemStackMomentumActive, setIsSystemStackMomentumActive] = useState(false)
  const [animateSystemIntoGames, setAnimateSystemIntoGames] = useState(false)
  const [animateSystemBackToSystems, setAnimateSystemBackToSystems] = useState(false)
  const [animateSystemBackToSystemsCenter, setAnimateSystemBackToSystemsCenter] = useState(false)
  const [readyBackdropCoverArt, setReadyBackdropCoverArt] = useState<string | undefined>(undefined)
  const [currentBackdropArt, setCurrentBackdropArt] = useState<string | undefined>(undefined)
  const [previousBackdropArt, setPreviousBackdropArt] = useState<string | undefined>(undefined)
  const [backdropFadePhase, setBackdropFadePhase] = useState<BackdropFadePhase>('idle')
  const backdropFadeTimerRef = useRef<number | null>(null)
  const backdropFadeFrameRef = useRef<number | null>(null)
  const backdropCoverLoadTokenRef = useRef(0)
  const backdropTransitionTokenRef = useRef(0)
  const gamesViewSwitchTimerRef = useRef<number | null>(null)
  const systemReturnTimerRef = useRef<number | null>(null)
  const sceneRouteTransitionTimerRef = useRef<number | null>(null)
  const didStartBackgroundIndexRef = useRef(false)
  const hasScheduledEnsureRomFoldersRef = useRef(false)
  const hasScheduledInitialUpdateRefreshRef = useRef(false)

  const [library, setLibrary] = useState<GameEntry[]>(STARTER_GAMES)
  const [search, setSearch] = useState('')
  const [systemsSearch, setSystemsSearch] = useState('')

  const [romDirsText, setRomDirsText] = useState(DEFAULT_ROM_DIRS.join('\n'))
  const [emulatorPaths, setEmulatorPaths] = useState<Record<EmulatorKey, string>>(EMPTY_EMULATOR_PATHS)
  const [systemEmulatorMap, setSystemEmulatorMap] = useState<Record<string, EmulatorKey>>(DEFAULT_SYSTEM_EMULATOR_MAP)
  const [controllerBindsBySystem, setControllerBindsBySystem] = useState<LauncherControllerBindsBySystem>(() => createDefaultControllerBindsBySystem())
  const [launcherControllerBinds, setLauncherControllerBinds] = useState<LauncherControllerSystemBinds>(() => createDefaultControllerSystemBinds())
  const [platformPeripheralsBySystem, setPlatformPeripheralsBySystem] = useState(() => createDefaultPlatformPeripheralsBySystem())
  const [controllerSettingsSystemKey, setControllerSettingsSystemKey] = useState<string>(() => ROM_SYSTEM_FOLDERS[0]?.folder ?? 'Nintendo DS')
  const [controllerSettingsPanel, setControllerSettingsPanel] = useState<'tilezu' | 'platforms'>('tilezu')
  const [launcherInputMode, setLauncherInputMode] = useState<LauncherInputMode>('keyboard-mouse')
  const [gamepadPromptHudVisibility, setGamepadPromptHudVisibility] = useState<GamepadPromptHudVisibility>('visible')
  const [isControllerVirtualKeyboardOpen, setIsControllerVirtualKeyboardOpen] = useState(false)
  const [controllerVirtualKeyboardValue, setControllerVirtualKeyboardValue] = useState('')
  const [controllerVirtualKeyboardCursorRow, setControllerVirtualKeyboardCursorRow] = useState(0)
  const [controllerVirtualKeyboardCursorColumn, setControllerVirtualKeyboardCursorColumn] = useState(0)
  const [controllerVirtualKeyboardShiftActive, setControllerVirtualKeyboardShiftActive] = useState(false)
  const [controllerVirtualKeyboardFieldLabel, setControllerVirtualKeyboardFieldLabel] = useState('Text Input')
  const [connectedGamepadFamily, setConnectedGamepadFamily] = useState<LauncherGamepadFamily | null>(null)
  const [connectedGamepadLabel, setConnectedGamepadLabel] = useState('')
  const [isStartupVisualTierActive, setIsStartupVisualTierActive] = useState(true)
  const [gamepadPopup, setGamepadPopup] = useState<GamepadPopupState | null>(null)
  const [isQuickOverlayOpen, setIsQuickOverlayOpen] = useState(false)
  const [quickOverlaySelectionIndex, setQuickOverlaySelectionIndex] = useState(0)
  const [romTitleCleanupEnabled, setRomTitleCleanupEnabled] = useState(true)
  const [titleOverridesByManagedKey, setTitleOverridesByManagedKey] = useState<Record<string, string>>({})
  const [steamApiKey, setSteamApiKey] = useState('')
  const [steamId, setSteamId] = useState('')
  const [customSystems, setCustomSystems] = useState<CustomSystemDefinition[]>(() => {
    return timeBootSync('launcher-controller:load-custom-systems', () => filterUserCustomSystems(loadCustomSystems())
      .filter((system) => {
      const name = system.name.trim().toLowerCase()
      const key = system.key.trim().toLowerCase()
      const icon = system.iconPath.trim().toLowerCase()
      const description = system.description.trim().toLowerCase()

      const isLegacyDebugEmulator =
        (name === 'emulator' || key === 'emulator')
        && icon === '/platforms/emulator.svg'
        && description.includes('debug')

      const isDreamcastAlias = key === 'dreamcast' || name === 'sega dreamcast'

      return !isLegacyDebugEmulator && !isDreamcastAlias
    }))
  })
  const [customSystemAssignmentsBySystemKey, setCustomSystemAssignmentsBySystemKey] = useState<Record<string, string[]>>(
    () => timeBootSync('launcher-controller:load-custom-system-assignments', () => loadCustomSystemAssignmentsBySystemKey()),
  )
  const [customSystemAutoSortExclusionsBySystemKey, setCustomSystemAutoSortExclusionsBySystemKey] = useState<Record<string, string[]>>(
    () => timeBootSync('launcher-controller:load-custom-system-auto-sort-exclusions', () => loadCustomSystemAutoSortExclusionsBySystemKey()),
  )
  const [customSystemDraft, setCustomSystemDraft] = useState<CustomSystemDraft>(() => createEmptyCustomSystemDraft())
  const [editingCustomSystemId, setEditingCustomSystemId] = useState<string | null>(null)
  const [isCustomSystemCreateMode, setIsCustomSystemCreateMode] = useState(false)
  const [customSystemNameFocusKey, setCustomSystemNameFocusKey] = useState(0)
  const [isAddGamesModalOpen, setIsAddGamesModalOpen] = useState(false)
  const [manageSystemsSearch, setManageSystemsSearch] = useState('')
  const [addGamesTab, setAddGamesTab] = useState<AddGamesTab>('apps-games')
  const [addGamesTargetSystemKey, setAddGamesTargetSystemKey] = useState('')
  const [addGamesSearch, setAddGamesSearch] = useState('')
  const [addGamesFilter, setAddGamesFilter] = useState<AddGamesFilter>('not-in-any-system')
  const [addGamesSelectedIds, setAddGamesSelectedIds] = useState<string[]>([])
  const [addGamesAssignmentFlash, setAddGamesAssignmentFlash] = useState<Record<string, 'add' | 'remove'>>({})
  const [romImportPreviewRows, setRomImportPreviewRows] = useState<RomImportPreviewRow[]>([])
  const [romImportSearch, setRomImportSearch] = useState('')
  const [romImportFilter, setRomImportFilter] = useState<RomImportPreviewFilter>('all')
  const [romImportSelectedIds, setRomImportSelectedIds] = useState<string[]>([])
  const [romImportFocusedId, setRomImportFocusedId] = useState('')
  const [romImportSummary, setRomImportSummary] = useState('Run scan to preview ROM imports.')
  const [allowLowConfidenceImports, setAllowLowConfidenceImports] = useState(false)
  const [isRomImportScanning, setIsRomImportScanning] = useState(false)
  const [isAddGamesDropActive, setIsAddGamesDropActive] = useState(false)
  const [isRomDropActive, setIsRomDropActive] = useState(false)
  const [isAddGamesFileDragActive, setIsAddGamesFileDragActive] = useState(false)
  const [manageSystemsFilter, setManageSystemsFilter] = useState<'all' | 'hidden' | 'auto-sort'>('all')
  const [debugSystemImportKey, setDebugSystemImportKey] = useState('')
  const [simulatedImportEnabled, setSimulatedImportEnabled] = useState(false)
  const [simulatedImportSourcePreset, setSimulatedImportSourcePreset] = useState<SimulatedImportSourcePreset>('steam-library')
  const [simulatedImportProfilePreset, setSimulatedImportProfilePreset] = useState<SimulatedImportProfilePreset>('small-clean')
  const [simulatedImportQuantity, setSimulatedImportQuantity] = useState(24)
  const [simulatedImportIncludeDuplicateIds, setSimulatedImportIncludeDuplicateIds] = useState(false)
  const [simulatedImportMissingBoxArt, setSimulatedImportMissingBoxArt] = useState(false)
  const [simulatedImportInvalidPaths, setSimulatedImportInvalidPaths] = useState(false)
  const [simulatedImportWeirdFileNames, setSimulatedImportWeirdFileNames] = useState(false)
  const [simulatedImportNonEnglishTitles, setSimulatedImportNonEnglishTitles] = useState(false)
  const [simulatedImportVeryLongTitles, setSimulatedImportVeryLongTitles] = useState(false)
  const [simulatedImportPreviewRows, setSimulatedImportPreviewRows] = useState<SimulatedImportPreviewRow[]>([])
  const [simulatedImportSummary, setSimulatedImportSummary] = useState('')

  const clearGamepadPopupTimers = useCallback(() => {
    if (gamepadPopupExitTimerRef.current !== null) {
      window.clearTimeout(gamepadPopupExitTimerRef.current)
      gamepadPopupExitTimerRef.current = null
    }

    if (gamepadPopupClearTimerRef.current !== null) {
      window.clearTimeout(gamepadPopupClearTimerRef.current)
      gamepadPopupClearTimerRef.current = null
    }
  }, [])

  const openGamepadPopup = useCallback((family: LauncherGamepadFamily, label: string) => {
    clearGamepadPopupTimers()
    const popupId = crypto.randomUUID()
    setGamepadPopup({
      id: popupId,
      family,
      label,
      isExiting: false,
    })

    gamepadPopupExitTimerRef.current = window.setTimeout(() => {
      setGamepadPopup((previous) => {
        if (!previous || previous.id !== popupId) {
          return previous
        }

        return {
          ...previous,
          isExiting: true,
        }
      })
    }, GAMEPAD_POPUP_FADE_IN_MS + GAMEPAD_POPUP_VISIBLE_MS)

    gamepadPopupClearTimerRef.current = window.setTimeout(() => {
      setGamepadPopup((previous) => {
        if (!previous || previous.id !== popupId) {
          return previous
        }

        return null
      })
    }, GAMEPAD_POPUP_FADE_IN_MS + GAMEPAD_POPUP_VISIBLE_MS + GAMEPAD_POPUP_FADE_OUT_MS)
  }, [clearGamepadPopupTimers])
  const [collageStudioDraftsBySystemKey, setCollageStudioDraftsBySystemKey] = useState<Record<string, CollageStudioDraft>>(
    () => timeBootSync('launcher-controller:load-collage-drafts', () => loadCollageStudioDraftsBySystemKey()),
  )
  const [isCollageStudioOpen, setIsCollageStudioOpen] = useState(false)
  const [activeCollageStudioDraft, setActiveCollageStudioDraft] = useState<CollageStudioDraft | null>(null)
  const [collageStudioSidebarTab, setCollageStudioSidebarTab] = useState<'layers' | 'properties'>('layers')
  const [collageStudioActiveTool, setCollageStudioActiveTool] = useState<CollageStudioTool>('select')
  const [collageStudioSelectedLayerId, setCollageStudioSelectedLayerId] = useState('')
  const [collageStudioLivePreviewDataUrl, setCollageStudioLivePreviewDataUrl] = useState('')
  const [collageStudioEditingTextTarget, setCollageStudioEditingTextTarget] = useState<{
    layerId: string
    itemId: string
  } | null>(null)
  const collageStudioImageInputRef = useRef<HTMLInputElement | null>(null)
  const collageStudioReplaceImageInputRef = useRef<HTMLInputElement | null>(null)
  const addGamesDropDepthRef = useRef(0)
  const romDropDepthRef = useRef(0)
  const collageStudioStickerInputRef = useRef<HTMLInputElement | null>(null)
  const collageStudioCanvasShellRef = useRef<HTMLDivElement | null>(null)
  const collageStudioCanvasPointerIdRef = useRef<number | null>(null)
  const collageStudioActiveStrokeRef = useRef<{ layerId: string, strokeId: string } | null>(null)
  const collageStudioActiveEraserLayerIdRef = useRef<string | null>(null)
  const collageStudioActiveTransformRef = useRef<CollageStudioLayerTransformSession | null>(null)
  const collageStudioLivePreviewTokenRef = useRef(0)
  const [manageSystemsEditorTab, setManageSystemsEditorTab] = useState<'basics' | 'rules'>('basics')
  const [customSystemSaveAckKey, setCustomSystemSaveAckKey] = useState(0)
  const [customSystemUploadFlash, setCustomSystemUploadFlash] = useState<'icon' | 'collage' | null>(null)
  const [isCustomSystemRuleEditorExpanded, setIsCustomSystemRuleEditorExpanded] = useState(false)
  const hasAppliedCozySuggestionRef = useRef(false)
  const [audioTextureEnabled, setAudioTextureEnabled] = useState(true)
  const [lowPowerModeEnabled, setLowPowerModeEnabled] = useState(true)
  const [appLowPowerActive, setAppLowPowerActive] = useState(false)
  const [steamControllerCoexistenceMode, setSteamControllerCoexistenceMode] = useState<SteamControllerCoexistenceMode>('balanced')
  const [graphicsFidelityMode, setGraphicsFidelityMode] = useState<GraphicsFidelityMode>('normal')
  const [audioTextureLevel, setAudioTextureLevel] = useState(0.28)
  const [uiSoundVolume, setUiSoundVolume] = useState(1)
  const [menuMusicEnabled, setMenuMusicEnabled] = useState(true)
  const [menuMusicVolume, setMenuMusicVolume] = useState(0.25)
  const [preferExternalMedia, setPreferExternalMedia] = useState(true)
  const [settingsActiveSection, setSettingsActiveSection] = useState<SettingsSectionId>(DEFAULT_SETTINGS_SECTION)
  const [isAutoFidelityDowngradeActive, setAutoFidelityDowngrade] = useState<AutoFidelityDowngrade>(null)
  const [isFrameBudgetHintLow, setIsFrameBudgetHintLow] = useState(false)
  const [isSteamLoginBusy, setIsSteamLoginBusy] = useState(false)
  const [isSteamTestBusy, setIsSteamTestBusy] = useState(false)
  const frameBudgetPoorSinceRef = useRef<number | null>(null)
  const frameBudgetRecoverSinceRef = useRef<number | null>(null)
  const frameBudgetHintPoorSinceRef = useRef<number | null>(null)

  const [isImporting, setIsImporting] = useState(false)
  const [loadingAchievements, setLoadingAchievements] = useState<Record<string, boolean>>({})
  const [achievementByGame, setAchievementByGame] = useState<Record<string, SteamAchievementsResponse>>({})
  const [playtimeMinutesByGame, setPlaytimeMinutesByGame] = useState<Record<string, number>>({})
  const [playtimeLookupDone, setPlaytimeLookupDone] = useState<Record<string, boolean>>({})
  const [coverArtByGame, setCoverArtByGame] = useState<Record<string, string>>({})
  const [coverArtThumbByGame, setCoverArtThumbByGame] = useState<Record<string, string>>({})
  const [coverArtStatusByGame, setCoverArtStatusByGame] = useState<Record<string, CoverArtStatus>>({})
  const [gameUpdateStatusById, setGameUpdateStatusById] = useState<Record<string, GameUpdateStatus>>({})
  const [coverArtMetaByGame, setCoverArtMetaByGame] = useState<Record<string, CoverArtMetadata>>({})
  const [coverSourceByGame, setCoverSourceByGame] = useState<Record<string, CoverSourceProvenance>>({})
  const [gridRuntimeDiagnostics, setGridRuntimeDiagnostics] = useState<LauncherGridDiagnostics | null>(null)
  const [gridLayoutMetrics, setGridLayoutMetrics] = useState<LauncherGridLayoutMetrics | null>(null)
  const [customCoverByGame, setCustomCoverByGame] = useState<Record<string, string>>({})
  const [isCoverCacheResetBusy, setIsCoverCacheResetBusy] = useState(false)
  const [achievementModalGameId, setAchievementModalGameId] = useState<string | null>(null)
  const [isPlaytimeModalOpen, setIsPlaytimeModalOpen] = useState(false)
  const [playtimeModalView, setPlaytimeModalView] = useState<'hub' | 'game-detail'>('hub')
  const [playtimeSelectedGameId, setPlaytimeSelectedGameId] = useState('')
  const [playtimeFocusGameId, setPlaytimeFocusGameId] = useState('')
  const [isSystemEmulatorPopoverOpen, setIsSystemEmulatorPopoverOpen] = useState(false)
  const [achievementSearch, setAchievementSearch] = useState('')
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('all')
  type GameClickEffect = {
    id: string
    gameId: string
    x: number
    y: number
    droplets: GameClickDroplet[]
  }

  const [gameClickEffects, setGameClickEffects] = useState<GameClickEffect[]>([])

  // General UI status and launch wipe state
  const [status, setStatus] = useState('')
  const gameUpdateRefreshTokenRef = useRef(0)
  const [gameUpdateRefreshNonce, setGameUpdateRefreshNonce] = useState(0)
  const [gameUpdateFeedbackById, setGameUpdateFeedbackById] = useState<Record<string, string>>({})
  const gameUpdateFeedbackTimersRef = useRef<Map<string, number>>(new Map())
  const gameUpdateFollowupTimersRef = useRef<number[]>([])
  const [updateBubblePopById, setUpdateBubblePopById] = useState<Record<string, boolean>>({})
  const updateBubblePopTimersRef = useRef<Map<string, number>>(new Map())
  const previousUpdateStatusByIdRef = useRef<Record<string, GameUpdateStatus>>({})
  const lastUserInteractionAtRef = useRef(0)
  const [isLaunchWipeActive, setIsLaunchWipeActive] = useState(false)
  const [systemGradientMap, setSystemGradientMap] = useState<Record<string, ThemeGradient>>(
    () => timeBootSync('launcher-controller:load-system-gradient-map', () => loadSystemGradientMap()),
  )
  const [systemGradientAnimationMap, setSystemGradientAnimationMap] = useState<Record<string, SystemGradientAnimationSettings>>(
    () => timeBootSync('launcher-controller:load-system-gradient-animation-map', () => loadSystemGradientAnimationMap()),
  )
  const [systemLogoBorderMap, setSystemLogoBorderMap] = useState<SystemLogoBorderMap>(
    () => timeBootSync('launcher-controller:load-system-logo-border-map', () => loadSystemLogoBorderMap()),
  )
  const [systemGradientApplyModeMap, setSystemGradientApplyModeMap] = useState<SystemGradientApplyModeMap>(
    () => timeBootSync('launcher-controller:load-system-gradient-apply-mode-map', () => loadSystemGradientApplyModeMap()),
  )
  const [isSystemGradientDialogOpen, setIsSystemGradientDialogOpen] = useState(false)
  const systemGradientOverrideStyleRef = useRef<HTMLStyleElement | null>(null)
  const isDeferredStartupReady = useDeferredStartup(STARTUP_DEFERRED_WORK_DELAY_MS)
  const appearanceTheme = useAppearanceTheme()
  const { signatureRungoId, rungoTokenBalance, getTotalClaimableTokenCount } = useKeychainAttachments()

  const signatureRungo = useMemo(() => {
    if (!signatureRungoId) {
      return null
    }

    return getKeychainById(signatureRungoId) ?? null
  }, [signatureRungoId])

  const effectiveGraphicsFidelity = useMemo(
    () => resolveEffectiveFidelity(graphicsFidelityMode, isAutoFidelityDowngradeActive),
    [graphicsFidelityMode, isAutoFidelityDowngradeActive],
  )

  const launcherFidelityFlags = useMemo(
    () => deriveLauncherFlags({
      effectiveFidelity: effectiveGraphicsFidelity,
      isLauncherActive: activeTab === 'launcher',
      launcherView,
      gamesViewMode,
      isStartupVisualTierActive,
    }),
    [activeTab, effectiveGraphicsFidelity, gamesViewMode, isStartupVisualTierActive, launcherView],
  )

  const isSystemsPerformanceLite =
    launcherFidelityFlags.isPerformanceLite
    && launcherView === 'systems'
  const isGamesPerformanceLite =
    launcherFidelityFlags.isPerformanceLite
    && launcherView === 'games'
  const isGridLargeViewportPerformanceLite = launcherFidelityFlags.isGridLargeViewportLite
  const shouldDisableInteractionEffects =
    effectiveGraphicsFidelity === 'normal'
    && isGridLargeViewportPerformanceLite
    && launcherInputMode === 'gamepad'

  const handleGraphicsFidelityModeChange = useCallback((mode: GraphicsFidelityMode) => {
    setGraphicsFidelityMode(mode)
    setAutoFidelityDowngrade(null)
    frameBudgetPoorSinceRef.current = null
    frameBudgetRecoverSinceRef.current = null
    frameBudgetHintPoorSinceRef.current = null
    setIsFrameBudgetHintLow(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const shouldTrackFrameBudget = activeTab === 'launcher'
    if (!shouldTrackFrameBudget) {
      frameBudgetMetricsRef.current = {
        averageMs: 0,
        p75Ms: 0,
        fps: 0,
        sampleCount: 0,
      }
      return
    }

    let rafId: number | null = null
    let previousFrameAt: number | null = null
    const frameSamples: number[] = []

    const onFrame = (timestamp: number) => {
      if (previousFrameAt !== null) {
        const delta = timestamp - previousFrameAt
        if (Number.isFinite(delta) && delta > 0 && delta < 250 && document.visibilityState === 'visible') {
          frameSamples.push(delta)
          if (frameSamples.length > FRAME_BUDGET_SAMPLE_WINDOW) {
            frameSamples.shift()
          }

          if (frameSamples.length >= FRAME_BUDGET_MIN_SAMPLES) {
            const average = frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length
            const sorted = [...frameSamples].sort((left, right) => left - right)
            const p75 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
            frameBudgetMetricsRef.current = {
              averageMs: average,
              p75Ms: p75,
              fps: average > 0 ? 1000 / average : 0,
              sampleCount: frameSamples.length,
            }
          }
        }
      }

      previousFrameAt = timestamp
      rafId = window.requestAnimationFrame(onFrame)
    }

    rafId = window.requestAnimationFrame(onFrame)

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [activeTab])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const syncFrameBudgetSnapshot = () => {
      setFrameBudgetSnapshot((previous) => {
        const next = frameBudgetMetricsRef.current
        if (
          previous.averageMs === next.averageMs
          && previous.p75Ms === next.p75Ms
          && previous.fps === next.fps
          && previous.sampleCount === next.sampleCount
        ) {
          return previous
        }

        return next
      })
    }

    syncFrameBudgetSnapshot()
    const interval = window.setInterval(syncFrameBudgetSnapshot, isDebugMenuVisible ? 220 : 420)

    return () => {
      window.clearInterval(interval)
    }
  }, [isDebugMenuVisible])

  useEffect(() => {
    if (frameBudgetSnapshot.sampleCount < FRAME_BUDGET_MIN_SAMPLES) {
      return
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const isPoorFrameBudget =
      frameBudgetSnapshot.averageMs >= FRAME_BUDGET_POOR_AVG_MS
      || frameBudgetSnapshot.p75Ms >= FRAME_BUDGET_POOR_P75_MS
    const isRecoverFrameBudget =
      frameBudgetSnapshot.averageMs <= FRAME_BUDGET_RECOVER_AVG_MS
      && frameBudgetSnapshot.p75Ms <= FRAME_BUDGET_RECOVER_P75_MS

    if (isPoorFrameBudget) {
      frameBudgetRecoverSinceRef.current = null

      if (frameBudgetHintPoorSinceRef.current === null) {
        frameBudgetHintPoorSinceRef.current = now
      }

      if (!isFrameBudgetHintLow && now - frameBudgetHintPoorSinceRef.current >= FRAME_BUDGET_HINT_POOR_MS) {
        setIsFrameBudgetHintLow(true)
      }

      if (graphicsFidelityMode === 'normal') {
        if (frameBudgetPoorSinceRef.current === null) {
          frameBudgetPoorSinceRef.current = now
        }

        const poorDurationMs = now - frameBudgetPoorSinceRef.current
        if (!isAutoFidelityDowngradeActive && poorDurationMs >= AUTO_DOWNGRADE_TO_LITE_MS) {
          setAutoFidelityDowngrade('lite')
        } else if (isAutoFidelityDowngradeActive === 'lite' && poorDurationMs >= AUTO_DOWNGRADE_TO_ULTRA_LITE_MS) {
          setAutoFidelityDowngrade('ultra-lite')
        }
      }

      return
    }

    frameBudgetPoorSinceRef.current = null
    frameBudgetHintPoorSinceRef.current = null
    setIsFrameBudgetHintLow(false)

    if (graphicsFidelityMode !== 'normal' || !isAutoFidelityDowngradeActive) {
      frameBudgetRecoverSinceRef.current = null
      return
    }

    if (!isRecoverFrameBudget) {
      frameBudgetRecoverSinceRef.current = null
      return
    }

    if (frameBudgetRecoverSinceRef.current === null) {
      frameBudgetRecoverSinceRef.current = now
      return
    }

    if (now - frameBudgetRecoverSinceRef.current >= AUTO_RECOVER_TO_NORMAL_MS) {
      frameBudgetRecoverSinceRef.current = null
      setAutoFidelityDowngrade(null)
    }
  }, [
    frameBudgetSnapshot.averageMs,
    frameBudgetSnapshot.p75Ms,
    frameBudgetSnapshot.sampleCount,
    graphicsFidelityMode,
    isAutoFidelityDowngradeActive,
    isFrameBudgetHintLow,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    try {
      window.localStorage.setItem(DEBUG_MENU_VISIBLE_STORAGE_KEY, isDebugMenuVisible ? '1' : '0')
    } catch {
      // ignore
    }

    window.dispatchEvent(new CustomEvent(DEBUG_MENU_VISIBILITY_EVENT, {
      detail: {
        visible: isDebugMenuVisible,
      },
    }))
  }, [isDebugMenuVisible])

  const systemGradientOverrideCss = useMemo(
    () => buildSystemGradientOverrideCss(systemGradientMap, systemGradientAnimationMap, systemGradientApplyModeMap) + '\n' + buildLogoBorderOverrideCss(systemLogoBorderMap),
    [systemGradientAnimationMap, systemGradientApplyModeMap, systemGradientMap, systemLogoBorderMap],
  )

  useEffect(() => {
    const styleId = 'tm-system-gradient-overrides'
    const existingStyle = document.getElementById(styleId)
    if (existingStyle instanceof HTMLStyleElement) {
      systemGradientOverrideStyleRef.current = existingStyle
    } else {
      const styleElement = document.createElement('style')
      styleElement.id = styleId
      document.head.appendChild(styleElement)
      systemGradientOverrideStyleRef.current = styleElement
    }

    return () => {
      const styleElement = systemGradientOverrideStyleRef.current
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement)
      }
      systemGradientOverrideStyleRef.current = null
    }
  }, [])

  useEffect(() => {
    const styleElement = systemGradientOverrideStyleRef.current
    if (!styleElement) {
      return
    }

    styleElement.textContent = systemGradientOverrideCss
  }, [systemGradientOverrideCss])

  // Small helpers
  const settingsUiSoundRefs = useMemo<SettingsUiSoundRefs>(() => ({
    settingsSelectTabAudioRef,
    settingsSwitchOptionAudioRef,
    settingsHoverAudioRef,
    settingsIconVineAudioRef,
    settingsSystemCollageAudioRef,
    settingsErrorAudioRef,
    settingsSliderAudioRef,
  }), [])

  const playSettingsSound = useCallback((kind: SettingsUiSoundKind, options?: { volume?: number }) => {
    playSettingsUiSound(settingsUiSoundRefs, kind, activeUiOneShotAudioRef, options)
  }, [settingsUiSoundRefs])

  const playSettingsHoverSound = useCallback(() => {
    const now = performance.now()
    if (now - lastSettingsHoverSoundAtRef.current < 120) {
      return
    }

    lastSettingsHoverSoundAtRef.current = now
    playSettingsSound('hover')
  }, [playSettingsSound])

  const playUiSound = useCallback((ref: React.RefObject<HTMLAudioElement | null>) => {
    const original = ref.current
    if (!original) return
    try {
      if (ref === iconScrollAudioRef) {
        const now = performance.now()
        if (now - lastIconScrollUiSoundAtRef.current < 44) {
          return
        }

        lastIconScrollUiSoundAtRef.current = now
        applyVariationToAudio(original, original.volume)
        original.pause()
        original.currentTime = 0
        void original.play()
        return
      }

      const clone = playVariedClone(original, {}, (audio) => {
        activeUiOneShotAudioRef.current.delete(audio)
      })
      if (clone) {
        activeUiOneShotAudioRef.current.add(clone)
      }
    } catch {
      void 0
    }
  }, [iconScrollAudioRef])

  const playFavoriteToggleSound = (wasFavorite: boolean) => {
    const original = wasFavorite ? favoriteDeselectAudioRef.current : favoriteSelectAudioRef.current
    if (!original) {
      return
    }

    const clone = playVariedClone(original, {}, (audio) => {
      activeUiOneShotAudioRef.current.delete(audio)
    })
    if (clone) {
      activeUiOneShotAudioRef.current.add(clone)
    }
  }

  const gameKey = (entry: { title: string; kind: string; target: string; args?: string[] }) =>
    `${entry.kind}::${entry.target}::${entry.title}::${(entry.args || []).join('|')}`

  useEffect(() => {
    focusedGameIdRef.current = focusedGameId
  }, [focusedGameId])

  const playPlipSound = useCallback(() => {
    if (appLowPowerActive) {
      return
    }

    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) {
      return
    }

    if (!plipAudioContextRef.current) {
      plipAudioContextRef.current = new AudioContextCtor()
    }

    const context = plipAudioContextRef.current
    if (context.state === 'suspended') {
      void context.resume()
    }

    const now = context.currentTime
    const rateSample = sampleSoundVariation()
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    const lowPass = context.createBiquadFilter()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(178 * rateSample.playbackRate, now)
    oscillator.frequency.exponentialRampToValueAtTime(102 * rateSample.playbackRate, now + 0.11)

    lowPass.type = 'lowpass'
    lowPass.frequency.setValueAtTime(720, now)
    lowPass.Q.value = 0.72

    const plipLevel = Math.max(0.018, Math.min(0.08, audioTextureLevel * 0.2))
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(plipLevel, now + 0.018)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

    oscillator.connect(lowPass)
    lowPass.connect(gainNode)
    gainNode.connect(context.destination)

    oscillator.start(now)
    oscillator.stop(now + 0.18)
  }, [appLowPowerActive, audioTextureLevel])

  const playGlassTapSound = () => {
    if (!audioTextureEnabled || appLowPowerActive) {
      return
    }

    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) {
      return
    }

    if (!plipAudioContextRef.current) {
      plipAudioContextRef.current = new AudioContextCtor()
    }

    const context = plipAudioContextRef.current
    if (context.state === 'suspended') {
      void context.resume()
    }

    const now = context.currentTime
    const rateSample = sampleSoundVariation()
    const carrier = context.createOscillator()
    const overtone = context.createOscillator()
    const gainNode = context.createGain()
    const filter = context.createBiquadFilter()

    carrier.type = 'triangle'
    carrier.frequency.setValueAtTime(510 * rateSample.playbackRate, now)
    carrier.frequency.exponentialRampToValueAtTime(280 * rateSample.playbackRate, now + 0.08)

    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(980 * rateSample.playbackRate, now)
    overtone.frequency.exponentialRampToValueAtTime(560 * rateSample.playbackRate, now + 0.07)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(760, now)
    filter.Q.value = 0.52

    const tapLevel = Math.max(0.012, Math.min(0.045, audioTextureLevel * 0.11))
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(tapLevel, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

    carrier.connect(filter)
    overtone.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(context.destination)

    carrier.start(now)
    overtone.start(now)
    carrier.stop(now + 0.15)
    overtone.stop(now + 0.15)
  }

  const pulseCustomSystemUploadFlash = useCallback((kind: 'icon' | 'collage') => {
    setCustomSystemUploadFlash(kind)
    playSettingsSound(kind === 'icon' ? 'iconVine' : 'systemCollage')
    window.setTimeout(() => {
      setCustomSystemUploadFlash((current) => (current === kind ? null : current))
    }, 720)
  }, [playSettingsSound])

  const handleManageSystemsEditorTabChange = useCallback((tab: 'basics' | 'rules') => {
    setManageSystemsEditorTab((previous) => {
      if (previous === tab) {
        return previous
      }

      playSettingsSound('selectTab')
      return tab
    })
  }, [playSettingsSound])

  const handleAddGamesTabChange = useCallback((tab: AddGamesTab) => {
    setAddGamesTab((previous) => {
      if (previous === tab) {
        return previous
      }

      playSettingsSound('selectTab')
      return tab
    })
  }, [playSettingsSound])

  const spawnGameClickEffect = useCallback((event: React.MouseEvent<HTMLButtonElement>, gameId: string) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) {
      return
    }

    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100))
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100))
    const droplets = createRandomGameClickDroplets()

    const effectId = crypto.randomUUID()
    setGameClickEffects((previous) => [...previous, { id: effectId, gameId, x, y, droplets }])

    const timer = window.setTimeout(() => {
      setGameClickEffects((previous) => previous.filter((effect) => effect.id !== effectId))
      gameClickEffectTimersRef.current = gameClickEffectTimersRef.current.filter((entry) => entry !== timer)
    }, 620)

    gameClickEffectTimersRef.current.push(timer)
  }, [])

  const {
    triggerSystemEnterFeedback,
    handleScenePointerMove,
    handleCardPointerMove,
    resetCardPointerMove,
    applyGamepadGridCardParallax,
    clearGamepadGridCardParallax,
    applyGlassScrollWeight,
  } = useLauncherInteractionEffects({
    isEnabled:
      activeTab === 'launcher'
      && !isSystemGradientDialogOpen
      && launcherFidelityFlags.enableInteractionEffects
      && !shouldDisableInteractionEffects,
    sceneRef,
    sceneTrailFrameRef,
    pendingScenePointerRef,
    lastScenePointerRef,
    sceneTrailFadeTimerRef,
    scrollGlassResetTimerRef,
    pendingGlassWeightRef,
    applyGlassFrameRef,
  })

  useLauncherPersistenceAudioEffects({
    library,
    setLibrary,
    setStatus,
    selectedSystemAudioRef,
    selectedGameAudioRef,
    iconScrollAudioRef,
    functionsBarHoverAudioRef,
    functionsBarSelectAudioRef,
    favoriteSelectAudioRef,
    favoriteDeselectAudioRef,
    activeUiOneShotAudioRef,
    settingsSelectTabAudioRef,
    settingsSwitchOptionAudioRef,
    settingsHoverAudioRef,
    settingsIconVineAudioRef,
    settingsSystemCollageAudioRef,
    settingsErrorAudioRef,
    settingsSliderAudioRef,
    romDirsText,
    setRomDirsText,
    emulatorPaths,
    setEmulatorPaths,
    systemEmulatorMap,
    setSystemEmulatorMap,
    controllerBindsBySystem,
    setControllerBindsBySystem,
    launcherControllerBinds,
    setLauncherControllerBinds,
    platformPeripheralsBySystem,
    setPlatformPeripheralsBySystem,
    romTitleCleanupEnabled,
    setRomTitleCleanupEnabled,
    titleOverridesByManagedKey,
    setTitleOverridesByManagedKey,
    steamApiKey,
    setSteamApiKey,
    steamId,
    setSteamId,
    audioTextureEnabled,
    setAudioTextureEnabled,
    lowPowerModeEnabled,
    setLowPowerModeEnabled,
    steamControllerCoexistenceMode,
    setSteamControllerCoexistenceMode,
    graphicsFidelityMode,
    setGraphicsFidelityMode: handleGraphicsFidelityModeChange,
    audioTextureLevel,
    setAudioTextureLevel,
    uiSoundVolume,
    setUiSoundVolume,
    menuMusicEnabled,
    setMenuMusicEnabled,
    menuMusicVolume,
    setMenuMusicVolume,
    preferExternalMedia,
    setPreferExternalMedia,
    customCoverByGame,
    setCustomCoverByGame,
    gameMetaById,
    setGameMetaById,
    gridSortMode,
    setGridSortMode,
    gridGroupMode,
    setGridGroupMode,
    gridSizeMode,
    setGridSizeMode,
    isDeferredStartupReady,
    activeTab,
    appLowPowerActive,
    plipAudioContextRef,
    rainBedSourceRef,
    rainBedGainRef,
    rainBedFilterRef,
    achievementModalGameId,
    setAchievementModalGameId,
  })

  const stopAmbientAudioImmediately = useCallback(() => {
    menuMusicStopRef.current?.()

    if (rainBedGainRef.current && plipAudioContextRef.current) {
      const now = plipAudioContextRef.current.currentTime
      rainBedGainRef.current.gain.cancelScheduledValues(now)
      rainBedGainRef.current.gain.setValueAtTime(0.0001, now)
    }

    if (rainBedSourceRef.current) {
      try {
        rainBedSourceRef.current.stop()
      } catch {
        // Source may already be stopped.
      }
      rainBedSourceRef.current.disconnect()
      rainBedSourceRef.current = null
    }

    if (rainBedFilterRef.current) {
      rainBedFilterRef.current.disconnect()
      rainBedFilterRef.current = null
    }

    if (rainBedGainRef.current) {
      rainBedGainRef.current.disconnect()
      rainBedGainRef.current = null
    }
  }, [])

  const enterAppLowPowerMode = useCallback(async () => {
    stopAmbientAudioImmediately()
    setAppLowPowerActive(true)
    document.body.dataset.tmLowPower = 'true'

    const context = plipAudioContextRef.current
    if (context && context.state === 'running') {
      await context.suspend().catch(() => {})
    }

    await enterLowPowerMode()
  }, [stopAmbientAudioImmediately])

  const wakeAppFromLowPowerMode = useCallback(async () => {
    await wakeFromLowPowerMode()
    setAppLowPowerActive(false)
    delete document.body.dataset.tmLowPower

    const context = plipAudioContextRef.current
    if (context && context.state === 'suspended') {
      await context.resume().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isTauri()) {
      return
    }

    let disposed = false
    let unlisten: (() => void) | undefined

    void listen<{ active?: boolean }>('tilezu:low-power-mode-changed', (event) => {
      if (disposed) {
        return
      }

      const active = Boolean(event.payload?.active)
      setAppLowPowerActive(active)
      if (active) {
        document.body.dataset.tmLowPower = 'true'
        stopAmbientAudioImmediately()
        const context = plipAudioContextRef.current
        if (context && context.state === 'running') {
          void context.suspend().catch(() => {})
        }
        return
      }

      delete document.body.dataset.tmLowPower
      const context = plipAudioContextRef.current
      if (context && context.state === 'suspended') {
        void context.resume().catch(() => {})
      }
    }).then((stopListening) => {
      if (disposed) {
        stopListening()
        return
      }

      unlisten = stopListening
    }).catch(() => {})

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [stopAmbientAudioImmediately])

  useLauncherMenuMusic({
    menuMusicEnabled,
    menuMusicVolume,
    preferExternalMedia,
    activeTab,
    isDeferredStartupReady,
    appLowPowerActive,
    plipAudioContextRef,
    menuMusicStopRef,
  })

  useEffect(() => {
    saveCustomSystems(customSystems)
  }, [customSystems])

  useEffect(() => {
    saveCustomSystemAssignmentsBySystemKey(customSystemAssignmentsBySystemKey)
  }, [customSystemAssignmentsBySystemKey])

  useEffect(() => {
    saveCustomSystemAutoSortExclusionsBySystemKey(customSystemAutoSortExclusionsBySystemKey)
  }, [customSystemAutoSortExclusionsBySystemKey])

  useEffect(() => {
    saveCollageStudioDraftsBySystemKey(collageStudioDraftsBySystemKey)
  }, [collageStudioDraftsBySystemKey])

  useEffect(() => {
    const validSystemKeys = new Set([
      ...customSystems.map((system) => system.key),
      ...FACTORY_SYSTEM_DEFINITIONS.map((factory) => factory.key),
    ])
    const validGameIds = new Set(library.map((entry) => entry.id))

    const pruneGameIdsBySystemKey = (
      previous: Record<string, string[]>,
    ): Record<string, string[]> | null => {
      let changed = false
      const next: Record<string, string[]> = {}

      Object.entries(previous).forEach(([systemKey, gameIds]) => {
        if (!validSystemKeys.has(systemKey)) {
          changed = true
          return
        }

        const filtered = gameIds.filter((gameId) => validGameIds.has(gameId))
        if (filtered.length !== gameIds.length) {
          changed = true
        }

        if (filtered.length > 0) {
          next[systemKey] = filtered
        }
      })

      return changed ? next : null
    }

    setCustomSystemAssignmentsBySystemKey((previous) => {
      const next = pruneGameIdsBySystemKey(previous)
      return next ?? previous
    })

    setCustomSystemAutoSortExclusionsBySystemKey((previous) => {
      const next = pruneGameIdsBySystemKey(previous)
      return next ?? previous
    })
  }, [customSystems, library])

  const launcherCustomSystems = useMemo(
    () => mergeLauncherCustomSystems(customSystems, library),
    [customSystems, library],
  )

  useEffect(() => {
    persistSystemGradientMap(systemGradientMap)
  }, [systemGradientMap])

  useEffect(() => {
    persistSystemGradientAnimationMap(systemGradientAnimationMap)
  }, [systemGradientAnimationMap])

  useEffect(() => {
    setSystemGradientMap((previous) => {
      let hasChanges = false
      const next = { ...previous }

      for (const system of launcherCustomSystems) {
        if (isFactorySystemKey(system.key)) {
          continue
        }

        if (next[system.key]) {
          continue
        }

        next[system.key] = toCustomSystemDraftGradient(toCustomSystemDraft(system))
        hasChanges = true
      }

      return hasChanges ? next : previous
    })
  }, [launcherCustomSystems])

  useEffect(() => {
    if (isDeferredStartupReady) {
      markBootStage('launcher-controller:deferred-ready')
      return
    }

    hasScheduledEnsureRomFoldersRef.current = false
    hasScheduledInitialUpdateRefreshRef.current = false
  }, [isDeferredStartupReady])

  useEffect(() => {
    if (!isDeferredStartupReady || hasScheduledEnsureRomFoldersRef.current) {
      return
    }

    hasScheduledEnsureRomFoldersRef.current = true

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    let idleHandle: number | null = null
    const delayHandle = window.setTimeout(() => {
      const runTask = () => {
        void timeBootAsync('launcher-controller:ensure-rom-folders', async () => {
          await ensureRomFolders()
        }).catch(() => {})
      }

      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(() => {
          idleHandle = null
          runTask()
        }, { timeout: LAUNCHER_IDLE_TASK_TIMEOUT_MS })
        return
      }

      idleHandle = window.setTimeout(() => {
        idleHandle = null
        runTask()
      }, 0)
    }, STARTUP_ENSURE_ROM_FOLDERS_DELAY_MS)

    return () => {
      window.clearTimeout(delayHandle)
      if (idleHandle !== null) {
        if (typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(idleHandle)
        } else {
          window.clearTimeout(idleHandle)
        }
      }
    }
  }, [isDeferredStartupReady])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    let idleHandle: number | null = null
    const delayHandle = window.setTimeout(() => {
      const runTask = () => {
        void timeBootAsync('launcher-controller:set-close-to-tray', async () => {
          await setCloseToTrayEnabled(lowPowerModeEnabled)
        }, {
          enabled: lowPowerModeEnabled,
        }).catch(() => {
        })
      }

      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(() => {
          idleHandle = null
          runTask()
        }, { timeout: LAUNCHER_IDLE_TASK_TIMEOUT_MS })
        return
      }

      idleHandle = window.setTimeout(() => {
        idleHandle = null
        runTask()
      }, 0)
    }, STARTUP_SET_CLOSE_TO_TRAY_DELAY_MS)

    return () => {
      window.clearTimeout(delayHandle)
      if (idleHandle !== null) {
        if (typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(idleHandle)
        } else {
          window.clearTimeout(idleHandle)
        }
      }
    }
  }, [isDeferredStartupReady, lowPowerModeEnabled])

  const customSystemCategories = useMemo(() => {
    return launcherCustomSystems
      .filter((system) => !system.hidden)
      .map((system) => toCustomSystemCategory(system))
  }, [launcherCustomSystems])

  const customSystemByKey = useMemo(() => {
    const map: Record<string, CustomSystemDefinition> = {}
    for (const system of launcherCustomSystems) {
      map[system.key] = system
    }

    return map
  }, [launcherCustomSystems])

  const doesGameMatchCustomSystemRules = useCallback((entry: GameEntry, system: CustomSystemDefinition): boolean => {
    if (system.ingestionMode !== 'smart') {
      return false
    }

    const source = getGameSource(entry)
    const normalizedSourceRules = system.rules.includeSources.map((value) => value.trim().toLowerCase()).filter(Boolean)
    const normalizedPathRules = system.rules.includePathHints.map((value) => value.trim().toLowerCase()).filter(Boolean)
    const normalizedExtensionRules = system.rules.includeExtensions.map((value) => value.trim().toLowerCase()).filter(Boolean)

    let matched = false

    if (normalizedSourceRules.length > 0 && source) {
      matched = normalizedSourceRules.includes(source)
    }

    if (!matched && normalizedPathRules.length > 0) {
      const argsText = (entry.args ?? []).join(' ').toLowerCase()
      const haystack = `${entry.title} ${entry.target} ${argsText}`.toLowerCase()
      matched = normalizedPathRules.some((hint) => haystack.includes(hint))
    }

    if (!matched && normalizedExtensionRules.length > 0) {
      const extensionCandidate = entry.target.includes('.')
        ? entry.target.split('.').pop()?.trim().toLowerCase() ?? ''
        : ''
      const argExtensionCandidate = (entry.args ?? [])
        .map((value) => {
          if (!value.includes('.')) {
            return ''
          }

          return value.split('.').pop()?.trim().toLowerCase() ?? ''
        })
        .find(Boolean) ?? ''

      const extension = extensionCandidate || argExtensionCandidate
      if (extension) {
        matched = normalizedExtensionRules.includes(extension)
      }
    }

    return matched
  }, [])

  const effectiveCustomSystemAssignmentsBySystemKey = useMemo(() => {
    const libraryIds = new Set(library.map((entry) => entry.id))
    const next: Record<string, string[]> = {}

    for (const system of launcherCustomSystems) {
      const assigned = new Set(
        (customSystemAssignmentsBySystemKey[system.key] ?? []).filter((gameId) => libraryIds.has(gameId)),
      )

      if (system.ingestionMode === 'smart') {
        const autoSortExcluded = new Set(customSystemAutoSortExclusionsBySystemKey[system.key] ?? [])
        for (const game of library) {
          if (autoSortExcluded.has(game.id)) {
            continue
          }

          if (doesGameMatchCustomSystemRules(game, system)) {
            assigned.add(game.id)
          }
        }
      }

      if (assigned.size > 0) {
        next[system.key] = Array.from(assigned)
      }
    }

    return next
  }, [customSystemAssignmentsBySystemKey, customSystemAutoSortExclusionsBySystemKey, doesGameMatchCustomSystemRules, launcherCustomSystems, library])

  const reservedSystemKeys = useMemo(() => {
    const keys = new Set<string>(BUILT_IN_SYSTEM_CATEGORY_KEYS)

    for (const entry of library) {
      const category = getGameCategory(entry)
      keys.add(category.key.toLowerCase())
    }

    for (const system of launcherCustomSystems) {
      keys.add(system.key.toLowerCase())
    }

    return keys
  }, [launcherCustomSystems, library])

  const {
    searchScoreByGameId,
    systemCategories: rawSystemCategories,
    visibleGames,
    canSortBySystem,
    scrollVisibleGames,
    scrollVisibleGameIndexById,
    hasSearchQuery,
    searchResultCount,
    gridCategoryByGameId,
    gridSections,
    catalogDiagnostics,
  } = useLauncherCatalogModel({
    search,
    library,
    activeCategory,
    setActiveCategory,
    launcherView,
    gamesViewMode,
    gridSortMode,
    gridGroupMode,
    gameMetaById,
    playtimeMinutesByGame,
    customSystemCategories,
    customSystemAssignmentsBySystemKey: effectiveCustomSystemAssignmentsBySystemKey,
    focusedGameId,
    categoryScrollRef,
    setFocusedGameId,
    setGridSortMode,
  })

  // Hide 'emulator' and 'links' from all system selectors and menus
  const systemCategories = useMemo(
    () => rawSystemCategories.filter(cat => cat.key !== 'emulator' && cat.key !== 'links'),
    [rawSystemCategories]
  )

  const systemsSearchQuery = systemsSearch.trim().toLowerCase()
  const systemsHasSearchQuery = systemsSearchQuery.length > 0
  const systemsSearchMatches = useMemo(() => {
    if (!systemsHasSearchQuery) {
      return systemCategories
    }

    return systemCategories.filter((category) => {
      const label = category.label.toLowerCase()
      const shortLabel = category.short.toLowerCase()
      const key = category.key.toLowerCase()
      return label.includes(systemsSearchQuery) || shortLabel.includes(systemsSearchQuery) || key.includes(systemsSearchQuery)
    })
  }, [systemCategories, systemsHasSearchQuery, systemsSearchQuery])
  const systemsSearchResultCount = systemsSearchMatches.length

  const systemsSceneCategories = useMemo(() => {
    if (launcherView !== 'systems') {
      return systemCategories
    }

    if (!systemsHasSearchQuery) {
      return systemCategories
    }

    return systemsSearchMatches
  }, [launcherView, systemCategories, systemsHasSearchQuery, systemsSearchMatches])

  const handleGridRuntimeDiagnostics = useCallback((next: LauncherGridDiagnostics) => {
    setGridRuntimeDiagnostics((previous) => {
      if (
        previous
        && previous.totalItems === next.totalItems
        && previous.renderedItems === next.renderedItems
        && previous.renderedPercent === next.renderedPercent
        && previous.virtualizedSections === next.virtualizedSections
        && previous.overscanRows === next.overscanRows
        && previous.rowStridePx === next.rowStridePx
        && previous.viewportRows === next.viewportRows
        && previous.rawScrollTop === next.rawScrollTop
        && previous.virtualScrollTop === next.virtualScrollTop
        && previous.scrollSyncIntervalMs === next.scrollSyncIntervalMs
        && previous.scrollQuantizePx === next.scrollQuantizePx
        && previous.visibleTileCount === next.visibleTileCount
        && previous.coverVisibleCount === next.coverVisibleCount
        && previous.coverReadyCount === next.coverReadyCount
        && previous.coverLoadingCount === next.coverLoadingCount
        && previous.coverErrorCount === next.coverErrorCount
        && previous.coverMissingCount === next.coverMissingCount
        && previous.coverLowQualityCount === next.coverLowQualityCount
        && previous.coverMediumQualityCount === next.coverMediumQualityCount
        && previous.coverHighQualityCount === next.coverHighQualityCount
        && previous.coverSoftFailCount === next.coverSoftFailCount
        && previous.expectedVisibleTileCount === next.expectedVisibleTileCount
        && previous.expectedVisibleRowCount === next.expectedVisibleRowCount
        && previous.notMountedExpectedTileCount === next.notMountedExpectedTileCount
        && previous.mismatchExpectedVisibleNotMountedCount === next.mismatchExpectedVisibleNotMountedCount
        && previous.mismatchNetworkSuccessDecodeErrorCount === next.mismatchNetworkSuccessDecodeErrorCount
        && previous.mismatchDecodeReadySoftFailCount === next.mismatchDecodeReadySoftFailCount
        && previous.lifecycleMountCount === next.lifecycleMountCount
        && previous.lifecycleUnmountCount === next.lifecycleUnmountCount
        && previous.lifecycleSourceAssignCount === next.lifecycleSourceAssignCount
        && previous.lifecycleDecodeReadyCount === next.lifecycleDecodeReadyCount
        && previous.lifecycleDecodeErrorCount === next.lifecycleDecodeErrorCount
        && previous.lifecycleUnmountBeforeReadyCount === next.lifecycleUnmountBeforeReadyCount
        && previous.lifecycleAvgReadyMs === next.lifecycleAvgReadyMs
        && previous.sliceRowsEnteredPerSec === next.sliceRowsEnteredPerSec
        && previous.sliceRowsExitedPerSec === next.sliceRowsExitedPerSec
        && previous.sliceChurnEventsPerSec === next.sliceChurnEventsPerSec
        && previous.sourceTierGridXsCount === next.sourceTierGridXsCount
        && previous.sourceTierGridMdCount === next.sourceTierGridMdCount
        && previous.sourceTierDetailCount === next.sourceTierDetailCount
        && previous.sourceTierLegacyCount === next.sourceTierLegacyCount
        && previous.sourceTierSourceCount === next.sourceTierSourceCount
        && previous.sourceTierCustomCount === next.sourceTierCustomCount
        && previous.sourceTierUnknownCount === next.sourceTierUnknownCount
        && previous.suspiciousTinySourceCount === next.suspiciousTinySourceCount
        && previous.suspiciousUndersizedCount === next.suspiciousUndersizedCount
        && previous.suspiciousLowEntropyCount === next.suspiciousLowEntropyCount
      ) {
        return previous
      }

      return next
    })
  }, [])

  const handleGridLayoutMetrics = useCallback((next: LauncherGridLayoutMetrics) => {
    setGridLayoutMetrics((previous) => {
      if (previous && previous.gridColumns === next.gridColumns) {
        return previous
      }

      return next
    })
  }, [])
  
  useEffect(() => {
    if (activeTab !== 'launcher') {
      return
    }

    const applySceneAtmosphere = () => {
      const scene = sceneRef.current
      if (!scene) {
        return
      }

      const now = new Date()
      const hour = now.getHours() + now.getMinutes() / 60
      const dayProgress = hour / 24
      const dailyWave = Math.sin(dayProgress * Math.PI * 2 - Math.PI / 2)
      const dayBlend = (dailyWave + 1) / 2
      const sceneDarkness = 1 - dayBlend

      const weatherMode = (now.getDate() + now.getMonth()) % 3
      const weatherHue = weatherMode === 0 ? 198 : weatherMode === 1 ? 188 : 176
      const weatherSat = weatherMode === 0 ? 72 : weatherMode === 1 ? 64 : 60
      const tintLight = weatherMode === 0 ? 55 : weatherMode === 1 ? 58 : 61

      const tintStrength = 0.12 + (1 - dayBlend) * 0.2
      const bgOpacity = weatherMode === 0 ? 0.26 : weatherMode === 1 ? 0.19 : 0.14
      const midOpacity = weatherMode === 0 ? 0.24 : weatherMode === 1 ? 0.19 : 0.14
      const fgOpacity = weatherMode === 0 ? 0.32 : weatherMode === 1 ? 0.2 : 0.12
      const speedMult = weatherMode === 0 ? 1.16 : weatherMode === 1 ? 1 : 0.86

      scene.style.setProperty('--ui-tint-color', `hsla(${weatherHue}, ${weatherSat}%, ${tintLight}%, ${tintStrength.toFixed(3)})`)
      scene.style.setProperty('--ui-tint-glow', `hsla(${weatherHue}, ${Math.min(88, weatherSat + 10)}%, ${Math.max(46, tintLight - 6)}%, ${(tintStrength * 1.35).toFixed(3)})`)
      scene.style.setProperty('--rain-bg-opacity', bgOpacity.toFixed(3))
      scene.style.setProperty('--rain-mid-opacity', midOpacity.toFixed(3))
      scene.style.setProperty('--rain-fg-opacity', fgOpacity.toFixed(3))
      scene.style.setProperty('--rain-speed-mult', speedMult.toFixed(3))
      scene.style.setProperty('--favorite-scene-darkness', sceneDarkness.toFixed(3))
      scene.style.setProperty('--favorite-ring-alpha', `${(66 + sceneDarkness * 16).toFixed(2)}%`)
    }

    applySceneAtmosphere()

    const interval = window.setInterval(() => {
      applySceneAtmosphere()
    }, 30000)

    return () => window.clearInterval(interval)
  }, [activeTab])

  const {
    focusedGameIndex,
    focusedGame,
    stackEntries,
    stackScrollProgress,
    hasVisibleFavoriteGame,
    letterJumpTargets,
    focusGameById,
    focusGameByIndex,
    stepFocusedGame,
    stopGameStackMomentum,
    pushGameStackMomentum,
    jumpToTopGame,
    jumpToBottomGame,
    jumpToFavoriteGame,
    jumpToLetter,
    jumpToStackProgress,
    gameClickEffectsByGameId,
  } = useLauncherStackModel({
    activeSystemKey: activeCategory,
    scrollVisibleGames,
    scrollVisibleGameIndexById,
    focusedGameId,
    setFocusedGameId,
    focusedGameIdRef,
    gameMetaById,
    playUiSound,
    iconScrollAudioRef,
    applyGlassScrollWeight,
    gameStackListRef,
    categoryScrollRef,
    launcherView,
    gamesViewMode,
    isGamesViewSwitching,
    sceneRouteTransition,
    systemCategoriesCount: systemCategories.length,
    gameClickEffects,
    gameStackMomentumRef,
    gameStackWheelAccumulatorRef,
    gameStackScrollDirectionRef,
    gameStackLastStepAtRef,
    gameStackMomentumFrameRef,
    gameStackMomentumSettleTimerRef,
    lastWheelGameStepSoundAtRef,
    isGameStackMomentumActive,
    setIsGameStackMomentumActive,
  })

  const switchTab = useCallback((tab: AppTab) => {
    if (tab === 'appearance' && !APPEARANCE_ADVANCED_ENABLED) {
      return
    }

    if (tab === 'settings' && activeTab !== 'settings') {
      playSettingsSound('selectTab')
    }

    if (tab === 'launcher' && activeTab !== 'launcher') {
      emitSignatureRungoReaction('return-launcher', 'titlebar-switch-tab')
    }

    if (activeTab === 'profile' && tab !== 'profile') {
      setProfileIsExiting(true)
      setTimeout(() => {
        setProfileIsExiting(false)
        setActiveTab(tab)
      }, 240)
      return
    }

    setActiveTab(tab)
  }, [activeTab, playSettingsSound])

  useEffect(() => {
    if (!APPEARANCE_ADVANCED_ENABLED && activeTab === 'appearance') {
      setActiveTab('launcher')
    }
  }, [activeTab])

  const rerunOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_META_KEY)
    localStorage.removeItem(ONBOARDING_DRAFT_KEY)
    window.location.reload()
  }, [])

  useEffect(() => {
    if (activeTab !== 'launcher') {
      document.body.classList.remove('launcher-mode')
      return
    }

    document.body.classList.add('launcher-mode')
    return () => {
      document.body.classList.remove('launcher-mode')
    }
  }, [activeTab])

  useEffect(() => {
    if (launcherInputMode === 'gamepad') {
      document.body.classList.add('launcher-input-gamepad')
    } else {
      document.body.classList.remove('launcher-input-gamepad')
    }

    return () => {
      document.body.classList.remove('launcher-input-gamepad')
    }
  }, [launcherInputMode])

  useEffect(() => {
    if (activeTab !== 'launcher' && isPlaytimeModalOpen) {
      setIsPlaytimeModalOpen(false)
    }
  }, [activeTab, isPlaytimeModalOpen])

  useEffect(() => {
    if (activeTab !== 'launcher' || launcherView !== 'systems') {
      setIsSystemEmulatorPopoverOpen(false)
    }
  }, [activeTab, launcherView])

  const describePlaytimeSource = useCallback((trackedMinutes: number, hasOfficial: boolean): string => {
    if (trackedMinutes > 0 && hasOfficial) {
      return 'Tracked + launcher data'
    }

    if (hasOfficial) {
      return 'Launcher data'
    }

    if (trackedMinutes > 0) {
      return 'Tracked in Tilezu'
    }

    return 'No playtime yet'
  }, [])

  const resolveEntryPlaytime = useCallback((gameId: string) => {
    const trackedMinutes = Math.max(0, Math.floor(gameMetaById[gameId]?.trackedPlaytimeMinutes ?? 0))
    const hasOfficial = Object.prototype.hasOwnProperty.call(playtimeMinutesByGame, gameId)
    const officialMinutes = hasOfficial ? Math.max(0, Math.floor(playtimeMinutesByGame[gameId] ?? 0)) : 0
    const totalMinutes = Math.max(trackedMinutes, officialMinutes)

    return {
      trackedMinutes,
      officialMinutes,
      totalMinutes,
      hasOfficial,
      sourceLabel: describePlaytimeSource(trackedMinutes, hasOfficial),
    }
  }, [describePlaytimeSource, gameMetaById, playtimeMinutesByGame])

  const focusedCanShowAchievements = focusedGame ? parseSteamAppId(focusedGame) !== null : false
  const focusedUpdateStatus = focusedGame ? (gameUpdateStatusById[focusedGame.id] ?? 'unknown') : 'unknown'
  const focusedUpdateFeedback = focusedGame ? gameUpdateFeedbackById[focusedGame.id] : undefined
  const focusedPlaytimeSnapshot = focusedGame ? resolveEntryPlaytime(focusedGame.id) : null
  const focusedPlaytimeMinutes = focusedPlaytimeSnapshot ? focusedPlaytimeSnapshot.totalMinutes : null
  const focusedPlaytimeText = focusedPlaytimeMinutes !== null ? formatPlaytimeMinutes(focusedPlaytimeMinutes) : ''
  const focusedCoverArt = focusedGame ? customCoverByGame[focusedGame.id] ?? coverArtByGame[focusedGame.id] : undefined
  const focusedBrand = focusedGame ? getGameCategory(focusedGame) : DEFAULT_CATEGORY
  const profileTotalGames = library.length
  const profileSystemsUsed = useMemo(() => new Set(library.map((entry) => getGameCategory(entry).key)).size, [library])
  const profileTotalPlaytimeMinutes = useMemo(
    () => library.reduce((sum, entry) => sum + resolveEntryPlaytime(entry.id).totalMinutes, 0),
    [library, resolveEntryPlaytime],
  )
  const profileFavoriteGame = useMemo(() => {
    let bestEntry: GameEntry | null = null
    let bestMinutes = -1

    for (const entry of library) {
      const minutes = resolveEntryPlaytime(entry.id).totalMinutes
      if (minutes > bestMinutes) {
        bestMinutes = minutes
        bestEntry = entry
      }
    }

    if (!bestEntry) {
      return 'No favorite yet'
    }

    if (bestMinutes <= 0) {
      return bestEntry.title
    }

    return `${bestEntry.title} (${formatPlaytimeMinutes(bestMinutes)})`
  }, [library, resolveEntryPlaytime])

  const profileFavoriteGameTitle = useMemo(() => {
    let bestEntry: GameEntry | null = null
    let bestMinutes = -1

    for (const entry of library) {
      const minutes = resolveEntryPlaytime(entry.id).totalMinutes
      if (minutes > bestMinutes) {
        bestMinutes = minutes
        bestEntry = entry
      }
    }

    return bestEntry?.title ?? ''
  }, [library, resolveEntryPlaytime])

  const playerIdIdentity = useMemo<PlayerIdIdentity>(() => ({
    displayName: localProfile.displayName,
    avatarDataUrl: localProfile.avatarDataUrl,
    statusLine: localProfile.statusLine,
    bio: localProfile.bio,
  }), [localProfile.avatarDataUrl, localProfile.bio, localProfile.displayName, localProfile.statusLine])

  const playerIdStats = useMemo<PlayerIdStats>(() => ({
    totalGames: profileTotalGames,
    totalPlaytimeText: formatPlaytimeMinutes(profileTotalPlaytimeMinutes),
    systemsUsed: profileSystemsUsed,
    favoriteGameName: profileFavoriteGameTitle,
  }), [profileFavoriteGameTitle, profileTotalGames, profileSystemsUsed, profileTotalPlaytimeMinutes])

  const playerIdLayout = useMemo<PlayerIdLayoutPrefs>(() => ({
    accentId: localProfile.licenseAccentId,
    foilType: localProfile.licenseFoilType || localProfile.avatarFoilType,
    stickerImageUrl: localProfile.idStickers[0]?.sourceImageUrl
      || localProfile.licenseStickerImageUrl
      || localProfile.avatarStickerImageUrl,
    bannerDataUrl: localProfile.bannerDataUrl,
    stickers: localProfile.idStickers,
    heroGameId: localProfile.heroGameId,
    showcaseGameIds: localProfile.showcaseGameIds,
    featuredSystemKey: localProfile.featuredSystemKey,
  }), [
    localProfile.avatarFoilType,
    localProfile.avatarStickerImageUrl,
    localProfile.bannerDataUrl,
    localProfile.featuredSystemKey,
    localProfile.heroGameId,
    localProfile.idStickers,
    localProfile.licenseAccentId,
    localProfile.licenseFoilType,
    localProfile.licenseStickerImageUrl,
    localProfile.showcaseGameIds,
  ])

  const resolvePlayerIdCoverUrl = useCallback((gameId: string) => (
    customCoverByGame[gameId] ?? coverArtThumbByGame[gameId] ?? coverArtByGame[gameId] ?? ''
  ).trim(), [coverArtByGame, coverArtThumbByGame, customCoverByGame])

  const resolvePlayerIdPlaytimeMinutes = useCallback(
    (gameId: string) => resolveEntryPlaytime(gameId).totalMinutes,
    [resolveEntryPlaytime],
  )

  const playerIdCustomSystems = useMemo(() => {
    const mapped: Record<string, { iconPath?: string; collageDataUrl?: string }> = {}
    for (const [key, system] of Object.entries(customSystemByKey)) {
      mapped[key] = {
        iconPath: system.iconPath,
        collageDataUrl: system.collageDataUrl,
      }
    }
    return mapped
  }, [customSystemByKey])

  const playerIdShowcase = useMemo<PlayerIdShowcase>(() => resolvePlayerIdShowcase({
    library,
    layout: playerIdLayout,
    resolvePlaytimeMinutes: resolvePlayerIdPlaytimeMinutes,
    resolveCoverUrl: resolvePlayerIdCoverUrl,
    customSystemByKey: playerIdCustomSystems,
  }), [library, playerIdCustomSystems, playerIdLayout, resolvePlayerIdCoverUrl, resolvePlayerIdPlaytimeMinutes])

  const resolveShowcaseForLayout = useCallback((layout: PlayerIdLayoutPrefs) => resolvePlayerIdShowcase({
    library,
    layout,
    resolvePlaytimeMinutes: resolvePlayerIdPlaytimeMinutes,
    resolveCoverUrl: resolvePlayerIdCoverUrl,
    customSystemByKey: playerIdCustomSystems,
  }), [library, playerIdCustomSystems, resolvePlayerIdCoverUrl, resolvePlayerIdPlaytimeMinutes])

  const playerIdGameOptions = useMemo(
    () => [...library]
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((entry) => ({ id: entry.id, title: entry.title })),
    [library],
  )

  const playerIdSystemOptions = useMemo(() => listLibrarySystemOptions(library), [library])

  const handleProfileUpdate = useCallback((patch: Partial<PlayerIdIdentity & PlayerIdLayoutPrefs>) => {
    const current = readLocalProfile()
    handleProfileSaved({
      displayName: patch.displayName !== undefined ? patch.displayName : current.displayName,
      avatarDataUrl: patch.avatarDataUrl !== undefined ? patch.avatarDataUrl : current.avatarDataUrl,
      statusLine: patch.statusLine !== undefined ? patch.statusLine : current.statusLine,
      bio: patch.bio !== undefined ? patch.bio : current.bio,
      licenseAccentId: patch.accentId !== undefined ? patch.accentId : current.licenseAccentId,
      licenseFoilType: patch.foilType !== undefined ? patch.foilType : current.licenseFoilType,
      licenseStickerImageUrl: patch.stickerImageUrl !== undefined ? patch.stickerImageUrl : current.licenseStickerImageUrl,
      avatarFoilType: patch.foilType !== undefined ? patch.foilType : current.avatarFoilType,
      avatarStickerImageUrl: patch.stickerImageUrl !== undefined ? patch.stickerImageUrl : current.avatarStickerImageUrl,
      heroGameId: patch.heroGameId !== undefined ? patch.heroGameId : current.heroGameId,
      showcaseGameIds: patch.showcaseGameIds !== undefined ? patch.showcaseGameIds : current.showcaseGameIds,
      featuredSystemKey: patch.featuredSystemKey !== undefined ? patch.featuredSystemKey : current.featuredSystemKey,
      bannerDataUrl: patch.bannerDataUrl !== undefined ? patch.bannerDataUrl : current.bannerDataUrl,
      idStickers: patch.stickers !== undefined ? patch.stickers : current.idStickers,
    })
  }, [handleProfileSaved])

  const profileCoverCandidates = useMemo(() => {
    const urls: string[] = []
    for (const entry of library) {
      const url = (customCoverByGame[entry.id] ?? coverArtByGame[entry.id] ?? '').trim()
      if (!url || urls.includes(url)) {
        continue
      }
      urls.push(url)
      if (urls.length >= 3) {
        break
      }
    }
    return urls
  }, [coverArtByGame, customCoverByGame, library])
  const profileScreenshotOfWeekUrl = localProfile.featuredImageUrls.find((entry) => entry.trim().length > 0) ?? profileCoverCandidates[0] ?? ''
  const isGridView = gamesViewMode === 'grid'
  const isSystemsGridView = systemsViewMode === 'grid'
  const gridColumnsForNavigation = Math.max(1, gridLayoutMetrics?.gridColumns ?? 1)
  const gridNavigationLayout = useMemo<GridNavigationLayout>(() => {
    const slotsByGameId: Record<string, GridNavigationSlot> = {}
    const slotsByRow = new Map<number, GridNavigationSlot[]>()
    let maxRow = -1
    let rowOffset = 0

    for (const section of gridSections) {
      const sectionEntries = section.entries
      if (sectionEntries.length === 0) {
        continue
      }

      const sectionRows = Math.ceil(sectionEntries.length / gridColumnsForNavigation)
      for (let localIndex = 0; localIndex < sectionEntries.length; localIndex += 1) {
        const entry = sectionEntries[localIndex]
        const row = rowOffset + Math.floor(localIndex / gridColumnsForNavigation)
        const column = localIndex % gridColumnsForNavigation
        const slot: GridNavigationSlot = {
          gameId: entry.id,
          row,
          column,
        }

        slotsByGameId[entry.id] = slot

        const rowSlots = slotsByRow.get(row)
        if (rowSlots) {
          rowSlots.push(slot)
        } else {
          slotsByRow.set(row, [slot])
        }

        if (row > maxRow) {
          maxRow = row
        }
      }

      rowOffset += sectionRows
    }

    for (const rowSlots of slotsByRow.values()) {
      rowSlots.sort((left, right) => left.column - right.column)
    }

    return {
      slotsByGameId,
      slotsByRow,
      maxRow,
    }
  }, [gridColumnsForNavigation, gridSections])

  const moveFocusedGameInGrid = useCallback((deltaX: -1 | 0 | 1, deltaY: -1 | 0 | 1) => {
    if (launcherView !== 'games' || gamesViewMode !== 'grid' || !focusedGame) {
      return false
    }

    const currentSlot = gridNavigationLayout.slotsByGameId[focusedGame.id]
    if (!currentSlot) {
      return false
    }

    const targetRow = Math.max(0, Math.min(currentSlot.row + deltaY, gridNavigationLayout.maxRow))
    const rowSlots = gridNavigationLayout.slotsByRow.get(targetRow)
    if (!rowSlots || rowSlots.length === 0) {
      return false
    }

    const maxColumnInRow = rowSlots[rowSlots.length - 1].column
    const preferredColumn = Math.max(0, Math.min(currentSlot.column + deltaX, maxColumnInRow))
    let targetSlot: GridNavigationSlot | undefined = rowSlots.find((slot) => slot.column === preferredColumn)

    if (!targetSlot) {
      targetSlot = rowSlots.reduce((closest, candidate) => {
        const closestDistance = Math.abs(closest.column - preferredColumn)
        const candidateDistance = Math.abs(candidate.column - preferredColumn)
        if (candidateDistance < closestDistance) {
          return candidate
        }

        if (candidateDistance === closestDistance && candidate.column < closest.column) {
          return candidate
        }

        return closest
      }, rowSlots[0])
    }

    if (!targetSlot || targetSlot.gameId === currentSlot.gameId) {
      return false
    }

    return focusGameById(targetSlot.gameId)
  }, [focusGameById, focusedGame, gamesViewMode, gridNavigationLayout, launcherView])

  const {
    focusedScreenshotPath,
    focusedScreenshotPaths,
    displayedScreenshotUrl,
    previousScreenshotUrl,
    isScreenshotCrossfading,
    isScreenshotExpanded,
    isScreenshotClosing,
    showScreenshotFolderFallback,
    openScreenshotFullscreen,
    closeScreenshotFullscreen,
    stepFocusedScreenshot,
    removeGameScreenshots,
  } = useGameScreenshots({
    activeTab,
    focusedGame,
    isDeferredStartupReady,
    launcherView,
    onStepSound: () => playUiSound(iconScrollAudioRef),
  })

  useEffect(() => {
    const handleGlobalSettingsShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const isSettingsShortcut = event.key === 'F10' || (event.key === ',' && (event.ctrlKey || event.metaKey))
      if (!isSettingsShortcut) {
        return
      }

      event.preventDefault()
      switchTab('settings')
    }

    window.addEventListener('keydown', handleGlobalSettingsShortcut)
    return () => window.removeEventListener('keydown', handleGlobalSettingsShortcut)
  }, [switchTab])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    let isF11Pressed = false
    let comboArmedUntil = 0

    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      return element?.tagName === 'INPUT'
        || element?.tagName === 'TEXTAREA'
        || element?.tagName === 'SELECT'
        || element?.isContentEditable
    }

    const handleDebugMenuKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return
      }

      if (event.key === 'F11') {
        isF11Pressed = true
        comboArmedUntil = performance.now() + 1400
        return
      }

      const isBackquoteShortcut = event.key === '`' || event.code === 'Backquote'
      if (!isBackquoteShortcut) {
        return
      }

      const now = performance.now()
      const canToggleDebugMenu = isF11Pressed || now <= comboArmedUntil
      if (!canToggleDebugMenu) {
        return
      }

      event.preventDefault()
      comboArmedUntil = 0
      setIsDebugMenuVisible((previous) => !previous)
    }

    const handleDebugMenuKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        isF11Pressed = false
      }
    }

    const resetDebugMenuChord = () => {
      isF11Pressed = false
      comboArmedUntil = 0
    }

    window.addEventListener('keydown', handleDebugMenuKeyDown)
    window.addEventListener('keyup', handleDebugMenuKeyUp)
    window.addEventListener('blur', resetDebugMenuChord)

    return () => {
      window.removeEventListener('keydown', handleDebugMenuKeyDown)
      window.removeEventListener('keyup', handleDebugMenuKeyUp)
      window.removeEventListener('blur', resetDebugMenuChord)
    }
  }, [])

  useEffect(() => {
    if (!isDebugMenuVisible) {
      setHiddenMediaDebugSummary('hidden-mode inactive')
      setHiddenMediaDebugRows([])
      return
    }

    const collectHiddenMediaDiagnostics = () => {
      const hiddenModeActive = document.body.classList.contains('tm-media-hidden')
      const sidebarShell = document.querySelector<HTMLElement>('.sidebar-glass')
      if (!sidebarShell) {
        setHiddenMediaDebugSummary('sidebar shell not found')
        setHiddenMediaDebugRows([])
        return
      }

      const shellRect = sidebarShell.getBoundingClientRect()
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      const visibleRows: Array<{ label: string; rect: string; style: string; area: number }> = []

      for (const element of candidates) {
        if (!element.isConnected || element === sidebarShell) {
          continue
        }

        const style = window.getComputedStyle(element)
        const opacity = Number.parseFloat(style.opacity || '1')
        if (style.display === 'none' || style.visibility === 'hidden' || opacity <= 0.01) {
          continue
        }

        const rect = element.getBoundingClientRect()
        if (rect.width < 120 || rect.height < 8 || rect.height > 88) {
          continue
        }

        if (rect.right < shellRect.left - 48 || rect.left > shellRect.right + 48) {
          continue
        }

        const className = element.className || ''
        const looksRelevant =
          className.toString().includes('media')
          || className.toString().includes('sidebar')
          || style.borderTopWidth !== '0px'
          || style.backgroundImage !== 'none'
          || style.backgroundColor !== 'rgba(0, 0, 0, 0)'

        if (!looksRelevant) {
          continue
        }

        const label = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${className ? `.${className.toString().trim().replace(/\s+/g, '.')}` : ''}`
        visibleRows.push({
          label,
          rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
          style: `op ${opacity.toFixed(2)} | ${style.display}/${style.visibility} | z ${style.zIndex || 'auto'}`,
          area: rect.width * rect.height,
        })
      }

      const probeX = Math.round(shellRect.left + shellRect.width * 0.58)
      const probeY = Math.round(shellRect.top + 104)
      const probeTarget = document.elementFromPoint(probeX, probeY) as HTMLElement | null
      const probeLabel = probeTarget
        ? `${probeTarget.tagName.toLowerCase()}${probeTarget.id ? `#${probeTarget.id}` : ''}${probeTarget.className ? `.${probeTarget.className.toString().trim().replace(/\s+/g, '.')}` : ''}`
        : 'none'

      const sorted = visibleRows
        .sort((left, right) => right.area - left.area)
        .slice(0, 6)
        .map(({ label, rect, style }) => ({ label, rect, style }))

      const statusPrefix = hiddenModeActive ? 'hidden-mode ON' : 'hidden-mode OFF'
      setHiddenMediaDebugSummary(`${statusPrefix} | suspects ${sorted.length} | probe ${probeX},${probeY} => ${probeLabel}`)
      setHiddenMediaDebugRows(sorted)
    }

    collectHiddenMediaDiagnostics()
    const interval = window.setInterval(collectHiddenMediaDiagnostics, 420)
    return () => {
      window.clearInterval(interval)
    }
  }, [isDebugMenuVisible])

  useEffect(() => {
    const nextCoverArt = focusedCoverArt?.trim()
    backdropCoverLoadTokenRef.current += 1
    const loadToken = backdropCoverLoadTokenRef.current

    if (!nextCoverArt) {
      setReadyBackdropCoverArt(undefined)
      return
    }

    // Fade gradients immediately, then add cover art once it is decoded and ready.
    setReadyBackdropCoverArt(undefined)

    const image = new Image()
    image.decoding = 'async'
    let settled = false

    const resolveLoaded = () => {
      if (settled) {
        return
      }

      settled = true
      if (loadToken !== backdropCoverLoadTokenRef.current) {
        return
      }

      setReadyBackdropCoverArt(nextCoverArt)
    }

    const resolveFailed = () => {
      if (settled) {
        return
      }

      settled = true
      if (loadToken !== backdropCoverLoadTokenRef.current) {
        return
      }

      setReadyBackdropCoverArt(undefined)
    }

    image.onload = resolveLoaded
    image.onerror = resolveFailed
    image.src = nextCoverArt

    if (image.complete) {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolveLoaded()
      } else {
        resolveFailed()
      }
    } else if (typeof image.decode === 'function') {
      void image.decode().then(resolveLoaded).catch(() => {
        // decode may reject for some sources; onload/onerror handlers still settle.
      })
    }

    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [focusedCoverArt])

  const toggleGamesViewMode = () => {
    if (isGamesViewSwitching) {
      return
    }

    setIsGamesViewSwitching(true)
    setGamesViewMode((previous) => (previous === 'list' ? 'grid' : 'list'))

    if (gamesViewSwitchTimerRef.current !== null) {
      window.clearTimeout(gamesViewSwitchTimerRef.current)
    }

    gamesViewSwitchTimerRef.current = window.setTimeout(() => {
      setIsGamesViewSwitching(false)
      gamesViewSwitchTimerRef.current = null
    }, 420)
  }

  const toggleSystemsViewMode = () => {
    setSystemsViewMode((previous) => (previous === 'stack' ? 'grid' : 'stack'))
  }

  const selectedSystem = useMemo(() => {
    const sourceCategories = launcherView === 'systems' ? systemsSceneCategories : systemCategories
    return sourceCategories.find((category) => category.key === activeCategory) ?? sourceCategories[0] ?? null
  }, [launcherView, systemsSceneCategories, systemCategories, activeCategory])

  useEffect(() => {
    setIsSystemEmulatorPopoverOpen(false)
  }, [selectedSystem?.key])

  const playtimeEntries = useMemo(() => {
    return library.map((entry) => {
      const playtime = resolveEntryPlaytime(entry.id)
      const meta = gameMetaById[entry.id]
      const category = getGameCategory(entry)

      return {
        id: entry.id,
        title: normalizeGameTitle(entry.title),
        categoryKey: category.key,
        totalMinutes: playtime.totalMinutes,
        trackedMinutes: playtime.trackedMinutes,
        officialMinutes: playtime.hasOfficial ? playtime.officialMinutes : null,
        playCount: Math.max(0, Math.floor(meta?.playCount ?? 0)),
        lastPlayedAt: Math.max(0, Math.floor(meta?.lastPlayedAt ?? 0)),
        sourceLabel: playtime.sourceLabel,
      }
    })
  }, [gameMetaById, library, resolveEntryPlaytime])

  const selectedSystemPlaytimeEntries = useMemo(() => {
    const selectedKey = selectedSystem?.key ?? 'all'
    const rows = selectedKey === 'all'
      ? playtimeEntries
      : playtimeEntries.filter((entry) => entry.categoryKey === selectedKey)

    return [...rows].sort((left, right) => {
      if (left.totalMinutes !== right.totalMinutes) {
        return right.totalMinutes - left.totalMinutes
      }

      if (left.playCount !== right.playCount) {
        return right.playCount - left.playCount
      }

      return left.title.localeCompare(right.title, undefined, {
        sensitivity: 'base',
        numeric: true,
      })
    })
  }, [playtimeEntries, selectedSystem])

  const selectedSystemTotalPlaytimeMinutes = useMemo(() => {
    return selectedSystemPlaytimeEntries.reduce((total, entry) => total + entry.totalMinutes, 0)
  }, [selectedSystemPlaytimeEntries])

  const sidebarPlaytimePrimaryText = useMemo(() => {
    if (launcherView === 'systems') {
      return formatPlaytimeMinutes(selectedSystemTotalPlaytimeMinutes)
    }

    if (focusedPlaytimeMinutes !== null) {
      return formatPlaytimeMinutes(focusedPlaytimeMinutes)
    }

    return '0m'
  }, [focusedPlaytimeMinutes, launcherView, selectedSystemTotalPlaytimeMinutes])

  const sidebarPlaytimeSecondaryText = useMemo(() => {
    if (launcherView === 'systems') {
      return `${selectedSystem?.label ?? 'Library'} total`
    }

    if (!focusedGame || !focusedPlaytimeSnapshot) {
      return 'Select a game'
    }

    return focusedPlaytimeSnapshot.sourceLabel
  }, [focusedGame, focusedPlaytimeSnapshot, launcherView, selectedSystem])

  const playtimeHubGameEntries = useMemo(() => {
    return library.map((entry) => {
      const playtime = resolveEntryPlaytime(entry.id)
      const meta = gameMetaById[entry.id]
      const cover = (customCoverByGame[entry.id] ?? coverArtThumbByGame[entry.id] ?? coverArtByGame[entry.id] ?? '').trim()

      return {
        id: entry.id,
        title: normalizeGameTitle(entry.title),
        totalMinutes: playtime.totalMinutes,
        iconSrc: cover || null,
        trackedMinutes: playtime.trackedMinutes,
        officialMinutes: playtime.hasOfficial ? playtime.officialMinutes : null,
        playCount: Math.max(0, Math.floor(meta?.playCount ?? 0)),
        lastPlayedAt: Math.max(0, Math.floor(meta?.lastPlayedAt ?? 0)),
        sourceLabel: playtime.sourceLabel,
      }
    }).sort((left, right) => {
      if (left.totalMinutes !== right.totalMinutes) {
        return right.totalMinutes - left.totalMinutes
      }

      if (left.playCount !== right.playCount) {
        return right.playCount - left.playCount
      }

      return left.title.localeCompare(right.title, undefined, {
        sensitivity: 'base',
        numeric: true,
      })
    })
  }, [coverArtByGame, coverArtThumbByGame, customCoverByGame, gameMetaById, library, resolveEntryPlaytime])

  const playtimeTotalClaimableTokens = useMemo(() => {
    return getTotalClaimableTokenCount(
      playtimeHubGameEntries.map((entry) => ({
        gameId: entry.id,
        playtimeMinutes: entry.totalMinutes,
      })),
    )
  }, [getTotalClaimableTokenCount, playtimeHubGameEntries])

  const playtimeModalGameDetails = useMemo(() => {
    if (playtimeModalView !== 'game-detail' || !playtimeSelectedGameId) {
      return null
    }

    return playtimeHubGameEntries.find((entry) => entry.id === playtimeSelectedGameId) ?? null
  }, [playtimeHubGameEntries, playtimeModalView, playtimeSelectedGameId])

  const openPlaytimeHub = useCallback((gameId?: string) => {
    const normalizedGameId = typeof gameId === 'string' ? gameId.trim() : ''
    setPlaytimeModalView('hub')
    setPlaytimeSelectedGameId('')
    setPlaytimeFocusGameId(normalizedGameId)
    setIsPlaytimeModalOpen(true)
  }, [])

  const handlePlaytimeSelectGame = useCallback((gameId: string) => {
    setPlaytimeSelectedGameId(gameId)
    setPlaytimeModalView('game-detail')
  }, [])

  const handlePlaytimeBackToHub = useCallback(() => {
    const previousGameId = playtimeSelectedGameId
    setPlaytimeModalView('hub')
    setPlaytimeSelectedGameId('')
    if (previousGameId) {
      setPlaytimeFocusGameId(previousGameId)
    }
  }, [playtimeSelectedGameId])

  const selectedSystemGradient = useMemo(() => {
    if (!selectedSystem) {
      return null
    }

    return systemGradientMap[selectedSystem.key] ?? null
  }, [selectedSystem, systemGradientMap])

  const selectedSystemApplyMode = useMemo(() => {
    if (!selectedSystem) {
      return 'borders' as const
    }

    return getSystemGradientApplyMode(systemGradientApplyModeMap, selectedSystem.key)
  }, [selectedSystem, systemGradientApplyModeMap])

  const gamesChromeBrandKey = selectedSystem?.key ?? focusedBrand.key

  const gamesDetailBrandKey = focusedBrand.key
  const gamesDetailGradientChromeClass = useMemo(() => {
    const gradient = systemGradientMap[gamesDetailBrandKey]
    if (!gradient) {
      return ''
    }

    return `has-custom-gradient gradient-mode-${getSystemGradientApplyMode(systemGradientApplyModeMap, gamesDetailBrandKey)}`
  }, [gamesDetailBrandKey, systemGradientApplyModeMap, systemGradientMap])

  const gamesGradientChromeClass = selectedSystemGradient
    ? `has-custom-gradient gradient-mode-${selectedSystemApplyMode}`
    : ''

  const selectedSystemGradientAnimation = useMemo<SystemGradientAnimationSettings | null>(() => {
    if (!selectedSystem) {
      return null
    }

    return systemGradientAnimationMap[selectedSystem.key] ?? getDefaultSystemGradientAnimation()
  }, [selectedSystem, systemGradientAnimationMap])

  const selectedSystemLogoBorder = useMemo<boolean>(() => {
    if (!selectedSystem) {
      return false
    }

    return systemLogoBorderMap[selectedSystem.key] ?? false
  }, [selectedSystem, systemLogoBorderMap])

  const shouldDeferSystemCollage = sceneRouteTransition === 'to-systems'
    || animateSystemBackToSystems
    || animateSystemBackToSystemsCenter

  const renderSystemCategoryMark = useCallback((systemKey: string, logoPath: string, label: string, shortLabel: string) => {
    const customSystem = customSystemByKey[systemKey]
    const useNativeLogoColors = systemKey === 'psp'

    return (
      <SystemCard
        key={`system-card-${systemKey}-${logoPath}`}
        className="system-launcher-logo"
        logoPath={logoPath}
        label={label}
        systemKey={systemKey}
        shortLabel={shortLabel}
        collageOverrideDataUrl={customSystem?.collageDataUrl || undefined}
        disableCollage={shouldDeferSystemCollage}
        useNativeLogoColors={useNativeLogoColors}
      />
    )
  }, [customSystemByKey, shouldDeferSystemCollage])

  const selectedSystemLauncher = useMemo(() => {
    if (!selectedSystem) {
      return null
    }

    switch (selectedSystem.key) {
      case 'steam':
        return {
          label: 'Steam',
          kind: 'uri' as const,
          target: 'steam://open/main',
        }
      case 'epic':
        return {
          label: 'Epic Games Store',
          kind: 'uri' as const,
          target: 'com.epicgames.launcher://store',
        }
      case 'battle-net':
        return {
          label: 'Battle.net',
          kind: 'battle_net' as const,
          target: '__battle_net__',
        }
      case 'xbox':
        return {
          label: 'Xbox',
          kind: 'executable' as const,
          target: '__xbox_app__',
        }
      case 'minecraft':
        return {
          label: 'Minecraft Launcher',
          kind: 'executable' as const,
          target: '__minecraft_launcher__',
        }
      case 'roblox':
        return {
          label: 'Roblox Launcher',
          kind: 'executable' as const,
          target: '__roblox_player__',
        }
      case 'riot':
        return {
          label: 'Riot Client',
          kind: 'executable' as const,
          target: '__riot_client__',
        }
      default:
        return null
    }
  }, [selectedSystem])

  const emulatorLabelByKey = useMemo(() => {
    return Object.fromEntries(
      EMULATOR_FIELDS.map((field) => [field.key, field.label]),
    ) as Record<EmulatorKey, string>
  }, [])

  const selectedSystemEmulatorMapKey = useMemo<string | null>(() => {
    if (!selectedSystem) {
      return null
    }

    return SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY[selectedSystem.key] ?? null
  }, [selectedSystem])

  const activeControllerBinds = launcherControllerBinds

  const platformControllerSettingsBinds = useMemo(() => {
    return resolveControllerSystemBinds(controllerBindsBySystem, controllerSettingsSystemKey)
  }, [controllerBindsBySystem, controllerSettingsSystemKey])

  const tilezuControllerSettingsBinds = launcherControllerBinds

  const resolveSettingsRuntimeLayout = useCallback((storedLayout: LauncherControllerLayout) => {
    if (launcherInputMode === 'gamepad' && connectedGamepadFamily) {
      return layoutForGamepadFamily(connectedGamepadFamily)
    }

    return storedLayout
  }, [connectedGamepadFamily, launcherInputMode])

  const resolveSettingsRuntimeBindings = useCallback((
    storedBinds: LauncherControllerSystemBinds,
  ): Record<LauncherControllerAction, LauncherControllerInput> => {
    const runtimeLayout = resolveSettingsRuntimeLayout(storedBinds.layout)
    if (!(launcherInputMode === 'gamepad' && connectedGamepadFamily)) {
      return storedBinds.bindings
    }

    const nextBindings = {
      ...storedBinds.bindings,
    }

    for (const action of CONTROLLER_ACTION_ORDER) {
      nextBindings[action] = remapBindingInputForLayout(
        nextBindings[action],
        storedBinds.layout,
        runtimeLayout,
      )
    }

    return nextBindings
  }, [connectedGamepadFamily, launcherInputMode, resolveSettingsRuntimeLayout])

  const tilezuControllerSettingsRuntimeLayout = useMemo(
    () => resolveSettingsRuntimeLayout(tilezuControllerSettingsBinds.layout),
    [resolveSettingsRuntimeLayout, tilezuControllerSettingsBinds.layout],
  )

  const tilezuControllerSettingsRuntimeBindings = useMemo(
    () => resolveSettingsRuntimeBindings(tilezuControllerSettingsBinds),
    [resolveSettingsRuntimeBindings, tilezuControllerSettingsBinds],
  )

  const platformControllerSettingsRuntimeLayout = useMemo(
    () => resolveSettingsRuntimeLayout(platformControllerSettingsBinds.layout),
    [platformControllerSettingsBinds.layout, resolveSettingsRuntimeLayout],
  )

  const platformControllerSettingsRuntimeBindings = useMemo(
    () => resolveSettingsRuntimeBindings(platformControllerSettingsBinds),
    [platformControllerSettingsBinds, resolveSettingsRuntimeBindings],
  )

  const controllerSettingsBinds = controllerSettingsPanel === 'tilezu'
    ? tilezuControllerSettingsBinds
    : platformControllerSettingsBinds

  const controllerSettingsRuntimeLayout = controllerSettingsPanel === 'tilezu'
    ? tilezuControllerSettingsRuntimeLayout
    : platformControllerSettingsRuntimeLayout

  const controllerSettingsRuntimeBindings = controllerSettingsPanel === 'tilezu'
    ? tilezuControllerSettingsRuntimeBindings
    : platformControllerSettingsRuntimeBindings

  const activeRuntimeControllerLayout = useMemo(() => {
    if (launcherInputMode === 'gamepad' && connectedGamepadFamily) {
      return layoutForGamepadFamily(connectedGamepadFamily)
    }

    return activeControllerBinds.layout
  }, [activeControllerBinds.layout, connectedGamepadFamily, launcherInputMode])

  const activeRuntimeControllerBindings = useMemo(() => {
    if (!(launcherInputMode === 'gamepad' && connectedGamepadFamily)) {
      return activeControllerBinds.bindings
    }

    const nextBindings = {
      ...activeControllerBinds.bindings,
    }

    for (const action of CONTROLLER_ACTION_ORDER) {
      nextBindings[action] = remapBindingInputForLayout(
        nextBindings[action],
        activeControllerBinds.layout,
        activeRuntimeControllerLayout,
      )
    }

    return nextBindings
  }, [
    activeControllerBinds.bindings,
    activeControllerBinds.layout,
    activeRuntimeControllerLayout,
    connectedGamepadFamily,
    launcherInputMode,
  ])

  const activeRuntimeControllerLayoutLabel = useMemo(() => {
    return CONTROLLER_LAYOUT_OPTIONS.find((option) => option.value === activeRuntimeControllerLayout)?.label
      ?? activeRuntimeControllerLayout
  }, [activeRuntimeControllerLayout])

  const controllerPromptEntries = useMemo(() => {
    const binds = activeRuntimeControllerBindings
    const layout = activeRuntimeControllerLayout
    const quickPanelState = readProfileQuickPanelState()
    const context = resolveControllerInputContext({
      activeTab,
      isControllerVirtualKeyboardOpen,
      isQuickOverlayOpen,
      isQuickCustomizeOpen: quickPanelState.isQuickCustomizeOpen,
      isQuickSettingsOpen: quickPanelState.isQuickSettingsOpen,
      isGameActionLayerEngaged: isGameActionLayerEngagedRef.current,
    })
    const contextLabel = getControllerPromptContextLabel(context)
    const topActionLabel = context === 'launcher_main' && launcherView === 'systems' ? 'Enter' : 'Select'

    const entries = [
      {
        id: 'context',
        label: contextLabel,
        inputLabel: 'Move',
      },
      {
        id: 'confirm',
        label: topActionLabel,
        inputLabel: formatControllerInputForLayout(layout, binds.confirm),
      },
      {
        id: 'back',
        label: 'Back',
        inputLabel: formatControllerInputForLayout(layout, binds.back),
      },
    ]

    if (context === 'launcher_main' || context === 'functions_toolbar' || context === 'functions_panel') {
      entries.push(
        {
          id: 'profile',
          label: 'Profile',
          inputLabel: formatControllerInputForLayout(layout, binds.open_profile_rail),
        },
        {
          id: 'find',
          label: 'Find',
          inputLabel: formatControllerInputForLayout(layout, binds.open_find_panel),
        },
        {
          id: 'library',
          label: 'Library',
          inputLabel: formatControllerInputForLayout(layout, binds.open_library_panel),
        },
      )
    }

    return entries
  }, [
    activeRuntimeControllerBindings,
    activeRuntimeControllerLayout,
    activeTab,
    isControllerVirtualKeyboardOpen,
    isQuickOverlayOpen,
    launcherView,
  ])

  const functionsBarPromptByControl = useMemo(() => {
    const binds = activeRuntimeControllerBindings
    const layout = activeRuntimeControllerLayout

    return {
      'back-to-systems': formatControllerInputForLayout(layout, binds.back),
      'toggle-view': formatControllerInputForLayout(layout, binds.toggle_view),
      find: formatControllerInputForLayout(layout, binds.open_find_panel),
      view: formatControllerInputForLayout(layout, binds.confirm),
      library: formatControllerInputForLayout(layout, binds.open_library_panel),
    } as const
  }, [activeRuntimeControllerBindings, activeRuntimeControllerLayout])

  const updateLauncherControllerLayout = useCallback((layout: string) => {
    if (!CONTROLLER_LAYOUT_OPTIONS.some((option) => option.value === layout)) {
      return
    }

    const nextLayout = layout as LauncherControllerLayout

    setLauncherControllerBinds((previous) => {
      if (previous.layout === nextLayout) {
        return previous
      }

      return {
        ...previous,
        layout: nextLayout,
      }
    })

    const layoutLabel = CONTROLLER_LAYOUT_OPTIONS.find((option) => option.value === layout)?.label ?? layout
    setStatus(`Tilezu controller layout set to ${layoutLabel}.`)
  }, [setStatus])

  const updateLauncherControllerBinding = useCallback((
    action: LauncherControllerAction,
    input: LauncherControllerInput,
  ) => {
    setLauncherControllerBinds((previous) => assignControllerBinding(previous, action, input))

    const actionLabel = CONTROLLER_ACTION_LABELS[action] ?? action
    const inputLabel = CONTROLLER_INPUT_LABELS[input] ?? input
    setStatus(`Tilezu: ${actionLabel} -> ${inputLabel}.`)
  }, [setStatus])

  const resetLauncherControllerBindings = useCallback(() => {
    setLauncherControllerBinds(createDefaultControllerSystemBinds())
    setStatus('Reset Tilezu launcher controls.')
  }, [setStatus])

  const updateControllerLayoutForSystem = useCallback((systemKey: string, layout: string) => {
    const trimmedSystemKey = systemKey.trim()
    if (!trimmedSystemKey) {
      return
    }

    if (!CONTROLLER_LAYOUT_OPTIONS.some((option) => option.value === layout)) {
      return
    }

    const nextLayout = layout as LauncherControllerLayout

    setControllerBindsBySystem((previous) => {
      const current = resolveControllerSystemBinds(previous, trimmedSystemKey)
      if (current.layout === nextLayout) {
        return previous
      }

      return {
        ...previous,
        [trimmedSystemKey]: {
          ...current,
          layout: nextLayout,
        },
      }
    })

    const layoutLabel = CONTROLLER_LAYOUT_OPTIONS.find((option) => option.value === layout)?.label ?? layout
    setStatus(`Platform ${trimmedSystemKey}: layout set to ${layoutLabel}.`)
  }, [setStatus])

  const updateControllerBindingForSystem = useCallback((
    systemKey: string,
    action: LauncherControllerAction,
    input: LauncherControllerInput,
  ) => {
    const trimmedSystemKey = systemKey.trim()
    if (!trimmedSystemKey) {
      return
    }

    setControllerBindsBySystem((previous) => {
      const current = resolveControllerSystemBinds(previous, trimmedSystemKey)
      const next = assignControllerBinding(current, action, input)
      return {
        ...previous,
        [trimmedSystemKey]: next,
      }
    })

    const actionLabel = CONTROLLER_ACTION_LABELS[action] ?? action
    const inputLabel = CONTROLLER_INPUT_LABELS[input] ?? input
    setStatus(`Platform ${trimmedSystemKey}: ${actionLabel} -> ${inputLabel}.`)
  }, [setStatus])

  const updatePlatformPeripheralForSystem = useCallback((
    systemKey: string,
    optionId: string,
    value: string,
  ) => {
    const trimmedSystemKey = systemKey.trim()
    const trimmedOptionId = optionId.trim()
    const trimmedValue = value.trim()
    if (!trimmedSystemKey || !trimmedOptionId || !trimmedValue) {
      return
    }

    const definition = getPlatformPeripheralOptionsForSystem(trimmedSystemKey)
      .find((option) => option.id === trimmedOptionId)
    if (!definition || !definition.choices.some((choice) => choice.value === trimmedValue)) {
      return
    }

    setPlatformPeripheralsBySystem((previous) => ({
      ...previous,
      [trimmedSystemKey]: {
        ...resolvePlatformPeripheralsForSystem(previous, trimmedSystemKey),
        [trimmedOptionId]: trimmedValue,
      },
    }))

    const choiceLabel = definition.choices.find((choice) => choice.value === trimmedValue)?.label ?? trimmedValue
    setStatus(`Platform ${trimmedSystemKey}: ${definition.label} set to ${choiceLabel}.`)
  }, [setStatus])

  const resetControllerBindingsForSystem = useCallback((systemKey: string) => {
    const trimmedSystemKey = systemKey.trim()
    if (!trimmedSystemKey) {
      return
    }

    setControllerBindsBySystem((previous) => ({
      ...previous,
      [trimmedSystemKey]: createDefaultControllerBindsBySystem()[trimmedSystemKey]
        ?? createDefaultControllerSystemBinds(),
    }))
    setStatus(`Reset platform controls for ${trimmedSystemKey}.`)
  }, [setStatus])

  const controllerSettingsPeripherals = useMemo(
    () => resolvePlatformPeripheralsForSystem(platformPeripheralsBySystem, controllerSettingsSystemKey),
    [controllerSettingsSystemKey, platformPeripheralsBySystem],
  )

  const controllerSettingsPeripheralOptions = useMemo(
    () => getPlatformPeripheralOptionsForSystem(controllerSettingsSystemKey),
    [controllerSettingsSystemKey],
  )

  const selectedSystemEmulatorEntries = useMemo(() => {
    if (!selectedSystemEmulatorMapKey) {
      return []
    }

    return visibleGames.filter((entry) => {
      const source = getGameSource(entry)
      return entry.kind === 'emulator' || source === 'rom'
    })
  }, [selectedSystemEmulatorMapKey, visibleGames])

  const selectedSystemDetectedEmulatorKeys = useMemo(() => {
    const emulatorKeySet = new Set<EmulatorKey>()

    for (const entry of selectedSystemEmulatorEntries) {
      const emulatorKey = resolveEmulatorKeyForEntry(entry)
      if (emulatorKey) {
        emulatorKeySet.add(emulatorKey)
      }
    }

    return Array.from(emulatorKeySet)
  }, [selectedSystemEmulatorEntries])

  const selectedSystemMappedEmulatorKey = useMemo<EmulatorKey | null>(() => {
    if (!selectedSystemEmulatorMapKey) {
      return null
    }

    const mapped = systemEmulatorMap[selectedSystemEmulatorMapKey]
    return normalizeEmulatorKey(mapped)
  }, [selectedSystemEmulatorMapKey, systemEmulatorMap])

  const selectedSystemDefaultEmulatorKey = useMemo<EmulatorKey | null>(() => {
    if (!selectedSystemEmulatorMapKey) {
      return null
    }

    return normalizeEmulatorKey(DEFAULT_SYSTEM_EMULATOR_MAP[selectedSystemEmulatorMapKey])
  }, [selectedSystemEmulatorMapKey])

  const selectedSystemPopoverEmulatorKey = useMemo<EmulatorKey>(() => {
    if (selectedSystemMappedEmulatorKey) {
      return selectedSystemMappedEmulatorKey
    }

    if (selectedSystemDefaultEmulatorKey) {
      return selectedSystemDefaultEmulatorKey
    }

    if (selectedSystemDetectedEmulatorKeys.length === 1) {
      return selectedSystemDetectedEmulatorKeys[0]
    }

    if (selectedSystemDetectedEmulatorKeys.length > 1) {
      return selectedSystemDetectedEmulatorKeys[0]
    }

    return 'retroarch'
  }, [selectedSystemDefaultEmulatorKey, selectedSystemDetectedEmulatorKeys, selectedSystemMappedEmulatorKey])

  const selectedSystemTestEntry = selectedSystemEmulatorEntries[0] ?? null

  const selectedSystemRetroarchCoreConfigured = useMemo(() => {
    return selectedSystemEmulatorEntries.some((entry) => hasRetroArchCoreArg(entry.args))
  }, [selectedSystemEmulatorEntries])

  const selectedSystemRetroarchCoreAutoEnsurable = useMemo(() => {
    return canAutoEnsureRetroArchCoreForEntries(selectedSystemEmulatorEntries)
  }, [selectedSystemEmulatorEntries])

  const selectedSystemEmulatorSummary = useMemo<SystemEmulatorSummary | null>(() => {
    if (!selectedSystem || !selectedSystemEmulatorMapKey) {
      return null
    }

    if (selectedSystemDetectedEmulatorKeys.length > 1) {
      const labels = selectedSystemDetectedEmulatorKeys.map((key) => emulatorLabelByKey[key] ?? key)
      const mixedPreview = labels.slice(0, 2).join(' + ')
      const mixedSuffix = labels.length > 2 ? ` +${labels.length - 2}` : ''

      return {
        tone: 'mixed',
        label: 'Mixed emulators',
        status: `${mixedPreview}${mixedSuffix}`,
        selectedKey: selectedSystemMappedEmulatorKey ?? selectedSystemDetectedEmulatorKeys[0],
      }
    }

    const selectedKey = selectedSystemMappedEmulatorKey
      ?? selectedSystemDefaultEmulatorKey
      ?? selectedSystemDetectedEmulatorKeys[0]
      ?? null

    if (!selectedKey) {
      return {
        tone: 'idle',
        label: 'No emulator',
        status: 'No ROM entries yet',
        selectedKey: null,
      }
    }

    const label = emulatorLabelByKey[selectedKey] ?? selectedKey
    const emulatorPath = (emulatorPaths[selectedKey] ?? '').trim()

    if (!emulatorPath) {
      return {
        tone: 'missing',
        label,
        status: 'Path missing',
        selectedKey,
      }
    }

    if (
      selectedKey === 'retroarch'
      && selectedSystemEmulatorEntries.length > 0
      && !selectedSystemRetroarchCoreConfigured
      && !selectedSystemRetroarchCoreAutoEnsurable
    ) {
      return {
        tone: 'needs-core',
        label,
        status: 'Core missing',
        selectedKey,
      }
    }

    return {
      tone: 'configured',
      label,
      status: selectedSystemDetectedEmulatorKeys.length === 0 ? 'Linked path' : 'Detected',
      selectedKey,
    }
  }, [
    selectedSystem,
    selectedSystemEmulatorMapKey,
    selectedSystemDetectedEmulatorKeys,
    emulatorLabelByKey,
    selectedSystemMappedEmulatorKey,
    selectedSystemDefaultEmulatorKey,
    emulatorPaths,
    selectedSystemEmulatorEntries.length,
    selectedSystemRetroarchCoreConfigured,
    selectedSystemRetroarchCoreAutoEnsurable,
  ])

  const visibleGameCount = visibleGames.length
  const isSingleVisibleGame = visibleGameCount === 1
  const visibleGamesCountLabel = isSingleVisibleGame ? '1 game' : `${visibleGameCount} games`
  const visibleGamesAvailableLabel = isSingleVisibleGame ? '1 game available' : `${visibleGameCount} games available`

  const toggleSystemEmulatorPopover = () => {
    if (!selectedSystemEmulatorSummary) {
      return
    }

    playUiSound(iconScrollAudioRef)
    playGlassTapSound()
    setIsSystemEmulatorPopoverOpen((previous) => !previous)
    setStatus(`${selectedSystem?.label ?? 'System'} emulator: ${selectedSystemEmulatorSummary.label} (${selectedSystemEmulatorSummary.status}).`)
  }

  const browseSelectedSystemEmulatorPath = async () => {
    if (!selectedSystem || !selectedSystemEmulatorMapKey) {
      return
    }

    const resolvedEmulatorKey = await browseEmulatorPath(selectedSystemPopoverEmulatorKey)
    if (!resolvedEmulatorKey) {
      return
    }

    setSystemEmulatorMap((previous) => ({
      ...previous,
      [selectedSystemEmulatorMapKey]: resolvedEmulatorKey,
    }))

    setStatus(`${selectedSystem.label} now auto-links to ${emulatorLabelByKey[resolvedEmulatorKey] ?? resolvedEmulatorKey}.`)
  }

  const testSelectedSystemEmulatorLaunch = async () => {
    if (!selectedSystemTestEntry) {
      setStatus('No ROM entry available to test launch in this system.')
      return
    }

    setStatus(`Testing ${emulatorLabelByKey[selectedSystemPopoverEmulatorKey] ?? selectedSystemPopoverEmulatorKey} launch...`)
    await launchGame(selectedSystemTestEntry)
  }

  const openSystemEmulatorSettings = () => {
    playUiSound(iconScrollAudioRef)
    playGlassTapSound()
    setIsSystemEmulatorPopoverOpen(false)
    setActiveTab('settings')
    setStatus('Opened settings for emulator configuration.')
  }

  const openSelectedSystemLauncher = async () => {
    if (!selectedSystemLauncher) {
      return
    }

    playUiSound(iconScrollAudioRef)
    playGlassTapSound()
    setStatus(`Opening ${selectedSystemLauncher.label}...`)

    try {
      const outcome = await launchGameCommand({
        kind: selectedSystemLauncher.kind,
        target: selectedSystemLauncher.target,
        args: [],
      })

      if (outcome.mode === 'process') {
        setStatus(`Launch started for ${selectedSystemLauncher.label}${outcome.pid ? ` (pid ${outcome.pid})` : ''}.`)
      } else if (outcome.mode === 'uri') {
        setStatus(`Sent ${selectedSystemLauncher.label} launch request to URI handler.`)
      } else {
        setStatus(`Launch request sent for ${selectedSystemLauncher.label}.`)
      }

      emitSignatureRungoReaction('launch-game', 'system-launch')
    } catch (error) {
      const decoded = decodeLaunchError(error)
      setStatus(`Open launcher failed: ${decoded.userMessage}`)
    }
  }

  const openSystemGradientDialog = () => {
    if (!selectedSystem) {
      return
    }

    playUiSound(iconScrollAudioRef)
    playGlassTapSound()
    setStatus(`Customizing ${selectedSystem.label} gradient...`)
    setIsSystemGradientDialogOpen(true)
  }

  const closeSystemGradientDialog = () => {
    setIsSystemGradientDialogOpen(false)
  }

  const saveSystemGradientForCategory = useCallback((
    systemKey: LauncherCategory,
    gradient: ThemeGradient,
    animation: SystemGradientAnimationSettings,
    applyMode: SystemGradientApplyMode,
    logoBorder: boolean,
  ) => {
    const normalized = normalizeGradient(gradient)
    const normalizedAnimation = normalizeSystemGradientAnimationSettings(animation)
    const normalizedApplyMode: SystemGradientApplyMode = applyMode === 'soaked' ? 'soaked' : 'borders'

    setSystemGradientMap((previous) => {
      const next = {
        ...previous,
        [systemKey]: normalized,
      }

      return next
    })

    setSystemGradientApplyModeMap((previous) => {
      const next = {
        ...previous,
        [systemKey]: normalizedApplyMode,
      }
      persistSystemGradientApplyModeMap(next)
      return next
    })

    setSystemGradientAnimationMap((previous) => {
      const next = {
        ...previous,
        [systemKey]: normalizedAnimation,
      }

      persistSystemGradientAnimationMap(next)
      return next
    })

    setSystemLogoBorderMap((previous) => {
      const next = { ...previous, [systemKey]: logoBorder }
      persistSystemLogoBorderMap(next)
      return next
    })

    const category = systemCategories.find((entry) => entry.key === systemKey)
    setStatus(`Saved custom gradient for ${category?.label ?? systemKey}.`)
  }, [systemCategories])

  const resetSystemGradientForCategory = useCallback((systemKey: LauncherCategory) => {
    setSystemGradientMap((previous) => {
      if (!(systemKey in previous)) {
        return previous
      }

      const next = {
        ...previous,
      }

      delete next[systemKey]
      persistSystemGradientMap(next)
      return next
    })

    setSystemGradientApplyModeMap((previous) => {
      if (!(systemKey in previous)) {
        return previous
      }

      const next = {
        ...previous,
      }

      delete next[systemKey]
      persistSystemGradientApplyModeMap(next)
      return next
    })

    setSystemGradientAnimationMap((previous) => {
      if (!(systemKey in previous)) {
        return previous
      }

      const next = {
        ...previous,
      }

      delete next[systemKey]
      persistSystemGradientAnimationMap(next)
      return next
    })

    const category = systemCategories.find((entry) => entry.key === systemKey)
    setStatus(`Reset ${category?.label ?? systemKey} gradient to default.`)
  }, [systemCategories])

  const sceneBrandKey = launcherView === 'systems' ? selectedSystem?.key ?? 'all' : focusedBrand.key
  const sidebarAccentKey = launcherView === 'systems' ? activeCategory : focusedBrand.key
  const ambientSceneTheme = useMemo(() => {
    const runtimeGradient = systemGradientMap[sceneBrandKey] ?? getDefaultSystemGradient(sceneBrandKey)
    return {
      gradient: runtimeGradient,
      tokens: deriveSystemGradientThemeTokens(runtimeGradient),
    }
  }, [sceneBrandKey, systemGradientMap])
  const appShellThemeStyle = useMemo<CSSProperties | undefined>(() => {
    const runtimeGradient = systemGradientMap[sidebarAccentKey] ?? getDefaultSystemGradient(sidebarAccentKey)
    const runtimeTokens = deriveSystemGradientThemeTokens(runtimeGradient)
    return {
      ['--tm-system-accent' as string]: runtimeTokens.ringColor,
      ['--tm-system-glow' as string]: runtimeTokens.glowColor,
      ['--brand-border' as string]: runtimeTokens.borderColor,
      ['--active-ring' as string]: runtimeTokens.ringColor,
      ['--active-glow' as string]: runtimeTokens.glowColor,
      ['--accent-ring-soft' as string]: runtimeTokens.ringColor,
      ['--accent-glow-soft' as string]: runtimeTokens.glowColor,
      ['--system-gradient-wave-a' as string]: runtimeTokens.waveColorA,
      ['--system-gradient-wave-b' as string]: runtimeTokens.waveColorB,
      ['--system-gradient-wave-c' as string]: runtimeTokens.waveColorC,
      ['--system-gradient-preview' as string]: runtimeTokens.gradientCss,
      ['--system-gradient-accent-gradient' as string]: `linear-gradient(155deg, ${runtimeTokens.waveColorA} 0%, ${runtimeTokens.waveColorB} 52%, ${runtimeTokens.waveColorC} 100%)`,
    }
  }, [sidebarAccentKey, systemGradientMap])

  const sceneSelectionKey =
    launcherView === 'systems'
      ? `system:${selectedSystem?.key ?? 'all'}`
      : `game:${focusedGame?.id ?? focusedGame?.title ?? focusedBrand.key}`
  const sceneBackdropVisual = useMemo(() => {
    const layers: string[] = [getSelectionAccentGradient(sceneSelectionKey), getBrandBackdropGradient(sceneBrandKey)]
    if (readyBackdropCoverArt) {
      layers.push(`url(${readyBackdropCoverArt})`)
    }

    return layers.join(', ')
  }, [sceneSelectionKey, sceneBrandKey, readyBackdropCoverArt])
  const focusedTitleMetaItems = focusedGame
    ? Array.from(
        new Set(
          [focusedPlaytimeText || '0m', selectedSystem?.label, focusedBrand.label]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim()),
        ),
      )
    : []
  const focusedContextTags: string[] = []
  const coverDiagnostics = useMemo(() => {
    if (!isDebugMenuVisible) {
      return {
        rows: [] as Array<{
          key: CoverDiagnosticsProviderKey
          label: string
          total: number
          withArt: number
          custom: number
          pending: number
          loading: number
          retrying: number
          success: number
          failedTransient: number
          failedPermanent: number
          activeQueue: number
          failures: number
          unresolved: number
        }>,
        overall: {
          total: 0,
          withArt: 0,
          custom: 0,
          activeQueue: 0,
          failures: 0,
          unresolved: 0,
        },
        readyPercent: 0,
      }
    }

    const byProvider: Record<CoverDiagnosticsProviderKey, CoverDiagnosticsBucket> = {
      steam: createCoverDiagnosticsBucket('steam'),
      epic: createCoverDiagnosticsBucket('epic'),
      battle_net: createCoverDiagnosticsBucket('battle_net'),
      other: createCoverDiagnosticsBucket('other'),
    }

    for (const entry of visibleGames) {
      const provider = resolveCoverDiagnosticsProvider(entry)
      const bucket = byProvider[provider]
      bucket.total += 1

      const hasCustomCover = Boolean(customCoverByGame[entry.id])
      const hasFetchedCover = Boolean(coverArtByGame[entry.id] || coverArtThumbByGame[entry.id])
      if (hasCustomCover) {
        bucket.custom += 1
      }

      if (hasCustomCover || hasFetchedCover) {
        bucket.withArt += 1
      }

      incrementCoverStatusCounter(bucket, coverArtStatusByGame[entry.id])
    }

    const rows = COVER_DIAGNOSTICS_PROVIDER_ORDER
      .map((provider) => {
        const bucket = byProvider[provider]
        const activeQueue = bucket.pending + bucket.loading + bucket.retrying
        const failures = bucket.failedTransient + bucket.failedPermanent
        const unresolved = Math.max(0, bucket.total - bucket.withArt)
        return {
          ...bucket,
          activeQueue,
          failures,
          unresolved,
        }
      })
      .filter((bucket) => bucket.total > 0)

    const overall = rows.reduce(
      (accumulator, bucket) => {
        accumulator.total += bucket.total
        accumulator.withArt += bucket.withArt
        accumulator.custom += bucket.custom
        accumulator.activeQueue += bucket.activeQueue
        accumulator.failures += bucket.failures
        accumulator.unresolved += bucket.unresolved
        return accumulator
      },
      {
        total: 0,
        withArt: 0,
        custom: 0,
        activeQueue: 0,
        failures: 0,
        unresolved: 0,
      },
    )

    const readyPercent = overall.total > 0 ? Math.round((overall.withArt / overall.total) * 100) : 0

    return {
      rows,
      overall,
      readyPercent,
    }
  }, [coverArtByGame, coverArtStatusByGame, coverArtThumbByGame, customCoverByGame, isDebugMenuVisible, visibleGames])

  const performanceLiteLabel = describeEffectiveFidelity(
    graphicsFidelityMode,
    effectiveGraphicsFidelity,
    isAutoFidelityDowngradeActive,
  )

  const viewportDiagnosticsLabel = typeof window === 'undefined'
    ? 'n/a'
    : `${window.innerWidth}x${window.innerHeight} @${Math.max(1, window.devicePixelRatio || 1).toFixed(2)}x`

  const frameDiagnosticsLabel = frameBudgetSnapshot.sampleCount > 0
    ? `${frameBudgetSnapshot.averageMs.toFixed(1)}ms avg / ${frameBudgetSnapshot.p75Ms.toFixed(1)}ms p75 (${frameBudgetSnapshot.fps.toFixed(1)} fps)`
    : 'warming'

  const gridDiagnosticsLabel = gridRuntimeDiagnostics
    ? `${gridRuntimeDiagnostics.renderedItems}/${gridRuntimeDiagnostics.totalItems} shown (${gridRuntimeDiagnostics.renderedPercent}%)`
    : 'pending'

  const gridNavigationDiagnosticsLabel = (() => {
    if (!isGridView || !focusedGame) {
      return `c${gridColumnsForNavigation} | idle`
    }

    const slot = gridNavigationLayout.slotsByGameId[focusedGame.id]
    if (!slot) {
      return `c${gridColumnsForNavigation} | unresolved`
    }

    return `c${gridColumnsForNavigation} | r${slot.row + 1} c${slot.column + 1}`
  })()

  const visibleCoverDiagnosticsLabel = gridRuntimeDiagnostics
    ? `${gridRuntimeDiagnostics.coverReadyCount}/${gridRuntimeDiagnostics.coverVisibleCount} ready | load ${gridRuntimeDiagnostics.coverLoadingCount} | err ${gridRuntimeDiagnostics.coverErrorCount} | miss ${gridRuntimeDiagnostics.coverMissingCount}`
    : 'pending'

  const coverQualityDiagnosticsLabel = gridRuntimeDiagnostics
    ? `hq ${gridRuntimeDiagnostics.coverHighQualityCount} | mq ${gridRuntimeDiagnostics.coverMediumQualityCount} | lq ${gridRuntimeDiagnostics.coverLowQualityCount} | soft ${gridRuntimeDiagnostics.coverSoftFailCount}`
    : 'pending'

  const scrollDiagnosticsLabel = gridRuntimeDiagnostics
    ? `${Math.round(gridRuntimeDiagnostics.rawScrollTop)}px | sync ${gridRuntimeDiagnostics.scrollSyncIntervalMs || 0}ms | q${gridRuntimeDiagnostics.scrollQuantizePx} | over ${gridRuntimeDiagnostics.overscanRows} (${gridRuntimeDiagnostics.overscanVelocityBucket} ${gridRuntimeDiagnostics.scrollVelocityPxPerMs.toFixed(2)}px/ms)`
    : 'pending'

  const lifecycleDiagnosticsLabel = gridRuntimeDiagnostics
    ? `m ${gridRuntimeDiagnostics.lifecycleMountCount} | u ${gridRuntimeDiagnostics.lifecycleUnmountCount} | src ${gridRuntimeDiagnostics.lifecycleSourceAssignCount} | ready ${gridRuntimeDiagnostics.lifecycleDecodeReadyCount} (${gridRuntimeDiagnostics.lifecycleAvgReadyMs.toFixed(0)}ms)`
    : 'pending'

  const mismatchDiagnosticsLabel = gridRuntimeDiagnostics
    ? `exp-miss ${gridRuntimeDiagnostics.mismatchExpectedVisibleNotMountedCount} | net-ok/decode-err ${gridRuntimeDiagnostics.mismatchNetworkSuccessDecodeErrorCount} | ready-soft ${gridRuntimeDiagnostics.mismatchDecodeReadySoftFailCount}`
    : 'pending'

  const sourceTierDiagnosticsLabel = gridRuntimeDiagnostics
    ? `xs ${gridRuntimeDiagnostics.sourceTierGridXsCount} | md ${gridRuntimeDiagnostics.sourceTierGridMdCount} | det ${gridRuntimeDiagnostics.sourceTierDetailCount} | leg ${gridRuntimeDiagnostics.sourceTierLegacyCount} | src ${gridRuntimeDiagnostics.sourceTierSourceCount} | cust ${gridRuntimeDiagnostics.sourceTierCustomCount}`
    : 'pending'

  const sliceDiagnosticsLabel = gridRuntimeDiagnostics
    ? `in ${gridRuntimeDiagnostics.sliceRowsEnteredPerSec.toFixed(1)}/s | out ${gridRuntimeDiagnostics.sliceRowsExitedPerSec.toFixed(1)}/s | churn ${gridRuntimeDiagnostics.sliceChurnEventsPerSec.toFixed(1)}/s | expect ${gridRuntimeDiagnostics.expectedVisibleTileCount}/${gridRuntimeDiagnostics.expectedVisibleRowCount}`
    : 'pending'

  const sourceSuspicionDiagnosticsLabel = gridRuntimeDiagnostics
    ? `tiny ${gridRuntimeDiagnostics.suspiciousTinySourceCount} | undersized ${gridRuntimeDiagnostics.suspiciousUndersizedCount} | entropy ${gridRuntimeDiagnostics.suspiciousLowEntropyCount}`
    : 'pending'

  const catalogDiagnosticsLabel = catalogDiagnostics.workerActive
    ? `worker ${catalogDiagnostics.catalogCount}/${catalogDiagnostics.libraryCount} (cutoff ${catalogDiagnostics.workerThreshold})`
    : `main ${catalogDiagnostics.catalogCount}/${catalogDiagnostics.libraryCount} (cutoff ${catalogDiagnostics.workerThreshold})`

  const gridSortOptions: Array<{ mode: GridSortMode; label: string; icon: string; disabled?: boolean }> = [
    { mode: 'title-asc', label: 'A-Z', icon: '\u21C5' },
    { mode: 'recently-played', label: 'Recent', icon: '\u21BA' },
    { mode: 'most-played', label: 'Most Played', icon: '\u25A4' },
    { mode: 'date-added', label: 'Date Added', icon: '\u271A' },
    { mode: 'favorites', label: 'Favorites', icon: '\u2605' },
    {
      mode: 'category',
      label: 'System',
      icon: '\u25AB',
      disabled: !canSortBySystem,
    },
  ]

  const customSystemKeySet = useMemo(() => {
    return new Set(customSystemCategories.map((category) => category.key))
  }, [customSystemCategories])

  const systemsGridTiles = useMemo(() => {
    const next = systemsSceneCategories.map((category) => {
      let gameIds: string[]

      if (category.key === 'all') {
        gameIds = library.map((entry) => entry.id)
      } else if (customSystemKeySet.has(category.key)) {
        gameIds = effectiveCustomSystemAssignmentsBySystemKey[category.key] ?? []
      } else {
        gameIds = library
          .filter((entry) => getGameCategory(entry).key === category.key)
          .map((entry) => entry.id)
      }

      let recentPlayedAt = 0
      for (const gameId of gameIds) {
        const playedAt = Math.max(0, Math.floor(gameMetaById[gameId]?.lastPlayedAt ?? 0))
        if (playedAt > recentPlayedAt) {
          recentPlayedAt = playedAt
        }
      }

      return {
        category,
        gameCount: gameIds.length,
        recentPlayedAt,
        hasCornerDew: shouldShowCornerDew(category.key),
        style: { ...buildTileMotionStyle(`system-grid-${category.key}`), position: 'relative' as const },
      }
    })

    if (systemsGridSortMode === 'game-count') {
      next.sort((a, b) => {
        if (b.gameCount !== a.gameCount) {
          return b.gameCount - a.gameCount
        }

        return a.category.label.localeCompare(b.category.label)
      })
      return next
    }

    if (systemsGridSortMode === 'recently-played') {
      next.sort((a, b) => {
        if (b.recentPlayedAt !== a.recentPlayedAt) {
          return b.recentPlayedAt - a.recentPlayedAt
        }

        if (b.gameCount !== a.gameCount) {
          return b.gameCount - a.gameCount
        }

        return a.category.label.localeCompare(b.category.label)
      })
      return next
    }

    next.sort((a, b) => a.category.label.localeCompare(b.category.label))
    return next
  }, [buildTileMotionStyle, customSystemKeySet, effectiveCustomSystemAssignmentsBySystemKey, gameMetaById, library, shouldShowCornerDew, systemsSceneCategories, systemsGridSortMode])

  const sortedSystemsSceneCategories = useMemo(
    () => systemsGridTiles.map((tile) => tile.category),
    [systemsGridTiles],
  )

  const systemsSceneActiveCategoryIndex = useMemo(() => {
    const index = sortedSystemsSceneCategories.findIndex((category) => category.key === activeCategory)
    return index >= 0 ? index : 0
  }, [activeCategory, sortedSystemsSceneCategories])

  useEffect(() => {
    if (launcherView !== 'systems' || sortedSystemsSceneCategories.length === 0) {
      return
    }

    if (sortedSystemsSceneCategories.some((category) => category.key === activeCategory)) {
      return
    }

    setActiveCategory(sortedSystemsSceneCategories[0].key)
  }, [activeCategory, launcherView, setActiveCategory, sortedSystemsSceneCategories])

  const moveFocusedSystemInGrid = useCallback((deltaX: -1 | 0 | 1, deltaY: -1 | 0 | 1) => {
    if (launcherView !== 'systems' || !isSystemsGridView || systemsGridTiles.length === 0) {
      return false
    }

    const direction: DirectionalMove | null = deltaX < 0
      ? 'left'
      : deltaX > 0
        ? 'right'
        : deltaY < 0
          ? 'up'
          : deltaY > 0
            ? 'down'
            : null

    if (!direction) {
      return false
    }

    const systemButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.system-grid-pane button[data-system-key]'),
    )
    const targets = systemButtons
      .map<DirectionalSpatialTarget | null>((button) => {
        const key = button.dataset.systemKey
        if (!key) {
          return null
        }

        const rect = button.getBoundingClientRect()
        return {
          id: key,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        }
      })
      .filter((target): target is DirectionalSpatialTarget => Boolean(target))

    const sortedTargets = [...targets].sort((left, right) => {
      if (Math.abs(left.centerY - right.centerY) > 1) {
        return left.centerY - right.centerY
      }

      return left.centerX - right.centerX
    })

    const rowTolerancePx = 26
    const rows: DirectionalSpatialTarget[][] = []

    for (const target of sortedTargets) {
      const lastRow = rows[rows.length - 1]
      if (!lastRow) {
        rows.push([target])
        continue
      }

      const rowAnchorY = lastRow.reduce((sum, item) => sum + item.centerY, 0) / lastRow.length
      if (Math.abs(target.centerY - rowAnchorY) <= rowTolerancePx) {
        lastRow.push(target)
      } else {
        rows.push([target])
      }
    }

    for (const row of rows) {
      row.sort((left, right) => left.centerX - right.centerX)
    }

    const current = targets.find((target) => target.id === activeCategory) ?? null
    if (!current) {
      const fallbackCategory = systemsGridTiles[0]?.category.key
      if (!fallbackCategory || fallbackCategory === activeCategory) {
        return false
      }

      setActiveCategory(fallbackCategory)
      playUiSound(iconScrollAudioRef)
      return true
    }

    const currentRowIndex = rows.findIndex((row) => row.some((slot) => slot.id === current.id))
    if (currentRowIndex >= 0) {
      const currentRow = rows[currentRowIndex] ?? []
      const currentColumnIndex = currentRow.findIndex((slot) => slot.id === current.id)

      if (direction === 'up' || direction === 'down') {
        const targetRowIndex = direction === 'up'
          ? Math.max(0, currentRowIndex - 1)
          : Math.min(rows.length - 1, currentRowIndex + 1)
        const targetRow = rows[targetRowIndex] ?? []
        const targetColumnIndex = Math.max(0, Math.min(targetRow.length - 1, currentColumnIndex))
        const rowMatchedTarget = targetRow[targetColumnIndex]
        if (rowMatchedTarget && rowMatchedTarget.id !== activeCategory) {
          setActiveCategory(rowMatchedTarget.id as LauncherCategory)
          playUiSound(iconScrollAudioRef)
          return true
        }
      }

      if ((direction === 'left' || direction === 'right') && currentColumnIndex >= 0) {
        const targetColumnIndex = direction === 'left'
          ? Math.max(0, currentColumnIndex - 1)
          : Math.min(currentRow.length - 1, currentColumnIndex + 1)
        const rowMatchedTarget = currentRow[targetColumnIndex]
        if (rowMatchedTarget && rowMatchedTarget.id !== activeCategory) {
          setActiveCategory(rowMatchedTarget.id as LauncherCategory)
          playUiSound(iconScrollAudioRef)
          return true
        }
      }
    }

    const next = pickDirectionalSpatialTarget(current, targets, direction)
    if (!next || next.id === activeCategory) {
      return false
    }

    setActiveCategory(next.id as LauncherCategory)
    playUiSound(iconScrollAudioRef)
    return true
  }, [activeCategory, isSystemsGridView, launcherView, playUiSound, systemsGridTiles])

  const systemStackEntries = useMemo(() => {
    if (sortedSystemsSceneCategories.length === 0) {
      return [] as Array<{ category: CategoryMeta | null; offset: number }>
    }

    const offsets = [-2, -1, 0, 1, 2]

    return offsets.map((offset) => {
      const index = systemsSceneActiveCategoryIndex + offset
      const category = index >= 0 && index < sortedSystemsSceneCategories.length ? sortedSystemsSceneCategories[index] : null
      return {
        category,
        offset,
      }
    })
  }, [sortedSystemsSceneCategories, systemsSceneActiveCategoryIndex])

  const startSceneRouteTransition = useCallback((direction: Exclude<SceneRouteTransition, null>) => {
    setSceneRouteTransition(direction)

    if (sceneRouteTransitionTimerRef.current !== null) {
      window.clearTimeout(sceneRouteTransitionTimerRef.current)
    }

    sceneRouteTransitionTimerRef.current = window.setTimeout(() => {
      setSceneRouteTransition(null)
      sceneRouteTransitionTimerRef.current = null
    }, 180)
  }, [])

  const enterSystem = (categoryKey: LauncherCategory) => {
    startSceneRouteTransition('to-games')
    setActiveCategory(categoryKey)
    setAnimateSystemBackToSystems(false)
    setAnimateSystemBackToSystemsCenter(false)
    isGameActionLayerEngagedRef.current = false
    setAnimateSystemIntoGames(true)
    setLauncherView('games')
  }

  const backToSystems = () => {
    startSceneRouteTransition('to-systems')
    setAnimateSystemBackToSystems(false)
    setAnimateSystemBackToSystemsCenter(false)
    setLauncherView('systems')
  }

  useEffect(() => {
    if (launcherView !== 'games' || !animateSystemIntoGames) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setAnimateSystemIntoGames(false)
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [launcherView, animateSystemIntoGames])

  useEffect(() => {
    if (launcherView !== 'systems' || !animateSystemBackToSystems) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setAnimateSystemBackToSystemsCenter(true)
    })

    if (systemReturnTimerRef.current !== null) {
      window.clearTimeout(systemReturnTimerRef.current)
    }

    systemReturnTimerRef.current = window.setTimeout(() => {
      setAnimateSystemBackToSystems(false)
      setAnimateSystemBackToSystemsCenter(false)
      systemReturnTimerRef.current = null
    }, 250)

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [launcherView, animateSystemBackToSystems])

  const pulseSystemStackMomentum = (direction: -1 | 1, wheelDelta: number) => {
    if (isSystemsGridView) {
      return
    }

    const stackList = categoryScrollRef.current
    if (!stackList) {
      return
    }

    const impulseStrength = Math.max(0.24, Math.min(0.9, wheelDelta / 180))
    stackList.style.setProperty('--stack-scroll-strength', impulseStrength.toFixed(3))
    stackList.style.setProperty('--stack-scroll-direction', direction.toString())
    setIsSystemStackMomentumActive(true)

    if (systemStackMomentumTimerRef.current !== null) {
      window.clearTimeout(systemStackMomentumTimerRef.current)
    }

    systemStackMomentumTimerRef.current = window.setTimeout(() => {
      setIsSystemStackMomentumActive(false)
      if (categoryScrollRef.current) {
        categoryScrollRef.current.style.setProperty('--stack-scroll-strength', '0')
        categoryScrollRef.current.style.setProperty('--stack-scroll-direction', '0')
      }
      systemStackMomentumTimerRef.current = null
    }, STACK_WHEEL_MOMENTUM_SETTLE_MS + 80)
  }

  const stepSystem = (direction: -1 | 1, wheelDelta = 96) => {
    if (sortedSystemsSceneCategories.length === 0) {
      return
    }

    const nextIndex = Math.max(0, Math.min(systemsSceneActiveCategoryIndex + direction, sortedSystemsSceneCategories.length - 1))
    const targetCategory = sortedSystemsSceneCategories[nextIndex]
    if (!targetCategory || targetCategory.key === activeCategory) {
      return
    }

    setActiveCategory(targetCategory.key)
    pulseSystemStackMomentum(direction, wheelDelta)
    playUiSound(iconScrollAudioRef)
  }

  const handleSystemCardClick = (categoryKey: LauncherCategory, isFocused: boolean) => {
    if (isFocused) {
      playUiSound(selectedSystemAudioRef)
      playGlassTapSound()
      enterSystem(categoryKey)
      return
    }

    playUiSound(iconScrollAudioRef)
    playGlassTapSound()
    const targetIndex = sortedSystemsSceneCategories.findIndex((category) => category.key === categoryKey)
    if (targetIndex < 0) {
      return
    }

    const direction: -1 | 1 = targetIndex >= systemsSceneActiveCategoryIndex ? 1 : -1
    if (!isSystemsGridView) {
      pulseSystemStackMomentum(direction, 96)
    }
    setActiveCategory(categoryKey)
  }

  useEffect(() => {
    if (launcherView === 'systems') {
      return
    }

    if (systemStackMomentumTimerRef.current !== null) {
      window.clearTimeout(systemStackMomentumTimerRef.current)
      systemStackMomentumTimerRef.current = null
    }

    queueMicrotask(() => {
      setIsSystemStackMomentumActive(false)
    })
    if (categoryScrollRef.current) {
      categoryScrollRef.current.style.setProperty('--stack-scroll-strength', '0')
      categoryScrollRef.current.style.setProperty('--stack-scroll-direction', '0')
    }
  }, [launcherView])

  const handleGameCardClick = useCallback((gameId: string) => {
    stopGameStackMomentum()
    playUiSound(iconScrollAudioRef)
    playPlipSound()
    setFocusedGameId(gameId)
  }, [playPlipSound, playUiSound, stopGameStackMomentum])

  const focusCurrentGameTile = useCallback(() => {
    if (!focusedGameId) {
      return false
    }

    const escapedGameId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(focusedGameId)
      : focusedGameId.replace(/"/g, '\\"')
    const tile = document.querySelector<HTMLButtonElement>(`button[data-entry-id="${escapedGameId}"]`)
    if (!tile) {
      return false
    }

    isGameActionLayerEngagedRef.current = false
    return focusElement(tile)
  }, [focusedGameId])

  const focusPrimaryGameAction = useCallback(() => {
    const primaryAction = document.querySelector<HTMLButtonElement>('.game-details-pane .game-action-btn')
    if (!primaryAction || primaryAction.disabled) {
      return false
    }

    isGameActionLayerEngagedRef.current = true
    return focusElement(primaryAction)
  }, [])

  const moveFocusedGameAction = useCallback((direction: DirectionalMove) => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.game-details-pane .game-action-btn'))
      .filter((button) => !button.disabled)
    return moveFocusSpatial(direction, buttons, { preferHorizontalRow: direction === 'left' || direction === 'right' })
  }, [])

  const confirmFocusedGameAction = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null
    const button = activeElement?.closest('.game-details-pane .game-action-btn') as HTMLButtonElement | null
    if (!button || button.disabled) {
      return false
    }

    button.click()
    return true
  }, [])

  const clearGamepadPromptHudIdleTimer = useCallback(() => {
    if (gamepadPromptHudIdleTimerRef.current !== null) {
      window.clearTimeout(gamepadPromptHudIdleTimerRef.current)
      gamepadPromptHudIdleTimerRef.current = null
    }
  }, [])

  const markGamepadPromptHudActive = useCallback(() => {
    if (!(launcherInputMode === 'gamepad' && !isQuickOverlayOpen && !isControllerVirtualKeyboardOpen)) {
      return
    }

    setGamepadPromptHudVisibility('visible')
    clearGamepadPromptHudIdleTimer()
    gamepadPromptHudIdleTimerRef.current = window.setTimeout(() => {
      setGamepadPromptHudVisibility('idle')
      gamepadPromptHudIdleTimerRef.current = null
    }, GAMEPAD_PROMPT_IDLE_DELAY_MS)
  }, [clearGamepadPromptHudIdleTimer, isControllerVirtualKeyboardOpen, isQuickOverlayOpen, launcherInputMode])

  const closeControllerVirtualKeyboard = useCallback((commitChanges: boolean) => {
    const target = virtualKeyboardTargetRef.current
    if (target) {
      if (commitChanges) {
        setControlledInputValue(target, controllerVirtualKeyboardValue)
      }

      virtualKeyboardSuppressFocusTargetRef.current = target
      window.setTimeout(() => {
        if (virtualKeyboardSuppressFocusTargetRef.current === target) {
          virtualKeyboardSuppressFocusTargetRef.current = null
        }
      }, 340)
      target.focus({ preventScroll: true })
    }

    virtualKeyboardTargetRef.current = null
    setControllerVirtualKeyboardShiftActive(false)
    setIsControllerVirtualKeyboardOpen(false)
    setControllerVirtualKeyboardCursorRow(0)
    setControllerVirtualKeyboardCursorColumn(0)
    markGamepadPromptHudActive()
  }, [controllerVirtualKeyboardValue, markGamepadPromptHudActive])

  const openControllerVirtualKeyboard = useCallback((target: HTMLInputElement | HTMLTextAreaElement) => {
    if (virtualKeyboardSuppressFocusTargetRef.current === target) {
      return
    }

    virtualKeyboardTargetRef.current = target
    virtualKeyboardLastFocusedGameIdRef.current = focusedGameId
    setControllerVirtualKeyboardFieldLabel(target.getAttribute('aria-label')?.trim() || target.getAttribute('placeholder')?.trim() || 'Text Input')
    setControllerVirtualKeyboardValue(target.value)
    setControllerVirtualKeyboardCursorRow(0)
    setControllerVirtualKeyboardCursorColumn(0)
    setControllerVirtualKeyboardShiftActive(false)
    setIsControllerVirtualKeyboardOpen(true)
    target.blur()
  }, [focusedGameId])

  const moveControllerVirtualKeyboardCursor = useCallback((rowDelta: -1 | 0 | 1, columnDelta: -1 | 0 | 1) => {
    setControllerVirtualKeyboardCursorRow((previousRow) => {
      const nextRow = Math.max(0, Math.min(CONTROLLER_VIRTUAL_KEYBOARD_ROWS.length - 1, previousRow + rowDelta))
      setControllerVirtualKeyboardCursorColumn((previousColumn) => {
        const rowLength = CONTROLLER_VIRTUAL_KEYBOARD_ROWS[nextRow]?.length ?? 1
        if (columnDelta === 0) {
          return Math.max(0, Math.min(rowLength - 1, previousColumn))
        }

        return Math.max(0, Math.min(rowLength - 1, previousColumn + columnDelta))
      })
      return nextRow
    })
  }, [])

  const activateControllerVirtualKeyboardKey = useCallback(() => {
    const row = CONTROLLER_VIRTUAL_KEYBOARD_ROWS[controllerVirtualKeyboardCursorRow] ?? CONTROLLER_VIRTUAL_KEYBOARD_ROWS[0]
    const key = row?.[controllerVirtualKeyboardCursorColumn]
    if (!key) {
      return
    }

    if (key.value) {
      const nextCharacter = controllerVirtualKeyboardShiftActive ? key.value.toUpperCase() : key.value
      setControllerVirtualKeyboardValue((previous) => previous + nextCharacter)
      if (controllerVirtualKeyboardShiftActive) {
        setControllerVirtualKeyboardShiftActive(false)
      }
      return
    }

    switch (key.action) {
      case 'shift':
        setControllerVirtualKeyboardShiftActive((previous) => !previous)
        return
      case 'space':
        setControllerVirtualKeyboardValue((previous) => previous + ' ')
        return
      case 'backspace':
        setControllerVirtualKeyboardValue((previous) => previous.slice(0, -1))
        return
      case 'clear':
        setControllerVirtualKeyboardValue('')
        return
      case 'done':
        closeControllerVirtualKeyboard(true)
        return
      case 'cancel':
        closeControllerVirtualKeyboard(false)
        return
      default:
        return
    }
  }, [
    closeControllerVirtualKeyboard,
    controllerVirtualKeyboardCursorColumn,
    controllerVirtualKeyboardCursorRow,
    controllerVirtualKeyboardShiftActive,
  ])

  useEffect(() => {
    if (!(activeTab === 'launcher' && launcherInputMode === 'gamepad' && !isQuickOverlayOpen && !isControllerVirtualKeyboardOpen)) {
      setGamepadPromptHudVisibility('visible')
      clearGamepadPromptHudIdleTimer()
      return
    }

    markGamepadPromptHudActive()
  }, [
    activeTab,
    clearGamepadPromptHudIdleTimer,
    isControllerVirtualKeyboardOpen,
    isQuickOverlayOpen,
    launcherInputMode,
    launcherView,
    markGamepadPromptHudActive,
  ])

  useEffect(() => {
    return () => {
      clearGamepadPromptHudIdleTimer()
    }
  }, [clearGamepadPromptHudIdleTimer])

  useEffect(() => {
    const markInteraction = () => {
      lastUserInteractionAtRef.current = performance.now()
    }

    markInteraction()

    const options: AddEventListenerOptions = { passive: true }
    window.addEventListener('pointerdown', markInteraction, options)
    window.addEventListener('keydown', markInteraction)
    window.addEventListener('wheel', markInteraction, options)

    return () => {
      window.removeEventListener('pointerdown', markInteraction)
      window.removeEventListener('keydown', markInteraction)
      window.removeEventListener('wheel', markInteraction)
    }
  }, [])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      setIsStartupVisualTierActive(true)
      return
    }

    const timer = window.setTimeout(() => {
      setIsStartupVisualTierActive(false)
    }, STARTUP_VISUAL_TIER_DURATION_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isDeferredStartupReady])

  useEffect(() => {
    markBootStage('launcher-controller:startup-visual-tier', {
      active: isStartupVisualTierActive,
    })
  }, [isStartupVisualTierActive])

  useEffect(() => {
    if (activeTab !== 'launcher' || typeof window === 'undefined') {
      return
    }

    let frameId: number | null = null
    let previousFrameAt = performance.now()
    let lastFlushAt = previousFrameAt
    const frameDurations: number[] = []

    const flushFrameWindow = (at: number) => {
      if (frameDurations.length === 0) {
        return
      }

      const sorted = [...frameDurations].sort((left, right) => left - right)
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
      const p95Ms = sorted[p95Index]
      const maxMs = sorted[sorted.length - 1]
      const averageMs = frameDurations.reduce((sum, value) => sum + value, 0) / frameDurations.length

      markBootStage('launcher-screen:frame-window', {
        launcherView,
        gamesViewMode,
        gridView: isGridView,
        samples: frameDurations.length,
        p95Ms: Number(p95Ms.toFixed(2)),
        avgMs: Number(averageMs.toFixed(2)),
        maxMs: Number(maxMs.toFixed(2)),
        windowMs: Number((at - lastFlushAt).toFixed(2)),
      })

      frameDurations.length = 0
      lastFlushAt = at
    }

    const tick = (at: number) => {
      const frameDelta = Math.max(0, at - previousFrameAt)
      previousFrameAt = at

      if (frameDelta > 0 && frameDelta < 250) {
        frameDurations.push(frameDelta)
      }

      if (at - lastFlushAt >= SCREEN_FRAME_DIAGNOSTICS_WINDOW_MS) {
        flushFrameWindow(at)
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    const PerfObserver = window.PerformanceObserver
    const supportedEntryTypes = PerfObserver?.supportedEntryTypes ?? []
    const canObserveLongTask = supportedEntryTypes.includes('longtask')
    let longTaskObserver: PerformanceObserver | null = null
    let longTaskCount = 0

    if (canObserveLongTask && typeof PerfObserver === 'function') {
      try {
        longTaskObserver = new PerfObserver((list) => {
          for (const entry of list.getEntries()) {
            if (longTaskCount >= SCREEN_LONGTASK_LOG_LIMIT) {
              continue
            }

            longTaskCount += 1
            markBootStage('launcher-screen:longtask', {
              launcherView,
              gamesViewMode,
              gridView: isGridView,
              durationMs: Number(entry.duration.toFixed(2)),
              startTimeMs: Number(entry.startTime.toFixed(2)),
            })
          }
        })
        longTaskObserver.observe({ type: 'longtask', buffered: true })
      } catch {
        longTaskObserver = null
      }
    }

    return () => {
      const finalAt = performance.now()
      flushFrameWindow(finalAt)

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      if (longTaskObserver) {
        longTaskObserver.disconnect()
      }
    }
  }, [activeTab, gamesViewMode, isGridView, launcherView])

  useEffect(() => {
    if (launcherInputMode !== 'gamepad') {
      return
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!isControllerTextEntryElement(target)) {
        return
      }

      if (virtualKeyboardSuppressFocusTargetRef.current === target) {
        return
      }

      openControllerVirtualKeyboard(target)
    }

    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
    }
  }, [launcherInputMode, openControllerVirtualKeyboard])

  const focusLauncherFunctionsToolbar = useCallback(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('.launcher-functions-rail .launcher-functions-button[data-controller-focusable]:not([disabled])'),
    )
    if (buttons.length === 0) {
      return false
    }

    return focusFirst(buttons)
  }, [])

  const focusLauncherMainFromFunctionsBar = useCallback(() => {
    const shell = document.querySelector('.launcher-functions-shell')
    const activeElement = document.activeElement as HTMLElement | null
    if (shell && activeElement && shell.contains(activeElement)) {
      activeElement.blur()
    }
    clearControllerFocusHighlights()

    if (launcherView === 'systems') {
      if (isSystemsGridView) {
        const escapedKey = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(activeCategory)
          : activeCategory.replace(/"/g, '\\"')
        const tile = document.querySelector<HTMLButtonElement>(
          `.system-grid-pane button[data-system-key="${escapedKey}"]`,
        )
        if (tile) {
          return focusElement(tile)
        }
      } else {
        const tile = document.querySelector<HTMLElement>(
          `.stack-item.system-item.active.brand-${activeCategory}`,
        ) ?? document.querySelector<HTMLElement>('.stack-item.system-item.active')
        if (tile) {
          return focusElement(tile)
        }
      }
      return false
    }

    return focusCurrentGameTile()
  }, [activeCategory, focusCurrentGameTile, isSystemsGridView, launcherView])

  const playFunctionsBarUiSound = useCallback(() => {
    playUiSound(functionsBarSelectAudioRef)
  }, [playUiSound])

  const playFunctionsBarHoverSound = useCallback(() => {
    playUiSound(functionsBarHoverAudioRef)
  }, [playUiSound])

  const triggerUpdateStatusRefresh = useCallback(() => {
    setGameUpdateRefreshNonce((previous) => previous + 1)
  }, [])

  const scheduleLauncherIdleTask = useCallback((task: () => void, delayMs = 0): (() => void) => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    let idleHandle: number | null = null
    let cancelled = false
    const delayHandle = window.setTimeout(() => {
      if (cancelled) {
        return
      }

      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(() => {
          idleHandle = null
          if (!cancelled) {
            task()
          }
        }, { timeout: LAUNCHER_IDLE_TASK_TIMEOUT_MS })
        return
      }

      idleHandle = window.setTimeout(() => {
        idleHandle = null
        if (!cancelled) {
          task()
        }
      }, 0)
    }, Math.max(0, delayMs))

    return () => {
      cancelled = true
      window.clearTimeout(delayHandle)
      if (idleHandle !== null) {
        if (typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(idleHandle)
        } else {
          window.clearTimeout(idleHandle)
        }
      }
    }
  }, [])

  const setGameUpdateFeedback = useCallback((entryId: string, message: string) => {
    const previousTimer = gameUpdateFeedbackTimersRef.current.get(entryId)
    if (typeof previousTimer === 'number') {
      window.clearTimeout(previousTimer)
      gameUpdateFeedbackTimersRef.current.delete(entryId)
    }

    setGameUpdateFeedbackById((previous) => ({
      ...previous,
      [entryId]: message,
    }))

    const timer = window.setTimeout(() => {
      setGameUpdateFeedbackById((previous) => {
        if (!Object.prototype.hasOwnProperty.call(previous, entryId)) {
          return previous
        }

        const next = { ...previous }
        delete next[entryId]
        return next
      })
      gameUpdateFeedbackTimersRef.current.delete(entryId)
    }, 5200)

    gameUpdateFeedbackTimersRef.current.set(entryId, timer)
  }, [])

  useEffect(() => {
    return () => {
      gameUpdateFeedbackTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      gameUpdateFeedbackTimersRef.current.clear()
      gameUpdateFollowupTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      gameUpdateFollowupTimersRef.current = []
      updateBubblePopTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      updateBubblePopTimersRef.current.clear()
    }
  }, [])

  const scheduleUpdateStatusFollowupRefresh = useCallback(() => {
    const followupA = window.setTimeout(() => {
      triggerUpdateStatusRefresh()
    }, 4200)

    const followupB = window.setTimeout(() => {
      triggerUpdateStatusRefresh()
    }, 11000)

    gameUpdateFollowupTimersRef.current.push(followupA, followupB)
  }, [triggerUpdateStatusRefresh])

  const tryLaunchUri = useCallback(async (target: string): Promise<boolean> => {
    const normalized = target.trim()
    if (!normalized) {
      return false
    }

    try {
      const outcome = await launchGameCommand({
        kind: 'uri',
        target: normalized,
        args: [],
      })

      return Boolean(outcome?.attempted)
    } catch {
      return false
    }
  }, [])

  const sourceLabelForUpdateMessage = useCallback((game: GameEntry): string => {
    const source = getGameSource(game)
    if (source === 'steam') {
      return 'Steam'
    }

    if (source === 'epic') {
      return 'Epic'
    }

    if (source === 'battle_net') {
      return 'Battle.net'
    }

    if (source === 'xbox_app') {
      return 'Xbox'
    }

    return 'launcher'
  }, [])

  const openGameUpdater = useCallback(async (game: GameEntry) => {
    const source = getGameSource(game)
    const steamAppId = parseSteamAppId(game)
    const epicAppName = game.target.trim()
    const battleNetProduct = game.target.trim().toLowerCase()

    const candidates: string[] = []

    if (source === 'steam') {
      candidates.push('steam://open/downloads')
      if (steamAppId !== null) {
        candidates.push(`steam://install/${steamAppId}`)
        candidates.push(`steam://nav/games/details/${steamAppId}`)
      }
      candidates.push('steam://open/main')
    } else if (source === 'epic') {
      if (epicAppName && epicAppName !== '__epic_launcher__') {
        candidates.push(`com.epicgames.launcher://apps/${encodeURIComponent(epicAppName)}?action=launch`)
      }
      candidates.push('com.epicgames.launcher://store')
    } else if (source === 'battle_net') {
      if (battleNetProduct && battleNetProduct !== '__battle_net__') {
        candidates.push(`battlenet://${battleNetProduct}`)
      }
      candidates.push('battlenet://')
    } else if (source === 'xbox_app') {
      candidates.push('shell:AppsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!App')
      candidates.push('ms-windows-store://')
    }

    let launched = false
    for (const candidate of candidates) {
      if (await tryLaunchUri(candidate)) {
        launched = true
        break
      }
    }

    if (launched) {
      setGameUpdateFeedback(game.id, `Opened ${sourceLabelForUpdateMessage(game)} updater.`)
    } else {
      setGameUpdateFeedback(game.id, 'Could not open updater automatically. Launch the system updater manually.')
    }
  }, [setGameUpdateFeedback, sourceLabelForUpdateMessage, tryLaunchUri])

  const requestGameUpdate = useCallback(async (game: GameEntry) => {
    const source = getGameSource(game)
    const steamAppId = parseSteamAppId(game)
    const epicAppName = game.target.trim()
    const battleNetProduct = game.target.trim().toLowerCase()

    const directCandidates: string[] = []

    if (source === 'steam') {
      directCandidates.push('steam://open/downloads')
      if (steamAppId !== null) {
        directCandidates.push(`steam://install/${steamAppId}`)
        directCandidates.push(`steam://nav/games/details/${steamAppId}`)
      }
    }

    if (source === 'epic' && epicAppName && epicAppName !== '__epic_launcher__') {
      directCandidates.push(`com.epicgames.launcher://apps/${encodeURIComponent(epicAppName)}?action=update`)
    }

    if (source === 'battle_net' && battleNetProduct && battleNetProduct !== '__battle_net__') {
      directCandidates.push(`battlenet://${battleNetProduct}`)
    }

    for (const candidate of directCandidates) {
      if (await tryLaunchUri(candidate)) {
        setGameUpdateFeedback(game.id, `Requested update in ${sourceLabelForUpdateMessage(game)}.`)
        triggerUpdateStatusRefresh()
        scheduleUpdateStatusFollowupRefresh()
        return
      }
    }

    await openGameUpdater(game)
    triggerUpdateStatusRefresh()
    scheduleUpdateStatusFollowupRefresh()
  }, [openGameUpdater, scheduleUpdateStatusFollowupRefresh, setGameUpdateFeedback, sourceLabelForUpdateMessage, triggerUpdateStatusRefresh, tryLaunchUri])

  const stopGameUpdate = useCallback(async (game: GameEntry) => {
    const source = getGameSource(game)
    const steamAppId = parseSteamAppId(game)
    const epicAppName = game.target.trim()
    const battleNetProduct = game.target.trim().toLowerCase()

    const stopCandidates: string[] = []

    if (source === 'steam') {
      if (steamAppId !== null) {
        stopCandidates.push(`steam://nav/games/details/${steamAppId}`)
      }
      stopCandidates.push('steam://open/downloads')
      stopCandidates.push('steam://open/main')
    }

    if (source === 'epic') {
      if (epicAppName && epicAppName !== '__epic_launcher__') {
        stopCandidates.push(`com.epicgames.launcher://apps/${encodeURIComponent(epicAppName)}?action=launch`)
      }
      stopCandidates.push('com.epicgames.launcher://store')
    }

    if (source === 'battle_net') {
      if (battleNetProduct && battleNetProduct !== '__battle_net__') {
        stopCandidates.push(`battlenet://${battleNetProduct}`)
      }
      stopCandidates.push('battlenet://')
    }

    for (const candidate of stopCandidates) {
      if (await tryLaunchUri(candidate)) {
        setGameUpdateFeedback(game.id, `Opened ${sourceLabelForUpdateMessage(game)} to stop or pause the update.`)
        triggerUpdateStatusRefresh()
        scheduleUpdateStatusFollowupRefresh()
        return
      }
    }

    setGameUpdateFeedback(game.id, `Could not open ${sourceLabelForUpdateMessage(game)} controls. Stop the update from the launcher.`)
    triggerUpdateStatusRefresh()
  }, [scheduleUpdateStatusFollowupRefresh, setGameUpdateFeedback, sourceLabelForUpdateMessage, triggerUpdateStatusRefresh, tryLaunchUri])

  const checkGameUpdates = useCallback((game: GameEntry) => {
    setGameUpdateFeedback(game.id, 'Checking updates...')
    triggerUpdateStatusRefresh()
  }, [setGameUpdateFeedback, triggerUpdateStatusRefresh])

  useEffect(() => {
    if (!isDeferredStartupReady || library.length === 0 || hasScheduledInitialUpdateRefreshRef.current) {
      return
    }

    hasScheduledInitialUpdateRefreshRef.current = true
    markBootStage('launcher-controller:update-status-initial-scheduled', {
      librarySize: library.length,
      delayMs: UPDATE_STATUS_INITIAL_REFRESH_DELAY_MS,
    })

    return scheduleLauncherIdleTask(() => {
      markBootStage('launcher-controller:update-status-initial-triggered', {
        librarySize: library.length,
      })
      triggerUpdateStatusRefresh()
    }, UPDATE_STATUS_INITIAL_REFRESH_DELAY_MS)
  }, [isDeferredStartupReady, library.length, scheduleLauncherIdleTask, triggerUpdateStatusRefresh])

  useEffect(() => {
    if (!isDeferredStartupReady || systemCategories.length === 0) {
      return
    }

    return scheduleLauncherIdleTask(() => {
      warmSystemCollageCache(systemCategories.map((category) => category.key))
    }, 120)
  }, [isDeferredStartupReady, scheduleLauncherIdleTask, systemCategories])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    let cancelled = false
    let cadenceTimer: number | null = null
    let cancelIdleTask: (() => void) | null = null

    const scheduleNext = () => {
      if (cancelled) {
        return
      }

      const cadenceMs = document.visibilityState === 'hidden'
        ? UPDATE_STATUS_CADENCE_BACKGROUND_MS
        : UPDATE_STATUS_CADENCE_FOREGROUND_MS

      cadenceTimer = window.setTimeout(() => {
        const now = performance.now()
        const isRecentInput = now - lastUserInteractionAtRef.current < UPDATE_STATUS_ACTIVE_INPUT_GRACE_MS
        const shouldDeferForInteraction =
          document.visibilityState === 'visible'
          && (isRecentInput || isQuickOverlayOpen || isGamesViewSwitching)

        if (shouldDeferForInteraction) {
          scheduleNext()
          return
        }

        cancelIdleTask = scheduleLauncherIdleTask(() => {
          if (cancelled) {
            return
          }

          triggerUpdateStatusRefresh()
          scheduleNext()
        })
      }, cadenceMs)
    }

    const handleVisibilityChange = () => {
      if (cadenceTimer !== null) {
        window.clearTimeout(cadenceTimer)
        cadenceTimer = null
      }

      if (cancelIdleTask) {
        cancelIdleTask()
        cancelIdleTask = null
      }

      scheduleNext()
    }

    scheduleNext()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (cadenceTimer !== null) {
        window.clearTimeout(cadenceTimer)
      }
      if (cancelIdleTask) {
        cancelIdleTask()
      }
    }
  }, [isDeferredStartupReady, isGamesViewSwitching, isQuickOverlayOpen, scheduleLauncherIdleTask, triggerUpdateStatusRefresh])

  useEffect(() => {
    if (!isDeferredStartupReady || library.length === 0) {
      setGameUpdateStatusById({})
      return
    }

    if (gameUpdateRefreshNonce === 0) {
      return
    }

    const refreshToken = gameUpdateRefreshTokenRef.current + 1
    gameUpdateRefreshTokenRef.current = refreshToken

    return scheduleLauncherIdleTask(() => {
      void (async () => {
        const prioritizedLibrary = focusedGameId
          ? [
            ...library.filter((entry) => entry.id === focusedGameId),
            ...library.filter((entry) => entry.id !== focusedGameId),
          ]
          : library

        const requestItems = prioritizedLibrary.map((entry) => ({
          entryId: entry.id,
          kind: entry.kind,
          target: entry.target,
          args: entry.args,
          title: entry.title,
        }))

        const next: Record<string, GameUpdateStatus> = {}
        for (const entry of library) {
          next[entry.id] = 'unknown'
        }

        try {
          for (let index = 0; index < requestItems.length; index += UPDATE_STATUS_BATCH_SIZE) {
            if (gameUpdateRefreshTokenRef.current !== refreshToken) {
              return
            }

            const batch = requestItems.slice(index, index + UPDATE_STATUS_BATCH_SIZE)
            const response = await getGameUpdateStates({ items: batch })

            if (gameUpdateRefreshTokenRef.current !== refreshToken) {
              return
            }

            for (const item of response.results) {
              if (!item.entryId) {
                continue
              }

              next[item.entryId] = item.status
            }

            if (index + UPDATE_STATUS_BATCH_SIZE < requestItems.length) {
              await new Promise<void>((resolve) => {
                window.setTimeout(() => resolve(), UPDATE_STATUS_BATCH_SPACING_MS)
              })
            }
          }

          setGameUpdateStatusById(next)
        } catch {
          if (gameUpdateRefreshTokenRef.current !== refreshToken) {
            return
          }

          setGameUpdateStatusById(next)
        }
      })()
    }, UPDATE_STATUS_FETCH_DELAY_MS)
  }, [focusedGameId, gameUpdateRefreshNonce, isDeferredStartupReady, library, scheduleLauncherIdleTask])

  useEffect(() => {
    const previous = previousUpdateStatusByIdRef.current

    for (const entry of library) {
      const entryId = entry.id
      const currentStatus = gameUpdateStatusById[entryId] ?? 'unknown'
      const previousStatus = previous[entryId]

      if (
        previousStatus
        && (previousStatus === 'update_available' || previousStatus === 'downloading_or_staging')
        && currentStatus === 'up_to_date'
      ) {
        const existingTimer = updateBubblePopTimersRef.current.get(entryId)
        if (typeof existingTimer === 'number') {
          window.clearTimeout(existingTimer)
        }

        setUpdateBubblePopById((state) => ({
          ...state,
          [entryId]: true,
        }))

        const timer = window.setTimeout(() => {
          setUpdateBubblePopById((state) => {
            if (!Object.prototype.hasOwnProperty.call(state, entryId)) {
              return state
            }

            const next = { ...state }
            delete next[entryId]
            return next
          })
          updateBubblePopTimersRef.current.delete(entryId)
        }, 980)

        updateBubblePopTimersRef.current.set(entryId, timer)
      }
    }

    const snapshot: Record<string, GameUpdateStatus> = {}
    for (const entry of library) {
      snapshot[entry.id] = gameUpdateStatusById[entry.id] ?? 'unknown'
    }
    previousUpdateStatusByIdRef.current = snapshot
  }, [gameUpdateStatusById, library])

  const handleGridCardClick = useCallback((_event: React.MouseEvent<HTMLButtonElement>, entryId: string) => {
    handleGameCardClick(entryId)
  }, [handleGameCardClick])

  const {
    hasActiveExternalSession,
    connectorHealth,
    applyConnectorFixAction,
    selectedAchievementGame,
    removeGame,
    launchGame,
    renameGameTitle,
    resetGameTitleToAuto,
    isGameTitleOverridden,
    toggleFavoriteGame,
    autoImportGames,
    addRomFolder,
    addExecutable,
    browseEmulatorPath,
    steamBrowserLogin,
    openSteamApiKeyPage,
    testSteamConnection,
    logoutSteam,
    uploadCustomCover,
    customCoverCropRequest,
    isApplyingCustomCoverCrop,
    cancelCustomCoverCrop,
    applyCustomCoverCrop,
    applyCustomCoverFullArt,
    handleTileAchievementAction,
    refreshCoverLookup,
    recheckExternalSessions,
  } = useLauncherLibraryActions({
    isDeferredStartupReady,
    lowPowerModeEnabled,
    steamControllerCoexistenceMode,
    steamApiKey,
    steamId,
    library,
    playtimeMinutesByGame,
    playtimeLookupDone,
    coverArtByGame,
    coverArtThumbByGame,
    coverArtStatusByGame,
    customCoverByGame,
    achievementByGame,
    achievementModalGameId,
    achievementSearch,
    achievementFilter,
    emulatorPaths,
    systemEmulatorMap,
    controllerBindsBySystem,
    platformPeripheralsBySystem,
    romTitleCleanupEnabled,
    titleOverridesByManagedKey,
    romDirsText,
    setRomDirsText,
    launcherView,
    gamesViewMode,
    isPerformanceFirstMode: launcherFidelityFlags.isPerformanceFirstMode,
    launchWipeTimerRef,
    setPlaytimeMinutesByGame,
    setPlaytimeLookupDone,
    setCoverArtByGame,
    setCoverArtThumbByGame,
    setCoverArtStatusByGame,
    setCoverArtMetaByGame,
    setCoverSourceByGame,
    setLibrary,
    setGameMetaById,
    setAchievementByGame,
    setCustomCoverByGame,
    setIsImporting,
    setStatus,
    setLoadingAchievements,
    setAchievementModalGameId,
    setAchievementSearch,
    setAchievementFilter,
    setEmulatorPaths,
    setTitleOverridesByManagedKey,
    setIsSteamLoginBusy,
    setSteamId,
    setIsSteamTestBusy,
    setIsLaunchWipeActive,
    setFocusedGameId,
    setActiveTab,
    removeGameScreenshots,
    playFavoriteToggleSound,
    gameKey,
    activeCategory,
    enterAppLowPowerMode,
    wakeAppFromLowPowerMode,
  })

  const {
    menu: gameTileContextMenu,
    copyMenu: gameTileCopyMenu,
    menuEntry: gameTileContextMenuEntry,
    menuExplorerFolder: gameTileContextMenuExplorerFolder,
    openMenuFromEvent: openGameTileContextMenu,
    closeMenu: closeGameTileContextMenu,
    closeCopyMenu: closeGameTileCopyMenu,
    handlePlay: handleGameTileContextMenuPlay,
    handleToggleFavorite: handleGameTileContextMenuToggleFavorite,
    handleOpenPlaytime: handleGameTileContextMenuOpenPlaytime,
    handleOpenFolder: handleGameTileContextMenuOpenFolder,
    handleRemove: handleGameTileContextMenuRemove,
    menuIsFavorite: gameTileContextMenuIsFavorite,
    menuUpdateStatus: gameTileContextMenuUpdateStatus,
  } = useGameTileContextMenu({
    enabled: activeTab === 'launcher',
    library,
    gameMetaById,
    gameUpdateStatusById,
    onFocusGame: handleGameCardClick,
    launchGame,
    requestGameUpdate,
    toggleFavoriteGame,
    removeGame,
    openPlaytimeHub,
  })

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    setCustomSystems((previous) => {
      const userOnly = filterUserCustomSystems(previous)
      return userOnly.length === previous.length ? previous : userOnly
    })

    setSystemGradientMap((previous) => {
      const next: Record<string, ThemeGradient> = {}
      let changed = false

      for (const [key, gradient] of Object.entries(previous)) {
        if (isFactorySystemKey(key)) {
          changed = true
          continue
        }

        next[key] = gradient
      }

      return changed ? next : previous
    })

    setSystemGradientAnimationMap((previous) => {
      const next: Record<string, SystemGradientAnimationSettings> = {}
      let changed = false

      for (const [key, settings] of Object.entries(previous)) {
        if (isFactorySystemKey(key)) {
          changed = true
          continue
        }

        next[key] = settings
      }

      return changed ? next : previous
    })

    setSystemGradientApplyModeMap((previous) => {
      const next: SystemGradientApplyModeMap = {}
      let changed = false

      for (const [key, mode] of Object.entries(previous)) {
        if (isFactorySystemKey(key)) {
          changed = true
          continue
        }

        next[key] = mode
      }

      return changed ? next : previous
    })

    setSystemLogoBorderMap((previous) => {
      const next: SystemLogoBorderMap = {}
      let changed = false

      for (const [key, enabled] of Object.entries(previous)) {
        if (isFactorySystemKey(key)) {
          changed = true
          continue
        }

        next[key] = enabled
      }

      return changed ? next : previous
    })

    setCollageStudioDraftsBySystemKey((previous) => {
      const next: Record<string, CollageStudioDraft> = {}
      let changed = false

      for (const [key, draft] of Object.entries(previous)) {
        if (isFactorySystemKey(key)) {
          changed = true
          continue
        }

        next[key] = draft
      }

      return changed ? next : previous
    })
  }, [isDeferredStartupReady])

  const handleSettingsSwitchSound = useCallback(() => {
    playSettingsSound('switchOption')
  }, [playSettingsSound])

  const handleSettingsSliderSound = useMemo(
    () => createSettingsSliderSoundPlayer(() => playSettingsSound('slider')),
    [playSettingsSound],
  )

  const handleSettingsErrorSound = useCallback(() => {
    playSettingsSound('error')
  }, [playSettingsSound])

  const handleSteamBrowserLogin = useCallback(() => {
    handleSettingsSwitchSound()
    void steamBrowserLogin()
  }, [handleSettingsSwitchSound, steamBrowserLogin])

  const handleTestSteamConnection = useCallback(async () => {
    const ok = await testSteamConnection()
    if (ok) {
      handleSettingsSwitchSound()
      return
    }

    handleSettingsErrorSound()
  }, [handleSettingsErrorSound, handleSettingsSwitchSound, testSteamConnection])

  const handleLogoutSteam = useCallback(() => {
    handleSettingsSwitchSound()
    logoutSteam()
  }, [handleSettingsSwitchSound, logoutSteam])

  const handleOpenSteamApiKeyPage = useCallback(() => {
    handleSettingsSwitchSound()
    void openSteamApiKeyPage()
  }, [handleSettingsSwitchSound, openSteamApiKeyPage])

  const handleAddRomFolder = useCallback(() => {
    handleSettingsSwitchSound()
    void addRomFolder()
  }, [addRomFolder, handleSettingsSwitchSound])

  const handleRerunOnboarding = useCallback(() => {
    handleSettingsSwitchSound()
    rerunOnboarding()
  }, [handleSettingsSwitchSound, rerunOnboarding])

  const handleOpenFullSettings = useCallback(() => {
    setSettingsActiveSection(DEFAULT_SETTINGS_SECTION)
    switchTab('settings')
  }, [switchTab])

  const quickSettingsBindings = useMemo<QuickSettingsBindings>(() => ({
    uiSoundVolume,
    onUiSoundVolumeChange: setUiSoundVolume,
    audioTextureEnabled,
    onAudioTextureEnabledChange: setAudioTextureEnabled,
    audioTextureLevel,
    onAudioTextureLevelChange: setAudioTextureLevel,
    graphicsFidelityMode,
    onGraphicsFidelityModeChange: handleGraphicsFidelityModeChange,
    lowPowerModeEnabled,
    onLowPowerModeEnabledChange: setLowPowerModeEnabled,
    onSwitchSound: handleSettingsSwitchSound,
    onSliderSound: handleSettingsSliderSound,
    menuMusicEnabled,
    onMenuMusicEnabledChange: setMenuMusicEnabled,
    menuMusicVolume,
    onMenuMusicVolumeChange: setMenuMusicVolume,
    preferExternalMedia,
    onPreferExternalMediaChange: setPreferExternalMedia,
  }), [
    audioTextureEnabled,
    audioTextureLevel,
    graphicsFidelityMode,
    handleGraphicsFidelityModeChange,
    handleSettingsSwitchSound,
    handleSettingsSliderSound,
    lowPowerModeEnabled,
    menuMusicEnabled,
    menuMusicVolume,
    preferExternalMedia,
    uiSoundVolume,
  ])

  const quickOverlayActions = useMemo<QuickOverlayAction[]>(() => {
    const actions: QuickOverlayAction[] = []

    if (hasActiveExternalSession) {
      actions.push({
        id: 'resume-game',
        label: 'Resume Game',
        description: 'Hide Tilezu and return to your running game.',
      })
      actions.push({
        id: 'force-return',
        label: 'Force Return To Tilezu',
        description: 'Bring Tilezu back to foreground and reclaim controller focus.',
      })
      actions.push({
        id: 'retry-session-detect',
        label: 'Retry Session Detection',
        description: 'Recheck running launch sessions and external lock state.',
      })
    }

    actions.push(
      {
        id: 'open-launcher',
        label: 'Launcher Home',
        description: 'Stay in launcher and close the quick overlay.',
      },
      {
        id: 'open-settings',
        label: 'Open Settings',
        description: 'Jump directly into settings.',
      },
      {
        id: 'close-overlay',
        label: 'Close Overlay',
        description: 'Dismiss quick overlay and keep current view.',
      },
    )

    return actions
  }, [hasActiveExternalSession])

  const executeQuickOverlayAction = useCallback((actionId: QuickOverlayActionId) => {
    setIsQuickOverlayOpen(false)

    switch (actionId) {
      case 'resume-game':
        if (lowPowerModeEnabled) {
          void enterAppLowPowerMode().catch(() => {
          })
        }
        return
      case 'force-return':
        setActiveTab('launcher')
        void wakeAppFromLowPowerMode().catch(() => {
        })
        return
      case 'retry-session-detect':
        recheckExternalSessions()
        return
      case 'open-launcher':
        setActiveTab('launcher')
        return
      case 'open-settings':
        switchTab('settings')
        return
      case 'close-overlay':
      default:
        return
    }
  }, [enterAppLowPowerMode, lowPowerModeEnabled, recheckExternalSessions, setActiveTab, switchTab, wakeAppFromLowPowerMode])

  useEffect(() => {
    if (quickOverlayActions.length === 0) {
      if (quickOverlaySelectionIndex !== 0) {
        setQuickOverlaySelectionIndex(0)
      }
      return
    }

    setQuickOverlaySelectionIndex((previous) => {
      const bounded = Math.max(0, Math.min(previous, quickOverlayActions.length - 1))
      return bounded === previous ? previous : bounded
    })
  }, [quickOverlayActions.length, quickOverlaySelectionIndex])

  useEffect(() => {
    if (activeTab === 'launcher') {
      return
    }

    setIsQuickOverlayOpen(false)
  }, [activeTab])

  useEffect(() => {
    const handleQuickOverlayShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableElement(event.target)) {
        return
      }

      const isShiftMinusShortcut = event.shiftKey && (event.code === 'Minus' || event.code === 'NumpadSubtract')
      if (!isShiftMinusShortcut) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation()
      }
      setActiveTab('launcher')

      if (hasActiveExternalSession && lowPowerModeEnabled) {
        void wakeAppFromLowPowerMode().catch(() => {
        })
      }

      setQuickOverlaySelectionIndex(0)
      setIsQuickOverlayOpen((previous) => !previous)
    }

    window.addEventListener('keydown', handleQuickOverlayShortcut, true)
    return () => window.removeEventListener('keydown', handleQuickOverlayShortcut, true)
  }, [hasActiveExternalSession, lowPowerModeEnabled, setActiveTab, wakeAppFromLowPowerMode])

    useEffect(() => {
      const handleVisibilityOrFocus = () => {
        if (document.visibilityState !== 'visible' || !hasActiveExternalSession) {
          return
        }

        recheckExternalSessions()

        if (lowPowerModeEnabled) {
          void wakeAppFromLowPowerMode().catch(() => {
          })
        }
      }

      window.addEventListener('focus', handleVisibilityOrFocus)
      document.addEventListener('visibilitychange', handleVisibilityOrFocus)

      return () => {
        window.removeEventListener('focus', handleVisibilityOrFocus)
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      }
    }, [hasActiveExternalSession, lowPowerModeEnabled, recheckExternalSessions, wakeAppFromLowPowerMode])

  useEffect(() => {
    if (!isQuickOverlayOpen) {
      return
    }

    const handleQuickOverlayKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        executeQuickOverlayAction('close-overlay')
        return
      }

      if (isEditableElement(event.target)) {
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        setQuickOverlaySelectionIndex((previous) => Math.max(0, previous - 1))
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        setQuickOverlaySelectionIndex((previous) => Math.min(quickOverlayActions.length - 1, previous + 1))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        setQuickOverlaySelectionIndex(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        setQuickOverlaySelectionIndex(Math.max(0, quickOverlayActions.length - 1))
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        const targetAction = quickOverlayActions[quickOverlaySelectionIndex] ?? quickOverlayActions[0]
        if (!targetAction) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        executeQuickOverlayAction(targetAction.id)
        return
      }

      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener('keydown', handleQuickOverlayKeyDown, true)
    return () => window.removeEventListener('keydown', handleQuickOverlayKeyDown, true)
  }, [executeQuickOverlayAction, isQuickOverlayOpen, quickOverlayActions, quickOverlaySelectionIndex])

  useEffect(() => {
    if (activeTab !== 'launcher' || launcherView !== 'games') {
      return
    }

    const handleLauncherEscapeToSystems = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') {
        return
      }

      if (isQuickOverlayOpen || isSearchFocused || isEditableElement(event.target)) {
        return
      }

      event.preventDefault()
      backToSystems()
    }

    window.addEventListener('keydown', handleLauncherEscapeToSystems)
    return () => {
      window.removeEventListener('keydown', handleLauncherEscapeToSystems)
    }
  }, [activeTab, backToSystems, isQuickOverlayOpen, isSearchFocused, launcherView])

  useEffect(() => {
    const markKeyboardMouseInput = () => {
      setLauncherInputMode((previous) => (previous === 'keyboard-mouse' ? previous : 'keyboard-mouse'))
    }

    const handleKeyboardInput = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) {
        markKeyboardMouseInput()
        return
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        markKeyboardMouseInput()
      }
    }

    window.addEventListener('mousemove', markKeyboardMouseInput, { passive: true })
    window.addEventListener('mousedown', markKeyboardMouseInput, { passive: true })
    window.addEventListener('keydown', handleKeyboardInput)

    return () => {
      window.removeEventListener('mousemove', markKeyboardMouseInput)
      window.removeEventListener('mousedown', markKeyboardMouseInput)
      window.removeEventListener('keydown', handleKeyboardInput)
    }
  }, [])

  const toggleProfileRail = useCallback(() => {
    window.dispatchEvent(new CustomEvent('tilezu:toggle-profile-rail'))
  }, [])

  const openFunctionsFindPanel = useCallback(() => {
    window.dispatchEvent(new CustomEvent('tilezu:functions-bar-command', { detail: { command: 'open-find' } }))
  }, [])

  const openFunctionsLibraryPanel = useCallback(() => {
    window.dispatchEvent(new CustomEvent('tilezu:functions-bar-command', { detail: { command: 'open-library' } }))
  }, [])

  const openFunctionsSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('tilezu:functions-bar-command', { detail: { command: 'focus-search' } }))
  }, [])

  useEffect(() => setupModalDialogControllerNavigation(), [])

  useEffect(() => {
    const handleFocusLauncherMain = () => {
      focusLauncherMainFromFunctionsBar()
    }

    window.addEventListener('tilezu:focus-launcher-main', handleFocusLauncherMain)
    return () => {
      window.removeEventListener('tilezu:focus-launcher-main', handleFocusLauncherMain)
    }
  }, [focusLauncherMainFromFunctionsBar])

  useEffect(() => {
    if (activeTab === 'launcher') {
      return
    }

    clearGamepadPopupTimers()
    setGamepadPopup(null)
  }, [activeTab, clearGamepadPopupTimers])

  useEffect(() => {
    const quickPanelState = readProfileQuickPanelState()
    const controllerInputDeps: ControllerInputHandlerDeps = {
      activeTab,
      isControllerVirtualKeyboardOpen,
      isGameActionLayerEngaged: isGameActionLayerEngagedRef.current,
      clearGameActionLayerEngaged: () => {
        isGameActionLayerEngagedRef.current = false
      },
      closeQuickOverlay: () => {
        executeQuickOverlayAction('close-overlay')
      },
      isQuickOverlayOpen,
      isSearchFocused,
      isQuickCustomizeOpen: quickPanelState.isQuickCustomizeOpen,
      isQuickSettingsOpen: quickPanelState.isQuickSettingsOpen,
      moveControllerVirtualKeyboardCursor,
      activateControllerVirtualKeyboardKey,
      closeControllerVirtualKeyboard,
      openControllerVirtualKeyboard,
      setQuickOverlaySelectionIndex,
      quickOverlayActionsLength: quickOverlayActions.length,
      quickOverlayActions,
      executeQuickOverlayAction: (actionId) => {
        executeQuickOverlayAction(actionId as QuickOverlayActionId)
      },
      quickOverlaySelectionIndex,
      moveFocusedGameAction,
      launcherView,
      isGridView,
      isSystemsGridView,
      moveFocusedSystemInGrid,
      stepSystem,
      moveFocusedGameInGrid,
      pushGameStackMomentum,
      enterSystem,
      activeCategory,
      confirmFocusedGameAction,
      focusPrimaryGameAction,
      focusCurrentGameTile,
      backToSystems,
      switchTab,
      toggleSystemsViewMode,
      toggleGamesViewMode,
      jumpToTopGame,
      jumpToBottomGame,
      setActiveCategory,
      systemsGridTiles,
      sortedSystemsSceneCategories,
      toggleProfileRail,
      openFunctionsFindPanel,
      openFunctionsLibraryPanel,
      openFunctionsSearch,
      focusLauncherFunctionsToolbar,
    }

    const triggerControllerAction = (action: LauncherControllerAction) => {
      markGamepadPromptHudActive()

      const quickPanelState = readProfileQuickPanelState()
      const context = resolveControllerInputContext({
        activeTab,
        isControllerVirtualKeyboardOpen,
        isQuickOverlayOpen,
        isQuickCustomizeOpen: quickPanelState.isQuickCustomizeOpen,
        isQuickSettingsOpen: quickPanelState.isQuickSettingsOpen,
        isGameActionLayerEngaged: isGameActionLayerEngagedRef.current,
      })

      if (
        context === 'launcher_main'
        && (isSearchFocused || isEditableElement(document.activeElement))
        && action.startsWith('navigate_')
      ) {
        return
      }

      const handled = handleControllerActionForContext(context, action, controllerInputDeps)
      if (handled) {
        if (action === 'confirm') {
          if (context === 'functions_panel' || context === 'functions_toolbar') {
            playFunctionsBarUiSound()
          } else {
            playSettingsSound('selectTab')
          }
        } else if (action === 'back') {
          playSettingsSound('switchOption')
        }
      }
    }

    const clearPressedState = () => {
      gamepadPressedActionsRef.current = {}
      gamepadActionRepeatAtRef.current = {}
      gamepadStickNavStateRef.current = {}
      gamepadStickActiveRef.current = {}
      gamepadNavTapAtRef.current = {}
      gamepadAxisStateRef.current = { ...DEFAULT_GAMEPAD_AXIS_STATE }
      clearGamepadGridCardParallax()
    }

    const triggerNavigationTap = (action: LauncherControllerAction, at: number) => {
      const lastTapAt = gamepadNavTapAtRef.current[action] ?? 0
      if (at - lastTapAt < STICK_NAV_TAP_DEBOUNCE_MS) {
        return
      }

      gamepadNavTapAtRef.current[action] = at
      triggerControllerAction(action)
    }

    const triggerNavigationRepeat = (action: LauncherControllerAction) => {
      triggerControllerAction(action)
    }

    const pollGamepads = () => {
      const isDocumentVisible = document.visibilityState === 'visible'
      const isDocumentFocused = document.hasFocus()
      const isControllerInputLocked = !isDocumentVisible
        || (!isDocumentFocused && (hasActiveExternalSession || !isQuickOverlayOpen))

      if (isControllerInputLocked) {
        if (!controllerInputLockActiveRef.current) {
          controllerInputLockActiveRef.current = true
          clearPressedState()
        }

        return
      }

      if (controllerInputLockActiveRef.current) {
        controllerInputLockActiveRef.current = false
        clearPressedState()
      }

      const connectedPads: ConnectedGamepadCandidate[] = navigator.getGamepads
        ? Array.from(navigator.getGamepads())
          .filter((pad): pad is Gamepad => Boolean(pad && pad.connected))
          .map((pad) => {
            return {
              pad,
              signature: `${pad.index}:${pad.id}`,
              activityScore: scoreConnectedGamepadActivity(pad),
            }
          })
        : []

      const connected = (() => {
        if (connectedPads.length === 0) {
          return null
        }

        const activeSignature = activeGamepadSignatureRef.current
        const currentlyActive = activeSignature
          ? connectedPads.find((candidate) => candidate.signature === activeSignature)
          : null
        const mostActive = connectedPads.reduce((best, candidate) => {
          if (!best || candidate.activityScore > best.activityScore) {
            return candidate
          }

          return best
        }, null as ConnectedGamepadCandidate | null)

        if (mostActive && mostActive.activityScore >= 0.15) {
          return mostActive.pad
        }

        return currentlyActive?.pad ?? connectedPads[0].pad
      })()

      if (!connected) {
        if (activeGamepadSignatureRef.current) {
          activeGamepadSignatureRef.current = null
          setConnectedGamepadFamily(null)
          setConnectedGamepadLabel('')
          clearPressedState()
        }

        return
      }

      const family = detectGamepadFamily(connected.id)
      const label = gamepadFamilyDisplayName(family)
      const signature = `${connected.index}:${connected.id}`
      if (signature !== activeGamepadSignatureRef.current) {
        activeGamepadSignatureRef.current = signature
        setConnectedGamepadFamily(family)
        setConnectedGamepadLabel(label)
        clearPressedState()
      }

      const tuning = GAMEPAD_INPUT_TUNING_BY_FAMILY[family] ?? GAMEPAD_INPUT_TUNING_BY_FAMILY.generic
      const axes = connected.axes ?? []
      const axis0Magnitude = Math.abs(Number.isFinite(axes[0]) ? axes[0] : 0)
      const axis1Magnitude = Math.abs(Number.isFinite(axes[1]) ? axes[1] : 0)
      const neutralMagnitude = Math.max(axis0Magnitude, axis1Magnitude)
      const buttons = connected.buttons ?? []
      const hasStrongButtonInput = buttons.some((button) => Boolean(button?.pressed) || (button?.value ?? 0) >= 0.66)

      const liveCalibration = gamepadLiveCalibrationBySignatureRef.current[signature]
        ?? { ...DEFAULT_GAMEPAD_LIVE_CALIBRATION }

      if (!hasStrongButtonInput && neutralMagnitude <= 0.45) {
        liveCalibration.neutralAxisPeak = Math.max(liveCalibration.neutralAxisPeak * 0.98, neutralMagnitude)
        liveCalibration.sampleCount = Math.min(liveCalibration.sampleCount + 1, 800)
      }

      gamepadLiveCalibrationBySignatureRef.current[signature] = liveCalibration

      const calibratedArmDeadzone = liveCalibration.sampleCount >= 14
        ? Math.max(tuning.axisArmDeadzone, Math.min(0.3, liveCalibration.neutralAxisPeak + 0.06))
        : tuning.axisArmDeadzone

      const calibratedCommitThreshold = Math.min(
        tuning.axisCommitThreshold + 0.06,
        Math.max(
          calibratedArmDeadzone + 0.08,
          tuning.axisCommitThreshold,
        ),
      )

      const calibratedReleaseDeadzone = Math.max(
        0.05,
        Math.min(calibratedArmDeadzone, tuning.axisReleaseDeadzone),
      )

      const effectiveTuning: GamepadInputTuning = {
        ...tuning,
        axisArmDeadzone: calibratedArmDeadzone,
        axisCommitThreshold: calibratedCommitThreshold,
        axisReleaseDeadzone: calibratedReleaseDeadzone,
      }

      const { snapshot: inputSnapshot, axisState } = readGamepadInputSnapshot(
        connected,
        effectiveTuning,
        gamepadAxisStateRef.current,
      )
      gamepadAxisStateRef.current = axisState

      const rightStickDeadzone = Math.max(0.14, Math.min(0.34, effectiveTuning.axisArmDeadzone + 0.04))
      const rightStickAxes = resolveRightStickAxes(axes, rightStickDeadzone)
      const rightStickX = rightStickAxes.x
      const rightStickY = rightStickAxes.y
      const rightStickMagnitude = Math.max(Math.abs(rightStickX), Math.abs(rightStickY))

      const shouldDriveGamepadParallax =
        activeTab === 'launcher'
        && launcherView === 'games'
        && Boolean(focusedGame)
        && !isQuickOverlayOpen

      if (shouldDriveGamepadParallax && focusedGame) {
        if (rightStickMagnitude > 0.001) {
          applyGamepadGridCardParallax(focusedGame.id, rightStickX, rightStickY)
        } else {
          clearGamepadGridCardParallax()
        }
      } else {
        clearGamepadGridCardParallax()
      }

      const hasInput = Object.values(inputSnapshot).some(Boolean)
      if (hasInput) {
        setLauncherInputMode((previous) => (previous === 'gamepad' ? previous : 'gamepad'))
        markGamepadPromptHudActive()
      }


      const binds = activeRuntimeControllerBindings
      const now = Date.now()
      const exclusiveLeftStickNavAction = pickExclusiveStickNavigationAction(inputSnapshot)

      for (const action of CONTROLLER_ACTION_ORDER) {
        const boundInput = binds[action]
        const isPressed = isDirectionalActionPressed(action, boundInput, inputSnapshot)
        const wasPressed = Boolean(gamepadPressedActionsRef.current[action])
        const stickMagnitude = DIRECTIONAL_CONTROLLER_ACTIONS.has(action)
          ? resolveBoundStickMagnitude(boundInput, axes, effectiveTuning, inputSnapshot, action)
          : 0

        if (REPEATABLE_CONTROLLER_ACTIONS.has(action)) {
          const directionalSource = resolveDirectionalInputSource(
            action,
            boundInput,
            inputSnapshot,
          )

          const effectiveStickInput = resolveEffectiveStickInput(boundInput)
          const isLeftStickNavigation = effectiveStickInput.startsWith('left_stick_')
          const shouldSuppressStickRepeat = directionalSource === 'stick'
            && isLeftStickNavigation
            && exclusiveLeftStickNavAction
            && action !== exclusiveLeftStickNavAction

          if (shouldSuppressStickRepeat) {
            gamepadStickNavStateRef.current[action] = { holdStartedAt: 0, holdConfirmed: false, nextRepeatAt: 0 }
            gamepadStickActiveRef.current[action] = false
            gamepadPressedActionsRef.current[action] = isPressed
            continue
          }

          if (directionalSource === 'stick') {
            const isStickActive = isNavigationStickActive(action, inputSnapshot)
            const wasStickActive = Boolean(gamepadStickActiveRef.current[action])

            if (isStickActive && !wasStickActive) {
              triggerNavigationTap(action, now)
            }

            const previousStickState = gamepadStickNavStateRef.current[action] ?? {
              holdStartedAt: 0,
              holdConfirmed: false,
              nextRepeatAt: 0,
            }

            gamepadStickNavStateRef.current[action] = processStickNavigationHold(
              isStickActive,
              stickMagnitude,
              now,
              effectiveTuning,
              previousStickState,
              () => triggerNavigationRepeat(action),
            )
            gamepadStickActiveRef.current[action] = isStickActive
            gamepadActionRepeatAtRef.current[action] = 0
          } else if (directionalSource === 'dpad') {
            const nextRepeatAt = gamepadActionRepeatAtRef.current[action] ?? 0
            const canTrigger = isPressed && (!wasPressed || now >= nextRepeatAt)

            if (canTrigger) {
              triggerControllerAction(action)
              gamepadActionRepeatAtRef.current[action] = now + (
                wasPressed ? effectiveTuning.repeatMinIntervalMs : effectiveTuning.repeatInitialDelayMs
              )
            } else if (!isPressed) {
              gamepadActionRepeatAtRef.current[action] = 0
            }

            gamepadStickNavStateRef.current[action] = { holdStartedAt: 0, holdConfirmed: false, nextRepeatAt: 0 }
            gamepadStickActiveRef.current[action] = false
          } else {
            gamepadActionRepeatAtRef.current[action] = 0
            gamepadStickNavStateRef.current[action] = { holdStartedAt: 0, holdConfirmed: false, nextRepeatAt: 0 }
            gamepadStickActiveRef.current[action] = false
          }
        } else if (isPressed && !wasPressed) {
          triggerControllerAction(action)
        }

        gamepadPressedActionsRef.current[action] = isPressed
      }
    }

    const handleGamepadConnected = (event: Event) => {
      const payload = event as GamepadEvent
      if (!payload.gamepad) {
        return
      }

      activeGamepadSignatureRef.current = `${payload.gamepad.index}:${payload.gamepad.id}`
      const family = detectGamepadFamily(payload.gamepad.id)
      const label = gamepadFamilyDisplayName(family)
      setConnectedGamepadFamily(family)
      setConnectedGamepadLabel(label)
      clearPressedState()
      openGamepadPopup(family, label)
    }

    const handleGamepadDisconnected = () => {
      if (!navigator.getGamepads || Array.from(navigator.getGamepads()).some((pad) => Boolean(pad && pad.connected))) {
        return
      }

      activeGamepadSignatureRef.current = null
      setConnectedGamepadFamily(null)
      setConnectedGamepadLabel('')
      clearGamepadPopupTimers()
      setGamepadPopup(null)
      clearPressedState()
    }

    window.addEventListener('gamepadconnected', handleGamepadConnected)
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected)
    const intervalId = window.setInterval(pollGamepads, GAMEPAD_POLL_INTERVAL_MS)
    pollGamepads()

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('gamepadconnected', handleGamepadConnected)
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected)
    }
  }, [
    activateControllerVirtualKeyboardKey,
    activeCategory,
    activeRuntimeControllerBindings,
    activeTab,
    applyGamepadGridCardParallax,
    backToSystems,
    clearGamepadGridCardParallax,
    clearGamepadPopupTimers,
    closeControllerVirtualKeyboard,
    confirmFocusedGameAction,
    executeQuickOverlayAction,
    enterSystem,
    focusCurrentGameTile,
    focusPrimaryGameAction,
    focusedGame,
    hasActiveExternalSession,
    isControllerVirtualKeyboardOpen,
    isGridView,
    isQuickOverlayOpen,
    isSearchFocused,
    jumpToBottomGame,
    jumpToTopGame,
    launcherView,
    markGamepadPromptHudActive,
    moveControllerVirtualKeyboardCursor,
    moveFocusedGameAction,
    moveFocusedGameInGrid,
    moveFocusedSystemInGrid,
    openGamepadPopup,
    quickOverlayActions,
    quickOverlaySelectionIndex,
    pushGameStackMomentum,
    stepFocusedGame,
    stepSystem,
    switchTab,
    isSystemsGridView,
    systemsGridTiles,
    sortedSystemsSceneCategories,
    openControllerVirtualKeyboard,
    openFunctionsFindPanel,
    openFunctionsLibraryPanel,
    openFunctionsSearch,
    playSettingsSound,
    setActiveCategory,
    toggleProfileRail,
    toggleGamesViewMode,
    toggleSystemsViewMode,
  ])

  const editingCustomSystem = useMemo(() => {
    if (!editingCustomSystemId) {
      return null
    }

    return customSystems.find((system) => system.id === editingCustomSystemId) ?? null
  }, [customSystems, editingCustomSystemId])

  const setGameAssignmentForCustomSystem = useCallback((systemKey: string, gameId: string, assigned: boolean) => {
    if (!systemKey || !gameId) {
      return
    }

    setCustomSystemAssignmentsBySystemKey((previous) => {
      const existing = new Set(previous[systemKey] ?? [])
      if (assigned) {
        existing.add(gameId)
      } else {
        existing.delete(gameId)
      }

      const next = { ...previous }
      if (existing.size === 0) {
        delete next[systemKey]
      } else {
        next[systemKey] = Array.from(existing)
      }

      return next
    })
  }, [])

  const setCustomSystemAutoSortExclusions = useCallback((systemKey: string, gameIds: string[], excluded: boolean) => {
    if (!systemKey || gameIds.length === 0) {
      return
    }

    setCustomSystemAutoSortExclusionsBySystemKey((previous) => {
      const existing = new Set(previous[systemKey] ?? [])
      let changed = false

      for (const gameId of gameIds) {
        if (!gameId) {
          continue
        }

        if (excluded) {
          if (!existing.has(gameId)) {
            existing.add(gameId)
            changed = true
          }
        } else if (existing.has(gameId)) {
          existing.delete(gameId)
          changed = true
        }
      }

      if (!changed) {
        return previous
      }

      const next = { ...previous }
      if (existing.size === 0) {
        delete next[systemKey]
      } else {
        next[systemKey] = Array.from(existing)
      }

      return next
    })
  }, [])

  const addExecutableForAddGamesTarget = useCallback(() => {
    void (async () => {
      const added = await addExecutable()
      if (!added) {
        return
      }

      if (customSystemKeySet.has(addGamesTargetSystemKey)) {
        setLibrary((previous) => previous.map((entry) => (
          entry.id === added.gameId
            ? { ...entry, manualSystemKey: addGamesTargetSystemKey }
            : entry
        )))
        setGameAssignmentForCustomSystem(addGamesTargetSystemKey, added.gameId, true)
        setCustomSystemAutoSortExclusions(addGamesTargetSystemKey, [added.gameId], false)
        const systemName = customSystemByKey[addGamesTargetSystemKey]?.name ?? addGamesTargetSystemKey
        setStatus(
          added.warning
            ? `Added ${added.title} to ${systemName}. ${added.warning}`
            : `Added ${added.title} to ${systemName}.`,
        )
        return
      }

      if (addGamesTargetSystemKey) {
        setLibrary((previous) => previous.map((entry) => (
          entry.id === added.gameId
            ? { ...entry, manualSystemKey: addGamesTargetSystemKey }
            : entry
        )))
        setStatus(
          added.warning
            ? `Added ${added.title}. ${added.warning}`
            : `Added ${added.title}. Pick a custom system to assign it.`,
        )
        return
      }

      setStatus(
        added.warning
          ? `Added ${added.title}. ${added.warning}`
          : `Added ${added.title}. Pick a custom system to assign it.`,
      )
    })()
  }, [
    addExecutable,
    addGamesTargetSystemKey,
    customSystemByKey,
    customSystemKeySet,
    setCustomSystemAutoSortExclusions,
    setGameAssignmentForCustomSystem,
    setLibrary,
    setStatus,
  ])

  const closeAddGamesModal = useCallback(() => {
    setDebugSystemImportKey('')
    setIsCollageStudioOpen(false)
    setActiveCollageStudioDraft(null)
    setCollageStudioSelectedLayerId('')
    setCollageStudioLivePreviewDataUrl('')
    setCollageStudioEditingTextTarget(null)
    collageStudioCanvasPointerIdRef.current = null
    collageStudioActiveStrokeRef.current = null
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
    setIsAddGamesModalOpen(false)
    setAddGamesSelectedIds([])
    setRomImportSelectedIds([])
    setRomImportFocusedId('')
    addGamesDropDepthRef.current = 0
    romDropDepthRef.current = 0
    setIsAddGamesDropActive(false)
    setIsRomDropActive(false)
    setIsAddGamesFileDragActive(false)
    setAllowLowConfidenceImports(false)
    setIsCustomSystemCreateMode(false)
  }, [])

  const resolveDroppedRomDirectories = useCallback((droppedPaths: string[]): string[] => {
    const directoryCandidates = new Set<string>()

    for (const path of droppedPaths) {
      const normalized = normalizeDroppedPath(path)
      if (!normalized) {
        continue
      }

      const extension = romExtensionFromPath(normalized)
      if (extension && KNOWN_ROM_EXTENSIONS.has(extension)) {
        const parent = parentDirFromPath(normalized)
        if (parent) {
          directoryCandidates.add(parent)
        }
        continue
      }

      if (!extension && isDirectoryLikeDroppedPath(normalized)) {
        directoryCandidates.add(normalized)
      }
    }

    if (directoryCandidates.size === 0) {
      return []
    }

    const normalizedExisting = new Set(
      romDirsText
        .split(/\r?\n/)
        .map((entry) => normalizeDroppedPath(entry).toLowerCase())
        .filter(Boolean),
    )

    const additions = Array.from(directoryCandidates).filter((entry) => !normalizedExisting.has(entry.toLowerCase()))
    if (additions.length === 0) {
      return []
    }

    return additions
  }, [romDirsText])

  const mergeDroppedRomDirectories = useCallback((droppedPaths: string[]): number => {
    const additions = resolveDroppedRomDirectories(droppedPaths)
    if (additions.length === 0) {
      return 0
    }

    setRomDirsText((previous) => {
      const current = previous
        .split(/\r?\n/)
        .map((entry) => normalizeDroppedPath(entry))
        .filter(Boolean)

      return [...current, ...additions].join('\n')
    })

    return additions.length
  }, [resolveDroppedRomDirectories, setRomDirsText])

  const addDroppedExecutables = useCallback((droppedPaths: string[]): number => {
    const executablePaths = droppedPaths
      .map((entry) => normalizeDroppedPath(entry))
      .filter(Boolean)
      .filter((entry) => DROP_EXECUTABLE_EXTENSIONS.has(romExtensionFromPath(entry)))

    if (executablePaths.length === 0) {
      return 0
    }

    const assignSystemKey = isAddGamesModalOpen && customSystemKeySet.has(addGamesTargetSystemKey)
      ? addGamesTargetSystemKey
      : (customSystemKeySet.has(activeCategory) ? activeCategory : '')
    const manualHomeKey = assignSystemKey || (activeCategory !== 'all' ? activeCategory : undefined)

    const nextEntries: GameEntry[] = []
    setLibrary((previous) => {
      const existingTargets = new Set(previous.map((entry) => entry.target.trim().toLowerCase()))
      const working = [...previous]

      for (const executablePath of executablePaths) {
        const normalizedTarget = executablePath.trim().toLowerCase()
        if (!normalizedTarget || existingTargets.has(normalizedTarget)) {
          continue
        }

        existingTargets.add(normalizedTarget)

        const filename = basenameFromPath(executablePath) || executablePath
        const title = filename.replace(/\.[^.]+$/, '').trim() || filename
        const nextId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `exe_drop_${Date.now()}_${nextEntries.length}`

        const nextEntry: GameEntry = {
          id: nextId,
          title,
          kind: 'executable',
          target: executablePath,
          args: ['--tm-user-added=1', '--tm-source=drop'],
          manualSystemKey: manualHomeKey || undefined,
        }

        nextEntries.push(nextEntry)
        working.push(nextEntry)
      }

      return nextEntries.length > 0 ? working : previous
    })

    if (nextEntries.length > 0 && assignSystemKey) {
      const addedIds = nextEntries.map((entry) => entry.id)
      setCustomSystemAssignmentsBySystemKey((previous) => {
        const existing = new Set(previous[assignSystemKey] ?? [])
        for (const entry of nextEntries) {
          existing.add(entry.id)
        }

        return {
          ...previous,
          [assignSystemKey]: Array.from(existing),
        }
      })
      setCustomSystemAutoSortExclusions(assignSystemKey, addedIds, false)
    }

    return nextEntries.length
  }, [activeCategory, addGamesTargetSystemKey, customSystemKeySet, isAddGamesModalOpen, setCustomSystemAssignmentsBySystemKey, setCustomSystemAutoSortExclusions, setLibrary])

  const buildImportSettingsForRomPreview = useCallback((romDirsOverride?: string[]) => {
    const romDirs = romDirsOverride ?? romDirsText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)

    const customEmulatorPaths = Object.fromEntries(
      Object.entries(emulatorPaths)
        .map(([entryKey, value]) => [entryKey, value.trim()])
        .filter(([, value]) => value.length > 0),
    )

    const customSystemEmulatorMap = Object.fromEntries(
      Object.entries(systemEmulatorMap)
        .map(([systemKey, emulatorKey]) => [systemKey.trim(), emulatorKey])
        .filter(([systemKey]) => systemKey.length > 0),
    ) as Record<string, EmulatorKey>

    return {
      romDirs,
      emulatorPaths: customEmulatorPaths,
      systemEmulatorMap: customSystemEmulatorMap,
    }
  }, [emulatorPaths, romDirsText, systemEmulatorMap])

  const scanRomImportPreview = useCallback((romDirsOverride?: string[]) => {
    if (isRomImportScanning) {
      return
    }

    setIsRomImportScanning(true)
    setStatus('Scanning ROM folders for import preview...')

    void (async () => {
      try {
        const result = await autoImportGamesOrchestrated(buildImportSettingsForRomPreview(romDirsOverride))
        const romCandidates = result.imports
          .filter((item) => item.kind === 'emulator')
          .filter((item) => (managedArgValue(item.args, 'source') ?? '').toLowerCase() === 'rom')

        const existingEntryIdByIdentity = new Map<string, string>()
        for (const entry of library) {
          if (entry.kind !== 'emulator') {
            continue
          }

          const source = (managedArgValue(entry.args, 'source') ?? '').toLowerCase()
          if (source !== 'rom') {
            continue
          }

          const identity = romIdentityKey(entry)
          if (!existingEntryIdByIdentity.has(identity)) {
            existingEntryIdByIdentity.set(identity, entry.id)
          }
        }

        const uniqueCandidates = new Map<string, ImportedGame>()
        for (const item of romCandidates) {
          const normalizedItem: ImportedGame = {
            title: normalizedRomImportTitle(item.title, item.args, romTitleCleanupEnabled),
            kind: item.kind,
            target: item.target,
            args: [...item.args],
            emulatorKey: item.emulatorKey,
            manualSystemKey: item.manualSystemKey,
          }

          const identity = romIdentityKey(normalizedItem)
          if (!uniqueCandidates.has(identity)) {
            uniqueCandidates.set(identity, normalizedItem)
          }
        }

        const rows: RomImportPreviewRow[] = Array.from(uniqueCandidates.values()).map((item, index) => {
          const previewEntry: GameEntry = {
            id: `rom-preview-${index}`,
            title: normalizedRomImportTitle(item.title, item.args, romTitleCleanupEnabled),
            kind: item.kind,
            target: item.target,
            args: [...item.args],
            emulatorKey: item.emulatorKey,
            manualSystemKey: item.manualSystemKey,
          }

          const identity = romIdentityKey(previewEntry)
          const existingEntryId = existingEntryIdByIdentity.get(identity) ?? null
          const profile = (managedArgValue(previewEntry.args, 'profile') ?? '').toLowerCase()
          const romPath = firstManagedLaunchArg(previewEntry.args)
          const unresolved = isPlaceholderTarget(previewEntry.target)
          const duplicate = Boolean(existingEntryId)
          const confidence = resolveRomImportConfidence({
            title: previewEntry.title,
            profile,
            romPath,
            duplicate,
            unresolved,
          })
          const category = getGameCategory(previewEntry)

          return {
            id: `${identity}-${index}`,
            title: previewEntry.title,
            profile,
            profileLabel: romProfileLabel(profile),
            romPath,
            categoryKey: category.key,
            sourceLabel: unresolved ? 'Needs emulator setup' : duplicate ? 'Already in library' : 'Scanned ROM',
            confidence: confidence.confidence,
            confidenceReason: confidence.reason,
            duplicate,
            unresolved,
            existingEntryId,
            candidate: item,
          }
        })

        rows.sort((left, right) => {
          const leftRank = left.unresolved ? 2 : left.duplicate ? 1 : 0
          const rightRank = right.unresolved ? 2 : right.duplicate ? 1 : 0
          if (leftRank !== rightRank) {
            return leftRank - rightRank
          }

          return left.title.localeCompare(right.title, undefined, { sensitivity: 'base', numeric: true })
        })

        setRomImportPreviewRows(rows)
        const defaultSelected = rows
          .filter((row) => !row.duplicate)
          .filter((row) => allowLowConfidenceImports || row.confidence !== 'low')
          .map((row) => row.id)
        setRomImportSelectedIds(defaultSelected)

        const duplicateCount = rows.filter((row) => row.duplicate).length
        const unresolvedCount = rows.filter((row) => row.unresolved).length
        const lowConfidenceCount = rows.filter((row) => row.confidence === 'low').length
        setRomImportSummary(
          `${rows.length} ROM candidates: ${rows.length - duplicateCount - unresolvedCount} new, ${duplicateCount} duplicates, ${unresolvedCount} need setup, ${lowConfidenceCount} low-confidence.`,
        )
        setStatus(`ROM scan complete: ${rows.length} candidates.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setRomImportSummary('Scan failed. Review settings and try again.')
        setStatus(`ROM import preview failed: ${message}`)
      } finally {
        setIsRomImportScanning(false)
      }
    })()
  }, [allowLowConfidenceImports, buildImportSettingsForRomPreview, isRomImportScanning, library, romTitleCleanupEnabled, setStatus])

  const resolveAddGamesTargetSystemKey = useCallback((): string => {
    if (customSystemKeySet.has(activeCategory)) {
      return activeCategory
    }

    return customSystems.find((system) => !system.hidden)?.key ?? ''
  }, [activeCategory, customSystemKeySet, customSystems])

  const openAddGamesModal = useCallback((initialTab: AddGamesTab = 'apps-games') => {
    setAddGamesSearch('')
    setAddGamesFilter('not-in-any-system')
    setAddGamesSelectedIds([])
    setRomImportSelectedIds([])
    setRomImportSearch('')
    setRomImportFilter('all')
    setRomImportFocusedId('')
    setAllowLowConfidenceImports(false)
    setAddGamesTargetSystemKey(resolveAddGamesTargetSystemKey())
    setAddGamesTab(initialTab)
    setIsAddGamesModalOpen(true)

    if (initialTab === 'systems') {
      setManageSystemsEditorTab('basics')
    }

    if (initialTab === 'roms' && romImportPreviewRows.length === 0 && !isRomImportScanning) {
      scanRomImportPreview()
    }
  }, [isRomImportScanning, resolveAddGamesTargetSystemKey, romImportPreviewRows.length, scanRomImportPreview])

  const handleAddGamesDrop = useCallback((droppedPaths: string[]) => {
    if (droppedPaths.length === 0) {
      setStatus('No usable files were detected in this drop.')
      return
    }

    const hasRomLikePaths = droppedPaths.some((entry) => {
      const normalized = normalizeDroppedPath(entry)
      if (!normalized) {
        return false
      }

      const extension = romExtensionFromPath(normalized)
      if (extension && KNOWN_ROM_EXTENSIONS.has(extension)) {
        return true
      }

      return !extension && isDirectoryLikeDroppedPath(normalized)
    })

    const romDirsForDrop = hasRomLikePaths ? resolveDroppedRomDirectories(droppedPaths) : []
    const addedRomDirs = romDirsForDrop.length > 0 ? mergeDroppedRomDirectories(romDirsForDrop) : 0
    const addedExecutables = addDroppedExecutables(droppedPaths)

    if (addedRomDirs > 0) {
      setAddGamesTab('roms')
      setStatus(`Added ${addedRomDirs} ROM folder${addedRomDirs === 1 ? '' : 's'} from drop. Scanning now...`)
      scanRomImportPreview(romDirsForDrop)
      return
    }

    if (addedExecutables > 0) {
      setStatus(`Added ${addedExecutables} executable entr${addedExecutables === 1 ? 'y' : 'ies'} from drop.`)
      setAddGamesTab('apps-games')
      return
    }

    setStatus('Drop did not include supported files. Use EXE/LNK/BAT/CMD/PS1/URL or ROM files/folders.')
  }, [addDroppedExecutables, mergeDroppedRomDirectories, scanRomImportPreview, setStatus])

  const handleAddGamesDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    addGamesDropDepthRef.current += 1
    setIsAddGamesDropActive(true)
  }, [])

  const handleAddGamesDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!isAddGamesDropActive) {
      setIsAddGamesDropActive(true)
    }
  }, [isAddGamesDropActive])

  const handleAddGamesDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    addGamesDropDepthRef.current = Math.max(0, addGamesDropDepthRef.current - 1)
    if (addGamesDropDepthRef.current === 0) {
      setIsAddGamesDropActive(false)
    }
  }, [])

  const handleAddGamesDropEvent = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    addGamesDropDepthRef.current = 0
    setIsAddGamesDropActive(false)
    const droppedPaths = extractDroppedPaths(event.dataTransfer)
    handleAddGamesDrop(droppedPaths)
  }, [handleAddGamesDrop])

  const handleRomDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    romDropDepthRef.current += 1
    setIsRomDropActive(true)
  }, [])

  const handleRomDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (!isRomDropActive) {
      setIsRomDropActive(true)
    }
  }, [isRomDropActive])

  const handleRomDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    romDropDepthRef.current = Math.max(0, romDropDepthRef.current - 1)
    if (romDropDepthRef.current === 0) {
      setIsRomDropActive(false)
    }
  }, [])

  const handleRomDropEvent = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    romDropDepthRef.current = 0
    setIsRomDropActive(false)
    const droppedPaths = extractDroppedPaths(event.dataTransfer)
    handleAddGamesDrop(droppedPaths)
  }, [handleAddGamesDrop])

  const handleAddGamesModalDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    setIsAddGamesFileDragActive(true)
  }, [])

  const handleAddGamesModalDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (!isAddGamesFileDragActive) {
      setIsAddGamesFileDragActive(true)
    }
  }, [isAddGamesFileDragActive])

  const handleAddGamesModalDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    if (event.currentTarget === event.target) {
      setIsAddGamesFileDragActive(false)
    }
  }, [])

  const handleAddGamesModalDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    setIsAddGamesFileDragActive(false)
  }, [])

  const romImportSearchNormalized = useMemo(() => romImportSearch.trim().toLowerCase(), [romImportSearch])

  const activeRomImportCategoryFilter = useMemo(() => {
    return Object.prototype.hasOwnProperty.call(SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY, activeCategory)
      ? activeCategory
      : 'all'
  }, [activeCategory])

  const romImportVisibleRows = useMemo(() => {
    return romImportPreviewRows.filter((row) => {
      if (activeRomImportCategoryFilter !== 'all' && row.categoryKey !== activeRomImportCategoryFilter) {
        return false
      }

      if (romImportFilter === 'new' && (row.duplicate || row.unresolved)) {
        return false
      }

      if (romImportFilter === 'duplicates' && !row.duplicate) {
        return false
      }

      if (romImportFilter === 'unresolved' && !row.unresolved) {
        return false
      }

      if (romImportFilter === 'low-confidence' && row.confidence !== 'low') {
        return false
      }

      if (!romImportSearchNormalized) {
        return true
      }

      const haystack = `${row.title} ${row.profileLabel} ${row.romPath} ${row.sourceLabel}`.toLowerCase()
      return haystack.includes(romImportSearchNormalized)
    })
  }, [activeRomImportCategoryFilter, romImportFilter, romImportPreviewRows, romImportSearchNormalized])

  const romImportVisibleRowIds = useMemo(() => romImportVisibleRows.map((row) => row.id), [romImportVisibleRows])
  const romImportCounts = useMemo(() => {
    const total = romImportPreviewRows.length
    const duplicates = romImportPreviewRows.filter((row) => row.duplicate).length
    const unresolved = romImportPreviewRows.filter((row) => row.unresolved).length
    const lowConfidence = romImportPreviewRows.filter((row) => row.confidence === 'low').length
    const fresh = total - duplicates - unresolved

    return {
      total,
      fresh,
      duplicates,
      unresolved,
      lowConfidence,
    }
  }, [romImportPreviewRows])

  const romImportSelectableVisibleCount = useMemo(
    () => romImportVisibleRows.filter((row) => allowLowConfidenceImports || row.confidence !== 'low').length,
    [allowLowConfidenceImports, romImportVisibleRows],
  )

  const romImportSelectedVisibleCount = useMemo(() => {
    if (romImportSelectedIds.length === 0 || romImportVisibleRowIds.length === 0) {
      return 0
    }

    const selectedSet = new Set(romImportSelectedIds)
    let count = 0
    for (const row of romImportVisibleRows) {
      if (!allowLowConfidenceImports && row.confidence === 'low') {
        continue
      }

      if (selectedSet.has(row.id)) {
        count += 1
      }
    }

    return count
  }, [allowLowConfidenceImports, romImportSelectedIds, romImportVisibleRowIds.length, romImportVisibleRows])

  const romImportAllVisibleSelected = romImportSelectableVisibleCount > 0
    && romImportSelectedVisibleCount >= romImportSelectableVisibleCount

  const romImportBlockedLowVisibleCount = useMemo(() => {
    if (allowLowConfidenceImports) {
      return 0
    }

    return romImportVisibleRows.filter((row) => row.confidence === 'low').length
  }, [allowLowConfidenceImports, romImportVisibleRows])

  const romImportFocusedRow = useMemo(() => {
    if (romImportVisibleRows.length === 0) {
      return null
    }

    if (romImportFocusedId) {
      const focused = romImportVisibleRows.find((row) => row.id === romImportFocusedId)
      if (focused) {
        return focused
      }
    }

    if (romImportSelectedIds.length > 0) {
      const selected = romImportVisibleRows.find((row) => romImportSelectedIds.includes(row.id))
      if (selected) {
        return selected
      }
    }

    return romImportVisibleRows[0]
  }, [romImportFocusedId, romImportSelectedIds, romImportVisibleRows])

  useEffect(() => {
    if (romImportVisibleRows.length === 0) {
      if (romImportFocusedId) {
        setRomImportFocusedId('')
      }
      return
    }

    if (!romImportFocusedId || !romImportVisibleRows.some((row) => row.id === romImportFocusedId)) {
      setRomImportFocusedId(romImportVisibleRows[0].id)
    }
  }, [romImportFocusedId, romImportVisibleRows])

  useEffect(() => {
    if (allowLowConfidenceImports) {
      return
    }

    setRomImportSelectedIds((previous) => {
      const blocked = new Set(
        romImportPreviewRows
          .filter((row) => row.confidence === 'low')
          .map((row) => row.id),
      )

      if (blocked.size === 0) {
        return previous
      }

      const next = previous.filter((id) => !blocked.has(id))
      return next.length === previous.length ? previous : next
    })
  }, [allowLowConfidenceImports, romImportPreviewRows])

  const toggleRomImportSelection = useCallback((rowId: string, checked: boolean) => {
    let didChange = false
    setRomImportSelectedIds((previous) => {
      const row = romImportPreviewRows.find((candidate) => candidate.id === rowId)
      if (!row) {
        return previous
      }

      if (!allowLowConfidenceImports && row.confidence === 'low') {
        return previous
      }

      if (checked) {
        if (previous.includes(rowId)) {
          return previous
        }

        didChange = true
        return [...previous, rowId]
      }

      if (!previous.includes(rowId)) {
        return previous
      }

      didChange = true
      return previous.filter((id) => id !== rowId)
    })

    if (didChange) {
      playSettingsSound('switchOption')
    }
  }, [allowLowConfidenceImports, playSettingsSound, romImportPreviewRows])

  const toggleSelectAllVisibleRomRows = useCallback((checked: boolean) => {
    setRomImportSelectedIds((previous) => {
      const visibleSet = new Set(romImportVisibleRowIds)
      if (checked) {
        const next = new Set(previous)
        for (const row of romImportVisibleRows) {
          if (!allowLowConfidenceImports && row.confidence === 'low') {
            continue
          }

          next.add(row.id)
        }

        return Array.from(next)
      }

      return previous.filter((id) => !visibleSet.has(id))
    })
  }, [allowLowConfidenceImports, romImportVisibleRowIds, romImportVisibleRows])

  const clearRomImportSelection = useCallback(() => {
    setRomImportSelectedIds([])
  }, [])

  const importSelectedRomPreviewRows = useCallback(() => {
    if (romImportSelectedIds.length === 0) {
      setStatus('Select one or more ROMs from the gallery first.')
      return
    }

    const selectedIdSet = new Set(romImportSelectedIds)
    const selectedRows = romImportPreviewRows.filter((row) => selectedIdSet.has(row.id))
    if (selectedRows.length === 0) {
      setStatus('No matching ROM rows were selected.')
      return
    }

    let added = 0
    let skipped = 0
    let unresolvedAdded = 0
    let duplicateSkipped = 0
    let lowConfidenceSkipped = 0
    const addedIds: string[] = []

    setLibrary((previous) => {
      const seenIdentity = new Set(previous.map((entry) => romIdentityKey(entry)))
      const additions: GameEntry[] = []

      for (const row of selectedRows) {
        if (!allowLowConfidenceImports && row.confidence === 'low') {
          lowConfidenceSkipped += 1
          skipped += 1
          continue
        }

        if (row.unresolved) {
          unresolvedAdded += 1
        }

        const normalizedCandidate: GameEntry = {
          id: '',
          title: normalizedRomImportTitle(row.candidate.title, row.candidate.args, romTitleCleanupEnabled),
          kind: row.candidate.kind,
          target: row.candidate.target,
          args: [...row.candidate.args],
          emulatorKey: row.candidate.emulatorKey,
          manualSystemKey: row.candidate.manualSystemKey,
        }

        const identity = romIdentityKey(normalizedCandidate)
        if (seenIdentity.has(identity)) {
          duplicateSkipped += 1
          skipped += 1
          continue
        }

        seenIdentity.add(identity)

        const nextId = crypto.randomUUID()
        additions.push({
          ...normalizedCandidate,
          id: nextId,
          manualSystemKey: activeCategory !== 'all' ? activeCategory : normalizedCandidate.manualSystemKey,
        })
        addedIds.push(nextId)
      }

      added = additions.length
      return additions.length > 0 ? [...additions, ...previous] : previous
    })

    if (addedIds.length > 0) {
      if (customSystemKeySet.has(activeCategory)) {
        setCustomSystemAssignmentsBySystemKey((previous) => {
          const next = { ...previous }
          const assigned = new Set(next[activeCategory] ?? [])
          for (const gameId of addedIds) {
            assigned.add(gameId)
          }
          next[activeCategory] = Array.from(assigned)
          return next
        })
        setCustomSystemAutoSortExclusions(activeCategory, addedIds, false)
      }

      setCoverArtStatusByGame((previous) => {
        const next = { ...previous }
        let changed = false
        for (const gameId of addedIds) {
          if (next[gameId] === 'pending' || next[gameId] === 'success') {
            continue
          }

          next[gameId] = 'pending'
          changed = true
        }

        return changed ? next : previous
      })
    }

    setRomImportSelectedIds((previous) => previous.filter((id) => !selectedIdSet.has(id)))

    setStatus(
      `ROM import complete: added ${added}${unresolvedAdded > 0 ? ` (${unresolvedAdded} need emulator setup)` : ''}, skipped ${skipped}${duplicateSkipped > 0 ? ` (${duplicateSkipped} duplicates)` : ''}${lowConfidenceSkipped > 0 ? ` (${lowConfidenceSkipped} low-confidence blocked)` : ''}.`,
    )

    scanRomImportPreview()
  }, [
    activeCategory,
    allowLowConfidenceImports,
    customSystemKeySet,
    romImportPreviewRows,
    romTitleCleanupEnabled,
    romImportSelectedIds,
    scanRomImportPreview,
    setCoverArtStatusByGame,
    setCustomSystemAutoSortExclusions,
    setLibrary,
    setStatus,
  ])

  const addGamesTargetAssignedSet = useMemo(() => {
    if (!customSystemKeySet.has(addGamesTargetSystemKey)) {
      return new Set<string>()
    }

    const normalizedKey = addGamesTargetSystemKey.trim().toLowerCase()
    const assigned = new Set(effectiveCustomSystemAssignmentsBySystemKey[addGamesTargetSystemKey] ?? [])

    for (const entry of library) {
      if (entry.kind === 'executable' && (entry.manualSystemKey ?? '').trim().toLowerCase() === normalizedKey) {
        assigned.add(entry.id)
      }

      const categoryKey = getGameCategory(entry).key.toLowerCase()
      if (categoryKey === normalizedKey) {
        assigned.add(entry.id)
      }
    }

    return assigned
  }, [addGamesTargetSystemKey, customSystemKeySet, effectiveCustomSystemAssignmentsBySystemKey, library])

  const addGamesTargetSystems = useMemo(() => {
    return customSystems
      .filter((system) => !system.hidden)
      .map((system) => ({
        key: system.key,
        label: system.name,
        shortLabel: system.shortLabel,
        logoPath: system.iconPath,
        collageDataUrl: system.collageDataUrl || undefined,
        accentPrimary: normalizeHexColor(system.accentPrimary, DEFAULT_CUSTOM_SYSTEM_PRIMARY),
        accentSecondary: normalizeHexColor(system.accentSecondary, DEFAULT_CUSTOM_SYSTEM_SECONDARY),
      }))
  }, [customSystems])

  const addGamesTargetSystemLabel = useMemo(() => {
    return customSystemByKey[addGamesTargetSystemKey]?.name ?? 'Select a system'
  }, [addGamesTargetSystemKey, customSystemByKey])

  const assignedToAnyCustomSystemSet = useMemo(() => {
    const ids = new Set<string>()
    for (const gameIds of Object.values(effectiveCustomSystemAssignmentsBySystemKey)) {
      for (const gameId of gameIds) {
        ids.add(gameId)
      }
    }

    for (const entry of library) {
      if (entry.kind === 'executable' && (entry.manualSystemKey ?? '').trim().toLowerCase().startsWith('custom-')) {
        ids.add(entry.id)
      }
    }

    return ids
  }, [effectiveCustomSystemAssignmentsBySystemKey, library])

  const addGamesSearchNormalized = useMemo(() => addGamesSearch.trim().toLowerCase(), [addGamesSearch])

  const addGamesLibraryEntries = useMemo(() => {
    let rows = [...library]

    if (addGamesFilter === 'not-in-any-system') {
      rows = rows.filter((entry) => entry.kind === 'executable' && !assignedToAnyCustomSystemSet.has(entry.id))
    } else if (addGamesFilter === 'in-target-system') {
      rows = customSystemKeySet.has(addGamesTargetSystemKey)
        ? rows.filter((entry) => addGamesTargetAssignedSet.has(entry.id))
        : []
    } else if (addGamesFilter === 'user-added-exes') {
      rows = rows.filter((entry) => isUserAddedExecutable(entry))
    }

    if (addGamesSearchNormalized) {
      rows = rows.filter((entry) => {
        const haystack = `${entry.title} ${entry.target} ${entry.kind}`.toLowerCase()
        return haystack.includes(addGamesSearchNormalized)
      })
    }

    rows.sort((left, right) => {
      const leftAdded = gameMetaById[left.id]?.addedAt ?? 0
      const rightAdded = gameMetaById[right.id]?.addedAt ?? 0
      return rightAdded - leftAdded
    })

    return rows
  }, [addGamesFilter, addGamesSearchNormalized, addGamesTargetAssignedSet, addGamesTargetSystemKey, assignedToAnyCustomSystemSet, customSystemKeySet, gameMetaById, library])

  const addGamesLibraryEntryRows = useMemo(() => {
    return addGamesLibraryEntries.map((entry) => {
      const category = getGameCategory(entry)
      return {
        entry,
        cover: customCoverByGame[entry.id] || coverArtThumbByGame[entry.id] || coverArtByGame[entry.id] || '',
        sourceCategoryLabel: category.label,
        sourceCategoryLogoPath: category.logoPath,
        alreadyInSystem: addGamesTargetAssignedSet.has(entry.id),
        checked: addGamesSelectedIds.includes(entry.id),
      }
    })
  }, [
    addGamesLibraryEntries,
    addGamesSelectedIds,
    addGamesTargetAssignedSet,
    coverArtByGame,
    coverArtThumbByGame,
    customCoverByGame,
  ])

  const romImportCoverByEntryId = useMemo(() => ({
    ...coverArtByGame,
    ...coverArtThumbByGame,
    ...customCoverByGame,
  }), [coverArtByGame, coverArtThumbByGame, customCoverByGame])

  const toggleAddGamesSelection = useCallback((gameId: string, checked: boolean) => {
    setAddGamesSelectedIds((previous) => {
      if (checked) {
        if (previous.includes(gameId)) {
          return previous
        }

        return [...previous, gameId]
      }

      return previous.filter((id) => id !== gameId)
    })
  }, [])

  const clearAddGamesSelection = useCallback(() => {
    setAddGamesSelectedIds([])
  }, [])

  const allAddGamesVisibleSelected = useMemo(() => {
    if (addGamesLibraryEntries.length === 0) {
      return false
    }

    return addGamesLibraryEntries.every((entry) => addGamesSelectedIds.includes(entry.id))
  }, [addGamesLibraryEntries, addGamesSelectedIds])

  const toggleAddGamesSelectAllVisible = useCallback((selectAll: boolean) => {
    if (selectAll) {
      setAddGamesSelectedIds(addGamesLibraryEntries.map((entry) => entry.id))
      return
    }

    const visibleIdSet = new Set(addGamesLibraryEntries.map((entry) => entry.id))
    setAddGamesSelectedIds((previous) => previous.filter((gameId) => !visibleIdSet.has(gameId)))
  }, [addGamesLibraryEntries])

  const pulseAddGamesAssignmentFlash = useCallback((gameIds: string[], flash: 'add' | 'remove') => {
    if (gameIds.length === 0) {
      return
    }

    setAddGamesAssignmentFlash((previous) => {
      const next = { ...previous }
      gameIds.forEach((gameId) => {
        next[gameId] = flash
      })
      return next
    })

    window.setTimeout(() => {
      setAddGamesAssignmentFlash((previous) => {
        const next = { ...previous }
        gameIds.forEach((gameId) => {
          delete next[gameId]
        })
        return next
      })
    }, 780)
  }, [])

  const assignGamesToAddGamesTarget = useCallback((gameIds: string[], assigned: boolean): boolean => {
    if (!customSystemKeySet.has(addGamesTargetSystemKey)) {
      setStatus('Pick a custom system first.')
      return false
    }

    if (gameIds.length === 0) {
      return false
    }

    gameIds.forEach((gameId) => {
      setGameAssignmentForCustomSystem(addGamesTargetSystemKey, gameId, assigned)
    })

    const targetSystem = customSystemByKey[addGamesTargetSystemKey]
    if (assigned) {
      setCustomSystemAutoSortExclusions(addGamesTargetSystemKey, gameIds, false)
    } else if (targetSystem?.ingestionMode === 'smart') {
      setCustomSystemAutoSortExclusions(addGamesTargetSystemKey, gameIds, true)
    }

    setLibrary((previous) => {
      let changed = false
      const next = previous.map((entry) => {
        if (!gameIds.includes(entry.id) || !isUserAddedExecutable(entry)) {
          return entry
        }

        if (assigned) {
          if ((entry.manualSystemKey ?? '').trim().toLowerCase() === addGamesTargetSystemKey.toLowerCase()) {
            return entry
          }

          changed = true
          return { ...entry, manualSystemKey: addGamesTargetSystemKey }
        }

        if ((entry.manualSystemKey ?? '').trim().toLowerCase() !== addGamesTargetSystemKey.toLowerCase()) {
          return entry
        }

        changed = true
        return { ...entry, manualSystemKey: undefined }
      })

      return changed ? next : previous
    })

    const systemName = customSystemByKey[addGamesTargetSystemKey]?.name ?? addGamesTargetSystemKey
    setStatus(
      `${assigned ? 'Added' : 'Removed'} ${gameIds.length} game${gameIds.length === 1 ? '' : 's'} ${assigned ? 'to' : 'from'} ${systemName}.`,
    )
    pulseAddGamesAssignmentFlash(gameIds, assigned ? 'add' : 'remove')
    playSettingsSound('switchOption')
    return true
  }, [
    addGamesTargetSystemKey,
    customSystemByKey,
    customSystemKeySet,
    playSettingsSound,
    pulseAddGamesAssignmentFlash,
    setCustomSystemAutoSortExclusions,
    setGameAssignmentForCustomSystem,
    setLibrary,
    setStatus,
  ])

  const applyAddGamesSelection = useCallback((assigned: boolean) => {
    if (addGamesSelectedIds.length === 0) {
      setStatus('Select one or more games first.')
      return
    }

    assignGamesToAddGamesTarget(addGamesSelectedIds, assigned)
  }, [addGamesSelectedIds, assignGamesToAddGamesTarget, setStatus])

  const normalizedManageSystemsSearch = useMemo(() => manageSystemsSearch.trim().toLowerCase(), [manageSystemsSearch])

  const manageSystemsVisibleList = useMemo(() => {
    return customSystems.filter((system) => {
      if (isFactorySystemKey(system.key)) {
        return false
      }

      if (manageSystemsFilter === 'hidden') {
        if (!system.hidden) {
          return false
        }
      } else if (manageSystemsFilter === 'auto-sort') {
        if (system.ingestionMode !== 'smart') {
          return false
        }
      } else if (system.hidden) {
        return false
      }

      if (!normalizedManageSystemsSearch) {
        return true
      }

      const haystack = `${system.name} ${system.key}`.toLowerCase()
      return haystack.includes(normalizedManageSystemsSearch)
    })
  }, [customSystems, manageSystemsFilter, normalizedManageSystemsSearch])

  const hiddenCustomSystemCount = useMemo(
    () => customSystems.reduce((count, system) => (system.hidden ? count + 1 : count), 0),
    [customSystems],
  )

  const autoSortCustomSystemCount = useMemo(
    () => customSystems.reduce((count, system) => (system.ingestionMode === 'smart' ? count + 1 : count), 0),
    [customSystems],
  )

  const debugSystemImportOptions = useMemo(() => {
    const importedByName = new Set(customSystems.map((system) => system.name.trim().toLowerCase()))

    return DEBUG_SYSTEM_IMPORT_PRESETS.map((preset) => ({
      ...preset,
      alreadyImported: importedByName.has(preset.name.trim().toLowerCase()),
    }))
  }, [customSystems])

  const selectedDebugSystemImportPreset = useMemo(() => {
    return debugSystemImportOptions.find((preset) => preset.key === debugSystemImportKey) ?? null
  }, [debugSystemImportKey, debugSystemImportOptions])

  useEffect(() => {
    if (!isAddGamesModalOpen || addGamesTab !== 'systems') {
      return
    }

    const hasUnsavedDraft = Boolean(
      sanitizeCustomSystemName(customSystemDraft.name)
      || customSystemDraft.iconPath.trim()
      || customSystemDraft.collageDataUrl.trim()
      || customSystemDraft.description.trim()
      || customSystemDraft.includeSourcesText.trim()
      || customSystemDraft.includePathHintsText.trim()
      || customSystemDraft.includeExtensionsText.trim()
      || customSystemDraft.ingestionMode !== 'manual',
    )

    if (editingCustomSystemId) {
      const exists = customSystems.some((system) => system.id === editingCustomSystemId)
      if (!exists) {
        setEditingCustomSystemId(null)
      }
      return
    }

    if (hasUnsavedDraft || isCustomSystemCreateMode) {
      return
    }

    if (manageSystemsVisibleList.length > 0) {
      setEditingCustomSystemId(manageSystemsVisibleList[0].id)
      setCustomSystemDraft(toCustomSystemDraft(manageSystemsVisibleList[0]))
    }
  }, [
    addGamesTab,
    customSystemDraft,
    customSystems,
    editingCustomSystemId,
    isAddGamesModalOpen,
    isCustomSystemCreateMode,
    manageSystemsVisibleList,
  ])

  useEffect(() => {
    if (!editingCustomSystemId || editingCustomSystem) {
      return
    }

    setEditingCustomSystemId(null)
    setCustomSystemDraft(createEmptyCustomSystemDraft())
  }, [editingCustomSystem, editingCustomSystemId])

  const customSystemNameError = useMemo(() => {
    const normalizedName = sanitizeCustomSystemName(customSystemDraft.name)
    if (!normalizedName) {
      return 'System name is required.'
    }

    const rawKeyCandidate = buildCustomSystemKey(normalizedName, new Set())
    if (BUILT_IN_SYSTEM_CATEGORY_KEYS.has(rawKeyCandidate)) {
      return `"${normalizedName}" is a built-in system name. Choose a different custom system name.`
    }

    const duplicate = customSystems.some((system) => {
      if (editingCustomSystemId && system.id === editingCustomSystemId) {
        return false
      }

      return system.name.trim().toLowerCase() === normalizedName.toLowerCase()
    })

    if (duplicate) {
      return 'Another custom system already uses this name.'
    }

    return null
  }, [customSystemDraft.name, customSystems, editingCustomSystemId])

  const customSystemPreviewKey = useMemo(() => {
    if (editingCustomSystem) {
      return editingCustomSystem.key
    }

    const candidateName = sanitizeCustomSystemName(customSystemDraft.name) || 'system'
    return buildCustomSystemKey(candidateName, new Set(reservedSystemKeys))
  }, [customSystemDraft.name, editingCustomSystem, reservedSystemKeys])

  const customSystemPreviewShortLabel = useMemo(() => {
    const normalizedName = sanitizeCustomSystemName(customSystemDraft.name)
    if (!normalizedName) {
      return 'C'
    }

    return deriveCustomSystemShortLabel(normalizedName)
  }, [customSystemDraft.name])

  const customSystemDraftDisplayName = useMemo(() => {
    return sanitizeCustomSystemName(customSystemDraft.name) || 'New System'
  }, [customSystemDraft.name])

  const customSystemDraftPrimaryColor = useMemo(() => {
    return normalizeHexColor(customSystemDraft.accentPrimary, DEFAULT_CUSTOM_SYSTEM_PRIMARY)
  }, [customSystemDraft.accentPrimary])

  const customSystemDraftSecondaryColor = useMemo(() => {
    return normalizeHexColor(customSystemDraft.accentSecondary, DEFAULT_CUSTOM_SYSTEM_SECONDARY)
  }, [customSystemDraft.accentSecondary])

  const addGamesModalStyle = useMemo((): CSSProperties => {
    const target = addGamesTargetSystems.find((system) => system.key === addGamesTargetSystemKey)
    const primary = target?.accentPrimary ?? DEFAULT_CUSTOM_SYSTEM_PRIMARY
    const secondary = target?.accentSecondary ?? DEFAULT_CUSTOM_SYSTEM_SECONDARY

    return {
      '--custom-system-accent-primary': primary,
      '--custom-system-accent-secondary': secondary,
    } as CSSProperties
  }, [addGamesTargetSystemKey, addGamesTargetSystems])

  const customSystemsHubStyle = useMemo((): CSSProperties => {
    return {
      '--custom-system-accent-primary': customSystemDraftPrimaryColor,
      '--custom-system-accent-secondary': customSystemDraftSecondaryColor,
    } as CSSProperties
  }, [customSystemDraftPrimaryColor, customSystemDraftSecondaryColor])

  const libraryPanelStyle = useMemo((): CSSProperties => {
    if (addGamesTab === 'systems') {
      return customSystemsHubStyle
    }

    return addGamesModalStyle
  }, [addGamesModalStyle, addGamesTab, customSystemsHubStyle])

  const isCustomSystemDraftDirty = useMemo(() => {
    return Boolean(
      sanitizeCustomSystemName(customSystemDraft.name)
      || customSystemDraft.iconPath.trim()
      || customSystemDraft.collageDataUrl.trim()
      || customSystemDraft.description.trim()
      || customSystemDraft.includeSourcesText.trim()
      || customSystemDraft.includePathHintsText.trim()
      || customSystemDraft.includeExtensionsText.trim()
      || customSystemDraft.ingestionMode !== 'manual',
    )
  }, [customSystemDraft])

  useEffect(() => {
    const normalizedName = sanitizeCustomSystemName(customSystemDraft.name).toLowerCase()
    if (!normalizedName.includes('cozy')) {
      hasAppliedCozySuggestionRef.current = false
      return
    }

    if (hasAppliedCozySuggestionRef.current) {
      return
    }

    const hasExistingRules = Boolean(
      customSystemDraft.includeSourcesText.trim()
      || customSystemDraft.includePathHintsText.trim()
      || customSystemDraft.includeExtensionsText.trim(),
    )
    if (hasExistingRules) {
      hasAppliedCozySuggestionRef.current = true
      return
    }

    setCustomSystemDraft((previous) => ({
      ...previous,
      ingestionMode: 'smart',
      includeSourcesText: joinMultilineValues(['steam']),
      includePathHintsText: joinMultilineValues(['cozy', 'farm', 'story', 'life-sim']),
      includeExtensionsText: joinMultilineValues(['exe']),
    }))
    hasAppliedCozySuggestionRef.current = true
    setStatus('Applied cozy smart-rule suggestions. You can edit them in Rules.')
  }, [
    customSystemDraft.includeExtensionsText,
    customSystemDraft.includePathHintsText,
    customSystemDraft.includeSourcesText,
    customSystemDraft.name,
    setStatus,
  ])

  const collageStudioSelectedLayer = useMemo(() => {
    if (!activeCollageStudioDraft) {
      return null
    }

    return activeCollageStudioDraft.layers.find((layer) => layer.id === collageStudioSelectedLayerId)
      ?? activeCollageStudioDraft.layers[0]
      ?? null
  }, [activeCollageStudioDraft, collageStudioSelectedLayerId])

  const collageStudioBackgroundLayer = useMemo(() => {
    return activeCollageStudioDraft?.layers.find((layer) => layer.kind === 'background') ?? null
  }, [activeCollageStudioDraft])

  const collageStudioLogoLayer = useMemo(() => {
    return activeCollageStudioDraft?.layers.find((layer) => layer.kind === 'logo') ?? null
  }, [activeCollageStudioDraft])

  const isCollageStudioBackgroundVisible = collageStudioBackgroundLayer?.visible ?? true
  const isCollageStudioLogoVisible = collageStudioLogoLayer?.visible ?? true
  const collageStudioPreviewBackgroundDataUrl = isCollageStudioBackgroundVisible
    ? activeCollageStudioDraft?.backgroundDataUrl.trim() ?? ''
    : ''
  const collageStudioPreviewLogoPath = isCollageStudioLogoVisible
    ? customSystemDraft.iconPath.trim()
    : ''
  const collageStudioPreviewCollageDataUrl = collageStudioLivePreviewDataUrl || collageStudioPreviewBackgroundDataUrl
  const collageStudioCanUndoDraw = useMemo(() => {
    if (!activeCollageStudioDraft) {
      return false
    }

    return activeCollageStudioDraft.layers.some((layer) => layer.kind === 'draw' && (layer.strokes?.length ?? 0) > 0)
  }, [activeCollageStudioDraft])
  const isCollageStudioDrawLayerSelected = collageStudioSelectedLayer?.kind === 'draw'

  const collageStudioVisibleInteractiveLayers = useMemo(() => {
    if (!activeCollageStudioDraft) {
      return []
    }

    return activeCollageStudioDraft.layers
      .filter((layer) => layer.visible && layer.kind !== 'background' && layer.kind !== 'logo')
  }, [activeCollageStudioDraft])

  const getCollageStudioRelativePoint = useCallback((event: PointerEvent<HTMLElement>): CollageStudioPoint | null => {
    const bounds = (collageStudioCanvasShellRef.current ?? event.currentTarget).getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null
    }

    return {
      x: clampCollageStudioCoord((event.clientX - bounds.left) / bounds.width),
      y: clampCollageStudioCoord((event.clientY - bounds.top) / bounds.height),
    }
  }, [])

  useEffect(() => {
    if (!activeCollageStudioDraft) {
      collageStudioLivePreviewTokenRef.current += 1
      setCollageStudioLivePreviewDataUrl('')
      return
    }

    const previewToken = collageStudioLivePreviewTokenRef.current + 1
    collageStudioLivePreviewTokenRef.current = previewToken
    const snapshot: CollageStudioDraft = {
      ...activeCollageStudioDraft,
      layers: ensureCollageStudioBaseLayers(activeCollageStudioDraft.layers),
    }

    void (async () => {
      try {
        const nextPreviewDataUrl = await renderCollageStudioDraftToDataUrl(snapshot)
        if (previewToken !== collageStudioLivePreviewTokenRef.current) {
          return
        }

        setCollageStudioLivePreviewDataUrl(nextPreviewDataUrl)
      } catch {
        if (previewToken !== collageStudioLivePreviewTokenRef.current) {
          return
        }

        setCollageStudioLivePreviewDataUrl('')
      }
    })()
  }, [activeCollageStudioDraft])

  useEffect(() => {
    if (!activeCollageStudioDraft) {
      if (collageStudioSelectedLayerId) {
        setCollageStudioSelectedLayerId('')
      }
      return
    }

    const hasSelectedLayer = activeCollageStudioDraft.layers.some((layer) => layer.id === collageStudioSelectedLayerId)
    if (hasSelectedLayer) {
      return
    }

    const preferred = activeCollageStudioDraft.layers.find((layer) => layer.kind !== 'logo')
      ?? activeCollageStudioDraft.layers[0]
      ?? null
    setCollageStudioSelectedLayerId(preferred?.id ?? '')
  }, [activeCollageStudioDraft, collageStudioSelectedLayerId])

  useEffect(() => {
    if (!collageStudioEditingTextTarget) {
      return
    }

    if (!activeCollageStudioDraft) {
      setCollageStudioEditingTextTarget(null)
      return
    }

    const editingLayer = activeCollageStudioDraft.layers.find((layer) => layer.id === collageStudioEditingTextTarget.layerId)
    if (!editingLayer || editingLayer.kind !== 'text') {
      setCollageStudioEditingTextTarget(null)
      return
    }

    const hasItem = (editingLayer.textItems ?? []).some((item) => item.id === collageStudioEditingTextTarget.itemId)
    if (!hasItem) {
      setCollageStudioEditingTextTarget(null)
    }
  }, [activeCollageStudioDraft, collageStudioEditingTextTarget])

  useEffect(() => {
    if (!collageStudioEditingTextTarget) {
      return
    }

    if (!collageStudioSelectedLayer || collageStudioSelectedLayer.kind !== 'text') {
      setCollageStudioEditingTextTarget(null)
      return
    }

    if (collageStudioSelectedLayer.id !== collageStudioEditingTextTarget.layerId) {
      setCollageStudioEditingTextTarget(null)
    }
  }, [collageStudioEditingTextTarget, collageStudioSelectedLayer])

  useEffect(() => {
    collageStudioCanvasPointerIdRef.current = null
    collageStudioActiveStrokeRef.current = null
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
  }, [collageStudioActiveTool])

  const addCollageStudioLayer = useCallback((kind: Exclude<CollageStudioLayerKind, 'background' | 'logo'>) => {
    let createdLayerId = ''

    setActiveCollageStudioDraft((previous) => {
      if (!previous) {
        return previous
      }

      const nextLayers = ensureCollageStudioBaseLayers(previous.layers)
      const logoLayerIndex = nextLayers.findIndex((layer) => layer.kind === 'logo')
      const existingCount = nextLayers.filter((layer) => layer.kind === kind).length
      const layerNamePrefixByKind: Record<Exclude<CollageStudioLayerKind, 'background' | 'logo'>, string> = {
        image: 'Image Layer',
        draw: 'Draw Layer',
        shape: 'Shape Layer',
        text: 'Text Layer',
        sticker: 'Sticker Layer',
      }
      const layerName = `${layerNamePrefixByKind[kind]} ${existingCount + 1}`
      createdLayerId = `layer-${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

      const nextLayer: CollageStudioLayerDraft = kind === 'draw'
        ? {
            id: createdLayerId,
            name: layerName,
            kind,
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'normal',
            positionX: DEFAULT_COLLAGE_LAYER_POSITION,
            positionY: DEFAULT_COLLAGE_LAYER_POSITION,
            width: DEFAULT_COLLAGE_LAYER_SIZE,
            height: DEFAULT_COLLAGE_LAYER_SIZE,
            rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
            drawColor: DEFAULT_COLLAGE_DRAW_COLOR,
            drawSize: DEFAULT_COLLAGE_DRAW_SIZE,
            strokes: [],
          }
        : kind === 'text'
          ? {
              id: createdLayerId,
              name: layerName,
              kind,
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'normal',
              positionX: DEFAULT_COLLAGE_LAYER_POSITION,
              positionY: DEFAULT_COLLAGE_LAYER_POSITION,
              width: DEFAULT_COLLAGE_LAYER_SIZE,
              height: DEFAULT_COLLAGE_LAYER_SIZE,
              rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
              textColor: DEFAULT_COLLAGE_TEXT_COLOR,
              textSize: DEFAULT_COLLAGE_TEXT_SIZE,
              textItems: [],
            }
        : kind === 'shape'
          ? {
              id: createdLayerId,
              name: layerName,
              kind,
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'normal',
              positionX: DEFAULT_COLLAGE_LAYER_POSITION,
              positionY: DEFAULT_COLLAGE_LAYER_POSITION,
              width: DEFAULT_COLLAGE_LAYER_SIZE,
              height: DEFAULT_COLLAGE_LAYER_SIZE,
              rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
              shapeKind: DEFAULT_COLLAGE_SHAPE_KIND,
              shapeColor: DEFAULT_COLLAGE_SHAPE_COLOR,
            }
          : kind === 'sticker'
            ? {
                id: createdLayerId,
                name: layerName,
                kind,
                visible: true,
                locked: false,
                opacity: 1,
                blendMode: 'normal',
                positionX: DEFAULT_COLLAGE_LAYER_POSITION,
                positionY: DEFAULT_COLLAGE_LAYER_POSITION,
                width: DEFAULT_COLLAGE_LAYER_SIZE,
                height: DEFAULT_COLLAGE_LAYER_SIZE,
                rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
                stickerSourceDataUrl: '',
                stickerOutlineDataUrl: '',
              }
            : {
                id: createdLayerId,
                name: layerName,
                kind,
                visible: true,
                locked: false,
                opacity: 1,
                blendMode: 'normal',
                positionX: DEFAULT_COLLAGE_LAYER_POSITION,
                positionY: DEFAULT_COLLAGE_LAYER_POSITION,
                width: DEFAULT_COLLAGE_LAYER_SIZE,
                height: DEFAULT_COLLAGE_LAYER_SIZE,
                rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
              }

      const insertIndex = logoLayerIndex >= 0 ? logoLayerIndex : nextLayers.length
      const next = [...nextLayers]
      next.splice(insertIndex, 0, nextLayer)

      return {
        ...previous,
        layers: ensureCollageStudioBaseLayers(next),
        updatedAt: Date.now(),
      }
    })

    if (createdLayerId) {
      setCollageStudioSelectedLayerId(createdLayerId)
    }
  }, [])

  const updateCollageStudioLayer = useCallback((
    layerId: string,
    updater: (layer: CollageStudioLayerDraft) => CollageStudioLayerDraft,
  ) => {
    if (!layerId) {
      return
    }

    setActiveCollageStudioDraft((previous) => {
      if (!previous) {
        return previous
      }

      let changed = false
      const next: CollageStudioLayerDraft[] = ensureCollageStudioBaseLayers(previous.layers).map((layer): CollageStudioLayerDraft => {
        if (layer.id !== layerId) {
          return layer
        }

        changed = true
        const nextLayer = updater(layer)
        const opacity = clampUnitInterval(Number(nextLayer.opacity))
        const blendMode = nextLayer.blendMode || 'normal'
        const positionX = clampCollageStudioScalar(Number(nextLayer.positionX), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION)
        const positionY = clampCollageStudioScalar(Number(nextLayer.positionY), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION)
        const width = clampCollageStudioLayerSize(Number(nextLayer.width))
        const height = clampCollageStudioLayerSize(Number(nextLayer.height))
        const rotation = normalizeCollageStudioRotation(Number(nextLayer.rotation))
        if (layer.kind === 'logo') {
          return {
            ...nextLayer,
            kind: 'logo',
            id: layer.id,
            locked: true,
            opacity,
            blendMode,
            positionX,
            positionY,
            width,
            height,
            rotation,
          }
        }

        if (layer.kind === 'draw') {
          const strokesRaw = Array.isArray(nextLayer.strokes) ? nextLayer.strokes : []
          return {
            ...nextLayer,
            kind: 'draw',
            id: layer.id,
            opacity,
            blendMode,
            positionX,
            positionY,
            width,
            height,
            rotation,
            drawColor: normalizeCollageStudioColor(nextLayer.drawColor, DEFAULT_COLLAGE_DRAW_COLOR),
            drawSize: clampCollageStudioScalar(Number(nextLayer.drawSize), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE),
            strokes: strokesRaw
              .map((stroke, strokeIndex) => normalizeCollageStudioStroke(stroke, strokeIndex))
              .filter((stroke): stroke is CollageStudioStroke => Boolean(stroke)),
          }
        }

        if (layer.kind === 'text') {
          const textItemsRaw = Array.isArray(nextLayer.textItems) ? nextLayer.textItems : []
          return {
            ...nextLayer,
            kind: 'text',
            id: layer.id,
            opacity,
            blendMode,
            positionX,
            positionY,
            width,
            height,
            rotation,
            textColor: normalizeCollageStudioColor(nextLayer.textColor, DEFAULT_COLLAGE_TEXT_COLOR),
            textSize: clampCollageStudioScalar(Number(nextLayer.textSize), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE),
            textItems: textItemsRaw
              .map((item, itemIndex) => normalizeCollageStudioTextItem(item, itemIndex))
              .filter((item): item is CollageStudioTextItem => Boolean(item)),
          }
        }

        return {
          ...nextLayer,
          kind: layer.kind,
          id: layer.id,
          opacity,
          blendMode,
          positionX,
          positionY,
          width,
          height,
          rotation,
        }
      })

      if (!changed) {
        return previous
      }

      return {
        ...previous,
        layers: ensureCollageStudioBaseLayers(next),
        updatedAt: Date.now(),
      }
    })
  }, [])

  const updateCollageStudioTextItem = useCallback((
    layerId: string,
    itemId: string,
    updater: (item: CollageStudioTextItem) => CollageStudioTextItem,
  ) => {
    if (!layerId || !itemId) {
      return
    }

    updateCollageStudioLayer(layerId, (layer) => {
      if (layer.kind !== 'text') {
        return layer
      }

      const textItemsRaw = Array.isArray(layer.textItems) ? layer.textItems : []
      const textItems = textItemsRaw.map((item) => {
        if (item.id !== itemId) {
          return item
        }

        return updater(item)
      })

      return {
        ...layer,
        textItems,
      }
    })
  }, [updateCollageStudioLayer])

  const eraseCollageStudioStrokesAtPoint = useCallback((layerId: string, point: CollageStudioPoint) => {
    updateCollageStudioLayer(layerId, (layer) => {
      if (layer.kind !== 'draw') {
        return layer
      }

      const strokes = Array.isArray(layer.strokes) ? layer.strokes : []
      if (strokes.length === 0) {
        return layer
      }

      const layerWidth = clampCollageStudioLayerSize(Number(layer.width))
      const layerHeight = clampCollageStudioLayerSize(Number(layer.height))
      const layerScale = Math.max(layerWidth, layerHeight)
      const localPoint = projectCollageStudioCanvasPointToLayerLocal(point, layer)
      const eraserSize = Math.max(
        DEFAULT_COLLAGE_ERASER_SIZE,
        clampCollageStudioScalar(Number(layer.drawSize), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE) * 2,
      )
      const localEraserRadius = (eraserSize / COLLAGE_DRAW_RENDER_SIZE) / layerScale

      const nextStrokes = strokes.filter((stroke) => {
        const localStrokeRadius = (clampCollageStudioScalar(Number(stroke.size), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE) / COLLAGE_DRAW_RENDER_SIZE) / layerScale
        const combinedRadius = localEraserRadius + localStrokeRadius
        return !stroke.points.some((strokePoint) => Math.hypot(strokePoint.x - localPoint.x, strokePoint.y - localPoint.y) <= combinedRadius)
      })

      if (nextStrokes.length === strokes.length) {
        return layer
      }

      return {
        ...layer,
        strokes: nextStrokes,
      }
    })
  }, [updateCollageStudioLayer])

  const undoCollageStudioDrawStroke = useCallback(() => {
    if (!activeCollageStudioDraft) {
      return
    }

    const selectedDrawLayer = collageStudioSelectedLayer?.kind === 'draw'
      ? collageStudioSelectedLayer
      : null
    const fallbackDrawLayer = [...activeCollageStudioDraft.layers]
      .reverse()
      .find((layer) => layer.kind === 'draw' && (layer.strokes?.length ?? 0) > 0) ?? null
    const targetLayer = selectedDrawLayer && (selectedDrawLayer.strokes?.length ?? 0) > 0
      ? selectedDrawLayer
      : fallbackDrawLayer

    if (!targetLayer) {
      setStatus('No draw strokes to undo.')
      return
    }

    updateCollageStudioLayer(targetLayer.id, (layer) => {
      if (layer.kind !== 'draw') {
        return layer
      }

      const strokes = Array.isArray(layer.strokes) ? layer.strokes : []
      if (strokes.length === 0) {
        return layer
      }

      return {
        ...layer,
        strokes: strokes.slice(0, -1),
      }
    })

    setStatus('Undid the last draw stroke.')
  }, [activeCollageStudioDraft, collageStudioSelectedLayer, setStatus, updateCollageStudioLayer])

  const beginCollageStudioLayerTransform = useCallback((
    event: PointerEvent<HTMLElement>,
    layer: CollageStudioLayerDraft,
    mode: CollageStudioLayerTransformMode,
  ) => {
    if (collageStudioActiveTool !== 'select' || layer.locked || !layer.visible) {
      return
    }

    const point = getCollageStudioRelativePoint(event)
    if (!point) {
      return
    }

    const captureTarget = collageStudioCanvasShellRef.current ?? event.currentTarget
    if (!captureTarget.hasPointerCapture(event.pointerId)) {
      captureTarget.setPointerCapture(event.pointerId)
    }

    collageStudioCanvasPointerIdRef.current = event.pointerId
    collageStudioActiveTransformRef.current = {
      layerId: layer.id,
      mode,
      pointerId: event.pointerId,
      startPoint: point,
      startPositionX: clampCollageStudioScalar(Number(layer.positionX), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION),
      startPositionY: clampCollageStudioScalar(Number(layer.positionY), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION),
      startWidth: clampCollageStudioLayerSize(Number(layer.width)),
      startHeight: clampCollageStudioLayerSize(Number(layer.height)),
      startRotation: normalizeCollageStudioRotation(Number(layer.rotation)),
    }

    setCollageStudioSelectedLayerId(layer.id)
    setCollageStudioSidebarTab('properties')
    event.preventDefault()
    event.stopPropagation()
  }, [collageStudioActiveTool, getCollageStudioRelativePoint])

  const handleCollageStudioCanvasPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (collageStudioActiveTool === 'select') {
      const targetElement = event.target as HTMLElement | null
      const layerIdFromTarget = targetElement?.closest<HTMLElement>('[data-collage-layer-id]')?.dataset.collageLayerId
      if (layerIdFromTarget) {
        setCollageStudioSelectedLayerId(layerIdFromTarget)
        setCollageStudioSidebarTab('properties')
      }
      if (!layerIdFromTarget) {
        setCollageStudioEditingTextTarget(null)
      }
      return
    }

    const selectedLayer = collageStudioSelectedLayer
    if (!selectedLayer || selectedLayer.locked || !selectedLayer.visible) {
      return
    }

    const targetElement = event.target as HTMLElement | null

    if (collageStudioActiveTool === 'text') {
      if (selectedLayer.kind !== 'text') {
        setStatus('Select a text layer to place text boxes.')
        return
      }

      if (targetElement?.closest('[data-collage-text-item="true"]')) {
        return
      }

      const point = getCollageStudioRelativePoint(event)
      if (!point) {
        return
      }

      const localPoint = projectCollageStudioCanvasPointToLayerLocal(point, selectedLayer)

      event.preventDefault()
      const itemId = `text-item-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const defaultTextColor = normalizeCollageStudioColor(selectedLayer.textColor, DEFAULT_COLLAGE_TEXT_COLOR)
      const defaultTextSize = clampCollageStudioScalar(Number(selectedLayer.textSize), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE)
      updateCollageStudioLayer(selectedLayer.id, (layer) => {
        if (layer.kind !== 'text') {
          return layer
        }

        const textItems = Array.isArray(layer.textItems) ? layer.textItems : []
        return {
          ...layer,
          textItems: [
            ...textItems,
            {
              id: itemId,
              text: 'Type text',
              x: localPoint.x,
              y: localPoint.y,
              color: defaultTextColor,
              size: defaultTextSize,
            },
          ],
        }
      })
      setCollageStudioEditingTextTarget({ layerId: selectedLayer.id, itemId })
      setStatus('Added a text box. Type directly in the canvas.')
      return
    }

    if (collageStudioActiveTool === 'eraser') {
      if (selectedLayer.kind !== 'draw') {
        setStatus('Select a draw layer before using the eraser.')
        return
      }

      const point = getCollageStudioRelativePoint(event)
      if (!point) {
        return
      }

      event.preventDefault()
      collageStudioCanvasPointerIdRef.current = event.pointerId
      collageStudioActiveEraserLayerIdRef.current = selectedLayer.id
      collageStudioActiveStrokeRef.current = null
      collageStudioActiveTransformRef.current = null

      const captureTarget = collageStudioCanvasShellRef.current ?? event.currentTarget
      if (!captureTarget.hasPointerCapture(event.pointerId)) {
        captureTarget.setPointerCapture(event.pointerId)
      }

      eraseCollageStudioStrokesAtPoint(selectedLayer.id, point)
      return
    }

    if (collageStudioActiveTool !== 'draw') {
      return
    }

    if (selectedLayer.kind !== 'draw') {
      setStatus('Select a draw layer to sketch on the canvas.')
      return
    }

    const point = getCollageStudioRelativePoint(event)
    if (!point) {
      return
    }

    const localPoint = projectCollageStudioCanvasPointToLayerLocal(point, selectedLayer)

    event.preventDefault()
    const strokeId = `stroke-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const strokeColor = normalizeCollageStudioColor(selectedLayer.drawColor, DEFAULT_COLLAGE_DRAW_COLOR)
    const strokeSize = clampCollageStudioScalar(Number(selectedLayer.drawSize), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE)
    collageStudioCanvasPointerIdRef.current = event.pointerId
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
    collageStudioActiveStrokeRef.current = {
      layerId: selectedLayer.id,
      strokeId,
    }

    const captureTarget = collageStudioCanvasShellRef.current ?? event.currentTarget
    if (!captureTarget.hasPointerCapture(event.pointerId)) {
      captureTarget.setPointerCapture(event.pointerId)
    }

    updateCollageStudioLayer(selectedLayer.id, (layer) => {
      if (layer.kind !== 'draw') {
        return layer
      }

      const strokes = Array.isArray(layer.strokes) ? layer.strokes : []
      return {
        ...layer,
        strokes: [
          ...strokes,
          {
            id: strokeId,
            points: [localPoint],
            color: strokeColor,
            size: strokeSize,
          },
        ],
      }
    })
  }, [
    collageStudioActiveTool,
    collageStudioSelectedLayer,
    eraseCollageStudioStrokesAtPoint,
    getCollageStudioRelativePoint,
    setStatus,
    updateCollageStudioLayer,
  ])

  const handleCollageStudioCanvasPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const activeTransform = collageStudioActiveTransformRef.current
    if (activeTransform) {
      if (activeTransform.pointerId !== event.pointerId) {
        return
      }

      const point = getCollageStudioRelativePoint(event)
      if (!point) {
        return
      }

      updateCollageStudioLayer(activeTransform.layerId, (layer) => {
        if (layer.kind === 'background' || layer.kind === 'logo') {
          return layer
        }

        if (activeTransform.mode === 'move') {
          return {
            ...layer,
            positionX: clampCollageStudioScalar(
              activeTransform.startPositionX + (point.x - activeTransform.startPoint.x),
              0,
              1,
              DEFAULT_COLLAGE_LAYER_POSITION,
            ),
            positionY: clampCollageStudioScalar(
              activeTransform.startPositionY + (point.y - activeTransform.startPoint.y),
              0,
              1,
              DEFAULT_COLLAGE_LAYER_POSITION,
            ),
          }
        }

        if (activeTransform.mode === 'resize') {
          return {
            ...layer,
            width: clampCollageStudioLayerSize(activeTransform.startWidth + (point.x - activeTransform.startPoint.x) * 2),
            height: clampCollageStudioLayerSize(activeTransform.startHeight + (point.y - activeTransform.startPoint.y) * 2),
          }
        }

        const centerX = activeTransform.startPositionX
        const centerY = activeTransform.startPositionY
        const startAngle = Math.atan2(activeTransform.startPoint.y - centerY, activeTransform.startPoint.x - centerX)
        const nextAngle = Math.atan2(point.y - centerY, point.x - centerX)
        const deltaDegrees = (nextAngle - startAngle) * (180 / Math.PI)

        return {
          ...layer,
          rotation: normalizeCollageStudioRotation(activeTransform.startRotation + deltaDegrees),
        }
      })

      return
    }

    const activeEraserLayerId = collageStudioActiveEraserLayerIdRef.current
    if (activeEraserLayerId) {
      if (collageStudioCanvasPointerIdRef.current !== event.pointerId) {
        return
      }

      const point = getCollageStudioRelativePoint(event)
      if (!point) {
        return
      }

      eraseCollageStudioStrokesAtPoint(activeEraserLayerId, point)
      return
    }

    const activeStroke = collageStudioActiveStrokeRef.current
    if (!activeStroke) {
      return
    }

    if (collageStudioCanvasPointerIdRef.current !== event.pointerId) {
      return
    }

    const point = getCollageStudioRelativePoint(event)
    if (!point) {
      return
    }

    const selectedLayer = activeCollageStudioDraft?.layers.find((layer) => layer.id === activeStroke.layerId)
    if (!selectedLayer || selectedLayer.kind !== 'draw') {
      return
    }
    const localPoint = projectCollageStudioCanvasPointToLayerLocal(point, selectedLayer)

    updateCollageStudioLayer(activeStroke.layerId, (layer) => {
      if (layer.kind !== 'draw') {
        return layer
      }

      const strokes = Array.isArray(layer.strokes) ? layer.strokes : []
      const nextStrokes = strokes.map((stroke) => {
        if (stroke.id !== activeStroke.strokeId) {
          return stroke
        }

        const lastPoint = stroke.points[stroke.points.length - 1]
        if (lastPoint && Math.hypot(lastPoint.x - localPoint.x, lastPoint.y - localPoint.y) < 0.0015) {
          return stroke
        }

        return {
          ...stroke,
          points: [...stroke.points, localPoint],
        }
      })

      return {
        ...layer,
        strokes: nextStrokes,
      }
    })
  }, [
    activeCollageStudioDraft,
    eraseCollageStudioStrokesAtPoint,
    getCollageStudioRelativePoint,
    updateCollageStudioLayer,
  ])

  const endCollageStudioActiveStroke = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (collageStudioCanvasPointerIdRef.current === null) {
      collageStudioActiveStrokeRef.current = null
      collageStudioActiveEraserLayerIdRef.current = null
      collageStudioActiveTransformRef.current = null
      return
    }

    if (collageStudioCanvasPointerIdRef.current !== event.pointerId) {
      return
    }

    const captureTarget = collageStudioCanvasShellRef.current ?? event.currentTarget
    if (captureTarget.hasPointerCapture(event.pointerId)) {
      captureTarget.releasePointerCapture(event.pointerId)
    }

    collageStudioCanvasPointerIdRef.current = null
    collageStudioActiveStrokeRef.current = null
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
  }, [])

  const removeCollageStudioLayer = useCallback((layerId: string) => {
    if (!layerId) {
      return
    }

    setActiveCollageStudioDraft((previous) => {
      if (!previous) {
        return previous
      }

      const target = previous.layers.find((layer) => layer.id === layerId)
      if (!target || target.kind === 'background' || target.kind === 'logo') {
        return previous
      }

      const next = previous.layers.filter((layer) => layer.id !== layerId)
      return {
        ...previous,
        layers: ensureCollageStudioBaseLayers(next),
        updatedAt: Date.now(),
      }
    })

    if (collageStudioSelectedLayerId === layerId) {
      setCollageStudioSelectedLayerId('')
    }
    if (collageStudioEditingTextTarget?.layerId === layerId) {
      setCollageStudioEditingTextTarget(null)
    }
    if (collageStudioActiveStrokeRef.current?.layerId === layerId) {
      collageStudioActiveStrokeRef.current = null
      collageStudioCanvasPointerIdRef.current = null
    }
    if (collageStudioActiveEraserLayerIdRef.current === layerId) {
      collageStudioActiveEraserLayerIdRef.current = null
      collageStudioCanvasPointerIdRef.current = null
    }
    if (collageStudioActiveTransformRef.current?.layerId === layerId) {
      collageStudioActiveTransformRef.current = null
      collageStudioCanvasPointerIdRef.current = null
    }
    setStatus('Removed collage layer.')
  }, [collageStudioEditingTextTarget, collageStudioSelectedLayerId, setStatus])

  const handleCollageStudioToolSelect = useCallback((tool: CollageStudioTool) => {
    setCollageStudioActiveTool(tool)

    if (tool === 'select') {
      setStatus('Arrange mode active. Drag layers to move; use handles to resize or rotate.')
      return
    }

    if (tool === 'eraser') {
      if (collageStudioSelectedLayer?.kind !== 'draw') {
        setStatus('Eraser is available on draw layers. Select a draw layer first.')
        return
      }

      setStatus('Eraser active. Drag over strokes to remove them.')
      return
    }

    if (tool === 'image') {
      setStatus('Choose an image to add as a new layer.')
      collageStudioImageInputRef.current?.click()
      return
    }

    if (tool === 'draw' && collageStudioSelectedLayer?.kind === 'draw') {
      setStatus('Draw tool active. Drag on the canvas to sketch.')
      return
    }

    if (tool === 'text' && collageStudioSelectedLayer?.kind === 'text') {
      setStatus('Text tool active. Click the canvas to place a text box.')
      return
    }

    addCollageStudioLayer(tool as Exclude<CollageStudioTool, 'select' | 'eraser' | 'image'>)
    setCollageStudioSidebarTab('layers')
    if (tool === 'draw') {
      setStatus('Draw layer added. Drag on the canvas to sketch.')
      return
    }

    if (tool === 'text') {
      setStatus('Text layer added. Click the canvas to place a text box.')
      return
    }

    setCollageStudioActiveTool('select')
    setStatus(`Added ${tool} layer. Switch to Arrange to move it.`)
  }, [addCollageStudioLayer, collageStudioSelectedLayer, setStatus])

  const openCollageStudio = useCallback(() => {
    const resolvedSystemKey = normalizeCollageStudioSystemKey(editingCustomSystem?.key ?? customSystemPreviewKey)
    const persistedDraft = collageStudioDraftsBySystemKey[resolvedSystemKey]
    const seededDraft = persistedDraft
      ? {
          ...persistedDraft,
          systemKey: resolvedSystemKey,
          backgroundDataUrl: persistedDraft.backgroundDataUrl.trim() || customSystemDraft.collageDataUrl.trim(),
          layers: ensureCollageStudioBaseLayers(persistedDraft.layers),
          updatedAt: Date.now(),
        }
      : createCollageStudioDraft(resolvedSystemKey, customSystemDraft.collageDataUrl.trim())

    setCollageStudioSidebarTab('layers')
    setCollageStudioActiveTool('select')
    setCollageStudioSelectedLayerId(
      seededDraft.layers.find((layer) => layer.kind !== 'logo')?.id
      ?? seededDraft.layers[0]?.id
      ?? '',
    )
    setCollageStudioLivePreviewDataUrl('')
    setCollageStudioEditingTextTarget(null)
    collageStudioCanvasPointerIdRef.current = null
    collageStudioActiveStrokeRef.current = null
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
    setActiveCollageStudioDraft(seededDraft)
    setIsCollageStudioOpen(true)
    playSettingsSound('systemCollage')
    setStatus(`Opened Collage Studio for ${customSystemDraftDisplayName}.`)
  }, [
    collageStudioDraftsBySystemKey,
    customSystemDraft.collageDataUrl,
    customSystemDraftDisplayName,
    customSystemPreviewKey,
    playSettingsSound,
    editingCustomSystem,
    setStatus,
  ])

  const closeCollageStudio = useCallback(() => {
    setIsCollageStudioOpen(false)
    setActiveCollageStudioDraft(null)
    setCollageStudioSelectedLayerId('')
    setCollageStudioLivePreviewDataUrl('')
    setCollageStudioEditingTextTarget(null)
    collageStudioCanvasPointerIdRef.current = null
    collageStudioActiveStrokeRef.current = null
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
  }, [])

  const openManageSystems = useCallback(() => {
    openAddGamesModal('systems')
  }, [openAddGamesModal])

  const openCreateSystemFlow = useCallback(() => {
    setDebugSystemImportKey('')
    setIsCollageStudioOpen(false)
    setActiveCollageStudioDraft(null)
    setCollageStudioSelectedLayerId('')
    setCollageStudioLivePreviewDataUrl('')
    setCollageStudioEditingTextTarget(null)
    collageStudioCanvasPointerIdRef.current = null
    collageStudioActiveStrokeRef.current = null
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
    setEditingCustomSystemId(null)
    setCustomSystemDraft(createEmptyCustomSystemDraft())
    setManageSystemsEditorTab('basics')
    setIsCustomSystemRuleEditorExpanded(false)
    setIsCustomSystemCreateMode(true)
    setCustomSystemNameFocusKey((previous) => previous + 1)
    setAddGamesTab('systems')
    setIsAddGamesModalOpen(true)
  }, [])

  const settingsPerformanceStatusNote = useMemo(() => {
    const effectiveLabel = describeEffectiveFidelity(
      graphicsFidelityMode,
      effectiveGraphicsFidelity,
      isAutoFidelityDowngradeActive,
    )

    if (graphicsFidelityMode === 'normal' && isAutoFidelityDowngradeActive) {
      return `Graphics fidelity is temporarily ${effectiveLabel} because sustained lag was detected.`
    }

    if (effectiveGraphicsFidelity === 'ultra') {
      return 'Ultra fidelity is active with maximum launcher visuals.'
    }

    if (effectiveGraphicsFidelity === 'ultra-lite') {
      return 'Ultra-lite fidelity is active for best performance.'
    }

    if (effectiveGraphicsFidelity === 'lite') {
      return 'Lite fidelity is active with reduced visual effects.'
    }

    return 'Normal fidelity is active (recommended balanced default).'
  }, [
    effectiveGraphicsFidelity,
    graphicsFidelityMode,
    isAutoFidelityDowngradeActive,
  ])

  const settingsScreenModel = useMemo(() => buildSettingsScreenModel({
    activeSection: settingsActiveSection,
    onActiveSectionChange: setSettingsActiveSection,
    onSwitchSound: handleSettingsSwitchSound,
    onSliderSound: handleSettingsSliderSound,
    uiSoundVolume,
    onUiSoundVolumeChange: setUiSoundVolume,
    audioTextureEnabled,
    onAudioTextureEnabledChange: setAudioTextureEnabled,
    audioTextureLevel,
    onAudioTextureLevelChange: setAudioTextureLevel,
    menuMusicEnabled,
    onMenuMusicEnabledChange: setMenuMusicEnabled,
    menuMusicVolume,
    onMenuMusicVolumeChange: setMenuMusicVolume,
    preferExternalMedia,
    onPreferExternalMediaChange: setPreferExternalMedia,
    graphicsFidelityMode,
    onGraphicsFidelityModeChange: handleGraphicsFidelityModeChange,
    lowPowerModeEnabled,
    onLowPowerModeEnabledChange: setLowPowerModeEnabled,
    performanceStatusNote: settingsPerformanceStatusNote,
    steamApiKey,
    onSteamApiKeyChange: setSteamApiKey,
    steamId,
    onSteamIdChange: setSteamId,
    isSteamLoginBusy,
    isSteamTestBusy,
    onSteamBrowserLogin: handleSteamBrowserLogin,
    onTestSteamConnection: () => { void handleTestSteamConnection() },
    onLogoutSteam: handleLogoutSteam,
    onOpenSteamApiKeyPage: handleOpenSteamApiKeyPage,
    romDirsText,
    onRomDirsTextChange: setRomDirsText,
    romTitleCleanupEnabled,
    onRomTitleCleanupEnabledChange: setRomTitleCleanupEnabled,
    emulatorPaths,
    onEmulatorPathChange: (key, value) => {
      setEmulatorPaths((previous) => ({
        ...previous,
        [key]: value,
      }))
    },
    emulatorFields: EMULATOR_FIELDS,
    onBrowseRomFolder: handleAddRomFolder,
    onRerunOnboarding: handleRerunOnboarding,
    onBrowseEmulatorPath: (key) => { void browseEmulatorPath(key) },
    steamControllerCoexistenceMode,
    onSteamControllerCoexistenceModeChange: setSteamControllerCoexistenceMode,
    controllerSettingsPanel,
    onControllerSettingsPanelChange: setControllerSettingsPanel,
    controllerSettingsSystemKey,
    onControllerSettingsSystemKeyChange: setControllerSettingsSystemKey,
    controllerSettingsBinds,
    controllerSettingsRuntimeLayout,
    controllerSettingsRuntimeBindings,
    controllerLayoutOptions: CONTROLLER_LAYOUT_OPTIONS,
    romSystemFolders: ROM_SYSTEM_FOLDERS,
    controllerEssentialActions: CONTROLLER_ESSENTIAL_ACTIONS,
    controllerAdvancedActions: CONTROLLER_ADVANCED_ACTIONS,
    controllerPlatformActions: CONTROLLER_PLATFORM_ACTIONS,
    controllerPlatformActionLabels: CONTROLLER_PLATFORM_ACTION_LABELS,
    controllerActionLabels: CONTROLLER_ACTION_LABELS,
    controllerInputOrder: CONTROLLER_INPUT_ORDER,
    controllerInputLabels: CONTROLLER_INPUT_LABELS,
    formatControllerInputForLayout,
    connectedGamepadLabel: connectedGamepadLabel || null,
    launcherInputMode,
    activeRuntimeControllerLayoutLabel,
    onResetLauncherControllerBindings: resetLauncherControllerBindings,
    onUpdateLauncherControllerLayout: updateLauncherControllerLayout,
    onUpdateLauncherControllerBinding: updateLauncherControllerBinding,
    onResetControllerBindingsForSystem: resetControllerBindingsForSystem,
    onUpdateControllerLayoutForSystem: updateControllerLayoutForSystem,
    onUpdateControllerBindingForSystem: updateControllerBindingForSystem,
    controllerSettingsPeripheralOptions,
    controllerSettingsPeripherals,
    onUpdatePlatformPeripheralForSystem: updatePlatformPeripheralForSystem,
  }), [
    activeRuntimeControllerLayoutLabel,
    audioTextureEnabled,
    audioTextureLevel,
    browseEmulatorPath,
    connectedGamepadLabel,
    controllerSettingsBinds,
    controllerSettingsPanel,
    controllerSettingsPeripheralOptions,
    controllerSettingsPeripherals,
    controllerSettingsRuntimeBindings,
    controllerSettingsRuntimeLayout,
    controllerSettingsSystemKey,
    emulatorPaths,
    graphicsFidelityMode,
    handleAddRomFolder,
    handleLogoutSteam,
    handleOpenSteamApiKeyPage,
    handleRerunOnboarding,
    handleSettingsSwitchSound,
    handleSettingsSliderSound,
    handleSteamBrowserLogin,
    handleTestSteamConnection,
    isSteamLoginBusy,
    isSteamTestBusy,
    launcherInputMode,
    lowPowerModeEnabled,
    menuMusicEnabled,
    menuMusicVolume,
    preferExternalMedia,
    resetControllerBindingsForSystem,
    resetLauncherControllerBindings,
    romDirsText,
    romTitleCleanupEnabled,
    settingsActiveSection,
    settingsPerformanceStatusNote,
    steamApiKey,
    steamControllerCoexistenceMode,
    steamId,
    uiSoundVolume,
    updateControllerBindingForSystem,
    updateControllerLayoutForSystem,
    updateLauncherControllerBinding,
    updateLauncherControllerLayout,
    updatePlatformPeripheralForSystem,
  ])

  useEffect(() => {
    if (!isCollageStudioOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
      if (isUndo) {
        const target = event.target as HTMLElement | null
        const isTextEditingTarget = Boolean(
          target && (
            target.tagName === 'INPUT'
            || target.tagName === 'TEXTAREA'
            || target.isContentEditable
          ),
        )

        if (!isTextEditingTarget && (collageStudioActiveTool === 'draw' || collageStudioActiveTool === 'eraser')) {
          event.preventDefault()
          undoCollageStudioDrawStroke()
          return
        }
      }

      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      closeCollageStudio()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    closeCollageStudio,
    collageStudioActiveTool,
    isCollageStudioOpen,
    undoCollageStudioDrawStroke,
  ])

  useEffect(() => {
    if (!isAddGamesModalOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (isCollageStudioOpen) {
        return
      }

      event.preventDefault()
      closeAddGamesModal()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeAddGamesModal, isCollageStudioOpen, isAddGamesModalOpen])

  const resetCustomSystemEditor = useCallback(() => {
    setIsCustomSystemCreateMode(false)
    setEditingCustomSystemId(null)
    setCustomSystemDraft(createEmptyCustomSystemDraft())
  }, [])

  const applyCustomSystemRulePreset = useCallback((presetKey: string) => {
    const preset = CUSTOM_SYSTEM_RULE_PRESETS.find((entry) => entry.key === presetKey)
    if (!preset) {
      return
    }

    setCustomSystemDraft((previous) => {
      const mergedSources = Array.from(new Set([...splitMultilineValues(previous.includeSourcesText), ...preset.sources]))
      const mergedPathHints = Array.from(new Set([...splitMultilineValues(previous.includePathHintsText), ...preset.pathHints]))
      const mergedExtensions = Array.from(new Set([...splitMultilineValues(previous.includeExtensionsText), ...preset.extensions]))

      return {
        ...previous,
        includeSourcesText: joinMultilineValues(mergedSources),
        includePathHintsText: joinMultilineValues(mergedPathHints),
        includeExtensionsText: joinMultilineValues(mergedExtensions),
      }
    })

    playSettingsSound('switchOption')
    setStatus(`Added ${preset.label} rule preset.`)
  }, [playSettingsSound, setStatus])

  const applyCustomSystemTemplate = useCallback((templateKey: string) => {
    const template = CUSTOM_SYSTEM_TEMPLATES.find((entry) => entry.key === templateKey)
    if (!template) {
      return
    }

    setEditingCustomSystemId(null)
    setCustomSystemDraft({
      name: template.name,
      iconPath: '',
      collageDataUrl: '',
      accentPrimary: template.accentPrimary,
      accentSecondary: template.accentSecondary,
      description: template.description,
      ingestionMode: 'smart',
      includeSourcesText: joinMultilineValues(template.rules.includeSources),
      includePathHintsText: joinMultilineValues(template.rules.includePathHints),
      includeExtensionsText: joinMultilineValues(template.rules.includeExtensions),
    })
    setManageSystemsEditorTab('basics')
    setStatus(`Loaded ${template.name} template.`)
  }, [setStatus])

  const importDebugSystemPreset = useCallback(() => {
    if (!isDebugMenuVisible) {
      setStatus('Debug system import is only available when debug mode is enabled.')
      return
    }

    const preset = DEBUG_SYSTEM_IMPORT_PRESETS.find((entry) => entry.key === debugSystemImportKey)
    if (!preset) {
      setStatus('Select a built-in system preset to import.')
      return
    }

    const existingSystem = customSystems.find(
      (system) => system.name.trim().toLowerCase() === preset.name.trim().toLowerCase(),
    )

    if (existingSystem) {
      setEditingCustomSystemId(existingSystem.id)
      setCustomSystemDraft(toCustomSystemDraft(existingSystem))
      setManageSystemsEditorTab('basics')
      setIsCustomSystemRuleEditorExpanded(false)
      setActiveCategory(existingSystem.key)
      if (existingSystem.hidden) {
        setManageSystemsFilter('hidden')
      }
      setStatus(`${preset.name} is already imported. Opened existing system.`)
      return
    }

    const now = Date.now()
    const key = buildCustomSystemKey(preset.name, new Set(reservedSystemKeys))
    const importedSystem: CustomSystemDefinition = {
      id: crypto.randomUUID(),
      key,
      name: preset.name,
      shortLabel: deriveCustomSystemShortLabel(preset.name),
      iconPath: preset.logoPath,
      collageDataUrl: '',
      accentPrimary: preset.accentPrimary,
      accentSecondary: preset.accentSecondary,
      description: preset.description,
      hidden: false,
      ingestionMode: 'manual',
      rules: {
        includeSources: [],
        includePathHints: [],
        includeExtensions: [],
      },
      createdAt: now,
      updatedAt: now,
    }

    setCustomSystems((previous) => {
      const next = [...previous, importedSystem]
      next.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }))
      return next
    })

    const importedDraft = toCustomSystemDraft(importedSystem)
    setSystemGradientMap((previous) => ({
      ...previous,
      [key]: toCustomSystemDraftGradient(importedDraft),
    }))

    setActiveCategory(key)
    setEditingCustomSystemId(importedSystem.id)
    setCustomSystemDraft(importedDraft)
    setManageSystemsEditorTab('basics')
    setIsCustomSystemRuleEditorExpanded(false)
    setStatus(`Imported debug system shell: ${preset.name}.`)
  }, [
    customSystems,
    debugSystemImportKey,
    isDebugMenuVisible,
    reservedSystemKeys,
    setActiveCategory,
    setStatus,
  ])

  const generateSimulatedImportPreview = useCallback(() => {
    if (!isDebugMenuVisible) {
      setStatus('Simulated import is only available when debug mode is enabled.')
      return
    }

    if (!simulatedImportEnabled) {
      setStatus('Enable Simulated Import Mode first.')
      return
    }

    const clampedQuantity = Math.max(1, Math.min(500, Math.floor(simulatedImportQuantity || 1)))
    const sourceLabel = SIMULATED_IMPORT_SOURCE_PRESETS.find((preset) => preset.key === simulatedImportSourcePreset)?.label ?? 'Custom'
    const profileLabel = SIMULATED_IMPORT_PROFILE_PRESETS.find((preset) => preset.key === simulatedImportProfilePreset)?.label ?? 'Small clean library'
    const duplicateBias = simulatedImportProfilePreset === 'duplicate-heavy' ? 0.42 : simulatedImportProfilePreset === 'huge-mixed' ? 0.24 : 0.12
    const invalidPathBias = simulatedImportProfilePreset === 'corrupt-metadata' ? 0.44 : simulatedImportInvalidPaths ? 0.2 : 0
    const weirdNameBias = simulatedImportProfilePreset === 'corrupt-metadata' ? 0.34 : simulatedImportWeirdFileNames ? 0.16 : 0
    const longTitleBias = simulatedImportProfilePreset === 'huge-mixed' ? 0.24 : simulatedImportVeryLongTitles ? 0.14 : 0
    const nonEnglishBias = simulatedImportProfilePreset === 'huge-mixed' ? 0.18 : simulatedImportNonEnglishTitles ? 0.1 : 0

    const seedText = [
      simulatedImportSourcePreset,
      simulatedImportProfilePreset,
      String(clampedQuantity),
      simulatedImportIncludeDuplicateIds ? 'dup-id' : 'no-dup-id',
      simulatedImportMissingBoxArt ? 'missing-art' : 'art',
      simulatedImportInvalidPaths ? 'invalid' : 'valid',
      simulatedImportWeirdFileNames ? 'weird' : 'clean',
      simulatedImportNonEnglishTitles ? 'intl' : 'en',
      simulatedImportVeryLongTitles ? 'long' : 'short',
    ].join('|')

    let seed = 2166136261
    for (const char of seedText) {
      seed ^= char.charCodeAt(0)
      seed = Math.imul(seed, 16777619)
    }

    const nextRandom = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }

    const sourceKind: GameEntry['kind'] = simulatedImportSourcePreset === 'steam-library'
      ? 'steam'
      : simulatedImportSourcePreset === 'emulator-rom-folder' || simulatedImportSourcePreset === 'retroarch-playlist'
        ? 'emulator'
        : simulatedImportSourcePreset === 'start-menu-apps'
          ? 'executable'
          : 'uri'

    const sourcePlatformLabel = simulatedImportSourcePreset === 'steam-library'
      ? 'PC (Steam)'
      : simulatedImportSourcePreset === 'emulator-rom-folder'
        ? 'Emulator ROMs'
        : simulatedImportSourcePreset === 'retroarch-playlist'
          ? 'RetroArch'
          : simulatedImportSourcePreset === 'start-menu-apps'
            ? 'Windows Apps'
            : 'Custom Source'

    const previewRows: SimulatedImportPreviewRow[] = []
    for (let index = 0; index < clampedQuantity; index += 1) {
      const fromDuplicatePool = simulatedImportIncludeDuplicateIds && previewRows.length > 3 && nextRandom() < duplicateBias
      const duplicateSource = fromDuplicatePool
        ? previewRows[Math.floor(nextRandom() * previewRows.length)]
        : null

      const baseTitle = duplicateSource
        ? duplicateSource.title
        : `${SIMULATED_IMPORT_BASE_TITLES[Math.floor(nextRandom() * SIMULATED_IMPORT_BASE_TITLES.length)]} ${String(index + 1).padStart(2, '0')}`

      const withLanguage = nextRandom() < nonEnglishBias
        ? `${baseTitle} ${SIMULATED_IMPORT_LANG_VARIANTS[Math.floor(nextRandom() * SIMULATED_IMPORT_LANG_VARIANTS.length)]}`
        : baseTitle

      const withWeirdness = nextRandom() < weirdNameBias
        ? `${withLanguage} #${Math.floor(nextRandom() * 999)} [BETA!?]`
        : withLanguage

      const title = nextRandom() < longTitleBias
        ? `${withWeirdness} Definitive Anniversary Remastered Edition Director Cut Community Patch Build`
        : withWeirdness

      const invalidPath = nextRandom() < invalidPathBias
      const target = sourceKind === 'steam'
        ? `steam://rungameid/${Math.floor(100000 + nextRandom() * 900000)}`
        : sourceKind === 'emulator'
          ? (invalidPath
            ? `Z:\Missing\ROMs\${title}.rom`
            : `D:\Simulated\ROMs\${title}.zip`)
          : sourceKind === 'executable'
            ? (invalidPath
              ? `C:\Missing\Games\${title}\Launch.exe`
              : `C:\Program Files\Simulated\${title}\Launch.exe`)
            : (invalidPath
              ? `tm-invalid://missing/${encodeURIComponent(title)}`
              : `tm-simulated://launch/${encodeURIComponent(title)}`)

      const args = [
        '--tm-simulated=1',
        `--tm-sim-source=${simulatedImportSourcePreset}`,
        `--tm-sim-profile=${simulatedImportProfilePreset}`,
      ]
      if (simulatedImportMissingBoxArt && nextRandom() < 0.42) {
        args.push('--tm-sim-missing-art=1')
      }
      if (invalidPath) {
        args.push('--tm-sim-invalid-path=1')
      }

      previewRows.push({
        id: `${simulatedImportSourcePreset}-${index + 1}`,
        title,
        platform: sourcePlatformLabel,
        sourceLabel,
        pathValidity: invalidPath ? 'invalid' : 'valid',
        duplicate: Boolean(duplicateSource),
        entry: {
          id: crypto.randomUUID(),
          title,
          kind: sourceKind,
          target,
          args,
        },
      })
    }

    const duplicateCount = previewRows.filter((row) => row.duplicate).length
    const invalidPathCount = previewRows.filter((row) => row.pathValidity === 'invalid').length

    setSimulatedImportPreviewRows(previewRows)
    setSimulatedImportSummary(
      `${profileLabel}: ${previewRows.length} rows, ${duplicateCount} duplicate cases, ${invalidPathCount} invalid path cases.`,
    )
    setStatus(`Generated simulated import preview (${previewRows.length} rows).`)
  }, [
    isDebugMenuVisible,
    setStatus,
    simulatedImportEnabled,
    simulatedImportIncludeDuplicateIds,
    simulatedImportInvalidPaths,
    simulatedImportMissingBoxArt,
    simulatedImportNonEnglishTitles,
    simulatedImportProfilePreset,
    simulatedImportQuantity,
    simulatedImportSourcePreset,
    simulatedImportVeryLongTitles,
    simulatedImportWeirdFileNames,
  ])

  const importSimulatedPreviewRows = useCallback(() => {
    if (!isDebugMenuVisible) {
      setStatus('Simulated import is only available when debug mode is enabled.')
      return
    }

    if (!simulatedImportEnabled) {
      setStatus('Enable Simulated Import Mode first.')
      return
    }

    if (simulatedImportPreviewRows.length === 0) {
      setStatus('Generate a simulated preview before importing.')
      return
    }

    let added = 0
    let skipped = 0
    let duplicatesMerged = 0

    setLibrary((previous) => {
      const seenIdentity = new Set(previous.map((entry) => `${entry.kind}|${entry.target}|${normalizeGameTitle(entry.title).toLowerCase()}`))
      const seenTitle = new Set(previous.map((entry) => normalizeGameTitle(entry.title).toLowerCase()))
      const additions: GameEntry[] = []

      for (const row of simulatedImportPreviewRows) {
        const identityKey = `${row.entry.kind}|${row.entry.target}|${normalizeGameTitle(row.entry.title).toLowerCase()}`
        if (seenIdentity.has(identityKey)) {
          skipped += 1
          continue
        }

        const normalizedTitle = normalizeGameTitle(row.entry.title).toLowerCase()
        if (seenTitle.has(normalizedTitle)) {
          duplicatesMerged += 1
          skipped += 1
          continue
        }

        seenIdentity.add(identityKey)
        seenTitle.add(normalizedTitle)
        additions.push({
          ...row.entry,
          id: crypto.randomUUID(),
          title: normalizeGameTitle(row.entry.title),
        })
      }

      added = additions.length
      return additions.length > 0 ? [...additions, ...previous] : previous
    })

    setStatus(`Simulated import complete: added ${added}, skipped ${skipped}, duplicates merged ${duplicatesMerged}.`)
  }, [
    isDebugMenuVisible,
    setLibrary,
    setStatus,
    simulatedImportEnabled,
    simulatedImportPreviewRows,
  ])

  const clearSimulatedImports = useCallback(() => {
    let removed = 0

    setLibrary((previous) => {
      const next = previous.filter((entry) => {
        const isSimulated = (entry.args || []).some((arg) => arg === '--tm-simulated=1')
        if (isSimulated) {
          removed += 1
          return false
        }

        return true
      })
      return removed > 0 ? next : previous
    })

    setSimulatedImportPreviewRows([])
    setSimulatedImportSummary('')
    setStatus(removed > 0 ? `Cleared ${removed} simulated entries.` : 'No simulated entries to clear.')
  }, [setLibrary, setStatus])

  const uploadCollageStudioImageLayer = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file to add as a collage layer.')
      return
    }

    try {
      const dataUrl = await dataUrlFromFile(file)
      let createdLayerId = ''

      setActiveCollageStudioDraft((previous) => {
        if (!previous) {
          return previous
        }

        const seededLayers = ensureCollageStudioBaseLayers(previous.layers)
        const logoLayerIndex = seededLayers.findIndex((layer) => layer.kind === 'logo')
        const existingImageLayerCount = seededLayers.filter((layer) => layer.kind === 'image').length
        createdLayerId = `layer-image-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        const nextImageLayer: CollageStudioLayerDraft = {
          id: createdLayerId,
          name: `Image Layer ${existingImageLayerCount + 1}`,
          kind: 'image',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'normal',
          positionX: DEFAULT_COLLAGE_LAYER_POSITION,
          positionY: DEFAULT_COLLAGE_LAYER_POSITION,
          width: DEFAULT_COLLAGE_LAYER_SIZE,
          height: DEFAULT_COLLAGE_LAYER_SIZE,
          rotation: DEFAULT_COLLAGE_LAYER_ROTATION,
          imageDataUrl: dataUrl,
        }

        const backgroundVisibleLayers = seededLayers.map((layer) => {
          if (layer.kind !== 'background') {
            return layer
          }

          return {
            ...layer,
            visible: true,
          }
        })

        const insertIndex = logoLayerIndex >= 0 ? logoLayerIndex : backgroundVisibleLayers.length
        const nextLayers = [...backgroundVisibleLayers]
        nextLayers.splice(insertIndex, 0, nextImageLayer)

        return {
          ...previous,
          layers: ensureCollageStudioBaseLayers(nextLayers),
          updatedAt: Date.now(),
        }
      })

      if (createdLayerId) {
        setCollageStudioSelectedLayerId(createdLayerId)
      }

      setCollageStudioActiveTool('select')
      setCollageStudioSidebarTab('layers')
      setStatus('Added image layer. Drag it on the canvas to position.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Could not add image layer: ${message}`)
    }
  }, [setStatus])

  const replaceCollageStudioSelectedImageLayer = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file for the image layer.')
      return
    }

    const selectedLayer = collageStudioSelectedLayer
    if (!selectedLayer || selectedLayer.kind !== 'image') {
      setStatus('Select an image layer to replace.')
      return
    }

    try {
      const dataUrl = await dataUrlFromFile(file)
      updateCollageStudioLayer(selectedLayer.id, (current) => ({
        ...current,
        imageDataUrl: dataUrl,
      }))
      setCollageStudioActiveTool('select')
      setStatus('Updated image layer.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Could not load image: ${message}`)
    }
  }, [collageStudioSelectedLayer, setStatus, updateCollageStudioLayer])

  const uploadCollageStudioBackground = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file for the collage studio background.')
      return
    }

    try {
      const dataUrl = await dataUrlFromFile(file)
      setActiveCollageStudioDraft((previous) => {
        if (!previous) {
          return previous
        }

        return {
          ...previous,
          backgroundDataUrl: dataUrl,
          updatedAt: Date.now(),
          layers: ensureCollageStudioBaseLayers(previous.layers).map((layer) => {
            if (layer.kind !== 'background') {
              return layer
            }

            return {
              ...layer,
              visible: true,
            }
          }),
        }
      })
      setStatus('Updated collage studio background image.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Could not load collage studio image: ${message}`)
    }
  }, [setStatus])

  const uploadCollageStudioStickerImage = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file for the sticker.')
      return
    }

    const selectedLayer = collageStudioSelectedLayer
    if (!selectedLayer || selectedLayer.kind !== 'sticker') {
      setStatus('Select a sticker layer first.')
      return
    }

    try {
      const sourceDataUrl = await dataUrlFromFile(file)
      setStatus('Processing sticker stamp outline...')
      const outlineDataUrl = await processCollageStudioStickerStamp(sourceDataUrl)

      updateCollageStudioLayer(selectedLayer.id, (current) => ({
        ...current,
        stickerSourceDataUrl: sourceDataUrl,
        stickerOutlineDataUrl: outlineDataUrl,
      }))

      setCollageStudioActiveTool('select')
      setStatus('Stamp outline applied.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Could not process sticker image: ${message}`)
    }
  }, [collageStudioSelectedLayer, setStatus, updateCollageStudioLayer])

  const applyStampOutlineToCollageStudioImageLayer = useCallback(async () => {
    const selectedLayer = collageStudioSelectedLayer
    if (!selectedLayer || selectedLayer.kind !== 'image') {
      setStatus('Select an image layer first.')
      return
    }

    const sourceDataUrl = selectedLayer.imageDataUrl?.trim()
    if (!sourceDataUrl) {
      setStatus('Add an image to this layer before applying a stamp outline.')
      return
    }

    try {
      setStatus('Processing stamp outline...')
      const outlineDataUrl = await processCollageStudioStickerStamp(sourceDataUrl)
      updateCollageStudioLayer(selectedLayer.id, (current) => ({
        ...current,
        imageDataUrl: outlineDataUrl,
      }))
      setCollageStudioActiveTool('select')
      setStatus('Stamp outline applied to image layer.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Could not process stamp outline: ${message}`)
    }
  }, [collageStudioSelectedLayer, setStatus, updateCollageStudioLayer])

  const saveCollageStudioDraftSnapshot = useCallback(() => {
    if (!activeCollageStudioDraft) {
      setStatus('Open Collage Studio first to save a draft.')
      return
    }

    const normalizedSystemKey = normalizeCollageStudioSystemKey(activeCollageStudioDraft.systemKey)
    const nextDraft: CollageStudioDraft = {
      ...activeCollageStudioDraft,
      systemKey: normalizedSystemKey,
      updatedAt: Date.now(),
      layers: ensureCollageStudioBaseLayers(activeCollageStudioDraft.layers),
    }

    setActiveCollageStudioDraft(nextDraft)
    setCollageStudioDraftsBySystemKey((previous) => ({
      ...previous,
      [normalizedSystemKey]: nextDraft,
    }))
    setStatus('Saved collage studio draft.')
  }, [activeCollageStudioDraft, setStatus])

  const applyCollageStudioDraftToSystem = useCallback(() => {
    if (!activeCollageStudioDraft) {
      setStatus('Open Collage Studio first to apply a draft.')
      return
    }

    const normalizedSystemKey = normalizeCollageStudioSystemKey(activeCollageStudioDraft.systemKey)
    const nextDraft: CollageStudioDraft = {
      ...activeCollageStudioDraft,
      systemKey: normalizedSystemKey,
      updatedAt: Date.now(),
      layers: ensureCollageStudioBaseLayers(activeCollageStudioDraft.layers),
    }

    void (async () => {
      let nextAppliedBackgroundDataUrl = ''
      try {
        nextAppliedBackgroundDataUrl = await renderCollageStudioDraftToDataUrl(nextDraft)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus(`Could not apply collage draft: ${message}`)
        return
      }

      setActiveCollageStudioDraft(nextDraft)
      setCollageStudioDraftsBySystemKey((previous) => ({
        ...previous,
        [normalizedSystemKey]: nextDraft,
      }))
      setCustomSystemDraft((previous) => ({
        ...previous,
        collageDataUrl: nextAppliedBackgroundDataUrl,
      }))

      const backgroundLayer = nextDraft.layers.find((layer) => layer.kind === 'background')
      if (!nextAppliedBackgroundDataUrl) {
        setStatus('Applied collage studio draft with all visible content cleared.')
      } else if (backgroundLayer?.visible === false) {
        setStatus('Applied collage studio draft with background hidden and overlays preserved.')
      } else {
        setStatus('Applied collage studio draft with layer content.')
      }

      closeCollageStudio()
    })()
  }, [activeCollageStudioDraft, closeCollageStudio, setStatus])

  const resetCollageStudioDraftCanvas = useCallback(() => {
    if (!activeCollageStudioDraft) {
      return
    }

    const resetDraft = createCollageStudioDraft(activeCollageStudioDraft.systemKey)
    setActiveCollageStudioDraft(resetDraft)
    setCollageStudioLivePreviewDataUrl('')
    setCollageStudioEditingTextTarget(null)
    collageStudioCanvasPointerIdRef.current = null
    collageStudioActiveStrokeRef.current = null
    collageStudioActiveEraserLayerIdRef.current = null
    collageStudioActiveTransformRef.current = null
    setStatus('Reset collage studio canvas.')
  }, [activeCollageStudioDraft, setStatus])

  const uploadCustomSystemCollage = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      playSettingsSound('error')
      setStatus('Please choose an image file for the system collage.')
      return
    }

    try {
      const dataUrl = await dataUrlFromFile(file)
      setCustomSystemDraft((previous) => ({
        ...previous,
        collageDataUrl: dataUrl,
      }))
      pulseCustomSystemUploadFlash('collage')
      setStatus('Updated custom system collage image.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      playSettingsSound('error')
      setStatus(`Could not load collage image: ${message}`)
    }
  }, [playSettingsSound, pulseCustomSystemUploadFlash, setStatus])

  const uploadCustomSystemIcon = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      playSettingsSound('error')
      setStatus('Please choose an image file for the system icon.')
      return
    }

    try {
      const dataUrl = await dataUrlFromFile(file)
      setCustomSystemDraft((previous) => ({
        ...previous,
        iconPath: dataUrl,
      }))
      pulseCustomSystemUploadFlash('icon')
      setStatus('Updated custom system icon.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      playSettingsSound('error')
      setStatus(`Could not load icon image: ${message}`)
    }
  }, [playSettingsSound, pulseCustomSystemUploadFlash, setStatus])

  const saveCustomSystemDraftEntry = useCallback(() => {
    const name = sanitizeCustomSystemName(customSystemDraft.name)
    if (!name) {
      playSettingsSound('error')
      setStatus('System name is required before saving.')
      return
    }

    const rawKeyCandidate = buildCustomSystemKey(name, new Set())
    if (BUILT_IN_SYSTEM_CATEGORY_KEYS.has(rawKeyCandidate)) {
      playSettingsSound('error')
      setStatus(`"${name}" is a built-in system. Choose a different custom system name.`)
      return
    }

    const hasDuplicateName = customSystems.some((system) => {
      if (editingCustomSystemId && system.id === editingCustomSystemId) {
        return false
      }

      return system.name.trim().toLowerCase() === name.toLowerCase()
    })

    if (hasDuplicateName) {
      playSettingsSound('error')
      setStatus(`A custom system named "${name}" already exists.`)
      return
    }

    const iconPath = customSystemDraft.iconPath.trim()
    const accentPrimary = normalizeHexColor(customSystemDraft.accentPrimary, DEFAULT_CUSTOM_SYSTEM_PRIMARY)
    const accentSecondary = normalizeHexColor(customSystemDraft.accentSecondary, DEFAULT_CUSTOM_SYSTEM_SECONDARY)
    const rules = {
      includeSources: splitMultilineValues(customSystemDraft.includeSourcesText),
      includePathHints: splitMultilineValues(customSystemDraft.includePathHintsText),
      includeExtensions: splitMultilineValues(customSystemDraft.includeExtensionsText),
    }
    const now = Date.now()

    if (editingCustomSystemId) {
      const editingKey = editingCustomSystem?.key ?? null
      let didUpdate = false

      setCustomSystems((previous) => {
        const next = previous.map((system) => {
          if (system.id !== editingCustomSystemId) {
            return system
          }

          didUpdate = true
          return {
            ...system,
            name,
            shortLabel: deriveCustomSystemShortLabel(name),
            iconPath,
            collageDataUrl: customSystemDraft.collageDataUrl.trim(),
            accentPrimary,
            accentSecondary,
            description: customSystemDraft.description.trim(),
            ingestionMode: customSystemDraft.ingestionMode,
            rules,
            updatedAt: now,
          }
        })

        next.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }))
        return next
      })

      if (didUpdate && editingKey) {
        setSystemGradientMap((previous) => ({
          ...previous,
          [editingKey]: toCustomSystemDraftGradient(customSystemDraft),
        }))
      }

      setCustomSystemDraft((previous) => ({
        ...previous,
        name,
        iconPath,
        collageDataUrl: customSystemDraft.collageDataUrl.trim(),
        accentPrimary,
        accentSecondary,
        description: customSystemDraft.description.trim(),
      }))
      playSettingsSound('switchOption')
      setCustomSystemSaveAckKey((previous) => previous + 1)
      setStatus(`Updated custom system: ${name}.`)
    } else {
      const key = buildCustomSystemKey(name, new Set(reservedSystemKeys))
      const newSystem: CustomSystemDefinition = {
        id: crypto.randomUUID(),
        key,
        name,
        shortLabel: deriveCustomSystemShortLabel(name),
        iconPath,
        collageDataUrl: customSystemDraft.collageDataUrl.trim(),
        accentPrimary,
        accentSecondary,
        description: customSystemDraft.description.trim(),
        hidden: false,
        ingestionMode: customSystemDraft.ingestionMode,
        rules,
        createdAt: now,
        updatedAt: now,
      }

      setCustomSystems((previous) => {
        const next = [...previous, newSystem]
        next.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }))
        return next
      })
      setSystemGradientMap((previous) => ({
        ...previous,
        [key]: toCustomSystemDraftGradient(customSystemDraft),
      }))
      setActiveCategory(key)
      setIsCustomSystemCreateMode(false)
      setEditingCustomSystemId(newSystem.id)
      setCustomSystemDraft(toCustomSystemDraft(newSystem))
      playSettingsSound('switchOption')
      setCustomSystemSaveAckKey((previous) => previous + 1)
      setStatus(`Created custom system: ${name}.`)
    }
  }, [
    customSystemDraft,
    customSystems,
    editingCustomSystem,
    editingCustomSystemId,
    playSettingsSound,
    reservedSystemKeys,
    setActiveCategory,
    setStatus,
  ])

  const beginEditingCustomSystem = useCallback((systemId: string) => {
    const target = customSystems.find((system) => system.id === systemId)
    if (!target) {
      return
    }

    playSettingsSound('selectTab')
    setIsCustomSystemCreateMode(false)
    setEditingCustomSystemId(target.id)
    setCustomSystemDraft(toCustomSystemDraft(target))
    setManageSystemsEditorTab('basics')
    setIsCustomSystemRuleEditorExpanded(false)
    setAddGamesTab('systems')
    setIsAddGamesModalOpen(true)
    setStatus(`Editing custom system: ${target.name}.`)
  }, [customSystems, playSettingsSound, setStatus])

  const duplicateCustomSystem = useCallback((systemId: string) => {
    const source = customSystems.find((system) => system.id === systemId)
    if (!source) {
      return
    }

    const duplicateName = `${source.name} Copy`
    const duplicateKey = buildCustomSystemKey(duplicateName, new Set(reservedSystemKeys))
    const now = Date.now()
    const duplicate: CustomSystemDefinition = {
      ...source,
      id: crypto.randomUUID(),
      key: duplicateKey,
      name: duplicateName,
      shortLabel: deriveCustomSystemShortLabel(duplicateName),
      hidden: false,
      createdAt: now,
      updatedAt: now,
    }

    setCustomSystems((previous) => {
      const next = [...previous, duplicate]
      next.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }))
      return next
    })

    setSystemGradientMap((previous) => ({
      ...previous,
      [duplicateKey]: previous[source.key] ?? toCustomSystemDraftGradient(toCustomSystemDraft(duplicate)),
    }))

    setSystemGradientAnimationMap((previous) => {
      const sourceAnimation = previous[source.key]
      if (!sourceAnimation) {
        return previous
      }

      return {
        ...previous,
        [duplicateKey]: { ...sourceAnimation },
      }
    })

    setStatus(`Duplicated custom system: ${source.name}.`)
  }, [customSystems, reservedSystemKeys, setStatus])

  const toggleCustomSystemHidden = useCallback((systemId: string) => {
    let nextHidden = false
    let systemName = ''
    let systemKey = ''

    setCustomSystems((previous) => previous.map((system) => {
      if (system.id !== systemId) {
        return system
      }

      nextHidden = !system.hidden
      systemName = system.name
      systemKey = system.key

      return {
        ...system,
        hidden: nextHidden,
        updatedAt: Date.now(),
      }
    }))

    if (nextHidden && systemKey && activeCategory === systemKey) {
      setActiveCategory('all')
    }

    setStatus(nextHidden ? `Hid custom system: ${systemName}.` : `Unhid custom system: ${systemName}.`)
  }, [activeCategory, setActiveCategory, setStatus])

  const deleteCustomSystem = useCallback((systemId: string) => {
    const removed = customSystems.find((system) => system.id === systemId)

    if (!removed) {
      return
    }

    const removedKey = removed.key
    setCustomSystems((previous) => previous.filter((system) => system.id !== systemId))

    if (editingCustomSystemId === removed.id) {
      resetCustomSystemEditor()
    }

    if (activeCategory === removedKey) {
      setActiveCategory('all')
    }

    setSystemGradientMap((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, removedKey)) {
        return previous
      }

      const next = { ...previous }
      delete next[removedKey]
      return next
    })

    setSystemGradientAnimationMap((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, removedKey)) {
        return previous
      }

      const next = { ...previous }
      delete next[removedKey]
      return next
    })

    setCustomSystemAutoSortExclusionsBySystemKey((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, removedKey)) {
        return previous
      }

      const next = { ...previous }
      delete next[removedKey]
      return next
    })

    setStatus(`Deleted custom system: ${removed.name}.`)
  }, [activeCategory, customSystems, editingCustomSystemId, resetCustomSystemEditor, setActiveCategory, setStatus])

  const exportCustomSystem = useCallback(async (systemId: string) => {
    const system = customSystems.find((entry) => entry.id === systemId)
    if (!system || typeof window === 'undefined') {
      return
    }

    const payload = JSON.stringify(system, null, 2)
    const safeFileName = system.key.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-')

    try {
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${safeFileName || 'custom-system'}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
      setStatus(`Exported ${system.name} as JSON.`)
    } catch {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
        setStatus(`Copied ${system.name} JSON to clipboard.`)
        return
      }

      setStatus(`Could not export ${system.name}.`)
    }
  }, [customSystems, setStatus])

  const resetCoverThumbnailDiagnosticsCache = useCallback(async () => {
    if (isCoverCacheResetBusy) {
      return
    }

    setIsCoverCacheResetBusy(true)
    setStatus('Resetting cover thumbnail cache...')

    try {
      const result = await clearCoverThumbnailCache({ hard: false })

      setCoverArtByGame({})
      setCoverArtThumbByGame({})
      setCoverArtMetaByGame({})
      setCoverSourceByGame({})
      setGridRuntimeDiagnostics(null)
      setCoverArtStatusByGame(() => {
        const next: Record<string, CoverArtStatus> = {}
        for (const entry of library) {
          next[entry.id] = customCoverByGame[entry.id] ? 'success' : 'pending'
        }
        return next
      })

      refreshCoverLookup()
      setStatus(`Cover cache reset complete: removed ${result.removedEntries} entries.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Cover cache reset failed: ${message}`)
    } finally {
      setIsCoverCacheResetBusy(false)
    }
  }, [
    customCoverByGame,
    isCoverCacheResetBusy,
    library,
    refreshCoverLookup,
    setCoverArtByGame,
    setCoverArtMetaByGame,
    setCoverArtStatusByGame,
    setCoverArtThumbByGame,
    setCoverSourceByGame,
    setStatus,
  ])

  useEffect(() => {
    if (didStartBackgroundIndexRef.current) {
      return
    }

    if (activeTab !== 'launcher') {
      return
    }

    if (localStorage.getItem(BACKGROUND_INDEX_PENDING_KEY) !== '1') {
      return
    }

    didStartBackgroundIndexRef.current = true
    localStorage.removeItem(BACKGROUND_INDEX_PENDING_KEY)
    void autoImportGames()
  }, [activeTab, autoImportGames])

  useEffect(() => {
    if (sceneBackdropVisual === currentBackdropArt) {
      return
    }

    backdropTransitionTokenRef.current += 1
    const transitionToken = backdropTransitionTokenRef.current

    if (backdropFadeTimerRef.current !== null) {
      window.clearTimeout(backdropFadeTimerRef.current)
      backdropFadeTimerRef.current = null
    }

    if (backdropFadeFrameRef.current !== null) {
      window.cancelAnimationFrame(backdropFadeFrameRef.current)
      backdropFadeFrameRef.current = null
    }

    if (!currentBackdropArt) {
      if (transitionToken === backdropTransitionTokenRef.current) {
        setCurrentBackdropArt(sceneBackdropVisual)
        setPreviousBackdropArt(undefined)
        setBackdropFadePhase('idle')
      }
      return
    }

    if (transitionToken === backdropTransitionTokenRef.current) {
      setPreviousBackdropArt(currentBackdropArt)
      setCurrentBackdropArt(sceneBackdropVisual)
      setBackdropFadePhase('prepare')
    }

    backdropFadeFrameRef.current = window.requestAnimationFrame(() => {
      backdropFadeFrameRef.current = window.requestAnimationFrame(() => {
        if (transitionToken !== backdropTransitionTokenRef.current) {
          backdropFadeFrameRef.current = null
          return
        }

        setBackdropFadePhase('fade')
        backdropFadeFrameRef.current = null
      })
    })

    backdropFadeTimerRef.current = window.setTimeout(() => {
      if (transitionToken !== backdropTransitionTokenRef.current) {
        backdropFadeTimerRef.current = null
        return
      }

      setPreviousBackdropArt(undefined)
      setBackdropFadePhase('idle')
      backdropFadeTimerRef.current = null
    }, BACKDROP_FADE_DURATION_MS)
  }, [sceneBackdropVisual, currentBackdropArt])

  useEffect(() => {
    return () => {
      if (backdropFadeTimerRef.current !== null) {
        window.clearTimeout(backdropFadeTimerRef.current)
      }

      if (backdropFadeFrameRef.current !== null) {
        window.cancelAnimationFrame(backdropFadeFrameRef.current)
      }

      if (gamesViewSwitchTimerRef.current !== null) {
        window.clearTimeout(gamesViewSwitchTimerRef.current)
      }

      if (systemReturnTimerRef.current !== null) {
        window.clearTimeout(systemReturnTimerRef.current)
      }

      if (sceneRouteTransitionTimerRef.current !== null) {
        window.clearTimeout(sceneRouteTransitionTimerRef.current)
      }

      if (sceneTrailFadeTimerRef.current !== null) {
        window.clearTimeout(sceneTrailFadeTimerRef.current)
      }

      if (sceneTrailFrameRef.current !== null) {
        window.cancelAnimationFrame(sceneTrailFrameRef.current)
      }
      pendingScenePointerRef.current = null

      if (scrollGlassResetTimerRef.current !== null) {
        window.clearTimeout(scrollGlassResetTimerRef.current)
      }

      if (applyGlassFrameRef.current !== null) {
        window.cancelAnimationFrame(applyGlassFrameRef.current)
      }
      pendingGlassWeightRef.current = null

      if (gameStackMomentumSettleTimerRef.current !== null) {
        window.clearTimeout(gameStackMomentumSettleTimerRef.current)
      }

      if (systemStackMomentumTimerRef.current !== null) {
        window.clearTimeout(systemStackMomentumTimerRef.current)
      }
      if (categoryScrollRef.current) {
        categoryScrollRef.current.style.setProperty('--stack-scroll-strength', '0')
        categoryScrollRef.current.style.setProperty('--stack-scroll-direction', '0')
      }

      if (gameStackMomentumFrameRef.current !== null) {
        window.cancelAnimationFrame(gameStackMomentumFrameRef.current)
      }
      gameStackWheelAccumulatorRef.current = 0
      gameStackScrollDirectionRef.current = 1
      gameStackLastStepAtRef.current = 0

      if (launchWipeTimerRef.current !== null) {
        window.clearTimeout(launchWipeTimerRef.current)
      }

      for (const timer of gameClickEffectTimersRef.current) {
        window.clearTimeout(timer)
      }
      gameClickEffectTimersRef.current = []

      if (plipAudioContextRef.current) {
        if (rainBedSourceRef.current) {
          rainBedSourceRef.current.stop()
          rainBedSourceRef.current.disconnect()
          rainBedSourceRef.current = null
        }

        if (rainBedFilterRef.current) {
          rainBedFilterRef.current.disconnect()
          rainBedFilterRef.current = null
        }

        if (rainBedGainRef.current) {
          rainBedGainRef.current.disconnect()
          rainBedGainRef.current = null
        }

        void plipAudioContextRef.current.close()
        plipAudioContextRef.current = null
      }
    }
  }, [])

  const systemsRouteTransitionClass = sceneRouteTransition === 'to-systems' ? 'route-transition route-transition-to-systems' : ''
  const gamesRouteTransitionClass = sceneRouteTransition === 'to-games' ? 'route-transition route-transition-to-games' : ''
  const sceneRouteTransitionClass = sceneRouteTransition ? `is-route-transition ${sceneRouteTransition}` : ''
  const sceneBaseClassName = `wii-scene view-${launcherView} brand-${sceneBrandKey}`
    + ((launcherView === 'games' || launcherView === 'systems') ? ' has-functions-bar' : '')
    + (isStartupVisualTierActive ? ' is-startup-visual-tier' : '')
    + (isSystemsPerformanceLite ? ' is-systems-performance-lite' : '')
    + (isGamesPerformanceLite ? ' is-games-performance-lite' : '')
    + (isGridLargeViewportPerformanceLite ? ' is-grid-large-viewport-lite' : '')
    + (launcherFidelityFlags.isFidelityLite ? ' is-fidelity-lite' : '')
    + (launcherFidelityFlags.isFidelityUltraLite ? ' is-fidelity-ultra-lite' : '')
  const shouldRenderRuntimeBackdrop = launcherFidelityFlags.shouldRenderRuntimeBackdrop

  const addGamesSystemsPanelProps = useMemo(
    () => buildAddGamesSystemsPanelProps({
      manageSystemsSearch,
      manageSystemsFilter,
      manageSystemsVisibleList,
      editingCustomSystemId,
      customSystemDraft,
      customSystemDraftDisplayName,
      customSystemDraftPrimaryColor,
      customSystemDraftSecondaryColor,
      customSystemPreviewKey,
      customSystemPreviewShortLabel,
      editingCustomSystemHidden: Boolean(editingCustomSystem?.hidden),
      manageSystemsEditorTab,
      customSystemNameError,
      isCustomSystemDraftDirty,
      isCustomSystemRuleEditorExpanded,
      templates: CUSTOM_SYSTEM_TEMPLATES.map((entry) => ({ key: entry.key, name: entry.name })),
      rulePresets: CUSTOM_SYSTEM_RULE_PRESETS.map((entry) => ({ key: entry.key, label: entry.label })),
      isDebugMenuVisible,
      debug: isDebugMenuVisible ? {
        debugSystemImportKey,
        debugSystemImportOptions,
        selectedDebugPresetDescription: selectedDebugSystemImportPreset?.description ?? '',
        simulatedImportEnabled,
        simulatedImportSourcePreset,
        simulatedImportProfilePreset,
        simulatedImportQuantity,
        simulatedImportIncludeDuplicateIds,
        simulatedImportMissingBoxArt,
        simulatedImportInvalidPaths,
        simulatedImportWeirdFileNames,
        simulatedImportNonEnglishTitles,
        simulatedImportVeryLongTitles,
        simulatedImportSummary,
        simulatedImportPreviewRows: simulatedImportPreviewRows.map((row) => ({
          id: row.id,
          title: row.title,
          platform: row.platform,
          sourceLabel: row.sourceLabel,
          pathValidity: row.pathValidity,
          duplicate: row.duplicate,
        })),
        simulatedImportSourcePresets: SIMULATED_IMPORT_SOURCE_PRESETS,
        simulatedImportProfilePresets: SIMULATED_IMPORT_PROFILE_PRESETS,
        onDebugSystemImportKeyChange: setDebugSystemImportKey,
        onImportDebugSystemPreset: importDebugSystemPreset,
        onSimulatedImportEnabledChange: setSimulatedImportEnabled,
        onSimulatedImportSourcePresetChange: (value) => setSimulatedImportSourcePreset(value as SimulatedImportSourcePreset),
        onSimulatedImportProfilePresetChange: (value) => setSimulatedImportProfilePreset(value as SimulatedImportProfilePreset),
        onSimulatedImportQuantityChange: setSimulatedImportQuantity,
        onSimulatedImportIncludeDuplicateIdsChange: setSimulatedImportIncludeDuplicateIds,
        onSimulatedImportMissingBoxArtChange: setSimulatedImportMissingBoxArt,
        onSimulatedImportInvalidPathsChange: setSimulatedImportInvalidPaths,
        onSimulatedImportWeirdFileNamesChange: setSimulatedImportWeirdFileNames,
        onSimulatedImportNonEnglishTitlesChange: setSimulatedImportNonEnglishTitles,
        onSimulatedImportVeryLongTitlesChange: setSimulatedImportVeryLongTitles,
        onGenerateSimulatedImportPreview: generateSimulatedImportPreview,
        onImportSimulatedPreviewRows: importSimulatedPreviewRows,
        onClearSimulatedImports: clearSimulatedImports,
      } : undefined,
      setManageSystemsSearch,
      setManageSystemsFilter,
      beginEditingCustomSystem,
      duplicateCustomSystem,
      toggleCustomSystemHidden,
      exportCustomSystem,
      deleteCustomSystem,
      applyCustomSystemTemplate,
      setManageSystemsEditorTab: handleManageSystemsEditorTabChange,
      saveCustomSystemDraftEntry,
      resetCustomSystemEditor,
      setCustomSystemDraft,
      uploadCustomSystemIcon,
      uploadCustomSystemCollage,
      openCollageStudio,
      applyCustomSystemRulePreset,
      setIsCustomSystemRuleEditorExpanded,
      openCreateSystemFlow,
      isCustomSystemCreateMode,
      customSystemNameFocusKey,
      customSystemSaveAckKey,
      customSystemUploadFlash,
    }),
    [
      applyCustomSystemRulePreset,
      applyCustomSystemTemplate,
      beginEditingCustomSystem,
      clearSimulatedImports,
      customSystemDraft,
      customSystemDraftDisplayName,
      customSystemDraftPrimaryColor,
      customSystemDraftSecondaryColor,
      customSystemNameError,
      customSystemPreviewKey,
      customSystemPreviewShortLabel,
      debugSystemImportKey,
      debugSystemImportOptions,
      deleteCustomSystem,
      duplicateCustomSystem,
      editingCustomSystem,
      editingCustomSystemId,
      exportCustomSystem,
      generateSimulatedImportPreview,
      importDebugSystemPreset,
      importSimulatedPreviewRows,
      isCustomSystemDraftDirty,
      isCustomSystemCreateMode,
      isCustomSystemRuleEditorExpanded,
      customSystemNameFocusKey,
      customSystemSaveAckKey,
      customSystemUploadFlash,
      handleManageSystemsEditorTabChange,
      isDebugMenuVisible,
      manageSystemsEditorTab,
      manageSystemsFilter,
      manageSystemsSearch,
      manageSystemsVisibleList,
      openCollageStudio,
      openCreateSystemFlow,
      resetCustomSystemEditor,
      saveCustomSystemDraftEntry,
      selectedDebugSystemImportPreset,
      simulatedImportEnabled,
      simulatedImportIncludeDuplicateIds,
      simulatedImportInvalidPaths,
      simulatedImportMissingBoxArt,
      simulatedImportNonEnglishTitles,
      simulatedImportPreviewRows,
      simulatedImportProfilePreset,
      simulatedImportQuantity,
      simulatedImportSourcePreset,
      simulatedImportSummary,
      simulatedImportVeryLongTitles,
      simulatedImportWeirdFileNames,
      toggleCustomSystemHidden,
      uploadCustomSystemCollage,
      uploadCustomSystemIcon,
    ],
  )

  return (
    <>
      {shouldRenderRuntimeBackdrop && <AppearanceRuntimeBackdrop theme={appearanceTheme.effectiveTheme} />}
      <SystemThemeProvider accentKey={sidebarAccentKey}>
        <div
          className={`app-shell ${activeTab === 'launcher' ? 'launcher-active' : ''}`}
          style={appShellThemeStyle}
          data-tm-fidelity={effectiveGraphicsFidelity}
        >
        <TitleBar
          activeTab={activeTab}
          controlsOnly={isSetupMode}
          showViewModeToggle={false}
          isGridView={isGridView}
          rungoGraphicsFidelity={effectiveGraphicsFidelity}
          frameBudgetHint={isFrameBudgetHintLow ? 'low' : 'ok'}
          signatureRungoId={signatureRungoId}
          signatureRungoName={signatureRungo?.name ?? ''}
          signatureRungoPreviewSheetUrl={signatureRungo?.previewSheetUrl ?? ''}
          onToggleViewMode={toggleGamesViewMode}
          switchTab={switchTab}
          onRerunOnboarding={rerunOnboarding}
          showProfileAvatarImage={!isSetupMode}
          quickSettings={quickSettingsBindings}
          onOpenFullSettings={handleOpenFullSettings}
          onProfileUpdate={handleProfileUpdate}
          onOpenPlaytimeHub={() => openPlaytimeHub()}
          rungoTokenBalance={rungoTokenBalance}
          playtimeClaimableTokens={playtimeTotalClaimableTokens}
          {...(PLAYER_ID_ENABLED
            ? {
                playerIdIdentity,
                playerIdStats,
                playerIdLayout,
                playerIdShowcase,
                playerIdGameOptions,
                playerIdSystemOptions,
                resolveShowcaseForLayout,
              }
            : {})}
        />
        {!isSetupMode && PLAYER_ID_ENABLED && activeTab === 'launcher' && (
          <PlayerIdOverlay
            identity={playerIdIdentity}
            stats={playerIdStats}
            layout={playerIdLayout}
            showcase={playerIdShowcase}
            signatureRungoId={signatureRungoId}
          />
        )}
        {!isSetupMode && activeTab !== 'profile' && activeTab !== 'settings' && (
          <TopBar
            connectorHealth={connectorHealth}
            onSelectConnectorFix={applyConnectorFixAction}
          />
        )}
        {!isSetupMode && (
          <>
      {activeTab === 'launcher' && (
        <div className="launcher-layout">
          <div className="launcher-main">
            <section
              className={
                sceneRouteTransitionClass
                  ? `${sceneBaseClassName} ${sceneRouteTransitionClass}`
                  : sceneBaseClassName
              }
              ref={sceneRef}
              onPointerMove={handleScenePointerMove}
            >
              <div className="wii-backdrop" aria-hidden="true">
                <div
                  className={
                    currentBackdropArt
                      ? backdropFadePhase === 'prepare'
                        ? 'wii-backdrop-layer current is-preparing'
                        : backdropFadePhase === 'fade'
                          ? 'wii-backdrop-layer current is-fading'
                          : 'wii-backdrop-layer current'
                      : 'wii-backdrop-layer current is-empty'
                  }
                  style={currentBackdropArt ? { backgroundImage: currentBackdropArt } : undefined}
                />
                <div
                  className={
                    previousBackdropArt
                      ? backdropFadePhase === 'fade'
                        ? 'wii-backdrop-layer previous is-fading'
                        : 'wii-backdrop-layer previous'
                      : 'wii-backdrop-layer previous is-empty'
                  }
                  style={previousBackdropArt ? { backgroundImage: previousBackdropArt } : undefined}
                />
                <div className="rain-layer home-wave-layer" />
                <div className="rain-layer home-gradient-accent-layer" />
                <div className="rain-layer summer-gradient-base" />
                <div className="rain-layer ambient-gradient-layer" />
                <div className="rain-layer rain-bg" />
                {launcherFidelityFlags.shouldMountDecorativeRainLayers && (
                  <>
                    <div className="rain-layer summer-wave-layer" />
                    <div className="rain-layer rain-mid" />
                    <div className="rain-layer summer-motif-layer motif-beachball" />
                    <div className="rain-layer summer-sunbeam-layer" />
                  </>
                )}
              </div>
              {launcherFidelityFlags.shouldRenderFloatingAmbient && (launcherView === 'systems' || launcherView === 'games') ? (
                <FloatingSystemLogos
                  categories={systemCategories}
                  brandKey={sceneBrandKey}
                  gradient={ambientSceneTheme.gradient}
                  themeTokens={ambientSceneTheme.tokens}
                  reducedMotion={launcherFidelityFlags.floatingAmbientReduced}
                />
              ) : null}
              <div className="condensation-trail" aria-hidden="true" />
              <div
                className={isLaunchWipeActive ? 'launch-wipe-overlay is-active' : 'launch-wipe-overlay'}
                aria-hidden="true"
              />

              {(launcherView === 'games' || launcherView === 'systems') && (
                <LauncherFunctionsBar
                  isSystemsView={launcherView === 'systems'}
                  systemsViewMode={systemsViewMode}
                  systemsGridSortMode={systemsGridSortMode}
                  systemsGridSizeMode={systemsGridSizeMode}
                  systemsSearch={systemsSearch}
                  systemsHasSearchQuery={systemsHasSearchQuery}
                  systemsSearchResultCount={systemsSearchResultCount}
                  systemsSearchMatches={systemsSearchMatches}
                  isGridView={isGridView}
                  isImporting={isImporting}
                  search={search}
                  hasSearchQuery={hasSearchQuery}
                  searchResultCount={searchResultCount}
                  isSearchFocused={isSearchFocused}
                  focusedGameIndex={focusedGameIndex}
                  scrollVisibleGamesLength={scrollVisibleGames.length}
                  systemCategories={launcherView === 'systems' ? sortedSystemsSceneCategories : systemCategories}
                  activeCategory={activeCategory}
                  gridSortOptions={gridSortOptions}
                  gridSortMode={gridSortMode}
                  gridGroupMode={gridGroupMode}
                  gridSizeMode={gridSizeMode}
                  hasVisibleFavoriteGame={hasVisibleFavoriteGame}
                  letterJumpTargets={letterJumpTargets}
                  activeSystemLabel={selectedSystem?.label ?? 'Current system'}
                  onSearchChange={setSearch}
                  onSystemsSearchChange={setSystemsSearch}
                  onSearchFocusChange={setIsSearchFocused}
                  onBackToSystems={backToSystems}
                  onStopGameStackMomentum={stopGameStackMomentum}
                  onStepFocusedGame={stepFocusedGame}
                  onFocusGameByIndex={focusGameByIndex}
                  onJumpToTopGame={jumpToTopGame}
                  onJumpToBottomGame={jumpToBottomGame}
                  onJumpToFavoriteGame={jumpToFavoriteGame}
                  onJumpToLetter={jumpToLetter}
                  onOpenAddGames={openAddGamesModal}
                  onSelectCategory={setActiveCategory}
                  onSetGridSortMode={setGridSortMode}
                  onSetGridGroupMode={setGridGroupMode}
                  onSetGridSizeMode={setGridSizeMode}
                  onToggleSystemsViewMode={toggleSystemsViewMode}
                  onSetSystemsGridSortMode={setSystemsGridSortMode}
                  onSetSystemsGridSizeMode={setSystemsGridSizeMode}
                  onToggleViewMode={toggleGamesViewMode}
                  onAutoImport={() => {
                    void autoImportGames()
                  }}
                  onOpenManageSystems={openManageSystems}
                  onOpenCreateSystem={openCreateSystemFlow}
                  onPlayUiHoverSound={playFunctionsBarHoverSound}
                  onPlayUiSelectSound={playFunctionsBarUiSound}
                  showGamepadPrompts={launcherInputMode === 'gamepad'}
                  gamepadPromptByControl={functionsBarPromptByControl}
                />
              )}

              {launcherInputMode === 'gamepad' && !isQuickOverlayOpen && !isControllerVirtualKeyboardOpen && (
                <div
                  className={gamepadPromptHudVisibility === 'idle' ? 'launcher-gamepad-prompt-hud is-idle' : 'launcher-gamepad-prompt-hud'}
                  role="status"
                  aria-live="polite"
                  aria-label="Controller prompts"
                >
                  {controllerPromptEntries.map((entry) => (
                    <div key={`controller-prompt-${entry.id}`} className="launcher-gamepad-prompt-chip">
                      <span className="launcher-gamepad-prompt-input">{entry.inputLabel}</span>
                      <span className="launcher-gamepad-prompt-label">{entry.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {isControllerVirtualKeyboardOpen && (
                <div className="launcher-controller-keyboard-backdrop" role="presentation">
                  <section className="launcher-controller-keyboard" role="dialog" aria-modal="true" aria-label={`Controller keyboard for ${controllerVirtualKeyboardFieldLabel}`}>
                    <p className="launcher-controller-keyboard-kicker">Controller Keyboard</p>
                    <strong className="launcher-controller-keyboard-title">{controllerVirtualKeyboardFieldLabel}</strong>
                    <div className="launcher-controller-keyboard-preview" aria-live="polite">{controllerVirtualKeyboardValue || ' '}</div>

                    <div className="launcher-controller-keyboard-grid" role="group" aria-label="On-screen keyboard">
                      {CONTROLLER_VIRTUAL_KEYBOARD_ROWS.map((row, rowIndex) => (
                        <div key={`controller-vk-row-${rowIndex}`} className="launcher-controller-keyboard-row">
                          {row.map((key, columnIndex) => {
                            const isActive = rowIndex === controllerVirtualKeyboardCursorRow && columnIndex === controllerVirtualKeyboardCursorColumn
                            const isWide = key.action === 'space'
                            return (
                              <button
                                key={key.id}
                                type="button"
                                className={isActive ? `launcher-controller-key ${isWide ? 'is-wide is-active' : 'is-active'}` : (isWide ? 'launcher-controller-key is-wide' : 'launcher-controller-key')}
                                tabIndex={-1}
                                onClick={() => {
                                  setControllerVirtualKeyboardCursorRow(rowIndex)
                                  setControllerVirtualKeyboardCursorColumn(columnIndex)
                                  activateControllerVirtualKeyboardKey()
                                }}
                                aria-pressed={key.action === 'shift' ? controllerVirtualKeyboardShiftActive : undefined}
                              >
                                {key.label}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>

                    <p className="launcher-controller-keyboard-hint">D-pad or stick to move, Select to type, Back to save and close, Start to save and close.</p>
                  </section>
                </div>
              )}

              {activeTab === 'launcher' && gamepadPopup && !isQuickOverlayOpen && (
                <div
                  className={gamepadPopup.isExiting ? 'launcher-controller-popup is-exiting' : 'launcher-controller-popup'}
                  style={{
                    ['--controller-popup-accent' as string]: getSelectionAccentGradient(sidebarAccentKey),
                  }}
                  role="status"
                  aria-live="polite"
                >
                  <p className="launcher-controller-popup-kicker">Controller Connected</p>
                  <strong>{gamepadPopup.label}</strong>
                  <p className="launcher-controller-popup-subtitle">
                    {gamepadPopup.family === 'playstation'
                      ? 'PlayStation layout ready'
                      : gamepadPopup.family === 'nintendo'
                        ? 'Nintendo layout ready'
                        : gamepadPopup.family === 'xbox'
                          ? 'Xbox layout ready'
                          : 'Generic layout ready'}
                  </p>
                </div>
              )}

              {activeTab === 'launcher' && isQuickOverlayOpen && (
                <div className="launcher-quick-overlay-backdrop" role="presentation">
                  <section className="launcher-quick-overlay" role="dialog" aria-modal="true" aria-label="Quick overlay">
                    <p className="launcher-quick-overlay-kicker">Quick Overlay</p>
                    <strong className="launcher-quick-overlay-title">Shift + -</strong>
                    <p className="launcher-quick-overlay-subtitle">
                      Pick an action with keyboard or controller. Mode: {STEAM_COEXISTENCE_MODE_LABELS[steamControllerCoexistenceMode]}.
                    </p>

                    <div className="launcher-quick-overlay-actions" role="menu" aria-label="Quick overlay actions">
                      {quickOverlayActions.map((action, index) => {
                        const isActive = index === quickOverlaySelectionIndex
                        return (
                          <button
                            key={`quick-overlay-action-${action.id}`}
                            type="button"
                            className={isActive ? 'launcher-quick-overlay-action is-active' : 'launcher-quick-overlay-action'}
                            role="menuitem"
                            onMouseEnter={() => {
                              setQuickOverlaySelectionIndex(index)
                            }}
                            onClick={() => {
                              executeQuickOverlayAction(action.id)
                            }}
                          >
                            <span className="launcher-quick-overlay-action-label">{action.label}</span>
                            <span className="launcher-quick-overlay-action-description">{action.description}</span>
                          </button>
                        )
                      })}
                    </div>

                    <p className="launcher-quick-overlay-hint">Arrows / D-pad to move, Enter or A to confirm, Esc or B to close.</p>
                  </section>
                </div>
              )}

              {launcherView === 'games' && !isDebugMenuVisible && (
                <div className="games-top-spacer" aria-hidden="true" />
              )}

              {launcherView === 'games' && isDebugMenuVisible && (
                <div className="wii-top-strip wii-top-strip-diagnostics">
                  <div className="games-quick-controls" aria-label="Cover diagnostics">
                    <div className="games-cover-diagnostics" role="status" aria-live="polite" aria-label="Cover art diagnostics">
                      <div className="games-cover-diagnostics-summary">
                        <span className="games-cover-diagnostics-title">Cover Diagnostics</span>
                        <span>{`Art ${coverDiagnostics.overall.withArt}/${coverDiagnostics.overall.total}`}</span>
                        <span>{`Ready ${coverDiagnostics.readyPercent}%`}</span>
                        <span>{`Queue ${coverDiagnostics.overall.activeQueue}`}</span>
                        <span>{`Fail ${coverDiagnostics.overall.failures}`}</span>
                        <button
                          type="button"
                          className={isCoverCacheResetBusy ? 'game-jump-chip is-disabled' : 'game-jump-chip'}
                          onClick={() => {
                            void resetCoverThumbnailDiagnosticsCache()
                          }}
                          disabled={isCoverCacheResetBusy}
                          title="Clear cached cover thumbnails and rerun cover lookup"
                        >
                          {isCoverCacheResetBusy ? 'Resetting Cache...' : 'Reset Cache'}
                        </button>
                      </div>

                      <div className="games-cover-diagnostics-runtime" aria-label="Runtime diagnostics">
                        <span>{`Perf ${performanceLiteLabel}`}</span>
                        <span>{`Frame ${frameDiagnosticsLabel}`}</span>
                        <span>{`Grid ${gridDiagnosticsLabel}`}</span>
                        <span>{`GridNav ${gridNavigationDiagnosticsLabel}`}</span>
                        <span>{`CoverVis ${visibleCoverDiagnosticsLabel}`}</span>
                        <span>{`CoverQ ${coverQualityDiagnosticsLabel}`}</span>
                        <span>{`CoverTier ${sourceTierDiagnosticsLabel}`}</span>
                        <span>{`CoverSusp ${sourceSuspicionDiagnosticsLabel}`}</span>
                        <span>{`Scroll ${scrollDiagnosticsLabel}`}</span>
                        <span>{`Slice ${sliceDiagnosticsLabel}`}</span>
                        <span>{`Lifecycle ${lifecycleDiagnosticsLabel}`}</span>
                        <span>{`Mismatch ${mismatchDiagnosticsLabel}`}</span>
                        <span>{`Catalog ${catalogDiagnosticsLabel}`}</span>
                        <span>{`Viewport ${viewportDiagnosticsLabel}`}</span>
                        <span>{`HiddenMedia ${hiddenMediaDebugSummary}`}</span>
                      </div>

                      <div className="games-cover-diagnostics-chips" aria-hidden="true">
                        {coverDiagnostics.rows.map((bucket) => (
                          <span key={`cover-diagnostics-${bucket.key}`} className={`games-cover-diagnostics-chip provider-${bucket.key}`}>
                            <strong>{bucket.label}</strong>
                            <span>{`${bucket.withArt}/${bucket.total}`}</span>
                            <span>{`Q ${bucket.activeQueue}`}</span>
                            <span>{`F ${bucket.failures}`}</span>
                          </span>
                        ))}
                        {hiddenMediaDebugRows.map((entry, index) => (
                          <span key={`hidden-media-debug-${index}`} className="games-cover-diagnostics-chip provider-other">
                            <strong>{entry.label}</strong>
                            <span>{entry.rect}</span>
                            <span>{entry.style}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {launcherView === 'systems' ? (
                <div
                  className={
                    selectedSystem
                      ? `wii-main systems-main${isSystemsGridView ? ' systems-main-grid' : ''} brand-${selectedSystem.key}${systemsRouteTransitionClass ? ` ${systemsRouteTransitionClass}` : ''}`
                      : `wii-main systems-main${isSystemsGridView ? ' systems-main-grid' : ''} brand-all${systemsRouteTransitionClass ? ` ${systemsRouteTransitionClass}` : ''}`
                  }
                >
                  {animateSystemBackToSystems && (
                    <div
                      className={
                        selectedSystem
                          ? animateSystemBackToSystemsCenter
                            ? `mini-system-icon system-entering system-return-overlay brand-${selectedSystem.key}`
                            : `mini-system-icon system-return-overlay brand-${selectedSystem.key}`
                          : animateSystemBackToSystemsCenter
                            ? 'mini-system-icon system-entering system-return-overlay brand-all'
                            : 'mini-system-icon system-return-overlay brand-all'
                      }
                      aria-hidden="true"
                    >
                      {selectedSystem ? (
                        <span className="icon-media">
                          {renderSystemCategoryMark(selectedSystem.key, selectedSystem.logoPath, selectedSystem.label, selectedSystem.short)}
                        </span>
                      ) : (
                        <span className="icon-media">
                          <span>ALL</span>
                        </span>
                      )}
                    </div>
                  )}

                  {!isSystemsGridView ? (
                    <aside className="wii-stack system-stack" aria-label="System selector">
                      <div
                        className={isSystemStackMomentumActive ? 'stack-list is-momentum' : 'stack-list'}
                        ref={categoryScrollRef}
                        onWheel={(event) => {
                          if (event.deltaY === 0) {
                            return
                          }

                          const wheelDelta = Math.abs(event.deltaY)
                          event.preventDefault()
                          applyGlassScrollWeight(event.deltaY > 0 ? 1 : -1, wheelDelta)
                          stepSystem(event.deltaY > 0 ? 1 : -1, wheelDelta)
                        }}
                      >
                        {systemStackEntries.map(({ category, offset }) => {
                          const positionClass =
                            offset <= -2
                              ? 'pos-top-2'
                              : offset === -1
                                ? 'pos-top-1'
                                : offset === 0
                                  ? 'pos-center'
                                  : offset === 1
                                    ? 'pos-bottom-1'
                                    : 'pos-bottom-2'

                          if (!category) {
                            return <span key={`system-empty-${offset}`} className={`stack-slot ${positionClass}`} aria-hidden="true" />
                          }

                          const isFocused = category.key === activeCategory
                          const hasCornerDew = shouldShowCornerDew(category.key)

                          return (
                            <button
                              key={category.key}
                              type="button"
                              style={{ ...buildTileMotionStyle(`system-${category.key}`), position: 'relative' }}
                              className={
                                isFocused
                                  ? hasCornerDew
                                    ? `stack-item system-item has-corner-dew active ${positionClass} brand-${category.key}`
                                    : `stack-item system-item active ${positionClass} brand-${category.key}`
                                  : hasCornerDew
                                    ? `stack-item system-item has-corner-dew ${positionClass} brand-${category.key}`
                                    : `stack-item system-item ${positionClass} brand-${category.key}`
                              }
                              onMouseDown={(event) => {
                                if (event.button !== 0) {
                                  return
                                }

                                handleSystemCardClick(category.key, isFocused)
                              }}
                              onClick={(event) => {
                                if (event.detail !== 0) {
                                  return
                                }

                                handleSystemCardClick(category.key, isFocused)
                              }}
                              onPointerLeave={resetCardPointerMove}
                              onPointerCancel={resetCardPointerMove}
                              onPointerMove={handleCardPointerMove}
                              title={category.label}
                              aria-label={category.label}
                            >
                              <span className="icon-media" style={{ position: 'relative' }}>
                                {renderSystemCategoryMark(category.key, category.logoPath, category.label, category.short)}
                                <span className="tile-glass-accent" aria-hidden="true" />
                                {hasCornerDew && <span className="tile-corner-dew" aria-hidden="true" />}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </aside>
                  ) : (
                    <aside className="wii-stack system-stack system-stack-grid system-grid-gallery-pane" aria-label="System selector">
                      <SystemsGrid
                        tiles={systemsGridTiles}
                        activeCategoryKey={activeCategory}
                        sizeMode={systemsGridSizeMode}
                        renderSystemMark={renderSystemCategoryMark}
                        onTilePointerMove={handleCardPointerMove}
                        onTilePointerLeave={resetCardPointerMove}
                        onTilePointerCancel={resetCardPointerMove}
                        onTileClick={(_event, categoryKey, isFocused) => {
                          handleSystemCardClick(categoryKey, isFocused)
                        }}
                      />
                    </aside>
                  )}

                  <section className={isSystemsGridView ? 'wii-feature system-feature system-detail-column' : 'wii-feature system-feature'}>
                    {selectedSystem ? (
                      <div
                        className={selectedSystemGradient
                          ? `system-focus-block brand-${selectedSystem.key} has-custom-gradient gradient-mode-${selectedSystemApplyMode}`
                          : `system-focus-block brand-${selectedSystem.key}`}
                      >
                        <article className={`feature-card system-hero-card brand-${selectedSystem.key}`}>
                          <span className="system-focus-gloss" aria-hidden="true" />
                          <span className="system-focus-prism" aria-hidden="true" />
                          <span className="system-focus-condensation" aria-hidden="true">
                            <span className="system-focus-drop d1" />
                            <span className="system-focus-drop d2" />
                            <span className="system-focus-drop d3" />
                            <span className="system-focus-drop d4" />
                          </span>
                          <span className="icon-media">
                            {renderSystemCategoryMark(selectedSystem.key, selectedSystem.logoPath, selectedSystem.label, selectedSystem.short)}
                          </span>
                        </article>
                        <div className="feature-copy system-focus-info">
                          <h2>{selectedSystem.label}</h2>
                          <p className="feature-kind system-focus-meta">System Library</p>
                          <p className="feature-target system-focus-meta">{visibleGamesAvailableLabel}</p>

                          <div className="system-focus-pills" aria-label="System metadata">
                            <span className="system-focus-pill system-focus-pill-kind">
                              <span className="system-focus-pill-icon" aria-hidden="true">{'\u25C8'}</span>
                              System Library
                            </span>
                            <span className="system-focus-pill system-focus-pill-count">
                              <span className="system-focus-pill-icon" aria-hidden="true">{'\u25CE'}</span>
                              {visibleGamesCountLabel}
                            </span>
                            <button
                              type="button"
                              className="system-focus-pill system-focus-pill-action"
                              onClick={() => openPlaytimeHub()}
                              title={`${selectedSystem?.label ?? 'Library'} playtime: ${sidebarPlaytimePrimaryText}`}
                              aria-label={`View ${selectedSystem?.label ?? 'Library'} playtime details`}
                            >
                              <span className="system-focus-pill-icon" aria-hidden="true">{'\u23F1'}</span>
                              {sidebarPlaytimePrimaryText}
                            </button>

                            {selectedSystemEmulatorSummary && (
                              <div className="system-emulator-pill-shell">
                                <button
                                  type="button"
                                  className={`system-focus-pill system-focus-pill-action system-emulator-pill system-emulator-pill-${selectedSystemEmulatorSummary.tone}${isSystemEmulatorPopoverOpen ? ' is-open' : ''}`}
                                  onClick={toggleSystemEmulatorPopover}
                                  aria-label={`Emulator for ${selectedSystem.label}: ${selectedSystemEmulatorSummary.label} (${selectedSystemEmulatorSummary.status})`}
                                  title={`Emulator: ${selectedSystemEmulatorSummary.label} (${selectedSystemEmulatorSummary.status})`}
                                  aria-haspopup="dialog"
                                  aria-expanded={isSystemEmulatorPopoverOpen}
                                >
                                  <span className="system-focus-pill-icon" aria-hidden="true">{'\u2699'}</span>
                                  <span className="system-emulator-pill-label">{selectedSystemEmulatorSummary.label}</span>
                                  <span className="system-emulator-pill-state">{selectedSystemEmulatorSummary.status}</span>
                                  <span className="system-emulator-pill-caret" aria-hidden="true">
                                    {isSystemEmulatorPopoverOpen ? '\u25B2' : '\u25BC'}
                                  </span>
                                </button>

                                {isSystemEmulatorPopoverOpen && (
                                  <div className="system-emulator-popover" role="dialog" aria-label={`Emulator settings for ${selectedSystem.label}`}>
                                    <p className="system-emulator-popover-label">
                                      Auto-detected from ROM launch metadata and emulator executable names.
                                    </p>

                                    <p className="system-emulator-popover-note">
                                      {(emulatorPaths[selectedSystemPopoverEmulatorKey] ?? '').trim().length > 0
                                        ? `${emulatorLabelByKey[selectedSystemPopoverEmulatorKey] ?? selectedSystemPopoverEmulatorKey} executable configured.`
                                        : `${emulatorLabelByKey[selectedSystemPopoverEmulatorKey] ?? selectedSystemPopoverEmulatorKey} executable path missing.`}
                                    </p>

                                    <div className="system-emulator-popover-actions">
                                      <button
                                        type="button"
                                        className="system-emulator-popover-btn"
                                        onClick={() => {
                                          void browseSelectedSystemEmulatorPath()
                                        }}
                                      >
                                        Browse emulator exe
                                      </button>
                                      <button
                                        type="button"
                                        className="system-emulator-popover-btn"
                                        disabled={!selectedSystemTestEntry}
                                        onClick={() => {
                                          void testSelectedSystemEmulatorLaunch()
                                        }}
                                      >
                                        Test launch
                                      </button>
                                      <button
                                        type="button"
                                        className="system-emulator-popover-btn"
                                        onClick={openSystemEmulatorSettings}
                                      >
                                        Open settings
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <span className="system-focus-divider" aria-hidden="true" />

                          <div className="system-focus-actions" aria-label="System actions">
                            <button
                              type="button"
                              className="tile-action primary enter-system system-enter-action"
                              onMouseDown={(event) => {
                                if (event.button !== 0) {
                                  return
                                }

                                triggerSystemEnterFeedback(event.currentTarget, event.clientX, event.clientY)
                              }}
                              onClick={(event) => {
                                if (event.detail === 0) {
                                  triggerSystemEnterFeedback(event.currentTarget)
                                }

                                handleSystemCardClick(selectedSystem.key, true)
                              }}
                            >
                              <span className="system-enter-icon" aria-hidden="true">{'\u25B6'}</span>
                              Open System
                            </button>

                            {selectedSystemLauncher && (
                              <button
                                type="button"
                                className="system-launcher-action"
                                aria-label={`Open in ${selectedSystemLauncher.label}`}
                                title={`Open in ${selectedSystemLauncher.label}.`}
                                onMouseDown={(event) => {
                                  if (event.button !== 0) {
                                    return
                                  }

                                  triggerSystemEnterFeedback(event.currentTarget, event.clientX, event.clientY)
                                }}
                                onClick={(event) => {
                                  if (event.detail === 0) {
                                    triggerSystemEnterFeedback(event.currentTarget)
                                  }

                                  void openSelectedSystemLauncher()
                                }}
                              >
                                <span className="system-launcher-logo" aria-hidden="true">
                                  {renderSystemCategoryMark(
                                    selectedSystem.key,
                                    selectedSystem.logoPath,
                                    selectedSystem.label,
                                    selectedSystem.short.slice(0, 1).toUpperCase(),
                                  )}
                                </span>
                                <span className="system-launcher-arrow" aria-hidden="true">{'\u2197'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              className="system-launcher-action system-gradient-action"
                              aria-label={`Customize ${selectedSystem.label} gradient`}
                              title="Customize gradient"
                              onMouseDown={(event) => {
                                if (event.button !== 0) {
                                  return
                                }

                                triggerSystemEnterFeedback(event.currentTarget, event.clientX, event.clientY)
                              }}
                              onClick={(event) => {
                                if (event.detail === 0) {
                                  triggerSystemEnterFeedback(event.currentTarget)
                                }

                                openSystemGradientDialog()
                              }}
                            >
                              <span className="system-launcher-logo system-gradient-logo" aria-hidden="true">
                                <span className="system-gradient-logo-glyph">GR</span>
                              </span>
                              <span className="system-launcher-arrow system-gradient-arrow" aria-hidden="true">{'\u2726'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="feature-copy">
                        <h2>{systemsHasSearchQuery ? 'No systems match search' : 'No systems found'}</h2>
                        <p className="feature-target">
                          {systemsHasSearchQuery
                            ? 'Try a different term in Search to see matching systems.'
                            : 'Run Auto Import to populate your library.'}
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              ) : focusedGame ? (
                <div
                  className={
                    isGridView
                      ? isGamesViewSwitching
                        ? `wii-main games-main games-main-grid is-view-switching brand-${gamesChromeBrandKey}${gamesGradientChromeClass ? ` ${gamesGradientChromeClass}` : ''}${gamesRouteTransitionClass ? ` ${gamesRouteTransitionClass}` : ''}`
                        : `wii-main games-main games-main-grid brand-${gamesChromeBrandKey}${gamesGradientChromeClass ? ` ${gamesGradientChromeClass}` : ''}${gamesRouteTransitionClass ? ` ${gamesRouteTransitionClass}` : ''}`
                      : isGamesViewSwitching
                        ? `wii-main games-main is-view-switching brand-${gamesChromeBrandKey}${gamesGradientChromeClass ? ` ${gamesGradientChromeClass}` : ''}${gamesRouteTransitionClass ? ` ${gamesRouteTransitionClass}` : ''}`
                        : `wii-main games-main brand-${gamesChromeBrandKey}${gamesGradientChromeClass ? ` ${gamesGradientChromeClass}` : ''}${gamesRouteTransitionClass ? ` ${gamesRouteTransitionClass}` : ''}`
                  }
                >
                  {!isGridView ? (
                    <aside className="wii-stack game-stack" aria-label="Game selector">
                      <button
                        type="button"
                        className={
                          selectedSystem
                            ? animateSystemIntoGames
                              ? `mini-system-icon system-entering brand-${selectedSystem.key}`
                              : `mini-system-icon brand-${selectedSystem.key}`
                            : animateSystemIntoGames
                              ? 'mini-system-icon system-entering brand-all'
                              : 'mini-system-icon brand-all'
                        }
                        aria-label="Back to systems"
                        title="Back to systems"
                        onClick={backToSystems}
                      >
                        {selectedSystem ? (
                          <span className="icon-media">
                            {renderSystemCategoryMark(selectedSystem.key, selectedSystem.logoPath, selectedSystem.label, selectedSystem.short)}
                          </span>
                        ) : (
                          <span className="icon-media">
                            <span>ALL</span>
                          </span>
                        )}
                      </button>

                      <div
                        className={isGameStackMomentumActive ? 'stack-list is-momentum' : 'stack-list'}
                        ref={gameStackListRef}
                        onWheel={(event) => {
                          if (event.deltaY === 0) {
                            return
                          }

                          event.preventDefault()
                          event.stopPropagation()
                          pushGameStackMomentum(event.deltaY)
                        }}
                      >
                        {stackEntries.map(({ entry, offset }) => {
                          const positionClass =
                            offset <= -2
                              ? 'pos-top-2'
                              : offset === -1
                                ? 'pos-top-1'
                                : offset === 0
                                  ? 'pos-center'
                                  : offset === 1
                                    ? 'pos-bottom-1'
                                    : 'pos-bottom-2'

                            if (!entry) {
                              return <span key={`game-empty-${offset}`} className={`stack-slot ${positionClass}`} aria-hidden="true" />
                            }

                            const isFocused = entry.id === focusedGame.id
                            const miniCover = customCoverByGame[entry.id] ?? coverArtThumbByGame[entry.id] ?? coverArtByGame[entry.id]
                            const brand = getGameCategory(entry)
                            const entryClickEffects = gameClickEffectsByGameId[entry.id] ?? []
                            const hasClickRipple = entryClickEffects.length > 0
                            const hasCornerDew = shouldShowCornerDew(entry.id)
                            const isFavorite = Boolean(gameMetaById[entry.id]?.isFavorite)
                            const updateStatus = gameUpdateStatusById[entry.id] ?? 'unknown'
                            const hasUpdate = updateStatus === 'update_available' || updateStatus === 'downloading_or_staging'
                            const isUpdateBubblePopping = Boolean(updateBubblePopById[entry.id])
                            const favoriteTone = getFavoriteStarTone(brand.key)
                            const searchScore = hasSearchQuery ? (searchScoreByGameId[entry.id] ?? 0) : 0
                            const searchMatchTone = !hasSearchQuery || searchScore <= 0 ? 'none' : searchScore >= 1120 ? 'strong' : 'soft'

                          return (
                            <button
                              key={entry.id}
                              type="button"
                              data-entry-id={entry.id}
                              data-search-match={searchMatchTone}
                              style={buildTileMotionStyle(`stack-${entry.id}`)}
                              className={
                                isFocused
                                  ? hasClickRipple
                                    ? hasCornerDew
                                      ? `stack-item active has-click-ripple has-corner-dew ${positionClass} brand-${brand.key}`
                                      : `stack-item active has-click-ripple ${positionClass} brand-${brand.key}`
                                    : hasCornerDew
                                      ? `stack-item active has-corner-dew ${positionClass} brand-${brand.key}`
                                      : `stack-item active ${positionClass} brand-${brand.key}`
                                  : hasClickRipple
                                    ? hasCornerDew
                                      ? `stack-item has-click-ripple has-corner-dew ${positionClass} brand-${brand.key}`
                                      : `stack-item has-click-ripple ${positionClass} brand-${brand.key}`
                                    : hasCornerDew
                                      ? `stack-item has-corner-dew ${positionClass} brand-${brand.key}`
                                      : `stack-item ${positionClass} brand-${brand.key}`
                              }
                              onMouseDown={(event) => {
                                if (event.button !== 0) {
                                  return
                                }

                                spawnGameClickEffect(event, entry.id)
                                handleGameCardClick(entry.id)
                              }}
                              onClick={(event) => {
                                if (event.detail !== 0) {
                                  return
                                }

                                spawnGameClickEffect(event, entry.id)
                                handleGameCardClick(entry.id)
                              }}
                              onPointerMove={handleCardPointerMove}
                              onPointerLeave={resetCardPointerMove}
                              onPointerCancel={resetCardPointerMove}
                              onContextMenu={(event) => {
                                openGameTileContextMenu(event, entry.id)
                              }}
                              data-update-status={updateStatus}
                              title={entry.title}
                            >
                              <span className="icon-media">
                                {(hasUpdate || isUpdateBubblePopping) && Boolean(miniCover) && (
                                  <i
                                    className={isUpdateBubblePopping ? 'game-update-bubble is-popping' : 'game-update-bubble'}
                                    aria-hidden="true"
                                  />
                                )}

                                {hasUpdate && (
                                  <span className="game-update-badge" aria-hidden="true">
                                    {'\u27F3'}
                                  </span>
                                )}

                                {miniCover ? (
                                  <img src={miniCover} alt={`${entry.title} cover`} loading="lazy" />
                                ) : (
                                  <span>{entry.title.slice(0, 3).toUpperCase()}</span>
                                )}

                                <span className="tile-glass-accent" aria-hidden="true" />
                                {hasCornerDew && <span className="tile-corner-dew" aria-hidden="true" />}

                                <span className="game-click-fx-layer" aria-hidden="true">
                                  {entryClickEffects.map((effect) => (
                                    <span
                                      key={effect.id}
                                      className="game-click-effect"
                                      style={
                                        {
                                          ['--fx-x' as string]: `${effect.x}%`,
                                          ['--fx-y' as string]: `${effect.y}%`,
                                        } as React.CSSProperties
                                      }
                                    >
                                      <span className="game-click-ripple" />
                                      {effect.droplets.map((droplet, index) => (
                                        <span
                                          key={`${effect.id}-drop-${index}`}
                                          className="game-click-droplet"
                                          style={
                                            {
                                              ['--drop-x' as string]: `${droplet.x}px`,
                                              ['--drop-y' as string]: `${droplet.y}px`,
                                              ['--drop-scale' as string]: `${droplet.scale}`,
                                              ['--drop-delay' as string]: `${droplet.delay}s`,
                                            } as React.CSSProperties
                                          }
                                        />
                                      ))}
                                    </span>
                                  ))}
                                </span>
                              </span>

                              <span className="icon-corner" aria-hidden="true">
                                <img
                                  className="icon-corner-logo"
                                  src={brand.logoPath}
                                  alt=""
                                  loading="lazy"
                                  onLoad={(event) => {
                                    delete event.currentTarget.dataset.error
                                  }}
                                  onError={(event) => {
                                    event.currentTarget.dataset.error = 'true'
                                  }}
                                />
                                <span className="icon-corner-fallback">{brand.short}</span>
                              </span>

                              <span
                                className={
                                  isFavorite
                                    ? favoriteTone === 'light'
                                      ? 'stack-favorite-control is-favorite tone-light'
                                      : 'stack-favorite-control is-favorite tone-dark'
                                    : 'stack-favorite-control'
                                }
                                role="button"
                                tabIndex={0}
                                aria-label={isFavorite ? `Unfavorite ${entry.title}` : `Favorite ${entry.title}`}
                                title={isFavorite ? 'Favorited' : 'Favorite'}
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                }}
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  toggleFavoriteGame(entry.id)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== 'Enter' && event.key !== ' ') {
                                    return
                                  }

                                  event.preventDefault()
                                  event.stopPropagation()
                                  toggleFavoriteGame(entry.id)
                                }}
                              >
                                {'\u2605'}
                              </span>
                            </button>
                          )
                        })}

                        {scrollVisibleGames.length > 1 && (
                          <div className={isGameStackMomentumActive ? 'stack-scroll-indicator is-active' : 'stack-scroll-indicator'}>
                            <button
                              type="button"
                              className={focusedGameIndex > 2 ? 'stack-scroll-top-button is-visible' : 'stack-scroll-top-button'}
                              onClick={jumpToTopGame}
                              aria-label="Scroll to top"
                              title="Scroll to top"
                            >
                              {'\u2191'} Top
                            </button>

                            <button
                              type="button"
                              className="stack-scrollbar-glass"
                              aria-label="Jump through game list"
                              title="Jump through game list"
                              onMouseDown={(event) => {
                                if (event.button !== 0) {
                                  return
                                }

                                event.preventDefault()
                                event.stopPropagation()
                                const bounds = event.currentTarget.getBoundingClientRect()
                                if (!bounds.height) {
                                  return
                                }

                                const progress = (event.clientY - bounds.top) / bounds.height
                                jumpToStackProgress(progress)
                              }}
                            >
                              <span className="stack-scrollbar-fill" style={{ height: `${Math.max(7, stackScrollProgress * 100)}%` }} />
                              <span className="stack-scrollbar-thumb" style={{ top: `${stackScrollProgress * 100}%` }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </aside>
                  ) : (
                    <LauncherGrid
                      gridGroupMode={gridGroupMode}
                      gridSizeMode={gridSizeMode}
                      gridSections={gridSections}
                      gridCategoryByGameId={gridCategoryByGameId}
                      focusedGameId={focusedGame.id}
                      customCoverByGame={customCoverByGame}
                      coverArtThumbByGame={coverArtThumbByGame}
                      coverArtByGame={coverArtByGame}
                      coverArtStatusByGame={coverArtStatusByGame}
                      coverSourceByGame={coverSourceByGame}
                      coverArtMetaByGame={coverArtMetaByGame}
                      gameUpdateStatusById={gameUpdateStatusById}
                      updateBubblePopById={updateBubblePopById}
                      gameMetaById={gameMetaById}
                      hasSearchQuery={hasSearchQuery}
                      searchScoreByGameId={searchScoreByGameId}
                      isLargeViewportPerformanceLite={isGridLargeViewportPerformanceLite}
                      onDiagnosticsChange={isDebugMenuVisible ? handleGridRuntimeDiagnostics : undefined}
                      onLayoutMetricsChange={handleGridLayoutMetrics}
                      onCardClick={handleGridCardClick}
                      onCardContextMenu={openGameTileContextMenu}
                      onToggleFavorite={toggleFavoriteGame}
                    />
                  )}

                  <div className="game-detail-column">
                    <DetailPanel
                      focusedGame={focusedGame}
                      focusedCoverArt={focusedCoverArt}
                      focusedBrand={focusedBrand}
                      chromeBrandKey={gamesDetailBrandKey}
                      gradientChromeClass={gamesDetailGradientChromeClass}
                      focusedCanShowAchievements={focusedCanShowAchievements}
                      isLoadingAchievements={Boolean(loadingAchievements[focusedGame.id])}
                      focusedTitleMetaItems={focusedTitleMetaItems}
                      focusedContextTags={focusedContextTags}
                      focusedUpdateStatus={focusedUpdateStatus}
                      focusedUpdateFeedback={focusedUpdateFeedback}
                      focusedPlaytimeText={sidebarPlaytimePrimaryText}
                      onLaunchGame={launchGame}
                      onRequestGameUpdate={requestGameUpdate}
                      onStopGameUpdate={stopGameUpdate}
                      onOpenGameUpdater={openGameUpdater}
                      onCheckGameUpdates={checkGameUpdates}
                      onShowAchievements={handleTileAchievementAction}
                      onUploadCustomCover={uploadCustomCover}
                      onRenameGame={renameGameTitle}
                      onResetGameTitle={resetGameTitleToAuto}
                      canResetTitleToAuto={isGameTitleOverridden(focusedGame)}
                      onRemoveGame={removeGame}
                      onOpenPlaytimeModal={() => openPlaytimeHub(focusedGame?.id)}
                    />

                    <div className="floating-widgets">
                      <button
                        type="button"
                        className={`wii-screenshot-bubble brand-${focusedBrand.key}`}
                        aria-label="Recent game screenshots, press semicolon for fullscreen"
                        title="Recent screenshots - Press ; for fullscreen"
                        onMouseDown={(event) => {
                          if (event.button !== 0) {
                            return
                          }

                          openScreenshotFullscreen()
                        }}
                        onClick={(event) => {
                          if (event.detail !== 0) {
                            return
                          }

                          openScreenshotFullscreen()
                        }}
                      >
                        <div className="wii-screenshot-frame">
                          {displayedScreenshotUrl ? (
                            <div
                              className={`wii-screenshot-media-stack${previousScreenshotUrl ? ' has-previous' : ''}${isScreenshotCrossfading ? ' is-crossfading' : ''}`}
                            >
                              {previousScreenshotUrl && (
                                <img
                                  className="wii-screenshot-media-layer previous"
                                  src={previousScreenshotUrl}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                />
                              )}
                              <img
                                className="wii-screenshot-media-layer current"
                                src={displayedScreenshotUrl}
                                alt={`${normalizeGameTitle(focusedGame.title)} recent screenshot`}
                                loading="lazy"
                              />
                            </div>
                          ) : showScreenshotFolderFallback ? (
                            <span className="wii-screenshot-folder" aria-hidden="true" />
                          ) : (
                            <span className="wii-screenshot-loading">Loading...</span>
                          )}
                        </div>

                        <span className="wii-screenshot-hint">; fullscreen</span>

                        {focusedScreenshotPaths.length > 1 && (
                          <div className="wii-screenshot-dots" aria-hidden="true">
                            {focusedScreenshotPaths.slice(0, 5).map((path, index) => {
                              const isActive = path === focusedScreenshotPath
                              return <span key={`${path}-${index}`} className={isActive ? 'dot active' : 'dot'} />
                            })}
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {isScreenshotExpanded && (
                    <div
                      className={isScreenshotClosing ? 'wii-screenshot-overlay is-closing' : 'wii-screenshot-overlay'}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Expanded screenshot viewer"
                      onWheel={(event) => {
                        if (focusedScreenshotPaths.length <= 1) {
                          return
                        }

                        const wheelDelta = Math.abs(event.deltaY)
                        if (wheelDelta < 2) {
                          return
                        }

                        event.preventDefault()
                        event.stopPropagation()
                        stepFocusedScreenshot(event.deltaY > 0 ? 1 : -1)
                      }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) {
                          return
                        }

                        closeScreenshotFullscreen()
                      }}
                      onClick={(event) => {
                        if (event.detail !== 0) {
                          return
                        }

                        closeScreenshotFullscreen()
                      }}
                    >
                      <div
                        className={`wii-screenshot-overlay-frame brand-${focusedBrand.key}`}
                        onMouseDown={(event) => {
                          event.stopPropagation()
                        }}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        <button
                          type="button"
                          className="wii-screenshot-overlay-close"
                          aria-label="Close fullscreen screenshot"
                          onMouseDown={(event) => {
                            if (event.button !== 0) {
                              return
                            }

                            event.stopPropagation()
                            closeScreenshotFullscreen()
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (event.detail !== 0) {
                              return
                            }

                            closeScreenshotFullscreen()
                          }}
                        >
                          {'\u00D7'}
                        </button>

                        <div className="wii-screenshot-overlay-media">
                          {displayedScreenshotUrl ? (
                            <div
                              className={`wii-screenshot-media-stack overlay${previousScreenshotUrl ? ' has-previous' : ''}${isScreenshotCrossfading ? ' is-crossfading' : ''}`}
                            >
                              {previousScreenshotUrl && (
                                <img
                                  className="wii-screenshot-media-layer previous"
                                  src={previousScreenshotUrl}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                />
                              )}
                              <img
                                className="wii-screenshot-media-layer current"
                                src={displayedScreenshotUrl}
                                alt={`${normalizeGameTitle(focusedGame.title)} fullscreen screenshot`}
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <span className="wii-screenshot-folder" aria-hidden="true" />
                          )}
                        </div>

                        {focusedScreenshotPaths.length > 1 && (
                          <div className="wii-screenshot-dots" aria-hidden="true">
                            {focusedScreenshotPaths.slice(0, 7).map((path, index) => {
                              const isActive = path === focusedScreenshotPath
                              return <span key={`overlay-${path}-${index}`} className={isActive ? 'dot active' : 'dot'} />
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="wii-empty">
                  <p>No games found in this category yet.</p>
                  <button type="button" onClick={backToSystems}>
                    Back to Systems
                  </button>
                </div>
              )}

            </section>
          </div>
        </div>
      )}
      {activeTab === 'launcher' && isDeferredStartupReady && (
        <Suspense fallback={null}>
          <Sidebar
            accentKey={sidebarAccentKey}
            playtimePrimaryText={sidebarPlaytimePrimaryText}
            playtimeSecondaryText={sidebarPlaytimeSecondaryText}
            isScreenshotFullscreen={isScreenshotExpanded || isScreenshotClosing}
            isGridView={isGridView}
            rungoGraphicsFidelity={effectiveGraphicsFidelity}
            onToggleViewMode={toggleGamesViewMode}
            activeTab={activeTab}
            onSwitchTab={switchTab}
            onRerunOnboarding={rerunOnboarding}
            hideLegacyProfileStatusRail
            quickSettings={quickSettingsBindings}
            onOpenFullSettings={handleOpenFullSettings}
            onAction={(action) => {
              if (action === 'playtime') {
                openPlaytimeHub(launcherView === 'games' && focusedGame ? focusedGame.id : undefined)
              }
            }}
          />
        </Suspense>
      )}
      {activeTab === 'launcher' && isSystemGradientDialogOpen && selectedSystem && (
        <SystemGradientDialogSimple
          isOpen={isSystemGradientDialogOpen}
          systemKey={selectedSystem.key}
          systemLabel={selectedSystem.label}
          systemShort={selectedSystem.short}
          logoPath={selectedSystem.logoPath}
          initialGradient={selectedSystemGradient}
          initialAnimation={selectedSystemGradientAnimation}
          initialApplyMode={selectedSystemApplyMode}
          initialLogoBorder={selectedSystemLogoBorder}
          onClose={closeSystemGradientDialog}
          onSave={saveSystemGradientForCategory}
          onReset={resetSystemGradientForCategory}
        />
      )}
      {activeTab === 'settings' && (
        <SettingsScreen model={settingsScreenModel} />
      )}
      {APPEARANCE_ADVANCED_ENABLED && activeTab === 'appearance' && (
        <AppearanceCustomizerScreen controller={appearanceTheme} />
      )}

      {activeTab === 'profile' && (
        <ProfileScreen
          displayName={localProfile.displayName}
          avatarDataUrl={localProfile.avatarDataUrl}
          bio={localProfile.bio}
          statusLine={localProfile.statusLine}
          favoriteGenres={localProfile.favoriteGenres}
          featuredImageUrls={localProfile.featuredImageUrls}
          profileTheme={localProfile.profileTheme}
          collageLayout={localProfile.collageLayout}
          featuredFallbackImageUrls={profileCoverCandidates}
          totalGames={profileTotalGames}
          totalPlaytimeText={formatPlaytimeMinutes(profileTotalPlaytimeMinutes)}
          systemsUsed={profileSystemsUsed}
          rungosCollected={ownedKeychains.length}
          favoriteGameName={profileFavoriteGame}
          screenshotOfWeekUrl={profileScreenshotOfWeekUrl}
          signatureRungoId={signatureRungoId}
          signatureRungoName={signatureRungo?.name ?? ''}
          onProfileSaved={handleProfileSaved}
          raUsername={localProfile.raUsername}
          raProfile={raProfile}
          raRecentAchievements={raRecentAchievements}
          raAwards={raAwards}
          raStatus={raStatus}
          raError={raError}
          onRaConnect={handleRaConnect}
          onRaDisconnect={handleRaDisconnect}
          isExiting={profileIsExiting}
        />
      )}

      <AddGamesModal
        isOpen={isAddGamesModalOpen}
        targetSystemKey={addGamesTargetSystemKey}
        targetSystemLabel={addGamesTargetSystemLabel}
        targetSystems={addGamesTargetSystems}
        tab={addGamesTab}
        panelStyle={libraryPanelStyle}
        isImporting={isImporting}
        systemsStats={{
          active: Math.max(0, customSystems.length - hiddenCustomSystemCount),
          hidden: hiddenCustomSystemCount,
          autoSort: autoSortCustomSystemCount,
        }}
        onClose={closeAddGamesModal}
        onTabChange={handleAddGamesTabChange}
        onSideTabHover={playSettingsHoverSound}
        onSearchFocus={playSettingsHoverSound}
        onAddExecutable={addExecutableForAddGamesTarget}
        onAutoImport={() => {
          void autoImportGames()
        }}
        drag={{
          isFileDragActive: isAddGamesFileDragActive,
          isDropActive: isAddGamesDropActive,
          isRomDropActive: isRomDropActive,
          onModalDragEnter: handleAddGamesModalDragEnter,
          onModalDragOver: handleAddGamesModalDragOver,
          onModalDragLeave: handleAddGamesModalDragLeave,
          onModalDrop: handleAddGamesModalDrop,
          onPanelDragEnter: handleAddGamesDragEnter,
          onPanelDragOver: handleAddGamesDragOver,
          onPanelDragLeave: handleAddGamesDragLeave,
          onPanelDrop: handleAddGamesDropEvent,
          onRomDragEnter: handleRomDragEnter,
          onRomDragOver: handleRomDragOver,
          onRomDragLeave: handleRomDragLeave,
          onRomDrop: handleRomDropEvent,
        }}
        apps={{
          targetSystemKey: addGamesTargetSystemKey,
          targetSystemLabel: addGamesTargetSystemLabel,
          targetSystemAssignedCount: addGamesTargetAssignedSet.size,
          targetSystems: addGamesTargetSystems,
          search: addGamesSearch,
          filter: addGamesFilter,
          selectedCount: addGamesSelectedIds.length,
          entries: addGamesLibraryEntryRows,
          assignmentFlashByGameId: addGamesAssignmentFlash,
          isDropActive: isAddGamesDropActive,
          onSearchChange: setAddGamesSearch,
          onFilterChange: setAddGamesFilter,
          onTargetSystemChange: setAddGamesTargetSystemKey,
          onToggleSelection: toggleAddGamesSelection,
          onClearSelection: clearAddGamesSelection,
          visibleEntryCount: addGamesLibraryEntries.length,
          allVisibleSelected: allAddGamesVisibleSelected,
          onToggleSelectAllVisible: toggleAddGamesSelectAllVisible,
          onApplySelection: applyAddGamesSelection,
          onAssignGames: assignGamesToAddGamesTarget,
          onDragEnter: handleAddGamesDragEnter,
          onDragOver: handleAddGamesDragOver,
          onDragLeave: handleAddGamesDragLeave,
          onDrop: handleAddGamesDropEvent,
        }}
        rom={{
          summary: romImportSummary,
          search: romImportSearch,
          filter: romImportFilter,
          counts: romImportCounts,
          visibleRows: romImportVisibleRows,
          selectedIds: romImportSelectedIds,
          selectedVisibleCount: romImportSelectedVisibleCount,
          selectableVisibleCount: romImportSelectableVisibleCount,
          blockedLowVisibleCount: romImportBlockedLowVisibleCount,
          allVisibleSelected: romImportAllVisibleSelected,
          allowLowConfidenceImports,
          isScanning: isRomImportScanning,
          isDropActive: isRomDropActive,
          focusedRow: romImportFocusedRow,
          coverByEntryId: romImportCoverByEntryId,
          onSearchChange: setRomImportSearch,
          onFilterChange: setRomImportFilter,
          onAllowLowConfidenceChange: setAllowLowConfidenceImports,
          onScan: () => scanRomImportPreview(),
          onOpenRomFolder: addRomFolder,
          onImportSelected: importSelectedRomPreviewRows,
          onToggleSelectAllVisible: toggleSelectAllVisibleRomRows,
          onClearSelection: clearRomImportSelection,
          onToggleRowSelection: toggleRomImportSelection,
          onFocusRow: setRomImportFocusedId,
          onDragEnter: handleRomDragEnter,
          onDragOver: handleRomDragOver,
          onDragLeave: handleRomDragLeave,
          onDrop: handleRomDropEvent,
        }}
        systems={addGamesSystemsPanelProps}
      />
      <CustomCoverCropModal
        request={customCoverCropRequest}
        isApplying={isApplyingCustomCoverCrop}
        onCancel={cancelCustomCoverCrop}
        onApplyCrop={applyCustomCoverCrop}
        onApplyFull={applyCustomCoverFullArt}
      />

      {isCollageStudioOpen && activeCollageStudioDraft && (
        <div
          className="custom-systems-hub-overlay collage-studio-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Collage Studio"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCollageStudio()
            }
          }}
        >
          <section
            className="custom-systems-collage-studio-panel"
            style={customSystemsHubStyle}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="custom-systems-collage-studio-topbar">
              <div className="custom-systems-collage-studio-title">
                <h2>Collage Studio</h2>
                <p>Build your system collage with layers, drawing, and a locked logo preview.</p>
              </div>
              <div className="custom-systems-collage-studio-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={undoCollageStudioDrawStroke}
                  disabled={!collageStudioCanUndoDraw || (collageStudioActiveTool !== 'draw' && collageStudioActiveTool !== 'eraser')}
                >
                  Undo
                </button>
                <button type="button" className="ghost" onClick={resetCollageStudioDraftCanvas}>Reset</button>
                <button type="button" className="ghost" onClick={saveCollageStudioDraftSnapshot}>Save Draft</button>
                <button type="button" className="custom-systems-primary-action" onClick={applyCollageStudioDraftToSystem}>Apply</button>
                <button type="button" className="ghost" onClick={closeCollageStudio}>Close</button>
              </div>
            </header>

            <div className="custom-systems-collage-studio-body">
              <aside className="custom-systems-collage-tools" aria-label="Collage tools">
                <h3>Tools</h3>
                <div className="custom-systems-collage-tool-grid" role="group" aria-label="Collage toolset">
                  <button
                    type="button"
                    className={collageStudioActiveTool === 'select' ? 'ghost custom-systems-collage-tool active' : 'ghost custom-systems-collage-tool'}
                    onClick={() => handleCollageStudioToolSelect('select')}
                  >
                    Arrange
                  </button>
                  <button
                    type="button"
                    className={collageStudioActiveTool === 'draw' ? 'ghost custom-systems-collage-tool active' : 'ghost custom-systems-collage-tool'}
                    onClick={() => handleCollageStudioToolSelect('draw')}
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    className={collageStudioActiveTool === 'eraser' ? 'ghost custom-systems-collage-tool active' : 'ghost custom-systems-collage-tool'}
                    onClick={() => handleCollageStudioToolSelect('eraser')}
                    disabled={!isCollageStudioDrawLayerSelected}
                    title={isCollageStudioDrawLayerSelected ? 'Erase draw strokes on the selected draw layer' : 'Select a draw layer to use eraser'}
                  >
                    Eraser
                  </button>
                  <button
                    type="button"
                    className={collageStudioActiveTool === 'image' ? 'ghost custom-systems-collage-tool active' : 'ghost custom-systems-collage-tool'}
                    onClick={() => handleCollageStudioToolSelect('image')}
                  >
                    Add Image
                  </button>
                  <button
                    type="button"
                    className={collageStudioActiveTool === 'shape' ? 'ghost custom-systems-collage-tool active' : 'ghost custom-systems-collage-tool'}
                    onClick={() => handleCollageStudioToolSelect('shape')}
                  >
                    Add Shape
                  </button>
                  <button
                    type="button"
                    className={collageStudioActiveTool === 'text' ? 'ghost custom-systems-collage-tool active' : 'ghost custom-systems-collage-tool'}
                    onClick={() => handleCollageStudioToolSelect('text')}
                  >
                    Add Text
                  </button>
                </div>
                <input
                  ref={collageStudioImageInputRef}
                  type="file"
                  accept="image/*"
                  className="custom-systems-collage-hidden-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    void uploadCollageStudioImageLayer(file)
                    event.currentTarget.value = ''
                  }}
                />
                <input
                  ref={collageStudioReplaceImageInputRef}
                  type="file"
                  accept="image/*"
                  className="custom-systems-collage-hidden-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    void replaceCollageStudioSelectedImageLayer(file)
                    event.currentTarget.value = ''
                  }}
                />
                <input
                  ref={collageStudioStickerInputRef}
                  type="file"
                  accept="image/*"
                  className="custom-systems-collage-hidden-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    void uploadCollageStudioStickerImage(file)
                    event.currentTarget.value = ''
                  }}
                />
                <p className="settings-note">Arrange moves and resizes layers. Draw and Eraser work on draw layers only.</p>
              </aside>

              <section className="custom-systems-collage-workspace" aria-label="Collage workspace">
                {collageStudioActiveTool !== 'select' && collageStudioActiveTool !== 'draw' && collageStudioActiveTool !== 'eraser' ? (
                  <p className="custom-systems-collage-arrange-hint" role="status">
                    Use <strong>Arrange</strong> to move and resize layers on the canvas.
                  </p>
                ) : null}
                <div className="custom-systems-collage-upload-row">
                  <label className="ghost custom-systems-collage-upload-btn">
                    Upload Background
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        void uploadCollageStudioBackground(file)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setActiveCollageStudioDraft((previous) => {
                        if (!previous) {
                          return previous
                        }

                        return {
                          ...previous,
                          backgroundDataUrl: '',
                          updatedAt: Date.now(),
                        }
                      })
                    }}
                    disabled={!activeCollageStudioDraft.backgroundDataUrl.trim()}
                  >
                    Clear Background
                  </button>
                </div>

                <div
                  ref={collageStudioCanvasShellRef}
                  className={
                    collageStudioActiveTool === 'draw'
                      ? 'custom-systems-collage-canvas-shell is-drawing'
                      : collageStudioActiveTool === 'eraser'
                        ? 'custom-systems-collage-canvas-shell is-erasing'
                        : 'custom-systems-collage-canvas-shell'
                  }
                  onPointerDown={handleCollageStudioCanvasPointerDown}
                  onPointerMove={handleCollageStudioCanvasPointerMove}
                  onPointerUp={endCollageStudioActiveStroke}
                  onPointerCancel={endCollageStudioActiveStroke}
                >
                  {collageStudioPreviewBackgroundDataUrl ? (
                    <img
                      className="custom-systems-collage-canvas-image"
                      src={collageStudioPreviewBackgroundDataUrl}
                      alt="Collage background draft"
                    />
                  ) : (
                    <div className="custom-systems-collage-empty">
                      <strong>No background loaded</strong>
                      <span>Upload an image to seed the collage draft.</span>
                    </div>
                  )}

                  <div className="custom-systems-collage-canvas-layers">
                    {collageStudioVisibleInteractiveLayers.map((layer, layerIndex) => (
                      <div
                        key={`canvas-layer-${layer.id}`}
                        data-collage-layer-id={layer.id}
                        className={collageStudioSelectedLayerId === layer.id ? 'custom-systems-canvas-layer is-selected' : 'custom-systems-canvas-layer'}
                        style={{
                          zIndex: layerIndex + 1,
                          opacity: layer.opacity,
                          mixBlendMode: layer.blendMode as CSSProperties['mixBlendMode'],
                          left: `${clampCollageStudioScalar(Number(layer.positionX), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION) * 100}%`,
                          top: `${clampCollageStudioScalar(Number(layer.positionY), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION) * 100}%`,
                          width: `${clampCollageStudioLayerSize(Number(layer.width)) * 100}%`,
                          height: `${clampCollageStudioLayerSize(Number(layer.height)) * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${normalizeCollageStudioRotation(Number(layer.rotation))}deg)`,
                        }}
                      >
                        <div
                          className="custom-systems-canvas-layer-hitbox"
                          onPointerDown={(event) => beginCollageStudioLayerTransform(event, layer, 'move')}
                        />

                        {layer.kind === 'draw' ? (
                          <svg className="custom-systems-canvas-draw-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                            {(layer.strokes ?? []).map((stroke) => {
                              if (stroke.points.length <= 1) {
                                const onlyPoint = stroke.points[0]
                                if (!onlyPoint) {
                                  return null
                                }

                                return (
                                  <circle
                                    key={stroke.id}
                                    cx={onlyPoint.x * 1000}
                                    cy={onlyPoint.y * 1000}
                                    r={Math.max(0.5, stroke.size / 2)}
                                    fill={stroke.color}
                                  />
                                )
                              }

                              const pathData = stroke.points
                                .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${point.x * 1000} ${point.y * 1000}`)
                                .join(' ')

                              return (
                                <path
                                  key={stroke.id}
                                  d={pathData}
                                  fill="none"
                                  stroke={stroke.color}
                                  strokeWidth={stroke.size}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )
                            })}
                          </svg>
                        ) : null}

                        {layer.kind === 'text' ? (
                          <div className="custom-systems-canvas-text-layer">
                            {(layer.textItems ?? []).map((item) => {
                              const isEditing = collageStudioEditingTextTarget?.layerId === layer.id
                                && collageStudioEditingTextTarget.itemId === item.id
                              const textStyle: CSSProperties = {
                                left: `${item.x * 100}%`,
                                top: `${item.y * 100}%`,
                                color: item.color,
                                fontSize: `${item.size}px`,
                              }

                              if (isEditing) {
                                return (
                                  <textarea
                                    key={item.id}
                                    className="custom-systems-canvas-text-editor"
                                    value={item.text}
                                    style={textStyle}
                                    rows={2}
                                    data-collage-text-item="true"
                                    autoFocus
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.stopPropagation()}
                                    onBlur={() => setCollageStudioEditingTextTarget(null)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Escape') {
                                        event.preventDefault()
                                        event.currentTarget.blur()
                                      }
                                    }}
                                    onChange={(event) => {
                                      const nextText = event.target.value
                                      updateCollageStudioTextItem(layer.id, item.id, (current) => ({
                                        ...current,
                                        text: nextText,
                                      }))
                                    }}
                                  />
                                )
                              }

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="custom-systems-canvas-text-item"
                                  style={textStyle}
                                  data-collage-text-item="true"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setCollageStudioSelectedLayerId(layer.id)
                                    setCollageStudioSidebarTab('properties')
                                    if (collageStudioActiveTool === 'text') {
                                      setCollageStudioEditingTextTarget({ layerId: layer.id, itemId: item.id })
                                      return
                                    }

                                    setCollageStudioEditingTextTarget(null)
                                  }}
                                >
                                  {item.text.trim() || 'Text'}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}

                        {layer.kind === 'image' ? (
                          layer.imageDataUrl?.trim() ? (
                            <img
                              className="custom-systems-canvas-layer-image"
                              src={layer.imageDataUrl}
                              alt={layer.name}
                              draggable={false}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                            />
                          ) : (
                            <div className="custom-systems-canvas-layer-placeholder">IMAGE</div>
                          )
                        ) : null}

                        {layer.kind === 'sticker' ? (
                          (layer.stickerOutlineDataUrl ?? layer.stickerSourceDataUrl)?.trim() ? (
                            <img
                              className="custom-systems-canvas-layer-image"
                              src={(layer.stickerOutlineDataUrl ?? layer.stickerSourceDataUrl)!}
                              alt={layer.name}
                              draggable={false}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                            />
                          ) : (
                            <div className="custom-systems-canvas-layer-placeholder">STICKER</div>
                          )
                        ) : null}

                        {layer.kind === 'shape' ? (
                          <svg
                            className="custom-systems-canvas-shape-layer"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                          >
                            {(() => {
                              const kind = COLLAGE_STUDIO_SHAPE_KINDS.includes(layer.shapeKind as CollageStudioShapeKind) ? layer.shapeKind! : DEFAULT_COLLAGE_SHAPE_KIND
                              const color = normalizeCollageStudioColor(layer.shapeColor, DEFAULT_COLLAGE_SHAPE_COLOR)
                              if (kind === 'circle') {
                                return <ellipse cx="50" cy="50" rx="50" ry="50" fill={color} />
                              }
                              if (kind === 'triangle') {
                                return <polygon points="50,0 100,100 0,100" fill={color} />
                              }
                              if (kind === 'star') {
                                return <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={color} />
                              }
                              if (kind === 'hexagon') {
                                return <polygon points="50,0 93,25 93,75 50,100 7,75 7,25" fill={color} />
                              }
                              return <rect x="0" y="0" width="100" height="100" fill={color} />
                            })()}
                          </svg>
                        ) : null}

                        {layer.kind !== 'draw' && layer.kind !== 'text' && layer.kind !== 'image' && layer.kind !== 'sticker' && layer.kind !== 'shape' ? (
                          <div className="custom-systems-canvas-layer-placeholder">
                            {layer.kind.toUpperCase()}
                          </div>
                        ) : null}

                        {collageStudioActiveTool === 'select' && collageStudioSelectedLayerId === layer.id && !layer.locked ? (
                          <div className="custom-systems-canvas-selection-controls">
                            <button
                              type="button"
                              className="custom-systems-canvas-handle rotate"
                              aria-label={`Rotate ${layer.name}`}
                              onPointerDown={(event) => beginCollageStudioLayerTransform(event, layer, 'rotate')}
                            />
                            <button
                              type="button"
                              className="custom-systems-canvas-handle resize"
                              aria-label={`Resize ${layer.name}`}
                              onPointerDown={(event) => beginCollageStudioLayerTransform(event, layer, 'resize')}
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="settings-note custom-systems-collage-note">
                  The system logo is a locked top layer in this studio and cannot be edited.
                </p>
              </section>

              <aside className="custom-systems-collage-sidebar" aria-label="Collage side panels">
                <div className="custom-systems-editor-tabs" role="tablist" aria-label="Collage side tabs">
                  <button
                    type="button"
                    className={collageStudioSidebarTab === 'layers' ? 'tab-btn custom-systems-studio-tab active' : 'tab-btn custom-systems-studio-tab'}
                    onClick={() => setCollageStudioSidebarTab('layers')}
                  >
                    Layers
                  </button>
                  <button
                    type="button"
                    className={collageStudioSidebarTab === 'properties' ? 'tab-btn custom-systems-studio-tab active' : 'tab-btn custom-systems-studio-tab'}
                    onClick={() => setCollageStudioSidebarTab('properties')}
                  >
                    Properties
                  </button>
                </div>

                {collageStudioSidebarTab === 'layers' ? (
                  <div className="custom-systems-collage-layer-list" aria-label="Collage layers">
                    {activeCollageStudioDraft.layers.map((layer) => (
                      <div
                        key={layer.id}
                        className={collageStudioSelectedLayerId === layer.id ? 'custom-systems-collage-layer-row active' : 'custom-systems-collage-layer-row'}
                        onClick={() => {
                          setCollageStudioSelectedLayerId(layer.id)
                          setCollageStudioSidebarTab('properties')
                        }}
                      >
                        <div className="custom-systems-collage-layer-head">
                          <strong>{layer.name}</strong>
                          <small>{layer.kind.toUpperCase()}</small>
                        </div>
                        <div className="custom-systems-collage-layer-meta">
                          <button
                            type="button"
                            className={layer.visible ? 'custom-systems-collage-layer-action active' : 'custom-systems-collage-layer-action'}
                            aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                            title={layer.visible ? 'Hide layer' : 'Show layer'}
                            onClick={(event) => {
                              event.stopPropagation()
                              updateCollageStudioLayer(layer.id, (current) => ({
                                ...current,
                                visible: !current.visible,
                              }))
                            }}
                          >
                            {layer.visible ? 'Visible' : 'Hidden'}
                          </button>
                          {layer.kind === 'logo' ? (
                            <span className="custom-systems-collage-layer-action is-static" aria-hidden="true">Locked</span>
                          ) : (
                            <button
                              type="button"
                              className={layer.locked ? 'custom-systems-collage-layer-action active' : 'custom-systems-collage-layer-action'}
                              aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                              onClick={(event) => {
                                event.stopPropagation()
                                updateCollageStudioLayer(layer.id, (current) => ({
                                  ...current,
                                  locked: !current.locked,
                                }))
                              }}
                            >
                              {layer.locked ? 'Locked' : 'Lock'}
                            </button>
                          )}
                          {layer.kind !== 'background' && layer.kind !== 'logo' ? (
                            <button
                              type="button"
                              className="custom-systems-collage-layer-action danger"
                              aria-label={`Remove ${layer.name}`}
                              title="Remove layer"
                              onClick={(event) => {
                                event.stopPropagation()
                                removeCollageStudioLayer(layer.id)
                              }}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="custom-systems-collage-properties" aria-label="Collage properties">
                    {collageStudioSelectedLayer ? (
                      <div className="custom-systems-collage-properties-form">
                        <label className="settings-field custom-systems-embedded-field">
                          <span>Layer Name</span>
                          <input
                            value={collageStudioSelectedLayer.name}
                            disabled={collageStudioSelectedLayer.kind === 'logo'}
                            onChange={(event) => {
                              const nextName = event.target.value
                              updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                ...current,
                                name: nextName,
                              }))
                            }}
                          />
                        </label>

                        <label className="settings-field settings-checkbox-field custom-systems-embedded-field">
                          <span className="settings-checkbox-label">
                            <input
                              type="checkbox"
                              checked={collageStudioSelectedLayer.visible}
                              onChange={(event) => {
                                const checked = event.target.checked
                                updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                  ...current,
                                  visible: checked,
                                }))
                              }}
                            />
                            Visible
                          </span>
                        </label>

                        <label className="settings-field custom-systems-embedded-field">
                          <span>Opacity {Math.round(collageStudioSelectedLayer.opacity * 100)}%</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={collageStudioSelectedLayer.opacity}
                            onChange={(event) => {
                              const nextOpacity = Number(event.target.value)
                              updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                ...current,
                                opacity: nextOpacity,
                              }))
                            }}
                          />
                        </label>

                        <label className="settings-field custom-systems-embedded-field">
                          <span>Blend Mode</span>
                          <select
                            value={collageStudioSelectedLayer.blendMode}
                            disabled={collageStudioSelectedLayer.kind === 'logo'}
                            onChange={(event) => {
                              const nextBlendMode = event.target.value
                              updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                ...current,
                                blendMode: nextBlendMode,
                              }))
                            }}
                          >
                            <option value="normal">Normal</option>
                            <option value="multiply">Multiply</option>
                            <option value="screen">Screen</option>
                            <option value="overlay">Overlay</option>
                          </select>
                        </label>

                        {collageStudioSelectedLayer.kind !== 'background' && collageStudioSelectedLayer.kind !== 'logo' ? (
                          <details className="custom-systems-collage-advanced-section">
                            <summary className="custom-systems-collage-advanced-toggle">Advanced</summary>
                            <label className="settings-field custom-systems-embedded-field">
                              <span>Position X {Math.round(clampCollageStudioScalar(Number(collageStudioSelectedLayer.positionX), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION) * 100)}%</span>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={clampCollageStudioScalar(Number(collageStudioSelectedLayer.positionX), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION)}
                                onChange={(event) => {
                                  const nextPositionX = Number(event.target.value)
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    positionX: nextPositionX,
                                  }))
                                }}
                              />
                            </label>

                            <label className="settings-field custom-systems-embedded-field">
                              <span>Position Y {Math.round(clampCollageStudioScalar(Number(collageStudioSelectedLayer.positionY), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION) * 100)}%</span>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={clampCollageStudioScalar(Number(collageStudioSelectedLayer.positionY), 0, 1, DEFAULT_COLLAGE_LAYER_POSITION)}
                                onChange={(event) => {
                                  const nextPositionY = Number(event.target.value)
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    positionY: nextPositionY,
                                  }))
                                }}
                              />
                            </label>

                            <label className="settings-field custom-systems-embedded-field">
                              <span>Layer Width {Math.round(clampCollageStudioLayerSize(Number(collageStudioSelectedLayer.width)) * 100)}%</span>
                              <input
                                type="range"
                                min={MIN_COLLAGE_LAYER_SIZE}
                                max={MAX_COLLAGE_LAYER_SIZE}
                                step={0.01}
                                value={clampCollageStudioLayerSize(Number(collageStudioSelectedLayer.width))}
                                onChange={(event) => {
                                  const nextWidth = Number(event.target.value)
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    width: nextWidth,
                                  }))
                                }}
                              />
                            </label>

                            <label className="settings-field custom-systems-embedded-field">
                              <span>Layer Height {Math.round(clampCollageStudioLayerSize(Number(collageStudioSelectedLayer.height)) * 100)}%</span>
                              <input
                                type="range"
                                min={MIN_COLLAGE_LAYER_SIZE}
                                max={MAX_COLLAGE_LAYER_SIZE}
                                step={0.01}
                                value={clampCollageStudioLayerSize(Number(collageStudioSelectedLayer.height))}
                                onChange={(event) => {
                                  const nextHeight = Number(event.target.value)
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    height: nextHeight,
                                  }))
                                }}
                              />
                            </label>

                            <label className="settings-field custom-systems-embedded-field">
                              <span>Rotation {Math.round(normalizeCollageStudioRotation(Number(collageStudioSelectedLayer.rotation)))} deg</span>
                              <input
                                type="range"
                                min={-180}
                                max={180}
                                step={1}
                                value={normalizeCollageStudioRotation(Number(collageStudioSelectedLayer.rotation))}
                                onChange={(event) => {
                                  const nextRotation = Number(event.target.value)
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    rotation: nextRotation,
                                  }))
                                }}
                              />
                            </label>
                          </details>
                        ) : null}

                        {collageStudioSelectedLayer.kind === 'image' ? (
                          <>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => collageStudioReplaceImageInputRef.current?.click()}
                            >
                              Replace Image
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={!collageStudioSelectedLayer.imageDataUrl?.trim()}
                              onClick={() => {
                                void applyStampOutlineToCollageStudioImageLayer()
                              }}
                            >
                              Apply Stamp Outline
                            </button>
                          </>
                        ) : null}

                        {collageStudioSelectedLayer.kind === 'draw' ? (
                          <>
                            <label className="settings-field custom-systems-embedded-field">
                              <span>Stroke Color</span>
                              <div className="custom-system-color-row">
                                <input
                                  type="color"
                                  value={normalizeCollageStudioColor(collageStudioSelectedLayer.drawColor, DEFAULT_COLLAGE_DRAW_COLOR)}
                                  onChange={(event) => {
                                    const nextColor = event.target.value
                                    updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                      ...current,
                                      drawColor: nextColor,
                                    }))
                                  }}
                                />
                                <input
                                  value={normalizeCollageStudioColor(collageStudioSelectedLayer.drawColor, DEFAULT_COLLAGE_DRAW_COLOR)}
                                  onChange={(event) => {
                                    const nextColor = event.target.value
                                    updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                      ...current,
                                      drawColor: nextColor,
                                    }))
                                  }}
                                  placeholder="#2a4f7a"
                                />
                              </div>
                            </label>

                            <label className="settings-field custom-systems-embedded-field">
                              <span>Brush Size {Math.round(clampCollageStudioScalar(Number(collageStudioSelectedLayer.drawSize), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE))} px</span>
                              <input
                                type="range"
                                min={1}
                                max={48}
                                step={1}
                                value={clampCollageStudioScalar(Number(collageStudioSelectedLayer.drawSize), 1, 48, DEFAULT_COLLAGE_DRAW_SIZE)}
                                onChange={(event) => {
                                  const nextDrawSize = Number(event.target.value)
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    drawSize: nextDrawSize,
                                  }))
                                }}
                              />
                            </label>

                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                  ...current,
                                  strokes: [],
                                }))
                                setStatus('Cleared draw layer strokes.')
                              }}
                            >
                              Clear Drawing
                            </button>
                          </>
                        ) : null}

                        {collageStudioSelectedLayer.kind === 'text' ? (
                          <>
                            <label className="settings-field custom-systems-embedded-field">
                              <span>Text Color</span>
                              <div className="custom-system-color-row">
                                <input
                                  type="color"
                                  value={normalizeCollageStudioColor(collageStudioSelectedLayer.textColor, DEFAULT_COLLAGE_TEXT_COLOR)}
                                  onChange={(event) => {
                                    const nextColor = event.target.value
                                    updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                      ...current,
                                      textColor: nextColor,
                                    }))
                                  }}
                                />
                                <input
                                  value={normalizeCollageStudioColor(collageStudioSelectedLayer.textColor, DEFAULT_COLLAGE_TEXT_COLOR)}
                                  onChange={(event) => {
                                    const nextColor = event.target.value
                                    updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                      ...current,
                                      textColor: nextColor,
                                    }))
                                  }}
                                  placeholder="#1f365d"
                                />
                              </div>
                            </label>

                            <label className="settings-field custom-systems-embedded-field">
                              <span>Default Text Size {Math.round(clampCollageStudioScalar(Number(collageStudioSelectedLayer.textSize), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE))} px</span>
                              <input
                                type="range"
                                min={10}
                                max={140}
                                step={1}
                                value={clampCollageStudioScalar(Number(collageStudioSelectedLayer.textSize), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE)}
                                onChange={(event) => {
                                  const nextTextSize = Number(event.target.value)
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    textSize: nextTextSize,
                                  }))
                                }}
                              />
                            </label>

                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                const itemId = `text-item-${Date.now()}-${Math.floor(Math.random() * 1000)}`
                                const layerId = collageStudioSelectedLayer.id
                                updateCollageStudioLayer(layerId, (current) => {
                                  if (current.kind !== 'text') {
                                    return current
                                  }

                                  const textItems = Array.isArray(current.textItems) ? current.textItems : []
                                  return {
                                    ...current,
                                    textItems: [
                                      ...textItems,
                                      {
                                        id: itemId,
                                        text: 'Type text',
                                        x: 0.5,
                                        y: 0.5,
                                        color: normalizeCollageStudioColor(current.textColor, DEFAULT_COLLAGE_TEXT_COLOR),
                                        size: clampCollageStudioScalar(Number(current.textSize), 10, 140, DEFAULT_COLLAGE_TEXT_SIZE),
                                      },
                                    ],
                                  }
                                })
                                setCollageStudioEditingTextTarget({ layerId, itemId })
                                setStatus('Added text box at canvas center.')
                              }}
                            >
                              Add Text Box
                            </button>

                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                  ...current,
                                  textItems: [],
                                }))
                                setCollageStudioEditingTextTarget(null)
                                setStatus('Cleared text layer items.')
                              }}
                            >
                              Clear Text
                            </button>
                          </>
                        ) : null}

                        {collageStudioSelectedLayer.kind === 'shape' ? (
                          <>
                            <label className="settings-field custom-systems-embedded-field">
                              <span>Shape</span>
                              <div className="custom-systems-collage-shape-picker">
                                {COLLAGE_STUDIO_SHAPE_KINDS.map((sk) => (
                                  <button
                                    key={sk}
                                    type="button"
                                    className={collageStudioSelectedLayer.shapeKind === sk ? 'custom-systems-chip active' : 'custom-systems-chip'}
                                    onClick={() => {
                                      updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                        ...current,
                                        shapeKind: sk,
                                      }))
                                    }}
                                  >
                                    {sk.charAt(0).toUpperCase() + sk.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </label>
                            <label className="settings-field custom-systems-embedded-field">
                              <span>Shape Color</span>
                              <div className="custom-system-color-row">
                                <input
                                  type="color"
                                  value={normalizeCollageStudioColor(collageStudioSelectedLayer.shapeColor, DEFAULT_COLLAGE_SHAPE_COLOR)}
                                  onChange={(event) => {
                                    const nextColor = event.target.value
                                    updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                      ...current,
                                      shapeColor: nextColor,
                                    }))
                                  }}
                                />
                                <input
                                  value={normalizeCollageStudioColor(collageStudioSelectedLayer.shapeColor, DEFAULT_COLLAGE_SHAPE_COLOR)}
                                  onChange={(event) => {
                                    const nextColor = event.target.value
                                    updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                      ...current,
                                      shapeColor: nextColor,
                                    }))
                                  }}
                                  placeholder="#2a4f7a"
                                />
                              </div>
                            </label>
                          </>
                        ) : null}

                        {collageStudioSelectedLayer.kind === 'sticker' ? (
                          <>
                            <p className="settings-note">Legacy sticker layer. Upload an image or use Apply Stamp Outline on image layers instead.</p>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => collageStudioStickerInputRef.current?.click()}
                            >
                              Upload Image
                            </button>
                            {collageStudioSelectedLayer.stickerSourceDataUrl?.trim() ? (
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => {
                                  updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                    ...current,
                                    stickerSourceDataUrl: '',
                                    stickerOutlineDataUrl: '',
                                  }))
                                  setStatus('Cleared sticker image.')
                                }}
                              >
                                Clear Sticker
                              </button>
                            ) : null}
                          </>
                        ) : null}

                        <label className="settings-field settings-checkbox-field custom-systems-embedded-field">
                          <span className="settings-checkbox-label">
                            <input
                              type="checkbox"
                              checked={collageStudioSelectedLayer.locked}
                              disabled={collageStudioSelectedLayer.kind === 'logo'}
                              onChange={(event) => {
                                const checked = event.target.checked
                                updateCollageStudioLayer(collageStudioSelectedLayer.id, (current) => ({
                                  ...current,
                                  locked: checked,
                                }))
                              }}
                            />
                            Locked
                          </span>
                        </label>
                      </div>
                    ) : (
                      <p className="settings-note">Select a layer to edit properties.</p>
                    )}
                  </div>
                )}

                <div className="custom-systems-collage-live-preview" aria-label="Preview">
                  <span className="custom-systems-hero-kicker">Preview</span>
                  <div className="custom-systems-collage-preview-tile">
                    <SystemCard
                      label={customSystemDraftDisplayName}
                      logoPath={collageStudioPreviewLogoPath}
                      systemKey={customSystemPreviewKey}
                      shortLabel={customSystemPreviewShortLabel}
                      className="system-launcher-logo"
                      collageOverrideDataUrl={collageStudioPreviewCollageDataUrl || undefined}
                      disableCollage={!Boolean(collageStudioPreviewCollageDataUrl)}
                      hideLogo={!isCollageStudioLogoVisible}
                    />
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      <footer className="status-line">{status}</footer>

      {gameTileCopyMenu ? (
        <CopyContextMenu menu={gameTileCopyMenu} onClose={closeGameTileCopyMenu} />
      ) : null}

      {gameTileContextMenu && gameTileContextMenuEntry ? (
        <GameTileContextMenu
          entry={gameTileContextMenuEntry}
          position={{ x: gameTileContextMenu.x, y: gameTileContextMenu.y }}
          isFavorite={gameTileContextMenuIsFavorite}
          updateStatus={gameTileContextMenuUpdateStatus}
          canOpenFolder={Boolean(gameTileContextMenuExplorerFolder)}
          onClose={closeGameTileContextMenu}
          onPlay={handleGameTileContextMenuPlay}
          onToggleFavorite={handleGameTileContextMenuToggleFavorite}
          onOpenPlaytime={handleGameTileContextMenuOpenPlaytime}
          onOpenFolder={handleGameTileContextMenuOpenFolder}
          onRemove={handleGameTileContextMenuRemove}
        />
      ) : null}

          <Suspense fallback={null}>
            <PlaytimeModal
              isOpen={isPlaytimeModalOpen}
              themeKey={sceneBrandKey}
              view={playtimeModalView}
              hubGameEntries={playtimeHubGameEntries}
              libraryTotalMinutes={profileTotalPlaytimeMinutes}
              gameDetails={playtimeModalGameDetails}
              totalClaimableTokens={playtimeTotalClaimableTokens}
              focusGameId={playtimeFocusGameId}
              onClose={() => {
                setPlaytimeFocusGameId('')
                setIsPlaytimeModalOpen(false)
              }}
              onSelectGame={handlePlaytimeSelectGame}
              onBackToHub={handlePlaytimeBackToHub}
            />
            <AchievementModal
              selectedAchievementGame={selectedAchievementGame}
              achievementSearch={achievementSearch}
              setAchievementSearch={setAchievementSearch}
              achievementFilter={achievementFilter}
              setAchievementFilter={setAchievementFilter}
              onClose={() => setAchievementModalGameId(null)}
            />
          </Suspense>
          </>
        )}
        </div>
      </SystemThemeProvider>
    </>
  )
}

export default useLauncherController
