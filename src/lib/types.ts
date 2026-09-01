export interface DeviceInfo {
  id: string;
  name: string;
  description: string;
  kind: string;
  is_default: boolean;
  is_default_communications: boolean;
  state: string;
  max_volume: number;
}

export interface AppInfo {
  id: string;
  exe: string;
  display_name: string;
  category: string;
  volume: number;
  mute: boolean;
  peak: number;
  active: boolean;
  pid: number;
  icon: string | null;
  routed_device: string | null;
  last_active: number;
  session_count: number;
}

export interface MasterState {
  volume: number;
  mute: boolean;
  device_id: string | null;
}

export interface Settings {
  theme: "dark" | "light" | "system";
  sort: SortMode;
  per_device_memory: boolean;
  launch_on_startup: boolean;
  grid_view: boolean;
}

export type SortMode =
  | "currently-playing"
  | "name"
  | "volume"
  | "recently-active";

export interface DuckingConfig {
  enabled: boolean;
  duck_volume: number;
  fade_ms: number;
  trigger_apps: string[];
}

export interface FocusApp {
  exe: string;
  volume: number | null;
  mute: boolean | null;
}

export interface NightModeConfig {
  enabled: boolean;
  start: string;
  end: string;
  max_volume: number;
}

export interface SafetyConfig {
  device_limits: Record<string, number>;
  night: NightModeConfig;
}

export interface ProfileApp {
  exe: string;
  volume: number;
  mute: boolean;
}

export interface Profile {
  id: string;
  name: string;
  emoji: string;
  device_id: string | null;
  master_volume: number | null;
  apps: ProfileApp[];
}

export interface RuleAction {
  kind: "set_volume" | "set_mute" | "set_device" | "set_default_device" | "activate_profile";
  value: string;
}

export interface Rule {
  id: string;
  enabled: boolean;
  trigger_kind: "app_start" | "device_connect";
  trigger_value: string;
  actions: RuleAction[];
}

export interface ShortcutBinding {
  action: string;
  keys: string;
  enabled: boolean;
}

export interface AppState {
  devices: DeviceInfo[];
  default_device_id: string | null;
  apps: AppInfo[];
  master: MasterState;
  settings: Settings;
  profiles: Profile[];
  rules: Rule[];
  ducking: DuckingConfig;
  focus_apps: FocusApp[];
  safety: SafetyConfig;
  night_active: boolean;
  focus_active: boolean;
  ducking_active: boolean;
  shortcuts: ShortcutBinding[];
}
