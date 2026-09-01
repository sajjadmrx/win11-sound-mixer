import type React from "react";
import { useStore } from "@/lib/store";
import type { AppInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/AppIcon";
import { AudioBars } from "@/components/AudioBars";
import { DevicePicker } from "@/components/DevicePicker";
import { VolumeSlider } from "@/components/ui/slider";
import { VolumeLevelIcon } from "@/components/VolumeLevelIcon";
import { MuteButton } from "@/components/MuteButton";

export function AppRow({ app }: { app: AppInfo }) {
  const icons = useStore((s) => s.icons);
  const setAppVolume = useStore((s) => s.setAppVolume);
  const toggleAppMute = useStore((s) => s.toggleAppMute);
  const setAppDevice = useStore((s) => s.setAppDevice);
  const icon = icons[app.id] ?? app.icon;

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 4 : -4;
    setAppVolume(app.id, app.volume + delta);
  };

  const volume = Math.round(app.volume);

  return (
    <div
      className={cn(
        "app-row group flex h-[52px] items-center gap-3 rounded-xl border border-border/70 bg-card px-3",
        "transition-colors hover:border-border hover:bg-elevated/50",
      )}
    >
      <AppIcon
        appId={app.id}
        name={app.display_name}
        icon={icon}
        className="h-8 w-8 shrink-0 rounded-lg"
      />
      <div className="w-[180px] min-w-0 shrink-0">
        <div className="truncate text-[13px] font-medium leading-tight text-foreground/95">
          {app.display_name}
          {app.pid !== 0 && (
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/70">
              {app.exe}
            </span>
          )}
        </div>
        <div className="truncate text-[11px] leading-tight text-muted-foreground">
          {app.category || "Application"}
        </div>
      </div>

      <div className="hidden w-[60px] shrink-0 justify-center sm:flex">
        <AudioBars peak={app.peak} active={app.active} />
      </div>

      <div className="flex min-w-[120px] flex-1 items-center" onWheel={onWheel}>
        <VolumeSlider
          value={[app.volume]}
          min={0}
          max={100}
          step={1}
          muted={app.mute}
          onValueChange={(v) => setAppVolume(app.id, v[0])}
        />
      </div>

      <span
        className={cn(
          "w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums",
          app.mute ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {volume}%
      </span>

      <MuteButton muted={app.mute} onToggle={() => toggleAppMute(app.id)} size="sm" />

      <DevicePicker
        compact
        value={app.routed_device}
        onSelect={(id) => setAppDevice(app.id, id)}
        className="hidden w-[124px] shrink-0 lg:inline-flex"
        header={{
          title: "Output device",
          subtitle: `${app.display_name} · choose where this plays`,
        }}
      />
    </div>
  );
}

export function AppCard({ app }: { app: AppInfo }) {
  const icons = useStore((s) => s.icons);
  const setAppVolume = useStore((s) => s.setAppVolume);
  const toggleAppMute = useStore((s) => s.toggleAppMute);
  const setAppDevice = useStore((s) => s.setAppDevice);
  const icon = icons[app.id] ?? app.icon;

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 4 : -4;
    setAppVolume(app.id, app.volume + delta);
  };

  const volume = Math.round(app.volume);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3.5 transition-colors hover:border-border hover:bg-elevated/40">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <AppIcon
            appId={app.id}
            name={app.display_name}
            icon={icon}
            className="h-8 w-8 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium leading-tight text-foreground/95">
              {app.display_name}
            </div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              {app.category || "Application"}
            </div>
          </div>
        </div>
        <AudioBars peak={app.peak} active={app.active} className="shrink-0" />
      </div>

      <div className="my-3">
        <DevicePicker
          compact
          value={app.routed_device}
          onSelect={(id) => setAppDevice(app.id, id)}
          className="w-full"
          header={{
            title: "Output device",
            subtitle: `${app.display_name} · choose where this plays`,
          }}
        />
      </div>

      <div className="flex items-center gap-2" onWheel={onWheel}>
        <VolumeLevelIcon
          volume={app.volume}
          muted={app.mute}
          className="shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <VolumeSlider
            value={[app.volume]}
            min={0}
            max={100}
            step={1}
            muted={app.mute}
            onValueChange={(v) => setAppVolume(app.id, v[0])}
          />
        </div>
        <span
          className={cn(
            "w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums",
            app.mute ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {volume}%
        </span>
        <MuteButton muted={app.mute} onToggle={() => toggleAppMute(app.id)} size="sm" />
      </div>
    </div>
  );
}