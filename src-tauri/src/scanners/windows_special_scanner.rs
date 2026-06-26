use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use super::registry_scanner::registry_key_exists;
use crate::ImportedGame;

fn managed_args(source: &str) -> Vec<String> {
  vec!["--tm-managed=1".to_string(), format!("--tm-source={source}")]
}

#[cfg(target_os = "windows")]
pub(crate) fn minecraft_launcher_path() -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();

  if let Some(system_drive) = env::var_os("SystemDrive") {
    candidates.push(
      PathBuf::from(system_drive)
        .join("XboxGames")
        .join("Minecraft Launcher")
        .join("Content")
        .join("Minecraft.exe"),
    );
  }

  candidates.push(
    PathBuf::from(r"C:\XboxGames")
      .join("Minecraft Launcher")
      .join("Content")
      .join("Minecraft.exe"),
  );

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    candidates.push(
      PathBuf::from(program_files_x86.clone())
        .join("Minecraft Launcher")
        .join("MinecraftLauncher.exe"),
    );
    candidates.push(
      PathBuf::from(program_files_x86)
        .join("Minecraft Launcher")
        .join("Minecraft.exe"),
    );
  }

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    candidates.push(
      PathBuf::from(program_files.clone())
        .join("Minecraft Launcher")
        .join("MinecraftLauncher.exe"),
    );
    candidates.push(
      PathBuf::from(program_files)
        .join("Minecraft Launcher")
        .join("Minecraft.exe"),
    );
  }

  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    candidates.push(
      PathBuf::from(local_app_data.clone())
        .join("Programs")
        .join("Minecraft Launcher")
        .join("MinecraftLauncher.exe"),
    );
    candidates.push(
      PathBuf::from(local_app_data.clone())
        .join("Programs")
        .join("Minecraft Launcher")
        .join("Minecraft.exe"),
    );
    candidates.push(
      PathBuf::from(local_app_data.clone())
        .join("Microsoft")
        .join("WindowsApps")
        .join("MinecraftLauncher.exe"),
    );
    candidates.push(
      PathBuf::from(local_app_data)
        .join("Microsoft")
        .join("WindowsApps")
        .join("Minecraft.exe"),
    );
  }

  candidates.into_iter().find(|path| path.exists())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn minecraft_launcher_path() -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
fn protocol_launch_handler_exists(scheme: &str) -> bool {
  if scheme.trim().is_empty() {
    return false;
  }

  let hkcr = format!(r"HKCR\{scheme}\shell\open\command");
  let hkcu = format!(r"HKCU\Software\Classes\{scheme}\shell\open\command");
  registry_key_exists(hkcr.as_str()) || registry_key_exists(hkcu.as_str())
}

