use crate::launcher::launcher_manager::{launch_executable, open_shell_app, open_uri};
use crate::scanners::windows_special_scanner::{
  battle_net_launcher_path,
  ea_app_path,
  epic_launcher_path,
  minecraft_launcher_exists,
  minecraft_launcher_path,
  minecraft_launcher_uri_launchable,
  minecraft_uri_launchable,
  riot_client_path,
  roblox_version_executable,
  ubisoft_connect_path,
};
use std::collections::{hash_map::DefaultHasher, BTreeMap};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

fn launch_error(code: &str, message: impl AsRef<str>) -> String {
  format!("[{code}] {}", message.as_ref())
}

fn process_outcome(pid: u32) -> crate::LaunchOutcome {
  crate::LaunchOutcome {
    attempted: true,
    mode: "process".to_string(),
    pid: Some(pid),
  }
}

fn uri_outcome() -> crate::LaunchOutcome {
  crate::LaunchOutcome {
    attempted: true,
    mode: "uri".to_string(),
    pid: None,
  }
}

fn shell_outcome() -> crate::LaunchOutcome {
  crate::LaunchOutcome {
    attempted: true,
    mode: "shell".to_string(),
    pid: None,
  }
}

const MINECRAFT_LAUNCHER_SHELL_IDS: &[&str] = &[
  "shell:AppsFolder\\Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft",
  "shell:AppsFolder\\Microsoft.4297127D64EC6_8wekyb3d8bbwe!App",
];

const MINECRAFT_BEDROCK_SHELL_IDS: &[&str] = &[
  "shell:AppsFolder\\Microsoft.MinecraftUWP_8wekyb3d8bbwe!App",
  "shell:AppsFolder\\Microsoft.MinecraftUWP_8wekyb3d8bbwe!Minecraft",
];

const MINECRAFT_JAVA_URI_CANDIDATES: &[&str] = &[
  "minecraft-launcher://launcher/?tab=java",
  "minecraft-launcher://launcher/java",
  "minecraft-launcher://?tab=java",
  "minecraft-launcher://",
];

fn try_open_uri_candidates(candidates: &[&str]) -> Result<crate::LaunchOutcome, String> {
  let mut last_error: Option<String> = None;

  for candidate in candidates {
    match open_uri(candidate) {
      Ok(_) => return Ok(uri_outcome()),
      Err(error) => last_error = Some(error),
    }
  }

  Err(last_error.unwrap_or_else(|| {
    launch_error("URI_OPEN_FAILED", "No URI launch candidates succeeded.")
  }))
}

fn try_open_shell_candidates(candidates: &[&str]) -> Result<crate::LaunchOutcome, String> {
  let mut last_error: Option<String> = None;

  for candidate in candidates {
    match open_shell_app(candidate) {
      Ok(_) => return Ok(shell_outcome()),
      Err(error) => last_error = Some(error),
    }
  }

  Err(last_error.unwrap_or_else(|| {
    launch_error("SHELL_OPEN_FAILED", "No shell launch candidates succeeded.")
  }))
}

fn launch_minecraft_launcher_target() -> Result<crate::LaunchOutcome, String> {
  if let Some(path) = minecraft_launcher_path() {
    if let Ok(pid) = launch_executable(&path.to_string_lossy(), &[]) {
      return Ok(process_outcome(pid));
    }
  }

  if let Ok(outcome) = try_open_shell_candidates(MINECRAFT_LAUNCHER_SHELL_IDS) {
    return Ok(outcome);
  }

  if minecraft_launcher_uri_launchable() {
    if let Ok(outcome) = try_open_uri_candidates(&["minecraft-launcher://"]) {
      return Ok(outcome);
    }
  }

  Err(launch_error(
    "MINECRAFT_LAUNCHER_NOT_FOUND",
    "Could not find a working Minecraft Launcher target.",
  ))
}

