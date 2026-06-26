use std::collections::HashSet;
use std::fs;
use std::fs::File;
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::scanners::battle_net_scanner::{
  battle_net_cache_roots,
  battle_net_cover_score,
  battle_net_find_install_path,
  battle_net_game_definitions,
};
use crate::scanners::screenshot_scanner::{
  collect_recent_images_from_dirs,
  gather_images_recursive,
  screenshot_directories_for_request,
};
use crate::scanners::steam_scanner::{
  parse_steam_app_id_from_target,
  parse_vdf_value,
  steam_cover_candidates,
  steam_roots,
};
use crate::utils::path_utils::{image_path_to_data_url, slugify};

struct EpicManifestMatch {
  slugs: Vec<String>,
  catalog_item_ids: Vec<String>,
}

fn push_unique_lower(values: &mut Vec<String>, seen: &mut HashSet<String>, value: &str) {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return;
  }

  let key = trimmed.to_lowercase();
  if seen.insert(key) {
    values.push(trimmed.to_string());
  }
}

fn epic_field_matches(field: &str, target_lower: &str, title_lower: &str) -> bool {
  let field_lower = field.trim().to_lowercase();
  if field_lower.is_empty() {
    return false;
  }

  if !target_lower.is_empty()
    && (field_lower == target_lower
      || field_lower.contains(target_lower)
      || target_lower.contains(&field_lower))
  {
    return true;
  }

  !title_lower.is_empty()
    && (field_lower == title_lower
      || field_lower.contains(title_lower)
      || title_lower.contains(&field_lower))
}

fn epic_manifest_matches(target: &str, title: Option<&str>) -> EpicManifestMatch {
  let mut slugs: Vec<String> = Vec::new();
  let mut catalog_item_ids: Vec<String> = Vec::new();
  let mut seen_slugs: HashSet<String> = HashSet::new();
  let mut seen_catalog: HashSet<String> = HashSet::new();
  let target_lower = target.trim().to_lowercase();
  let title_lower = title.unwrap_or("").trim().to_lowercase();

  let manifest_root = PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests");
  if !manifest_root.exists() {
    return EpicManifestMatch {
      slugs,
      catalog_item_ids,
    };
  }

  let Ok(entries) = fs::read_dir(manifest_root) else {
    return EpicManifestMatch {
      slugs,
      catalog_item_ids,
    };
  };

  for entry in entries.flatten() {
    let path = entry.path();
    if path.extension().and_then(|value| value.to_str()) != Some("item") {
      continue;
    }

    let Ok(contents) = fs::read_to_string(&path) else {
      continue;
    };

    let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) else {
      continue;
    };

    let display_name = json
      .get("DisplayName")
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default();
    let app_name = json
      .get("AppName")
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default();
    let main_game_app_name = json
      .get("MainGameAppName")
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default();
    let catalog_item_id = json
      .get("CatalogItemId")
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default();

    if !(epic_field_matches(display_name, &target_lower, &title_lower)
      || epic_field_matches(app_name, &target_lower, &title_lower)
      || epic_field_matches(main_game_app_name, &target_lower, &title_lower)
      || epic_field_matches(catalog_item_id, &target_lower, &title_lower))
    {
      continue;
    }

    for candidate in [display_name, app_name, main_game_app_name] {
      let slug = slugify(candidate);
      push_unique_lower(&mut slugs, &mut seen_slugs, &slug);
    }

    if !catalog_item_id.trim().is_empty() {
      push_unique_lower(&mut catalog_item_ids, &mut seen_catalog, catalog_item_id);
      push_unique_lower(&mut slugs, &mut seen_slugs, &slugify(catalog_item_id));
    }
  }

  EpicManifestMatch {
    slugs,
    catalog_item_ids,
  }
}

fn best_epic_image_from_json(json: &serde_json::Value) -> Option<String> {
  let mut urls: Vec<String> = Vec::new();
  collect_image_urls(json, &mut urls);
  if urls.is_empty() {
    return None;
  }

  urls.sort_by_key(|value| -score_image_url(value));
  urls.into_iter().next()
}

fn fetch_epic_content_product(slug: &str) -> Option<String> {
  let url = format!("https://store-content.ak.epicgames.com/api/en-US/content/products/{slug}");
  let Ok(response) = reqwest::blocking::get(url) else {
    return None;
  };
  if !response.status().is_success() {
    return None;
  }

  let Ok(json) = response.json::<serde_json::Value>() else {
    return None;
  };

  best_epic_image_from_json(&json)
}

fn fetch_epic_catalog_item(catalog_item_id: &str) -> Option<String> {
  let url = format!(
    "https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace/epic/items/{catalog_item_id}"
  );
  let Ok(response) = reqwest::blocking::get(url) else {
    return None;
  };
  if !response.status().is_success() {
    return None;
  }

  let Ok(json) = response.json::<serde_json::Value>() else {
    return None;
  };

  best_epic_image_from_json(&json)
}

fn collect_image_urls(value: &serde_json::Value, output: &mut Vec<String>) {
  match value {
    serde_json::Value::String(text) => {
      let lower = text.to_lowercase();
      if (lower.contains("cdn2.unrealengine.com") || lower.contains("epicgames.com"))
        && (lower.contains(".jpg") || lower.contains(".jpeg") || lower.contains(".png") || lower.contains(".webp"))
      {
        output.push(text.to_string());
      }
    }
    serde_json::Value::Array(items) => {
      for item in items {
        collect_image_urls(item, output);
      }
    }
    serde_json::Value::Object(map) => {
      for value in map.values() {
        collect_image_urls(value, output);
      }
    }
    _ => {}
  }
}

fn score_image_url(url: &str) -> i32 {
  let value = url.to_lowercase();
  let mut score = 0;
  if value.contains("1200x1600") {
    score += 80;
  }
  if value.contains("keyart") {
    score += 50;
  }
  if value.contains("blade") {
    score += 30;
  }
  if value.contains("portrait") {
    score += 20;
  }
  if value.contains("hero") {
    score -= 10;
  }
  if value.contains("logo") {
    score -= 40;
  }
  if value.contains("rating") {
    score -= 80;
  }
  score
}

fn steam_remote_cover_urls(app_id: u32) -> Vec<String> {
  let base = format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}");
  vec![
    format!("{base}/library_600x900.jpg"),
    format!("{base}/library_600x900.png"),
    format!("{base}/library_capsule.jpg"),
    format!("{base}/library_capsule.png"),
    format!("{base}/header.jpg"),
    format!("{base}/header.png"),
    format!("{base}/capsule_616x353.jpg"),
    format!("{base}/capsule_616x353.png"),
    format!("{base}/library_hero.jpg"),
    format!("{base}/library_hero.png"),
  ]
}

fn parse_app_id_u32(value: &str) -> Option<u32> {
  value.trim().parse::<u32>().ok().filter(|parsed| *parsed > 0)
}

fn parse_steam_app_id_from_text(value: &str) -> Option<u32> {
  if let Some(parsed) = parse_app_id_u32(value) {
    return Some(parsed);
  }

  if let Some(parsed) = parse_steam_app_id_from_target(value).and_then(|candidate| parse_app_id_u32(&candidate)) {
    return Some(parsed);
  }

  let trimmed = value.trim();
  if trimmed.is_empty() {
    return None;
  }

  let lowered = trimmed.to_lowercase();

  if let Some(index) = lowered.find("-applaunch") {
    let suffix = &trimmed[index + "-applaunch".len()..];
    let candidate = suffix.trim_start_matches(|character: char| character == '=' || character.is_whitespace());
    let digits: String = candidate
      .chars()
      .take_while(|character| character.is_ascii_digit())
      .collect();

    if let Some(parsed) = parse_app_id_u32(&digits) {
      return Some(parsed);
    }
  }

  for token in lowered.split(|character: char| {
    character == '\\' || character == '/' || character == ' ' || character == '\"' || character == '\''
  }) {
    if !token.starts_with("appmanifest_") || !token.ends_with(".acf") {
      continue;
    }

    let digits = token
      .trim_start_matches("appmanifest_")
      .trim_end_matches(".acf");
    if let Some(parsed) = parse_app_id_u32(digits) {
      return Some(parsed);
    }
  }

  None
}

fn parse_steam_app_id_from_args(args: &[String]) -> Option<u32> {
  for index in 0..args.len() {
    let value = args[index].trim();
    if value.is_empty() {
      continue;
    }

    if let Some(parsed) = parse_steam_app_id_from_text(value) {
      return Some(parsed);
    }

    if value.eq_ignore_ascii_case("-applaunch") {
      if let Some(next) = args.get(index + 1).and_then(|candidate| parse_app_id_u32(candidate)) {
        return Some(next);
      }
    }
  }

  None
}

fn manifest_match_score(query_slug: &str, candidate_slug: &str) -> i32 {
  if query_slug.is_empty() || candidate_slug.is_empty() {
    return 0;
  }

  if query_slug == candidate_slug {
    return 1000;
  }

  if candidate_slug.starts_with(query_slug) || query_slug.starts_with(candidate_slug) {
    return 700;
  }

  if candidate_slug.contains(query_slug) || query_slug.contains(candidate_slug) {
    return 520;
  }

  // Lightweight token overlap for near matches like "hollow-knight" vs "hollowknight".
  let query_tokens: Vec<&str> = query_slug.split('-').filter(|token| !token.is_empty()).collect();
  let candidate_tokens: Vec<&str> = candidate_slug.split('-').filter(|token| !token.is_empty()).collect();
  if query_tokens.is_empty() || candidate_tokens.is_empty() {
    return 0;
  }

  let mut overlap = 0;
  for query_token in &query_tokens {
    if candidate_tokens.iter().any(|candidate_token| candidate_token == query_token) {
      overlap += 1;
    }
  }

  if overlap == 0 {
    return 0;
  }

  overlap * 120
}

fn steam_app_id_from_manifest_title_match(query: &str) -> Option<u32> {
  let query_slug = slugify(query.trim());
  if query_slug.is_empty() {
    return None;
  }

  let mut best_score = 0;
  let mut best_app_id: Option<u32> = None;

  for root in steam_roots() {
    let steamapps = root.join("steamapps");
    let Ok(entries) = fs::read_dir(steamapps) else {
      continue;
    };

    for entry in entries.flatten() {
      let path = entry.path();
      let file_name = entry.file_name().to_string_lossy().to_string();
      if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
        continue;
      }

      let Ok(contents) = fs::read_to_string(path) else {
        continue;
      };

      let Some(app_id_text) = parse_vdf_value(&contents, "appid") else {
        continue;
      };

      let Some(app_id) = parse_app_id_u32(&app_id_text) else {
        continue;
      };

      let title = parse_vdf_value(&contents, "name").unwrap_or_default();
      let title_slug = slugify(title.trim());
      let score = manifest_match_score(&query_slug, &title_slug);

      if score <= best_score {
        continue;
      }

      best_score = score;
      best_app_id = Some(app_id);
    }
  }

  best_app_id
}

