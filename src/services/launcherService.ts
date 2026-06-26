import { invoke } from '@tauri-apps/api/core'
import { timeBootAsync } from '../utils/bootPerf'

import type {
  AutoImportOrchestrationResult,
  BattleNetCoverArtRequest,
  ConnectorHealth,
  CoverThumbnailCacheLookupRequest,
  CoverThumbnailCacheClearRequest,
  CoverThumbnailCacheClearResult,
  CoverThumbnailCacheStoreRequest,
  CoverThumbnailTierLookupRequest,
  CoverThumbnailTierSet,
  EpicCoverArtRequest,
  XboxCoverArtRequest,
  GameUpdateStatesRequest,
  GameUpdateStatesResponse,
  ImportedGame,
  ImportSettings,
  ProcessRunningStatusRequest,
  ProcessRunningStatusResponse,
  RecentScreenshotsRequest,
  RetroArchCoreEnsureRequest,
  RetroArchCoreEnsureResult,
  RomMetadataArtRequest,
  RomMetadataArtResult,
  SteamAchievementsRequest,
  SteamAchievementsResponse,
  SteamBrowserLoginPollResult,
  SteamBrowserLoginStartResult,
  SteamConnectionTestRequest,
  SteamConnectionTestResult,
  SteamCoverArtRequest,
  SteamCoverArtLookupRequest,
  SteamPlaytimeRequest,
  SteamPlaytimeResponse,
  RaConnectionTestRequest,
  RaUserProfile,
  RaRecentAchievementsRequest,
  RaRecentAchievement,
  RaUserAwardsRequest,
  RaAward,
  RaCompletedGamesRequest,
  RaCompletedGame,
} from '../features/launcher/types'

type LaunchGameRequest = {
  kind: string
  target: string
  args: string[]
}

async function invokeTimed<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  return timeBootAsync(`tauri:${command}`, () => invoke<T>(command, payload))
}

export type LaunchGameOutcome = {
  attempted: boolean
  mode: 'process' | 'uri' | 'shell' | string
  pid: number | null
}

export async function launchGame(request: LaunchGameRequest): Promise<LaunchGameOutcome> {
  return invoke<LaunchGameOutcome>('launch_game', { request })
}

export async function ensureRetroArchCore(request: RetroArchCoreEnsureRequest): Promise<RetroArchCoreEnsureResult> {
  return invoke<RetroArchCoreEnsureResult>('ensure_retroarch_core', { request })
}

export async function enterLowPowerMode(): Promise<void> {
  return invoke<void>('enter_low_power_mode')
}

export async function wakeFromLowPowerMode(): Promise<void> {
  return invoke<void>('wake_from_low_power_mode')
}

export async function setCloseToTrayEnabled(enabled: boolean): Promise<void> {
  return invokeTimed<void>('set_close_to_tray_enabled', { enabled })
}

export async function autoImportGames(settings: ImportSettings): Promise<ImportedGame[]> {
  return invoke<ImportedGame[]>('auto_import_games', { settings })
}

export async function autoImportGamesOrchestrated(settings: ImportSettings): Promise<AutoImportOrchestrationResult> {
  return invokeTimed<AutoImportOrchestrationResult>('auto_import_games_orchestrated', { settings })
}

export async function getConnectorHealth(settings: ImportSettings): Promise<ConnectorHealth[]> {
  return invoke<ConnectorHealth[]>('get_connector_health', { settings })
}

export async function getGameUpdateStates(request: GameUpdateStatesRequest): Promise<GameUpdateStatesResponse> {
  return invokeTimed<GameUpdateStatesResponse>('get_game_update_states', { request })
}

export async function getRecentScreenshotPaths(request: RecentScreenshotsRequest): Promise<string[]> {
  return invoke<string[]>('get_recent_screenshot_paths', { request })
}

export async function readLocalImageAsDataUrl(path: string): Promise<string> {
  return invoke<string>('read_local_image_as_data_url', {
    request: { path },
  })
}

export async function extractExeIconDataUrl(path: string): Promise<string | null> {
  return invoke<string | null>('extract_exe_icon_data_url', {
    request: { path },
  })
}

export async function getRomMetadataArt(request: RomMetadataArtRequest): Promise<RomMetadataArtResult | null> {
  return invoke<RomMetadataArtResult | null>('get_rom_metadata_art', { request })
}

