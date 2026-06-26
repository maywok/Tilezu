use std::path::Path;
use std::process::Command;

use tauri::{Emitter, Manager};

fn launch_error(code: &str, message: impl AsRef<str>) -> String {
  format!("[{code}] {}", message.as_ref())
}

#[cfg(target_os = "windows")]
fn open_uri_windows(uri: &str) -> Result<(), String> {
  use windows::core::PCWSTR;
  use windows::Win32::Foundation::HWND;
  use windows::Win32::UI::Shell::ShellExecuteW;

  let operation: Vec<u16> = "open\0".encode_utf16().collect();
  let target: Vec<u16> = uri.encode_utf16().chain(std::iter::once(0)).collect();

  let result = unsafe {
    ShellExecuteW(
      HWND(std::ptr::null_mut()),
      PCWSTR(operation.as_ptr()),
      PCWSTR(target.as_ptr()),
      PCWSTR::null(),
      PCWSTR::null(),
      windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
    )
  };

  let code = result.0 as isize;
  if code <= 32 {
    return Err(launch_error(
      "URI_OPEN_FAILED",
      format!("Failed to open URI '{uri}' via ShellExecuteW (code {code})"),
    ));
  }

  Ok(())
}

#[cfg(not(target_os = "windows"))]
fn open_uri_windows(uri: &str) -> Result<(), String> {
  Command::new("explorer")
    .arg(uri)
    .spawn()
    .map_err(|error| launch_error("URI_OPEN_FAILED", format!("Failed to open URI '{uri}': {error}")))?;

  Ok(())
}

pub(crate) fn open_uri(uri: &str) -> Result<(), String> {
  let normalized = uri.trim();
  if normalized.is_empty() {
    return Err(launch_error("INVALID_URI", "URI cannot be empty"));
  }

  if normalized == "\\" || normalized == "/" {
    return Err(launch_error("INVALID_URI", format!("Invalid URI target: '{normalized}'")));
  }

  open_uri_windows(normalized)
}

pub(crate) fn launch_executable(path: &str, args: &[String]) -> Result<u32, String> {
  let trimmed_path = path.trim();
  if trimmed_path.is_empty() {
    return Err(launch_error("INVALID_TARGET", "Executable path cannot be empty"));
  }

  let executable = Path::new(trimmed_path);
  if !executable.exists() {
    return Err(launch_error(
      "EXECUTABLE_NOT_FOUND",
      format!("Executable was not found: {trimmed_path}"),
    ));
  }

  if !executable.is_file() {
    return Err(launch_error(
      "EXECUTABLE_NOT_FILE",
      format!("Launch target is not a file: {trimmed_path}"),
    ));
  }

  let mut command = Command::new(path);
  command.args(args);

  let child = command
    .spawn()
    .map_err(|error| launch_error("LAUNCH_SPAWN_FAILED", format!("Failed to launch executable '{path}': {error}")))?;

  Ok(child.id())
}

#[cfg(target_os = "windows")]
pub(crate) fn is_process_running(pid: u32) -> Result<bool, String> {
  use windows::Win32::Foundation::{CloseHandle, WAIT_TIMEOUT};
  use windows::Win32::System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION};

  if pid == 0 {
    return Ok(false);
  }

  unsafe {
    let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
      .map_err(|error| launch_error("PROCESS_QUERY_FAILED", format!("Failed to open process {pid}: {error}")))?;

    let wait_status = WaitForSingleObject(process, 0);
    let _ = CloseHandle(process);

    Ok(wait_status == WAIT_TIMEOUT)
  }
}

#[cfg(windows)]
pub(crate) fn spawn_process_exit_watcher(app: tauri::AppHandle, pid: u32) {
  if pid == 0 {
    return;
  }

  std::thread::spawn(move || {
    use windows::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
    use windows::Win32::System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE};

    let exited = unsafe {
      let Ok(process) = OpenProcess(PROCESS_SYNCHRONIZE, false, pid) else {
        return;
      };

      let wait_status = WaitForSingleObject(process, u32::MAX);
      let _ = CloseHandle(process);
      wait_status == WAIT_OBJECT_0
    };

    if !exited {
      return;
    }

    let payload = serde_json::json!({ "pid": pid });
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.emit("tilezu:tracked-process-exited", payload.clone());
    }
    let _ = app.emit("tilezu:tracked-process-exited", payload);
  });
}

#[cfg(not(windows))]
pub(crate) fn spawn_process_exit_watcher(_app: tauri::AppHandle, _pid: u32) {}

#[cfg(not(target_os = "windows"))]
pub(crate) fn is_process_running(_pid: u32) -> Result<bool, String> {
  Ok(false)
}

#[cfg(target_os = "windows")]
pub(crate) fn open_shell_app(shell_id: &str) -> Result<(), String> {
  if shell_id.trim().is_empty() {
    return Err(launch_error("INVALID_TARGET", "Shell app id cannot be empty"));
  }

  Command::new("explorer")
    .arg(shell_id)
    .spawn()
    .map_err(|error| launch_error("SHELL_OPEN_FAILED", format!("Failed to open shell app '{shell_id}': {error}")))?;

  Ok(())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn open_shell_app(_shell_id: &str) -> Result<(), String> {
  Err("Shell app launch is only supported on Windows".to_string())
}
