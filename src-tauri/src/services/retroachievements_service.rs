use serde::{Deserialize, Serialize};

const RA_BASE: &str = "https://retroachievements.org/API";

// ── Low-level helpers ────────────────────────────────────────────────────────

fn ra_client() -> reqwest::blocking::Client {
  reqwest::blocking::Client::builder()
    .timeout(std::time::Duration::from_secs(15))
    .user_agent("TileManager/1.0")
    .build()
    .expect("Failed to build RA HTTP client")
}

// ── Response structs (RA JSON shapes) ────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RaUserSummaryRaw {
  #[serde(rename = "User")]
  user: Option<String>,
  #[serde(rename = "TotalPoints")]
  total_points: Option<u64>,
  #[serde(rename = "TotalSoftcorePoints")]
  total_softcore_points: Option<u64>,
  #[serde(rename = "Rank")]
  rank: Option<serde_json::Value>,
  #[serde(rename = "UserPic")]
  user_pic: Option<String>,
  #[serde(rename = "TotalRanked")]
  total_ranked: Option<u64>,
  #[serde(rename = "RecentlyPlayedCount")]
  _recently_played_count: Option<u64>,
  #[serde(rename = "RecentAchievements")]
  _recent_achievements: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct RaRecentAchievementRaw {
  #[serde(rename = "AchievementID")]
  achievement_id: Option<u64>,
  #[serde(rename = "GameID")]
  game_id: Option<u64>,
  #[serde(rename = "GameTitle")]
  game_title: Option<String>,
  #[serde(rename = "Title")]
  title: Option<String>,
  #[serde(rename = "Description")]
  description: Option<String>,
  #[serde(rename = "BadgeName")]
  badge_name: Option<String>,
  #[serde(rename = "Points")]
  points: Option<u32>,
  #[serde(rename = "Date")]
  date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RaAwardRaw {
  #[serde(rename = "Title")]
  title: Option<String>,
  #[serde(rename = "AwardType")]
  award_type: Option<String>,
  #[serde(rename = "AwardData")]
  _award_data: Option<serde_json::Value>,
  #[serde(rename = "AwardDate")]
  award_date: Option<String>,
  #[serde(rename = "ImageIcon")]
  image_icon: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RaAwardsResponse {
  #[serde(rename = "VisibleUserAwards")]
  visible_user_awards: Option<Vec<RaAwardRaw>>,
}

#[derive(Debug, Deserialize)]
struct RaCompletedGameRaw {
  #[serde(rename = "GameID")]
  game_id: Option<u64>,
  #[serde(rename = "Title")]
  title: Option<String>,
  #[serde(rename = "ImageIcon")]
  image_icon: Option<String>,
  #[serde(rename = "MaxPossible")]
  max_possible: Option<u32>,
  #[serde(rename = "NumAwarded")]
  num_awarded: Option<u32>,
  #[serde(rename = "PctWon")]
  pct_won: Option<serde_json::Value>,
  #[serde(rename = "HardcoreMode")]
  hardcore_mode: Option<serde_json::Value>,
}

// ── Public output structs (serialized to frontend) ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaUserProfile {
  pub username: String,
  pub total_points: u64,
  pub total_softcore_points: u64,
  pub rank: Option<u64>,
  pub total_ranked: u64,
  pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaRecentAchievement {
  pub achievement_id: u64,
  pub game_id: u64,
  pub game_title: String,
  pub title: String,
  pub description: String,
  pub badge_url: String,
  pub points: u32,
  pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaAward {
  pub title: String,
  pub award_type: String,
  pub award_date: String,
  pub image_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaCompletedGame {
  pub game_id: u64,
  pub title: String,
  pub image_url: String,
  pub max_possible: u32,
  pub num_awarded: u32,
  pub pct_won: f64,
  pub hardcore: bool,
}

// ── Impl functions called by Tauri commands ──────────────────────────────────

pub fn test_ra_connection_impl(username: &str, api_key: &str) -> Result<RaUserProfile, String> {
  let url = format!(
    "{}/API_GetUserSummary.php?z={}&y={}&u={}&g=0&a=0",
    RA_BASE, username, api_key, username
  );

  let client = ra_client();
  let resp = client
    .get(&url)
    .send()
    .map_err(|e| format!("RA request failed: {e}"))?;

  if !resp.status().is_success() {
    return Err(format!("RA returned HTTP {}", resp.status()));
  }

  let raw: RaUserSummaryRaw = resp
    .json()
    .map_err(|e| format!("Failed to parse RA user summary: {e}"))?;

  let username_out = raw.user.unwrap_or_default();
  if username_out.is_empty() {
    return Err("Invalid username or API key".to_string());
  }

  let rank = raw.rank.and_then(|v| match v {
    serde_json::Value::Number(n) => n.as_u64(),
    _ => None,
  });

  let avatar_path = raw.user_pic.unwrap_or_default();
  let avatar_url = if avatar_path.starts_with("http") {
    avatar_path
  } else {
    format!("https://retroachievements.org{avatar_path}")
  };

  Ok(RaUserProfile {
    username: username_out,
    total_points: raw.total_points.unwrap_or(0),
    total_softcore_points: raw.total_softcore_points.unwrap_or(0),
    rank,
    total_ranked: raw.total_ranked.unwrap_or(0),
    avatar_url,
  })
}

pub fn get_ra_recent_achievements_impl(
  username: &str,
  api_key: &str,
  count: u32,
) -> Result<Vec<RaRecentAchievement>, String> {
  let url = format!(
    "{}/API_GetUserRecentAchievements.php?z={}&y={}&u={}&c={}",
    RA_BASE, username, api_key, username, count
  );

  let client = ra_client();
  let resp = client
    .get(&url)
    .send()
    .map_err(|e| format!("RA request failed: {e}"))?;

  if !resp.status().is_success() {
    return Err(format!("RA returned HTTP {}", resp.status()));
  }

  let raw: Vec<RaRecentAchievementRaw> = resp
    .json()
    .map_err(|e| format!("Failed to parse RA recent achievements: {e}"))?;

  let out = raw
    .into_iter()
    .filter_map(|a| {
      Some(RaRecentAchievement {
        achievement_id: a.achievement_id?,
        game_id: a.game_id?,
        game_title: a.game_title.unwrap_or_default(),
        title: a.title.unwrap_or_default(),
        description: a.description.unwrap_or_default(),
        badge_url: {
          let badge = a.badge_name.unwrap_or_default();
          if badge.is_empty() {
            String::new()
          } else {
            format!("https://media.retroachievements.org/Badge/{badge}.png")
          }
        },
        points: a.points.unwrap_or(0),
        date: a.date.unwrap_or_default(),
      })
    })
    .collect();

  Ok(out)
}

pub fn get_ra_user_awards_impl(username: &str, api_key: &str) -> Result<Vec<RaAward>, String> {
  let url = format!(
    "{}/API_GetUserAwards.php?z={}&y={}&u={}",
    RA_BASE, username, api_key, username
  );

  let client = ra_client();
  let resp = client
    .get(&url)
    .send()
    .map_err(|e| format!("RA request failed: {e}"))?;

  if !resp.status().is_success() {
    return Err(format!("RA returned HTTP {}", resp.status()));
  }

  let raw: RaAwardsResponse = resp
    .json()
    .map_err(|e| format!("Failed to parse RA awards: {e}"))?;

  let awards = raw.visible_user_awards.unwrap_or_default();

  let out = awards
    .into_iter()
    .filter_map(|a| {
      let icon = a.image_icon.unwrap_or_default();
      let image_url = if icon.is_empty() {
        String::new()
      } else if icon.starts_with("http") {
        icon
      } else {
        format!("https://media.retroachievements.org{icon}")
      };

      Some(RaAward {
        title: a.title.unwrap_or_default(),
        award_type: a.award_type.unwrap_or_default(),
        award_date: a.award_date.unwrap_or_default(),
        image_url,
      })
    })
    .collect();

  Ok(out)
}

pub fn get_ra_completed_games_impl(
  username: &str,
  api_key: &str,
) -> Result<Vec<RaCompletedGame>, String> {
  let url = format!(
    "{}/API_GetUserCompletionProgress.php?z={}&y={}&u={}&c=50",
    RA_BASE, username, api_key, username
  );

  let client = ra_client();
  let resp = client
    .get(&url)
    .send()
    .map_err(|e| format!("RA request failed: {e}"))?;

  if !resp.status().is_success() {
    return Err(format!("RA returned HTTP {}", resp.status()));
  }

  // API_GetUserCompletionProgress wraps results in { "Count": ..., "Results": [...] }
  let wrapper: serde_json::Value = resp
    .json()
    .map_err(|e| format!("Failed to parse RA completion: {e}"))?;

  let arr = match wrapper.get("Results") {
    Some(serde_json::Value::Array(a)) => a.clone(),
    _ => {
      // Fallback: try parsing as array directly (older endpoint variant)
      match wrapper {
        serde_json::Value::Array(a) => a,
        _ => return Ok(vec![]),
      }
    }
  };

  let raw: Vec<RaCompletedGameRaw> = serde_json::from_value(serde_json::Value::Array(arr))
    .map_err(|e| format!("Failed to deserialize RA games: {e}"))?;

  let pct_f64 = |v: Option<serde_json::Value>| -> f64 {
    match v {
      Some(serde_json::Value::Number(n)) => n.as_f64().unwrap_or(0.0),
      Some(serde_json::Value::String(s)) => s.parse::<f64>().unwrap_or(0.0),
      _ => 0.0,
    }
  };

  let hardcore_bool = |v: Option<serde_json::Value>| -> bool {
    match v {
      Some(serde_json::Value::Number(n)) => n.as_u64().unwrap_or(0) != 0,
      Some(serde_json::Value::Bool(b)) => b,
      _ => false,
    }
  };

  let out = raw
    .into_iter()
    .filter_map(|g| {
      let icon = g.image_icon.unwrap_or_default();
      let image_url = if icon.is_empty() {
        String::new()
      } else {
        format!("https://media.retroachievements.org{icon}")
      };

      Some(RaCompletedGame {
        game_id: g.game_id?,
        title: g.title.unwrap_or_default(),
        image_url,
        max_possible: g.max_possible.unwrap_or(0),
        num_awarded: g.num_awarded.unwrap_or(0),
        pct_won: pct_f64(g.pct_won),
        hardcore: hardcore_bool(g.hardcore_mode),
      })
    })
    .collect();

  Ok(out)
}
