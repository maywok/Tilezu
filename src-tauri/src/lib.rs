use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::Emitter;
use tauri::Manager;
use tauri::WindowEvent;

mod launcher;
mod media;
mod scanners;
mod services;
mod utils;

use crate::launcher::game_launcher::launch_game_impl;
use crate::launcher::launcher_manager::{is_process_running, spawn_process_exit_watcher};
use crate::media::media_controls::{
  get_now_playing_impl,
  get_system_volume_impl,
  media_next_track_impl,
  media_previous_track_impl,
  media_toggle_playback_impl,
  set_system_volume_impl,
};
use crate::scanners::battle_net_scanner::scan_battle_net_games;
use crate::scanners::epic_scanner::scan_epic_games;
use crate::scanners::registry_scanner::registry_key_exists;
use crate::scanners::rom_import_scanner::scan_rom_games;
use crate::scanners::steam_scanner::{parse_steam_app_id_from_target, parse_vdf_value, scan_steam_games, steam_roots};
use crate::scanners::windows_special_scanner::{
  battle_net_launcher_path,
  ea_app_exists,
  epic_launcher_exists,
  scan_windows_special_games,
  scan_xbox_games,
  ubisoft_connect_exists,
  xbox_app_exists,
};
use crate::services::cover_art_service::{
  cache_cover_thumbnail_impl,
  cache_cover_thumbnail_tiers_impl,
  clear_cover_thumbnail_cache_impl,
  get_cached_cover_thumbnail_impl,
  get_cached_cover_thumbnail_tier_impl,
  get_battle_net_cover_art_impl,
  get_epic_cover_art_impl,
  get_xbox_cover_art_impl,
  get_recent_screenshot_paths_impl,
  get_rom_metadata_art_impl,
  get_steam_cover_art_impl,
  get_steam_cover_art_for_entry_impl,
  read_local_image_as_data_url_impl,
};
use crate::services::retroarch_core_service::{
  ensure_retroarch_core_impl,
  RetroArchCoreEnsureRequest,
  RetroArchCoreEnsureResult,
};
use crate::services::steam_service::{
  get_steam_achievements_impl,
  get_steam_playtime_impl,
  steam_browser_login_poll_impl,
  steam_browser_login_start_impl,
  test_steam_connection_impl,
};
use crate::services::retroachievements_service::{
  get_ra_completed_games_impl,
  get_ra_recent_achievements_impl,
  get_ra_user_awards_impl,
  test_ra_connection_impl,
  RaAward,
  RaCompletedGame,
  RaRecentAchievement,
  RaUserProfile,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NowPlayingResponse {
  source_app: String,
  title: String,
  artist: String,
  album_title: String,
  is_playing: bool,
  artwork_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SteamAchievementsRequest {
  api_key: String,
  steam_id: String,
  app_id: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamAchievementItem {
  key: String,
  name: String,
  achieved: bool,
  unlock_time: u64,
  global_percent: Option<f64>,
  hidden: bool,
  description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamAchievementsResponse {
  app_id: u32,
  game_name: Option<String>,
  total: usize,
  unlocked: usize,
  completion_percent: f64,
  achievements: Vec<SteamAchievementItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamBrowserLoginStartResult {
  session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SteamBrowserLoginPollRequest {
  session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamBrowserLoginPollResult {
  status: String,
  steam_id: Option<String>,
  error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SteamConnectionTestRequest {
  api_key: String,
  steam_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamConnectionTestResult {
  steam_id: String,
  persona_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SteamPlaytimeRequest {
  api_key: String,
  steam_id: String,
  app_id: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamPlaytimeResponse {
  app_id: u32,
  minutes_total: u64,
  minutes_recent: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SteamCoverArtRequest {
  app_id: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SteamCoverArtLookupRequest {
  app_id: Option<u32>,
  target: Option<String>,
  title: Option<String>,
  args: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoverThumbnailCacheLookupRequest {
  cache_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoverThumbnailTierLookupRequest {
  cache_key: String,
  tier: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoverThumbnailCacheStoreRequest {
  cache_key: String,
  source: String,
  width: Option<u32>,
  height: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CoverThumbnailTierSet {
  grid_xs: Option<String>,
  grid_md: Option<String>,
  detail: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoverThumbnailCacheClearRequest {
  hard: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CoverThumbnailCacheClearResult {
  removed_entries: u32,
  cache_directory: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EpicCoverArtRequest {
  target: String,
  title: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct XboxCoverArtRequest {
  target: String,
  title: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BattleNetCoverArtRequest {
  target: String,
  title: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalImageRequest {
  path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExeIconRequest {
  path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RomMetadataArtRequest {
  rom_path: String,
  profile: Option<String>,
  title: Option<String>,
  allow_online_fallback: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RomMetadataArtResult {
  title: Option<String>,
  publisher: Option<String>,
  icon_data_url: Option<String>,
  source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentScreenshotsRequest {
  kind: String,
  target: String,
  title: Option<String>,
  limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LaunchRequest {
  kind: String,
  target: String,
  args: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchOutcome {
  attempted: bool,
  mode: String,
  pid: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BootPerfEventRequest {
  stage: String,
  elapsed_ms: f64,
  details: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessRunningStatusRequest {
  pids: Vec<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessRunningStatusResponse {
  pid: u32,
  running: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  status: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  query_error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportSettings {
  rom_dirs: Option<Vec<String>>,
  emulator_paths: Option<HashMap<String, String>>,
  system_emulator_map: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedGame {
  title: String,
  kind: String,
  target: String,
  args: Vec<String>,
  emulator_key: Option<String>,
  manual_system_key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorIssue {
  code: String,
  message: String,
  fix_action: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorHealth {
  id: String,
  label: String,
  status: String,
  detected: bool,
  import_count: usize,
  issues: Vec<ConnectorIssue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AutoImportOrchestrationResult {
  imports: Vec<ImportedGame>,
  connectors: Vec<ConnectorHealth>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameUpdateStatesRequest {
  items: Vec<GameUpdateStateRequestItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameUpdateStateRequestItem {
  entry_id: String,
  kind: String,
  target: String,
  args: Vec<String>,
  title: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GameUpdateStatesResponse {
  results: Vec<GameUpdateStateResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GameUpdateStateResult {
  entry_id: String,
  source: String,
  status: String,
  supported: bool,
  reason_code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RaConnectionTestRequest {
  username: String,
  api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RaRecentAchievementsRequest {
  username: String,
  api_key: String,
  count: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RaUserAwardsRequest {
  username: String,
  api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RaCompletedGamesRequest {
  username: String,
  api_key: String,
}

struct LowPowerModeState {
  close_to_tray_enabled: AtomicBool,
}

impl Default for LowPowerModeState {
  fn default() -> Self {
    Self {
      close_to_tray_enabled: AtomicBool::new(true),
    }
  }
}

fn emit_low_power_mode_changed(app: &tauri::AppHandle, active: bool) {
  let payload = serde_json::json!({ "active": active });
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.emit("tilezu:low-power-mode-changed", payload.clone());
  }
  let _ = app.emit("tilezu:low-power-mode-changed", payload);
}

fn hide_main_window(app: &tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "Main window was not found".to_string())?;

  window
    .hide()
    .map_err(|error| format!("Failed to hide main window: {error}"))?;
  emit_low_power_mode_changed(app, true);
  Ok(())
}

fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "Main window was not found".to_string())?;

  let _ = window.unminimize();
  window
    .show()
    .map_err(|error| format!("Failed to show main window: {error}"))?;
  let _ = window.set_focus();
  emit_low_power_mode_changed(app, false);
  Ok(())
}

fn source_from_args(args: &[String]) -> Option<String> {
  args
    .iter()
    .find_map(|value| value.trim().strip_prefix("--tm-source=").map(|source| source.trim().to_string()))
    .filter(|source| !source.is_empty())
}

fn source_for_entry(entry: &ImportedGame) -> String {
  if let Some(source) = source_from_args(&entry.args) {
    return source;
  }

  match entry.kind.as_str() {
    "steam" => "steam".to_string(),
    "battle_net" => "battle_net".to_string(),
    "xbox" => "xbox_app".to_string(),
    "emulator" => "rom".to_string(),
    _ => "custom".to_string(),
  }
}

fn source_for_update_item(entry: &GameUpdateStateRequestItem) -> String {
  if let Some(source) = source_from_args(&entry.args) {
    return source.to_lowercase();
  }

  let kind = entry.kind.trim().to_lowercase();
  if kind == "steam" || kind == "epic" || kind == "battle_net" || kind == "xbox" {
    return if kind == "xbox" {
      "xbox_app".to_string()
    } else {
      kind
    };
  }

  if kind == "emulator" {
    return "rom".to_string();
  }

  let target = entry.target.trim().to_lowercase();
  if target.starts_with("steam://") {
    return "steam".to_string();
  }

  if target.starts_with("com.epicgames.launcher://") || target == "__epic_launcher__" {
    return "epic".to_string();
  }

  if target.starts_with("battlenet://") || target == "__battle_net__" {
    return "battle_net".to_string();
  }

  "custom".to_string()
}

fn parse_u64_value(value: Option<String>) -> Option<u64> {
  value.and_then(|item| item.trim().parse::<u64>().ok())
}

fn resolve_steam_app_id_for_update(entry: &GameUpdateStateRequestItem) -> Option<String> {
  let target = entry.target.trim();
  if !target.is_empty() {
    if target.chars().all(|item| item.is_ascii_digit()) {
      return Some(target.to_string());
    }

    if let Some(parsed) = parse_steam_app_id_from_target(target) {
      return Some(parsed);
    }
  }

  for value in &entry.args {
    let trimmed = value.trim();
    if trimmed.is_empty() {
      continue;
    }

    if trimmed.chars().all(|item| item.is_ascii_digit()) {
      return Some(trimmed.to_string());
    }

    if let Some(parsed) = parse_steam_app_id_from_target(trimmed) {
      return Some(parsed);
    }

    if let Some(index) = trimmed.to_lowercase().find("-applaunch") {
      let suffix = &trimmed[index + "-applaunch".len()..];
      let candidate = suffix.trim_start_matches(|ch: char| ch == '=' || ch.is_whitespace());
      let digits: String = candidate
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect();
      if !digits.is_empty() {
        return Some(digits);
      }
    }
  }

  None
}

fn resolve_steam_update_status(entry: &GameUpdateStateRequestItem) -> GameUpdateStateResult {
  const STEAM_STATE_FLAG_UPDATE_REQUIRED: u64 = 0x2;
  const STEAM_STATE_FLAG_DOWNLOADING: u64 = 0x400;
  const STEAM_STATE_FLAG_STAGING: u64 = 0x800;
  const STEAM_STATE_FLAG_COMMITTING: u64 = 0x1000;

  let source = "steam".to_string();
  let Some(app_id) = resolve_steam_app_id_for_update(entry) else {
    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: "unknown".to_string(),
      supported: true,
      reason_code: "STEAM_APP_ID_UNKNOWN".to_string(),
    };
  };

  for root in steam_roots() {
    let steamapps = root.join("steamapps");
    let manifest = steamapps.join(format!("appmanifest_{app_id}.acf"));
    if !manifest.exists() {
      continue;
    }

    if steamapps.join("downloading").join(&app_id).exists() {
      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "downloading_or_staging".to_string(),
        supported: true,
        reason_code: "STEAM_DOWNLOADING_DIR_PRESENT".to_string(),
      };
    }

    let Ok(contents) = fs::read_to_string(&manifest) else {
      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "unknown".to_string(),
        supported: true,
        reason_code: "STEAM_MANIFEST_READ_FAILED".to_string(),
      };
    };

    let bytes_to_download = parse_u64_value(parse_vdf_value(&contents, "BytesToDownload")).unwrap_or(0);
    let bytes_downloaded = parse_u64_value(parse_vdf_value(&contents, "BytesDownloaded")).unwrap_or(0);
    let state_flags = parse_u64_value(parse_vdf_value(&contents, "StateFlags")).unwrap_or(0);

    if state_flags & (STEAM_STATE_FLAG_DOWNLOADING | STEAM_STATE_FLAG_STAGING | STEAM_STATE_FLAG_COMMITTING) != 0 {
      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "downloading_or_staging".to_string(),
        supported: true,
        reason_code: "STEAM_STATEFLAG_DOWNLOADING_OR_STAGING".to_string(),
      };
    }

    if state_flags & STEAM_STATE_FLAG_UPDATE_REQUIRED != 0 {
      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "update_available".to_string(),
        supported: true,
        reason_code: "STEAM_STATEFLAG_UPDATE_REQUIRED".to_string(),
      };
    }

    if bytes_to_download > 0 {
      if bytes_downloaded > 0 && bytes_downloaded < bytes_to_download {
        return GameUpdateStateResult {
          entry_id: entry.entry_id.clone(),
          source,
          status: "downloading_or_staging".to_string(),
          supported: true,
          reason_code: "STEAM_BYTES_DOWNLOADING".to_string(),
        };
      }

      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "unknown".to_string(),
        supported: true,
        reason_code: "STEAM_BYTES_PENDING_UNCONFIRMED".to_string(),
      };
    }

    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: "up_to_date".to_string(),
      supported: true,
      reason_code: "STEAM_MANIFEST_PRESENT".to_string(),
    };
  }

  GameUpdateStateResult {
    entry_id: entry.entry_id.clone(),
    source,
    status: "not_installed".to_string(),
    supported: true,
    reason_code: "STEAM_MANIFEST_NOT_FOUND".to_string(),
  }
}

fn epic_manifest_root() -> PathBuf {
  PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests")
}

fn epic_download_manager_root() -> PathBuf {
  PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\DownloadManager")
}

fn normalize_epic_identity(value: &str) -> String {
  value
    .trim()
    .to_lowercase()
    .chars()
    .filter(|item| item.is_ascii_alphanumeric())
    .collect()
}

fn epic_manifest_identifier_candidates(json: &serde_json::Value) -> Vec<String> {
  let mut values: Vec<String> = Vec::new();

  for key in [
    "AppName",
    "DisplayName",
    "MainGameAppName",
    "CatalogItemId",
    "ArtifactId",
    "NamespaceId",
  ] {
    if let Some(raw) = json.get(key).and_then(serde_json::Value::as_str) {
      let normalized = normalize_epic_identity(raw);
      if !normalized.is_empty() {
        values.push(normalized);
      }
    }
  }

  values
}

fn epic_download_identifier_candidates(json: &serde_json::Value) -> Vec<String> {
  let mut values: Vec<String> = Vec::new();

  let collect_nested = |parent: &str, key: &str, output: &mut Vec<String>| {
    if let Some(raw) = json
      .get(parent)
      .and_then(|value| value.get(key))
      .and_then(serde_json::Value::as_str)
    {
      let normalized = normalize_epic_identity(raw);
      if !normalized.is_empty() {
        output.push(normalized);
      }
    }
  };

  collect_nested("AppId", "AppName", &mut values);
  collect_nested("AppId", "ItemId", &mut values);
  collect_nested("AppId", "NamespaceId", &mut values);
  collect_nested("MainAppId", "AppName", &mut values);
  collect_nested("MainAppId", "ItemId", &mut values);
  collect_nested("MainAppId", "NamespaceId", &mut values);

  if let Some(raw) = json
    .get("InstallConfig")
    .and_then(|value| value.get("MainAppId"))
    .and_then(|value| value.get("AppName"))
    .and_then(serde_json::Value::as_str)
  {
    let normalized = normalize_epic_identity(raw);
    if !normalized.is_empty() {
      values.push(normalized);
    }
  }

  values
}

fn epic_download_matches_entry(json: &serde_json::Value, entry: &GameUpdateStateRequestItem) -> bool {
  let target = normalize_epic_identity(&entry.target);
  let title = entry
    .title
    .as_ref()
    .map(|value| normalize_epic_identity(value))
    .unwrap_or_default();

  let identifiers = epic_download_identifier_candidates(json);
  if identifiers.is_empty() {
    return false;
  }

  if !target.is_empty() && identifiers.iter().any(|value| value == &target || value.contains(&target) || target.contains(value)) {
    return true;
  }

  if !title.is_empty() && identifiers.iter().any(|value| value == &title || value.contains(&title) || title.contains(value)) {
    return true;
  }

  false
}

fn resolve_epic_download_manager_status(entry: &GameUpdateStateRequestItem) -> Option<GameUpdateStateResult> {
  let root = epic_download_manager_root();
  if !root.exists() {
    return None;
  }

  let Ok(entries) = fs::read_dir(root) else {
    return None;
  };

  for candidate in entries.flatten() {
    let path = candidate.path();
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
      continue;
    }

    let Ok(contents) = fs::read_to_string(&path) else {
      continue;
    };

    let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) else {
      continue;
    };

    let items: Vec<&serde_json::Value> = match &json {
      serde_json::Value::Array(values) => values.iter().collect(),
      serde_json::Value::Object(_) => vec![&json],
      _ => Vec::new(),
    };

    for item in items {
      if !epic_download_matches_entry(item, entry) {
        continue;
      }

      let install_type = item
        .get("InstallType")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_lowercase();

      if install_type == "update" {
        return Some(GameUpdateStateResult {
          entry_id: entry.entry_id.clone(),
          source: "epic".to_string(),
          status: "downloading_or_staging".to_string(),
          supported: true,
          reason_code: "EPIC_DOWNLOAD_MANAGER_UPDATE".to_string(),
        });
      }
    }
  }

  None
}

fn epic_manifest_matches_entry(json: &serde_json::Value, entry: &GameUpdateStateRequestItem) -> bool {
  let target = normalize_epic_identity(&entry.target);
  let title = entry
    .title
    .as_ref()
    .map(|value| normalize_epic_identity(value))
    .unwrap_or_default();

  let identifiers = epic_manifest_identifier_candidates(json);
  if identifiers.is_empty() {
    return false;
  }

  if !target.is_empty() {
    if identifiers.iter().any(|value| value == &target || value.contains(&target) || target.contains(value)) {
      return true;
    }
  }

  if !title.is_empty() {
    if identifiers.iter().any(|value| value == &title || value.contains(&title) || title.contains(value)) {
      return true;
    }
  }

  false
}

fn epic_bool_field(json: &serde_json::Value, key: &str) -> Option<bool> {
  let value = json.get(key)?;
  if let Some(flag) = value.as_bool() {
    return Some(flag);
  }

  if let Some(text) = value.as_str() {
    let lowered = text.trim().to_lowercase();
    if lowered == "true" {
      return Some(true);
    }
    if lowered == "false" {
      return Some(false);
    }
  }

  None
}

fn resolve_epic_update_status(entry: &GameUpdateStateRequestItem) -> GameUpdateStateResult {
  let source = "epic".to_string();

  if let Some(status) = resolve_epic_download_manager_status(entry) {
    return status;
  }

  let root = epic_manifest_root();
  if !root.exists() {
    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: "unknown".to_string(),
      supported: true,
      reason_code: "EPIC_MANIFEST_ROOT_MISSING".to_string(),
    };
  }

  let Ok(entries) = fs::read_dir(root) else {
    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: "unknown".to_string(),
      supported: true,
      reason_code: "EPIC_MANIFEST_READ_DIR_FAILED".to_string(),
    };
  };

  for candidate in entries.flatten() {
    let path = candidate.path();
    if path.extension().and_then(|value| value.to_str()) != Some("item") {
      continue;
    }

    let Ok(contents) = fs::read_to_string(&path) else {
      continue;
    };

    let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) else {
      continue;
    };

    if !epic_manifest_matches_entry(&json, entry) {
      continue;
    }

    let install_location = json
      .get("InstallLocation")
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default()
      .trim()
      .to_string();

    if install_location.is_empty() {
      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "not_installed".to_string(),
        supported: true,
        reason_code: "EPIC_INSTALL_PATH_EMPTY".to_string(),
      };
    }

    if !Path::new(&install_location).exists() {
      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "not_installed".to_string(),
        supported: true,
        reason_code: "EPIC_INSTALL_PATH_MISSING".to_string(),
      };
    }

    for update_key in [
      "NeedsUpdate",
      "bNeedsUpdate",
      "NeedsUpdateAvailable",
      "bNeedsUpdateAvailable",
      "UpdateAvailable",
      "bUpdateAvailable",
      "bRequiresUpdate",
    ] {
      if epic_bool_field(&json, update_key) == Some(true) {
        return GameUpdateStateResult {
          entry_id: entry.entry_id.clone(),
          source,
          status: "update_available".to_string(),
          supported: true,
          reason_code: format!("EPIC_{update_key}_TRUE"),
        };
      }
    }

    if epic_bool_field(&json, "bIsIncompleteInstall") == Some(true) {
      return GameUpdateStateResult {
        entry_id: entry.entry_id.clone(),
        source,
        status: "downloading_or_staging".to_string(),
        supported: true,
        reason_code: "EPIC_INCOMPLETE_INSTALL".to_string(),
      };
    }

    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: "up_to_date".to_string(),
      supported: true,
      reason_code: "EPIC_INSTALL_PRESENT".to_string(),
    };
  }

  GameUpdateStateResult {
    entry_id: entry.entry_id.clone(),
    source,
    status: "not_installed".to_string(),
    supported: true,
    reason_code: "EPIC_MATCHING_MANIFEST_NOT_FOUND".to_string(),
  }
}

fn battle_net_install_path_for_target(product_code: &str) -> Option<PathBuf> {
  for (_, code, folders, executables, _) in crate::scanners::battle_net_scanner::battle_net_game_definitions() {
    if !code.eq_ignore_ascii_case(product_code) {
      continue;
    }

    return crate::scanners::battle_net_scanner::battle_net_find_install_path(folders, executables);
  }

  None
}

fn battle_net_cache_status_signal(product_code: &str) -> Option<&'static str> {
  let lowered_product = product_code.trim().to_lowercase();
  if lowered_product.is_empty() {
    return None;
  }

  for root in crate::scanners::battle_net_scanner::battle_net_cache_roots() {
    if !root.exists() {
      continue;
    }

    let Ok(entries) = fs::read_dir(root) else {
      continue;
    };

    for entry in entries.flatten() {
      let path = entry.path();
      let Ok(metadata) = fs::metadata(&path) else {
        continue;
      };

      if metadata.is_dir() {
        continue;
      }

      if metadata.len() > 2_000_000 {
        continue;
      }

      let Ok(bytes) = fs::read(&path) else {
        continue;
      };

      let text = String::from_utf8_lossy(&bytes).to_lowercase();
      if !text.contains(&lowered_product) {
        continue;
      }

      if text.contains("download") || text.contains("patching") || text.contains("staging") || text.contains("queued") {
        return Some("downloading_or_staging");
      }

      if text.contains("update_available") || text.contains("needs_update") || text.contains("has_update") {
        return Some("update_available");
      }
    }
  }

  None
}

fn resolve_battle_net_update_status(entry: &GameUpdateStateRequestItem) -> GameUpdateStateResult {
  let source = "battle_net".to_string();
  let product_code = entry.target.trim().to_lowercase();
  if product_code.is_empty() {
    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: "unknown".to_string(),
      supported: true,
      reason_code: "BATTLENET_PRODUCT_CODE_EMPTY".to_string(),
    };
  }

  if battle_net_install_path_for_target(&product_code).is_none() {
    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: "not_installed".to_string(),
      supported: true,
      reason_code: "BATTLENET_INSTALL_PATH_MISSING".to_string(),
    };
  }

  if let Some(status) = battle_net_cache_status_signal(&product_code) {
    return GameUpdateStateResult {
      entry_id: entry.entry_id.clone(),
      source,
      status: status.to_string(),
      supported: true,
      reason_code: "BATTLENET_CACHE_SIGNAL".to_string(),
    };
  }

  GameUpdateStateResult {
    entry_id: entry.entry_id.clone(),
    source,
    status: "unknown".to_string(),
    supported: true,
    reason_code: "BATTLENET_SIGNAL_UNAVAILABLE".to_string(),
  }
}

fn resolve_game_update_status(entry: &GameUpdateStateRequestItem) -> GameUpdateStateResult {
  let source = source_for_update_item(entry);
  if source == "steam" {
    return resolve_steam_update_status(entry);
  }

  if source == "epic" {
    return resolve_epic_update_status(entry);
  }

  if source == "battle_net" {
    return resolve_battle_net_update_status(entry);
  }

  GameUpdateStateResult {
    entry_id: entry.entry_id.clone(),
    source,
    status: "unsupported".to_string(),
    supported: false,
    reason_code: "SOURCE_UNSUPPORTED".to_string(),
  }
}

fn canonical_import_key(entry: &ImportedGame) -> String {
  let kind = entry.kind.trim().to_lowercase();
  let target = entry.target.trim().to_lowercase();
  let title = entry.title.trim().to_lowercase();
  let source = source_from_args(&entry.args).unwrap_or_default().to_lowercase();

  let first_launch_arg = entry
    .args
    .iter()
    .map(|value| value.trim())
    .find(|value| !value.is_empty() && !value.starts_with("--tm-"))
    .unwrap_or_default()
    .to_lowercase();

  if kind == "steam" || source == "steam" {
    return format!("steam::{}", if target.is_empty() { title } else { target });
  }

  if kind == "battle_net" || source == "battle_net" {
    return format!("battle_net::{}", if target.is_empty() { title } else { target });
  }

  if kind == "xbox" || source == "xbox_app" {
    return format!("xbox_app::{}", if target.is_empty() { title } else { target });
  }

  if kind == "emulator" || source == "rom" {
    if !first_launch_arg.is_empty() {
      return format!("emulator::{}", first_launch_arg);
    }

    return format!("emulator::{}", if target.is_empty() { title } else { target });
  }

  if !source.is_empty() {
    return format!("{source}::{}", if target.is_empty() { title } else { target });
  }

  format!("{kind}::{}", if target.is_empty() { title } else { target })
}

fn dedupe_imports(imports: Vec<ImportedGame>) -> Vec<ImportedGame> {
  let mut seen = std::collections::HashSet::new();
  let mut deduped: Vec<ImportedGame> = Vec::new();

  for entry in imports {
    let key = canonical_import_key(&entry);
    if seen.insert(key) {
      deduped.push(entry);
    }
  }

  deduped
}

fn gather_imports(settings: Option<&ImportSettings>) -> Vec<ImportedGame> {
  let mut imports = scan_steam_games();
  imports.extend(scan_rom_games(settings));
  imports.extend(scan_windows_special_games());
  imports.extend(scan_epic_games());
  imports.extend(scan_battle_net_games());
  imports.extend(scan_xbox_games());
  dedupe_imports(imports)
}

fn connector_status(code: &str, message: &str, fix_action: Option<&str>) -> Vec<ConnectorIssue> {
  if code.is_empty() {
    return Vec::new();
  }

  vec![ConnectorIssue {
    code: code.to_string(),
    message: message.to_string(),
    fix_action: fix_action.map(|value| value.to_string()),
  }]
}

fn build_connector_health(settings: Option<&ImportSettings>, imports: &[ImportedGame]) -> Vec<ConnectorHealth> {
  let source_count = |source: &str| -> usize {
    imports
      .iter()
      .filter(|entry| source_for_entry(entry).eq_ignore_ascii_case(source))
      .count()
  };

  let steam_detected = !steam_roots().is_empty();
  let battle_net_detected = battle_net_launcher_path().is_some()
    || registry_key_exists(r"HKCR\battlenet")
    || registry_key_exists(r"HKCU\Software\Classes\battlenet");
  let epic_detected = epic_launcher_exists();
  let ea_detected = ea_app_exists();
  let ubisoft_detected = ubisoft_connect_exists();
  let xbox_detected = xbox_app_exists();

  let rom_settings_present = settings
    .map(|value| {
      let has_dirs = value
        .rom_dirs
        .as_ref()
        .map(|items| items.iter().any(|entry| !entry.trim().is_empty()))
        .unwrap_or(false);
      let has_emulators = value
        .emulator_paths
        .as_ref()
        .map(|items| items.values().any(|entry| !entry.trim().is_empty()))
        .unwrap_or(false);
      has_dirs || has_emulators
    })
    .unwrap_or(false);

  let rom_import_count = source_count("rom");
  let rom_missing_emulator = imports
    .iter()
    .any(|entry| entry.kind == "emulator" && entry.target == "__ds_emulator_missing__");

  vec![
    ConnectorHealth {
      id: "steam".to_string(),
      label: "Steam".to_string(),
      status: if steam_detected { "ready" } else { "needs_setup" }.to_string(),
      detected: steam_detected,
      import_count: source_count("steam"),
      issues: if steam_detected {
        Vec::new()
      } else {
        connector_status(
          "STEAM_NOT_FOUND",
          "Steam was not detected on this machine.",
          Some("install_steam"),
        )
      },
    },
    ConnectorHealth {
      id: "epic".to_string(),
      label: "Epic".to_string(),
      status: if epic_detected { "ready" } else { "needs_setup" }.to_string(),
      detected: epic_detected,
      import_count: source_count("epic"),
      issues: if epic_detected {
        Vec::new()
      } else {
        connector_status(
          "EPIC_NOT_FOUND",
          "Epic Games Launcher was not detected.",
          Some("install_epic"),
        )
      },
    },
    ConnectorHealth {
      id: "battle_net".to_string(),
      label: "Battle.net".to_string(),
      status: if battle_net_detected { "ready" } else { "needs_setup" }.to_string(),
      detected: battle_net_detected,
      import_count: source_count("battle_net"),
      issues: if battle_net_detected {
        Vec::new()
      } else {
        connector_status(
          "BATTLENET_NOT_FOUND",
          "Battle.net launcher was not detected.",
          Some("install_battle_net"),
        )
      },
    },
    ConnectorHealth {
      id: "ea_app".to_string(),
      label: "EA App".to_string(),
      status: if ea_detected { "ready" } else { "needs_setup" }.to_string(),
      detected: ea_detected,
      import_count: source_count("ea_app"),
      issues: if ea_detected {
        Vec::new()
      } else {
        connector_status("EA_APP_NOT_FOUND", "EA App was not detected.", Some("install_ea_app"))
      },
    },
    ConnectorHealth {
      id: "ubisoft_connect".to_string(),
      label: "Ubisoft".to_string(),
      status: if ubisoft_detected { "ready" } else { "needs_setup" }.to_string(),
      detected: ubisoft_detected,
      import_count: source_count("ubisoft_connect"),
      issues: if ubisoft_detected {
        Vec::new()
      } else {
        connector_status(
          "UBISOFT_CONNECT_NOT_FOUND",
          "Ubisoft Connect was not detected.",
          Some("install_ubisoft_connect"),
        )
      },
    },
    ConnectorHealth {
      id: "xbox_app".to_string(),
      label: "Xbox".to_string(),
      status: if xbox_detected { "ready" } else { "needs_setup" }.to_string(),
      detected: xbox_detected,
      import_count: source_count("xbox_app"),
      issues: if xbox_detected {
        Vec::new()
      } else {
        connector_status(
          "XBOX_APP_NOT_FOUND",
          "Xbox app was not detected.",
          Some("install_xbox_app"),
        )
      },
    },
    ConnectorHealth {
      id: "rom".to_string(),
      label: "Emulation".to_string(),
      status: if rom_import_count > 0 {
        "ready"
      } else if rom_settings_present || rom_missing_emulator {
        "needs_setup"
      } else {
        "unavailable"
      }
      .to_string(),
      detected: rom_import_count > 0,
      import_count: rom_import_count,
      issues: if rom_missing_emulator {
        connector_status(
          "ROM_EMULATOR_MISSING",
          "ROMs were found but emulator paths are missing.",
          Some("configure_emulator_paths"),
        )
      } else if rom_settings_present && rom_import_count == 0 {
        connector_status(
          "ROM_NOT_FOUND",
          "No launchable ROM entries were found in configured directories.",
          Some("review_rom_dirs"),
        )
      } else if rom_import_count == 0 {
        connector_status(
          "ROM_NOT_CONFIGURED",
          "Set ROM folders and emulator paths to enable one-button emulation import.",
          Some("open_import_settings"),
        )
      } else {
        Vec::new()
      },
    },
  ]
}

#[tauri::command]
fn get_epic_cover_art(request: EpicCoverArtRequest) -> Result<Option<String>, String> {
  get_epic_cover_art_impl(request)
}

#[tauri::command]
fn get_xbox_cover_art(request: XboxCoverArtRequest) -> Result<Option<String>, String> {
  get_xbox_cover_art_impl(request)
}

#[tauri::command]
fn read_local_image_as_data_url(request: LocalImageRequest) -> Result<String, String> {
  read_local_image_as_data_url_impl(request)
}

static EXE_ICON_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

#[cfg(target_os = "windows")]
fn escape_powershell_single_quoted(value: &str) -> String {
  value.replace('\'', "''")
}

#[cfg(target_os = "windows")]
fn extract_exe_icon_data_url_impl(path: &str) -> Result<Option<String>, String> {
  let exe_path = PathBuf::from(path);
  if !exe_path.exists() {
    return Ok(None);
  }

  let modified = exe_path
    .metadata()
    .and_then(|meta| meta.modified())
    .ok()
    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|duration| duration.as_secs())
    .unwrap_or(0);

  let cache_key = format!("{}::{modified}", exe_path.to_string_lossy());
  let cache = EXE_ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

  if let Ok(guard) = cache.lock() {
    if let Some(existing) = guard.get(&cache_key) {
      return Ok(Some(existing.clone()));
    }
  }

  let escaped_path = escape_powershell_single_quoted(&exe_path.to_string_lossy());
  let script = format!(
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Drawing; $p='{escaped_path}'; $icon=[System.Drawing.Icon]::ExtractAssociatedIcon($p); if ($null -eq $icon) {{ Write-Output ''; exit 0 }}; $bmp=$icon.ToBitmap(); $ms=New-Object System.IO.MemoryStream; $bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png); [Convert]::ToBase64String($ms.ToArray())"
  );

  let output = crate::utils::windows_process::run_hidden_powershell(&script)
    .map_err(|error| format!("Failed to run icon extractor: {error}"))?;

  if !output.status.success() {
    return Ok(None);
  }

  let base64 = String::from_utf8(output.stdout)
    .map_err(|error| format!("Icon extractor output decode failed: {error}"))?
    .trim()
    .to_string();

  if base64.is_empty() {
    return Ok(None);
  }

  let data_url = format!("data:image/png;base64,{base64}");
  if let Ok(mut guard) = cache.lock() {
    guard.insert(cache_key, data_url.clone());
  }

  Ok(Some(data_url))
}

#[cfg(not(target_os = "windows"))]
fn extract_exe_icon_data_url_impl(_path: &str) -> Result<Option<String>, String> {
  Ok(None)
}

#[tauri::command]
fn extract_exe_icon_data_url(request: ExeIconRequest) -> Result<Option<String>, String> {
  extract_exe_icon_data_url_impl(request.path.trim())
}

#[tauri::command]
fn get_rom_metadata_art(request: RomMetadataArtRequest) -> Result<Option<RomMetadataArtResult>, String> {
  get_rom_metadata_art_impl(request)
}

#[tauri::command]
fn get_steam_cover_art(request: SteamCoverArtRequest) -> Result<Option<String>, String> {
  get_steam_cover_art_impl(request)
}

#[tauri::command]
fn get_steam_cover_art_for_entry(request: SteamCoverArtLookupRequest) -> Result<Option<String>, String> {
  get_steam_cover_art_for_entry_impl(request)
}

#[tauri::command]
fn get_recent_screenshot_paths(request: RecentScreenshotsRequest) -> Result<Vec<String>, String> {
  get_recent_screenshot_paths_impl(request)
}

#[tauri::command]
fn get_battle_net_cover_art(request: BattleNetCoverArtRequest) -> Result<Option<String>, String> {
  get_battle_net_cover_art_impl(request)
}

#[tauri::command]
fn get_cached_cover_thumbnail(request: CoverThumbnailCacheLookupRequest) -> Result<Option<String>, String> {
  get_cached_cover_thumbnail_impl(request)
}

#[tauri::command]
fn get_cached_cover_thumbnail_tier(request: CoverThumbnailTierLookupRequest) -> Result<Option<String>, String> {
  get_cached_cover_thumbnail_tier_impl(request)
}

#[tauri::command]
fn cache_cover_thumbnail(request: CoverThumbnailCacheStoreRequest) -> Result<Option<String>, String> {
  cache_cover_thumbnail_impl(request)
}

#[tauri::command]
fn cache_cover_thumbnail_tiers(request: CoverThumbnailCacheStoreRequest) -> Result<CoverThumbnailTierSet, String> {
  cache_cover_thumbnail_tiers_impl(request)
}

#[tauri::command]
fn clear_cover_thumbnail_cache(request: Option<CoverThumbnailCacheClearRequest>) -> Result<CoverThumbnailCacheClearResult, String> {
  let hard = request.and_then(|value| value.hard).unwrap_or(false);
  clear_cover_thumbnail_cache_impl(hard).map(|result| CoverThumbnailCacheClearResult {
    removed_entries: result.removed_entries,
    cache_directory: result.cache_directory,
  })
}

#[tauri::command]
fn steam_browser_login_start() -> Result<SteamBrowserLoginStartResult, String> {
  steam_browser_login_start_impl()
}

#[tauri::command]
fn steam_browser_login_poll(request: SteamBrowserLoginPollRequest) -> Result<SteamBrowserLoginPollResult, String> {
  steam_browser_login_poll_impl(request)
}

#[tauri::command]
async fn test_steam_connection(request: SteamConnectionTestRequest) -> Result<SteamConnectionTestResult, String> {
  test_steam_connection_impl(request).await
}

#[tauri::command]
fn test_ra_connection(request: RaConnectionTestRequest) -> Result<RaUserProfile, String> {
  test_ra_connection_impl(&request.username, &request.api_key)
}

#[tauri::command]
fn get_ra_recent_achievements(request: RaRecentAchievementsRequest) -> Result<Vec<RaRecentAchievement>, String> {
  get_ra_recent_achievements_impl(&request.username, &request.api_key, request.count)
}

#[tauri::command]
fn get_ra_user_awards(request: RaUserAwardsRequest) -> Result<Vec<RaAward>, String> {
  get_ra_user_awards_impl(&request.username, &request.api_key)
}

#[tauri::command]
fn get_ra_completed_games(request: RaCompletedGamesRequest) -> Result<Vec<RaCompletedGame>, String> {
  get_ra_completed_games_impl(&request.username, &request.api_key)
}

#[tauri::command]
async fn get_steam_achievements(request: SteamAchievementsRequest) -> Result<SteamAchievementsResponse, String> {
  get_steam_achievements_impl(request).await
}

#[tauri::command]
async fn get_steam_playtime(request: SteamPlaytimeRequest) -> Result<SteamPlaytimeResponse, String> {
  get_steam_playtime_impl(request).await
}

#[tauri::command]
fn auto_import_games(settings: Option<ImportSettings>) -> Vec<ImportedGame> {
  gather_imports(settings.as_ref())
}

#[tauri::command]
fn auto_import_games_orchestrated(settings: Option<ImportSettings>) -> AutoImportOrchestrationResult {
  let imports = gather_imports(settings.as_ref());
  let connectors = build_connector_health(settings.as_ref(), &imports);

  AutoImportOrchestrationResult { imports, connectors }
}

#[tauri::command]
fn get_connector_health(settings: Option<ImportSettings>) -> Vec<ConnectorHealth> {
  let imports = gather_imports(settings.as_ref());
  build_connector_health(settings.as_ref(), &imports)
}

#[tauri::command]
fn get_game_update_states(request: GameUpdateStatesRequest) -> GameUpdateStatesResponse {
  let mut results = Vec::with_capacity(request.items.len());
  for item in request.items {
    results.push(resolve_game_update_status(&item));
  }

  GameUpdateStatesResponse { results }
}

#[tauri::command]
fn launch_game(app: tauri::AppHandle, request: LaunchRequest) -> Result<LaunchOutcome, String> {
  let outcome = launch_game_impl(request)?;
  if outcome.mode == "process" {
    if let Some(pid) = outcome.pid {
      spawn_process_exit_watcher(app, pid);
    }
  }
  Ok(outcome)
}

#[tauri::command]
fn ensure_retroarch_core(request: RetroArchCoreEnsureRequest) -> Result<RetroArchCoreEnsureResult, String> {
  ensure_retroarch_core_impl(request)
}

#[tauri::command]
fn enter_low_power_mode(app: tauri::AppHandle, state: tauri::State<LowPowerModeState>) -> Result<(), String> {
  if !state.close_to_tray_enabled.load(Ordering::Relaxed) {
    return Ok(());
  }

  hide_main_window(&app)
}

#[tauri::command]
fn wake_from_low_power_mode(app: tauri::AppHandle) -> Result<(), String> {
  show_main_window(&app)
}

#[tauri::command]
fn set_close_to_tray_enabled(enabled: bool, state: tauri::State<LowPowerModeState>) {
  state.close_to_tray_enabled.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn get_process_running_status(request: ProcessRunningStatusRequest) -> Vec<ProcessRunningStatusResponse> {
  request
    .pids
    .into_iter()
    .map(|pid| match is_process_running(pid) {
      Ok(running) => ProcessRunningStatusResponse {
        pid,
        running,
        status: Some(if running { "running" } else { "not_running" }.to_string()),
        query_error: None,
      },
      Err(error) => ProcessRunningStatusResponse {
        pid,
        running: false,
        status: Some("unknown".to_string()),
        query_error: Some(error),
      },
    })
    .collect()
}

#[tauri::command]
async fn get_now_playing() -> Result<Option<NowPlayingResponse>, String> {
  get_now_playing_impl().await
}

#[tauri::command]
async fn media_toggle_playback() -> Result<bool, String> {
  media_toggle_playback_impl().await
}

#[tauri::command]
async fn media_next_track() -> Result<bool, String> {
  media_next_track_impl().await
}

#[tauri::command]
async fn media_previous_track() -> Result<bool, String> {
  media_previous_track_impl().await
}

#[tauri::command]
fn get_system_volume(source_app: Option<String>, #[allow(non_snake_case)] sourceApp: Option<String>) -> Result<f64, String> {
  get_system_volume_impl(source_app, sourceApp)
}

#[tauri::command]
fn set_system_volume(percent: f64, source_app: Option<String>, #[allow(non_snake_case)] sourceApp: Option<String>) -> Result<f64, String> {
  set_system_volume_impl(percent, source_app, sourceApp)
}

const ROM_SYSTEM_SUBFOLDERS: &[&str] = &[
  "Nintendo DS",
  "Nintendo 3DS",
  "Game Boy Advance",
  "Game Boy",
  "SNES",
  "N64",
  "GameCube",
  "Wii",
  "Wii U",
  "Switch",
  "PS1",
  "PS2",
  "PS3",
  "PSP",
  "NES",
  "Sega Genesis",
];

#[tauri::command]
fn ensure_rom_folders() -> Vec<String> {
  let mut created: Vec<String> = Vec::new();

  let base = if let Some(user_profile) = std::env::var_os("USERPROFILE") {
    std::path::PathBuf::from(user_profile)
      .join("Documents")
      .join("Tile Manager")
      .join("src")
      .join("assets")
      .join("emulator")
  } else {
    return created;
  };

  if !base.exists() {
    let _ = std::fs::create_dir_all(&base);
  }

  for subfolder in ROM_SYSTEM_SUBFOLDERS {
    let path = base.join(subfolder);
    if !path.exists() {
      if std::fs::create_dir_all(&path).is_ok() {
        created.push(path.to_string_lossy().to_string());
      }
    }
  }

  created
}

#[tauri::command]
fn open_folder_in_explorer(path: String) -> Result<(), String> {
  std::process::Command::new("explorer")
    .arg(&path)
    .spawn()
    .map(|_| ())
    .map_err(|err| format!("Failed to open folder: {err}"))
}

fn boot_perf_log_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let base = app
    .path()
    .app_data_dir()
    .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;

  if !base.exists() {
    fs::create_dir_all(&base).map_err(|err| format!("Failed to create app data dir: {err}"))?;
  }

  Ok(base.join("boot-perf.log"))
}

#[tauri::command]
fn append_boot_perf_event(app: tauri::AppHandle, request: BootPerfEventRequest) -> Result<(), String> {
  let log_path = boot_perf_log_path(&app)?;
  let mut file = fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(&log_path)
    .map_err(|err| format!("Failed to open boot perf log: {err}"))?;

  let details = request.details.unwrap_or_default();
  let line = if details.trim().is_empty() {
    format!("[boot] {:.1}ms {}", request.elapsed_ms.max(0.0), request.stage.trim())
  } else {
    format!(
      "[boot] {:.1}ms {} | {}",
      request.elapsed_ms.max(0.0),
      request.stage.trim(),
      details.trim()
    )
  };

  writeln!(file, "{line}").map_err(|err| format!("Failed to write boot perf log: {err}"))
}

#[tauri::command]
fn get_recent_boot_perf_events(app: tauri::AppHandle, max_lines: Option<usize>) -> Result<Vec<String>, String> {
  let log_path = boot_perf_log_path(&app)?;
  if !log_path.exists() {
    return Ok(Vec::new());
  }

  let contents = fs::read_to_string(&log_path)
    .map_err(|err| format!("Failed to read boot perf log: {err}"))?;

  let limit = max_lines.unwrap_or(80).clamp(1, 500);
  let mut lines: Vec<String> = contents
    .lines()
    .map(|line| line.trim_end().to_string())
    .filter(|line| !line.is_empty())
    .collect();

  if lines.len() > limit {
    lines = lines.split_off(lines.len() - limit);
  }

  Ok(lines)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(LowPowerModeState::default())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let show_item = tauri::menu::MenuItem::with_id(app, "show", "Open Tilezu", true, None::<&str>)?;
      let quit_item = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let tray_menu = tauri::menu::Menu::with_items(app, &[&show_item, &quit_item])?;

      let mut tray_builder = tauri::tray::TrayIconBuilder::new()
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
          let event_id: &str = event.id().as_ref();
          if event_id == "show" {
            let _ = show_main_window(app);
            return;
          }

          if event_id == "quit" {
            app.exit(0);
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let tauri::tray::TrayIconEvent::Click {
            button: tauri::tray::MouseButton::Left,
            button_state: tauri::tray::MouseButtonState::Up,
            ..
          } = event
          {
            let _ = show_main_window(&tray.app_handle());
          }
        });

      if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
      }

      let _tray = tray_builder.build(app)?;

      Ok(())
    })
    .plugin(tauri_plugin_dialog::init())
    .plugin(
      tauri_plugin_prevent_default::Builder::new()
        .platform(
          tauri_plugin_prevent_default::PlatformOptions::new().default_context_menus(false),
        )
        .build(),
    )
    .on_window_event(|window, event| {
      if window.label() != "main" {
        return;
      }

      if let WindowEvent::CloseRequested { api, .. } = event {
        let state = window.app_handle().state::<LowPowerModeState>();
        if state.close_to_tray_enabled.load(Ordering::Relaxed) {
          api.prevent_close();
          let _ = hide_main_window(window.app_handle());
        }
      }
    })
    .invoke_handler(tauri::generate_handler![
      launch_game,
      ensure_retroarch_core,
      enter_low_power_mode,
      wake_from_low_power_mode,
      set_close_to_tray_enabled,
      get_process_running_status,
      auto_import_games,
      auto_import_games_orchestrated,
      get_connector_health,
      get_game_update_states,
      get_now_playing,
      media_toggle_playback,
      media_next_track,
      media_previous_track,
      get_system_volume,
      set_system_volume,
      get_steam_cover_art,
      get_steam_cover_art_for_entry,
      get_epic_cover_art,
      get_xbox_cover_art,
      get_battle_net_cover_art,
      get_cached_cover_thumbnail,
      get_cached_cover_thumbnail_tier,
      cache_cover_thumbnail,
      cache_cover_thumbnail_tiers,
      clear_cover_thumbnail_cache,
      get_recent_screenshot_paths,
      read_local_image_as_data_url,
      extract_exe_icon_data_url,
      get_rom_metadata_art,
      get_steam_achievements,
      get_steam_playtime,
      steam_browser_login_start,
      steam_browser_login_poll,
      test_steam_connection,
      test_ra_connection,
      get_ra_recent_achievements,
      get_ra_user_awards,
      get_ra_completed_games,
      ensure_rom_folders,
      open_folder_in_explorer,
      append_boot_perf_event,
      get_recent_boot_perf_events
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
