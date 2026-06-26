use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

fn core_service_error(code: &str, detail: impl AsRef<str>) -> String {
  format!("[{code}] {}", detail.as_ref().trim())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RetroArchCoreEnsureRequest {
  pub retroarch_path: String,
  pub profile: Option<String>,
  pub rom_path: Option<String>,
  pub core_hint: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RetroArchCoreEnsureResult {
  pub core_path: Option<String>,
  pub installed: bool,
  pub downloaded: bool,
  pub core_key: Option<String>,
  pub source: String,
}

fn map_profile_to_core(profile: &str) -> Option<&'static str> {
  match profile.trim().to_lowercase().as_str() {
    "ds" => Some("melondsds"),
    "3ds" => Some("citra"),
    "gba" => Some("mgba"),
    "gameboy" => Some("gambatte"),
    "nes" => Some("fceumm"),
    "snes" => Some("snes9x"),
    "n64" => Some("mupen64plus_next"),
    "genesis" => Some("genesis_plus_gx"),
    "dreamcast" => Some("flycast"),
    "ps1" => Some("pcsx_rearmed"),
    "psp" => Some("ppsspp"),
    _ => None,
  }
}

fn infer_profile_from_rom_path(rom_path: &str) -> Option<&'static str> {
  let lowered = rom_path.trim().to_lowercase();
  if lowered.is_empty() {
    return None;
  }

  if lowered.contains("\\dreamcast\\")
    || lowered.contains("/dreamcast/")
    || lowered.contains("sega dreamcast")
    || lowered.contains("dream cast")
    || lowered.contains("\\dc\\")
    || lowered.contains("/dc/")
  {
    return Some("dreamcast");
  }

  let extension = Path::new(&lowered)
    .extension()
    .and_then(|value| value.to_str())
    .unwrap_or_default();

  match extension {
    "nds" | "dsi" | "srl" => Some("ds"),
    "3ds" | "cia" | "3dsx" | "cci" | "cxi" | "app" => Some("3ds"),
    "nes" | "fds" => Some("nes"),
    "sfc" | "smc" | "fig" => Some("snes"),
    "gb" | "gbc" | "dmg" => Some("gameboy"),
    "gba" | "agb" => Some("gba"),
    "n64" | "z64" | "v64" => Some("n64"),
    "gen" | "md" | "smd" => Some("genesis"),
    "gdi" | "cdi" => Some("dreamcast"),
    "pbp" | "cue" | "img" => Some("ps1"),
    "chd" => None,
    "cso" | "prx" => Some("psp"),
    _ => None,
  }
}

fn infer_core_key(request: &RetroArchCoreEnsureRequest) -> Option<String> {
  if let Some(profile) = request.profile.as_ref() {
    if let Some(core) = map_profile_to_core(profile) {
      return Some(core.to_string());
    }
  }

  if let Some(rom_path) = request.rom_path.as_ref() {
    if let Some(profile) = infer_profile_from_rom_path(rom_path) {
      if let Some(core) = map_profile_to_core(profile) {
        return Some(core.to_string());
      }
    }
  }

  None
}

fn resolve_existing_core_from_hint(core_hint: &str, core_dir: &Path) -> Option<PathBuf> {
  let trimmed = core_hint.trim();
  if trimmed.is_empty() {
    return None;
  }

  let hint_path = PathBuf::from(trimmed);
  if hint_path.is_file() {
    return Some(hint_path);
  }

  let hint_name = hint_path
    .file_name()
    .and_then(|value| value.to_str())
    .unwrap_or(trimmed)
    .trim();

  if hint_name.is_empty() {
    return None;
  }

  let direct_candidate = core_dir.join(hint_name);
  if direct_candidate.is_file() {
    return Some(direct_candidate);
  }

  let normalized = if hint_name.to_lowercase().ends_with("_libretro.dll") {
    hint_name.to_string()
  } else {
    format!("{hint_name}_libretro.dll")
  };

  let normalized_candidate = core_dir.join(normalized);
  if normalized_candidate.is_file() {
    return Some(normalized_candidate);
  }

  None
}

fn download_bytes_if_ok(client: &reqwest::blocking::Client, url: &str) -> Result<Option<Vec<u8>>, String> {
  let response = client
    .get(url)
    .send()
    .map_err(|error| core_service_error("CORE_DOWNLOAD_FAILED", format!("Failed to reach {url}: {error}")))?;

  if !response.status().is_success() {
    return Ok(None);
  }

  let bytes = response
    .bytes()
    .map_err(|error| core_service_error("CORE_DOWNLOAD_FAILED", format!("Failed to read {url}: {error}")))?;

  if bytes.is_empty() {
    return Ok(None);
  }

  Ok(Some(bytes.to_vec()))
}

fn write_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| {
      core_service_error(
        "CORE_INSTALL_FAILED",
        format!("Could not create core directory {}: {error}", parent.to_string_lossy()),
      )
    })?;
  }

  let mut file = fs::File::create(path).map_err(|error| {
    core_service_error(
      "CORE_INSTALL_FAILED",
      format!("Could not create core file {}: {error}", path.to_string_lossy()),
    )
  })?;

  file.write_all(bytes).map_err(|error| {
    core_service_error(
      "CORE_INSTALL_FAILED",
      format!("Could not write core file {}: {error}", path.to_string_lossy()),
    )
  })
}

