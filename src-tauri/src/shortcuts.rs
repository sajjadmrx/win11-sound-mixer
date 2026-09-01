//! Configurable global shortcuts (Ctrl+Alt+M, etc.).

use crate::store::Store;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut,
};

fn normalize_keys(keys: &str) -> String {
    let mut parts: Vec<String> = keys
        .split('+')
        .map(|s| {
            let s = s.trim().to_lowercase();
            match s.as_str() {
                "up" | "arrowup" => "arrowup".to_string(),
                "down" | "arrowdown" => "arrowdown".to_string(),
                "left" | "arrowleft" => "arrowleft".to_string(),
                "right" | "arrowright" => "arrowright".to_string(),
                "win" | "super" | "cmd" | "meta" => "super".to_string(),
                "esc" | "escape" => "escape".to_string(),
                other => other.to_string(),
            }
        })
        .collect();
    parts.join("+")
}

pub fn register_all(app: &AppHandle) -> Result<(), String> {
    let store = app.state::<Arc<Store>>();
    let bindings = store.get().shortcuts;
    let gs = app.global_shortcut();

    let _ = gs.unregister_all();

    for binding in bindings {
        if !binding.enabled || binding.keys.trim().is_empty() {
            continue;
        }
        let normalized = normalize_keys(&binding.keys);
        let shortcut: Result<Shortcut, _> = normalized.parse();
        match shortcut {
            Ok(sc) => {
                let _ = gs.register(sc);
            }
            Err(e) => {
                crate::engine::log(&format!("failed to parse shortcut {}: {:?}", binding.keys, e));
            }
        }
    }
    Ok(())
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut) {
    let store = app.state::<Arc<Store>>();
    let bindings = store.get().shortcuts;
    crate::engine::log(&format!("shortcut event received: {:?}", shortcut));
    for b in bindings {
        if b.enabled && !b.keys.trim().is_empty() {
            let normalized = normalize_keys(&b.keys);
            if let Ok(sc) = normalized.parse::<Shortcut>() {
                if &sc == shortcut {
                    crate::engine::log(&format!("matching shortcut action found: {}", b.action));
                    handle_action(app, &b.action);
                }
            }
        }
    }
}

fn handle_action(app: &AppHandle, action: &str) {
    let engine = app.state::<crate::engine::EngineHandle>();
    use crate::engine::EngineMsg;
    crate::engine::log(&format!("executing shortcut action: {}", action));
    match action {
        "open_quick" => {
            let app_clone = app.clone();
            let _ = app.run_on_main_thread(move || {
                crate::commands::open_quick_mixer(app_clone);
            });
        }
        "open_mixer" => {
            let app_clone = app.clone();
            let _ = app.run_on_main_thread(move || {
                crate::commands::open_main_mixer(app_clone);
            });
        }
        "master_up" => {
            if let Ok(sh) = engine.shared.lock() {
                let v = (sh.master.volume + 5.0).min(100.0);
                engine.send(EngineMsg::SetMasterVolume(v));
            }
        }
        "master_down" => {
            if let Ok(sh) = engine.shared.lock() {
                let v = (sh.master.volume - 5.0).max(0.0);
                engine.send(EngineMsg::SetMasterVolume(v));
            }
        }
        "master_mute" => {
            if let Ok(sh) = engine.shared.lock() {
                let mute = !sh.master.mute;
                engine.send(EngineMsg::SetMasterMute(mute));
            }
        }
        "focus_toggle" => {
            if let Ok(sh) = engine.shared.lock() {
                let on = !sh.focus_active;
                engine.send(EngineMsg::SetFocus(on));
            }
        }
        _ => {}
    }
}
