//! Tauri command layer — thin synchronous facade over the engine + store.

use crate::engine::{EngineHandle, EngineMsg};
use crate::store::Store;
use crate::types::*;
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

fn engine<'a>(app: &'a AppHandle) -> &'a EngineHandle {
    app.state::<EngineHandle>().inner()
}

#[tauri::command]
pub fn get_state(
    app: AppHandle,
    store: tauri::State<'_, Arc<Store>>,
) -> Result<AppStateOut, String> {
    let handle = app.state::<EngineHandle>();
    let sh = handle
        .shared
        .lock()
        .map_err(|_| "engine lock poisoned".to_string())?;
    let cfg = store.get();
    Ok(AppStateOut {
        devices: sh.devices.clone(),
        default_device_id: sh.default_id.clone(),
        apps: sh.apps.clone(),
        master: sh.master.clone(),
        settings: cfg.settings.clone(),
        profiles: cfg.profiles.clone(),
        rules: cfg.rules.clone(),
        ducking: cfg.ducking.clone(),
        focus_apps: cfg.focus_apps.clone(),
        safety: cfg.safety.clone(),
        night_active: sh.night_active,
        focus_active: sh.focus_active,
        ducking_active: sh.ducking_active,
        shortcuts: cfg.shortcuts.clone(),
    })
}

#[tauri::command]
pub fn set_master_volume(app: AppHandle, volume: f32) {
    engine(&app).send(EngineMsg::SetMasterVolume(volume));
}

#[tauri::command]
pub fn set_master_mute(app: AppHandle, mute: bool) {
    engine(&app).send(EngineMsg::SetMasterMute(mute));
}

#[tauri::command]
pub fn set_app_volume(app: AppHandle, id: String, volume: f32) {
    engine(&app).send(EngineMsg::SetAppVolume { id, volume });
}

#[tauri::command]
pub fn set_app_mute(app: AppHandle, id: String, mute: bool) {
    engine(&app).send(EngineMsg::SetAppMute { id, mute });
}

#[tauri::command]
pub fn set_app_device(app: AppHandle, id: String, device_id: Option<String>) {
    engine(&app).send(EngineMsg::SetAppDevice { id, device_id });
}

#[tauri::command]
pub fn set_default_device(app: AppHandle, id: String) {
    engine(&app).send(EngineMsg::SetDefaultDevice(id));
}

#[tauri::command]
pub fn refresh_audio(app: AppHandle) {
    engine(&app).send(EngineMsg::Refresh);
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    store: tauri::State<'_, Arc<Store>>,
    settings: Settings,
) -> Result<Settings, String> {
    let previous = store.get().settings;
    let launch_changed = previous.launch_on_startup != settings.launch_on_startup;
    store.update(|cfg| cfg.settings = settings.clone());
    if launch_changed {
        use tauri_plugin_autostart::ManagerExt as _;
        let autostart = app.autolaunch();
        let result = if settings.launch_on_startup {
            autostart.enable()
        } else {
            autostart.disable()
        };
        let _ = result;
    }
    let _ = app.emit("settings", json!({ "settings": settings }));
    Ok(store.get().settings)
}

#[tauri::command]
pub fn save_profiles(
    store: tauri::State<'_, Arc<Store>>,
    profiles: Vec<Profile>,
) -> Result<Vec<Profile>, String> {
    store.update(|cfg| cfg.profiles = profiles.clone());
    Ok(store.get().profiles)
}

#[tauri::command]
pub fn apply_profile(app: AppHandle, id: String) {
    engine(&app).send(EngineMsg::ApplyProfile(id));
}

/// Captures the current mixer state as a new profile.
#[tauri::command]
pub fn capture_profile(
    app: AppHandle,
    store: tauri::State<'_, Arc<Store>>,
    name: String,
    emoji: String,
    device_id: Option<String>,
) -> Result<Profile, String> {
    let handle = app.state::<EngineHandle>();
    let sh = handle
        .shared
        .lock()
        .map_err(|_| "engine lock poisoned".to_string())?;
    let apps = sh
        .apps
        .iter()
        .map(|a| ProfileApp {
            exe: a.exe.clone(),
            volume: a.volume,
            mute: a.mute,
        })
        .collect();
    let profile = Profile {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        emoji,
        device_id,
        master_volume: Some(sh.master.volume),
        apps,
    };
    drop(sh);
    store.update(|cfg| cfg.profiles.insert(0, profile.clone()));
    Ok(profile)
}

