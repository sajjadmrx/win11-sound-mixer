import { useEffect, useState } from "react";
import {
  AudioLines,
  ChevronRight,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "@/lib/ipc";
import { useStore } from "@/lib/store";
import type { AppInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/AppIcon";
import { MuteButton } from "@/components/MuteButton";
import { VolumeSlider } from "@/components/ui/slider";
import { VolumeLevelIcon } from "@/components/VolumeLevelIcon";
import { DevicePicker } from "@/components/DevicePicker";

function IconBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "text-primary hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

function QuickRow({ app }: { app: AppInfo }) {
  const icons = useStore((s) => s.icons);
  const setAppVolume = useStore((s) => s.setAppVolume);
  const toggleAppMute = useStore((s) => s.toggleAppMute);
  const icon = icons[app.id] ?? app.icon;

  return (
    <div className="flex h-10 items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-accent/40">
      <AppIcon
        appId={app.id}
        name={app.display_name}
        icon={icon}
        className="h-6 w-6 shrink-0 rounded-md"
      />
      <div className="w-[84px] min-w-0 shrink-0 truncate text-[12.5px] font-medium text-foreground/95">
        {app.display_name}
      </div>
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
          "w-8 shrink-0 text-right text-[11.5px] font-semibold tabular-nums",
          app.mute ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {Math.round(app.volume)}%
      </span>
      <MuteButton
        muted={app.mute}
        onToggle={() => toggleAppMute(app.id)}
        size="sm"
        className="h-6 w-6"
      />
    </div>
  );
}

export function QuickMixer() {
  const init = useStore((s) => s.init);
  const apps = useStore((s) => s.apps);
  const master = useStore((s) => s.master);
  const setMasterVolume = useStore((s) => s.setMasterVolume);
  const toggleMasterMute = useStore((s) => s.toggleMasterMute);
  const defaultDeviceId = useStore((s) => s.defaultDeviceId);
  const setDefaultDevice = useStore((s) => s.setDefaultDevice);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const un = (e: KeyboardEvent) => {
      if (e.key === "Escape") void api.hideQuickMixer();
    };
    window.addEventListener("keydown", un);
    return () => window.removeEventListener("keydown", un);
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    void api.setQuickPinned(next);
    void getCurrentWindow().setAlwaysOnTop(next);
  };

  const rows = [...apps]
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.volume - a.volume;
    })
    .slice(0, 6);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground select-none">
      <header
        data-tauri-drag-region
        className="flex h-9 shrink-0 items-center gap-2 border-b border-border/70 px-3"
      >
        <span className="flex h-4 w-4 items-center justify-center text-primary">
          <AudioLines className="h-4 w-4" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight">Mixero</span>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn
            label={pinned ? "Unpin" : "Keep on top"}
            active={pinned}
            onClick={togglePin}
          >
            {pinned ? (
              <PinOff className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </IconBtn>
          <IconBtn label="Close" onClick={() => void api.hideQuickMixer()}>
            <X className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </header>

      <section className="shrink-0 border-b border-border/70 p-2.5">
        <div className="flex items-center gap-2">
          <DevicePicker
            compact
            value={defaultDeviceId}
            onSelect={(id) => {
              if (id) setDefaultDevice(id);
            }}
            align="start"
            className="h-7 w-[100px] text-[11.5px] px-2"
            header={{
              title: "Select Output Device",
            }}
          />
          <VolumeLevelIcon
            volume={master.volume}
            muted={master.mute}
            className="shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1">
            <VolumeSlider
              value={[master.volume]}
              min={0}
              max={100}
              step={1}
              muted={master.mute}
              onValueChange={(v) => setMasterVolume(v[0])}
            />
          </div>
          <span
            className={cn(
              "w-8 shrink-0 text-right text-[11.5px] font-semibold tabular-nums",
              master.mute && "text-muted-foreground",
            )}
          >
            {Math.round(master.volume)}%
          </span>
          <MuteButton
            muted={master.mute}
            onToggle={toggleMasterMute}
            size="sm"
            className="h-6 w-6"
          />
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="text-[12.5px] font-medium text-foreground/80">
              Nothing playing
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Apps making sound will show up here.
            </div>
          </div>
        ) : (
          rows.map((app) => <QuickRow key={app.id} app={app} />)
        )}
      </div>

      <footer className="shrink-0 border-t border-border/70 p-1.5">
        <button
          onClick={() => void api.openMainMixer()}
          className="flex h-7 w-full items-center justify-between rounded-lg px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <div className="flex items-center gap-1.5">
            <AudioLines className="h-3.5 w-3.5 text-primary" />
            <span>Open Full Mixer</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </footer>
    </div>
  );
}