use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn gather_rom_files(path: &Path, depth: usize, max_depth: usize, files: &mut Vec<PathBuf>, limit: usize) {
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

    let path = entry.path();
    if path.is_dir() {
      gather_rom_files(&path, depth + 1, max_depth, files, limit);
      continue;
    }

    files.push(path);
  }
}

pub(crate) fn ds_archive_hint(path: &Path) -> bool {
  let text = path.to_string_lossy().to_lowercase();
  text.contains("\\ds\\")
    || text.contains("/ds/")
    || text.contains("\\nds\\")
    || text.contains("/nds/")
    || text.contains("nintendo ds")
    || text.contains("nintendods")
    || text.contains("melonds")
    || text.contains("desmume")
    || text.contains("(nds")
    || text.contains(" nds")
    || text.contains("ndsi")
}

fn rom_path_profile_hint(path: &Path) -> Option<&'static str> {
  let path_lower = path.to_string_lossy().to_lowercase();

  if path_lower.contains("nintendo ds") || path_lower.contains("/nds/") || path_lower.contains("\\nds\\") || ds_archive_hint(path) {
    return Some("ds");
  }

  if path_lower.contains("nintendo 3ds") || path_lower.contains("/3ds/") || path_lower.contains("\\3ds\\") {
    return Some("3ds");
  }

  if path_lower.contains("\\switch\\") || path_lower.contains("/switch/") || path_lower.contains("nintendo switch") {
    return Some("switch");
  }

  if path_lower.contains("gamecube") || path_lower.contains("game cube") {
    return Some("dolphin");
  }

  if path_lower.contains("\\wii u\\") || path_lower.contains("/wii u/") || path_lower.contains("\\wiiu\\") || path_lower.contains("/wiiu/") {
    return Some("cemu");
  }

  if path_lower.contains("\\wii\\") || path_lower.contains("/wii/") {
    return Some("dolphin");
  }

  if path_lower.contains("\\ps3\\") || path_lower.contains("/ps3/") {
    return Some("rpcs3");
  }

  if path_lower.contains("\\ps2\\") || path_lower.contains("/ps2/") {
    return Some("ps2");
  }

  if path_lower.contains("\\psp\\") || path_lower.contains("/psp/") {
    return Some("psp");
  }

  if path_lower.contains("\\ps1\\")
    || path_lower.contains("/ps1/")
    || path_lower.contains("playstation 1")
    || path_lower.contains("\\dreamcast\\")
    || path_lower.contains("/dreamcast/")
    || path_lower.contains("sega dreamcast")
    || path_lower.contains("dream cast")
    || path_lower.contains("\\n64\\")
    || path_lower.contains("/n64/")
    || path_lower.contains("nintendo 64")
    || path_lower.contains("\\snes\\")
    || path_lower.contains("/snes/")
    || path_lower.contains("\\nes\\")
    || path_lower.contains("/nes/")
    || path_lower.contains("game boy advance")
    || path_lower.contains("/gba/")
    || path_lower.contains("\\gba\\")
    || path_lower.contains("game boy")
    || path_lower.contains("/gb/")
    || path_lower.contains("/gbc/")
    || path_lower.contains("genesis")
    || path_lower.contains("mega drive")
  {
    return Some("retroarch");
  }

  None
}

fn is_dreamcast_path_hint(path: &Path) -> bool {
  let path_lower = path.to_string_lossy().to_lowercase();
  path_lower.contains("\\dreamcast\\")
    || path_lower.contains("/dreamcast/")
    || path_lower.contains("sega dreamcast")
    || path_lower.contains("dream cast")
    || path_lower.contains("\\dc\\")
    || path_lower.contains("/dc/")
}

pub(crate) fn rom_profile(path: &Path) -> Option<&'static str> {
  let extension = path.extension().and_then(|value| value.to_str())?.to_lowercase();
  let path_hint = rom_path_profile_hint(path);
  let dreamcast_hint = is_dreamcast_path_hint(path);

  if matches!(extension.as_str(), "zip" | "7z" | "rar" | "txt") {
    return path_hint;
  }

  match extension.as_str() {
    "3ds" | "cia" | "3dsx" | "cci" | "cxi" | "app" => Some("3ds"),
    "nsp" | "xci" | "nsz" | "nca" => Some("switch"),
    "gcm" | "gcz" | "wbfs" | "rvz" | "rvs" | "wia" | "dol" => Some("dolphin"),
    "wud" | "wux" | "rpx" | "wua" => Some("cemu"),
    "pkg" | "ps3" => Some("rpcs3"),
    "iso" | "bin" | "cue" | "chd" | "mdf" | "nrg" => {
      if dreamcast_hint {
        if matches!(extension.as_str(), "bin" | "cue" | "chd") {
          return Some("dreamcast");
        }
      }

      if let Some(profile) = path_hint {
        if matches!(profile, "dolphin" | "psp" | "ps2" | "rpcs3" | "retroarch") {
          return Some(profile);
        }
      }

      Some("ps2")
    }
    "cso" | "prx" => Some("psp"),
    "pbp" => {
      if let Some(profile) = path_hint {
        if profile == "psp" {
          return Some("psp");
        }
      }

      Some("retroarch")
    }
    "nds" | "dsi" | "srl" => Some("ds"),
    "gdi" | "cdi" => Some("dreamcast"),
    "nes" | "fds" | "sfc" | "smc" | "fig" | "gb" | "gbc" | "dmg" | "gba" | "agb"
    | "n64" | "z64" | "v64" | "gen" | "md" | "smd" => Some("retroarch"),
    _ => None,
  }
}
