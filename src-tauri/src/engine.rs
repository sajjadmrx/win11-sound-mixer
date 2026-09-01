//! Audio engine — owns all COM audio objects on a dedicated thread.
//!
//! Commands arrive via an mpsc channel, the engine performs the Windows audio
//! work (WASAPI), keeps an aggregated view of devices/apps and pushes batched
//! updates to the frontend through Tauri events. Event-driven where Windows
//! offers callbacks (device notifications, session events, endpoint volume
//! callback, session-created notification), with a slow structural poll as a
//! safety net and a ~30 Hz metering loop for audio activity.

use crate::naming;
use crate::policy;
use crate::store::Store;
use crate::types::*;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use windows::core::{Interface, PCWSTR, BOOL};
use windows::Win32::Media::Audio::{
    eCommunications, eMultimedia, eRender, AudioSessionDisconnectReason, AudioSessionState,
    AudioSessionStateActive, AUDIO_VOLUME_NOTIFICATION_DATA, DEVICE_STATEMASK_ALL,
    IAudioSessionControl, IAudioSessionControl2, IAudioSessionEnumerator, IAudioSessionEvents,
    IAudioSessionManager2, IAudioSessionNotification, IMMDevice, IMMDeviceCollection,
    IMMDeviceEnumerator, IMMNotificationClient, ISimpleAudioVolume, MMDeviceEnumerator,
};
use windows::Win32::Media::Audio::Endpoints::{
    IAudioEndpointVolume, IAudioEndpointVolumeCallback, IAudioMeterInformation,
};
use windows::Win32::Devices::FunctionDiscovery::{
    PKEY_Device_DeviceDesc, PKEY_Device_FriendlyName,
};
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ,
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

pub enum EngineMsg {
    SetMasterVolume(f32),
    SetMasterMute(bool),
    SetAppVolume { id: String, volume: f32 },
    SetAppMute { id: String, mute: bool },
    SetAppDevice { id: String, device_id: Option<String> },
    SetDefaultDevice(String),
    Refresh,
    ApplyProfile(String),
    SetFocus(bool),
    IconLoaded { id: String, icon: Option<String> },
    SessionCreated,
    SessionVolumeChanged { sid: String, volume: f32, mute: bool },
    DeviceEvent,
    MasterEndpointChanged,
}

/// Snapshot shared with the Tauri command layer for fast synchronous reads.
pub struct Shared {
    pub apps: Vec<AppInfo>,
    pub devices: Vec<DeviceInfo>,
    pub default_id: Option<String>,
    pub master: MasterState,
    pub focus_active: bool,
    pub ducking_active: bool,
    pub night_active: bool,
}

pub struct EngineHandle {
    pub tx: Sender<EngineMsg>,
    pub shared: Arc<Mutex<Shared>>,
}