fn launch_minecraft_java_target() -> Result<crate::LaunchOutcome, String> {
  if minecraft_launcher_uri_launchable() {
    if let Ok(outcome) = try_open_uri_candidates(MINECRAFT_JAVA_URI_CANDIDATES) {
      return Ok(outcome);
    }
  }

  if let Some(path) = minecraft_launcher_path() {
    for uri in MINECRAFT_JAVA_URI_CANDIDATES {
      let args = vec![uri.to_string()];
      if let Ok(pid) = launch_executable(&path.to_string_lossy(), &args) {
        return Ok(process_outcome(pid));
      }
    }

    if let Ok(pid) = launch_executable(&path.to_string_lossy(), &[]) {
      return Ok(process_outcome(pid));
    }
  }

  if let Ok(outcome) = try_open_shell_candidates(MINECRAFT_LAUNCHER_SHELL_IDS) {
    return Ok(outcome);
  }

  if minecraft_launcher_exists() {
    return launch_minecraft_launcher_target();
  }

  Err(launch_error(
    "MINECRAFT_JAVA_NOT_FOUND",
    "Could not locate a working Minecraft Java launcher path or shell target.",
  ))
}

fn launch_minecraft_bedrock_target() -> Result<crate::LaunchOutcome, String> {
  if minecraft_uri_launchable() {
    if let Ok(outcome) = try_open_uri_candidates(&["minecraft://"]) {
      return Ok(outcome);
    }
  }

  if let Ok(outcome) = try_open_shell_candidates(MINECRAFT_BEDROCK_SHELL_IDS) {
    return Ok(outcome);
  }

  if let Ok(outcome) = try_open_shell_candidates(MINECRAFT_LAUNCHER_SHELL_IDS) {
    return Ok(outcome);
  }

  Err(launch_error(
    "MINECRAFT_BEDROCK_NOT_FOUND",
    "Could not find a working Minecraft for Windows launch target.",
  ))
}

#[derive(Debug, Default)]
struct EmulatorLaunchContext {
  profile: Option<String>,
  core: Option<String>,
  controller_layout: Option<String>,
  controller_map: Option<String>,
  peripherals: BTreeMap<String, String>,
  rom_path: Option<String>,
  passthrough: Vec<String>,
}

const TM_CONTROLLER_ACTIONS: &[&str] = &[
  "navigate_up",
  "navigate_down",
  "navigate_left",
  "navigate_right",
  "confirm",
  "back",
  "open_settings",
  "toggle_view",
  "jump_top",
  "jump_bottom",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RetroArchBindingKind {
  Button,
  Axis,
}

fn default_tm_input_for_action(layout: Option<&str>, action: &str) -> &'static str {
  let is_nintendo = layout.map(|value| value.trim().eq_ignore_ascii_case("nintendo")).unwrap_or(false);

  match action {
    "navigate_up" => "dpad_up",
    "navigate_down" => "dpad_down",
    "navigate_left" => "dpad_left",
    "navigate_right" => "dpad_right",
    "confirm" => {
      if is_nintendo {
        "face_east"
      } else {
        "face_south"
      }
    }
    "back" => {
      if is_nintendo {
        "face_south"
      } else {
        "face_east"
      }
    }
    "open_settings" => "start",
    "toggle_view" => "face_north",
    "jump_top" => "left_shoulder",
    "jump_bottom" => "right_shoulder",
    _ => "unbound",
  }
}

fn parse_tm_controller_map(serialized: &str, layout: Option<&str>) -> BTreeMap<String, String> {
  let mut parsed: BTreeMap<String, String> = BTreeMap::new();

  for pair in serialized.split(',') {
    let trimmed = pair.trim();
    if trimmed.is_empty() {
      continue;
    }

    let mut parts = trimmed.splitn(2, ':');
    let action = parts.next().unwrap_or_default().trim().to_lowercase();
    let input = parts.next().unwrap_or_default().trim().to_lowercase();
    if action.is_empty() || input.is_empty() {
      continue;
    }

    parsed.insert(action, input);
  }

  for action in TM_CONTROLLER_ACTIONS {
    parsed
      .entry((*action).to_string())
      .or_insert_with(|| default_tm_input_for_action(layout, action).to_string());
  }

  parsed
}

