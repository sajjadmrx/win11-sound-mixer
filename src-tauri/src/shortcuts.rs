//! Configurable global shortcuts (Ctrl+Alt+M, etc.).

use crate::store::Store;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut,
};

pub fn register_all(app: &AppHandle) -> Result<(), String> {
    let store = app.state::<Arc<Store>>();
    let bindings = store.get().shortcuts;
    let gs = app.global_shortcut();

    let _ = gs.unregister_all();

    for binding in bindings {
        if !binding.enabled || binding.keys.trim().is_empty() {
            continue;
        }
        let shortcut: Result<Shortcut, _> = binding.keys.parse();
        match shortcut {
            Ok(sc) => {
                let _ = gs.register(sc);
            }
            Err(_) => {}
        }
    }
    Ok(())
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut) {
    let store = app.state::<Arc<Store>>();
    let bindings = store.get().shortcuts;
    for b in bindings {
        if b.enabled && !b.keys.trim().is_empty() {
            if let Ok(sc) = b.keys.parse::<Shortcut>() {
                if &sc == shortcut {
                    handle_action(app, &b.action);
                }
            }
        }
    }
}

fn handle_action(app: &AppHandle, action: &str) {
    let engine = app.state::<crate::engine::EngineHandle>();
    use crate::engine::EngineMsg;
    match action {
        "open_quick" => crate::tray::show_quick(app),
        "open_mixer" => crate::commands::open_main_mixer(app.clone()),
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
