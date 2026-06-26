use std::collections::HashSet;
use std::path::Path;

#[cfg(target_os = "windows")]
use windows::core::{HSTRING, Interface, PWSTR};

#[cfg(target_os = "windows")]
use windows::Media::Control::{
  GlobalSystemMediaTransportControlsSessionManager,
  GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::RPC_E_CHANGED_MODE;

#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::{
  eMultimedia, eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
  ISimpleAudioVolume, MMDeviceEnumerator,
};

#[cfg(target_os = "windows")]
use windows::Win32::System::Com::{
  CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
};

#[cfg(target_os = "windows")]
use windows::Win32::System::Threading::{
  OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
};

#[cfg(target_os = "windows")]
async fn fetch_now_playing_windows() -> Result<Option<crate::NowPlayingResponse>, String> {
  let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
    .map_err(|error| format!("Failed to request media session manager: {error}"))?
    .get()
    .map_err(|error| format!("Failed to initialize media session manager: {error}"))?;

  let session = manager
    .GetCurrentSession()
    .map_err(|error| format!("Failed to get active media session: {error}"))?;

  let media_properties = match session.TryGetMediaPropertiesAsync() {
    Ok(operation) => match operation.get() {
      Ok(value) => value,
      Err(_) => return Ok(None),
    },
    Err(_) => return Ok(None),
  };

  let playback_info = match session.GetPlaybackInfo() {
    Ok(value) => value,
    Err(_) => return Ok(None),
  };

  let status = match playback_info.PlaybackStatus() {
    Ok(value) => value,
    Err(_) => return Ok(None),
  };

  let source_app = session
    .SourceAppUserModelId()
    .ok()
    .map(|value: HSTRING| value.to_string())
    .unwrap_or_default();

  let title = media_properties
    .Title()
    .ok()
    .map(|value: HSTRING| value.to_string())
    .unwrap_or_default();

  let artist = media_properties
    .Artist()
    .ok()
    .map(|value: HSTRING| value.to_string())
    .unwrap_or_default();

  let album_title = media_properties
    .AlbumTitle()
    .ok()
    .map(|value: HSTRING| value.to_string())
    .unwrap_or_default();

  if title.trim().is_empty() && artist.trim().is_empty() {
    return Ok(None);
  }

  let artwork_url = (|| -> Option<String> {
    use base64::Engine;
    use windows::Storage::Streams::{Buffer, DataReader, InputStreamOptions};
    let thumbnail_ref = media_properties.Thumbnail().ok()?;
    let stream = thumbnail_ref.OpenReadAsync().ok()?.get().ok()?;
    let size = stream.Size().ok()?;
    if size == 0 || size > 3_000_000 {
      return None;
    }
    let buffer = Buffer::Create(size as u32).ok()?;
    let filled = stream
      .ReadAsync(&buffer, size as u32, InputStreamOptions::None)
      .ok()?
      .get()
      .ok()?;
    let reader = DataReader::FromBuffer(&filled).ok()?;
    let byte_count = filled.Length().ok()? as usize;
    if byte_count == 0 {
      return None;
    }
    let mut bytes = vec![0u8; byte_count];
    reader.ReadBytes(&mut bytes).ok()?;
    let mime = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
      "image/jpeg"
    } else if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
      "image/png"
    } else {
      "image/jpeg"
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{mime};base64,{b64}"))
  })();

  Ok(Some(crate::NowPlayingResponse {
    source_app,
    title,
    artist,
    album_title,
    is_playing: status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing,
    artwork_url,
  }))
}

pub(crate) async fn get_now_playing_impl() -> Result<Option<crate::NowPlayingResponse>, String> {
  #[cfg(target_os = "windows")]
  {
    return fetch_now_playing_windows().await;
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(None)
  }
}

pub(crate) async fn media_toggle_playback_impl() -> Result<bool, String> {
  #[cfg(target_os = "windows")]
  {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
      .map_err(|error| format!("Failed to request media session manager: {error}"))?
      .get()
      .map_err(|error| format!("Failed to initialize media session manager: {error}"))?;

    let session = manager
      .GetCurrentSession()
      .map_err(|error| format!("Failed to get active media session: {error}"))?;

    let operation = session
      .TryTogglePlayPauseAsync()
      .map_err(|error| format!("Failed to toggle playback: {error}"))?;

    return operation
      .get()
      .map_err(|error| format!("Failed to apply playback toggle: {error}"));
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(false)
  }
}