fn retroarch_binding_for_input(input: &str) -> Option<(RetroArchBindingKind, &'static str)> {
  match input {
    "dpad_up" => Some((RetroArchBindingKind::Button, "12")),
    "dpad_down" => Some((RetroArchBindingKind::Button, "13")),
    "dpad_left" => Some((RetroArchBindingKind::Button, "14")),
    "dpad_right" => Some((RetroArchBindingKind::Button, "15")),
    "left_stick_up" => Some((RetroArchBindingKind::Axis, "-1")),
    "left_stick_down" => Some((RetroArchBindingKind::Axis, "+1")),
    "left_stick_left" => Some((RetroArchBindingKind::Axis, "-0")),
    "left_stick_right" => Some((RetroArchBindingKind::Axis, "+0")),
    "right_stick_up" => Some((RetroArchBindingKind::Axis, "-3")),
    "right_stick_down" => Some((RetroArchBindingKind::Axis, "+3")),
    "right_stick_left" => Some((RetroArchBindingKind::Axis, "-2")),
    "right_stick_right" => Some((RetroArchBindingKind::Axis, "+2")),
    "face_south" => Some((RetroArchBindingKind::Button, "0")),
    "face_east" => Some((RetroArchBindingKind::Button, "1")),
    "face_west" => Some((RetroArchBindingKind::Button, "2")),
    "face_north" => Some((RetroArchBindingKind::Button, "3")),
    "left_shoulder" => Some((RetroArchBindingKind::Button, "4")),
    "right_shoulder" => Some((RetroArchBindingKind::Button, "5")),
    "left_trigger" => Some((RetroArchBindingKind::Button, "6")),
    "right_trigger" => Some((RetroArchBindingKind::Button, "7")),
    "select" => Some((RetroArchBindingKind::Button, "8")),
    "start" => Some((RetroArchBindingKind::Button, "9")),
    "left_stick_press" => Some((RetroArchBindingKind::Button, "10")),
    "right_stick_press" => Some((RetroArchBindingKind::Button, "11")),
    _ => None,
  }
}

fn retroarch_button_value_for_input(input: &str) -> Option<&'static str> {
  match retroarch_binding_for_input(input) {
    Some((RetroArchBindingKind::Button, value)) => Some(value),
    _ => None,
  }
}

fn append_retroarch_player_binding(lines: &mut Vec<String>, key_prefix: &str, tm_input: &str) {
  match retroarch_binding_for_input(tm_input) {
    Some((RetroArchBindingKind::Button, value)) => {
      lines.push(format!("{key_prefix}_btn = \"{value}\""));
      lines.push(format!("{key_prefix}_axis = \"nul\""));
    }
    Some((RetroArchBindingKind::Axis, value)) => {
      lines.push(format!("{key_prefix}_axis = \"{value}\""));
      lines.push(format!("{key_prefix}_btn = \"nul\""));
    }
    None => {
      lines.push(format!("{key_prefix}_btn = \"nul\""));
      lines.push(format!("{key_prefix}_axis = \"nul\""));
    }
  }
}

fn append_retroarch_menu_binding(lines: &mut Vec<String>, key_prefix: &str, tm_input: &str) {
  let button_value = retroarch_button_value_for_input(tm_input).unwrap_or("nul");
  lines.push(format!("{key_prefix}_btn = \"{button_value}\""));
}

fn sanitize_path_component(value: &str) -> String {
  let mut sanitized = String::with_capacity(value.len());

  for character in value.chars() {
    if character.is_ascii_alphanumeric() {
      sanitized.push(character.to_ascii_lowercase());
      continue;
    }

    if matches!(character, '-' | '_') {
      sanitized.push(character);
      continue;
    }

    sanitized.push('-');
  }

  let cleaned = sanitized.trim_matches('-').to_string();
  if cleaned.is_empty() {
    "default".to_string()
  } else {
    cleaned
  }
}

fn retroarch_tm_config_hash(
  target: &str,
  rom_path: &str,
  layout: Option<&str>,
  bindings: &BTreeMap<String, String>,
  peripherals: &BTreeMap<String, String>,
) -> u64 {
  let mut hasher = DefaultHasher::new();
  target.hash(&mut hasher);
  rom_path.hash(&mut hasher);
  layout.unwrap_or_default().hash(&mut hasher);

  for (action, input) in bindings {
    action.hash(&mut hasher);
    input.hash(&mut hasher);
  }

  for (peripheral_id, value) in peripherals {
    peripheral_id.hash(&mut hasher);
    value.hash(&mut hasher);
  }

  hasher.finish()
}

fn append_retroarch_peripheral_options(lines: &mut Vec<String>, peripherals: &BTreeMap<String, String>) {
  if let Some(pak) = peripherals.get("n64_pak") {
    let normalized = pak.trim().to_lowercase();
    let value = match normalized.as_str() {
      "none" => "none",
      "controller" => "memory",
      "rumble" => "rumble",
      _ => return,
    };
    lines.push(format!("mupen64plus-pak1 = \"{value}\""));
  }
}

