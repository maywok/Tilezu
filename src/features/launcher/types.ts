export type LauncherKind = 'steam' | 'epic' | 'battle_net' | 'xbox' | 'emulator' | 'executable' | 'uri'
export type AppTab = 'launcher' | 'settings' | 'appearance' | 'profile'
export type LauncherCategory = 'all' | string
export type GraphicsFidelityMode = 'ultra-lite' | 'lite' | 'normal' | 'ultra'
export type SteamControllerCoexistenceMode = 'balanced' | 'prefer_steam' | 'prefer_tilezu'

export type GameEntry = {
  id: string
  title: string
  kind: LauncherKind
  target: string
  args: string[]
  emulatorKey?: EmulatorKey
  manualSystemKey?: string // Custom system key for imported games
}

export type ImportedGame = Omit<GameEntry, 'id'>

export type EmulatorKey = 'retroarch' | 'eden' | 'dolphin' | 'pcsx2' | 'ppsspp' | 'cemu' | 'rpcs3' | 'ds' | '3ds'

export type LauncherControllerLayout = 'xbox' | 'playstation' | 'nintendo'
export type LauncherGamepadFamily = 'xbox' | 'playstation' | 'nintendo' | 'generic'

export type LauncherControllerAction =
  | 'navigate_up'
  | 'navigate_down'
  | 'navigate_left'
  | 'navigate_right'
  | 'confirm'
  | 'back'
  | 'open_settings'
  | 'toggle_view'
  | 'jump_top'
  | 'jump_bottom'
  | 'open_profile_rail'
  | 'open_functions_menu'
  | 'open_find_panel'
  | 'open_library_panel'
  | 'open_search'
  | 'tab_prev'
  | 'tab_next'

export type LauncherControllerInput =
  | 'unbound'
  | 'dpad_up'
  | 'dpad_down'
  | 'dpad_left'
  | 'dpad_right'
  | 'left_stick_up'
  | 'left_stick_down'
  | 'left_stick_left'
  | 'left_stick_right'
  | 'right_stick_up'
  | 'right_stick_down'
  | 'right_stick_left'
  | 'right_stick_right'
  | 'face_south'
  | 'face_east'
  | 'face_west'
  | 'face_north'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_trigger'
  | 'right_trigger'
  | 'left_stick_press'
  | 'right_stick_press'
  | 'start'
  | 'select'

export type LauncherControllerBindingMap = Record<LauncherControllerAction, LauncherControllerInput>

export type LauncherControllerSystemBinds = {
  layout: LauncherControllerLayout
  bindings: LauncherControllerBindingMap
}

export type LauncherControllerBindsBySystem = Record<string, LauncherControllerSystemBinds>
export type LauncherInputMode = 'keyboard-mouse' | 'gamepad'

export type ImportSettings = {
  romDirs: string[]
  emulatorPaths: Record<string, string>
  systemEmulatorMap?: Record<string, EmulatorKey>
}

export type RetroArchCoreEnsureRequest = {
  retroarchPath: string
  profile?: string
  romPath?: string
  coreHint?: string
}

export type RetroArchCoreEnsureResult = {
  corePath: string | null
  installed: boolean
  downloaded: boolean
  coreKey: string | null
  source: string
}

export type ConnectorIssue = {
  code: string
  message: string
  fixAction?: string
}

export type ConnectorHealth = {
  id: string
  label: string
  status: 'ready' | 'needs_setup' | 'unavailable' | string
  detected: boolean
  importCount: number
  issues: ConnectorIssue[]
}

export type AutoImportOrchestrationResult = {
  imports: ImportedGame[]
  connectors: ConnectorHealth[]
}

export type SteamAchievement = {
  key: string
  name: string
  achieved: boolean
  unlockTime: number
  globalPercent?: number
  hidden: boolean
  description?: string
}

export type SteamAchievementsResponse = {
  appId: number
  gameName?: string
  total: number
  unlocked: number
  completionPercent: number
  achievements: SteamAchievement[]
}

export type SteamAchievementsRequest = {
  apiKey: string
  steamId: string
  appId: number
}

export type SteamConnectionTestRequest = {
  apiKey: string
  steamId: string
}

export type SteamConnectionTestResult = {
  steamId: string
  personaName: string
}

export type SteamPlaytimeRequest = {
  apiKey: string
  steamId: string
  appId: number
}

export type SteamPlaytimeResponse = {
  appId: number
  minutesTotal: number
  minutesRecent?: number
}

export type ProcessRunningStatusRequest = {
  pids: number[]
}

export type ProcessRunningStatusResponse = {
  pid: number
  running: boolean
  status?: 'running' | 'not_running' | 'unknown'
  queryError?: string
}

export type EpicCoverArtRequest = {
  target: string
  title?: string
}

export type XboxCoverArtRequest = {
  target: string
  title?: string
}

export type BattleNetCoverArtRequest = {
  target: string
  title?: string
}

export type RomMetadataArtRequest = {
  romPath: string
  profile?: string
  title?: string
  allowOnlineFallback?: boolean
}

export type RomMetadataArtResult = {
  title: string | null
  publisher: string | null
  iconDataUrl: string | null
  source: string
}

export type SteamBrowserLoginStartResult = {
  sessionId: string
}

export type SteamBrowserLoginPollResult = {
  status: 'pending' | 'success' | 'error'
  steamId?: string
  error?: string
}

export type SteamCoverArtRequest = {
  appId: number
}

export type SteamCoverArtLookupRequest = {
  appId?: number
  target?: string
  title?: string
  args?: string[]
}

