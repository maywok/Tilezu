use std::collections::{HashMap, HashSet};
use std::env;
use std::path::{Path, PathBuf};

use super::emulator_scanner::{find_3ds_emulator_in_dir, find_ds_emulator_in_dir};
use super::rom_scanner::{gather_rom_files, rom_profile};

#[derive(Debug)]
struct EmulatorInstall {
  name: &'static str,
  executable: PathBuf,
}

fn find_installed_emulators(settings: Option<&crate::ImportSettings>) -> HashMap<&'static str, EmulatorInstall> {
  let mut installs: HashMap<&'static str, EmulatorInstall> = HashMap::new();

  let emulator_labels: [(&str, &str); 9] = [
    ("retroarch", "RetroArch"),
    ("eden", "Eden"),
    ("3ds", "Nintendo 3DS"),
    ("dolphin", "Dolphin"),
    ("pcsx2", "PCSX2"),
    ("ppsspp", "PPSSPP"),
    ("cemu", "Cemu"),
    ("rpcs3", "RPCS3"),
    ("ds", "Nintendo DS"),
  ];

  if let Some(custom_paths) = settings.and_then(|value| value.emulator_paths.as_ref()) {
    for (key, label) in emulator_labels {
      let Some(path) = custom_paths.get(key) else {
        continue;
      };

      let trimmed = path.trim();
      if trimmed.is_empty() {
        continue;
      }

      let path_buf = PathBuf::from(trimmed);
      if !path_buf.exists() {
        continue;
      }

      let executable = if path_buf.is_dir() {
        if key == "ds" {
          let Some(resolved) = find_ds_emulator_in_dir(&path_buf, 0, 2) else {
            continue;
          };
          resolved
        } else if key == "3ds" {
          let Some(resolved) = find_3ds_emulator_in_dir(&path_buf, 0, 2) else {
            continue;
          };
          resolved
        } else {
          continue;
        }
      } else {
        path_buf
      };

      installs.insert(
        key,
        EmulatorInstall {
          name: label,
          executable,
        },
      );
    }
  }

  let mut roots: Vec<PathBuf> = Vec::new();
  let mut root_seen: HashSet<String> = HashSet::new();

  let mut push_root = |path: PathBuf| {
    let key = path.to_string_lossy().to_lowercase();
    if root_seen.insert(key) {
      roots.push(path);
    }
  };

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    push_root(PathBuf::from(program_files));
  }
  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    push_root(PathBuf::from(program_files_x86));
  }
  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    push_root(PathBuf::from(local_app_data));
  }
  if let Ok(current_dir) = env::current_dir() {
    push_root(current_dir);
  }
  if let Ok(current_exe) = env::current_exe() {
    for ancestor in current_exe.ancestors().take(8) {
      push_root(ancestor.to_path_buf());
    }
  }

  let definitions: [(&str, &str, &[&str]); 9] = [
    ("retroarch", "RetroArch", &["RetroArch\\retroarch.exe"]),
    (
      "eden",
      "Eden",
      &["Eden\\Eden.exe", "Eden\\eden.exe", "eden\\eden.exe", "eden.exe"],
    ),
    (
      "3ds",
      "Nintendo 3DS",
      &[
        "Azahar\\azahar.exe",
        "Azahar\\qt\\bin\\azahar.exe",
        "Citra\\citra-qt.exe",
        "Citra\\citra.exe",
        "Lime3DS\\lime3ds-qt.exe",
        "Lime3DS\\lime3ds.exe",
        "assets\\emulators\\Azahar\\azahar.exe",
        "assets\\emulator\\Azahar\\azahar.exe",
        "assets\\Azahar\\azahar.exe",
        "assets\\emulators\\Citra\\citra-qt.exe",
        "assets\\emulator\\Citra\\citra-qt.exe",
        "assets\\Citra\\citra-qt.exe",
        "src\\assets\\emulators\\Azahar\\azahar.exe",
        "src\\assets\\emulator\\Azahar\\azahar.exe",
        "src\\assets\\Azahar\\azahar.exe",
        "src\\assets\\emulators\\Citra\\citra-qt.exe",
        "src\\assets\\emulator\\Citra\\citra-qt.exe",
        "src\\assets\\Citra\\citra-qt.exe",
      ],
    ),
    (
      "dolphin",
      "Dolphin",
      &["Dolphin Emulator\\Dolphin.exe", "Dolphin\\Dolphin.exe"],
    ),
    (
      "pcsx2",
      "PCSX2",
      &["PCSX2\\pcsx2-qt.exe", "PCSX2\\pcsx2.exe"],
    ),
    ("ppsspp", "PPSSPP", &["PPSSPP\\PPSSPPWindows64.exe"]),
    ("cemu", "Cemu", &["Cemu\\cemu.exe"]),
    ("rpcs3", "RPCS3", &["RPCS3\\rpcs3.exe"]),
    (
      "ds",
      "Nintendo DS",
      &[
        "melonDS\\melonDS.exe",
        "Programs\\melonDS\\melonDS.exe",
        "DeSmuME\\DeSmuME_x64.exe",
        "DeSmuME\\DeSmuME.exe",
        "assets\\emulators\\melonDS\\melonDS.exe",
        "assets\\emulator\\melonDS\\melonDS.exe",
        "assets\\emulator\\DS\\melonDS.exe",
        "assets\\emulator\\DS\\DeSmuME_x64.exe",
        "assets\\emulator\\DS\\DeSmuME.exe",
        "assets\\melonDS\\melonDS.exe",
        "assets\\emulators\\DeSmuME\\DeSmuME_x64.exe",
        "assets\\emulators\\DeSmuME\\DeSmuME.exe",
        "assets\\DeSmuME\\DeSmuME_x64.exe",
        "assets\\DeSmuME\\DeSmuME.exe",
        "src\\assets\\emulators\\melonDS\\melonDS.exe",
        "src\\assets\\emulator\\melonDS\\melonDS.exe",
        "src\\assets\\emulator\\DS\\melonDS.exe",
        "src\\assets\\emulator\\DS\\DeSmuME_x64.exe",
        "src\\assets\\emulator\\DS\\DeSmuME.exe",
        "src\\assets\\emulators\\DeSmuME\\DeSmuME_x64.exe",
        "src\\assets\\emulators\\DeSmuME\\DeSmuME.exe",
      ],
    ),
  ];

  for (key, display_name, possible_paths) in definitions {
    if installs.contains_key(key) {
      continue;
    }

    'outer: for root in &roots {
      for relative in possible_paths {
        let path = root.join(relative);
        if path.exists() {
          installs.insert(
            key,
            EmulatorInstall {
              name: display_name,
              executable: path,
            },
          );
          break 'outer;
        }
      }
    }
  }

  if !installs.contains_key("3ds") {
    let mut three_ds_dirs: Vec<PathBuf> = Vec::new();
    let mut seen_dirs: HashSet<String> = HashSet::new();

    let mut push_three_ds_dir = |path: PathBuf| {
      if !path.exists() {
        return;
      }

      let key = path.to_string_lossy().to_lowercase();
      if seen_dirs.insert(key) {
        three_ds_dirs.push(path);
      }
    };

    for root in &roots {
      for candidate in [
        root.join("assets").join("emulator").join("3DS"),
        root.join("assets").join("emulators").join("3DS"),
        root.join("assets").join("emulator").join("Nintendo 3DS"),
        root.join("assets").join("emulators").join("Nintendo 3DS"),
        root.join("assets").join("emulator").join("Azahar"),
        root.join("assets").join("emulators").join("Azahar"),
        root.join("assets").join("emulator").join("Citra"),
        root.join("assets").join("emulators").join("Citra"),
        root.join("src").join("assets").join("emulator").join("3DS"),
        root.join("src").join("assets").join("emulators").join("3DS"),
        root.join("src").join("assets").join("emulator").join("Nintendo 3DS"),
        root.join("src").join("assets").join("emulators").join("Nintendo 3DS"),
        root.join("src").join("assets").join("emulator").join("Azahar"),
        root.join("src").join("assets").join("emulators").join("Azahar"),
        root.join("src").join("assets").join("emulator").join("Citra"),
        root.join("src").join("assets").join("emulators").join("Citra"),
        root.join("Azahar"),
        root.join("Citra"),
        root.join("Lime3DS"),
        root.join("Programs").join("Azahar"),
        root.join("Programs").join("Citra"),
        root.join("Programs").join("Lime3DS"),
      ] {
        push_three_ds_dir(candidate);
      }
    }

    for directory in three_ds_dirs {
      if let Some(executable) = find_3ds_emulator_in_dir(&directory, 0, 2) {
        installs.insert(
          "3ds",
          EmulatorInstall {
            name: "Nintendo 3DS",
            executable,
          },
        );
        break;
      }
    }
  }

  if !installs.contains_key("ds") {
    let mut ds_dirs: Vec<PathBuf> = Vec::new();
    let mut seen_dirs: HashSet<String> = HashSet::new();

    let mut push_ds_dir = |path: PathBuf| {
      if !path.exists() {
        return;
      }

      let key = path.to_string_lossy().to_lowercase();
      if seen_dirs.insert(key) {
        ds_dirs.push(path);
      }
    };

    for root in &roots {
      for candidate in [
        root.join("assets").join("emulator").join("DS"),
        root.join("assets").join("emulators").join("DS"),
        root.join("assets").join("emulator"),
        root.join("assets").join("emulators"),
        root.join("src").join("assets").join("emulator").join("DS"),
        root.join("src").join("assets").join("emulators").join("DS"),
        root.join("src").join("assets").join("emulator"),
        root.join("src").join("assets").join("emulators"),
        root.join("melonDS"),
        root.join("DeSmuME"),
        root.join("Programs").join("melonDS"),
        root.join("Programs").join("DeSmuME"),
      ] {
        push_ds_dir(candidate);
      }
    }

    for directory in ds_dirs {
      if let Some(executable) = find_ds_emulator_in_dir(&directory, 0, 2) {
        installs.insert(
          "ds",
          EmulatorInstall {
            name: "Nintendo DS",
            executable,
          },
        );
        break;
      }
    }
  }

  installs
}

