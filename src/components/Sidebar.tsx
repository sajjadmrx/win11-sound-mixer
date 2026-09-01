import {
  AudioLines,
  Speaker,
  Layers,
  Workflow,
  Settings,
  Keyboard,
  Sliders,
  Power,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/ipc";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "mixer", label: "Mixer", icon: AudioLines },
  { id: "devices", label: "Devices", icon: Speaker },
  { id: "profiles", label: "Profiles", icon: Layers },
  { id: "rules", label: "Rules", icon: Workflow },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
] as const;

export function Sidebar() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);

  return (
    <aside className="flex w-[168px] shrink-0 flex-col border-r border-border/70 bg-background">
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={cn(
                "relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors",
                "hover:bg-accent/70 hover:text-foreground",
                active && "bg-secondary text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="space-y-1.5 border-t border-border/70 p-2.5">
        <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sliders className="h-3.5 w-3.5" />
            <span>Mini Mode</span>
          </div>
          <Switch
            checked={false}
            onCheckedChange={() => void api.openQuickMixer()}
            className="scale-90"
            aria-label="Toggle Mini Mode"
          />
        </div>
        <button
          onClick={() => void api.quit()}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <Power className="h-3.5 w-3.5" />
          <span>Quit</span>
        </button>
      </div>
    </aside>
  );
}