pub(crate) async fn media_next_track_impl() -> Result<bool, String> {
  #[cfg(target_os = "windows")]
  {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
      .map_err(|error| format!("Failed to request media session manager: {error}"))?
      .get()
      .map_err(|error| format!("Failed to initialize media session manager: {error}"))?;

    let session = manager
      .GetCurrentSession()
      .map_err(|error| format!("Failed to get active media session: {error}"))?;

    let operation = session
      .TrySkipNextAsync()
      .map_err(|error| format!("Failed to skip to next track: {error}"))?;

    return operation
      .get()
      .map_err(|error| format!("Failed to apply next-track command: {error}"));
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(false)
  }
}

pub(crate) async fn media_previous_track_impl() -> Result<bool, String> {
  #[cfg(target_os = "windows")]
  {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
      .map_err(|error| format!("Failed to request media session manager: {error}"))?
      .get()
      .map_err(|error| format!("Failed to initialize media session manager: {error}"))?;

    let session = manager
      .GetCurrentSession()
      .map_err(|error| format!("Failed to get active media session: {error}"))?;

    let operation = session
      .TrySkipPreviousAsync()
      .map_err(|error| format!("Failed to skip to previous track: {error}"))?;

    return operation
      .get()
      .map_err(|error| format!("Failed to apply previous-track command: {error}"));
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(false)
  }
}

#[cfg(target_os = "windows")]
fn process_base_name_from_pid(pid: u32) -> Option<String> {
  if pid == 0 {
    return None;
  }

  unsafe {
    let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut buffer = [0u16; 1024];
    let mut size = buffer.len() as u32;
    let result = QueryFullProcessImageNameW(
      process,
      PROCESS_NAME_FORMAT(0),
      PWSTR(buffer.as_mut_ptr()),
      &mut size,
    );
    let _ = windows::Win32::Foundation::CloseHandle(process);

    if result.is_err() || size == 0 {
      return None;
    }

    let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
    Path::new(full_path.trim())
      .file_name()
      .and_then(|name| name.to_str())
      .map(|name| name.to_ascii_lowercase())
  }
}

#[cfg(target_os = "windows")]
fn volume_session_process_candidates(source_app: &str) -> HashSet<String> {
  let mut candidates = HashSet::new();
  let normalized = source_app.trim().to_ascii_lowercase();
  if normalized.is_empty() {
    return candidates;
  }

  let mut push_candidate = |value: &str| {
    let candidate = value.trim().to_ascii_lowercase();
    if !candidate.is_empty() {
      candidates.insert(candidate);
    }
  };

  push_candidate(&normalized);

  for token in normalized
    .split(|character: char| {
      !(character.is_ascii_alphanumeric() || character == '.' || character == '_' || character == '-')
    })
    .filter(|token| token.contains(".exe"))
  {
    push_candidate(token);
  }

  if normalized.contains("spotify") {
    push_candidate("spotify");
    push_candidate("spotify.exe");
  }

  if normalized.contains("youtube")
    || normalized.contains("chrome")
    || normalized.contains("edge")
    || normalized.contains("firefox")
    || normalized.contains("brave")
    || normalized.contains("opera")
    || normalized.contains("vivaldi")
    || normalized.contains("arc")
  {
    for browser in [
      "chrome",
      "chrome.exe",
      "msedge",
      "msedge.exe",
      "firefox",
      "firefox.exe",
      "brave",
      "brave.exe",
      "opera",
      "opera.exe",
      "opera_gx",
      "opera_gx.exe",
      "vivaldi",
      "vivaldi.exe",
      "arc",
      "arc.exe",
    ] {
      push_candidate(browser);
    }
  }

  candidates
}