fn steam_app_id_from_store_search(query: &str) -> Option<u32> {
  let trimmed = query.trim();
  if trimmed.is_empty() {
    return None;
  }

  let encoded_query: String = url::form_urlencoded::byte_serialize(trimmed.as_bytes()).collect();
  let search_url = format!(
    "https://store.steampowered.com/api/storesearch/?term={encoded_query}&l=english&cc=US"
  );

  let client = reqwest::blocking::Client::builder()
    .timeout(Duration::from_secs(7))
    .build()
    .ok()?;

  let response = client
    .get(search_url)
    .header(reqwest::header::USER_AGENT, "TileManager/1.0")
    .send()
    .ok()?;

  if !response.status().is_success() {
    return None;
  }

  let payload = response.json::<serde_json::Value>().ok()?;
  let items = payload.get("items")?.as_array()?;
  if items.is_empty() {
    return None;
  }

  let query_slug = slugify(trimmed);
  let mut best_score = 0;
  let mut best_app_id: Option<u32> = None;

  for item in items {
    let Some(app_id_raw) = item.get("id").and_then(serde_json::Value::as_u64) else {
      continue;
    };

    let Ok(app_id) = u32::try_from(app_id_raw) else {
      continue;
    };

    if app_id == 0 {
      continue;
    }

    let name = item
      .get("name")
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default();
    let name_slug = slugify(name);
    let mut score = manifest_match_score(&query_slug, &name_slug);

    let item_type = item
      .get("type")
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default();
    if item_type.eq_ignore_ascii_case("app") {
      score += 50;
    }

    if score <= best_score {
      continue;
    }

    best_score = score;
    best_app_id = Some(app_id);
  }

  best_app_id
}

fn infer_steam_app_id_from_lookup_request(request: &crate::SteamCoverArtLookupRequest) -> Option<u32> {
  if let Some(app_id) = request.app_id {
    if app_id > 0 {
      return Some(app_id);
    }
  }

  if let Some(target) = &request.target {
    if let Some(parsed) = parse_steam_app_id_from_text(target) {
      return Some(parsed);
    }
  }

  if let Some(args) = &request.args {
    if let Some(parsed) = parse_steam_app_id_from_args(args) {
      return Some(parsed);
    }
  }

  if let Some(title) = &request.title {
    if let Some(parsed) = steam_app_id_from_manifest_title_match(title) {
      return Some(parsed);
    }
  }

  if let Some(target) = &request.target {
    if let Some(parsed) = steam_app_id_from_manifest_title_match(target) {
      return Some(parsed);
    }
  }

  if let Some(title) = &request.title {
    if let Some(parsed) = steam_app_id_from_store_search(title) {
      return Some(parsed);
    }
  }

  if let Some(target) = &request.target {
    if let Some(parsed) = steam_app_id_from_store_search(target) {
      return Some(parsed);
    }
  }

  None
}

fn mime_from_image_url(url: &str) -> &'static str {
  let lower = url.to_lowercase();
  if lower.ends_with(".png") {
    return "image/png";
  }

  "image/jpeg"
}

fn fetch_remote_cover_as_data_url(client: &reqwest::blocking::Client, url: &str) -> Option<String> {
  let response = client.get(url).send().ok()?;
  if !response.status().is_success() {
    return None;
  }

  let mime = response
    .headers()
    .get(reqwest::header::CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
    .map(|value| value.split(';').next().unwrap_or(value).trim().to_lowercase())
    .filter(|value| value.starts_with("image/"))
    .unwrap_or_else(|| mime_from_image_url(url).to_string());

  let bytes = response.bytes().ok()?;
  if bytes.is_empty() {
    return None;
  }

  Some(encode_data_url(&mime, bytes.as_ref()))
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CoverThumbnailCacheRecord {
  data_url: String,
  updated_at_epoch_ms: u128,
  width: u32,
  height: u32,
}

#[derive(Debug)]
pub(crate) struct CoverThumbnailCacheClearResult {
  pub(crate) removed_entries: u32,
  pub(crate) cache_directory: String,
}

const COVER_THUMB_CACHE_MAX_ENTRIES: usize = 1200;
const COVER_THUMB_CACHE_MAX_AGE_MS: u128 = 1000 * 60 * 60 * 24 * 45;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CoverThumbnailTier {
  GridXs,
  GridMd,
  Detail,
}

impl CoverThumbnailTier {
  fn cache_suffix(self) -> &'static str {
    match self {
      Self::GridXs => "grid-xs",
      Self::GridMd => "grid-md",
      Self::Detail => "detail",
    }
  }

  fn target_dimensions(self) -> (u32, u32) {
    match self {
      Self::GridXs => (196, 294),
      Self::GridMd => (320, 480),
      Self::Detail => (640, 960),
    }
  }
}

fn parse_cover_thumbnail_tier(value: &str) -> Option<CoverThumbnailTier> {
  let normalized = value.trim().to_lowercase();
  match normalized.as_str() {
    "grid-xs" | "grid_xs" | "thumb" | "thumbnail" => Some(CoverThumbnailTier::GridXs),
    "grid-md" | "grid_md" | "medium" => Some(CoverThumbnailTier::GridMd),
    "detail" | "full" | "hires" | "high" => Some(CoverThumbnailTier::Detail),
    _ => None,
  }
}

fn is_cache_entry_stale(updated_at_epoch_ms: u128, now_epoch_ms: u128) -> bool {
  now_epoch_ms.saturating_sub(updated_at_epoch_ms) > COVER_THUMB_CACHE_MAX_AGE_MS
}

fn parse_cache_record(payload: &str) -> Option<CoverThumbnailCacheRecord> {
  serde_json::from_str::<CoverThumbnailCacheRecord>(payload).ok()
}

fn cache_file_updated_epoch_ms(path: &PathBuf) -> u128 {
  fs::metadata(path)
    .and_then(|metadata| metadata.modified())
    .ok()
    .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
    .map(|duration| duration.as_millis())
    .unwrap_or(0)
}

fn cache_record_updated_epoch_ms(record: &CoverThumbnailCacheRecord, path: &PathBuf) -> u128 {
  if record.updated_at_epoch_ms > 0 {
    record.updated_at_epoch_ms
  } else {
    cache_file_updated_epoch_ms(path)
  }
}

fn prune_cover_thumbnail_cache(now_epoch_ms: u128) {
  let cache_dir = cover_thumbnail_cache_dir();
  let Ok(entries) = fs::read_dir(&cache_dir) else {
    return;
  };

  let mut fresh_entries: Vec<(PathBuf, u128)> = Vec::new();

  for entry in entries.flatten() {
    let path = entry.path();
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
      continue;
    }

    let payload = match fs::read_to_string(&path) {
      Ok(value) => value,
      Err(_) => {
        let _ = fs::remove_file(&path);
        continue;
      }
    };

    if let Some(record) = parse_cache_record(&payload) {
      if record.data_url.trim().is_empty() {
        let _ = fs::remove_file(&path);
        continue;
      }

      let updated_epoch_ms = cache_record_updated_epoch_ms(&record, &path);
      if is_cache_entry_stale(updated_epoch_ms, now_epoch_ms) {
        let _ = fs::remove_file(&path);
        continue;
      }

      fresh_entries.push((path, updated_epoch_ms));
      continue;
    }

    if payload.trim().starts_with("data:") {
      let updated_epoch_ms = cache_file_updated_epoch_ms(&path);
      if is_cache_entry_stale(updated_epoch_ms, now_epoch_ms) {
        let _ = fs::remove_file(&path);
        continue;
      }

      fresh_entries.push((path, updated_epoch_ms));
      continue;
    }

    let _ = fs::remove_file(&path);
  }

  if fresh_entries.len() <= COVER_THUMB_CACHE_MAX_ENTRIES {
    return;
  }

  fresh_entries.sort_by(|left, right| right.1.cmp(&left.1));
  for (path, _) in fresh_entries.into_iter().skip(COVER_THUMB_CACHE_MAX_ENTRIES) {
    let _ = fs::remove_file(path);
  }
}

fn now_epoch_ms() -> u128 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis())
    .unwrap_or(0)
}

fn cover_thumbnail_cache_dir() -> PathBuf {
  let base = std::env::var("LOCALAPPDATA")
    .map(PathBuf::from)
    .unwrap_or_else(|_| std::env::temp_dir());

  base.join("TileManager").join("cover-thumb-cache")
}

fn cover_thumbnail_cache_path(cache_key: &str, tier: Option<CoverThumbnailTier>) -> PathBuf {
  let normalized_key = cache_key.trim().to_lowercase();
  let lookup_key = if let Some(tier_value) = tier {
    format!("{normalized_key}::{}", tier_value.cache_suffix())
  } else {
    normalized_key
  };

  let encoded = {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(lookup_key.as_bytes())
  };

  cover_thumbnail_cache_dir().join(format!("{encoded}.json"))
}

pub(crate) fn clear_cover_thumbnail_cache_impl(hard: bool) -> Result<CoverThumbnailCacheClearResult, String> {
  let cache_dir = cover_thumbnail_cache_dir();
  let cache_directory = cache_dir.to_string_lossy().to_string();

  if !cache_dir.exists() {
    return Ok(CoverThumbnailCacheClearResult {
      removed_entries: 0,
      cache_directory,
    });
  }

  let mut removed_entries = 0u32;

  if hard {
    let entries = fs::read_dir(&cache_dir)
      .map_err(|error| format!("Failed to enumerate cover cache directory: {error}"))?;

    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        if fs::remove_dir_all(&path).is_ok() {
          removed_entries = removed_entries.saturating_add(1);
        }
        continue;
      }

      if fs::remove_file(&path).is_ok() {
        removed_entries = removed_entries.saturating_add(1);
      }
    }

    return Ok(CoverThumbnailCacheClearResult {
      removed_entries,
      cache_directory,
    });
  }

  let entries = fs::read_dir(&cache_dir)
    .map_err(|error| format!("Failed to enumerate cover cache directory: {error}"))?;

  for entry in entries.flatten() {
    let path = entry.path();
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
      continue;
    }

    if fs::remove_file(path).is_ok() {
      removed_entries = removed_entries.saturating_add(1);
    }
  }

  Ok(CoverThumbnailCacheClearResult {
    removed_entries,
    cache_directory,
  })
}