#[cfg(not(target_os = "windows"))]
fn protocol_launch_handler_exists(_scheme: &str) -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn minecraft_uri_launchable() -> bool {
  protocol_launch_handler_exists("minecraft")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn minecraft_uri_launchable() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn minecraft_launcher_uri_launchable() -> bool {
  protocol_launch_handler_exists("minecraft-launcher")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn minecraft_launcher_uri_launchable() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn minecraft_launcher_exists() -> bool {
  minecraft_launcher_path().is_some()
    || registry_key_exists(r"HKCU\Software\Classes\minecraft-launcher")
    || registry_key_exists(r"HKCR\minecraft-launcher")
    || minecraft_launcher_uri_launchable()
    || registry_key_exists(r"HKCR\ActivatableClasses\Package\Microsoft.4297127D64EC6_8wekyb3d8bbwe")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn minecraft_launcher_exists() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn minecraft_bedrock_exists() -> bool {
  registry_key_exists(r"HKCU\Software\Classes\minecraft")
    || registry_key_exists(r"HKCR\minecraft")
    || minecraft_uri_launchable()
    || registry_key_exists(r"HKCR\ActivatableClasses\Package\Microsoft.MinecraftUWP_8wekyb3d8bbwe")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn minecraft_bedrock_exists() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn roblox_version_executable(binary_name: &str) -> Option<PathBuf> {
  let Some(local_app_data) = env::var_os("LOCALAPPDATA") else {
    return None;
  };

  let versions_dir = PathBuf::from(local_app_data).join("Roblox").join("Versions");
  if !versions_dir.exists() {
    return None;
  }

  let Ok(entries) = fs::read_dir(versions_dir) else {
    return None;
  };

  let mut best: Option<(std::time::SystemTime, PathBuf)> = None;

  for entry in entries.flatten() {
    let candidate = entry.path().join(binary_name);
    if !candidate.exists() {
      continue;
    }

    let modified = candidate
      .metadata()
      .and_then(|meta| meta.modified())
      .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

    match &best {
      Some((current_modified, _)) if modified <= *current_modified => {}
      _ => {
        best = Some((modified, candidate));
      }
    }
  }

  best.map(|(_, path)| path)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn roblox_version_executable(_binary_name: &str) -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
pub(crate) fn battle_net_launcher_path() -> Option<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    roots.push(PathBuf::from(program_files_x86));
  }

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    roots.push(PathBuf::from(program_files));
  }

  let relative_candidates = [
    PathBuf::from("Battle.net").join("Battle.net Launcher.exe"),
    PathBuf::from("Battle.net").join("Battle.net.exe"),
  ];

  for root in roots {
    for relative in &relative_candidates {
      let candidate = root.join(relative);
      if candidate.exists() {
        return Some(candidate);
      }
    }
  }

  None
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn battle_net_launcher_path() -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
pub(crate) fn epic_launcher_path() -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    candidates.push(
      PathBuf::from(program_files_x86)
        .join("Epic Games")
        .join("Launcher")
        .join("Portal")
        .join("Binaries")
        .join("Win64")
        .join("EpicGamesLauncher.exe"),
    );
  }

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    candidates.push(
      PathBuf::from(program_files)
        .join("Epic Games")
        .join("Launcher")
        .join("Portal")
        .join("Binaries")
        .join("Win64")
        .join("EpicGamesLauncher.exe"),
    );
  }

  candidates.into_iter().find(|path| path.exists())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn epic_launcher_path() -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
pub(crate) fn epic_launcher_exists() -> bool {
  epic_launcher_path().is_some()
    || registry_key_exists(r"HKCR\com.epicgames.launcher")
    || registry_key_exists(r"HKCU\Software\Classes\com.epicgames.launcher")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn epic_launcher_exists() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn ea_app_path() -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    candidates.push(
      PathBuf::from(program_files)
        .join("Electronic Arts")
        .join("EA Desktop")
        .join("EA Desktop")
        .join("EADesktop.exe"),
    );
  }

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    candidates.push(
      PathBuf::from(program_files_x86)
        .join("Electronic Arts")
        .join("EA Desktop")
        .join("EA Desktop")
        .join("EADesktop.exe"),
    );
  }

  candidates.into_iter().find(|path| path.exists())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn ea_app_path() -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
pub(crate) fn ea_app_exists() -> bool {
  ea_app_path().is_some()
    || registry_key_exists(r"HKCR\origin2")
    || registry_key_exists(r"HKCU\Software\Classes\origin2")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn ea_app_exists() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn ubisoft_connect_path() -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    candidates.push(
      PathBuf::from(program_files_x86)
        .join("Ubisoft")
        .join("Ubisoft Game Launcher")
        .join("upc.exe"),
    );
  }

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    candidates.push(
      PathBuf::from(program_files)
        .join("Ubisoft")
        .join("Ubisoft Game Launcher")
        .join("upc.exe"),
    );
  }

  candidates.into_iter().find(|path| path.exists())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn ubisoft_connect_path() -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