fn common_rom_dirs(settings: Option<&crate::ImportSettings>) -> Vec<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  let mut push_if_exists = |path: PathBuf| {
    if !path.exists() {
      return;
    }

    let key = path.to_string_lossy().to_lowercase();
    if seen.insert(key) {
      roots.push(path);
    }
  };

  if let Some(custom_dirs) = settings.and_then(|value| value.rom_dirs.as_ref()) {
    if let Some(user_profile) = env::var_os("USERPROFILE") {
      let user = PathBuf::from(user_profile);
      for raw in custom_dirs {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
          continue;
        }

        let expanded = trimmed
          .replace("~/", &(user.to_string_lossy().to_string() + "\\"))
          .replace("/", "\\");

        let path = PathBuf::from(expanded);
        push_if_exists(path);
      }
    }
  }

  // Include project-local asset folders so emulator+ROM bundles inside assets are discoverable.
  let mut asset_bases: Vec<PathBuf> = Vec::new();
  if let Ok(current_dir) = env::current_dir() {
    asset_bases.push(current_dir);
  }
  if let Ok(current_exe) = env::current_exe() {
    for ancestor in current_exe.ancestors().take(8) {
      asset_bases.push(ancestor.to_path_buf());
    }
  }

  for base in asset_bases {
    for candidate in [
      base.join("assets").join("roms"),
      base.join("assets").join("ROMs"),
      base.join("assets").join("3ds"),
      base.join("assets").join("3DS"),
      base.join("assets").join("Nintendo 3DS"),
      base.join("assets").join("nds"),
      base.join("assets").join("NDS"),
      base.join("assets").join("emulators"),
      base.join("assets").join("emulator"),
      base.join("assets").join("emulator").join("DS"),
      base.join("assets").join("emulator").join("NDS"),
      base.join("assets").join("emulator").join("3DS"),
      base.join("assets").join("emulator").join("Nintendo 3DS"),
      base.join("assets").join("emulator").join("Dreamcast"),
      base.join("assets").join("emulator").join("Sega Dreamcast"),
      base.join("src").join("assets").join("roms"),
      base.join("src").join("assets").join("3ds"),
      base.join("src").join("assets").join("3DS"),
      base.join("src").join("assets").join("Nintendo 3DS"),
      base.join("src").join("assets").join("emulators"),
      base.join("src").join("assets").join("emulator"),
      base.join("src").join("assets").join("emulator").join("DS"),
      base.join("src").join("assets").join("emulator").join("NDS"),
      base.join("src").join("assets").join("emulator").join("3DS"),
      base.join("src").join("assets").join("emulator").join("Nintendo 3DS"),
      base.join("src").join("assets").join("emulator").join("Dreamcast"),
      base.join("src").join("assets").join("emulator").join("Sega Dreamcast"),
    ] {
      push_if_exists(candidate);
    }
  }

  // If a DS emulator was found, scan common sibling ROM folders near that executable.
  let installed = find_installed_emulators(settings);
  if let Some(ds_install) = installed.get("ds") {
    if let Some(parent) = ds_install.executable.parent() {
      for candidate in [
        parent.join("roms"),
        parent.join("ROMs"),
        parent.join("games"),
        parent.join("Games"),
        parent.join("nds"),
        parent.join("NDS"),
      ] {
        push_if_exists(candidate);
      }

      let parent_lower = parent.to_string_lossy().to_lowercase();
      if parent_lower.contains("assets")
        || parent_lower.contains("melonds")
        || parent_lower.contains("desmume")
      {
        push_if_exists(parent.to_path_buf());
      }
    }
  }

  if let Some(three_ds_install) = installed.get("3ds") {
    if let Some(parent) = three_ds_install.executable.parent() {
      for candidate in [
        parent.join("roms"),
        parent.join("ROMs"),
        parent.join("games"),
        parent.join("Games"),
        parent.join("3ds"),
        parent.join("3DS"),
        parent.join("Nintendo 3DS"),
      ] {
        push_if_exists(candidate);
      }

      let parent_lower = parent.to_string_lossy().to_lowercase();
      if parent_lower.contains("assets")
        || parent_lower.contains("azahar")
        || parent_lower.contains("citra")
        || parent_lower.contains("lime3ds")
      {
        push_if_exists(parent.to_path_buf());
      }
    }
  }

  if let Some(user_profile) = env::var_os("USERPROFILE") {
    let user = PathBuf::from(user_profile);
    let roms_base = user.join("Documents").join("ROMs");

    // Top-level ROMs folder
    for path in [
      roms_base.clone(),
      user.join("Downloads").join("ROMs"),
      user.join("Games").join("ROMs"),
    ] {
      push_if_exists(path);
    }

    // Pre-installed system subfolders — these are created on first launch
    for subfolder in [
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
      "Dreamcast",
      "Sega Dreamcast",
    ] {
      push_if_exists(roms_base.join(subfolder));
    }
  }

  for path in [
    PathBuf::from(r"D:\ROMs"),
    PathBuf::from(r"E:\ROMs"),
    PathBuf::from(r"F:\ROMs"),
  ] {
    push_if_exists(path);
  }

  roots
}

