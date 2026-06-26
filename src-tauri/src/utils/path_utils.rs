use std::collections::HashSet;
use std::fs;
use std::path::Path;

pub(crate) fn title_folder_variants(title: &str) -> Vec<String> {
  let trimmed = title.trim();
  if trimmed.is_empty() {
    return Vec::new();
  }

  let mut variants: Vec<String> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  let direct = trimmed.to_string();
  if seen.insert(direct.to_lowercase()) {
    variants.push(direct);
  }

  let collapsed = trimmed
    .chars()
    .map(|value| {
      if value.is_ascii_alphanumeric() || value == ' ' || value == '-' || value == '_' {
        value
      } else {
        ' '
      }
    })
    .collect::<String>()
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ");

  if !collapsed.is_empty() && seen.insert(collapsed.to_lowercase()) {
    variants.push(collapsed);
  }

  variants
}

pub(crate) fn slugify(input: &str) -> String {
  let mut out = String::new();
  let mut last_dash = false;

  for character in input.trim().to_lowercase().chars() {
    if character.is_ascii_alphanumeric() {
      out.push(character);
      last_dash = false;
      continue;
    }

    if !last_dash {
      out.push('-');
      last_dash = true;
    }
  }

  out.trim_matches('-').to_string()
}

pub(crate) fn image_path_to_data_url(path: &Path) -> Option<String> {
  let bytes = fs::read(path).ok()?;
  let mime = match path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_lowercase())
    .as_deref()
  {
    Some("png") => "image/png",
    Some("webp") => "image/webp",
    Some("jpg") | Some("jpeg") => "image/jpeg",
    Some("bmp") => "image/bmp",
    _ => "application/octet-stream",
  };

  let encoded = {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
  };

  Some(format!("data:{mime};base64,{encoded}"))
}