fn read_cached_cover_thumbnail_data_url(
  cache_key: &str,
  tier: Option<CoverThumbnailTier>,
  now_epoch: u128,
) -> Option<String> {
  let cache_path = cover_thumbnail_cache_path(cache_key, tier);
  let Ok(payload) = fs::read_to_string(&cache_path) else {
    return None;
  };

  if let Some(record) = parse_cache_record(&payload) {
    let updated_epoch_ms = cache_record_updated_epoch_ms(&record, &cache_path);
    if is_cache_entry_stale(updated_epoch_ms, now_epoch) {
      let _ = fs::remove_file(&cache_path);
      return None;
    }

    if !record.data_url.trim().is_empty() {
      return Some(record.data_url);
    }

    let _ = fs::remove_file(&cache_path);
    return None;
  }

  let value = payload.trim();
  if value.starts_with("data:") {
    let updated_epoch_ms = cache_file_updated_epoch_ms(&cache_path);
    if is_cache_entry_stale(updated_epoch_ms, now_epoch) {
      let _ = fs::remove_file(&cache_path);
      return None;
    }

    return Some(value.to_string());
  }

  let _ = fs::remove_file(&cache_path);
  None
}

fn write_cover_thumbnail_cache_record(
  cache_key: &str,
  tier: Option<CoverThumbnailTier>,
  data_url: &str,
  width: u32,
  height: u32,
) -> Result<(), String> {
  let cache_dir = cover_thumbnail_cache_dir();
  fs::create_dir_all(&cache_dir).map_err(|error| format!("Failed to create cover cache directory: {error}"))?;

  let cache_record = CoverThumbnailCacheRecord {
    data_url: data_url.to_string(),
    updated_at_epoch_ms: now_epoch_ms(),
    width,
    height,
  };

  let payload = serde_json::to_string(&cache_record).map_err(|error| format!("Failed to serialize cover cache entry: {error}"))?;
  let cache_path = cover_thumbnail_cache_path(cache_key, tier);
  fs::write(cache_path, payload).map_err(|error| format!("Failed to write cover cache entry: {error}"))
}

fn source_to_cached_data_urls_for_tiers(
  source: &str,
  tiers: &[CoverThumbnailTier],
) -> Result<Vec<(CoverThumbnailTier, String, u32, u32)>, String> {
  let (mime_hint, bytes) = fetch_cover_source_bytes(source)?;

  let decoded = image::load_from_memory(&bytes);
  if let Ok(image) = decoded {
    let (output_format, output_mime) = if mime_hint.contains("png") {
      (image::ImageFormat::Png, "image/png")
    } else {
      (image::ImageFormat::Jpeg, "image/jpeg")
    };

    let mut outputs: Vec<(CoverThumbnailTier, String, u32, u32)> = Vec::with_capacity(tiers.len());
    for tier in tiers {
      let (width, height) = tier.target_dimensions();
      let resized = if image.width() > width || image.height() > height {
        image.resize(width, height, image::imageops::FilterType::Lanczos3)
      } else {
        image.clone()
      };

      let mut cursor = Cursor::new(Vec::new());
      resized
        .write_to(&mut cursor, output_format)
        .map_err(|error| format!("Failed to encode normalized cover thumbnail: {error}"))?;

      outputs.push((*tier, encode_data_url(output_mime, &cursor.into_inner()), width, height));
    }

    return Ok(outputs);
  }

  if mime_hint.starts_with("image/") {
    let encoded = encode_data_url(&mime_hint, &bytes);
    return Ok(
      tiers
        .iter()
        .map(|tier| {
          let (width, height) = tier.target_dimensions();
          (*tier, encoded.clone(), width, height)
        })
        .collect(),
    );
  }

  Err("Cover source is not a supported image".to_string())
}

fn encode_data_url(mime: &str, bytes: &[u8]) -> String {
  let encoded = {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
  };

  format!("data:{mime};base64,{encoded}")
}

fn decode_data_url(source: &str) -> Result<(String, Vec<u8>), String> {
  let Some((meta, payload)) = source.split_once(',') else {
    return Err("Cover data URL is malformed".to_string());
  };

  if !meta.starts_with("data:") {
    return Err("Cover source is not a data URL".to_string());
  }

  let mime = meta
    .trim_start_matches("data:")
    .split(';')
    .next()
    .map(|value| value.trim().to_lowercase())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| "application/octet-stream".to_string());

  if !meta.to_lowercase().contains(";base64") {
    return Err("Only base64 data URLs are supported for cover cache".to_string());
  }

  let bytes = {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
      .decode(payload)
      .map_err(|error| format!("Failed to decode cover data URL: {error}"))?
  };

  Ok((mime, bytes))
}

fn fetch_cover_source_bytes(source: &str) -> Result<(String, Vec<u8>), String> {
  let trimmed = source.trim();
  if trimmed.starts_with("data:") {
    return decode_data_url(trimmed);
  }

  if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
    let response = reqwest::blocking::get(trimmed).map_err(|error| format!("Failed to download cover art: {error}"))?;
    if !response.status().is_success() {
      return Err(format!("Cover art download returned HTTP {}", response.status()));
    }

    let mime = response
      .headers()
      .get(reqwest::header::CONTENT_TYPE)
      .and_then(|value| value.to_str().ok())
      .map(|value| value.split(';').next().unwrap_or(value).trim().to_lowercase())
      .filter(|value| !value.is_empty())
      .unwrap_or_else(|| "image/jpeg".to_string());

    let bytes = response
      .bytes()
      .map_err(|error| format!("Failed to read downloaded cover bytes: {error}"))?
      .to_vec();

    return Ok((mime, bytes));
  }

  Err("Unsupported cover source format".to_string())
}

fn source_to_cached_data_url(source: &str, target_width: u32, target_height: u32) -> Result<String, String> {
  let (mime_hint, bytes) = fetch_cover_source_bytes(source)?;

  let decoded = image::load_from_memory(&bytes);
  if let Ok(image) = decoded {
    let max_width = target_width.max(1);
    let max_height = target_height.max(1);

    let resized = if image.width() > max_width || image.height() > max_height {
      image.resize(max_width, max_height, image::imageops::FilterType::Lanczos3)
    } else {
      image
    };

    let (output_format, output_mime) = if mime_hint.contains("png") {
      (image::ImageFormat::Png, "image/png")
    } else {
      (image::ImageFormat::Jpeg, "image/jpeg")
    };

    let mut cursor = Cursor::new(Vec::new());
    resized
      .write_to(&mut cursor, output_format)
      .map_err(|error| format!("Failed to encode normalized cover thumbnail: {error}"))?;

    return Ok(encode_data_url(output_mime, &cursor.into_inner()));
  }

  if mime_hint.starts_with("image/") {
    return Ok(encode_data_url(&mime_hint, &bytes));
  }

  Err("Cover source is not a supported image".to_string())
}

pub(crate) fn get_cached_cover_thumbnail_impl(
  request: crate::CoverThumbnailCacheLookupRequest,
) -> Result<Option<String>, String> {
  let now_epoch = now_epoch_ms();
  let cache_key = request.cache_key.trim();
  if cache_key.is_empty() {
    return Ok(None);
  }

  if let Some(cached) = read_cached_cover_thumbnail_data_url(cache_key, Some(CoverThumbnailTier::Detail), now_epoch) {
    return Ok(Some(cached));
  }

  if let Some(cached) = read_cached_cover_thumbnail_data_url(cache_key, None, now_epoch) {
    return Ok(Some(cached));
  }

  if let Some(cached) = read_cached_cover_thumbnail_data_url(cache_key, Some(CoverThumbnailTier::GridMd), now_epoch) {
    return Ok(Some(cached));
  }

  Ok(None)
}

pub(crate) fn get_cached_cover_thumbnail_tier_impl(
  request: crate::CoverThumbnailTierLookupRequest,
) -> Result<Option<String>, String> {
  let now_epoch = now_epoch_ms();
  let cache_key = request.cache_key.trim();
  if cache_key.is_empty() {
    return Ok(None);
  }

  let Some(tier) = parse_cover_thumbnail_tier(&request.tier) else {
    return Err("Invalid cover thumbnail tier requested".to_string());
  };

  if let Some(cached) = read_cached_cover_thumbnail_data_url(cache_key, Some(tier), now_epoch) {
    return Ok(Some(cached));
  }

  if tier == CoverThumbnailTier::GridMd {
    return Ok(read_cached_cover_thumbnail_data_url(cache_key, None, now_epoch));
  }

  Ok(None)
}

pub(crate) fn cache_cover_thumbnail_impl(
  request: crate::CoverThumbnailCacheStoreRequest,
) -> Result<Option<String>, String> {
  let cache_key = request.cache_key.trim();
  let source = request.source.trim();

  if cache_key.is_empty() || source.is_empty() {
    return Ok(None);
  }

  let width = request.width.unwrap_or(420).clamp(120, 2048);
  let height = request.height.unwrap_or(630).clamp(120, 2048);

  let normalized = source_to_cached_data_url(source, width, height).unwrap_or_else(|_| source.to_string());
  write_cover_thumbnail_cache_record(cache_key, None, &normalized, width, height)?;

  prune_cover_thumbnail_cache(now_epoch_ms());

  Ok(Some(normalized))
}

pub(crate) fn cache_cover_thumbnail_tiers_impl(
  request: crate::CoverThumbnailCacheStoreRequest,
) -> Result<crate::CoverThumbnailTierSet, String> {
  let cache_key = request.cache_key.trim();
  let source = request.source.trim();
  if cache_key.is_empty() || source.is_empty() {
    return Ok(crate::CoverThumbnailTierSet {
      grid_xs: None,
      grid_md: None,
      detail: None,
    });
  }

  let tiers = [CoverThumbnailTier::GridXs, CoverThumbnailTier::GridMd, CoverThumbnailTier::Detail];
  let normalized_tier_data = source_to_cached_data_urls_for_tiers(source, &tiers).unwrap_or_else(|_| {
    tiers
      .iter()
      .map(|tier| {
        let (width, height) = tier.target_dimensions();
        (*tier, source.to_string(), width, height)
      })
      .collect()
  });

  let mut grid_xs: Option<String> = None;
  let mut grid_md: Option<String> = None;
  let mut detail: Option<String> = None;

  for (tier, data_url, width, height) in normalized_tier_data {
    write_cover_thumbnail_cache_record(cache_key, Some(tier), &data_url, width, height)?;

    match tier {
      CoverThumbnailTier::GridXs => {
        grid_xs = Some(data_url);
      }
      CoverThumbnailTier::GridMd => {
        grid_md = Some(data_url);
      }
      CoverThumbnailTier::Detail => {
        detail = Some(data_url);
      }
    }
  }

  prune_cover_thumbnail_cache(now_epoch_ms());

  Ok(crate::CoverThumbnailTierSet {
    grid_xs,
    grid_md,
    detail,
  })
}