pub(crate) fn ubisoft_connect_exists() -> bool {
  ubisoft_connect_path().is_some()
    || registry_key_exists(r"HKCR\uplay")
    || registry_key_exists(r"HKCU\Software\Classes\uplay")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn ubisoft_connect_exists() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn xbox_app_exists() -> bool {
  registry_key_exists(r"HKCR\ms-xbl-3d8b930f")
    || registry_key_exists(r"HKCR\msxbox")
    || registry_key_exists(r"HKCR\xbox")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn xbox_app_exists() -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn riot_client_path() -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();

  if let Some(system_drive) = env::var_os("SystemDrive") {
    candidates.push(
      PathBuf::from(system_drive)
        .join("Riot Games")
        .join("Riot Client")
        .join("RiotClientServices.exe"),
    );
  }

  candidates.push(
    PathBuf::from(r"C:\Riot Games")
      .join("Riot Client")
      .join("RiotClientServices.exe"),
  );

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    candidates.push(
      PathBuf::from(program_files)
        .join("Riot Games")
        .join("Riot Client")
        .join("RiotClientServices.exe"),
    );
  }

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    candidates.push(
      PathBuf::from(program_files_x86)
        .join("Riot Games")
        .join("Riot Client")
        .join("RiotClientServices.exe"),
    );
  }

  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    candidates.push(
      PathBuf::from(local_app_data)
        .join("Riot Games")
        .join("Riot Client")
        .join("RiotClientServices.exe"),
    );
  }

  candidates.into_iter().find(|path| path.exists())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn riot_client_path() -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
fn riot_install_roots() -> Vec<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();

  if let Some(system_drive) = env::var_os("SystemDrive") {
    roots.push(PathBuf::from(system_drive).join("Riot Games"));
  }

  roots.push(PathBuf::from(r"C:\Riot Games"));

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    roots.push(PathBuf::from(program_files).join("Riot Games"));
  }

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    roots.push(PathBuf::from(program_files_x86).join("Riot Games"));
  }

  roots
}

#[cfg(not(target_os = "windows"))]
fn riot_install_roots() -> Vec<PathBuf> {
  Vec::new()
}

fn riot_game_install_exists(relative_candidates: &[&str]) -> bool {
  let roots = riot_install_roots();
  for root in roots {
    for relative in relative_candidates {
      if root.join(relative).exists() {
        return true;
      }
    }
  }

  false
}

#[cfg(target_os = "windows")]
fn riot_start_menu_shortcut_exists(shortcuts: &[&str]) -> bool {
  let mut start_menu_roots: Vec<PathBuf> = Vec::new();

  if let Some(program_data) = env::var_os("PROGRAMDATA") {
    start_menu_roots.push(
      PathBuf::from(program_data)
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("Riot Games"),
    );
  }

  if let Some(app_data) = env::var_os("APPDATA") {
    start_menu_roots.push(
      PathBuf::from(app_data)
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("Riot Games"),
    );
  }

  for root in start_menu_roots {
    for shortcut in shortcuts {
      if root.join(shortcut).exists() {
        return true;
      }
    }
  }

  false
}

#[cfg(not(target_os = "windows"))]
fn riot_start_menu_shortcut_exists(_shortcuts: &[&str]) -> bool {
  false
}

