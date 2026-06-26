use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn is_ds_emulator_executable(path: &Path) -> bool {
  let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
    return false;
  };

  if !extension.eq_ignore_ascii_case("exe") {
    return false;
  }

  let file_name = path
    .file_name()
    .and_then(|value| value.to_str())
    .unwrap_or_default()
    .to_lowercase();

  file_name.contains("melonds") || file_name.contains("desmume")
}

pub(crate) fn is_3ds_emulator_executable(path: &Path) -> bool {
  let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
    return false;
  };

  if !extension.eq_ignore_ascii_case("exe") {
    return false;
  }

  let file_name = path
    .file_name()
    .and_then(|value| value.to_str())
    .unwrap_or_default()
    .to_lowercase();

  file_name.contains("azahar") || file_name.contains("citra") || file_name.contains("lime3ds")
}

pub(crate) fn find_ds_emulator_in_dir(path: &Path, depth: usize, max_depth: usize) -> Option<PathBuf> {
  if depth > max_depth {
    return None;
  }

  let Ok(entries) = fs::read_dir(path) else {
    return None;
  };

  for entry in entries.flatten() {
    let entry_path = entry.path();

    if entry_path.is_file() {
      if is_ds_emulator_executable(&entry_path) {
        return Some(entry_path);
      }

      continue;
    }

    if !entry_path.is_dir() {
      continue;
    }

    if let Some(found) = find_ds_emulator_in_dir(&entry_path, depth + 1, max_depth) {
      return Some(found);
    }
  }

  None
}

pub(crate) fn find_3ds_emulator_in_dir(path: &Path, depth: usize, max_depth: usize) -> Option<PathBuf> {
  if depth > max_depth {
    return None;
  }

  let Ok(entries) = fs::read_dir(path) else {
    return None;
  };

  for entry in entries.flatten() {
    let entry_path = entry.path();

    if entry_path.is_file() {
      if is_3ds_emulator_executable(&entry_path) {
        return Some(entry_path);
      }

      continue;
    }

    if !entry_path.is_dir() {
      continue;
    }

    if let Some(found) = find_3ds_emulator_in_dir(&entry_path, depth + 1, max_depth) {
      return Some(found);
    }
  }

  None
}
