use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::steam_scanner::{parse_steam_app_id_from_target, steam_roots};
use crate::utils::path_utils::title_folder_variants;

pub(crate) fn collect_recent_images_from_dirs(directories: &[PathBuf], limit: usize) -> Vec<String> {
  let mut files_with_time: Vec<(PathBuf, u128)> = Vec::new();
  let mut seen_paths: HashSet<String> = HashSet::new();

  for directory in directories {
    let Ok(entries) = fs::read_dir(directory) else {
      continue;
    };

    for entry in entries.flatten() {
      let path = entry.path();
      if !path.is_file() {
        continue;
      }

      let is_image = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| {
          matches!(
            value.to_lowercase().as_str(),
            "png" | "jpg" | "jpeg" | "webp" | "bmp"
          )
        })
        .unwrap_or(false);

      if !is_image {
        continue;
      }

      let key = path.to_string_lossy().to_lowercase();
      if !seen_paths.insert(key) {
        continue;
      }

      let modified_key = fs::metadata(&path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0);

      files_with_time.push((path, modified_key));
    }
  }

  files_with_time.sort_by(|left, right| right.1.cmp(&left.1));
  files_with_time
    .into_iter()
    .take(limit)
    .map(|(path, _)| path.to_string_lossy().to_string())
    .collect()
}

pub(crate) fn screenshot_directories_for_request(
  kind: &str,
  target: &str,
  title: Option<&str>,
) -> Vec<PathBuf> {
  let mut directories: Vec<PathBuf> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  let mut push_directory = |value: PathBuf| {
    let key = value.to_string_lossy().to_lowercase();
    if seen.insert(key) {
      directories.push(value);
    }
  };

  if kind.trim().eq_ignore_ascii_case("steam") {
    if let Some(app_id) = parse_steam_app_id_from_target(target) {
      for root in steam_roots() {
        let userdata = root.join("userdata");
        let Ok(users) = fs::read_dir(userdata) else {
          continue;
        };

        for user in users.flatten() {
          let screenshot_dir = user
            .path()
            .join("760")
            .join("remote")
            .join(&app_id)
            .join("screenshots");
          if screenshot_dir.exists() {
            push_directory(screenshot_dir);
          }
        }
      }
    }
  }

  let title_value = title.unwrap_or_default();
  let title_variants = title_folder_variants(title_value);

  if let Some(user_profile) = env::var_os("USERPROFILE") {
    let user_home = PathBuf::from(user_profile);
    let pictures = user_home.join("Pictures");
    let documents = user_home.join("Documents");

    let shared_candidates = [
      pictures.join("Screenshots"),
      pictures.join("Saved Pictures"),
      documents.join("My Games"),
    ];

    for candidate in shared_candidates {
      if candidate.exists() {
        push_directory(candidate);
      }
    }

    for variant in &title_variants {
      let title_candidates = [
        pictures.join(variant).join("Screenshots"),
        pictures.join(variant),
        documents.join("My Games").join(variant).join("Screenshots"),
        documents.join("My Games").join(variant),
      ];

      for candidate in title_candidates {
        if candidate.exists() {
          push_directory(candidate);
        }
      }
    }
  }

  let target_path = PathBuf::from(target.trim());
  if target_path.exists() {
    if let Some(parent) = target_path.parent() {
      let local_candidates = [
        parent.join("screenshots"),
        parent.join("Screenshots"),
        parent.join("screenhots"),
      ];

      for candidate in local_candidates {
        if candidate.exists() {
          push_directory(candidate);
        }
      }
    }
  }

  directories
}

pub(crate) fn gather_images_recursive(
  path: &Path,
  depth: usize,
  max_depth: usize,
  files: &mut Vec<PathBuf>,
  limit: usize,
) {
  if depth > max_depth || files.len() >= limit {
    return;
  }

  let Ok(entries) = fs::read_dir(path) else {
    return;
  };

  for entry in entries.flatten() {
    if files.len() >= limit {
      return;
    }

    let entry_path = entry.path();
    if entry_path.is_dir() {
      gather_images_recursive(&entry_path, depth + 1, max_depth, files, limit);
      continue;
    }

    let is_image = entry_path
      .extension()
      .and_then(|value| value.to_str())
      .map(|value| matches!(value.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "webp" | "bmp"))
      .unwrap_or(false);

    if is_image {
      files.push(entry_path);
    }
  }
}
