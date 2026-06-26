use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::launcher::launcher_manager::open_uri;

#[derive(Debug, Clone)]
enum SteamLoginState {
  Pending,
  Success(String),
  Error(String),
}

static STEAM_LOGIN_SESSIONS: LazyLock<Mutex<HashMap<String, SteamLoginState>>> =
  LazyLock::new(|| Mutex::new(HashMap::new()));

const STEAM_LOGIN_SESSION_TTL: Duration = Duration::from_secs(20 * 60);
const STEAM_LOGIN_SESSION_SOFT_LIMIT: usize = 96;
const STEAM_ID64_BASE: u64 = 76561197960265728;

fn steam_login_session_timestamp_nanos(session_id: &str) -> Option<u128> {
  session_id.rsplit('-').next()?.parse::<u128>().ok()
}

fn prune_steam_login_sessions(sessions: &mut HashMap<String, SteamLoginState>) {
  if sessions.is_empty() {
    return;
  }

  let now_nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .ok()
    .map(|duration| duration.as_nanos())
    .unwrap_or(0);

  let ttl_nanos = STEAM_LOGIN_SESSION_TTL.as_nanos();

  sessions.retain(|session_id, _| {
    let Some(created_nanos) = steam_login_session_timestamp_nanos(session_id) else {
      return true;
    };

    now_nanos.saturating_sub(created_nanos) <= ttl_nanos
  });

  if sessions.len() <= STEAM_LOGIN_SESSION_SOFT_LIMIT {
    return;
  }

  let mut session_order: Vec<(String, u128)> = sessions
    .keys()
    .map(|session_id| {
      (
        session_id.clone(),
        steam_login_session_timestamp_nanos(session_id).unwrap_or(u128::MAX),
      )
    })
    .collect();

  session_order.sort_by_key(|(_, timestamp)| *timestamp);
  let overflow = sessions.len().saturating_sub(STEAM_LOGIN_SESSION_SOFT_LIMIT);

  for (session_id, _) in session_order.into_iter().take(overflow) {
    sessions.remove(&session_id);
  }
}

fn steam_api_json(url: &str) -> Result<serde_json::Value, String> {
  reqwest::blocking::get(url)
    .map_err(|error| format!("Steam API request failed: {error}"))?
    .json::<serde_json::Value>()
    .map_err(|error| format!("Failed to parse Steam API response: {error}"))
}

fn parse_local_playtime_from_vdf(contents: &str, app_id: u32) -> Option<(u64, Option<u64>)> {
  let app_key = app_id.to_string();
  let mut section_stack: Vec<String> = Vec::new();
  let mut pending_section: Option<String> = None;
  let mut minutes_total: Option<u64> = None;
  let mut minutes_recent: Option<u64> = None;

  for line in contents.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() {
      continue;
    }

    let values = crate::scanners::steam_scanner::parse_quoted_values(trimmed);
    if values.len() == 1 {
      pending_section = values.first().cloned();
    } else if values.len() >= 2 {
      let in_apps = section_stack.iter().any(|section| section == "apps");
      let in_app = section_stack
        .last()
        .map(|section| section == &app_key)
        .unwrap_or(false);

      if in_apps && in_app {
        let key = values[0].trim().to_lowercase();
        let value = values[1].trim();

        if key == "playtime" || key == "playtime_forever" {
          minutes_total = value.parse::<u64>().ok();
        } else if key == "playtime2wks" || key == "playtime_2weeks" {
          minutes_recent = value.parse::<u64>().ok();
        }
      }
    }

    for character in trimmed.chars() {
      if character == '{' {
        section_stack.push(pending_section.take().unwrap_or_default());
      } else if character == '}' {
        section_stack.pop();
        pending_section = None;
      }
    }

    if minutes_total.is_some() && minutes_recent.is_some() {
      break;
    }
  }

  minutes_total.map(|total| (total, minutes_recent))
}

fn steam_userdata_id_candidates(steam_id: &str) -> Vec<String> {
  let steam_id = steam_id.trim();
  if steam_id.is_empty() {
    return Vec::new();
  }

  if !steam_id.chars().all(|character| character.is_ascii_digit()) {
    return Vec::new();
  }

  let mut candidates = vec![steam_id.to_string()];

  if let Ok(steam_id64) = steam_id.parse::<u64>() {
    if steam_id64 > STEAM_ID64_BASE {
      let account_id = (steam_id64 - STEAM_ID64_BASE).to_string();
      if account_id != steam_id {
        candidates.push(account_id);
      }
    }
  }

  candidates
}

