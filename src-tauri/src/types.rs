use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub kind: String,
    pub is_default: bool,
    pub is_default_communications: bool,
    pub state: String,
    pub max_volume: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub id: String,
    pub exe: String,
    pub display_name: String,
    pub category: String,
    pub volume: f32,
    pub mute: bool,
    pub peak: f32,
    pub active: bool,
    pub pid: u32,
    pub icon: Option<String>,
    pub routed_device: Option<String>,
    pub last_active: i64,
    pub session_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterState {
    pub volume: f32,
    pub mute: bool,
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub sort: String,
    pub per_device_memory: bool,
    pub launch_on_startup: bool,
    pub grid_view: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            sort: "currently-playing".into(),
            per_device_memory: true,
            launch_on_startup: false,
            grid_view: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuckingConfig {
    pub enabled: bool,
    pub duck_volume: f32,
    pub fade_ms: u64,
    pub trigger_apps: Vec<String>,
}

impl Default for DuckingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            duck_volume: 20.0,
            fade_ms: 800,
            trigger_apps: vec![
                "discord".into(),
                "teams".into(),
                "zoom".into(),
                "slack".into(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusApp {
    pub exe: String,
    pub volume: Option<f32>,
    pub mute: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NightModeConfig {
    pub enabled: bool,
    pub start: String,
    pub end: String,
    pub max_volume: f32,
}

impl Default for NightModeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            start: "00:00".into(),
            end: "08:00".into(),
            max_volume: 40.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyConfig {
    pub device_limits: BTreeMap<String, f32>,
    pub night: NightModeConfig,
}

impl Default for SafetyConfig {
    fn default() -> Self {
        Self {
            device_limits: BTreeMap::new(),
            night: NightModeConfig::default(),
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileApp {
    pub exe: String,
    pub volume: f32,
    pub mute: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub device_id: Option<String>,
    pub master_volume: Option<f32>,
    pub apps: Vec<ProfileApp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleAction {
    pub kind: String, // "set_volume" | "set_mute" | "set_device" | "activate_profile"
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub enabled: bool,
    pub trigger_kind: String, // "app_start" | "device_connect"
    pub trigger_value: String,
    pub actions: Vec<RuleAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutBinding {
    pub action: String, // "open_quick" | "master_up" | "master_down" | "master_mute" | "focus_toggle"
    pub keys: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub settings: Settings,
    pub profiles: Vec<Profile>,
    pub rules: Vec<Rule>,
    pub ducking: DuckingConfig,
    pub focus_apps: Vec<FocusApp>,
    pub safety: SafetyConfig,
    pub memory: BTreeMap<String, BTreeMap<String, f32>>,
    #[serde(default)]
    pub routing: BTreeMap<String, String>,
    pub shortcuts: Vec<ShortcutBinding>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            settings: Settings::default(),
            profiles: vec![
                Profile {
                    id: "gaming".into(),
                    name: "Gaming".into(),
                    emoji: "\u{1F3AE}".into(),
                    device_id: None,
                    master_volume: Some(80.0),
                    apps: vec![
                        ProfileApp { exe: "spotify".into(), volume: 15.0, mute: false },
                        ProfileApp { exe: "discord".into(), volume: 75.0, mute: false },
                        ProfileApp { exe: "chrome".into(), volume: 20.0, mute: false },
                    ],
                },
                Profile {
                    id: "work".into(),
                    name: "Work".into(),
                    emoji: "\u{1F4BC}".into(),
                    device_id: None,
                    master_volume: Some(55.0),
                    apps: vec![
                        ProfileApp { exe: "discord".into(), volume: 70.0, mute: false },
                        ProfileApp { exe: "chrome".into(), volume: 50.0, mute: false },
                        ProfileApp { exe: "spotify".into(), volume: 15.0, mute: false },
                    ],
                },
                Profile {
                    id: "music".into(),
                    name: "Music".into(),
                    emoji: "\u{1F3B5}".into(),
                    device_id: None,
                    master_volume: Some(65.0),
                    apps: vec![
                        ProfileApp { exe: "spotify".into(), volume: 75.0, mute: false },
                        ProfileApp { exe: "chrome".into(), volume: 35.0, mute: false },
                    ],
                },
            ],
            rules: vec![],
            ducking: DuckingConfig::default(),
            focus_apps: vec![
                FocusApp { exe: "discord".into(), volume: None, mute: Some(true) },
                FocusApp { exe: "spotify".into(), volume: Some(20.0), mute: None },
                FocusApp { exe: "chrome".into(), volume: Some(30.0), mute: None },
                FocusApp { exe: "msedge".into(), volume: Some(30.0), mute: None },
                FocusApp { exe: "system".into(), volume: Some(15.0), mute: None },
            ],
            safety: SafetyConfig::default(),
            memory: BTreeMap::new(),
            routing: BTreeMap::new(),
            shortcuts: vec![
                ShortcutBinding { action: "open_quick".into(), keys: "ctrl+alt+m".into(), enabled: true },
                ShortcutBinding { action: "master_up".into(), keys: "ctrl+alt+up".into(), enabled: true },
                ShortcutBinding { action: "master_down".into(), keys: "ctrl+alt+down".into(), enabled: true },
                ShortcutBinding { action: "master_mute".into(), keys: "ctrl+alt+u".into(), enabled: true },
                ShortcutBinding { action: "focus_toggle".into(), keys: "ctrl+alt+f".into(), enabled: true },
            ],
        }
    }
}

#[derive(Serialize, Clone)]
pub struct AppStateOut {
    pub devices: Vec<DeviceInfo>,
    pub default_device_id: Option<String>,
    pub apps: Vec<AppInfo>,
    pub master: MasterState,
    pub settings: Settings,
    pub profiles: Vec<Profile>,
    pub rules: Vec<Rule>,
    pub ducking: DuckingConfig,
    pub focus_apps: Vec<FocusApp>,
    pub safety: SafetyConfig,
    pub night_active: bool,
    pub focus_active: bool,
    pub ducking_active: bool,
    pub shortcuts: Vec<ShortcutBinding>,
}

