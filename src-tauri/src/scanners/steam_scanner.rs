use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::PathBuf;

use crate::ImportedGame;

pub(crate) fn parse_quoted_values(input: &str) -> Vec<String> {
  let mut values: Vec<String> = Vec::new();
  let mut current = String::new();
  let mut inside_quotes = false;

  for character in input.chars() {
    if character == '"' {
      if inside_quotes {
        values.push(current.clone());
        current.clear();
      }

      inside_quotes = !inside_quotes;
      continue;
    }

    if inside_quotes {
      current.push(character);
    }
  }

  values
}

pub(crate) fn parse_vdf_value(contents: &str, key: &str) -> Option<String> {
  for line in contents.lines() {
    if !line.contains(&format!("\"{key}\"")) {
      continue;
    }

    let values = parse_quoted_values(line);
    if values.len() >= 2 && values[0] == key {
      return Some(values[1].replace("\\\\", "\\"));
    }
  }

  None
}

pub(crate) fn steam_roots() -> Vec<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  let mut candidates: Vec<PathBuf> = Vec::new();
  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    candidates.push(PathBuf::from(program_files_x86).join("Steam"));
  }

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    candidates.push(PathBuf::from(program_files).join("Steam"));
  }

  for candidate in candidates {
    if !candidate.exists() {
      continue;
    }

    let key = candidate.to_string_lossy().to_lowercase();
    if seen.insert(key) {
      roots.push(candidate.clone());
    }

    let library_file = candidate.join("steamapps").join("libraryfolders.vdf");
    let Ok(contents) = fs::read_to_string(library_file) else {
      continue;
    };

    for line in contents.lines() {
      if !line.contains("\"path\"") {
        continue;
      }

      let values = parse_quoted_values(line);
      if values.len() < 2 || values[0] != "path" {
        continue;
      }

      let path = PathBuf::from(values[1].replace("\\\\", "\\"));
      if !path.exists() {
        continue;
      }

      let path_key = path.to_string_lossy().to_lowercase();
      if seen.insert(path_key) {
        roots.push(path);
      }
    }
  }

  roots
}

pub(crate) fn parse_steam_app_id_from_target(target: &str) -> Option<String> {
  let trimmed = target.trim();
  if trimmed.is_empty() {
    return None;
  }

  if trimmed.chars().all(|value| value.is_ascii_digit()) {
    return Some(trimmed.to_string());
  }

  let marker = "steam://rungameid/";
  let lowered = trimmed.to_lowercase();
  if let Some(index) = lowered.find(marker) {
    let start = index + marker.len();
    let digits: String = trimmed[start..]
      .chars()
      .take_while(|value| value.is_ascii_digit())
      .collect();
    if !digits.is_empty() {
      return Some(digits);
    }
  }

  None
}

pub(crate) fn scan_steam_games() -> Vec<ImportedGame> {
  let mut imports: Vec<ImportedGame> = Vec::new();
  let mut seen_app_ids: HashSet<String> = HashSet::new();

  for root in steam_roots() {
    let steamapps = root.join("steamapps");
    let Ok(entries) = fs::read_dir(steamapps) else {
      continue;
    };

    for entry in entries.flatten() {
      let file_name = entry.file_name().to_string_lossy().to_string();
      if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
        continue;
      }

      let Ok(contents) = fs::read_to_string(entry.path()) else {
        continue;
      };

      let Some(app_id) = parse_vdf_value(&contents, "appid") else {
        continue;
      };

      let clean_app_id = app_id.trim().to_string();
      if clean_app_id.is_empty() || !seen_app_ids.insert(clean_app_id.clone()) {
        continue;
      }

      let name = parse_vdf_value(&contents, "name")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("Steam {clean_app_id}"));

      imports.push(ImportedGame {
        title: name,
        kind: "steam".to_string(),
        target: clean_app_id,
        args: vec!["--tm-managed=1".to_string(), "--tm-source=steam".to_string()],
        emulator_key: None,
        manual_system_key: None,
      });
    }
  }

  imports
}

pub(crate) fn steam_cover_candidates(app_id: u32) -> Vec<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();
  let app_id_text = app_id.to_string();

  for root in steam_roots() {
    let library_cache = root.join("appcache").join("librarycache");
    if !library_cache.exists() {
      continue;
    }

    let folder = library_cache.join(&app_id_text);
    if folder.exists() {
      for file_name in [
        "library_600x900.jpg",
        "library_600x900.png",
        "header.jpg",
        "header.png",
        "library_hero.jpg",
        "library_hero.png",
        "logo.png",
      ] {
        let candidate = folder.join(file_name);
        if candidate.exists() {
          candidates.push(candidate);
        }
      }

      if let Ok(entries) = fs::read_dir(&folder) {
        for entry in entries.flatten() {
          let path = entry.path();
          let Some(ext) = path.extension().and_then(|value| value.to_str()) else {
            continue;
          };

          let ext = ext.to_lowercase();
          if ext == "jpg" || ext == "jpeg" || ext == "png" {
            candidates.push(path);
          }
        }
      }
    }

    let names = [
      format!("{app_id_text}_library_600x900.jpg"),
      format!("{app_id_text}_library_600x900.png"),
      format!("{app_id_text}_library_capsule.jpg"),
      format!("{app_id_text}_library_capsule.png"),
      format!("{app_id_text}_header.jpg"),
      format!("{app_id_text}_header.png"),
      format!("{app_id_text}_library_hero.jpg"),
      format!("{app_id_text}_library_hero.png"),
    ];

    for file_name in names {
      let candidate = library_cache.join(file_name);
      if candidate.exists() {
        candidates.push(candidate);
      }
    }

    let userdata = root.join("userdata");
    if userdata.exists() {
      if let Ok(users) = fs::read_dir(userdata) {
        for user in users.flatten() {
          let grid = user.path().join("config").join("grid");
          if !grid.exists() {
            continue;
          }

          for file_name in [
            format!("{app_id_text}p.jpg"),
            format!("{app_id_text}p.png"),
            format!("{app_id_text}.jpg"),
            format!("{app_id_text}.png"),
            format!("{app_id_text}_hero.jpg"),
            format!("{app_id_text}_hero.png"),
          ] {
            let candidate = grid.join(file_name);
            if candidate.exists() {
              candidates.push(candidate);
            }
          }
        }
      }
    }
  }

  candidates
}