fn local_steam_playtime_response(steam_id: &str, app_id: u32) -> Option<crate::SteamPlaytimeResponse> {
  let steam_user_ids = steam_userdata_id_candidates(steam_id);
  if steam_user_ids.is_empty() {
    return None;
  }

  for root in crate::scanners::steam_scanner::steam_roots() {
    for candidate in &steam_user_ids {
      let localconfig = root
        .join("userdata")
        .join(candidate)
        .join("config")
        .join("localconfig.vdf");

      let Ok(contents) = fs::read_to_string(localconfig) else {
        continue;
      };

      if let Some((minutes_total, minutes_recent)) = parse_local_playtime_from_vdf(&contents, app_id) {
        return Some(crate::SteamPlaytimeResponse {
          app_id,
          minutes_total,
          minutes_recent,
        });
      }
    }
  }

  None
}

fn local_steam_playtime_response_any_profile(app_id: u32) -> Option<crate::SteamPlaytimeResponse> {
  let mut best_match: Option<(u64, Option<u64>)> = None;

  for root in crate::scanners::steam_scanner::steam_roots() {
    let userdata = root.join("userdata");
    let Ok(entries) = fs::read_dir(userdata) else {
      continue;
    };

    for entry in entries.flatten() {
      let profile_path = entry.path();
      if !profile_path.is_dir() {
        continue;
      }

      let localconfig = profile_path.join("config").join("localconfig.vdf");
      let Ok(contents) = fs::read_to_string(localconfig) else {
        continue;
      };

      let Some((minutes_total, minutes_recent)) = parse_local_playtime_from_vdf(&contents, app_id) else {
        continue;
      };

      let should_replace = best_match
        .map(|(current_total, _)| minutes_total > current_total)
        .unwrap_or(true);

      if should_replace {
        best_match = Some((minutes_total, minutes_recent));
      }
    }
  }

  best_match.map(|(minutes_total, minutes_recent)| crate::SteamPlaytimeResponse {
    app_id,
    minutes_total,
    minutes_recent,
  })
}

fn merge_playtime_response(
  existing: Option<crate::SteamPlaytimeResponse>,
  candidate: crate::SteamPlaytimeResponse,
) -> crate::SteamPlaytimeResponse {
  let Some(current) = existing else {
    return candidate;
  };

  let minutes_total = current.minutes_total.max(candidate.minutes_total);
  let minutes_recent = match (current.minutes_recent, candidate.minutes_recent) {
    (Some(left), Some(right)) => Some(left.max(right)),
    (Some(left), None) => Some(left),
    (None, Some(right)) => Some(right),
    (None, None) => None,
  };

  crate::SteamPlaytimeResponse {
    app_id: current.app_id,
    minutes_total,
    minutes_recent,
  }
}

fn send_browser_response(stream: &mut std::net::TcpStream, message: &str) {
  let body = format!(
    "<html><body style=\"font-family:Segoe UI,Arial,sans-serif;background:#0b101b;color:#ecf2ff;padding:20px\"><h2>{message}</h2><p>You can close this tab and return to Tilezu.</p></body></html>"
  );

  let response = format!(
    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
    body.len(), body
  );

  let _ = stream.write_all(response.as_bytes());
  let _ = stream.flush();
}

fn accept_openid_callback(listener: &TcpListener, timeout: Duration) -> Result<HashMap<String, String>, String> {
  let started_at = Instant::now();

  loop {
    if started_at.elapsed() > timeout {
      return Err("Steam login timed out. Please try again.".to_string());
    }

    match listener.accept() {
      Ok((mut stream, _)) => {
        let mut buffer = [0u8; 8192];
        let size = stream
          .read(&mut buffer)
          .map_err(|error| format!("Failed to read Steam callback: {error}"))?;
        if size == 0 {
          continue;
        }

        let request_text = String::from_utf8_lossy(&buffer[..size]);
        let Some(first_line) = request_text.lines().next() else {
          continue;
        };

        let mut parts = first_line.split_whitespace();
        let _method = parts.next();
        let path_with_query = parts.next().unwrap_or("/");

        let query = path_with_query
          .split_once('?')
          .map(|(_, value)| value)
          .unwrap_or("");

        let params: HashMap<String, String> = url::form_urlencoded::parse(query.as_bytes())
          .into_owned()
          .collect();

        if params.is_empty() {
          send_browser_response(
            &mut stream,
            "Steam login callback received, but no parameters were found.",
          );
          return Err("Steam login callback missing required parameters".to_string());
        }

        send_browser_response(&mut stream, "Steam login successful.");
        return Ok(params);
      }
      Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
        std::thread::sleep(Duration::from_millis(100));
      }
      Err(error) => return Err(format!("Steam login listener failed: {error}")),
    }
  }
}