fn dolphin_extension_config_value(extension: &str) -> Option<&'static str> {
  match extension.trim().to_lowercase().as_str() {
    "none" => Some("None"),
    "nunchuk" => Some("Nunchuk"),
    "classic" => Some("Classic"),
    _ => None,
  }
}

fn append_dolphin_peripheral_args(launch_args: &mut Vec<String>, peripherals: &BTreeMap<String, String>) {
  let Some(extension) = peripherals.get("wii_extension") else {
    return;
  };

  let Some(extension_value) = dolphin_extension_config_value(extension) else {
    return;
  };

  // Dolphin's CLI config system name for WiiPad is "Wiimote" (see Config.cpp system_to_name).
  launch_args.push("-C".to_string());
  launch_args.push(format!("Wiimote.Wiimote1.Extension={extension_value}"));

  if extension.trim().eq_ignore_ascii_case("none") {
    launch_args.push("-C".to_string());
    launch_args.push("Wiimote.Wiimote1.Extension/Attach MotionPlus=False".to_string());
  }
}

fn write_retroarch_tm_input_config(
  target: &str,
  context: &EmulatorLaunchContext,
  rom_path: &str,
) -> Result<Option<String>, String> {
  let serialized_map = context.controller_map.as_deref().map(str::trim).unwrap_or_default();
  let has_controller_map = !serialized_map.is_empty();
  let has_peripheral_options = context.peripherals.contains_key("n64_pak");

  if !has_controller_map && !has_peripheral_options {
    return Ok(None);
  }

  let layout = context.controller_layout.as_deref();
  let bindings = if has_controller_map {
    parse_tm_controller_map(serialized_map, layout)
  } else {
    BTreeMap::new()
  };

  let mut lines = vec![
    "# Auto-generated by Tile Manager for RetroArch controller translation.".to_string(),
    "# This file may be overwritten by subsequent launches.".to_string(),
  ];

  if let Some(layout_name) = layout {
    lines.push(format!("# tm-controller-layout={layout_name}"));
  }

  if has_controller_map {
    let input_for = |action: &str| -> &str {
      bindings
        .get(action)
        .map(|value| value.as_str())
        .unwrap_or_else(|| default_tm_input_for_action(layout, action))
    };

    append_retroarch_player_binding(&mut lines, "input_player1_up", input_for("navigate_up"));
    append_retroarch_player_binding(&mut lines, "input_player1_down", input_for("navigate_down"));
    append_retroarch_player_binding(&mut lines, "input_player1_left", input_for("navigate_left"));
    append_retroarch_player_binding(&mut lines, "input_player1_right", input_for("navigate_right"));
    append_retroarch_player_binding(&mut lines, "input_player1_a", input_for("confirm"));
    append_retroarch_player_binding(&mut lines, "input_player1_b", input_for("back"));
    append_retroarch_player_binding(&mut lines, "input_player1_x", input_for("toggle_view"));
    append_retroarch_player_binding(&mut lines, "input_player1_start", input_for("open_settings"));
    append_retroarch_player_binding(&mut lines, "input_player1_l", input_for("jump_top"));
    append_retroarch_player_binding(&mut lines, "input_player1_r", input_for("jump_bottom"));

    append_retroarch_menu_binding(&mut lines, "input_menu_ok", input_for("confirm"));
    append_retroarch_menu_binding(&mut lines, "input_menu_cancel", input_for("back"));
    append_retroarch_menu_binding(&mut lines, "input_menu_toggle", input_for("open_settings"));
  }

  append_retroarch_peripheral_options(&mut lines, &context.peripherals);

  let mut content = lines.join("\n");
  content.push('\n');

  let profile_component = sanitize_path_component(context.profile.as_deref().unwrap_or("retroarch"));
  let fingerprint = retroarch_tm_config_hash(target, rom_path, layout, &bindings, &context.peripherals);
  let output_dir = std::env::temp_dir().join("tile-manager").join("retroarch");
  fs::create_dir_all(&output_dir).map_err(|error| {
    launch_error(
      "RETROARCH_CONFIG_WRITE_FAILED",
      format!("Failed to create RetroArch translation directory: {error}"),
    )
  })?;

  let output_path: PathBuf = output_dir.join(format!("tm-input-{profile_component}-{fingerprint:016x}.cfg"));
  fs::write(&output_path, content).map_err(|error| {
    launch_error(
      "RETROARCH_CONFIG_WRITE_FAILED",
      format!("Failed to write RetroArch translation config: {error}"),
    )
  })?;

  Ok(Some(output_path.to_string_lossy().to_string()))
}