pub(crate) fn get_epic_cover_art_impl(request: crate::EpicCoverArtRequest) -> Result<Option<String>, String> {
  let target = request.target.trim();
  let title = request.title.as_deref().unwrap_or("").trim();
  if target.is_empty() && title.is_empty() {
    return Ok(None);
  }

  let manifest_match = epic_manifest_matches(target, if title.is_empty() { None } else { Some(title) });
  let mut slugs: Vec<String> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  for candidate in manifest_match.slugs {
    if seen.insert(candidate.clone()) {
      slugs.push(candidate);
    }
  }

  for candidate in [slugify(target), slugify(title), target.to_lowercase(), title.to_lowercase()] {
    if !candidate.is_empty() && seen.insert(candidate.clone()) {
      slugs.push(candidate);
    }
  }

  for slug in slugs {
    if let Some(best) = fetch_epic_content_product(&slug) {
      return Ok(Some(best));
    }
  }

  for catalog_item_id in manifest_match.catalog_item_ids {
    if let Some(best) = fetch_epic_catalog_item(&catalog_item_id) {
      return Ok(Some(best));
    }
  }

  Ok(None)
}

pub(crate) fn read_local_image_as_data_url_impl(request: crate::LocalImageRequest) -> Result<String, String> {
  let path = PathBuf::from(request.path.trim());
  if !path.exists() {
    return Err("Selected image path does not exist".to_string());
  }

  let bytes = fs::read(&path).map_err(|error| format!("Failed to read selected image: {error}"))?;
  let mime = match path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_lowercase())
    .as_deref()
  {
    Some("png") => "image/png",
    Some("webp") => "image/webp",
    Some("jpg") | Some("jpeg") => "image/jpeg",
    _ => "application/octet-stream",
  };

  let encoded = {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
  };

  Ok(format!("data:{mime};base64,{encoded}"))
}

const DS_BANNER_POINTER_OFFSET: u64 = 0x68;
const DS_BANNER_READ_LEN: usize = 0x1240;
const DS_BANNER_ICON_OFFSET: usize = 0x20;
const DS_BANNER_ICON_LEN: usize = 0x200;
const DS_BANNER_PALETTE_OFFSET: usize = 0x220;
const DS_BANNER_PALETTE_LEN: usize = 0x20;
const DS_BANNER_TITLES_OFFSET: usize = 0x240;
const DS_BANNER_TITLE_BLOCK_LEN: usize = 0x100;

const SMDH_SCAN_LIMIT_BYTES: u64 = 64 * 1024 * 1024;
const SMDH_READ_LEN: usize = 0x36C0;
const SMDH_TITLE_TABLE_OFFSET: usize = 0x8;
const SMDH_TITLE_RECORD_LEN: usize = 0x200;
const SMDH_SHORT_TITLE_LEN: usize = 0x80;
const SMDH_PUBLISHER_OFFSET: usize = 0x180;
const SMDH_PUBLISHER_LEN: usize = 0x80;
const SMDH_LARGE_ICON_OFFSET: usize = 0x24C0;
const SMDH_LARGE_ICON_LEN: usize = 0x1200;

fn expand_5bit(value: u8) -> u8 {
  (value << 3) | (value >> 2)
}

fn expand_6bit(value: u8) -> u8 {
  (value << 2) | (value >> 4)
}

fn decode_utf16le_field(bytes: &[u8]) -> Option<String> {
  if bytes.len() < 2 {
    return None;
  }

  let mut values: Vec<u16> = Vec::with_capacity(bytes.len() / 2);
  for chunk in bytes.chunks_exact(2) {
    let value = u16::from_le_bytes([chunk[0], chunk[1]]);
    if value == 0 {
      break;
    }

    values.push(value);
  }

  if values.is_empty() {
    return None;
  }

  let decoded = String::from_utf16_lossy(&values);
  let collapsed = decoded
    .replace('\r', "")
    .split('\n')
    .map(str::trim)
    .filter(|line| !line.is_empty())
    .collect::<Vec<_>>()
    .join(" - ");
  let cleaned = collapsed.trim_matches('\0').trim().to_string();

  if cleaned.is_empty() {
    None
  } else {
    Some(cleaned)
  }
}

fn infer_rom_profile(path: &Path, profile_hint: Option<&str>) -> Option<String> {
  if let Some(raw_profile) = profile_hint {
    let normalized = raw_profile.trim().to_lowercase();
    if normalized == "ds" || normalized == "3ds" {
      return Some(normalized);
    }
  }

  let extension = path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.trim().to_lowercase())?;

  match extension.as_str() {
    "nds" | "dsi" => Some("ds".to_string()),
    "3ds" | "3dsx" | "cia" | "cci" | "cxi" | "app" | "ncch" | "cfa" | "smdh" => Some("3ds".to_string()),
    _ => None,
  }
}

fn read_file_window(path: &Path, offset: u64, max_len: usize) -> Result<Vec<u8>, String> {
  let mut file = File::open(path).map_err(|error| format!("Failed to open ROM file: {error}"))?;
  file
    .seek(SeekFrom::Start(offset))
    .map_err(|error| format!("Failed to read ROM metadata section: {error}"))?;

  let mut buffer = vec![0u8; max_len];
  let mut total = 0usize;
  while total < buffer.len() {
    let read = file
      .read(&mut buffer[total..])
      .map_err(|error| format!("Failed to read ROM metadata bytes: {error}"))?;
    if read == 0 {
      break;
    }
    total += read;
  }

  buffer.truncate(total);
  Ok(buffer)
}

fn decode_ds_icon_data_url(banner: &[u8]) -> Option<String> {
  if banner.len() < DS_BANNER_PALETTE_OFFSET + DS_BANNER_PALETTE_LEN {
    return None;
  }

  let icon = &banner[DS_BANNER_ICON_OFFSET..DS_BANNER_ICON_OFFSET + DS_BANNER_ICON_LEN];
  let palette = &banner[DS_BANNER_PALETTE_OFFSET..DS_BANNER_PALETTE_OFFSET + DS_BANNER_PALETTE_LEN];
  let mut decoded = image::RgbaImage::new(32, 32);

  for tile_y in 0..4usize {
    for tile_x in 0..4usize {
      let tile_offset = (tile_y * 4 + tile_x) * 32;
      for local_y in 0..8usize {
        for local_x in 0..8usize {
          let packed = icon[tile_offset + local_y * 4 + (local_x / 2)];
          let palette_index = if local_x % 2 == 0 { packed & 0x0f } else { packed >> 4 };
          let palette_offset = usize::from(palette_index) * 2;
          if palette_offset + 1 >= palette.len() {
            continue;
          }

          let color = u16::from_le_bytes([palette[palette_offset], palette[palette_offset + 1]]);
          let red = expand_5bit((color & 0x1f) as u8);
          let green = expand_5bit(((color >> 5) & 0x1f) as u8);
          let blue = expand_5bit(((color >> 10) & 0x1f) as u8);
          let alpha = 255;

          decoded.put_pixel(
            (tile_x * 8 + local_x) as u32,
            (tile_y * 8 + local_y) as u32,
            image::Rgba([red, green, blue, alpha]),
          );
        }
      }
    }
  }

  let mut cursor = Cursor::new(Vec::new());
  if image::DynamicImage::ImageRgba8(decoded)
    .write_to(&mut cursor, image::ImageFormat::Png)
    .is_err()
  {
    return None;
  }

  Some(encode_data_url("image/png", &cursor.into_inner()))
}

fn extract_ds_metadata(path: &Path) -> Result<Option<crate::RomMetadataArtResult>, String> {
  let mut file = match File::open(path) {
    Ok(file) => file,
    Err(_) => return Ok(None),
  };

  let mut banner_pointer = [0u8; 4];
  if file.seek(SeekFrom::Start(DS_BANNER_POINTER_OFFSET)).is_err() {
    return Ok(None);
  }
  if file.read_exact(&mut banner_pointer).is_err() {
    return Ok(None);
  }

  let banner_offset = u32::from_le_bytes(banner_pointer) as u64;
  if banner_offset == 0 {
    return Ok(None);
  }

  let banner = match read_file_window(path, banner_offset, DS_BANNER_READ_LEN) {
    Ok(bytes) => bytes,
    Err(_) => return Ok(None),
  };
  if banner.len() < DS_BANNER_PALETTE_OFFSET + DS_BANNER_PALETTE_LEN {
    return Ok(None);
  }

  let title_languages = [1usize, 0, 5, 2, 3, 4, 6, 7];
  let mut title: Option<String> = None;
  for language in title_languages {
    let offset = DS_BANNER_TITLES_OFFSET + language * DS_BANNER_TITLE_BLOCK_LEN;
    if offset + DS_BANNER_TITLE_BLOCK_LEN > banner.len() {
      continue;
    }

    title = decode_utf16le_field(&banner[offset..offset + DS_BANNER_TITLE_BLOCK_LEN]);
    if title.is_some() {
      break;
    }
  }

  let icon_data_url = decode_ds_icon_data_url(&banner);
  if title.is_none() && icon_data_url.is_none() {
    return Ok(None);
  }

  Ok(Some(crate::RomMetadataArtResult {
    title,
    publisher: None,
    icon_data_url,
    source: "ds-banner".to_string(),
  }))
}

fn find_magic_offset_in_file(path: &Path, magic: &[u8], limit_bytes: u64) -> Result<Option<u64>, String> {
  if magic.is_empty() {
    return Ok(None);
  }

  let mut file = File::open(path).map_err(|error| format!("Failed to open ROM file: {error}"))?;
  let mut consumed = 0u64;
  let mut overlap: Vec<u8> = Vec::new();
  let mut chunk = vec![0u8; 1024 * 1024];

  while consumed < limit_bytes {
    let remaining = usize::try_from(limit_bytes.saturating_sub(consumed)).unwrap_or(usize::MAX);
    let read_cap = chunk.len().min(remaining);
    if read_cap == 0 {
      break;
    }

    let bytes_read = file
      .read(&mut chunk[..read_cap])
      .map_err(|error| format!("Failed while scanning ROM metadata: {error}"))?;
    if bytes_read == 0 {
      break;
    }

    let mut combined = Vec::with_capacity(overlap.len() + bytes_read);
    combined.extend_from_slice(&overlap);
    combined.extend_from_slice(&chunk[..bytes_read]);

    if let Some(index) = combined.windows(magic.len()).position(|window| window == magic) {
      let absolute = consumed.saturating_sub(overlap.len() as u64) + index as u64;
      return Ok(Some(absolute));
    }

    consumed = consumed.saturating_add(bytes_read as u64);
    let keep = magic.len().saturating_sub(1);
    if keep == 0 {
      overlap.clear();
    } else if combined.len() > keep {
      overlap = combined[combined.len() - keep..].to_vec();
    } else {
      overlap = combined;
    }
  }

  Ok(None)
}

