use std::io;
use std::process::{Command, Output};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Run PowerShell without flashing a console window (used for icon extraction and store scans).
#[cfg(windows)]
pub fn run_hidden_powershell(script: &str) -> io::Result<Output> {
  use std::os::windows::process::CommandExt;

  Command::new("powershell")
    .args([
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      script,
    ])
    .creation_flags(CREATE_NO_WINDOW)
    .output()
}

#[cfg(not(windows))]
pub fn run_hidden_powershell(_script: &str) -> io::Result<Output> {
  Err(io::Error::new(
    io::ErrorKind::Unsupported,
    "PowerShell is only available on Windows",
  ))
}