impl EngineHandle {
    pub fn send(&self, msg: EngineMsg) {
        let _ = self.tx.send(msg);
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn log(msg: &str) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    eprintln!("[mixero:audio] [{}] {}", now, msg);
}

pub fn spawn(app: AppHandle, store: Arc<Store>, data_dir: PathBuf) -> EngineHandle {
    let (tx, rx) = std::sync::mpsc::channel();
    let shared = Arc::new(Mutex::new(Shared {
        apps: vec![],
        devices: vec![],
        default_id: None,
        master: MasterState { volume: 100.0, mute: false, device_id: None },
        focus_active: false,
        ducking_active: false,
        night_active: false,
    }));
    let handle = EngineHandle {
        tx: tx.clone(),
        shared: shared.clone(),
    };
    std::thread::Builder::new()
        .name("audio-engine".into())
        .spawn(move || {
            let mut engine = Engine::new(app, store, tx.clone(), rx, shared, data_dir);
            engine.run();
        })
        .expect("failed to spawn audio engine thread");
    handle
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

struct SessionHandle {
    control: IAudioSessionControl,
    control2: Option<IAudioSessionControl2>,
    simple: ISimpleAudioVolume,
    meter: Option<IAudioMeterInformation>,
    events: IAudioSessionEvents,
    sid: String,
    exe: String,
    volume: f32,
    mute: bool,
    peak: f32,
}

#[derive(Clone)]
struct AppAgg {
    id: String,
    exe: String,
    volume: f32,
    mute: bool,
    peak: f32,
    active: bool,
    pid: u32,
    icon: Option<String>,
    routed_device: Option<String>,
    last_active: i64,
    session_count: usize,
}

#[derive(PartialEq, Clone, Copy)]
enum DuckPhase {
    Idle,
    Engaged,
}

struct DueTask {
    at: Instant,
    kind: DueKind,
}

enum DueKind {
    RestoreDefault(String),
    ApplyMemory { exe: String, device: Option<String> },
}

struct FocusSnapshot {
    master_volume: f32,
    master_mute: bool,
    apps: Vec<(String, f32, bool)>,
}

struct Engine {
    app: AppHandle,
    store: Arc<Store>,
    tx: Sender<EngineMsg>,
    rx: Receiver<EngineMsg>,
    shared: Arc<Mutex<Shared>>,
    #[allow(dead_code)]
    icon_cache: crate::icons::IconCache,

    enumerator: Option<IMMDeviceEnumerator>,
    device_notifier: Option<IMMNotificationClient>,
    endpoint_vol: Option<IAudioEndpointVolume>,
    endpoint_cb: Option<IAudioEndpointVolumeCallback>,
    session_mgr: Option<IAudioSessionManager2>,
    session_notifier: Option<IAudioSessionNotification>,
    endpoint_vol_id: Option<String>,

    sessions: HashMap<String, SessionHandle>,
    apps: HashMap<String, AppAgg>,
    recent: HashMap<String, i64>,
    icon_requested: HashSet<String>,

    devices: Vec<DeviceInfo>,
    default_id: Option<String>,
    comm_id: Option<String>,
    master: MasterState,

    focus_active: bool,
    focus_snapshot: Option<FocusSnapshot>,
    duck_active: bool,
    duck_phase: DuckPhase,
    duck_originals: HashMap<String, f32>,
    duck_trigger_since: Option<Instant>,
    duck_silent_since: Option<Instant>,
    night_active: bool,

    due: Vec<DueTask>,
    suppressed: HashSet<String>,
    last_struct_poll: Instant,
    last_night_check: Instant,
    dirty_apps: bool,
    dirty_devices: bool,
    dirty_master: bool,
}

impl Engine {
    #[allow(clippy::too_many_arguments)]
    fn new(
        app: AppHandle,
        store: Arc<Store>,
        tx: Sender<EngineMsg>,
        rx: Receiver<EngineMsg>,
        shared: Arc<Mutex<Shared>>,
        data_dir: PathBuf,
    ) -> Self {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
        let icon_cache = crate::icons::IconCache::new(data_dir.join("icons"));
        Self {
            app,
            store,
            tx,
            rx,
            shared,
            icon_cache,
            enumerator: None,
            device_notifier: None,
            endpoint_vol: None,
            endpoint_cb: None,
            session_mgr: None,
            session_notifier: None,
            endpoint_vol_id: None,
            sessions: HashMap::new(),
            apps: HashMap::new(),
            recent: HashMap::new(),
            icon_requested: HashSet::new(),
            devices: vec![],
            default_id: None,
            comm_id: None,
            master: MasterState { volume: 100.0, mute: false, device_id: None },
            focus_active: false,
            focus_snapshot: None,
            duck_active: false,
            duck_phase: DuckPhase::Idle,
            duck_originals: HashMap::new(),
            duck_trigger_since: None,
            duck_silent_since: None,
            night_active: false,
            due: vec![],
            suppressed: HashSet::new(),
            last_struct_poll: Instant::now() - Duration::from_secs(10),
            last_night_check: Instant::now() - Duration::from_secs(10),
            dirty_apps: true,
            dirty_devices: true,
            dirty_master: true,
        }
    }

    fn run(&mut self) {
        unsafe {
            match CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                Ok(e) => {
                    let notifier = DeviceNotifier { tx: self.tx.clone() };
                    let nc: IMMNotificationClient = notifier.into();
                    if let Err(err) = e.RegisterEndpointNotificationCallback(&nc) {
                        log(&format!("device notification registration failed: {err}"));
                    }
                    self.device_notifier = Some(nc);
                    self.enumerator = Some(e);
                }
                Err(err) => log(&format!("MMDeviceEnumerator failed: {err}")),
            }
        }
        self.refresh_endpoints();
        self.refresh_devices();
        self.refresh_sessions();
        loop {
            match self.rx.recv_timeout(Duration::from_millis(33)) {
                Ok(msg) => self.handle_msg(msg),
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => break,
            }
            let now = Instant::now();
            if now.duration_since(self.last_struct_poll) > Duration::from_millis(1200) {
                self.refresh_endpoints();
                self.refresh_devices();
                self.refresh_sessions();
                self.suppressed.clear();
                self.last_struct_poll = now;
            }
            self.poll_meters();
            self.process_due();
            self.tick_ducking();
            if now.duration_since(self.last_night_check) > Duration::from_secs(1) {
                self.tick_night();
                self.last_night_check = now;
            }
            self.flush_updates();
        }
    }
}

// ---------------------------------------------------------------------------
// COM: endpoints, devices, sessions, meters
// ---------------------------------------------------------------------------

fn pw_to_string(pw: windows::core::PWSTR) -> String {
    unsafe {
        let s = pw.to_string().unwrap_or_default();
        CoTaskMemFree(Some(pw.as_ptr() as *const _));
        s
    }
}

fn propvariant_to_string(v: &windows::Win32::System::Com::StructuredStorage::PROPVARIANT) -> Option<String> {
    unsafe {
        let pw = PropVariantToStringAlloc(v).ok()?;
        Some(pw_to_string(pw))
    }
}

fn classify_device(name: &str, desc: &str) -> String {
    let hay = format!("{} {}", name, desc).to_lowercase();
    if hay.contains("headphone") || hay.contains("headset") || hay.contains("earphone") {
        "headphones".into()
    } else if hay.contains("hdmi") || hay.contains("digital") || hay.contains("displayport") || hay.contains("s/pdif") || hay.contains("spdif") {
        "hdmi".into()
    } else if hay.contains("bluetooth") || hay.contains("wh-1000") || hay.contains("airpod") {
        "bluetooth".into()
    } else if hay.contains("usb") {
        "usb".into()
    } else if hay.contains("virtual") || hay.contains("cable") {
        "virtual".into()
    } else if hay.contains("monitor") || hay.contains("speaker") || hay.contains("realtek") {
        "speakers".into()
    } else {
        "other".into()
    }
}

fn devices_changed(a: &[DeviceInfo], b: &[DeviceInfo]) -> bool {
    if a.len() != b.len() {
        return true;
    }
    for (x, y) in a.iter().zip(b.iter()) {
        if x.id != y.id
            || x.name != y.name
            || x.state != y.state
            || x.is_default != y.is_default
            || x.is_default_communications != y.is_default_communications
        {
            return true;
        }
    }
    false
}

impl Engine {
    /// Re-opens the endpoint volume + session manager for the current default
    /// render device and re-reads the master volume/mute.
    fn refresh_endpoints(&mut self) {
        let Some(enumerator) = self.enumerator.clone() else { return };
        unsafe {
            let default: IMMDevice = match enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                Ok(d) => d,
                Err(err) => {
                    log(&format!("no default render device: {err}"));
                    return;
                }
            };
            let dev_id = pw_to_string(match default.GetId() {
                Ok(id) => id,
                Err(_) => return,
            });
            if self.endpoint_vol_id.as_deref() == Some(dev_id.as_str()) {
                return; // unchanged
            }
            let vol: Result<IAudioEndpointVolume, _> = default.Activate(CLSCTX_ALL, None);
            let mgr: Result<IAudioSessionManager2, _> = default.Activate(CLSCTX_ALL, None);
            match (vol, mgr) {
                (Ok(vol), Ok(mgr)) => {
                    let cb = EndpointVolumeCb { tx: self.tx.clone() };
                    let cb: IAudioEndpointVolumeCallback = cb.into();
                    let _ = vol.RegisterControlChangeNotify(&cb);
                    self.endpoint_cb = Some(cb);

                    let sn = SessionNotifier { tx: self.tx.clone() };
                    let sn: IAudioSessionNotification = sn.into();
                    if let Err(err) = mgr.RegisterSessionNotification(&sn) {
                        log(&format!("session notification unavailable: {err}"));
                    }
                    self.session_notifier = Some(sn);
                    let mv = vol.GetMasterVolumeLevelScalar().unwrap_or(1.0) * 100.0;
                    let mute = vol.GetMute().map(|m| m.as_bool()).unwrap_or(false);
                    self.endpoint_vol = Some(vol);
                    self.session_mgr = Some(mgr);
                    self.endpoint_vol_id = Some(dev_id.clone());
                    self.master = MasterState { volume: mv, mute, device_id: Some(dev_id.clone()) };
                    self.default_id = Some(dev_id);
                    self.dirty_master = true;
                    self.dirty_devices = true;
                    // Per-device memory re-application on default device change.
                    let cfg = self.store.get();
                    if cfg.settings.per_device_memory {
                        for exe in self.apps.keys().cloned().collect::<Vec<_>>() {
                            self.due.push(DueTask {
                                at: Instant::now() + Duration::from_millis(600),
                                kind: DueKind::ApplyMemory { exe, device: self.default_id.clone() },
                            });
                        }
                    }
                }
                (Err(err), _) | (_, Err(err)) => log(&format!("device activate failed: {err}")),
            }
        }
    }
}

