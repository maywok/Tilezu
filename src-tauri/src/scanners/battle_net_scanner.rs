use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use super::registry_scanner::registry_key_exists;
use super::windows_special_scanner::battle_net_launcher_path;
use crate::ImportedGame;

pub(crate) type BattleNetGameDefinition = (
  &'static str,
  &'static str,
  &'static [&'static str],
  &'static [&'static str],
  &'static [&'static str],
);

#[cfg(target_os = "windows")]
fn battle_net_game_install_roots() -> Vec<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    roots.push(PathBuf::from(program_files_x86));
  }

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    roots.push(PathBuf::from(program_files));
  }

  if let Some(public_dir) = env::var_os("PUBLIC") {
    roots.push(PathBuf::from(public_dir).join("Games"));
  }

  roots.push(PathBuf::from(r"C:\Games"));
  roots.push(PathBuf::from(r"D:\Games"));
  roots.push(PathBuf::from(r"E:\Games"));
  roots.push(PathBuf::from(r"F:\Games"));
  roots
}

#[cfg(target_os = "windows")]
pub(crate) fn battle_net_game_definitions() -> Vec<BattleNetGameDefinition> {
  vec![
    (
      "Overwatch 2",
      "pro",
      &["Overwatch", "Overwatch 2"],
      &["Overwatch\\_retail_\\Overwatch.exe", "Overwatch 2\\Overwatch.exe", "Overwatch\\Overwatch.exe"],
      &["overwatch", "ow2", "pro"],
    ),
    (
      "Diablo IV",
      "fen",
      &["Diablo IV"],
      &["Diablo IV\\Diablo IV Launcher.exe", "Diablo IV\\Diablo IV.exe"],
      &["diablo", "d4", "fen"],
    ),
    (
      "Diablo III",
      "d3",
      &["Diablo III"],
      &["Diablo III\\Diablo III Launcher.exe", "Diablo III\\Diablo III64.exe"],
      &["diablo", "d3"],
    ),
    (
      "Diablo II: Resurrected",
      "osi",
      &["Diablo II Resurrected", "Diablo II"],
      &["Diablo II Resurrected\\D2R.exe"],
      &["diablo", "d2r", "osi"],
    ),
    (
      "World of Warcraft",
      "wow",
      &["World of Warcraft", "World of Warcraft Retail"],
      &["World of Warcraft\\_retail_\\Wow.exe", "World of Warcraft\\Wow.exe"],
      &["warcraft", "wow"],
    ),
    (
      "Hearthstone",
      "wtcg",
      &["Hearthstone"],
      &["Hearthstone\\Hearthstone.exe"],
      &["hearthstone", "wtcg"],
    ),
    (
      "StarCraft II",
      "s2",
      &["StarCraft II"],
      &["StarCraft II\\SC2.exe"],
      &["starcraft", "sc2", "s2"],
    ),
    (
      "Heroes of the Storm",
      "hero",
      &["Heroes of the Storm"],
      &["Heroes of the Storm\\HeroesOfTheStorm_x64.exe", "Heroes of the Storm\\HeroesOfTheStorm.exe"],
      &["heroes", "storm", "hots", "hero"],
    ),
  ]
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn battle_net_game_definitions() -> Vec<BattleNetGameDefinition> {
  Vec::new()
}

#[cfg(target_os = "windows")]
pub(crate) fn battle_net_find_install_path(
  folder_hints: &[&str],
  executable_hints: &[&str],
) -> Option<PathBuf> {
  let roots = battle_net_game_install_roots();

  for root in &roots {
    for folder in folder_hints {
      let candidate = root.join(folder);
      if candidate.exists() {
        return Some(candidate);
      }
    }
  }

  for root in &roots {
    for executable_hint in executable_hints {
      let candidate = root.join(executable_hint);
      if candidate.exists() {
        if let Some(parent) = candidate.parent() {
          return Some(parent.to_path_buf());
        }
      }
    }
  }

  None
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn battle_net_find_install_path(
  _folder_hints: &[&str],
  _executable_hints: &[&str],
) -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
pub(crate) fn battle_net_cache_roots() -> Vec<PathBuf> {
  let mut roots = Vec::new();

  if let Some(program_data) = env::var_os("PROGRAMDATA") {
    let base = PathBuf::from(program_data).join("Battle.net");
    roots.push(base.join("Agent").join("data").join("cache"));
    roots.push(base.join("Agent").join("data").join("products"));
  }

  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    let base = PathBuf::from(local_app_data).join("Battle.net");
    roots.push(base.join("BrowserCache"));
    roots.push(base.join("Cache"));
  }

  roots
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn battle_net_cache_roots() -> Vec<PathBuf> {
  Vec::new()
}

#[cfg(target_os = "windows")]
pub(crate) fn battle_net_cover_score(
  path: &Path,
  product_code: &str,
  title: &str,
  keywords: &[&str],
) -> i32 {
  let file_name = path
    .file_name()
    .and_then(|value| value.to_str())
    .unwrap_or_default()
    .to_lowercase();
  let full = path.to_string_lossy().to_lowercase();

  let mut score = 0;

  if !product_code.is_empty() && (file_name.contains(product_code) || full.contains(product_code)) {
    score += 140;
  }

  for keyword in keywords {
    if file_name.contains(keyword) || full.contains(keyword) {
      score += 40;
    }
  }

  for word in title.to_lowercase().split_whitespace() {
    if word.len() >= 3 && (file_name.contains(word) || full.contains(word)) {
      score += 18;
    }
  }

  if file_name.contains("cover")
    || file_name.contains("keyart")
    || file_name.contains("splash")
    || file_name.contains("hero")
  {
    score += 48;
  }

  if file_name.contains("background") || file_name.contains("wallpaper") {
    score += 18;
  }

  if file_name.contains("icon")
    || file_name.contains("logo")
    || file_name.contains("thumb")
    || file_name.contains("small")
  {
    score -= 42;
  }

  if let Ok(meta) = fs::metadata(path) {
    let bytes = meta.len();
    if bytes > 450_000 {
      score += 16;
    } else if bytes < 28_000 {
      score -= 16;
    }
  }

  score
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn battle_net_cover_score(
  _path: &Path,
  _product_code: &str,
  _title: &str,
  _keywords: &[&str],
) -> i32 {
  0
}

#[cfg(target_os = "windows")]
pub(crate) fn scan_battle_net_games() -> Vec<ImportedGame> {
  let has_launcher = battle_net_launcher_path().is_some()
    || registry_key_exists(r"HKCR\battlenet")
    || registry_key_exists(r"HKCU\Software\Classes\battlenet");

  if !has_launcher {
    return Vec::new();
  }

  let mut imports: Vec<ImportedGame> = Vec::new();
  let mut seen_titles: HashSet<String> = HashSet::new();

  for (title, product_code, folders, executables, _) in battle_net_game_definitions() {
    let Some(install_path) = battle_net_find_install_path(folders, executables) else {
      continue;
    };

    let title_key = title.to_lowercase();
    if !seen_titles.insert(title_key) {
      continue;
    }

    imports.push(ImportedGame {
      title: title.to_string(),
      kind: "battle_net".to_string(),
      target: product_code.to_string(),
      args: vec![
        install_path.to_string_lossy().to_string(),
        "--tm-managed=1".to_string(),
        "--tm-source=battle_net".to_string(),
      ],
      emulator_key: None,
      manual_system_key: None,
    });
  }

  imports
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn scan_battle_net_games() -> Vec<ImportedGame> {
  Vec::new()
}