fn verify_openid_assertion(params: &HashMap<String, String>) -> Result<String, String> {
  let mut form: HashMap<String, String> = params
    .iter()
    .filter(|(key, _)| key.starts_with("openid."))
    .map(|(key, value)| (key.clone(), value.clone()))
    .collect();

  form.insert("openid.mode".to_string(), "check_authentication".to_string());

  let response_text = reqwest::blocking::Client::new()
    .post("https://steamcommunity.com/openid/login")
    .form(&form)
    .send()
    .and_then(|response| response.text())
    .map_err(|error| format!("Failed to verify Steam login assertion: {error}"))?;

  if !response_text.contains("is_valid:true") {
    return Err("Steam login verification failed".to_string());
  }

  let claimed_id = params
    .get("openid.claimed_id")
    .ok_or_else(|| "Steam callback missing claimed identity".to_string())?;

  let steam_id = claimed_id
    .trim_end_matches('/')
    .rsplit('/')
    .next()
    .ok_or_else(|| "Could not parse SteamID from callback".to_string())?
    .to_string();

  if steam_id.chars().all(|character| character.is_ascii_digit()) {
    Ok(steam_id)
  } else {
    Err("SteamID in callback is invalid".to_string())
  }
}

pub(crate) fn steam_browser_login_start_impl() -> Result<crate::SteamBrowserLoginStartResult, String> {
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| format!("Failed to read current time: {error}"))?
    .as_nanos();

  let session_id = format!("steam-login-{}-{}", std::process::id(), timestamp);

  {
    let mut sessions = STEAM_LOGIN_SESSIONS
      .lock()
      .map_err(|_| "Failed to access Steam login sessions".to_string())?;
    prune_steam_login_sessions(&mut sessions);
    sessions.insert(session_id.clone(), SteamLoginState::Pending);
  }

  let listener = TcpListener::bind("127.0.0.1:0")
    .map_err(|error| format!("Could not start local login callback listener: {error}"))?;

  listener
    .set_nonblocking(true)
    .map_err(|error| format!("Could not configure callback listener: {error}"))?;

  let port = listener
    .local_addr()
    .map_err(|error| format!("Could not read callback listener address: {error}"))?
    .port();

  let realm = format!("http://127.0.0.1:{port}/");
  let return_to = format!("http://127.0.0.1:{port}/auth/steam/callback");

  let mut serializer = url::form_urlencoded::Serializer::new(String::new());
  serializer.append_pair("openid.ns", "http://specs.openid.net/auth/2.0");
  serializer.append_pair("openid.mode", "checkid_setup");
  serializer.append_pair(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  serializer.append_pair(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  serializer.append_pair("openid.realm", &realm);
  serializer.append_pair("openid.return_to", &return_to);
  let query = serializer.finish();

  let login_url = format!("https://steamcommunity.com/openid/login?{query}");
  open_uri(&login_url)?;

  let session_for_thread = session_id.clone();
  std::thread::spawn(move || {
    let result = (|| -> Result<String, String> {
      let params = accept_openid_callback(&listener, Duration::from_secs(180))?;
      verify_openid_assertion(&params)
    })();

    if let Ok(mut sessions) = STEAM_LOGIN_SESSIONS.lock() {
      prune_steam_login_sessions(&mut sessions);
      match result {
        Ok(steam_id) => {
          sessions.insert(session_for_thread, SteamLoginState::Success(steam_id));
        }
        Err(error) => {
          sessions.insert(session_for_thread, SteamLoginState::Error(error));
        }
      }
    }
  });

  Ok(crate::SteamBrowserLoginStartResult { session_id })
}

pub(crate) fn steam_browser_login_poll_impl(
  request: crate::SteamBrowserLoginPollRequest,
) -> Result<crate::SteamBrowserLoginPollResult, String> {
  let mut sessions = STEAM_LOGIN_SESSIONS
    .lock()
    .map_err(|_| "Failed to access Steam login sessions".to_string())?;

  prune_steam_login_sessions(&mut sessions);

  let state = sessions
    .get(&request.session_id)
    .cloned()
    .ok_or_else(|| "Steam login session was not found or expired".to_string())?;

  match state {
    SteamLoginState::Pending => Ok(crate::SteamBrowserLoginPollResult {
      status: "pending".to_string(),
      steam_id: None,
      error: None,
    }),
    SteamLoginState::Success(steam_id) => {
      sessions.remove(&request.session_id);
      Ok(crate::SteamBrowserLoginPollResult {
        status: "success".to_string(),
        steam_id: Some(steam_id),
        error: None,
      })
    }
    SteamLoginState::Error(error) => {
      sessions.remove(&request.session_id);
      Ok(crate::SteamBrowserLoginPollResult {
        status: "error".to_string(),
        steam_id: None,
        error: Some(error),
      })
    }
  }
}

pub(crate) async fn test_steam_connection_impl(
  request: crate::SteamConnectionTestRequest,
) -> Result<crate::SteamConnectionTestResult, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let api_key = request.api_key.trim();
    let steam_id = request.steam_id.trim();

    if api_key.is_empty() {
      return Err("Steam API key is required".to_string());
    }
    if steam_id.is_empty() {
      return Err("Steam ID64 is required".to_string());
    }

    let url = format!(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key={api_key}&steamids={steam_id}"
    );

    let json = steam_api_json(&url)?;

    let players = json
      .get("response")
      .and_then(|value| value.get("players"))
      .and_then(serde_json::Value::as_array)
      .ok_or_else(|| "Unexpected Steam response format".to_string())?;

    let Some(player) = players.first() else {
      return Err("No Steam profile found for this SteamID64 and API key".to_string());
    };

    let persona_name = player
      .get("personaname")
      .and_then(serde_json::Value::as_str)
      .unwrap_or("Steam User")
      .to_string();

    Ok(crate::SteamConnectionTestResult {
      steam_id: steam_id.to_string(),
      persona_name,
    })
  })
  .await
  .map_err(|error| format!("Steam connection test task failed: {error}"))?
}