fn parse_emulator_launch_args(args: &[String]) -> EmulatorLaunchContext {
  let mut context = EmulatorLaunchContext::default();

  for raw in args {
    let value = raw.trim();
    if value.is_empty() {
      continue;
    }

    if let Some(profile) = value.strip_prefix("--tm-profile=") {
      context.profile = Some(profile.trim().to_lowercase());
      continue;
    }

    if let Some(core) = value.strip_prefix("--tm-core=") {
      let trimmed_core = core.trim();
      if !trimmed_core.is_empty() {
        context.core = Some(trimmed_core.to_string());
      }
      continue;
    }

    if let Some(layout) = value.strip_prefix("--tm-controller-layout=") {
      let trimmed_layout = layout.trim();
      if !trimmed_layout.is_empty() {
        context.controller_layout = Some(trimmed_layout.to_lowercase());
      }
      continue;
    }

    if let Some(serialized_map) = value.strip_prefix("--tm-controller-map=") {
      let trimmed_map = serialized_map.trim();
      if !trimmed_map.is_empty() {
        context.controller_map = Some(trimmed_map.to_string());
      }
      continue;
    }

    if let Some(serialized_peripheral) = value.strip_prefix("--tm-peripheral=") {
      let trimmed = serialized_peripheral.trim();
      if trimmed.is_empty() {
        continue;
      }

      let mut parts = trimmed.splitn(2, ':');
      let peripheral_id = parts.next().unwrap_or_default().trim().to_lowercase();
      let peripheral_value = parts.next().unwrap_or_default().trim().to_lowercase();
      if !peripheral_id.is_empty() && !peripheral_value.is_empty() {
        context.peripherals.insert(peripheral_id, peripheral_value);
      }
      continue;
    }

    if value.starts_with("--tm-") {
      continue;
    }

    if context.rom_path.is_none() {
      context.rom_path = Some(value.to_string());
      continue;
    }

    context.passthrough.push(value.to_string());
  }

  context
}

fn dreamcast_path_hint(path: &str) -> bool {
  let lowered = path.trim().to_lowercase();
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

fn resolve_dreamcast_descriptor_path(rom_path: &str) -> Option<String> {
  let source_path = Path::new(rom_path);
  let extension = source_path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_lowercase())?;
  if extension != "bin" {
    return None;
  }

  let parent = source_path.parent()?;
  let source_stem = source_path
    .file_stem()
    .and_then(|value| value.to_str())
    .unwrap_or_default();
  let source_prefix = dreamcast_disc_prefix(source_stem);

  let mut candidates: Vec<(i32, String)> = Vec::new();
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

    let candidate_stem = path
      .file_stem()
      .and_then(|value| value.to_str())
      .unwrap_or_default();
    let candidate_prefix = dreamcast_disc_prefix(candidate_stem);

    let mut score = base_priority;
    if !source_prefix.is_empty() && source_prefix == candidate_prefix {
      score += 1000;
    }

    candidates.push((score, path.to_string_lossy().to_string()));
  }

  candidates
    .into_iter()
    .max_by_key(|(score, _)| *score)
    .map(|(_, path)| path)
}

fn resolve_emulator_rom_path(context: &EmulatorLaunchContext) -> Result<String, String> {
  let original = context
    .rom_path
    .as_ref()
    .ok_or_else(|| launch_error("INVALID_EMULATOR_ARGS", "Emulator launch requires a ROM path argument."))?
    .trim()
    .to_string();

  let profile = context.profile.as_deref().unwrap_or_default();
  let is_dreamcast_profile = profile == "dreamcast" || (profile == "retroarch" && dreamcast_path_hint(&original));
  if !is_dreamcast_profile {
    return Ok(original);
  }

  if let Some(resolved) = resolve_dreamcast_descriptor_path(&original) {
    return Ok(resolved);
  }

  Ok(original)
}

