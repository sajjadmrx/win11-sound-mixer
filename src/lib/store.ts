import { create } from "zustand";
import { api, getState, subscribeEvents } from "./ipc";
import { clamp } from "./utils";
import type {
  AppInfo,
  AppState,
  DeviceInfo,
  DuckingConfig,
  MasterState,
  Profile,
  Rule,
  SafetyConfig,
  Settings,
  ShortcutBinding,
  SortMode,
} from "./types";

export type Page =
  | "mixer"
  | "devices"
  | "profiles"
  | "rules"
  | "settings"
  | "shortcuts";

interface MixeroStore {
  loaded: boolean;
  devices: DeviceInfo[];
  defaultDeviceId: string | null;
  apps: AppInfo[];
  master: MasterState;
  settings: Settings;
  profiles: Profile[];
  rules: Rule[];
  ducking: DuckingConfig;
  focusApps: AppState["focus_apps"];
  safety: SafetyConfig;
  nightActive: boolean;
  focusActive: boolean;
  duckingActive: boolean;
  shortcuts: ShortcutBinding[];
  icons: Record<string, string>;
  page: Page;
  search: string;
  lastAppliedProfile: string | null;
  pinned: boolean;

  init: () => Promise<void>;
  setPage: (p: Page) => void;
  setSearch: (s: string) => void;
  setPinned: (p: boolean) => void;

  setMasterVolume: (v: number) => void;
  toggleMasterMute: () => void;
  setAppVolume: (id: string, v: number) => void;
  toggleAppMute: (id: string) => void;
  setAppDevice: (id: string, deviceId: string | null) => void;
  setDefaultDevice: (id: string) => void;
  refresh: () => void;

  patchSettings: (patch: Partial<Settings>) => void;
  setSort: (mode: SortMode) => void;

  applyProfile: (id: string) => void;
  captureCurrentProfile: (name: string, emoji: string) => Promise<void>;
  updateProfiles: (profiles: Profile[]) => Promise<void>;
  updateRules: (rules: Rule[]) => Promise<void>;
  toggleFocus: () => void;
  updateDucking: (cfg: DuckingConfig) => Promise<void>;
  updateSafety: (cfg: SafetyConfig) => Promise<void>;
  updateShortcuts: (shortcuts: ShortcutBinding[]) => Promise<void>;
  updateFocusApps: (apps: AppState["focus_apps"]) => Promise<void>;
}

let subscribed = false;

