//! Mixero — premium Windows audio mixer.

mod commands;
mod engine;
mod icons;
mod naming;
mod policy;
mod shortcuts;
mod store;
mod tray;
mod types;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{Manager, WindowEvent};

/// UI flags shared between commands and window event handlers.
pub struct UiFlags {
    pub quick_pinned: AtomicBool,
    pub tray_pinned: AtomicBool,
}

#[cfg(windows)]
fn round_corners(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
    };
    if let Ok(hwnd) = window.hwnd() {
        let pref = DWMWCP_ROUND.0 as u32;
        unsafe {
            let _ = DwmSetWindowAttribute(
                HWND(hwnd.0),
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &pref as *const u32 as *const _,
                4,
            );
        }
    }
}

#[cfg(not(windows))]
fn round_corners(_window: &tauri::WebviewWindow) {}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        shortcuts::handle_shortcut_event(app, shortcut);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let store = Arc::new(store::Store::load(&data_dir));
            app.manage(store.clone());

            let engine_handle = engine::spawn(app.handle().clone(), store.clone(), data_dir);
            app.manage(engine_handle);

            app.manage(UiFlags {
                quick_pinned: AtomicBool::new(false),
                tray_pinned: AtomicBool::new(false),
            });

            tray::setup_tray(app)?;
            shortcuts::register_all(app.handle())
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

            // Rounded corners for the frameless windows (Windows 11).
            for label in ["main", "quick", "tray"] {
                if let Some(w) = app.get_webview_window(label) {
                    round_corners(&w);
                }
            }

            // Main window: close to tray instead of exiting.
            if let Some(main) = app.get_webview_window("main") {
                let h = app.handle().clone();
                main.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = h.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            }

            // Popups hide when they lose focus unless pinned.
            for label in ["quick", "tray"] {
                if let Some(w) = app.get_webview_window(label) {
                    let h = app.handle().clone();
                    let label = label.to_string();
                    w.on_window_event(move |event| {
                        if let WindowEvent::Focused(false) = event {
                            let flags = h.state::<UiFlags>();
                            let pinned = match label.as_str() {
                                "quick" => flags.quick_pinned.load(std::sync::atomic::Ordering::Relaxed),
                                _ => flags.tray_pinned.load(std::sync::atomic::Ordering::Relaxed),
                            };
                            if !pinned {
                                if let Some(win) = h.get_webview_window(&label) {
                                    let _ = win.hide();
                                    if label == "quick" {
                                        flags.quick_pinned.store(false, std::sync::atomic::Ordering::Relaxed);
                                    } else {
                                        flags.tray_pinned.store(false, std::sync::atomic::Ordering::Relaxed);
                                    }
                                }
                            }
                        }
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::set_master_volume,
            commands::set_master_mute,
            commands::set_app_volume,
            commands::set_app_mute,
            commands::set_app_device,
            commands::set_default_device,
            commands::refresh_audio,
            commands::save_settings,
            commands::save_profiles,
            commands::apply_profile,
            commands::capture_profile,
            commands::save_rules,
            commands::set_focus,
            commands::save_focus_apps,
            commands::save_ducking,
            commands::save_safety,
            commands::save_shortcuts,
            commands::get_memory,
            commands::clear_memory,
            commands::clear_app_memory,
            commands::open_main_mixer,
            commands::open_quick_mixer,
            commands::hide_quick_mixer,
            commands::set_quick_pinned,
            commands::set_tray_pinned,
            commands::set_main_pinned,
            commands::minimize_window,
            commands::toggle_maximize_window,
            commands::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mixero");
}
