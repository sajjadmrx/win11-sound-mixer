import { useState, type ReactNode } from "react";
import { Moon, ShieldCheck, Brain, Database, Trash2, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import type { FocusApp, Settings as SettingsT } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader, MenuSelect, type MenuOption } from "@/components/controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { VolumeSlider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { MuteButton } from "@/components/MuteButton";
import { api } from "@/lib/ipc";

const THEMES: MenuOption[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const patchSettings = useStore((s) => s.patchSettings);
  const focusApps = useStore((s) => s.focusApps);
  const updateFocusApps = useStore((s) => s.updateFocusApps);
  const apps = useStore((s) => s.apps);
  const ducking = useStore((s) => s.ducking);
  const updateDucking = useStore((s) => s.updateDucking);
  const duckingActive = useStore((s) => s.duckingActive);
  const safety = useStore((s) => s.safety);
  const updateSafety = useStore((s) => s.updateSafety);
  const focusActive = useStore((s) => s.focusActive);
  const devices = useStore((s) => s.devices);

  const [memoryInfo, setMemoryInfo] = useState<string | null>(null);

  const appName = (exe: string) =>
    apps.find((a) => a.exe === exe)?.display_name ??
    exe.charAt(0).toUpperCase() + exe.slice(1);

  const duckingActiveApps = apps.filter((a) => a.active);

  const addFocusApp = (exe: string) => {
    if (focusApps.some((f) => f.exe === exe)) return;
    const source = apps.find((a) => a.exe === exe);
    const entry: FocusApp = {
      exe,
      volume: source?.volume ?? 20,
      mute: source?.mute ?? false,
    };
    updateFocusApps([...focusApps, entry]);
  };

  const setFocusValue = (exe: string, patch: Partial<FocusApp>) => {
    updateFocusApps(
      focusApps.map((f) => (f.exe === exe ? { ...f, ...patch } : f)),
    );
  };

  const toggleDuckTrigger = (exe: string) => {
    const has = ducking.trigger_apps.includes(exe);
    updateDucking({
      ...ducking,
      trigger_apps: has
        ? ducking.trigger_apps.filter((t) => t !== exe)
        : [...ducking.trigger_apps, exe],
    });
  };

  const clearMemory = async () => {
    await api.clearMemory();
    setMemoryInfo("All remembered per-device settings cleared.");
    setTimeout(() => setMemoryInfo(null), 2600);
  };

  const focusOptions: MenuOption[] = apps
    .filter((a) => !focusApps.some((f) => f.exe === a.exe))
    .map((a) => ({ value: a.exe, label: a.display_name }));

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pb-3 pt-[18px]">
        <PageHeader
          title="Settings"
          subtitle="Tune Mixero to your ears."
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
        {/* General */}
        <Card
          title="General"
          desc="Appearance, startup and global behavior."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">Theme</div>
              <div className="text-[11.5px] text-muted-foreground">
                Follow Windows or pick one.
              </div>
            </div>
            <MenuSelect
              value={settings.theme}
              options={THEMES}
              align="end"
              className="w-40"
              onSelect={(v) =>
                patchSettings({ theme: v as SettingsT["theme"] })
              }
            />
          </div>
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
            <ToggleRow
              title="Launch at startup"
              desc="Start Mixero quietly with Windows."
              checked={settings.launch_on_startup}
              onChange={(v) => patchSettings({ launch_on_startup: v })}
            />
            <ToggleRow
              title="Per-device memory"
              desc="Remember each app's volume for every output device."
              checked={settings.per_device_memory}
              onChange={(v) => patchSettings({ per_device_memory: v })}
            />
          </div>
        </Card>
{/* Focus Audio */}
        <Card
          title="Focus Audio"
          desc="One click that mutes the background and leaves just what you need."
          right={
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium",
                focusActive
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary/60 text-muted-foreground",
              )}
            >
              {focusActive ? "Active now" : "Ready"}
            </span>
          }
        >
          <div className="space-y-1.5">
            {focusApps.map((f) => (
              <div
                key={f.exe}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-elevated/30 px-2.5 py-1.5"
              >
                <span className="w-28 truncate text-[12.5px] font-medium">
                  {appName(f.exe)}
                </span>
                <div className="min-w-0 flex-1">
                  <VolumeSlider
                    value={[f.volume ?? 20]}
                    min={0}
                    max={100}
                    step={1}
                    muted={f.mute ?? false}
                    onValueChange={(v) =>
                      setFocusValue(f.exe, { volume: v[0], mute: false })
                    }
                  />
                </div>
                <span className="w-9 text-right text-[11.5px] tabular-nums text-muted-foreground">
                  {f.volume != null ? `${Math.round(f.volume)}%` : "—"}
                </span>
                <MuteButton
                  muted={f.mute ?? false}
                  onToggle={() =>
                    setFocusValue(f.exe, { mute: !(f.mute ?? false) })
                  }
                  size="sm"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    updateFocusApps(focusApps.filter((x) => x.exe !== f.exe))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {focusApps.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-[12px] text-muted-foreground">
                Add apps to shape your Focus scene.
              </div>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <MenuSelect
              value=""
              align="start"
              className="h-8 w-52"
              placeholder="Add an app to focus…"
              options={focusOptions}
              onSelect={addFocusApp}
            />
            <span className="text-[11px] text-muted-foreground">
              Apps not listed are muted during Focus.
            </span>
          </div>
        </Card>
{/* Smart Ducking */}
        <Card
          title="Smart ducking"
          desc="Automatically lower background music while you talk."
          right={
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium",
                duckingActive
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-secondary/60 text-muted-foreground",
              )}
            >
              {duckingActive ? "Ducking now" : ducking.enabled ? "Enabled" : "Off"}
            </span>
          }
        >
          <div className="space-y-4">
            <ToggleRow
              title="Enable smart ducking"
              desc={`Background apps drop to ${Math.round(
                ducking.duck_volume,
              )}% when a trigger app makes sound.`}
              checked={ducking.enabled}
              onChange={(v) => updateDucking({ ...ducking, enabled: v })}
            />
            {ducking.enabled && (
              <>
                <SliderSetting
                  icon={<Brain className="h-3.5 w-3.5" />}
                  label="Background volume when ducking"
                  value={Math.round(ducking.duck_volume)}
                  min={0}
                  max={100}
                  onValueChange={(v) =>
                    updateDucking({ ...ducking, duck_volume: v })
                  }
                />
                <SliderSetting
                  icon={<Moon className="h-3.5 w-3.5" />}
                  label="Fade duration"
                  value={ducking.fade_ms}
                  min={200}
                  max={3000}
                  step={100}
                  unit="ms"
                  onValueChange={(v) =>
                    updateDucking({ ...ducking, fade_ms: v })
                  }
                />
                <div>
                  <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">
                    Trigger apps — sound from these dips the background
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {duckingActiveApps.map((a) => {
                      const on = ducking.trigger_apps.includes(a.exe);
                      return (
                        <button
                          key={a.exe}
                          onClick={() => toggleDuckTrigger(a.exe)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-[11.5px] transition-colors",
                            on
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border/70 bg-elevated/40 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {a.display_name}
                        </button>
                      );
                    })}
                    {apps.length === 0 && (
                      <span className="text-[11.5px] text-muted-foreground">
                        No apps running to pick from.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
{/* Safety */}
        <Card
          title="Safety volume"
          desc="Protect your ears with per-device limits and night quiet hours."
          right={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
        >
          <div className="space-y-3.5">
            {devices.map((d) => {
              const limit = Math.min(safety.device_limits[d.id] ?? 100, 100);
              return (
                <SliderSetting
                  key={d.id}
                  label={d.name}
                  value={Math.round(limit)}
                  min={0}
                  max={100}
                  hint={limit >= 100 ? "No limit" : `${Math.round(limit)}% max`}
                  onValueChange={(v) => {
                    const limits = { ...safety.device_limits };
                    if (v >= 100) delete limits[d.id];
                    else limits[d.id] = v;
                    updateSafety({ ...safety, device_limits: limits });
                  }}
                />
              );
            })}
            {devices.length === 0 && (
              <div className="text-[12px] text-muted-foreground">
                No output devices found.
              </div>
            )}

            <div className="rounded-xl border border-border/60 bg-elevated/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                    Night quiet hours
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Between {safety.night.start} and {safety.night.end}, master
                    volume caps at {Math.round(safety.night.max_volume)}%.
                  </div>
                </div>
                <Switch
                  checked={safety.night.enabled}
                  onCheckedChange={(v) =>
                    updateSafety({
                      ...safety,
                      night: { ...safety.night, enabled: v },
                    })
                  }
                />
              </div>
              {safety.night.enabled && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Start
                    </label>
                    <Input
                      value={safety.night.start}
                      type="time"
                      className="h-8 w-28 text-[12px]"
                      onChange={(e) =>
                        updateSafety({
                          ...safety,
                          night: { ...safety.night, start: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      End
                    </label>
                    <Input
                      value={safety.night.end}
                      type="time"
                      className="h-8 w-28 text-[12px]"
                      onChange={(e) =>
                        updateSafety({
                          ...safety,
                          night: { ...safety.night, end: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>Maximum at night</span>
                      <span className="tabular-nums">
                        {Math.round(safety.night.max_volume)}%
                      </span>
                    </div>
                    <VolumeSlider
                      value={[safety.night.max_volume]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(v) =>
                        updateSafety({
                          ...safety,
                          night: { ...safety.night, max_volume: v[0] },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
{/* Per-device memory */}
        <Card
          title="Per-device memory"
          desc="Volumes are recalled automatically when you switch outputs."
          right={<Database className="h-4 w-4 text-muted-foreground" />}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Example: Spotify at 45% on Speakers, 72% on Headphones. Switch the
              output and Spotify follows automatically.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-[12px] hover:border-destructive/30 hover:text-destructive"
              onClick={() => void clearMemory()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Forget everything
            </Button>
          </div>
          {memoryInfo && (
            <div className="mt-2 text-[11.5px] text-primary">{memoryInfo}</div>
          )}
        </Card>

        {/* About */}
        <Card title="About" desc="Mixero — a tiny, powerful audio mixer.">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Version 1.0.0 · Opens the Quick Mixer with{" "}
            <span className="kbd">Ctrl Alt M</span> · Closes to the tray.
          </div>
        </Card>
      </div>
    </div>
  );
}
function Card({
  title,
  desc,
  right,
  children,
}: {
  title: string;
  desc?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold tracking-tight">{title}</div>
          {desc && (
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</div>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        {desc && (
          <div className="text-[11.5px] text-muted-foreground">{desc}</div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SliderSetting({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  icon,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  icon?: ReactNode;
  onValueChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="tabular-nums text-foreground/80">
          {value}
          {unit ?? "%"}
          {hint ? ` · ${hint}` : ""}
        </span>
      </div>
      <VolumeSlider
        value={[value]}
        min={min}
        max={max}
        step={step ?? 1}
        onValueChange={(v) => onValueChange(v[0])}
      />
    </div>
  );
}