fn choose_emulator<'a>(
  profile: &str,
  installed: &'a HashMap<&'static str, EmulatorInstall>,
) -> Option<&'a EmulatorInstall> {
  match profile {
    "ps2" => installed.get("pcsx2").or_else(|| installed.get("retroarch")),
    "psp" => installed.get("ppsspp").or_else(|| installed.get("retroarch")),
    "dolphin" => installed.get("dolphin").or_else(|| installed.get("retroarch")),
    "dreamcast" => installed.get("retroarch"),
    "cemu" => installed.get("cemu"),
    "rpcs3" => installed.get("rpcs3"),
    "3ds" => installed.get("3ds").or_else(|| installed.get("retroarch")),
    "switch" => installed.get("eden"),
    "ds" => installed.get("ds").or_else(|| installed.get("retroarch")),
    "retroarch" => installed.get("retroarch"),
    _ => None,
  }
}

fn normalize_emulator_key(value: &str) -> Option<&'static str> {
  match value.trim().to_lowercase().as_str() {
    "retroarch" => Some("retroarch"),
    "eden" => Some("eden"),
    "3ds" => Some("3ds"),
    "dolphin" => Some("dolphin"),
    "pcsx2" => Some("pcsx2"),
    "ppsspp" => Some("ppsspp"),
    "cemu" => Some("cemu"),
    "rpcs3" => Some("rpcs3"),
    "ds" => Some("ds"),
    _ => None,
  }
}

