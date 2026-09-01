import { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  VolumeX,
  Volume2,
  Speaker,
  Settings,
  Power,
  ChevronRight,
  Check,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "@/lib/ipc";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DeviceIcon } from "@/components/DevicePicker";

export function TrayMenu() {
  const init = useStore((s) => s.init);
  const master = useStore((s) => s.master);
  const toggleMasterMute = useStore((s) => s.toggleMasterMute);
  const devices = useStore((s) => s.devices);
  const defaultDeviceId = useStore((s) => s.defaultDeviceId);
  const setDefaultDevice = useStore((s) => s.setDefaultDevice);
  const setPage = useStore((s) => s.setPage);

  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void getCurrentWindow().hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const defaultDevice = devices.find((d) => d.id === defaultDeviceId);
  const activeDevices = devices.filter((d) => d.state === "active");

  const openMixer = (page?: "mixer" | "settings") => {
    if (page) setPage(page);
    void api.openMainMixer();
    void getCurrentWindow().hide();
  };

  return (
    <div className="flex h-full flex-col justify-center bg-card/95 p-1.5 text-foreground select-none">
      <div className="space-y-0.5 text-[13px] font-medium">
        <button
          onClick={() => openMixer("mixer")}
          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground text-foreground/90"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span>Open Mixer</span>
        </button>

        <button
          onClick={toggleMasterMute}
          className="flex h-8 w-full items-center justify-between rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground text-foreground/90"
        >
          <div className="flex items-center gap-2.5">
            {master.mute ? (
              <VolumeX className="h-4 w-4 text-destructive" />
            ) : (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Master Mute</span>
          </div>
          {master.mute && (
            <span className="text-[11px] text-destructive font-normal">Muted</span>
          )}
        </button>

        <div>
          <button
            onClick={() => setDeviceMenuOpen(!deviceMenuOpen)}
            className="flex h-8 w-full items-center justify-between rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground text-foreground/90"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Speaker className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Output Device</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="truncate max-w-28 text-[12px] text-muted-foreground">
                {defaultDevice?.name ?? "Speakers"}
              </span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform",
                  deviceMenuOpen && "rotate-90",
                )}
              />
            </div>
          </button>

          {deviceMenuOpen && (
            <div className="my-1 ml-4 space-y-0.5 border-l border-border/80 pl-2">
              {activeDevices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDefaultDevice(d.id);
                    setDeviceMenuOpen(false);
                  }}
                  className={cn(
                    "flex h-7 w-full items-center justify-between rounded px-2 text-[12px] transition-colors",
                    d.id === defaultDeviceId
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <DeviceIcon kind={d.kind} className="h-3 w-3" />
                    <span className="truncate">{d.name}</span>
                  </div>
                  {d.id === defaultDeviceId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="my-1 border-t border-border/70" />

        <button
          onClick={() => openMixer("settings")}
          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground text-foreground/90"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span>Settings</span>
        </button>

        <button
          onClick={() => void api.quit()}
          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 transition-colors hover:bg-destructive/15 hover:text-destructive text-foreground/90"
        >
          <Power className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          <span>Quit</span>
        </button>
      </div>
    </div>
  );
}