pub(crate) async fn get_steam_achievements_impl(
  request: crate::SteamAchievementsRequest,
) -> Result<crate::SteamAchievementsResponse, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let api_key = request.api_key.trim();
    let steam_id = request.steam_id.trim();

    if api_key.is_empty() {
      return Err("Steam API key is required".to_string());
    }
    if steam_id.is_empty() {
      return Err("Steam ID64 is required".to_string());
    }

    let player_url = format!(
      "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key={api_key}&steamid={steam_id}&appid={}",
      request.app_id
    );

    let schema_url = format!(
      "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key={api_key}&appid={}",
      request.app_id
    );

    let global_url = format!(
      "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid={}",
      request.app_id
    );

    let player_json = steam_api_json(&player_url)?;
    let schema_json = steam_api_json(&schema_url).ok();
    let global_json = steam_api_json(&global_url).ok();

    let player_stats = player_json
      .get("playerstats")
      .ok_or_else(|| "Steam API returned unexpected player stats format".to_string())?;

    let success = player_stats
      .get("success")
      .and_then(serde_json::Value::as_bool)
      .unwrap_or(false);

    if !success {
      return Err(
        "Steam player achievements are not accessible. Check API key, SteamID, game ownership, and profile privacy."
          .to_string(),
      );
    }

    let mut meta_by_key: HashMap<String, (String, bool, Option<String>)> = HashMap::new();
    let mut game_name: Option<String> = None;

    if let Some(schema) = schema_json.as_ref().and_then(|value| value.get("game")) {
      game_name = schema
        .get("gameName")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);

      if let Some(schema_achievements) = schema
        .get("availableGameStats")
        .and_then(|value| value.get("achievements"))
        .and_then(serde_json::Value::as_array)
      {
        for item in schema_achievements {
          let Some(key) = item.get("name").and_then(serde_json::Value::as_str) else {
            continue;
          };

          let display = item
            .get("displayName")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(key)
            .to_string();

          let hidden = item
            .get("hidden")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(0)
            == 1;

          let description = item
            .get("description")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string);

          meta_by_key.insert(key.to_string(), (display, hidden, description));
        }
      }
    }

    let mut global_percent_by_key: HashMap<String, f64> = HashMap::new();
    if let Some(global_items) = global_json
      .as_ref()
      .and_then(|value| value.get("achievementpercentages"))
      .and_then(|value| value.get("achievements"))
      .and_then(serde_json::Value::as_array)
    {
      for item in global_items {
        let Some(key) = item.get("name").and_then(serde_json::Value::as_str) else {
          continue;
        };

        let Some(percent) = item.get("percent").and_then(serde_json::Value::as_f64) else {
          continue;
        };

        global_percent_by_key.insert(key.to_string(), percent);
      }
    }

    let achievements = player_stats
      .get("achievements")
      .and_then(serde_json::Value::as_array)
      .ok_or_else(|| "No achievement list available for this game/player".to_string())?;

    let mut items: Vec<crate::SteamAchievementItem> = Vec::new();
    let mut unlocked = 0usize;

    for item in achievements {
      let Some(key) = item.get("apiname").and_then(serde_json::Value::as_str) else {
        continue;
      };

      let achieved = item
        .get("achieved")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0)
        == 1;

      if achieved {
        unlocked += 1;
      }

      let unlock_time = item
        .get("unlocktime")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(0);

      let (name, hidden, description) = meta_by_key
        .get(key)
        .cloned()
        .unwrap_or_else(|| (key.to_string(), false, None));

      items.push(crate::SteamAchievementItem {
        key: key.to_string(),
        name,
        achieved,
        unlock_time,
        global_percent: global_percent_by_key.get(key).copied(),
        hidden,
        description,
      });
    }

    items.sort_by(|left, right| {
      right
        .achieved
        .cmp(&left.achieved)
        .then_with(|| left.name.cmp(&right.name))
    });

    let total = items.len();
    let completion_percent = if total > 0 {
      (unlocked as f64 / total as f64) * 100.0
    } else {
      0.0
    };

    Ok(crate::SteamAchievementsResponse {
      app_id: request.app_id,
      game_name,
      total,
      unlocked,
      completion_percent,
      achievements: items,
    })
  })
  .await
  .map_err(|error| format!("Steam achievements task failed: {error}"))?
}