fn decode_smdh_icon_data_url(smdh: &[u8]) -> Option<String> {
  if smdh.len() < SMDH_LARGE_ICON_OFFSET + SMDH_LARGE_ICON_LEN {
    return None;
  }

  const TILE_PIXEL_ORDER: [usize; 64] = [
    0, 1, 8, 9, 2, 3, 10, 11,
    16, 17, 24, 25, 18, 19, 26, 27,
    4, 5, 12, 13, 6, 7, 14, 15,
    20, 21, 28, 29, 22, 23, 30, 31,
    32, 33, 40, 41, 34, 35, 42, 43,
    48, 49, 56, 57, 50, 51, 58, 59,
    36, 37, 44, 45, 38, 39, 46, 47,
    52, 53, 60, 61, 54, 55, 62, 63,
  ];

  let icon = &smdh[SMDH_LARGE_ICON_OFFSET..SMDH_LARGE_ICON_OFFSET + SMDH_LARGE_ICON_LEN];
  let mut decoded = image::RgbaImage::new(48, 48);

  for tile_y in 0..6usize {
    for tile_x in 0..6usize {
      let tile_offset = (tile_y * 6 + tile_x) * 64 * 2;
      for local_pixel_index in 0..64usize {
        let source_offset = tile_offset + local_pixel_index * 2;
        if source_offset + 1 >= icon.len() {
          continue;
        }

        let packed = u16::from_le_bytes([icon[source_offset], icon[source_offset + 1]]);
        let red = expand_5bit(((packed >> 11) & 0x1f) as u8);
        let green = expand_6bit(((packed >> 5) & 0x3f) as u8);
        let blue = expand_5bit((packed & 0x1f) as u8);

        let mapped = TILE_PIXEL_ORDER[local_pixel_index];
        let x = tile_x * 8 + (mapped % 8);
        let y = tile_y * 8 + (mapped / 8);
        decoded.put_pixel(x as u32, y as u32, image::Rgba([red, green, blue, 255]));
      }
    }
  }

  let mut cursor = Cursor::new(Vec::new());
  if image::DynamicImage::ImageRgba8(decoded)
    .write_to(&mut cursor, image::ImageFormat::Png)
    .is_err()
  {
    return None;
  }

  Some(encode_data_url("image/png", &cursor.into_inner()))
}

fn extract_3ds_metadata(path: &Path) -> Result<Option<crate::RomMetadataArtResult>, String> {
  let extension = path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_lowercase())
    .unwrap_or_default();

  let smdh_offset = if extension == "smdh" {
    Some(0)
  } else {
    find_magic_offset_in_file(path, b"SMDH", SMDH_SCAN_LIMIT_BYTES)?
  };

  let Some(offset) = smdh_offset else {
    return Ok(None);
  };

  let smdh = match read_file_window(path, offset, SMDH_READ_LEN) {
    Ok(bytes) => bytes,
    Err(_) => return Ok(None),
  };

  if smdh.len() < SMDH_TITLE_TABLE_OFFSET + SMDH_TITLE_RECORD_LEN || !smdh.starts_with(b"SMDH") {
    return Ok(None);
  }

  let language_order = [1usize, 0, 2, 5, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  let mut title: Option<String> = None;
  let mut publisher: Option<String> = None;

  for language in language_order {
    let base = SMDH_TITLE_TABLE_OFFSET + language * SMDH_TITLE_RECORD_LEN;
    if base + SMDH_TITLE_RECORD_LEN > smdh.len() {
      continue;
    }

    if title.is_none() {
      title = decode_utf16le_field(&smdh[base..base + SMDH_SHORT_TITLE_LEN]);
    }
    if publisher.is_none() {
      let publisher_start = base + SMDH_PUBLISHER_OFFSET;
      let publisher_end = publisher_start + SMDH_PUBLISHER_LEN;
      publisher = decode_utf16le_field(&smdh[publisher_start..publisher_end]);
    }

    if title.is_some() && publisher.is_some() {
      break;
    }
  }

  let icon_data_url = decode_smdh_icon_data_url(&smdh);
  if title.is_none() && publisher.is_none() && icon_data_url.is_none() {
    return Ok(None);
  }

  Ok(Some(crate::RomMetadataArtResult {
    title,
    publisher,
    icon_data_url,
    source: "3ds-smdh".to_string(),
  }))
}

fn is_image_extension(value: &str) -> bool {
  matches!(value, "png" | "jpg" | "jpeg" | "webp" | "bmp")
}

fn push_unique_title(output: &mut Vec<String>, seen: &mut HashSet<String>, value: String) {
  let normalized = value.trim().to_string();
  if normalized.is_empty() {
    return;
  }

  let key = normalized.to_lowercase();
  if seen.insert(key) {
    output.push(normalized);
  }
}

fn push_unique_system(output: &mut Vec<&'static str>, value: &'static str) {
  if !output.iter().any(|candidate| *candidate == value) {
    output.push(value);
  }
}

fn normalize_rom_lookup_title(value: &str) -> String {
  let collapsed = value
    .replace('_', " ")
    .replace('.', " ")
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ");

  let mut cleaned = collapsed;
  loop {
    let trimmed = cleaned.trim_end();
    if trimmed.ends_with(')') {
      if let Some(start) = trimmed.rfind('(') {
        cleaned = trimmed[..start].trim_end().to_string();
        continue;
      }
    }

    if trimmed.ends_with(']') {
      if let Some(start) = trimmed.rfind('[') {
        cleaned = trimmed[..start].trim_end().to_string();
        continue;
      }
    }

    break;
  }

  cleaned.trim().to_string()
}

fn normalize_rom_lookup_title_loose(value: &str) -> String {
  let normalized = normalize_rom_lookup_title(value);
  normalized
    .chars()
    .map(|character| {
      if character.is_ascii_alphanumeric() || character == ' ' {
        character
      } else {
        ' '
      }
    })
    .collect::<String>()
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
}

fn fallback_rom_title(request_title: Option<&str>, rom_path: &Path) -> Option<String> {
  if let Some(title) = request_title.map(str::trim).filter(|value| !value.is_empty()) {
    return Some(title.to_string());
  }

  rom_path
    .file_stem()
    .and_then(|value| value.to_str())
    .map(normalize_rom_lookup_title)
    .filter(|value| !value.is_empty())
}

fn rom_title_candidates(request_title: Option<&str>, rom_path: &Path) -> Vec<String> {
  let mut candidates: Vec<String> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  if let Some(title) = request_title.map(str::trim).filter(|value| !value.is_empty()) {
    push_unique_title(&mut candidates, &mut seen, title.to_string());
    push_unique_title(&mut candidates, &mut seen, normalize_rom_lookup_title(title));
    push_unique_title(&mut candidates, &mut seen, normalize_rom_lookup_title_loose(title));
  }

  if let Some(stem) = rom_path.file_stem().and_then(|value| value.to_str()) {
    let normalized = stem.trim();
    if !normalized.is_empty() {
      push_unique_title(&mut candidates, &mut seen, normalized.to_string());
      push_unique_title(&mut candidates, &mut seen, normalize_rom_lookup_title(normalized));
      push_unique_title(&mut candidates, &mut seen, normalize_rom_lookup_title_loose(normalized));
    }
  }

  candidates.truncate(8);
  candidates
}