export async function getSteamPlaytime(request: SteamPlaytimeRequest): Promise<SteamPlaytimeResponse> {
  return invoke<SteamPlaytimeResponse>('get_steam_playtime', { request })
}

export async function getProcessRunningStatus(
  request: ProcessRunningStatusRequest,
): Promise<ProcessRunningStatusResponse[]> {
  return invoke<ProcessRunningStatusResponse[]>('get_process_running_status', { request })
}

export async function getSteamCoverArt(request: SteamCoverArtRequest): Promise<string | null> {
  return invoke<string | null>('get_steam_cover_art', { request })
}

export async function getSteamCoverArtForEntry(request: SteamCoverArtLookupRequest): Promise<string | null> {
  return invoke<string | null>('get_steam_cover_art_for_entry', { request })
}

export async function getEpicCoverArt(request: EpicCoverArtRequest): Promise<string | null> {
  return invoke<string | null>('get_epic_cover_art', { request })
}

export async function getXboxCoverArt(request: XboxCoverArtRequest): Promise<string | null> {
  return invoke<string | null>('get_xbox_cover_art', { request })
}

export async function getBattleNetCoverArt(request: BattleNetCoverArtRequest): Promise<string | null> {
  return invoke<string | null>('get_battle_net_cover_art', { request })
}

export async function getCachedCoverThumbnail(request: CoverThumbnailCacheLookupRequest): Promise<string | null> {
  return invoke<string | null>('get_cached_cover_thumbnail', { request })
}

export async function getCachedCoverThumbnailTier(request: CoverThumbnailTierLookupRequest): Promise<string | null> {
  return invoke<string | null>('get_cached_cover_thumbnail_tier', { request })
}

export async function cacheCoverThumbnail(request: CoverThumbnailCacheStoreRequest): Promise<string | null> {
  return invoke<string | null>('cache_cover_thumbnail', { request })
}

export async function cacheCoverThumbnailTiers(request: CoverThumbnailCacheStoreRequest): Promise<CoverThumbnailTierSet> {
  return invoke<CoverThumbnailTierSet>('cache_cover_thumbnail_tiers', { request })
}

export async function clearCoverThumbnailCache(
  request: CoverThumbnailCacheClearRequest = {},
): Promise<CoverThumbnailCacheClearResult> {
  return invoke<CoverThumbnailCacheClearResult>('clear_cover_thumbnail_cache', { request })
}

export async function getSteamAchievements(request: SteamAchievementsRequest): Promise<SteamAchievementsResponse> {
  return invoke<SteamAchievementsResponse>('get_steam_achievements', { request })
}

export async function steamBrowserLoginStart(): Promise<SteamBrowserLoginStartResult> {
  return invoke<SteamBrowserLoginStartResult>('steam_browser_login_start')
}

export async function steamBrowserLoginPoll(sessionId: string): Promise<SteamBrowserLoginPollResult> {
  return invoke<SteamBrowserLoginPollResult>('steam_browser_login_poll', {
    request: { sessionId },
  })
}

export async function testSteamConnection(request: SteamConnectionTestRequest): Promise<SteamConnectionTestResult> {
  return invokeTimed<SteamConnectionTestResult>('test_steam_connection', { request })
}

export async function testRaConnection(request: RaConnectionTestRequest): Promise<RaUserProfile> {
  return invokeTimed<RaUserProfile>('test_ra_connection', { request })
}

export async function ensureRomFolders(): Promise<string[]> {
  return invokeTimed<string[]>('ensure_rom_folders')
}

export async function openFolderInExplorer(path: string): Promise<void> {
  return invoke<void>('open_folder_in_explorer', { path })
}

export async function getRaRecentAchievements(request: RaRecentAchievementsRequest): Promise<RaRecentAchievement[]> {
  return invokeTimed<RaRecentAchievement[]>('get_ra_recent_achievements', { request })
}

export async function getRaUserAwards(request: RaUserAwardsRequest): Promise<RaAward[]> {
  return invokeTimed<RaAward[]>('get_ra_user_awards', { request })
}

export async function getRaCompletedGames(request: RaCompletedGamesRequest): Promise<RaCompletedGame[]> {
  return invoke<RaCompletedGame[]>('get_ra_completed_games', { request })
}