#[cfg(target_os = "windows")]
fn with_audio_session_volume_for_source<T, F>(source_app: &str, operation: F) -> Result<T, String>
where
  F: FnOnce(&[ISimpleAudioVolume]) -> Result<T, String>,
{
  let candidates = volume_session_process_candidates(source_app);
  if candidates.is_empty() {
    return Err("No media source provided for per-player volume control".to_string());
  }

  unsafe {
    let mut should_uninitialize = false;
    let initialize_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok();
    if initialize_result.is_ok() {
      should_uninitialize = true;
    } else if let Err(error) = initialize_result {
      if error.code() != RPC_E_CHANGED_MODE {
        return Err(format!("Failed to initialize COM for audio session control: {error}"));
      }
    }

    let result = (|| {
      let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
        .map_err(|error| format!("Failed to create audio device enumerator: {error}"))?;

      let device = enumerator
        .GetDefaultAudioEndpoint(eRender, eMultimedia)
        .map_err(|error| format!("Failed to get default audio endpoint: {error}"))?;

      let session_manager: IAudioSessionManager2 = device
        .Activate(CLSCTX_ALL, None)
        .map_err(|error| format!("Failed to activate audio session manager: {error}"))?;

      let session_enumerator = session_manager
        .GetSessionEnumerator()
        .map_err(|error| format!("Failed to get audio session enumerator: {error}"))?;

      let session_count = session_enumerator
        .GetCount()
        .map_err(|error| format!("Failed to get audio session count: {error}"))?;

      let mut matched_sessions: Vec<ISimpleAudioVolume> = Vec::new();

      for index in 0..session_count {
        let control = session_enumerator
          .GetSession(index)
          .map_err(|error| format!("Failed to get audio session at index {index}: {error}"))?;

        let control2: IAudioSessionControl2 = control
          .cast()
          .map_err(|error| format!("Failed to cast audio session control: {error}"))?;

        let pid = control2
          .GetProcessId()
          .map_err(|error| format!("Failed to query audio session process id: {error}"))?;

        let process_name = process_base_name_from_pid(pid).unwrap_or_default();
        if process_name.is_empty() {
          continue;
        }

        let process_without_ext = process_name.strip_suffix(".exe").unwrap_or(&process_name);
        let is_match = candidates.contains(&process_name)
          || candidates.contains(process_without_ext)
          || candidates
            .iter()
            .any(|candidate| process_name.contains(candidate) || process_without_ext.contains(candidate));

        if !is_match {
          continue;
        }

        let simple_volume: ISimpleAudioVolume = control
          .cast()
          .map_err(|error| format!("Failed to access session volume interface: {error}"))?;

        matched_sessions.push(simple_volume);
      }

      if !matched_sessions.is_empty() {
        return operation(&matched_sessions);
      }

      Err(format!(
        "No audio session found for media source '{source_app}'"
      ))
    })();

    if should_uninitialize {
      CoUninitialize();
    }

    result
  }
}

pub(crate) fn get_system_volume_impl(source_app: Option<String>, source_app_legacy: Option<String>) -> Result<f64, String> {
  #[cfg(target_os = "windows")]
  {
    let resolved_source = source_app.or(source_app_legacy);
    if let Some(source) = resolved_source {
      return with_audio_session_volume_for_source(source.trim(), |session_volumes| {
        let mut max_scalar = 0.0_f32;
        for session_volume in session_volumes {
          let scalar = unsafe {
            session_volume
              .GetMasterVolume()
              .map_err(|error| format!("Failed to get player volume: {error}"))?
          };
          if scalar > max_scalar {
            max_scalar = scalar;
          }
        }
        Ok((max_scalar as f64 * 100.0).clamp(0.0, 100.0))
      });
    }

    return Err("No media source selected for per-player volume control".to_string());
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(100.0)
  }
}

pub(crate) fn set_system_volume_impl(
  percent: f64,
  source_app: Option<String>,
  source_app_legacy: Option<String>,
) -> Result<f64, String> {
  #[cfg(target_os = "windows")]
  {
    let clamped = percent.clamp(0.0, 100.0) as f32 / 100.0;
    let resolved_source = source_app.or(source_app_legacy);
    if let Some(source) = resolved_source {
      return with_audio_session_volume_for_source(source.trim(), |session_volumes| {
        let mut max_applied = 0.0_f32;
        unsafe {
          for session_volume in session_volumes {
            session_volume
              .SetMasterVolume(clamped, std::ptr::null())
              .map_err(|error| format!("Failed to set player volume: {error}"))?;

            let applied = session_volume
              .GetMasterVolume()
              .map_err(|error| format!("Failed to confirm player volume: {error}"))?;

            if applied > max_applied {
              max_applied = applied;
            }
          }

          Ok((max_applied as f64 * 100.0).clamp(0.0, 100.0))
        }
      });
    }

    return Err("No media source selected for per-player volume control".to_string());
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(percent.clamp(0.0, 100.0))
  }
}