fn extract_core_from_zip_bytes(bytes: &[u8], core_filename: &str) -> Result<Option<Vec<u8>>, String> {
  let cursor = Cursor::new(bytes.to_vec());
  let mut archive = zip::ZipArchive::new(cursor)
    .map_err(|error| core_service_error("CORE_INSTALL_FAILED", format!("Core archive is invalid: {error}")))?;

  for index in 0..archive.len() {
    let mut file = archive
      .by_index(index)
      .map_err(|error| core_service_error("CORE_INSTALL_FAILED", format!("Failed to read core archive entry: {error}")))?;

    let entry_name = file.name().replace('\\', "/");
    if !entry_name.to_lowercase().ends_with(&core_filename.to_lowercase()) {
      continue;
    }

    let mut content = Vec::new();
    file.read_to_end(&mut content).map_err(|error| {
      core_service_error(
        "CORE_INSTALL_FAILED",
        format!("Failed to extract {core_filename} from archive: {error}"),
      )
    })?;

    if content.is_empty() {
      return Ok(None);
    }

    return Ok(Some(content));
  }

  Ok(None)
}

pub(crate) fn ensure_retroarch_core_impl(request: RetroArchCoreEnsureRequest) -> Result<RetroArchCoreEnsureResult, String> {
  let retroarch_path = PathBuf::from(request.retroarch_path.trim());
  if !retroarch_path.is_file() {
    return Err(core_service_error(
      "INVALID_RETROARCH_PATH",
      format!(
        "RetroArch executable was not found at {}.",
        retroarch_path.to_string_lossy()
      ),
    ));
  }

  let retroarch_dir = retroarch_path
    .parent()
    .ok_or_else(|| core_service_error("INVALID_RETROARCH_PATH", "Could not resolve RetroArch install directory."))?
    .to_path_buf();

  let core_dir = retroarch_dir.join("cores");
  fs::create_dir_all(&core_dir).map_err(|error| {
    core_service_error(
      "CORE_INSTALL_FAILED",
      format!("Could not create core directory {}: {error}", core_dir.to_string_lossy()),
    )
  })?;

  if let Some(core_hint) = request.core_hint.as_ref() {
    if let Some(existing) = resolve_existing_core_from_hint(core_hint, &core_dir) {
      return Ok(RetroArchCoreEnsureResult {
        core_path: Some(existing.to_string_lossy().to_string()),
        installed: true,
        downloaded: false,
        core_key: None,
        source: "hint".to_string(),
      });
    }
  }

  let Some(core_key) = infer_core_key(&request) else {
    return Ok(RetroArchCoreEnsureResult {
      core_path: None,
      installed: false,
      downloaded: false,
      core_key: None,
      source: "unmapped".to_string(),
    });
  };

  let core_filename = format!("{core_key}_libretro.dll");
  let core_path = core_dir.join(&core_filename);

  if core_path.is_file() {
    return Ok(RetroArchCoreEnsureResult {
      core_path: Some(core_path.to_string_lossy().to_string()),
      installed: true,
      downloaded: false,
      core_key: Some(core_key),
      source: "existing".to_string(),
    });
  }

  let client = reqwest::blocking::Client::builder()
    .timeout(Duration::from_secs(45))
    .build()
    .map_err(|error| core_service_error("CORE_DOWNLOAD_FAILED", format!("Could not create download client: {error}")))?;

  let direct_dll_url = format!(
    "https://buildbot.libretro.com/nightly/windows/x86_64/latest/{core_filename}"
  );

  if let Some(bytes) = download_bytes_if_ok(&client, &direct_dll_url)? {
    write_bytes(&core_path, &bytes)?;

    return Ok(RetroArchCoreEnsureResult {
      core_path: Some(core_path.to_string_lossy().to_string()),
      installed: true,
      downloaded: true,
      core_key: Some(core_key),
      source: "download-direct".to_string(),
    });
  }

  let zip_url = format!(
    "https://buildbot.libretro.com/nightly/windows/x86_64/latest/{core_filename}.zip"
  );

  if let Some(zip_bytes) = download_bytes_if_ok(&client, &zip_url)? {
    if let Some(core_bytes) = extract_core_from_zip_bytes(&zip_bytes, &core_filename)? {
      write_bytes(&core_path, &core_bytes)?;

      return Ok(RetroArchCoreEnsureResult {
        core_path: Some(core_path.to_string_lossy().to_string()),
        installed: true,
        downloaded: true,
        core_key: Some(core_key),
        source: "download-zip".to_string(),
      });
    }
  }

  Err(core_service_error(
    "CORE_DOWNLOAD_FAILED",
    format!(
      "Could not download RetroArch core {core_filename}. Tried {direct_dll_url} and {zip_url}."
    ),
  ))
}