export type GameUpdateStatus =
  | 'update_available'
  | 'up_to_date'
  | 'downloading_or_staging'
  | 'not_installed'
  | 'unknown'
  | 'unsupported'
  | 'error'

export type GameUpdateStateRequestItem = {
  entryId: string
  kind: string
  target: string
  args: string[]
  title?: string
}

export type GameUpdateStatesRequest = {
  items: GameUpdateStateRequestItem[]
}

export type GameUpdateStateResult = {
  entryId: string
  source: string
  status: GameUpdateStatus
  supported: boolean
  reasonCode: string
}

export type GameUpdateStatesResponse = {
  results: GameUpdateStateResult[]
}

export type CoverArtStatus =
  | 'pending'
  | 'loading'
  | 'retrying'
  | 'success'
  | 'failed-transient'
  | 'failed-permanent'

export type CoverAspectBucket = 'portrait' | 'near-square' | 'landscape' | 'ultra-wide'

export type CoverFitMode = 'contain' | 'cover' | 'cover-top'

export type CoverResolutionTier = 'low' | 'medium' | 'high'

// ── RetroAchievements ────────────────────────────────────────────────────────

export type RaConnectionTestRequest = {
  username: string
  apiKey: string
}

export type RaUserProfile = {
  username: string
  totalPoints: number
  totalSoftcorePoints: number
  rank: number | null
  totalRanked: number
  avatarUrl: string
}

export type RaRecentAchievement = {
  achievementId: number
  gameId: number
  gameTitle: string
  title: string
  description: string
  badgeUrl: string
  points: number
  date: string
}

export type RaAward = {
  title: string
  awardType: string
  awardDate: string
  imageUrl: string
}

export type RaCompletedGame = {
  gameId: number
  title: string
  imageUrl: string
  maxPossible: number
  numAwarded: number
  pctWon: number
  hardcore: boolean
}

export type RaRecentAchievementsRequest = {
  username: string
  apiKey: string
  count: number
}

export type RaUserAwardsRequest = {
  username: string
  apiKey: string
}

export type RaCompletedGamesRequest = {
  username: string
  apiKey: string
}

export type CoverSourceTier = 'grid-xs' | 'grid-md' | 'detail' | 'legacy' | 'source' | 'custom' | 'unknown'

export type CoverSourceProvenance = {
  gridTier: CoverSourceTier
  detailTier: CoverSourceTier
  updatedAt: number
}

export type CoverArtMetadata = {
  width: number
  height: number
  aspectRatio: number
  aspectBucket: CoverAspectBucket
  fitMode: CoverFitMode
  resolutionTier: CoverResolutionTier
  dominantColor: string
  measuredAt: number
  objectPositionY?: string
}

export type CustomCoverCropRequest = {
  entryId: string
  title: string
  sourceDataUrl: string
  naturalWidth: number
  naturalHeight: number
}

export type CustomCoverCropSelection = {
  zoom: number
  offsetX: number
  offsetY: number
  frameWidthRatio: number
  frameHeightRatio: number
}

export type CoverThumbnailCacheLookupRequest = {
  cacheKey: string
}

export type CoverThumbnailTier = 'grid-xs' | 'grid-md' | 'detail'

export type CoverThumbnailTierLookupRequest = {
  cacheKey: string
  tier: CoverThumbnailTier
}

export type CoverThumbnailCacheStoreRequest = {
  cacheKey: string
  source: string
  width?: number
  height?: number
}

export type CoverThumbnailCacheClearRequest = {
  hard?: boolean
}

export type CoverThumbnailCacheClearResult = {
  removedEntries: number
  cacheDirectory: string
}

export type CoverThumbnailTierSet = {
  gridXs: string | null
  gridMd: string | null
  detail: string | null
}

export type DialogFileFilter = {
  name: string
  extensions: string[]
}

export type DialogOpenOptions = {
  directory?: boolean
  multiple?: boolean
  filters?: DialogFileFilter[]
  defaultPath?: string
}

export type AchievementFilter = 'all' | 'unlocked' | 'locked'
export type LauncherView = 'systems' | 'games'
export type GamesViewMode = 'list' | 'grid'
export type SystemsViewMode = 'stack' | 'grid'
export type SystemsGridSortMode = 'title-asc' | 'game-count' | 'recently-played'
export type SystemsGridSizeMode = 'compact' | 'medium' | 'large'
export type SceneRouteTransition = 'to-games' | 'to-systems' | null
export type GridSortMode =
  | 'title-asc'
  | 'title-desc'
  | 'recently-played'
  | 'most-played'
  | 'date-added'
  | 'favorites'
  | 'category'
export type GridGroupMode = 'none' | 'platform'
export type GridSizeMode = 'compact' | 'medium' | 'large'

export type GameLibraryMeta = {
  addedAt: number
  lastPlayedAt: number
  playCount: number
  trackedPlaytimeMinutes?: number
  isFavorite: boolean
  favoritedAt?: number
}

export type RecentScreenshotsRequest = {
  kind: LauncherKind
  target: string
  title?: string
  limit?: number
}

export type CategoryMeta = {
  key: LauncherCategory
  label: string
  short: string
  logoPath: string
}

export type CustomSystemIngestionMode = 'manual' | 'smart'

export type CustomSystemRuleSet = {
  includeSources: string[]
  includePathHints: string[]
  includeExtensions: string[]
}

export type CustomSystemDefinition = {
  id: string
  key: string
  name: string
  shortLabel: string
  iconPath: string
  collageDataUrl: string
  accentPrimary: string
  accentSecondary: string
  description: string
  hidden: boolean
  ingestionMode: CustomSystemIngestionMode
  rules: CustomSystemRuleSet
  createdAt: number
  updatedAt: number
}