fn rom_thumbnail_system_candidates(profile_hint: Option<&str>, rom_path: &Path) -> Vec<&'static str> {
  let mut systems: Vec<&'static str> = Vec::new();
  let extension = rom_path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_lowercase())
    .unwrap_or_default();
  let path_lower = rom_path.to_string_lossy().to_lowercase();
  let path_indicates_wii = path_lower.contains("\\wii\\") || path_lower.contains("/wii/");
  let path_indicates_gamecube =
    path_lower.contains("gamecube")
    || path_lower.contains("game cube")
    || path_lower.contains("\\gc\\")
    || path_lower.contains("/gc/");
  let profile = profile_hint
    .map(|value| value.trim().to_lowercase())
    .unwrap_or_default();

  match profile.as_str() {
    "ds" => push_unique_system(&mut systems, "Nintendo - Nintendo DS"),
    "3ds" => push_unique_system(&mut systems, "Nintendo - Nintendo 3DS"),
    "switch" => push_unique_system(&mut systems, "Nintendo - Nintendo Switch"),
    "dreamcast" => push_unique_system(&mut systems, "Sega - Dreamcast"),
    "cemu" => push_unique_system(&mut systems, "Nintendo - Wii U"),
    "rpcs3" => push_unique_system(&mut systems, "Sony - PlayStation 3"),
    "ps2" => push_unique_system(&mut systems, "Sony - PlayStation 2"),
    "psp" => push_unique_system(&mut systems, "Sony - PlayStation Portable"),
    "dolphin" => {
      match extension.as_str() {
        "gcm" | "gcz" | "dol" => {
          push_unique_system(&mut systems, "Nintendo - GameCube");
        }
        "wbfs" | "wad" => {
          push_unique_system(&mut systems, "Nintendo - Wii");
        }
        // RVZ/RVS/WIA/ISO can be either Wii or GameCube depending on source dump.
        "rvz" | "rvs" | "wia" | "iso" => {
          if path_indicates_wii && !path_indicates_gamecube {
            push_unique_system(&mut systems, "Nintendo - Wii");
            push_unique_system(&mut systems, "Nintendo - GameCube");
          } else {
            push_unique_system(&mut systems, "Nintendo - GameCube");
            push_unique_system(&mut systems, "Nintendo - Wii");
          }
        }
        _ => {
          if path_indicates_gamecube {
            push_unique_system(&mut systems, "Nintendo - GameCube");
          }
          if path_indicates_wii {
            push_unique_system(&mut systems, "Nintendo - Wii");
          }
          if systems.is_empty() {
            push_unique_system(&mut systems, "Nintendo - GameCube");
            push_unique_system(&mut systems, "Nintendo - Wii");
          }
        }
      }
    }
    "retroarch" => {
      match extension.as_str() {
        "nes" | "fds" => push_unique_system(&mut systems, "Nintendo - Nintendo Entertainment System"),
        "sfc" | "smc" | "fig" => push_unique_system(&mut systems, "Nintendo - Super Nintendo Entertainment System"),
        "n64" | "z64" | "v64" => push_unique_system(&mut systems, "Nintendo - Nintendo 64"),
        "gb" => push_unique_system(&mut systems, "Nintendo - Game Boy"),
        "gbc" | "dmg" => push_unique_system(&mut systems, "Nintendo - Game Boy Color"),
        "gba" | "agb" => push_unique_system(&mut systems, "Nintendo - Game Boy Advance"),
        "gen" | "md" | "smd" => push_unique_system(&mut systems, "Sega - Mega Drive - Genesis"),
        "gdi" | "cdi" => push_unique_system(&mut systems, "Sega - Dreamcast"),
        "cue" | "img" | "pbp" => push_unique_system(&mut systems, "Sony - PlayStation"),
        _ => {}
      }
    }
    _ => {}
  }

  if systems.is_empty() {
    match extension.as_str() {
      "nds" | "dsi" | "srl" => push_unique_system(&mut systems, "Nintendo - Nintendo DS"),
      "3ds" | "3dsx" | "cia" | "cci" | "cxi" => push_unique_system(&mut systems, "Nintendo - Nintendo 3DS"),
      "nsp" | "xci" | "nsz" | "nca" => push_unique_system(&mut systems, "Nintendo - Nintendo Switch"),
      "gcm" | "gcz" | "dol" => push_unique_system(&mut systems, "Nintendo - GameCube"),
      "wbfs" | "wad" => push_unique_system(&mut systems, "Nintendo - Wii"),
      "rvz" | "rvs" | "wia" | "iso" => {
        if path_indicates_wii && !path_indicates_gamecube {
          push_unique_system(&mut systems, "Nintendo - Wii");
          push_unique_system(&mut systems, "Nintendo - GameCube");
        } else {
          push_unique_system(&mut systems, "Nintendo - GameCube");
          push_unique_system(&mut systems, "Nintendo - Wii");
        }
      }
      "wud" | "wux" | "rpx" | "wua" => push_unique_system(&mut systems, "Nintendo - Wii U"),
      "ps3" | "pkg" => push_unique_system(&mut systems, "Sony - PlayStation 3"),
      "cso" | "prx" => push_unique_system(&mut systems, "Sony - PlayStation Portable"),
      "md" | "gen" | "smd" => push_unique_system(&mut systems, "Sega - Mega Drive - Genesis"),
      "gdi" | "cdi" => push_unique_system(&mut systems, "Sega - Dreamcast"),
      "nes" | "fds" => push_unique_system(&mut systems, "Nintendo - Nintendo Entertainment System"),
      "sfc" | "smc" | "fig" => push_unique_system(&mut systems, "Nintendo - Super Nintendo Entertainment System"),
      "n64" | "z64" | "v64" => push_unique_system(&mut systems, "Nintendo - Nintendo 64"),
      "gb" => push_unique_system(&mut systems, "Nintendo - Game Boy"),
      "gbc" | "dmg" => push_unique_system(&mut systems, "Nintendo - Game Boy Color"),
      "gba" | "agb" => push_unique_system(&mut systems, "Nintendo - Game Boy Advance"),
      "cue" | "img" | "pbp" => push_unique_system(&mut systems, "Sony - PlayStation"),
      _ => {}
    }
  }

  if systems.is_empty() {
    if path_lower.contains("gamecube") {
      push_unique_system(&mut systems, "Nintendo - GameCube");
    }
    if path_lower.contains("\\wii\\") || path_lower.contains("/wii/") {
      push_unique_system(&mut systems, "Nintendo - Wii");
    }
    if path_lower.contains("\\wii u\\") || path_lower.contains("/wii u/") || path_lower.contains("\\wiiu\\") || path_lower.contains("/wiiu/") {
      push_unique_system(&mut systems, "Nintendo - Wii U");
    }
    if path_lower.contains("\\ps3\\") || path_lower.contains("/ps3/") {
      push_unique_system(&mut systems, "Sony - PlayStation 3");
    }
    if path_lower.contains("\\ps2\\") || path_lower.contains("/ps2/") {
      push_unique_system(&mut systems, "Sony - PlayStation 2");
    }
    if path_lower.contains("\\psp\\") || path_lower.contains("/psp/") {
      push_unique_system(&mut systems, "Sony - PlayStation Portable");
    }
  }

  systems.truncate(3);
  systems
}

fn build_retroarch_thumbnail_url(system: &str, title: &str, extension: &str) -> Option<String> {
  let repo_system = system.replace(" - ", "_-_").replace(' ', "_");
  let safe_title = title
    .trim()
    .replace(['/', '\\'], "-");
  if safe_title.is_empty() {
    return None;
  }

  let mut url = url::Url::parse("https://raw.githubusercontent.com/").ok()?;
  {
    let mut segments = url.path_segments_mut().ok()?;
    segments.push("libretro-thumbnails");
    segments.push(&repo_system);
    segments.push("master");
    segments.push("Named_Boxarts");
    segments.push(&format!("{safe_title}.{extension}"));
  }

  Some(url.to_string())
}

fn fetch_retroarch_thumbnail_data_url(
  request_title: Option<&str>,
  profile_hint: Option<&str>,
  rom_path: &Path,
) -> Option<String> {
  let systems = rom_thumbnail_system_candidates(profile_hint, rom_path);
  if systems.is_empty() {
    return None;
  }

  let titles = rom_title_candidates(request_title, rom_path);
  if titles.is_empty() {
    return None;
  }

  let client = reqwest::blocking::Client::builder()
    .timeout(Duration::from_secs(5))
    .build()
    .ok()?;

  for system in systems {
    for title in &titles {
      for extension in ["png", "jpg", "jpeg", "webp"] {
        let Some(url) = build_retroarch_thumbnail_url(system, title, extension) else {
          continue;
        };

        if let Some(data_url) = fetch_remote_cover_as_data_url(&client, &url) {
          return Some(data_url);
        }
      }
    }
  }

  None
}

fn find_sidecar_cover_data_url(rom_path: &Path) -> Option<String> {
  let parent = rom_path.parent()?;
  let rom_stem = rom_path
    .file_stem()
    .and_then(|value| value.to_str())
    .map(|value| value.trim().to_lowercase())
    .unwrap_or_default();

  let mut best_score = i32::MIN;
  let mut best_path: Option<PathBuf> = None;

  let entries = fs::read_dir(parent).ok()?;
  for entry in entries.flatten() {
    let path = entry.path();
    if !path.is_file() {
      continue;
    }

    let extension = path
      .extension()
      .and_then(|value| value.to_str())
      .map(|value| value.to_lowercase())
      .unwrap_or_default();
    if !is_image_extension(&extension) {
      continue;
    }

    let stem = path
      .file_stem()
      .and_then(|value| value.to_str())
      .map(|value| value.to_lowercase())
      .unwrap_or_default();
    let file_name = path
      .file_name()
      .and_then(|value| value.to_str())
      .map(|value| value.to_lowercase())
      .unwrap_or_default();

    let mut score = 0;
    if !rom_stem.is_empty() {
      if stem == rom_stem {
        score += 260;
      }
      if stem.starts_with(&format!("{rom_stem}_")) || stem.starts_with(&format!("{rom_stem}-")) {
        score += 180;
      }
      if stem.contains(&rom_stem) {
        score += 120;
      }
    }

    if stem == "cover" || stem == "boxart" || stem == "poster" || stem == "front" || stem == "icon0" || stem == "banner" {
      score += 220;
    }

    if file_name.contains("cover") || file_name.contains("boxart") || file_name.contains("icon0") || file_name.contains("banner") {
      score += 120;
    }

    if score > best_score {
      best_score = score;
      best_path = Some(path);
    }
  }

  if best_score <= 0 {
    return None;
  }

  best_path.and_then(|path| image_path_to_data_url(&path))
}

fn path_indicates_dreamcast(path: &Path) -> bool {
  let lowered = path.to_string_lossy().to_lowercase();
  lowered.contains("\\dreamcast\\")
    || lowered.contains("/dreamcast/")
    || lowered.contains("sega dreamcast")
    || lowered.contains("dream cast")
    || lowered.contains("\\dc\\")
    || lowered.contains("/dc/")
}

fn dreamcast_disc_prefix(value: &str) -> String {
  let lowered = value.trim().to_lowercase();
  let prefix = lowered.split("track").next().unwrap_or(lowered.as_str()).trim();
  prefix
    .trim_matches(|character: char| {
      character.is_whitespace()
        || matches!(character, '-' | '_' | '.' | '(' | ')' | '[' | ']')
    })
    .to_string()
}

fn resolve_dreamcast_metadata_path(path: &Path) -> PathBuf {
  let extension = path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_lowercase())
    .unwrap_or_default();
  if extension != "bin" || !path_indicates_dreamcast(path) {
    return path.to_path_buf();
  }

  let Some(parent) = path.parent() else {
    return path.to_path_buf();
  };

  let source_stem = path
    .file_stem()
    .and_then(|value| value.to_str())
    .unwrap_or_default();
  let source_prefix = dreamcast_disc_prefix(source_stem);

  let mut candidates: Vec<(i32, PathBuf)> = Vec::new();
  let Ok(entries) = fs::read_dir(parent) else {
    return path.to_path_buf();
  };

  for entry in entries.flatten() {
    let candidate = entry.path();
    if !candidate.is_file() {
      continue;
    }

    let extension = candidate
      .extension()
      .and_then(|value| value.to_str())
      .map(|value| value.to_lowercase())
      .unwrap_or_default();
    let base_priority = match extension.as_str() {
      "gdi" => 500,
      "cue" => 400,
      "cdi" => 300,
      "chd" => 200,
      _ => 0,
    };
    if base_priority == 0 {
      continue;
    }

    let candidate_stem = candidate
      .file_stem()
      .and_then(|value| value.to_str())
      .unwrap_or_default();
    let candidate_prefix = dreamcast_disc_prefix(candidate_stem);

    let mut score = base_priority;
    if !source_prefix.is_empty() && source_prefix == candidate_prefix {
      score += 1000;
    }

    candidates.push((score, candidate));
  }

  candidates
    .into_iter()
    .max_by_key(|(score, _)| *score)
    .map(|(_, candidate)| candidate)
    .unwrap_or_else(|| path.to_path_buf())
}

#[derive(Clone, Debug)]
struct NintendoDiscMetadata {
  system: &'static str,
  game_id: String,
  title: String,
}

fn is_upper_alnum_ascii(value: u8) -> bool {
  value.is_ascii_uppercase() || value.is_ascii_digit()
}

fn decode_ascii_title_field(bytes: &[u8]) -> Option<String> {
  let end = bytes.iter().position(|value| *value == 0).unwrap_or(bytes.len());
  if end == 0 {
    return None;
  }

  let normalized = bytes[..end]
    .iter()
    .map(|value| {
      if value.is_ascii_graphic() || *value == b' ' {
        *value
      } else {
        b' '
      }
    })
    .collect::<Vec<_>>();

  let title = String::from_utf8_lossy(&normalized)
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
    .trim()
    .to_string();

  if title.len() < 2 {
    None
  } else {
    Some(title)
  }
}

fn nintendo_disc_system_from_magic(magic: u32) -> Option<&'static str> {
  match magic {
    0x5D1C9EA3 | 0xA39E1C5D => Some("wii"),
    0xC2339F3D | 0x3D9F33C2 => Some("gamecube"),
    _ => None,
  }
}

