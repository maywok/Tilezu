use std::process::Command;

pub(crate) fn registry_key_exists(path: &str) -> bool {
  Command::new("reg")
    .args(["query", path])
    .output()
    .map(|output| output.status.success())
    .unwrap_or(false)
}