pub(crate) async fn get_steam_playtime_impl(
  request: crate::SteamPlaytimeRequest,
) -> Result<crate::SteamPlaytimeResponse, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let api_key = request.api_key.trim();
    let steam_id = request.steam_id.trim();

    let mut best_response: Option<crate::SteamPlaytimeResponse> = None;

    if !api_key.is_empty() && !steam_id.is_empty() {
      let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key={api_key}&steamid={steam_id}&include_appinfo=0&include_played_free_games=1"
      );

      if let Ok(json) = steam_api_json(&url) {
        if let Some(game) = json
          .get("response")
          .and_then(|value| value.get("games"))
          .and_then(serde_json::Value::as_array)
          .and_then(|items| {
            items.iter().find(|item| {
              item
                .get("appid")
                .and_then(serde_json::Value::as_u64)
                .map(|appid| appid == request.app_id as u64)
                .unwrap_or(false)
            })
          })
        {
          let minutes_total = game
            .get("playtime_forever")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(0);

          let minutes_recent = game
            .get("playtime_2weeks")
            .and_then(serde_json::Value::as_u64);

          best_response = Some(merge_playtime_response(best_response, crate::SteamPlaytimeResponse {
            app_id: request.app_id,
            minutes_total,
            minutes_recent,
          }));
        }
      }
    }

    if !steam_id.is_empty() {
      if let Some(local_response) = local_steam_playtime_response(steam_id, request.app_id) {
        best_response = Some(merge_playtime_response(best_response, local_response));
      }
    }

    if let Some(local_response) = local_steam_playtime_response_any_profile(request.app_id) {
      best_response = Some(merge_playtime_response(best_response, local_response));
    }

    if let Some(response) = best_response {
      return Ok(response);
    }

    if steam_id.is_empty() {
      if api_key.is_empty() {
        return Err("Steam ID64 is required when local Steam playtime data is unavailable".to_string());
      }

      return Err("Steam ID64 is required for Steam API lookups when local Steam playtime data is unavailable".to_string());
    }

    if api_key.is_empty() {
      return Err("Steam API key is required when local playtime data is unavailable".to_string());
    }

    Err("No playtime data found for this app".to_string())
  })
  .await
  .map_err(|error| format!("Steam playtime task failed: {error}"))?
}