pub(crate) fn scan_windows_special_games() -> Vec<ImportedGame> {
  let mut imports: Vec<ImportedGame> = Vec::new();
  let has_minecraft_launcher = minecraft_launcher_exists();
  let has_minecraft_bedrock = minecraft_bedrock_exists();
  let has_any_minecraft = has_minecraft_launcher || has_minecraft_bedrock;

  if has_any_minecraft {
    imports.push(ImportedGame {
      title: "Minecraft Bedrock".to_string(),
      kind: "uri".to_string(),
      target: "minecraft://".to_string(),
      args: managed_args("minecraft"),
      emulator_key: None,
      manual_system_key: None,
    });
  }

  if has_any_minecraft {
    imports.push(ImportedGame {
      title: "Minecraft Java".to_string(),
      kind: "executable".to_string(),
      target: "__minecraft_java__".to_string(),
      args: managed_args("minecraft"),
      emulator_key: None,
      manual_system_key: None,
    });
  }

  let has_valorant = riot_game_install_exists(&[
    r"VALORANT\live\VALORANT.exe",
    r"VALORANT\live\ShooterGame\Binaries\Win64\VALORANT-Win64-Shipping.exe",
  ]) || riot_start_menu_shortcut_exists(&["VALORANT.lnk"]);

  if has_valorant {
    imports.push(ImportedGame {
      title: "VALORANT".to_string(),
      kind: "executable".to_string(),
      target: "__riot_valorant__".to_string(),
      args: managed_args("riot"),
      emulator_key: None,
      manual_system_key: None,
    });
  }

  let has_league = riot_game_install_exists(&[
    r"League of Legends\LeagueClient.exe",
    r"League of Legends\Game\League of Legends.exe",
  ]) || riot_start_menu_shortcut_exists(&[
    "League of Legends.lnk",
    "League of Legends (TM) Client.lnk",
    "League of Legends (TM).lnk",
  ]);

  if has_league {
    imports.push(ImportedGame {
      title: "League of Legends".to_string(),
      kind: "executable".to_string(),
      target: "__riot_league__".to_string(),
      args: managed_args("riot"),
      emulator_key: None,
      manual_system_key: None,
    });
  }

  if let Some(_roblox_player) = roblox_version_executable("RobloxPlayerBeta.exe") {
    imports.push(ImportedGame {
      title: "Roblox".to_string(),
      kind: "executable".to_string(),
      target: "__roblox_player__".to_string(),
      args: managed_args("roblox"),
      emulator_key: None,
      manual_system_key: None,
    });
  } else if registry_key_exists(r"HKCR\roblox-player")
    || registry_key_exists(r"HKCR\roblox")
    || registry_key_exists(r"HKCU\Software\Classes\roblox-player")
  {
    imports.push(ImportedGame {
      title: "Roblox".to_string(),
      kind: "executable".to_string(),
      target: "__roblox_player__".to_string(),
      args: managed_args("roblox"),
      emulator_key: None,
      manual_system_key: None,
    });
  }

  if let Some(_roblox_studio) = roblox_version_executable("RobloxStudioBeta.exe") {
    imports.push(ImportedGame {
      title: "Roblox Studio".to_string(),
      kind: "executable".to_string(),
      target: "__roblox_studio__".to_string(),
      args: managed_args("roblox"),
      emulator_key: None,
      manual_system_key: None,
    });
  }

  imports
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppxGameRecord {
  pub(crate) title: String,
  pub(crate) aumid: String,
  pub(crate) install_location: String,
}

fn xbox_managed_args() -> Vec<String> {
  managed_args("xbox_app")
}

#[cfg(target_os = "windows")]
fn is_non_xbox_install_path(path: &str) -> bool {
  let lowered = path.replace('/', "\\").to_lowercase();
  lowered.contains("\\steamapps\\")
    || lowered.contains("\\epic games\\")
    || lowered.contains("\\origin games\\")
    || lowered.contains("\\ea games\\")
    || lowered.contains("\\riot games\\")
}

#[cfg(not(target_os = "windows"))]
fn is_non_xbox_install_path(_path: &str) -> bool {
  false
}

#[cfg(target_os = "windows")]
pub(crate) fn xbox_games_roots() -> Vec<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  let mut push_root = |path: PathBuf| {
    if !path.exists() {
      return;
    }

    let key = path.to_string_lossy().to_ascii_lowercase();
    if seen.insert(key) {
      roots.push(path);
    }
  };

  if let Some(system_drive) = env::var_os("SystemDrive") {
    push_root(PathBuf::from(system_drive).join("XboxGames"));
  }

  push_root(PathBuf::from(r"C:\XboxGames"));

  for letter in b'D'..=b'Z' {
    push_root(PathBuf::from(format!("{}:\\XboxGames", letter as char)));
  }

  roots
}

#[cfg(not(target_os = "windows"))]
fn xbox_games_roots() -> Vec<PathBuf> {
  Vec::new()
}