fn parse_nintendo_disc_metadata_at(payload: &[u8], offset: usize) -> Option<NintendoDiscMetadata> {
  if offset + 0x80 > payload.len() {
    return None;
  }

  let id_bytes = &payload[offset..offset + 6];
  if !id_bytes.iter().all(|value| is_upper_alnum_ascii(*value)) {
    return None;
  }

  let mut system: Option<&'static str> = None;
  for magic_offset in [0x18usize, 0x1Cusize] {
    let magic = u32::from_be_bytes([
      payload[offset + magic_offset],
      payload[offset + magic_offset + 1],
      payload[offset + magic_offset + 2],
      payload[offset + magic_offset + 3],
    ]);
    if let Some(candidate_system) = nintendo_disc_system_from_magic(magic) {
      system = Some(candidate_system);
      break;
    }
  }
  let system = system?;

  let title = decode_ascii_title_field(&payload[offset + 0x20..offset + 0x80])?;
  let game_id = String::from_utf8_lossy(id_bytes).to_uppercase();

  Some(NintendoDiscMetadata {
    system,
    game_id,
    title,
  })
}

fn nintendo_disc_candidate_offsets(payload: &[u8]) -> Vec<usize> {
  let mut offsets: Vec<usize> = Vec::new();
  let mut seen: HashSet<usize> = HashSet::new();

  for offset in [0usize, 0x100usize, 0x200usize] {
    if offset + 0x80 <= payload.len() && seen.insert(offset) {
      offsets.push(offset);
    }
  }

  let scan_len = payload.len().min(16 * 1024 * 1024);
  if scan_len < 4 {
    return offsets;
  }

  for index in 0..=(scan_len - 4) {
    let value = u32::from_be_bytes([
      payload[index],
      payload[index + 1],
      payload[index + 2],
      payload[index + 3],
    ]);

    if nintendo_disc_system_from_magic(value).is_none() {
      continue;
    }

    if index >= 0x18 {
      let header_offset = index - 0x18;
      if header_offset + 0x80 <= payload.len() && seen.insert(header_offset) {
        offsets.push(header_offset);
      }
    }

    if index >= 0x1C {
      let header_offset = index - 0x1C;
      if header_offset + 0x80 <= payload.len() && seen.insert(header_offset) {
        offsets.push(header_offset);
      }
    }
  }

  offsets
}

fn extract_nintendo_disc_metadata(rom_path: &Path) -> Option<NintendoDiscMetadata> {
  let payload = read_file_window(rom_path, 0, 16 * 1024 * 1024).ok()?;
  let offsets = nintendo_disc_candidate_offsets(&payload);
  if offsets.is_empty() {
    return None;
  }

  let mut best: Option<NintendoDiscMetadata> = None;
  for offset in offsets {
    let Some(candidate) = parse_nintendo_disc_metadata_at(&payload, offset) else {
      continue;
    };

    if best.as_ref().map_or(true, |existing| candidate.title.len() > existing.title.len()) {
      best = Some(candidate);
    }
  }

  best
}

fn nintendo_cover_region_candidates(game_id: &str) -> Vec<&'static str> {
  let mut regions: Vec<&'static str> = Vec::new();
  let region_char = game_id
    .chars()
    .nth(3)
    .map(|value| value.to_ascii_uppercase())
    .unwrap_or('E');

  match region_char {
    'J' => {
      push_unique_system(&mut regions, "JA");
      push_unique_system(&mut regions, "JP");
    }
    'K' => {
      push_unique_system(&mut regions, "KO");
      push_unique_system(&mut regions, "EN");
    }
    'P' | 'D' | 'F' | 'H' | 'I' | 'S' | 'X' | 'Y' | 'Z' => {
      push_unique_system(&mut regions, "EN");
      push_unique_system(&mut regions, "FR");
      push_unique_system(&mut regions, "DE");
      push_unique_system(&mut regions, "ES");
      push_unique_system(&mut regions, "IT");
      push_unique_system(&mut regions, "NL");
      push_unique_system(&mut regions, "US");
    }
    'W' | 'C' => {
      push_unique_system(&mut regions, "ZH");
      push_unique_system(&mut regions, "EN");
      push_unique_system(&mut regions, "US");
    }
    _ => {
      push_unique_system(&mut regions, "US");
      push_unique_system(&mut regions, "EN");
    }
  }

  for fallback in ["US", "EN", "JA", "FR", "DE", "ES", "IT", "NL", "KO", "ZH"] {
    push_unique_system(&mut regions, fallback);
  }

  regions
}

fn nintendo_cover_system_paths(system: &str) -> Vec<&'static str> {
  match system {
    "wii" => vec!["wii"],
    "gamecube" => vec!["gamecube", "gc"],
    _ => vec!["gamecube", "gc", "wii"],
  }
}

fn gametdb_cover_urls(metadata: &NintendoDiscMetadata) -> Vec<String> {
  let game_id = metadata.game_id.trim().to_uppercase();
  if game_id.len() != 6 {
    return Vec::new();
  }

  let systems = nintendo_cover_system_paths(metadata.system);
  let regions = nintendo_cover_region_candidates(&game_id);
  let mut urls: Vec<String> = Vec::new();

  for system in systems {
    for image_set in ["cover", "coverfull"] {
      for region in &regions {
        for extension in ["png", "jpg", "jpeg"] {
          urls.push(format!(
            "https://art.gametdb.com/{system}/{image_set}/{region}/{game_id}.{extension}"
          ));
        }
      }
    }
  }

  urls
}

fn fetch_nintendo_disc_cover_data_url(metadata: &NintendoDiscMetadata) -> Option<String> {
  let urls = gametdb_cover_urls(metadata);
  if urls.is_empty() {
    return None;
  }

  let client = reqwest::blocking::Client::builder()
    .timeout(Duration::from_secs(6))
    .build()
    .ok()?;

  for url in urls {
    if let Some(data_url) = fetch_remote_cover_as_data_url(&client, &url) {
      return Some(data_url);
    }
  }

  None
}

pub(crate) fn get_rom_metadata_art_impl(
  request: crate::RomMetadataArtRequest,
) -> Result<Option<crate::RomMetadataArtResult>, String> {
  let rom_path_value = request.rom_path.trim();
  if rom_path_value.is_empty() {
    return Ok(None);
  }

  let rom_path = PathBuf::from(rom_path_value);
  if !rom_path.exists() || !rom_path.is_file() {
    return Ok(None);
  }
  let effective_rom_path = resolve_dreamcast_metadata_path(rom_path.as_path());

  let profile_hint = request
    .profile
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(|value| value.to_lowercase());

  let embedded_profile = infer_rom_profile(effective_rom_path.as_path(), profile_hint.as_deref());
  let nintendo_disc_metadata = extract_nintendo_disc_metadata(effective_rom_path.as_path());
  let mut fallback_title = fallback_rom_title(request.title.as_deref(), effective_rom_path.as_path());

  if fallback_title.is_none() {
    if let Some(metadata) = nintendo_disc_metadata.as_ref() {
      fallback_title = Some(metadata.title.clone());
    }
  }

  let parsed = match embedded_profile.as_deref() {
    Some("ds") => extract_ds_metadata(effective_rom_path.as_path())?,
    Some("3ds") => extract_3ds_metadata(effective_rom_path.as_path())?,
    _ => {
      if let Some(metadata) = extract_ds_metadata(effective_rom_path.as_path())? {
        Some(metadata)
      } else {
        extract_3ds_metadata(effective_rom_path.as_path())?
      }
    }
  };

  if let Some(mut metadata) = parsed {
    if metadata.title.as_deref().unwrap_or_default().trim().is_empty() {
      if let Some(fallback_title_value) = fallback_title.clone() {
        metadata.title = Some(fallback_title_value);
      }
    }

    return Ok(Some(metadata));
  }

  if let Some(icon_data_url) = find_sidecar_cover_data_url(effective_rom_path.as_path()) {
    return Ok(Some(crate::RomMetadataArtResult {
      title: fallback_title.clone(),
      publisher: None,
      icon_data_url: Some(icon_data_url),
      source: "local-sidecar".to_string(),
    }));
  }

  let allow_online_fallback = request.allow_online_fallback.unwrap_or(false);
  if allow_online_fallback {
    if let Some(metadata) = nintendo_disc_metadata.as_ref() {
      if let Some(icon_data_url) = fetch_nintendo_disc_cover_data_url(metadata) {
        return Ok(Some(crate::RomMetadataArtResult {
          title: fallback_title.clone().or_else(|| Some(metadata.title.clone())),
          publisher: None,
          icon_data_url: Some(icon_data_url),
          source: "gametdb-id".to_string(),
        }));
      }
    }

    let retroarch_title = fallback_title
      .as_deref()
      .or(request.title.as_deref())
      .or_else(|| nintendo_disc_metadata.as_ref().map(|metadata| metadata.title.as_str()));

    if let Some(icon_data_url) = fetch_retroarch_thumbnail_data_url(
      retroarch_title,
      profile_hint.as_deref(),
      effective_rom_path.as_path(),
    ) {
      return Ok(Some(crate::RomMetadataArtResult {
        title: fallback_title,
        publisher: None,
        icon_data_url: Some(icon_data_url),
        source: "retroarch-thumbnail".to_string(),
      }));
    }
  }

  Ok(None)
}

pub(crate) fn get_steam_cover_art_impl(request: crate::SteamCoverArtRequest) -> Result<Option<String>, String> {
  for path in steam_cover_candidates(request.app_id) {
    let bytes = match fs::read(&path) {
      Ok(value) => value,
      Err(_) => continue,
    };

    let mime = match path.extension().and_then(|value| value.to_str()).map(|value| value.to_lowercase()) {
      Some(value) if value == "png" => "image/png",
      _ => "image/jpeg",
    };

    let encoded = {
      use base64::Engine;
      base64::engine::general_purpose::STANDARD.encode(bytes)
    };

    return Ok(Some(format!("data:{mime};base64,{encoded}")));
  }

  let client = reqwest::blocking::Client::builder()
    .timeout(Duration::from_secs(8))
    .build()
    .map_err(|error| format!("Failed to create Steam cover HTTP client: {error}"))?;

  for url in steam_remote_cover_urls(request.app_id) {
    if let Some(data_url) = fetch_remote_cover_as_data_url(&client, &url) {
      return Ok(Some(data_url));
    }
  }

  Ok(None)
}

pub(crate) fn get_steam_cover_art_for_entry_impl(
  request: crate::SteamCoverArtLookupRequest,
) -> Result<Option<String>, String> {
  let Some(app_id) = infer_steam_app_id_from_lookup_request(&request) else {
    return Ok(None);
  };

  get_steam_cover_art_impl(crate::SteamCoverArtRequest { app_id })
}

