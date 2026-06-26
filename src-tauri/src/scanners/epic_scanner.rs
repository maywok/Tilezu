use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::ImportedGame;

fn manifest_root() -> PathBuf {
  PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests")
}

fn manifest_string_field(json: &serde_json::Value, key: &str) -> String {
  json
    .get(key)
    .and_then(serde_json::Value::as_str)
    .unwrap_or_default()
    .trim()
    .to_string()
}

pub(crate) fn scan_epic_games() -> Vec<ImportedGame> {
  let mut imports: Vec<ImportedGame> = Vec::new();
  let mut seen_targets: HashSet<String> = HashSet::new();

  let root = manifest_root();
  if !root.exists() {
    return imports;
  }

  let Ok(entries) = fs::read_dir(root) else {
    return imports;
  };

  for item in entries.flatten() {
    let path = item.path();
    if path.extension().and_then(|value| value.to_str()) != Some("item") {
      continue;
    }

    let Ok(contents) = fs::read_to_string(&path) else {
      continue;
    };

    let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) else {
      continue;
    };

    let install_location = manifest_string_field(&json, "InstallLocation");
    if install_location.is_empty() || !Path::new(&install_location).exists() {
      continue;
    }

    let launch_executable = manifest_string_field(&json, "LaunchExecutable");
    if launch_executable.is_empty() {
      continue;
    }

    let app_name = manifest_string_field(&json, "AppName");
    let main_game_app_name = manifest_string_field(&json, "MainGameAppName");
    let catalog_item_id = manifest_string_field(&json, "CatalogItemId");

    let target = if !app_name.is_empty() {
      app_name
    } else if !main_game_app_name.is_empty() {
      main_game_app_name
    } else if !catalog_item_id.is_empty() {
      catalog_item_id
    } else {
      continue;
    };

    let dedupe_key = target.to_lowercase();
    if !seen_targets.insert(dedupe_key) {
      continue;
    }

    let display_name = manifest_string_field(&json, "DisplayName");
    if target.eq_ignore_ascii_case("EpicGamesLauncher") || display_name.eq_ignore_ascii_case("Epic Games Launcher") {
      continue;
    }

    let title = if !display_name.is_empty() {
      display_name
    } else {
      target.clone()
    };

    imports.push(ImportedGame {
      title,
      kind: "epic".to_string(),
      target,
      args: vec!["--tm-managed=1".to_string(), "--tm-source=epic".to_string()],
      emulator_key: None,
      manual_system_key: None,
    });
  }

  imports
}