impl Engine {
    unsafe fn device_names(&self, dev: &IMMDevice) -> (String, String) {
        let mut name = String::new();
        let mut desc = String::new();
        if let Ok(store) = dev.OpenPropertyStore(STGM_READ) {
            if let Ok(v) = store.GetValue(&PKEY_Device_FriendlyName) {
                if let Some(s) = propvariant_to_string(&v) {
                    name = s;
                }
            }
            if let Ok(v) = store.GetValue(&PKEY_Device_DeviceDesc) {
                if let Some(s) = propvariant_to_string(&v) {
                    desc = s;
                }
            }
        }
        // FriendlyName looks like "Speakers (Realtek High Definition Audio)".
        if let (Some(open), Some(close)) = (name.find(" ("), name.rfind(')')) {
            if close > open {
                let inner = name[open + 2..close].to_string();
                let outer = name[..open].to_string();
                if !inner.is_empty() {
                    desc = inner;
                    name = outer;
                }
            }
        }
        if name.is_empty() {
            name = if desc.is_empty() { "Audio Device".to_string() } else { desc.clone() };
        }
        (name, desc)
    }

    fn refresh_devices(&mut self) {
        let Some(enumerator) = self.enumerator.clone() else { return };
        unsafe {
            let coll: IMMDeviceCollection = match enumerator.EnumAudioEndpoints(
                eRender,
                windows::Win32::Media::Audio::DEVICE_STATE(DEVICE_STATEMASK_ALL),
            ) {
                Ok(c) => c,
                Err(_) => return,
            };
            let count = coll.GetCount().unwrap_or(0);
            let def_id = enumerator
                .GetDefaultAudioEndpoint(eRender, eMultimedia)
                .ok()
                .and_then(|d| d.GetId().ok())
                .map(pw_to_string);
            let comm_id = enumerator
                .GetDefaultAudioEndpoint(eRender, eCommunications)
                .ok()
                .and_then(|d| d.GetId().ok())
                .map(pw_to_string);
            let mut devices = Vec::new();
            for i in 0..count {
                let dev: IMMDevice = match coll.Item(i) {
                    Ok(d) => d,
                    Err(_) => continue,
                };
                let id = match dev.GetId() {
                    Ok(id) => pw_to_string(id),
                    Err(_) => continue,
                };
                let (name, desc) = self.device_names(&dev);
                let state = dev.GetState().map(|s| s.0).unwrap_or(0);
                let state_str = match state {
                    1 => "active",
                    2 => "disabled",
                    4 => "notpresent",
                    8 => "unplugged",
                    _ => "unknown",
                };
                let kind = classify_device(&name, &desc);
                let max_volume = self
                    .store
                    .get()
                    .safety
                    .device_limits
                    .get(&id)
                    .copied()
                    .unwrap_or(100.0);
                devices.push(DeviceInfo {
                    is_default: def_id.as_deref() == Some(id.as_str()),
                    is_default_communications: comm_id.as_deref() == Some(id.as_str()),
                    id,
                    name,
                    description: desc,
                    kind,
                    state: state_str.into(),
                    max_volume,
                });
            }
            devices.sort_by(|a, b| {
                b.is_default
                    .cmp(&a.is_default)
                    .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            });
            if devices_changed(&self.devices, &devices) {
                self.devices = devices;
                self.default_id = def_id;
                self.comm_id = comm_id;
                self.dirty_devices = true;
            }
        }
    }
}