fn resolve_system_emulator_override(
  rom: &Path,
  profile: &str,
  settings: Option<&crate::ImportSettings>,
) -> Option<&'static str> {
  let system_map = settings
    .and_then(|value| value.system_emulator_map.as_ref())?;

  let mut lookup_keys: Vec<String> = Vec::new();
  if let Some(parent_folder) = rom
    .parent()
    .and_then(|path| path.file_name())
    .and_then(|name| name.to_str())
  {
    let trimmed = parent_folder.trim();
    if !trimmed.is_empty() {
      lookup_keys.push(trimmed.to_string());
      lookup_keys.push(trimmed.to_lowercase());
    }
  }

  let trimmed_profile = profile.trim();
  if !trimmed_profile.is_empty() {
    lookup_keys.push(trimmed_profile.to_string());
  }

  for lookup_key in lookup_keys {
    if let Some(value) = system_map.get(&lookup_key) {
      if let Some(normalized) = normalize_emulator_key(value) {
        return Some(normalized);
      }
    }

    if let Some((_, value)) = system_map
      .iter()
      .find(|(candidate, _)| candidate.trim().eq_ignore_ascii_case(lookup_key.trim()))
    {
      if let Some(normalized) = normalize_emulator_key(value) {
        return Some(normalized);
      }
    }
  }

  None
}