export const useStore = create<MixeroStore>((set, get) => ({
  loaded: false,
  devices: [],
  defaultDeviceId: null,
  apps: [],
  master: { volume: 0, mute: false, device_id: null },
  settings: {
    theme: "dark",
    sort: "currently-playing",
    per_device_memory: true,
    launch_on_startup: false,
    grid_view: false,
  },
  profiles: [],
  rules: [],
  ducking: {
    enabled: false,
    duck_volume: 20,
    fade_ms: 800,
    trigger_apps: [],
  },
  focusApps: [],
  safety: {
    device_limits: {},
    night: { enabled: false, start: "00:00", end: "08:00", max_volume: 40 },
  },
  nightActive: false,
  focusActive: false,
  duckingActive: false,
  shortcuts: [],
  icons: {},
  page: "mixer",
  search: "",
  lastAppliedProfile: null,
  pinned: false,

  init: async () => {
    const state = await getState();
    set({
      loaded: true,
      devices: state.devices,
      defaultDeviceId: state.default_device_id,
      apps: state.apps,
      master: state.master,
      settings: state.settings,
      profiles: state.profiles,
      rules: state.rules,
      ducking: state.ducking,
      focusApps: state.focus_apps,
      safety: state.safety,
      nightActive: state.night_active,
      focusActive: state.focus_active,
      duckingActive: state.ducking_active,
      shortcuts: state.shortcuts,
    });
    applyTheme(state.settings.theme);
    if (subscribed) return;
    subscribed = true;
    subscribeEvents({
      onApps: (apps) => set({ apps }),
      onDevices: (devices, defaultId) =>
        set({ devices, defaultDeviceId: defaultId }),
      onMaster: (master) => set({ master }),
      onSettings: (settings) => {
        set({ settings });
        applyTheme(settings.theme);
      },
      onFocus: (active) => set({ focusActive: active }),
      onDucking: (active) => set({ duckingActive: active }),
      onNight: (active) => set({ nightActive: active }),
      onProfileApplied: (id) => set({ lastAppliedProfile: id }),
    });
    const { listen } = await import("@tauri-apps/api/event");
    listen<{ id: string; icon: string }>("app-icon", (e) => {
      set((s) => ({ icons: { ...s.icons, [e.payload.id]: e.payload.icon } }));
    }).catch(() => {});
  },

  setPage: (p) => set({ page: p }),
  setSearch: (s) => set({ search: s }),
  setPinned: (p) => {
    set({ pinned: p });
    api.setMainPinned(p);
  },

  setMasterVolume: (v) => {
    const vol = clamp(Math.round(v), 0, 100);
    set((s) => ({ master: { ...s.master, volume: vol } }));
    api.setMasterVolume(vol);
  },
  toggleMasterMute: () => {
    const mute = !get().master.mute;
    set((s) => ({ master: { ...s.master, mute } }));
    api.setMasterMute(mute);
  },
  setAppVolume: (id, v) => {
    const vol = clamp(Math.round(v), 0, 100);
    set((s) => ({
      apps: s.apps.map((a) => (a.id === id ? { ...a, volume: vol } : a)),
    }));
    api.setAppVolume(id, vol);
  },
  toggleAppMute: (id) => {
    const app = get().apps.find((a) => a.id === id);
    if (!app) return;
    const mute = !app.mute;
    set((s) => ({
      apps: s.apps.map((a) => (a.id === id ? { ...a, mute } : a)),
    }));
    api.setAppMute(id, mute);
  },
  setAppDevice: (id, deviceId) => {
    set((s) => ({
      apps: s.apps.map((a) =>
        a.id === id ? { ...a, routed_device: deviceId } : a,
      ),
    }));
    api.setAppDevice(id, deviceId);
  },
  setDefaultDevice: (id) => {
    set((s) => ({
      devices: s.devices.map((d) => ({ ...d, is_default: d.id === id })),
      defaultDeviceId: id,
    }));
    api.setDefaultDevice(id);
  },
  refresh: () => api.refresh(),

  patchSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    applyTheme(settings.theme);
    api.saveSettings(settings);
  },
  setSort: (mode) => get().patchSettings({ sort: mode }),

  applyProfile: (id) => {
    set({ lastAppliedProfile: id });
    api.applyProfile(id);
  },
  captureCurrentProfile: async (name, emoji) => {
    const defaultDevice = get().defaultDeviceId;
    const profile = await api.captureProfile(name, emoji, defaultDevice);
    set((s) => ({ profiles: [profile, ...s.profiles] }));
  },
  updateProfiles: async (profiles) => {
    set({ profiles });
    await api.saveProfiles(profiles);
  },
  updateRules: async (rules) => {
    set({ rules });
    await api.saveRules(rules);
  },
  toggleFocus: () => {
    const active = !get().focusActive;
    set({ focusActive: active });
    api.setFocus(active);
  },
  updateDucking: async (ducking) => {
    set({ ducking });
    await api.saveDucking(ducking);
  },
  updateSafety: async (safety) => {
    set({ safety });
    await api.saveSafety(safety);
  },
  updateShortcuts: async (shortcuts) => {
    set({ shortcuts });
    await api.saveShortcuts(shortcuts);
  },
  updateFocusApps: async (focusApps) => {
    set({ focusApps });
    await api.saveFocusApps(focusApps);
  },
}));

export function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  } else {
    root.classList.add("dark");
    root.classList.remove("light");
  }
}

export function visibleApps(
  apps: AppInfo[],
  search: string,
  sort: SortMode,
): AppInfo[] {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? apps.filter(
        (a) =>
          a.display_name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q),
      )
    : apps;
  const sorted = [...filtered];
  switch (sort) {
    case "name":
      sorted.sort((a, b) =>
        a.display_name
          .toLowerCase()
          .localeCompare(b.display_name.toLowerCase()),
      );
      break;
    case "volume":
      sorted.sort((a, b) => b.volume - a.volume);
      break;
    case "recently-active":
      sorted.sort((a, b) => b.last_active - a.last_active);
      break;
    case "currently-playing":
    default:
      sorted.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        if (a.active && b.active) return b.peak - a.peak;
        return a.display_name
          .toLowerCase()
          .localeCompare(b.display_name.toLowerCase());
      });
      break;
  }
  return sorted;
}