fn build_emulator_args(
  target: &str,
  context: &EmulatorLaunchContext,
  rom_path: &str,
) -> Result<Vec<String>, String> {
  let rom = rom_path.to_string();

  let executable_name = Path::new(target)
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or_default()
    .to_lowercase();

  let mut launch_args: Vec<String> = Vec::new();

  if executable_name.contains("dolphin") {
    launch_args.push("-b".to_string());
    append_dolphin_peripheral_args(&mut launch_args, &context.peripherals);
    launch_args.push("-e".to_string());
    launch_args.push(rom);
  } else if executable_name.contains("cemu") {
    launch_args.push("-g".to_string());
    launch_args.push(rom);
  } else if executable_name.contains("retroarch") {
    if let Some(core) = &context.core {
      launch_args.push("-L".to_string());
      launch_args.push(core.to_string());
    }

    if let Some(append_config_path) = write_retroarch_tm_input_config(target, context, &rom)? {
      launch_args.push("--appendconfig".to_string());
      launch_args.push(append_config_path);
    }

    launch_args.push(rom);
  } else {
    launch_args.push(rom);
  }

  launch_args.extend(context.passthrough.iter().cloned());
  Ok(launch_args)
}

fn launch_riot_product(product: &str) -> Result<crate::LaunchOutcome, String> {
  if let Some(path) = riot_client_path() {
    let args = vec![
      format!("--launch-product={product}"),
      "--launch-patchline=live".to_string(),
    ];

    return launch_executable(&path.to_string_lossy(), &args).map(process_outcome);
  }

  open_uri("riotclient://").map(|_| uri_outcome())
}

fn launch_special_target(target: &str) -> Option<Result<crate::LaunchOutcome, String>> {
  match target {
    "__eden_emulator_missing__" => Some(Err(launch_error(
      "MISSING_EMULATOR",
      "Eden is not configured. Set the Eden emulator path in Settings > Emulator Paths.",
    ))),
    "__3ds_emulator_missing__" => Some(Err(launch_error(
      "MISSING_EMULATOR",
      "Nintendo 3DS emulator is not configured. Set Azahar or Citra in Settings > Emulator Paths.",
    ))),
    "__ds_emulator_missing__" => Some(Err(launch_error(
      "MISSING_EMULATOR",
      "Nintendo DS emulator is not configured. Set melonDS or DeSmuME in Settings > Emulator Paths.",
    ))),
    "__switch_emulator_missing__" => Some(Err(launch_error(
      "MISSING_EMULATOR",
      "Nintendo Switch launch is not configured. Set the Eden emulator path in Settings > Emulator Paths.",
    ))),
    "__minecraft_launcher__" => Some(launch_minecraft_launcher_target()),
    "__minecraft_java__" => Some(launch_minecraft_java_target()),
    "__minecraft_bedrock__" => Some(launch_minecraft_bedrock_target()),
    "__roblox_player__" => {
      if let Some(path) = roblox_version_executable("RobloxPlayerBeta.exe") {
        return Some(launch_executable(&path.to_string_lossy(), &[]).map(process_outcome));
      }

      Some(open_uri("roblox://").map(|_| uri_outcome()))
    }
    "__roblox_studio__" => {
      if let Some(path) = roblox_version_executable("RobloxStudioBeta.exe") {
        return Some(launch_executable(&path.to_string_lossy(), &[]).map(process_outcome));
      }

      Some(open_uri("roblox-studio://").map(|_| uri_outcome()))
    }
    "__battle_net__" => {
      if let Some(path) = battle_net_launcher_path() {
        return Some(launch_executable(&path.to_string_lossy(), &[]).map(process_outcome));
      }

      Some(open_uri("battlenet://").map(|_| uri_outcome()))
    }
    "__epic_launcher__" => {
      if let Some(path) = epic_launcher_path() {
        return Some(launch_executable(&path.to_string_lossy(), &[]).map(process_outcome));
      }

      Some(open_uri("com.epicgames.launcher://apps").map(|_| uri_outcome()))
    }
    "__ea_app__" => {
      if let Some(path) = ea_app_path() {
        return Some(launch_executable(&path.to_string_lossy(), &[]).map(process_outcome));
      }

      Some(open_uri("origin2://").map(|_| uri_outcome()))
    }
    "__ubisoft_connect__" => {
      if let Some(path) = ubisoft_connect_path() {
        return Some(launch_executable(&path.to_string_lossy(), &[]).map(process_outcome));
      }

      Some(open_uri("uplay://").map(|_| uri_outcome()))
    }
    "__xbox_app__" => Some(open_shell_app("shell:AppsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!App").map(|_| shell_outcome())),
    "__riot_client__" => {
      if let Some(path) = riot_client_path() {
        return Some(launch_executable(&path.to_string_lossy(), &[]).map(process_outcome));
      }

      Some(open_uri("riotclient://").map(|_| uri_outcome()))
    }
    "__riot_valorant__" => Some(launch_riot_product("valorant")),
    "__riot_league__" => Some(launch_riot_product("league_of_legends")),
    _ => None,
  }
}

