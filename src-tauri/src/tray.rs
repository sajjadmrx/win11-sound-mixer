//! System tray: icon + custom popup menu window (styled like the prototype).
//! The popup is a frameless always-on-top window running the `#/tray` view.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, PhysicalPosition,
};

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    // Native fallback menu (right-click) kept minimal; primary interaction is
    // the styled popup window on click.
    let open = MenuItem::with_id(app, "open", "Open Mixer", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Mixero", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let _tray = TrayIconBuilder::with_id("mixero-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Mixero — Audio Mixer")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => crate::commands::open_main_mixer(app.clone()),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                position,
                ..
            } = event
            {
                toggle_tray_popup(tray.app_handle(), position);
            }
        })
        .build(app)?;
    Ok(())
}

/// Shows/hides the styled popup anchored above the tray cursor position.
pub fn toggle_tray_popup(app: &AppHandle, cursor: PhysicalPosition<f64>) {
    let Some(window) = app.get_webview_window("tray") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    position_popup(&window, cursor);
    let _ = window.show();
    let _ = window.set_focus();
}

/// Positions a popup window just above the given physical cursor position,
/// clamped to the monitor bounds.
pub fn position_popup(window: &tauri::WebviewWindow, cursor: PhysicalPosition<f64>) {
    let size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(300, 380));
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    let (mw, mh) = monitor
        .map(|m| (m.size().width as f64, m.size().height as f64))
        .unwrap_or((1920.0, 1080.0));
    let w = size.width as f64;
    let h = size.height as f64;
    let mut x = cursor.x - w + 24.0;
    let mut y = cursor.y - h - 8.0;
    x = x.clamp(8.0, (mw - w - 8.0).max(8.0));
    y = y.clamp(8.0, (mh - h - 8.0).max(8.0));
    let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
}

/// Shows the Quick Mixer overlay anchored at the bottom-right of the primary
/// monitor (above the taskbar).
pub fn show_quick(app: &AppHandle) {
    let Some(window) = app.get_webview_window("quick") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    let scale = window.scale_factor().unwrap_or(1.0);
    if let Some(monitor) = window.primary_monitor().ok().flatten() {
        let size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(372, 430));
        let msize = monitor.size();
        let mpos = monitor.position();
        // Reserve room for the Windows taskbar.
        let taskbar = if scale > 1.0 { 60.0 * scale } else { 48.0 };
        let x = mpos.x as f64 + msize.width as f64 - size.width as f64 - 16.0 * scale;
        let y = mpos.y as f64 + msize.height as f64 - size.height as f64 - taskbar;
        let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
    }
    let _ = window.show();
    let _ = window.set_focus();
}