#[cfg(target_os = "windows")]
fn parse_appx_game_records(raw: &str) -> Vec<AppxGameRecord> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Vec::new();
  }

  if trimmed.starts_with('[') {
    return serde_json::from_str(trimmed).unwrap_or_default();
  }

  serde_json::from_str(&format!("[{trimmed}]")).unwrap_or_default()
}

#[cfg(not(target_os = "windows"))]
fn parse_appx_game_records(_raw: &str) -> Vec<AppxGameRecord> {
  Vec::new()
}

#[cfg(target_os = "windows")]
pub(crate) fn scan_appx_gaming_packages() -> Vec<AppxGameRecord> {
  let script = r#"
$ErrorActionPreference='SilentlyContinue'
$results = New-Object System.Collections.Generic.List[object]
$knownMsGamePattern = '(?i)(Microsoft\.MicrosoftMinesweeper|Microsoft\.MicrosoftSolitaireCollection|Microsoft\.MicrosoftMahjong|Microsoft\.MicrosoftSudoku|Microsoft\.MicrosoftJigsaw|Microsoft\.MicrosoftTreasureHunt|Microsoft\.Wordament|Minesweeper|Solitaire|Mahjong|Sudoku|Jigsaw|TreasureHunt|Wordament)'
Get-AppxPackage | Where-Object { $_.IsFramework -eq $false -and $_.InstallLocation } | ForEach-Object {
  $pkg = $_
  $name = [string]$pkg.Name
  if ($name -match '^(Microsoft\.GamingApp|Microsoft\.Xbox|Microsoft\.Apollo|Microsoft\.Edge\.GameAssist)') { return }
  try {
    $manifest = Get-AppxPackageManifest -Package $pkg.PackageFullName
    if ($null -eq $manifest) { return }
    $category = [string]$manifest.Package.Properties.Category
    $categoryLower = $category.ToLower()
    $isGameCategory = $categoryLower -eq 'games' -or $categoryLower -eq 'game'
    $isKnownMsGame = $name -match $knownMsGamePattern
    if (-not ($isGameCategory -or $isKnownMsGame)) { return }
    $install = [string]$pkg.InstallLocation
    if ($install -match '(?i)(\\steamapps\\|\\Epic Games\\|\\Origin Games\\|\\EA Games\\|\\Riot Games\\)') { return }
    $displayName = [string]$manifest.Package.Properties.DisplayName
    if ([string]::IsNullOrWhiteSpace($displayName)) { $displayName = $name }
    $pfn = [string]$pkg.PackageFamilyName
    $applications = @($manifest.Package.Applications.Application)
    foreach ($app in $applications) {
      if ($null -eq $app) { continue }
      $appId = [string]$app.Id
      if ([string]::IsNullOrWhiteSpace($appId)) { continue }
      $executable = [string]$app.Executable
      $entryPoint = [string]$app.EntryPoint
      if ([string]::IsNullOrWhiteSpace($executable) -and $entryPoint -notlike '*Application*') { continue }
      $results.Add([PSCustomObject]@{
        title = $displayName
        aumid = ($pfn + '!' + $appId)
        installLocation = $install
      })
      break
    }
  } catch {}
}
$results | ConvertTo-Json -Compress
"#;

  let output = crate::utils::windows_process::run_hidden_powershell(script);

  let Ok(output) = output else {
    return Vec::new();
  };

  if !output.status.success() {
    return Vec::new();
  }

  let Ok(raw) = String::from_utf8(output.stdout) else {
    return Vec::new();
  };

  parse_appx_game_records(&raw)
}

#[cfg(not(target_os = "windows"))]
fn scan_appx_gaming_packages() -> Vec<AppxGameRecord> {
  Vec::new()
}

fn normalize_xbox_dedupe_key(value: &str) -> String {
  value.trim().to_ascii_lowercase()
}

