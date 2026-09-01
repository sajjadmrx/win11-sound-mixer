import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type {
  AppState,
  AppInfo,
  DeviceInfo,
  DuckingConfig,
  FocusApp,
  MasterState,
  Profile,
  Rule,
  SafetyConfig,
  Settings,
  ShortcutBinding,
} from "./types";

export async function getState(): Promise<AppState> {
  return invoke<AppState>("get_state");
}

export const api = {
  setMasterVolume: (volume: number) =>
    invoke("set_master_volume", { volume }),
  setMasterMute: (mute: boolean) => invoke("set_master_mute", { mute }),
  setAppVolume: (id: string, volume: number) =>
    invoke("set_app_volume", { id, volume }),
  setAppMute: (id: string, mute: boolean) => invoke("set_app_mute", { id, mute }),
  setAppDevice: (id: string, deviceId: string | null) =>
    invoke("set_app_device", { id, deviceId }),
  setDefaultDevice: (id: string) => invoke("set_default_device", { id }),
  refresh: () => invoke("refresh_audio"),
  saveSettings: (settings: Settings) =>
    invoke<Settings>("save_settings", { settings }),
  saveProfiles: (profiles: Profile[]) =>
    invoke<Profile[]>("save_profiles", { profiles }),
  applyProfile: (id: string) => invoke("apply_profile", { id }),
  captureProfile: (name: string, emoji: string, deviceId: string | null) =>
    invoke<Profile>("capture_profile", { name, emoji, deviceId }),
  saveRules: (rules: Rule[]) => invoke<Rule[]>("save_rules", { rules }),
  setFocus: (enabled: boolean) => invoke("set_focus", { enabled }),
  saveFocusApps: (focusApps: FocusApp[]) =>
    invoke<FocusApp[]>("save_focus_apps", { focusApps }),
  saveDucking: (ducking: DuckingConfig) =>
    invoke<DuckingConfig>("save_ducking", { ducking }),
  saveSafety: (safety: SafetyConfig) =>
    invoke<SafetyConfig>("save_safety", { safety }),
  saveShortcuts: (shortcuts: ShortcutBinding[]) =>
    invoke<ShortcutBinding[]>("save_shortcuts", { shortcuts }),
  clearMemory: () => invoke("clear_memory"),
  clearAppMemory: (exe: string) => invoke("clear_app_memory", { exe }),
  getMemory: () => invoke<Record<string, Record<string, number>>>("get_memory"),
  openMainMixer: () => invoke("open_main_mixer"),
  openQuickMixer: () => invoke("open_quick_mixer"),
  hideQuickMixer: () => invoke("hide_quick_mixer"),
  setQuickPinned: (pinned: boolean) => invoke("set_quick_pinned", { pinned }),
  setTrayPinned: (pinned: boolean) => invoke("set_tray_pinned", { pinned }),
  setMainPinned: (pinned: boolean) => invoke("set_main_pinned", { pinned }),
  minimizeWindow: (label: string) => invoke("minimize_window", { label }),
  toggleMaximizeWindow: (label: string) =>
    invoke("toggle_maximize_window", { label }),
  quit: () => invoke("quit_app"),
};

interface AppsPayload {
  apps: AppInfo[];
}
interface DevicesPayload {
  devices: DeviceInfo[];
  default_id: string | null;
}

export function subscribeEvents(handlers: {
  onApps: (apps: AppInfo[]) => void;
  onDevices: (devices: DeviceInfo[], defaultId: string | null) => void;
  onMaster: (master: MasterState) => void;
  onSettings: (settings: Settings) => void;
  onFocus: (active: boolean) => void;
  onDucking: (active: boolean) => void;
  onNight: (active: boolean) => void;
  onProfileApplied: (id: string) => void;
}): () => void {
  const unlisteners: Promise<() => void>[] = [
    listen<AppsPayload>("apps", (e) => handlers.onApps(e.payload.apps)),
    listen<DevicesPayload>("devices", (e) =>
      handlers.onDevices(e.payload.devices, e.payload.default_id),
    ),
    listen<MasterState>("master", (e) => handlers.onMaster(e.payload)),
    listen<{ settings: Settings }>("settings", (e) =>
      handlers.onSettings(e.payload.settings),
    ),
    listen<{ active: boolean }>("focus", (e) =>
      handlers.onFocus(e.payload.active),
    ),
    listen<{ active: boolean }>("ducking", (e) =>
      handlers.onDucking(e.payload.active),
    ),
    listen<{ active: boolean }>("night", (e) =>
      handlers.onNight(e.payload.active),
    ),
    listen<{ id: string }>("profile-applied", (e) =>
      handlers.onProfileApplied(e.payload.id),
    ),
  ];
  return () => {
    unlisteners.forEach((p) => p.then((un) => un()).catch(() => {}));
  };
}