pub(crate) fn get_recent_screenshot_paths_impl(request: crate::RecentScreenshotsRequest) -> Result<Vec<String>, String> {
  let limit = request.limit.unwrap_or(10).clamp(1, 24);
  let directories = screenshot_directories_for_request(
    request.kind.as_str(),
    request.target.as_str(),
    request.title.as_deref(),
  );
  if directories.is_empty() {
    return Ok(Vec::new());
  }

  Ok(collect_recent_images_from_dirs(&directories, limit))
}



fn xbox_cover_score(path: &Path, title: &str) -> i32 {
  let file_name = path
    .file_name()
    .and_then(|value| value.to_str())
    .unwrap_or_default()
    .to_lowercase();
  let full = path.to_string_lossy().to_lowercase();
  let title_lower = title.trim().to_lowercase();
  let mut score = 0;

  for keyword in ["poster", "cover", "hero", "boxart", "keyart"] {
    if file_name.contains(keyword) {
      score += 40;
    }
  }

  for keyword in ["logo", "tile", "splash", "storelogo"] {
    if file_name.contains(keyword) {
      score += 20;
    }
  }

  if !title_lower.is_empty() && full.contains(&title_lower) {
    score += 15;
  }

  if let Ok(metadata) = fs::metadata(path) {
    score += (metadata.len().min(500_000) / 10_000) as i32;
  }

  score
}

fn push_xbox_asset_candidates(directory: &Path, candidates: &mut Vec<PathBuf>, seen_paths: &mut HashSet<String>) {
  if !directory.exists() {
    return;
  }

  for relative in [
    "Logo.png",
    "SplashScreen.png",
    "StoreLogo.png",
    "Assets/Logo.png",
    "Assets/SplashScreen.png",
    "Assets/StoreLogo.png",
  ] {
    let path = directory.join(relative);
    if !path.is_file() {
      continue;
    }

    let key = path.to_string_lossy().to_lowercase();
    if seen_paths.insert(key) {
      candidates.push(path);
    }
  }
}

fn best_xbox_local_image(candidates: Vec<PathBuf>, title: &str) -> Option<String> {
  if candidates.is_empty() {
    return None;
  }

  let mut ranked: Vec<(PathBuf, i32, u128)> = candidates
    .into_iter()
    .map(|path| {
      let score = xbox_cover_score(&path, title);
      let modified = fs::metadata(&path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
      (path, score, modified)
    })
    .collect();

  ranked.sort_by(|left, right| right.1.cmp(&left.1).then(right.2.cmp(&left.2)));

  ranked
    .into_iter()
    .find_map(|(path, score, _)| if score > 0 { image_path_to_data_url(&path) } else { None })
}

fn collect_microsoft_catalog_urls(json: &serde_json::Value, output: &mut Vec<String>) {
  match json {
    serde_json::Value::String(text) => {
      let lower = text.to_lowercase();
      if (lower.starts_with("http://") || lower.starts_with("https://"))
        && (lower.contains(".jpg") || lower.contains(".jpeg") || lower.contains(".png") || lower.contains(".webp"))
      {
        output.push(text.to_string());
      }
    }
    serde_json::Value::Array(items) => {
      for item in items {
        collect_microsoft_catalog_urls(item, output);
      }
    }
    serde_json::Value::Object(map) => {
      for (key, value) in map {
        let key_lower = key.to_lowercase();
        if key_lower == "uri" || key_lower == "url" || key_lower == "background" || key_lower == "foreground" {
          collect_microsoft_catalog_urls(value, output);
        } else {
          collect_microsoft_catalog_urls(value, output);
        }
      }
    }
    _ => {}
  }
}

fn fetch_xbox_store_cover(title: &str) -> Option<String> {
  let query = title.trim();
  if query.is_empty() {
    return None;
  }

  let encoded = query.replace(' ', "%20");
  let url = format!(
    "https://displaycatalog.mp.microsoft.com/v7.0/products?market=US&languages=en-US&deviceFamily=Windows.Desktop&query={encoded}"
  );
  let Ok(response) = reqwest::blocking::get(url) else {
    return None;
  };
  if !response.status().is_success() {
    return None;
  }

  let Ok(json) = response.json::<serde_json::Value>() else {
    return None;
  };

  let mut urls: Vec<String> = Vec::new();
  collect_microsoft_catalog_urls(&json, &mut urls);
  if urls.is_empty() {
    return None;
  }

  urls.sort_by_key(|value| -score_image_url(value));
  urls.into_iter().next()
}

#[cfg(target_os = "windows")]
fn get_xbox_cover_art_windows(request: crate::XboxCoverArtRequest) -> Result<Option<String>, String> {
  use crate::scanners::windows_special_scanner::{scan_appx_gaming_packages, xbox_games_roots};

  let target = request.target.trim();
  let title = request.title.as_deref().unwrap_or("").trim();
  if target.is_empty() && title.is_empty() {
    return Ok(None);
  }

  let target_lower = target.to_lowercase();
  let title_lower = title.to_lowercase();
  let mut candidates: Vec<PathBuf> = Vec::new();
  let mut seen_paths: HashSet<String> = HashSet::new();
  let mut matched_title = title.to_string();

  for record in scan_appx_gaming_packages() {
    let record_title = record.title.trim();
    let record_aumid = record.aumid.trim().to_lowercase();
    if record_aumid.is_empty() {
      continue;
    }

    let title_match = !title_lower.is_empty()
      && record_title.to_lowercase() == title_lower;
    let target_match = !target_lower.is_empty()
      && (record_aumid == target_lower || record_aumid.contains(&target_lower) || target_lower.contains(&record_aumid));
    if !title_match && !target_match {
      continue;
    }

    if matched_title.is_empty() {
      matched_title = record_title.to_string();
    }

    let install_location = PathBuf::from(record.install_location.trim());
    push_xbox_asset_candidates(&install_location, &mut candidates, &mut seen_paths);

    let mut collected: Vec<PathBuf> = Vec::new();
    gather_images_recursive(&install_location, 0, 3, &mut collected, 320);
    for path in collected {
      let key = path.to_string_lossy().to_lowercase();
      if seen_paths.insert(key) {
        candidates.push(path);
      }
    }
  }

  if target.contains('\\') || target.contains('/') {
    let executable_path = PathBuf::from(target);
    if let Some(game_root) = executable_path.parent().and_then(|content| content.parent()) {
      push_xbox_asset_candidates(game_root, &mut candidates, &mut seen_paths);
      let mut collected: Vec<PathBuf> = Vec::new();
      gather_images_recursive(game_root, 0, 3, &mut collected, 320);
      for path in collected {
        let key = path.to_string_lossy().to_lowercase();
        if seen_paths.insert(key) {
          candidates.push(path);
        }
      }
    }
  }

  if !title_lower.is_empty() {
    for root in xbox_games_roots() {
      let Ok(entries) = fs::read_dir(&root) else {
        continue;
      };

      for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
          continue;
        }

        let folder_name = path
          .file_name()
          .and_then(|value| value.to_str())
          .unwrap_or_default()
          .trim()
          .to_lowercase();
        if folder_name != title_lower && !folder_name.contains(&title_lower) && !title_lower.contains(&folder_name) {
          continue;
        }

        push_xbox_asset_candidates(&path, &mut candidates, &mut seen_paths);
        let mut collected: Vec<PathBuf> = Vec::new();
        gather_images_recursive(&path, 0, 3, &mut collected, 320);
        for candidate in collected {
          let key = candidate.to_string_lossy().to_lowercase();
          if seen_paths.insert(key) {
            candidates.push(candidate);
          }
        }
      }
    }
  }

  if let Some(data_url) = best_xbox_local_image(candidates, if matched_title.is_empty() { title } else { &matched_title }) {
    return Ok(Some(data_url));
  }

  let store_title = if matched_title.is_empty() { title } else { &matched_title };
  if let Some(remote_url) = fetch_xbox_store_cover(store_title) {
    return Ok(Some(remote_url));
  }

  Ok(None)
}

pub(crate) fn get_xbox_cover_art_impl(request: crate::XboxCoverArtRequest) -> Result<Option<String>, String> {
  #[cfg(target_os = "windows")]
  {
    return get_xbox_cover_art_windows(request);
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = request;
    Ok(None)
  }
}
pub(crate) fn get_battle_net_cover_art_impl(request: crate::BattleNetCoverArtRequest) -> Result<Option<String>, String> {
  #[cfg(target_os = "windows")]
  {
    let target = request.target.trim().to_lowercase();
    let title_query = request.title.unwrap_or_default().trim().to_lowercase();

    if target.is_empty() && title_query.is_empty() {
      return Ok(None);
    }

    let mut matched: Option<(&'static str, &'static str, &'static [&'static str], &'static [&'static str], &'static [&'static str])> = None;
    for definition in battle_net_game_definitions() {
      let (title, product_code, _, _, _) = definition;
      let title_lower = title.to_lowercase();
      if target == product_code
        || (!title_query.is_empty()
          && (title_lower == title_query
            || title_lower.contains(&title_query)
            || title_query.contains(&title_lower)))
      {
        matched = Some(definition);
        break;
      }
    }

    let Some((title, product_code, folders, executables, keywords)) = matched else {
      return Ok(None);
    };

    let mut search_dirs: Vec<PathBuf> = Vec::new();
    if let Some(path) = battle_net_find_install_path(folders, executables) {
      search_dirs.push(path);
    }
    search_dirs.extend(battle_net_cache_roots());

    let mut candidates: Vec<PathBuf> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    for directory in search_dirs {
      if !directory.exists() {
        continue;
      }

      let mut collected: Vec<PathBuf> = Vec::new();
      let max_depth = if directory.to_string_lossy().to_lowercase().contains("battle.net") {
        2
      } else {
        3
      };
      gather_images_recursive(&directory, 0, max_depth, &mut collected, 320);

      for path in collected {
        let key = path.to_string_lossy().to_lowercase();
        if seen_paths.insert(key) {
          candidates.push(path);
        }
      }
    }

    if candidates.is_empty() {
      return Ok(None);
    }

    let mut ranked: Vec<(PathBuf, i32, u128)> = candidates
      .into_iter()
      .map(|path| {
        let score = battle_net_cover_score(&path, product_code, title, keywords);
        let modified = fs::metadata(&path)
          .and_then(|metadata| metadata.modified())
          .ok()
          .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
          .map(|duration| duration.as_millis())
          .unwrap_or(0);
        (path, score, modified)
      })
      .collect();

    ranked.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| right.2.cmp(&left.2)));

    for (path, _, _) in ranked {
      if let Some(data_url) = image_path_to_data_url(&path) {
        return Ok(Some(data_url));
      }
    }

    Ok(None)
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = request;
    Ok(None)
  }
}