impl Engine {
    fn refresh_sessions(&mut self) {
        let Some(mgr) = self.session_mgr.clone() else { return };
        unsafe {
            let enumr: IAudioSessionEnumerator = match mgr.GetSessionEnumerator() {
                Ok(e) => e,
                Err(err) => {
                    log(&format!("GetSessionEnumerator failed: {err}"));
                    return;
                }
            };
            let count = enumr.GetCount().unwrap_or(0);
            let mut seen: HashSet<String> = HashSet::new();
            for i in 0..count {
                let control: IAudioSessionControl = match enumr.GetSession(i) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let control2: IAudioSessionControl2 = match control.cast() {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let sid = match control2.GetSessionInstanceIdentifier() {
                    Ok(id) => pw_to_string(id),
                    Err(_) => format!("session-{i}"),
                };
                seen.insert(sid.clone());
                if self.sessions.contains_key(&sid) {
                    continue;
                }
                let simple: ISimpleAudioVolume = match control.cast() {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                let meter: Option<IAudioMeterInformation> = control.cast().ok();
                let is_system = control2.IsSystemSoundsSession() == windows::Win32::Foundation::S_OK;
                let pid = control2.GetProcessId().unwrap_or(0);
                let exe = if is_system || pid == 0 {
                    "system".to_string()
                } else {
                    crate::icons::exe_path_for_pid(pid)
                        .as_deref()
                        .map(|p| {
                            std::path::Path::new(p)
                                .file_stem()
                                .map(|s| s.to_string_lossy().to_lowercase())
                                .unwrap_or_default()
                        })
                        .filter(|s| !s.is_empty())
                        .unwrap_or(format!("pid{pid}"))
                };
                let volume = simple.GetMasterVolume().unwrap_or(1.0) * 100.0;
                let mute = simple.GetMute().map(|m| m.as_bool()).unwrap_or(false);
                // Register per-session event callback (event-driven updates).
                let sid_key = sid.clone();
                let ev = SessionEvents { tx: self.tx.clone(), sid: sid_key.clone() };
                let ev: IAudioSessionEvents = ev.into();
                let _ = control.RegisterAudioSessionNotification(&ev);

                let routing = self.store.get().routing.get(&exe).cloned();
                let is_new_app = !self.apps.contains_key(&exe);
                self.sessions.insert(
                    sid_key,
                    SessionHandle {
                        control,
                        control2: Some(control2),
                        simple,
                        meter,
                        events: ev,
                        sid,
                        exe: exe.clone(),
                        volume,
                        mute,
                        peak: 0.0,
                    },
                );
                self.update_app_agg(&exe);
                if is_new_app {
                    self.on_app_started(&exe, routing);
                }
            }
            // Remove sessions that disappeared.
            let gone: Vec<String> = self
                .sessions
                .keys()
                .filter(|k| !seen.contains(*k))
                .cloned()
                .collect();
            for sid in gone {
                if let Some(s) = self.sessions.remove(&sid) {
                    let _ = s.control.UnregisterAudioSessionNotification(&s.events);
                    if !self.sessions.values().any(|x| x.exe == s.exe) {
                        self.on_app_stopped(&s.exe);
                    }
                }
            }
        }
    }

    fn poll_meters(&mut self) {
        unsafe {
            let mut touched: HashSet<String> = HashSet::new();
            let sids: Vec<String> = self.sessions.keys().cloned().collect();
            for sid in sids {
                let Some(sess) = self.sessions.get_mut(&sid) else { continue };
                let peak = sess
                    .meter
                    .as_ref()
                    .and_then(|m| m.GetPeakValue().ok())
                    .unwrap_or(0.0);
                if (peak - sess.peak).abs() > 0.003 {
                    sess.peak = peak;
                    touched.insert(sess.exe.clone());
                }
            }
            for exe in touched {
                self.update_app_agg(&exe);
                self.dirty_apps = true;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Message handling + volume/mute setters
// ---------------------------------------------------------------------------

impl Engine {
    fn handle_msg(&mut self, msg: EngineMsg) {
        match msg {
            EngineMsg::SetMasterVolume(v) => self.set_master_volume(v),
            EngineMsg::SetMasterMute(m) => self.set_master_mute(m),
            EngineMsg::SetAppVolume { id, volume } => self.set_app_volume(&id, volume, true),
            EngineMsg::SetAppMute { id, mute } => self.set_app_mute(&id, mute),
            EngineMsg::SetAppDevice { id, device_id } => self.set_app_device(&id, device_id),
            EngineMsg::SetDefaultDevice(id) => self.set_default_device(&id),
            EngineMsg::Refresh => {
                self.refresh_endpoints();
                self.refresh_devices();
                self.refresh_sessions();
            }
            EngineMsg::ApplyProfile(id) => self.apply_profile(&id),
            EngineMsg::SetFocus(on) => self.set_focus(on),
            EngineMsg::IconLoaded { id, icon } => {
                if let Some(app) = self.apps.get_mut(&id) {
                    app.icon = icon.clone();
                }
                self.dirty_apps = true;
                if let Some(icon) = icon {
                    let _ = self.app.emit("app-icon", json!({ "id": id, "icon": icon }));
                }
            }
            EngineMsg::SessionCreated => {
                self.refresh_sessions();
            }
            EngineMsg::SessionVolumeChanged { sid, volume, mute } => {
                if self.suppressed.remove(&sid) {
                    // Echo of our own change — cache is already correct.
                    return;
                }
                if let Some(sess) = self.sessions.get_mut(&sid) {
                    sess.volume = volume * 100.0;
                    sess.mute = mute;
                    let exe = sess.exe.clone();
                    self.update_app_agg(&exe);
                    self.dirty_apps = true;
                }
            }
            EngineMsg::DeviceEvent => {
                self.refresh_endpoints();
                self.refresh_devices();
                self.run_device_connect_rules();
            }
            EngineMsg::MasterEndpointChanged => unsafe {
                if let Some(vol) = &self.endpoint_vol {
                    let v = vol.GetMasterVolumeLevelScalar().unwrap_or(0.0) * 100.0;
                    let m = vol.GetMute().map(|m| m.as_bool()).unwrap_or(false);
                    self.master.volume = v;
                    self.master.mute = m;
                    self.dirty_master = true;
                }
            },
        }
    }

    fn set_master_volume(&mut self, v: f32) {
        log(&format!("set_master_volume: v={}", v));
        let clamped = self.clamp_master(v);
        unsafe {
            if let Some(vol) = &self.endpoint_vol {
                if let Err(e) = vol.SetMasterVolumeLevelScalar(clamped / 100.0, std::ptr::null()) {
                    log(&format!("SetMasterVolumeLevelScalar failed: {:?}", e));
                }
            }
        }
        self.master.volume = clamped;
        self.dirty_master = true;
    }

    fn set_master_mute(&mut self, mute: bool) {
        log(&format!("set_master_mute: mute={}", mute));
        unsafe {
            if let Some(vol) = &self.endpoint_vol {
                if let Err(e) = vol.SetMute(mute, std::ptr::null()) {
                    log(&format!("SetMute failed: {:?}", e));
                }
            }
        }
        self.master.mute = mute;
        self.dirty_master = true;
    }

    fn set_app_volume(&mut self, id: &str, volume: f32, learn: bool) {
        let v = self.clamp_app_volume(id, volume);
        for sess in self.sessions.values_mut().filter(|s| s.exe == id) {
            let _ = unsafe { sess.simple.SetMasterVolume(v / 100.0, std::ptr::null()) };
            sess.volume = v;
            self.suppressed.insert(sess.sid.clone());
        }
        if let Some(app) = self.apps.get_mut(id) {
            app.volume = v;
            self.dirty_apps = true;
        }
        // Learn per-device memory (skipped while a temporary scene is active).
        let cfg = self.store.get();
        if learn && cfg.settings.per_device_memory && !self.focus_active && !self.duck_active {
            let device = self.current_device_for(id).unwrap_or_else(|| "default".into());
            let mut next = cfg;
            next.memory.entry(device).or_default().insert(id.to_string(), v);
            self.store.replace(next);
        }
    }

    fn set_app_mute(&mut self, id: &str, mute: bool) {
        log(&format!("set_app_mute: id={}, mute={}", id, mute));
        unsafe {
            for sess in self.sessions.values_mut().filter(|s| s.exe == id) {
                if let Err(e) = sess.simple.SetMute(mute, std::ptr::null()) {
                    log(&format!("SetMute failed on session {}: {:?}", sess.sid, e));
                }
                sess.mute = mute;
                self.suppressed.insert(sess.sid.clone());
            }
        }
        if let Some(app) = self.apps.get_mut(id) {
            app.mute = mute;
            self.dirty_apps = true;
        }
    }

    fn set_default_device(&mut self, id: &str) {
        log(&format!("set_default_device: id={}", id));
        if let Err(err) = policy::set_default_endpoint(id) {
            log(&err);
            return;
        }
        self.endpoint_vol_id = None;
        self.refresh_endpoints();
        self.refresh_devices();
        self.refresh_sessions();
    }
}

// ---------------------------------------------------------------------------
// Routing, due tasks, app lifecycle, icons
// ---------------------------------------------------------------------------

impl Engine {
    fn set_app_device(&mut self, id: &str, device_id: Option<String>) {
        self.store.update(|cfg| match &device_id {
            Some(dev) => {
                cfg.routing.insert(id.to_string(), dev.clone());
            }
            None => {
                cfg.routing.remove(id);
            }
        });
        if let Some(app) = self.apps.get_mut(id) {
            app.routed_device = device_id.clone();
            self.dirty_apps = true;
        }
        self.route_app(id, device_id);
    }

    /// Smart routing: temporarily make the target device the default so the
    /// app's streams bind to it, then restore the previous default. Windows
    /// binds streams to a device at creation time — this is the practical
    /// mechanism used for per-app routing.
    fn route_app(&mut self, id: &str, device_id: Option<String>) {
        let Some(target) = device_id else { return };
        if self.default_id.as_deref() == Some(target.as_str()) {
            return;
        }
        let Some(previous) = self.default_id.clone() else { return };
        if policy::set_default_endpoint(&target).is_err() {
            log("routing: failed to switch default device");
            return;
        }
        let delay = if self.apps.contains_key(id) { 2500 } else { 1500 };
        self.due.push(DueTask {
            at: Instant::now() + Duration::from_millis(delay),
            kind: DueKind::RestoreDefault(previous),
        });
        self.due.push(DueTask {
            at: Instant::now() + Duration::from_millis(delay + 400),
            kind: DueKind::ApplyMemory { exe: id.to_string(), device: Some(target) },
        });
    }

    fn process_due(&mut self) {
        let now = Instant::now();
        let mut i = 0;
        while i < self.due.len() {
            if self.due[i].at <= now {
                let task = self.due.remove(i);
                match task.kind {
                    DueKind::RestoreDefault(dev) => {
                        let _ = policy::set_default_endpoint(&dev);
                        self.endpoint_vol_id = None;
                        self.refresh_endpoints();
                    }
                    DueKind::ApplyMemory { exe, device } => {
                        let cfg = self.store.get();
                        if !cfg.settings.per_device_memory {
                            continue;
                        }
                        let dev = device.or_else(|| self.current_device_for(&exe));
                        let Some(dev) = dev else { continue };
                        if let Some(vol) = cfg.memory.get(&dev).and_then(|m| m.get(&exe)).copied() {
                            if self.apps.contains_key(&exe) {
                                self.set_app_volume(&exe, vol, false);
                            }
                        }
                    }
                }
            } else {
                i += 1;
            }
        }
    }

    fn on_app_started(&mut self, exe: &str, routing: Option<String>) {
        self.recent.insert(exe.to_string(), now_ms());
        let mut routed = routing;
        if let Some(app) = self.apps.get(exe) {
            routed = routed.or_else(|| app.routed_device.clone());
        }
        self.apps.insert(
            exe.to_string(),
            AppAgg {
                id: exe.to_string(),
                exe: exe.to_string(),
                volume: 100.0,
                mute: false,
                peak: 0.0,
                active: true,
                pid: 0,
                icon: None,
                routed_device: routed.clone(),
                last_active: now_ms(),
                session_count: 1,
            },
        );
        self.update_app_agg(exe);
        self.dirty_apps = true;
        self.request_icon(exe);
        self.run_app_start_rules(exe);
        self.due.push(DueTask {
            at: Instant::now() + Duration::from_millis(300),
            kind: DueKind::ApplyMemory { exe: exe.to_string(), device: None },
        });
        if let Some(target) = routed {
            self.route_app(exe, Some(target));
        }
    }

    fn on_app_stopped(&mut self, exe: &str) {
        self.recent.insert(exe.to_string(), now_ms());
        self.apps.remove(exe);
        self.dirty_apps = true;
    }

    fn request_icon(&mut self, exe: &str) {
        if exe == "system" || self.icon_requested.contains(exe) {
            return;
        }
        self.icon_requested.insert(exe.to_string());
        let pid = self
            .sessions
            .values()
            .find(|s| s.exe == exe)
            .map(|s| {
                s.control2
                    .as_ref()
                    .map(|c| unsafe { c.GetProcessId().unwrap_or(0) })
                    .unwrap_or(0)
            })
            .unwrap_or(0);
        let path = crate::icons::exe_path_for_pid(pid);
        let key = exe.to_string();
        let cache = self.icon_cache_dir();
        let tx = self.tx.clone();
        std::thread::spawn(move || {
            let icon = path.and_then(|p| cache.get_or_extract(&key, &p));
            let _ = tx.send(EngineMsg::IconLoaded { id: key, icon });
        });
    }

    fn icon_cache_dir(&self) -> crate::icons::IconCache {
        crate::icons::IconCache::new(
            self.app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir())
                .join("icons"),
        )
    }
}

// ---------------------------------------------------------------------------
// Automation: profiles, rules, focus
// ---------------------------------------------------------------------------

impl Engine {
    fn apply_profile(&mut self, id: &str) {
        let cfg = self.store.get();
        let Some(profile) = cfg.profiles.iter().find(|p| p.id == id).cloned() else {
            return;
        };
        for app in &profile.apps {
            if self.apps.contains_key(&app.exe) {
                self.set_app_volume(&app.exe, app.volume, false);
                self.set_app_mute(&app.exe, app.mute);
            }
        }
        if let Some(dev) = &profile.device_id {
            self.set_default_device(dev);
        }
        if let Some(mv) = profile.master_volume {
            self.set_master_volume(mv);
        }
        let _ = self.app.emit("profile-applied", json!({ "id": id }));
    }

    fn set_focus(&mut self, on: bool) {
        if on == self.focus_active {
            return;
        }
        if on {
            // Snapshot the current scene so it can be restored exactly.
            let snap = FocusSnapshot {
                master_volume: self.master.volume,
                master_mute: self.master.mute,
                apps: self
                    .apps
                    .values()
                    .map(|a| (a.exe.clone(), a.volume, a.mute))
                    .collect(),
            };
            let cfg = self.store.get();
            for preset in &cfg.focus_apps {
                if self.apps.contains_key(&preset.exe) {
                    if let Some(v) = preset.volume {
                        self.set_app_volume(&preset.exe, v, false);
                    }
                    if let Some(m) = preset.mute {
                        self.set_app_mute(&preset.exe, m);
                    }
                }
            }
            self.focus_snapshot = Some(snap);
            self.focus_active = true;
        } else if let Some(snap) = self.focus_snapshot.take() {
            self.set_master_volume(snap.master_volume);
            self.set_master_mute(snap.master_mute);
            for (exe, vol, mute) in snap.apps {
                if self.apps.contains_key(&exe) {
                    self.set_app_volume(&exe, vol, false);
                    self.set_app_mute(&exe, mute);
                }
            }
            self.focus_active = false;
        } else {
            self.focus_active = false;
        }
        if let Some(mut sh) = self.shared.lock().ok() {
            sh.focus_active = self.focus_active;
        }
        let _ = self.app.emit("focus", json!({ "active": self.focus_active }));
        self.dirty_apps = true;
    }

    fn run_app_start_rules(&mut self, exe: &str) {
        let cfg = self.store.get();
        let rules: Vec<Rule> = cfg
            .rules
            .iter()
            .filter(|r| r.enabled && r.trigger_kind == "app_start")
            .cloned()
            .collect();
        for rule in rules {
            if rule_matches(&rule.trigger_value, exe) {
                self.run_rule_actions(&rule.actions, Some(exe));
            }
        }
    }

    fn run_device_connect_rules(&mut self) {
        let cfg = self.store.get();
        let rules: Vec<Rule> = cfg
            .rules
            .iter()
            .filter(|r| r.enabled && r.trigger_kind == "device_connect")
            .cloned()
            .collect();
        if rules.is_empty() {
            return;
        }
        for rule in rules {
            let matched = self.devices.iter().any(|d| {
                d.state == "active"
                    && (rule_matches(&rule.trigger_value, &d.name)
                        || rule_matches(&rule.trigger_value, &d.description))
            });
            if matched {
                self.run_rule_actions(&rule.actions, None);
            }
        }
    }

    /// App-scoped actions (set_volume / set_mute / set_device) apply to the
    /// trigger application; global actions (set_default_device /
    /// activate_profile) need no target.
    fn run_rule_actions(&mut self, actions: &[RuleAction], trigger_app: Option<&str>) {
        for action in actions {
            match action.kind.as_str() {
                "set_volume" => {
                    let Some(target) = trigger_app else { continue };
                    if let Ok(v) = action.value.parse::<f32>() {
                        if self.apps.contains_key(target) {
                            self.set_app_volume(target, v, false);
                        }
                    }
                }
                "set_mute" => {
                    let Some(target) = trigger_app else { continue };
                    if self.apps.contains_key(target) {
                        let mute = match action.value.as_str() {
                            "unmute" => false,
                            "toggle" => {
                                !self.apps.get(target).map(|a| a.mute).unwrap_or(false)
                            }
                            _ => true,
                        };
                        self.set_app_mute(target, mute);
                    }
                }
                "set_device" => {
                    let Some(target) = trigger_app else { continue };
                    self.set_app_device(target, Some(action.value.clone()));
                }
                "set_default_device" => {
                    self.set_default_device(&action.value);
                }
                "activate_profile" => {
                    self.apply_profile(&action.value);
                }
                _ => {}
            }
        }
    }
}

fn rule_matches(pattern: &str, value: &str) -> bool {
    let pattern = pattern.trim().to_lowercase();
    if pattern.is_empty() {
        return true;
    }
    value.to_lowercase().contains(&pattern)
}

fn is_night_window(night: &NightModeConfig) -> bool {
    let parse = |s: &str| -> Option<(u32, u32)> {
        let mut it = s.split(':');
        let h = it.next()?.trim().parse().ok()?;
        let m = it.next().map(|m| m.trim().parse().unwrap_or(0)).unwrap_or(0);
        Some((h, m))
    };
    let (Some((sh, sm)), Some((eh, em))) = (parse(&night.start), parse(&night.end)) else {
        return false;
    };
    let now = chrono::Local::now().time();
    let start = chrono::NaiveTime::from_hms_opt(sh, sm, 0).unwrap_or_default();
    let end = chrono::NaiveTime::from_hms_opt(eh, em, 0).unwrap_or_default();
    if start <= end {
        now >= start && now <= end
    } else {
        now >= start || now <= end
    }
}

// ---------------------------------------------------------------------------
// Ducking, night mode, safety clamps
// ---------------------------------------------------------------------------

impl Engine {
    fn tick_ducking(&mut self) {
        let cfg = self.store.get();
        if !cfg.ducking.enabled || self.focus_active {
            if self.duck_active {
                self.unduck();
            }
            return;
        }
        let triggers: Vec<String> = cfg
            .ducking
            .trigger_apps
            .iter()
            .map(|s| s.to_lowercase())
            .collect();
        let loud = self
            .apps
            .values()
            .any(|a| triggers.contains(&a.exe) && a.peak > 0.03 && a.active);
        match self.duck_phase {
            DuckPhase::Idle => {
                if loud {
                    let since = *self.duck_trigger_since.get_or_insert_with(Instant::now);
                    if since.elapsed() > Duration::from_millis(250) {
                        self.duck(cfg.ducking.duck_volume);
                    }
                } else {
                    self.duck_trigger_since = None;
                }
            }
            DuckPhase::Engaged => {
                if loud {
                    self.duck_silent_since = None;
                } else {
                    let since = *self.duck_silent_since.get_or_insert_with(Instant::now);
                    if since.elapsed() > Duration::from_millis(1500) {
                        self.unduck();
                    }
                }
            }
        }
    }

    fn duck(&mut self, target_pct: f32) {
        self.duck_phase = DuckPhase::Engaged;
        self.duck_silent_since = None;
        let triggers: Vec<String> = self
            .store
            .get()
            .ducking
            .trigger_apps
            .iter()
            .map(|s| s.to_lowercase())
            .collect();
        let exes: Vec<String> = self
            .apps
            .values()
            .filter(|a| !triggers.contains(&a.exe) && a.volume > target_pct)
            .map(|a| a.exe.clone())
            .collect();
        for exe in exes {
            if let Some(app) = self.apps.get(&exe) {
                self.duck_originals.insert(exe.clone(), app.volume);
            }
            self.set_app_volume(&exe, target_pct, false);
        }
        self.duck_active = !self.duck_originals.is_empty();
        if let Ok(mut sh) = self.shared.lock() {
            sh.ducking_active = self.duck_active;
        }
        let _ = self.app.emit("ducking", json!({ "active": self.duck_active }));
        self.dirty_apps = true;
    }

    fn unduck(&mut self) {
        self.duck_phase = DuckPhase::Idle;
        self.duck_trigger_since = None;
        self.duck_silent_since = None;
        let originals: Vec<(String, f32)> = self
            .duck_originals
            .iter()
            .map(|(k, v)| (k.clone(), *v))
            .collect();
        self.duck_originals.clear();
        for (exe, vol) in originals {
            if self.apps.contains_key(&exe) {
                self.set_app_volume(&exe, vol, false);
            }
        }
        self.duck_active = false;
        if let Ok(mut sh) = self.shared.lock() {
            sh.ducking_active = false;
        }
        let _ = self.app.emit("ducking", json!({ "active": false }));
        self.dirty_apps = true;
    }

    fn tick_night(&mut self) {
        let cfg = self.store.get();
        let active = cfg.safety.night.enabled && is_night_window(&cfg.safety.night);
        if active != self.night_active {
            self.night_active = active;
            if let Ok(mut sh) = self.shared.lock() {
                sh.night_active = active;
            }
            let _ = self.app.emit("night", json!({ "active": active }));
            if active {
                self.enforce_night_clamp();
            }
        }
    }

    fn enforce_night_clamp(&self) {
        let cfg = self.store.get();
        if cfg.safety.night.enabled && is_night_window(&cfg.safety.night) {
            let max = cfg.safety.night.max_volume;
            if self.master.volume > max {
                let _ = self.tx.send(EngineMsg::SetMasterVolume(max));
            }
        }
    }

    fn clamp_master(&self, v: f32) -> f32 {
        let mut limit = 100.0f32;
        let cfg = self.store.get();
        if let Some(dev) = &self.master.device_id {
            if let Some(l) = cfg.safety.device_limits.get(dev) {
                limit = *l;
            }
        }
        if cfg.safety.night.enabled && is_night_window(&cfg.safety.night) {
            limit = limit.min(cfg.safety.night.max_volume);
        }
        v.clamp(0.0, limit)
    }

    fn clamp_app_volume(&self, id: &str, v: f32) -> f32 {
        let cfg = self.store.get();
        let dev = self.current_device_for(id);
        let mut limit = 100.0f32;
        if let Some(dev) = dev {
            if let Some(l) = cfg.safety.device_limits.get(&dev) {
                limit = *l;
            }
        }
        v.clamp(0.0, limit)
    }

    fn current_device_for(&self, exe: &str) -> Option<String> {
        self.apps
            .get(exe)
            .and_then(|a| a.routed_device.clone())
            .or_else(|| self.default_id.clone())
    }
}

// ---------------------------------------------------------------------------
// Aggregation + event flushing
// ---------------------------------------------------------------------------

impl Engine {
    /// Recomputes the aggregated per-app state from its sessions.
    fn update_app_agg(&mut self, exe: &str) {
        let sess: Vec<&SessionHandle> = self.sessions.values().filter(|s| s.exe == exe).collect();
        if sess.is_empty() {
            return;
        }
        let first = sess[0];
        let peak = sess.iter().map(|s| s.peak).fold(0.0f32, f32::max);
        let active = sess
            .iter()
            .any(|s| {
                s.control2.as_ref().map(|c| unsafe { c.GetState() }.map(|st| st == AudioSessionStateActive).unwrap_or(false)).unwrap_or(false)
            });
        let entry = self.apps.entry(exe.to_string()).or_insert_with(|| AppAgg {
            id: exe.to_string(),
            exe: exe.to_string(),
            volume: first.volume,
            mute: first.mute,
            peak: 0.0,
            active,
            pid: 0,
            icon: None,
            routed_device: None,
            last_active: now_ms(),
            session_count: 0,
        });
        entry.volume = first.volume;
        entry.mute = first.mute;
        entry.peak = peak;
        entry.active = active;
        entry.session_count = sess.len();
        if active && peak > 0.001 {
            entry.last_active = now_ms();
            self.recent.insert(exe.to_string(), entry.last_active);
        }
        let pid = first
            .control2
            .as_ref()
            .and_then(|c| unsafe { c.GetProcessId() }.ok())
            .unwrap_or(0);
        entry.pid = pid;
        let routing = self.store.get().routing.get(exe).cloned();
        if entry.routed_device.is_none() {
            entry.routed_device = routing;
        }
    }

    /// Builds the outgoing AppInfo list (icons delivered separately).
    fn app_infos(&self) -> Vec<AppInfo> {
        let mut apps: Vec<AppInfo> = self
            .apps
            .values()
            .map(|a| {
                let dname = naming::display_name(&a.exe);
                let cat = naming::category(&a.exe);
                AppInfo {
                    id: a.id.clone(),
                    exe: a.exe.clone(),
                    display_name: dname,
                    category: cat,
                    volume: a.volume,
                    mute: a.mute,
                    peak: a.peak,
                    active: a.active,
                    pid: a.pid,
                    icon: None,
                    routed_device: a.routed_device.clone(),
                    last_active: self.recent.get(&a.exe).copied().unwrap_or(a.last_active),
                    session_count: a.session_count,
                }
            })
            .collect();
        apps.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
        apps
    }

    fn flush_updates(&mut self) {
        if self.dirty_apps {
            self.dirty_apps = false;
            let apps = self.app_infos();
            if let Ok(mut sh) = self.shared.lock() {
                sh.apps = apps.clone();
            }
            let _ = self.app.emit("apps", json!({ "apps": apps }));
        }
        if self.dirty_devices {
            self.dirty_devices = false;
            let devices = self.devices.clone();
            let default_id = self.default_id.clone();
            if let Ok(mut sh) = self.shared.lock() {
                sh.devices = devices.clone();
                sh.default_id = default_id.clone();
            }
            let _ = self.app.emit("devices", json!({ "devices": devices, "default_id": default_id }));
        }
        if self.dirty_master {
            self.dirty_master = false;
            let master = self.master.clone();
            if let Ok(mut sh) = self.shared.lock() {
                sh.master = master.clone();
            }
            let _ = self.app.emit("master", json!(master));
        }
    }
}

// ---------------------------------------------------------------------------
// COM event callbacks
// ---------------------------------------------------------------------------

#[windows::core::implement(IMMNotificationClient)]
struct DeviceNotifier {
    tx: Sender<EngineMsg>,
}

impl windows::Win32::Media::Audio::IMMNotificationClient_Impl for DeviceNotifier_Impl {
    fn OnDeviceStateChanged(
        &self,
        _pwstrdeviceid: &PCWSTR,
        _dwnewstate: windows::Win32::Media::Audio::DEVICE_STATE,
    ) -> windows::core::Result<()> {
        let _ = self.tx.send(EngineMsg::DeviceEvent);
        Ok(())
    }

    fn OnDeviceAdded(&self, _pwstrdeviceid: &PCWSTR) -> windows::core::Result<()> {
        let _ = self.tx.send(EngineMsg::DeviceEvent);
        Ok(())
    }

    fn OnDeviceRemoved(&self, _pwstrdeviceid: &PCWSTR) -> windows::core::Result<()> {
        let _ = self.tx.send(EngineMsg::DeviceEvent);
        Ok(())
    }

    fn OnDefaultDeviceChanged(
        &self,
        edataflow: windows::Win32::Media::Audio::EDataFlow,
        _erole: windows::Win32::Media::Audio::ERole,
        _pwstrdefaultdeviceid: &PCWSTR,
    ) -> windows::core::Result<()> {
        if edataflow == eRender {
            let _ = self.tx.send(EngineMsg::DeviceEvent);
        }
        Ok(())
    }

    fn OnPropertyValueChanged(
        &self,
        _pwstrdeviceid: &PCWSTR,
        _key: &windows::Win32::Foundation::PROPERTYKEY,
    ) -> windows::core::Result<()> {
        Ok(())
    }
}

#[windows::core::implement(IAudioSessionEvents)]
struct SessionEvents {
    tx: Sender<EngineMsg>,
    sid: String,
}

impl windows::Win32::Media::Audio::IAudioSessionEvents_Impl for SessionEvents_Impl {
    fn OnDisplayNameChanged(
        &self,
        _newdisplayname: &PCWSTR,
        _eventcontext: *const windows::core::GUID,
    ) -> windows::core::Result<()> {
        Ok(())
    }

    fn OnIconPathChanged(
        &self,
        _newiconpath: &PCWSTR,
        _eventcontext: *const windows::core::GUID,
    ) -> windows::core::Result<()> {
        Ok(())
    }

    fn OnSimpleVolumeChanged(
        &self,
        newvolume: f32,
        newmute: BOOL,
        _eventcontext: *const windows::core::GUID,
    ) -> windows::core::Result<()> {
        let _ = self.tx.send(EngineMsg::SessionVolumeChanged {
            sid: self.sid.clone(),
            volume: newvolume,
            mute: newmute.as_bool(),
        });
        Ok(())
    }

    fn OnChannelVolumeChanged(
        &self,
        _channelcount: u32,
        _newchannelvolumes: *const f32,
        _changedchannel: u32,
        _eventcontext: *const windows::core::GUID,
    ) -> windows::core::Result<()> {
        Ok(())
    }

    fn OnGroupingParamChanged(
        &self,
        _newgroupingparam: *const windows::core::GUID,
        _eventcontext: *const windows::core::GUID,
    ) -> windows::core::Result<()> {
        Ok(())
    }

    fn OnStateChanged(
        &self,
        _newstate: AudioSessionState,
    ) -> windows::core::Result<()> {
        let _ = self.tx.send(EngineMsg::SessionCreated);
        Ok(())
    }

    fn OnSessionDisconnected(
        &self,
        _disconnectreason: AudioSessionDisconnectReason,
    ) -> windows::core::Result<()> {
        let _ = self.tx.send(EngineMsg::SessionCreated);
        Ok(())
    }
}

#[windows::core::implement(IAudioSessionNotification)]
struct SessionNotifier {
    tx: Sender<EngineMsg>,
}

impl windows::Win32::Media::Audio::IAudioSessionNotification_Impl for SessionNotifier_Impl {
    fn OnSessionCreated(
        &self,
        _newsession: windows::core::Ref<'_, IAudioSessionControl>,
    ) -> windows::core::Result<()> {
        let _ = self.tx.send(EngineMsg::SessionCreated);
        Ok(())
    }
}

#[windows::core::implement(windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolumeCallback)]
struct EndpointVolumeCb {
    tx: Sender<EngineMsg>,
}

impl windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolumeCallback_Impl
    for EndpointVolumeCb_Impl
{
    fn OnNotify(
        &self,
        pnotify: *mut AUDIO_VOLUME_NOTIFICATION_DATA,
    ) -> windows::core::Result<()> {
        if !pnotify.is_null() {
            let _ = self.tx.send(EngineMsg::MasterEndpointChanged);
        }
        Ok(())
    }
}