#[tauri::command]
pub fn save_rules(
    store: tauri::State<'_, Arc<Store>>,
    rules: Vec<Rule>,
) -> Result<Vec<Rule>, String> {
    store.update(|cfg| cfg.rules = rules.clone());
    Ok(store.get().rules)
}

#[tauri::command]
pub fn set_focus(app: AppHandle, enabled: bool) {
    engine(&app).send(EngineMsg::SetFocus(enabled));
}

#[tauri::command]
pub fn save_focus_apps(
    store: tauri::State<'_, Arc<Store>>,
    focus_apps: Vec<FocusApp>,
) -> Result<Vec<FocusApp>, String> {
    store.update(|cfg| cfg.focus_apps = focus_apps.clone());
    Ok(store.get().focus_apps)
}

#[tauri::command]
pub fn save_ducking(
    store: tauri::State<'_, Arc<Store>>,
    ducking: DuckingConfig,
) -> Result<DuckingConfig, String> {
    store.update(|cfg| cfg.ducking = ducking.clone());
    Ok(store.get().ducking)
}

#[tauri::command]
pub fn save_safety(
    app: AppHandle,
    store: tauri::State<'_, Arc<Store>>,
    safety: SafetyConfig,
) -> Result<SafetyConfig, String> {
    store.update(|cfg| cfg.safety = safety.clone());
    engine(&app).send(EngineMsg::Refresh);
    Ok(store.get().safety)
}

#[tauri::command]
pub fn save_shortcuts(
    app: AppHandle,
    store: tauri::State<'_, Arc<Store>>,
    shortcuts: Vec<ShortcutBinding>,
) -> Result<Vec<ShortcutBinding>, String> {
    store.update(|cfg| cfg.shortcuts = shortcuts.clone());
    crate::shortcuts::register_all(&app)?;
    Ok(store.get().shortcuts)
}

#[tauri::command]
pub fn get_memory(store: tauri::State<'_, Arc<Store>>) -> BTreeMap<String, BTreeMap<String, f32>> {
    store.get().memory
}

#[tauri::command]
pub fn clear_memory(store: tauri::State<'_, Arc<Store>>) {
    store.update(|cfg| cfg.memory.clear());
}

#[tauri::command]
pub fn clear_app_memory(store: tauri::State<'_, Arc<Store>>, exe: String) {
    store.update(|cfg| {
        for (_, mem) in cfg.memory.iter_mut() {
            mem.remove(&exe);
        }
    });
}


// --- window management ------------------------------------------------------

#[tauri::command]
pub fn open_main_mixer(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    if let Some(w) = app.get_webview_window("quick") {
        let _ = w.hide();
    }
    app.state::<crate::UiFlags>()
        .quick_pinned
        .store(false, Ordering::Relaxed);
}

#[tauri::command]
pub fn open_quick_mixer(app: AppHandle) {
    crate::tray::show_quick(&app);
}

#[tauri::command]
pub fn hide_quick_mixer(app: AppHandle) {
    if let Some(w) = app.get_webview_window("quick") {
        let _ = w.hide();
    }
}

#[tauri::command]
pub fn set_quick_pinned(app: AppHandle, pinned: bool) {
    app.state::<crate::UiFlags>()
        .quick_pinned
        .store(pinned, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_tray_pinned(app: AppHandle, pinned: bool) {
    app.state::<crate::UiFlags>()
        .tray_pinned
        .store(pinned, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_main_pinned(app: AppHandle, pinned: bool) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_always_on_top(pinned);
    }
}

#[tauri::command]
pub fn minimize_window(app: AppHandle, label: String) {
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.minimize();
    }
}

#[tauri::command]
pub fn toggle_maximize_window(app: AppHandle, label: String) {
    if let Some(w) = app.get_webview_window(&label) {
        let _ = if w.is_maximized().unwrap_or(false) {
            w.unmaximize()
        } else {
            w.maximize()
        };
    }
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