fn should_skip_xbox_folder_name(name: &str) -> bool {
  let lowered = name.trim().to_ascii_lowercase();
  lowered.is_empty()
    || lowered == "minecraft launcher"
    || lowered == "content"
    || lowered == "temp"
}

#[cfg(target_os = "windows")]
fn find_xbox_content_executable(content_dir: &Path) -> Option<PathBuf> {
  let Ok(entries) = fs::read_dir(content_dir) else {
    return None;
  };

  let mut candidates: Vec<PathBuf> = Vec::new();
  for entry in entries.flatten() {
    let path = entry.path();
    if path
      .extension()
      .and_then(|value| value.to_str())
      .is_some_and(|value| value.eq_ignore_ascii_case("exe"))
    {
      candidates.push(path);
    }
  }

  candidates.sort_by_key(|path| {
    std::cmp::Reverse(path.metadata().map(|meta| meta.len()).unwrap_or(0))
  });

  candidates.into_iter().find(|path| path.is_file())
}

#[cfg(not(target_os = "windows"))]
fn find_xbox_content_executable(_content_dir: &Path) -> Option<PathBuf> {
  None
}

#[cfg(target_os = "windows")]
fn scan_xbox_games_folder(seen_install_paths: &HashSet<String>) -> Vec<ImportedGame> {
  let mut imports: Vec<ImportedGame> = Vec::new();
  let mut seen_targets: HashSet<String> = HashSet::new();

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
        .to_string();

      if should_skip_xbox_folder_name(&folder_name) {
        continue;
      }

      let install_key = normalize_xbox_dedupe_key(&path.to_string_lossy());
      if seen_install_paths.contains(&install_key) {
        continue;
      }

      let content_dir = path.join("Content");
      if !content_dir.is_dir() {
        continue;
      }

      let Some(executable) = find_xbox_content_executable(&content_dir) else {
        continue;
      };

      let executable_text = executable.to_string_lossy().to_string();
      if is_non_xbox_install_path(&executable_text) {
        continue;
      }

      let target_key = normalize_xbox_dedupe_key(&executable_text);
      if !seen_targets.insert(target_key) {
        continue;
      }

      imports.push(ImportedGame {
        title: folder_name,
        kind: "executable".to_string(),
        target: executable_text,
        args: xbox_managed_args(),
        emulator_key: None,
        manual_system_key: None,
      });
    }
  }

  imports
}

#[cfg(not(target_os = "windows"))]
fn scan_xbox_games_folder(_seen_install_paths: &HashSet<String>) -> Vec<ImportedGame> {
  Vec::new()
}

pub(crate) fn scan_xbox_games() -> Vec<ImportedGame> {
  let mut imports: Vec<ImportedGame> = Vec::new();
  let mut seen_aumids: HashSet<String> = HashSet::new();
  let mut seen_install_paths: HashSet<String> = HashSet::new();
  let mut seen_titles: HashSet<String> = HashSet::new();

  for record in scan_appx_gaming_packages() {
    let title = record.title.trim().to_string();
    let aumid = record.aumid.trim().to_string();
    let install_location = record.install_location.trim().to_string();

    if title.is_empty() || aumid.is_empty() {
      continue;
    }

    if is_non_xbox_install_path(&install_location) {
      continue;
    }

    if !install_location.is_empty() {
      let install_path = PathBuf::from(&install_location);
      if !install_path.exists() {
        continue;
      }

      seen_install_paths.insert(normalize_xbox_dedupe_key(&install_location));
    }

    let aumid_key = normalize_xbox_dedupe_key(&aumid);
    if !seen_aumids.insert(aumid_key) {
      continue;
    }

    let title_key = normalize_xbox_dedupe_key(&title);
    if !seen_titles.insert(title_key) {
      continue;
    }

    imports.push(ImportedGame {
      title,
      kind: "xbox".to_string(),
      target: aumid,
      args: xbox_managed_args(),
      emulator_key: None,
      manual_system_key: None,
    });
  }

  imports.extend(scan_xbox_games_folder(&seen_install_paths));
  imports
}