fn choose_emulator_key(
  profile: &str,
  installed: &HashMap<&'static str, EmulatorInstall>,
) -> Option<String> {
  match profile {
    "ps2" => {
      if installed.contains_key("pcsx2") {
        Some("pcsx2".to_string())
      } else if installed.contains_key("retroarch") {
        Some("retroarch".to_string())
      } else {
        None
      }
    }
    "psp" => {
      if installed.contains_key("ppsspp") {
        Some("ppsspp".to_string())
      } else if installed.contains_key("retroarch") {
        Some("retroarch".to_string())
      } else {
        None
      }
    }
    "dolphin" => {
      if installed.contains_key("dolphin") {
        Some("dolphin".to_string())
      } else if installed.contains_key("retroarch") {
        Some("retroarch".to_string())
      } else {
        None
      }
    }
    "dreamcast" => {
      if installed.contains_key("retroarch") {
        Some("retroarch".to_string())
      } else {
        None
      }
    }
    "cemu" => {
      if installed.contains_key("cemu") {
        Some("cemu".to_string())
      } else {
        None
      }
    }
    "rpcs3" => {
      if installed.contains_key("rpcs3") {
        Some("rpcs3".to_string())
      } else {
        None
      }
    }
    "3ds" => {
      if installed.contains_key("3ds") {
        Some("3ds".to_string())
      } else if installed.contains_key("retroarch") {
        Some("retroarch".to_string())
      } else {
        None
      }
    }
    "switch" => {
      if installed.contains_key("eden") {
        Some("eden".to_string())
      } else {
        None
      }
    }
    "ds" => {
      if installed.contains_key("ds") {
        Some("ds".to_string())
      } else if installed.contains_key("retroarch") {
        Some("retroarch".to_string())
      } else {
        None
      }
    }
    "retroarch" => {
      if installed.contains_key("retroarch") {
        Some("retroarch".to_string())
      } else {
        None
      }
    }
    _ => None,
  }
}

fn fallback_emulator(profile: &str) -> (&'static str, &'static str) {
  fallback_emulator_for_key(emulator_path_key_for_profile(profile))
}

fn fallback_emulator_for_key(emulator_key: &str) -> (&'static str, &'static str) {
  match emulator_key {
    "3ds" => ("Nintendo 3DS", "__3ds_emulator_missing__"),
    "pcsx2" => ("PCSX2", "__pcsx2_emulator_missing__"),
    "ppsspp" => ("PPSSPP", "__ppsspp_emulator_missing__"),
    "dolphin" => ("Dolphin", "__dolphin_emulator_missing__"),
    "cemu" => ("Cemu", "__cemu_emulator_missing__"),
    "rpcs3" => ("RPCS3", "__rpcs3_emulator_missing__"),
    "eden" => ("Eden", "__eden_emulator_missing__"),
    "ds" => ("Nintendo DS", "__ds_emulator_missing__"),
    _ => ("RetroArch", "__retroarch_emulator_missing__"),
  }
}