pub(crate) fn launch_game_impl(request: crate::LaunchRequest) -> Result<crate::LaunchOutcome, String> {
  let kind = request.kind.trim().to_lowercase();
  let target = request.target.trim();

  if target.is_empty() {
    return Err(launch_error("INVALID_TARGET", "Target cannot be empty"));
  }

  if let Some(result) = launch_special_target(target) {
    return result;
  }

  let args = request.args.unwrap_or_default();
  let emulator_context = if kind == "emulator" {
    Some(parse_emulator_launch_args(&args))
  } else {
    None
  };

  if let Some(context) = &emulator_context {
    let rom_path = resolve_emulator_rom_path(context)?;
    let rom_path = rom_path.trim();
    if rom_path.is_empty() {
      return Err(launch_error(
        "INVALID_EMULATOR_ARGS",
        "ROM path argument is empty.",
      ));
    }

    let rom_file = Path::new(rom_path);
    if !rom_file.exists() {
      return Err(launch_error(
        "MISSING_ROM",
        format!("ROM file was not found: {rom_path}"),
      ));
    }

    if !rom_file.is_file() {
      return Err(launch_error(
        "MISSING_ROM",
        format!("ROM path is not a file: {rom_path}"),
      ));
    }
  }

  match kind.as_str() {
    "steam" => {
      let uri = if target.starts_with("steam://") {
        target.to_string()
      } else {
        format!("steam://rungameid/{target}")
      };

      open_uri(&uri).map(|_| uri_outcome())
    }
    "epic" => {
      let uri = if target.starts_with("com.epicgames.launcher://") {
        target.to_string()
      } else {
        let encoded_target: String = url::form_urlencoded::byte_serialize(target.as_bytes()).collect();
        format!("com.epicgames.launcher://apps/{encoded_target}?action=launch")
      };

      open_uri(&uri).map(|_| uri_outcome())
    }
    "battle_net" => {
      if target.starts_with("battlenet://") {
        open_uri(target).map(|_| uri_outcome())
      } else if target.ends_with(".exe") || target.contains('\\') || target.contains('/') {
        launch_executable(target, &args).map(process_outcome)
      } else {
        open_uri(&format!("battlenet://{target}")).map(|_| uri_outcome())
      }
    }
    "xbox" => {
      let shell_id = if target.starts_with("shell:AppsFolder\\") {
        target.to_string()
      } else {
        format!("shell:AppsFolder\\{target}")
      };

      open_shell_app(&shell_id).map(|_| shell_outcome())
    }
    "uri" => {
      let normalized_target = target.trim().to_lowercase();
      if normalized_target.starts_with("minecraft://") {
        launch_minecraft_bedrock_target()
      } else if normalized_target.starts_with("minecraft-launcher://") {
        launch_minecraft_java_target()
      } else {
        open_uri(target).map(|_| uri_outcome())
      }
    }
    "executable" => launch_executable(target, &args).map(process_outcome),
    "emulator" => {
      let context = emulator_context.ok_or_else(|| {
        launch_error("INVALID_EMULATOR_ARGS", "Emulator launch context is missing.")
      })?;
      let resolved_rom_path = resolve_emulator_rom_path(&context)?;
      let launch_args = build_emulator_args(target, &context, &resolved_rom_path)?;
      launch_executable(target, &launch_args).map(process_outcome)
    }
    _ => Err(launch_error(
      "UNSUPPORTED_KIND",
      format!("Unsupported launcher kind: {kind}"),
    )),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_tm_controller_map_applies_nintendo_defaults() {
    let bindings = parse_tm_controller_map("navigate_up:dpad_up", Some("nintendo"));

    assert_eq!(bindings.get("navigate_up").map(String::as_str), Some("dpad_up"));
    assert_eq!(bindings.get("confirm").map(String::as_str), Some("face_east"));
    assert_eq!(bindings.get("back").map(String::as_str), Some("face_south"));
  }

  #[test]
  fn retroarch_binding_translation_supports_stick_axis_and_buttons() {
    assert_eq!(retroarch_binding_for_input("left_stick_up"), Some((RetroArchBindingKind::Axis, "-1")));
    assert_eq!(retroarch_binding_for_input("face_east"), Some((RetroArchBindingKind::Button, "1")));
    assert_eq!(retroarch_button_value_for_input("left_stick_up"), None);
    assert_eq!(retroarch_button_value_for_input("face_south"), Some("0"));
  }

  #[test]
  fn retroarch_config_writes_expected_translated_bindings() {
    let context = EmulatorLaunchContext {
      profile: Some("retroarch".to_string()),
      core: None,
      controller_layout: Some("nintendo".to_string()),
      controller_map: Some(
        "navigate_up:left_stick_up,navigate_down:dpad_down,navigate_left:dpad_left,navigate_right:dpad_right,confirm:face_east,back:face_south,open_settings:start,toggle_view:face_north,jump_top:left_shoulder,jump_bottom:right_shoulder".to_string(),
      ),
      peripherals: BTreeMap::new(),
      rom_path: None,
      passthrough: Vec::new(),
    };

    let output = write_retroarch_tm_input_config("retroarch.exe", &context, "C:/roms/test.nes")
      .expect("retroarch config generation should succeed")
      .expect("retroarch config path should be returned");

    let content = std::fs::read_to_string(&output).expect("generated config should be readable");

    assert!(content.contains("input_player1_up_axis = \"-1\""));
    assert!(content.contains("input_player1_a_btn = \"1\""));
    assert!(content.contains("input_player1_b_btn = \"0\""));
    assert!(content.contains("input_menu_ok_btn = \"1\""));
    assert!(content.contains("input_menu_cancel_btn = \"0\""));

    let _ = std::fs::remove_file(output);
  }

  #[test]
  fn dolphin_launch_args_force_no_extension_when_wii_extension_is_none() {
    let mut peripherals = BTreeMap::new();
    peripherals.insert("wii_extension".to_string(), "none".to_string());
    let context = EmulatorLaunchContext {
      profile: Some("dolphin".to_string()),
      core: None,
      controller_layout: None,
      controller_map: None,
      peripherals,
      rom_path: Some("C:/games/mario.wbfs".to_string()),
      passthrough: Vec::new(),
    };

    let args = build_emulator_args(
      "C:/Dolphin/Dolphin.exe",
      &context,
      "C:/games/mario.wbfs",
    )
    .expect("dolphin args should build");

    assert_eq!(
      args,
      vec![
        "-b".to_string(),
        "-C".to_string(),
        "Wiimote.Wiimote1.Extension=None".to_string(),
        "-C".to_string(),
        "Wiimote.Wiimote1.Extension/Attach MotionPlus=False".to_string(),
        "-e".to_string(),
        "C:/games/mario.wbfs".to_string(),
      ],
    );
  }

  #[test]
  fn dolphin_launch_args_place_rom_immediately_after_exec_flag() {
    let mut peripherals = BTreeMap::new();
    peripherals.insert("wii_extension".to_string(), "nunchuk".to_string());
    let context = EmulatorLaunchContext {
      profile: Some("dolphin".to_string()),
      core: None,
      controller_layout: None,
      controller_map: None,
      peripherals,
      rom_path: Some("C:/games/mario.wbfs".to_string()),
      passthrough: Vec::new(),
    };

    let args = build_emulator_args(
      "C:/Dolphin/Dolphin.exe",
      &context,
      "C:/games/mario.wbfs",
    )
    .expect("dolphin args should build");

    assert_eq!(
      args,
      vec![
        "-b".to_string(),
        "-C".to_string(),
        "Wiimote.Wiimote1.Extension=Nunchuk".to_string(),
        "-e".to_string(),
        "C:/games/mario.wbfs".to_string(),
      ],
    );
  }
}