fn emulator_path_key_for_profile(profile: &str) -> &'static str {
  match profile {
    "ps2" => "pcsx2",
    "psp" => "ppsspp",
    "dolphin" => "dolphin",
    "dreamcast" => "retroarch",
    "cemu" => "cemu",
    "rpcs3" => "rpcs3",
    "3ds" => "3ds",
    "switch" => "eden",
    "ds" => "ds",
    _ => "retroarch",
  }
}

pub(crate) fn scan_rom_games(settings: Option<&crate::ImportSettings>) -> Vec<crate::ImportedGame> {
  let installed = find_installed_emulators(settings);

  let mut candidates: Vec<PathBuf> = Vec::new();
  const ROM_SCAN_LIMIT_PER_ROOT: usize = 320;
  const ROM_SCAN_LIMIT_TOTAL: usize = 2400;

  for root in common_rom_dirs(settings) {
    if candidates.len() >= ROM_SCAN_LIMIT_TOTAL {
      break;
    }

    let mut root_candidates: Vec<PathBuf> = Vec::new();
    gather_rom_files(&root, 0, 4, &mut root_candidates, ROM_SCAN_LIMIT_PER_ROOT);

    for path in root_candidates {
      if candidates.len() >= ROM_SCAN_LIMIT_TOTAL {
        break;
      }

      candidates.push(path);
    }
  }

  let mut imports: Vec<crate::ImportedGame> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();
  let mut directory_has_cue_cache: HashMap<PathBuf, bool> = HashMap::new();

  for rom in candidates {
    let extension = rom
      .extension()
      .and_then(|value| value.to_str())
      .map(|value| value.to_ascii_lowercase());

    if extension.as_deref() == Some("bin") {
      let has_cue_in_directory = rom.parent().map_or(false, |parent| {
        if let Some(cached) = directory_has_cue_cache.get(parent) {
          return *cached;
        }

        let found = std::fs::read_dir(parent)
          .ok()
          .map(|entries| {
            entries.flatten().any(|entry| {
              entry
                .path()
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.eq_ignore_ascii_case("cue"))
                .unwrap_or(false)
            })
          })
          .unwrap_or(false);

        directory_has_cue_cache.insert(parent.to_path_buf(), found);
        found
      });

      if has_cue_in_directory {
        continue;
      }
    }

    let Some(profile) = rom_profile(&rom) else {
      continue;
    };

    let emulator_override_key = resolve_system_emulator_override(&rom, profile, settings);
    let selected_emulator = emulator_override_key
      .and_then(|emulator_key| installed.get(emulator_key))
      .or_else(|| choose_emulator(profile, &installed));

    let fallback_path_key = if let Some(override_key) = emulator_override_key {
      override_key
    } else {
      emulator_path_key_for_profile(profile)
    };

    let (fallback_name, fallback_target) = if emulator_override_key.is_some() {
      fallback_emulator_for_key(fallback_path_key)
    } else {
      fallback_emulator(profile)
    };

    let configured_fallback_target = settings
      .and_then(|value| value.emulator_paths.as_ref())
      .and_then(|paths| paths.get(fallback_path_key))
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .filter(|value| Path::new(value).is_file());

    let (_emulator_name, emulator_target) = if let Some(emulator) = selected_emulator {
      (
        emulator.name,
        emulator.executable.to_string_lossy().to_string(),
      )
    } else {
      (
        fallback_name,
        configured_fallback_target.unwrap_or_else(|| fallback_target.to_string()),
      )
    };

    let rom_path = rom.to_string_lossy().to_string();
    let key = format!("{}|{}", emulator_target.to_lowercase(), rom_path.to_lowercase());
    if !seen.insert(key) {
      continue;
    }

    let title = rom
      .file_stem()
      .and_then(|value| value.to_str())
      .map(str::to_string)
      .unwrap_or_else(|| "ROM".to_string());

    let emulator_key = emulator_override_key
      .filter(|key| installed.contains_key(key))
      .map(|key| key.to_string())
      .or_else(|| choose_emulator_key(profile, &installed));

    imports.push(crate::ImportedGame {
      title,
      kind: "emulator".to_string(),
      target: emulator_target,
      args: vec![
        "--tm-managed=1".to_string(),
        "--tm-source=rom".to_string(),
        format!("--tm-profile={profile}"),
        rom_path,
      ],
      emulator_key,
      manual_system_key: None,
    });
  }

  imports
}
