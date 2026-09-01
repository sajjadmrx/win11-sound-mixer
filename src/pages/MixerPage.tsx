import type React from "react";
import {
  AudioLines,
  AlertTriangle,
  RefreshCw,
  Pin,
  Settings,
  ChevronDown,
  List,
  LayoutGrid,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStore, visibleApps } from "@/lib/store";
import type { SortMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  SearchInput,
  MenuSelect,
  type MenuOption,
} from "@/components/controls";
import { DevicePicker, DeviceIcon } from "@/components/DevicePicker";
import { AppRow, AppCard } from "@/components/AppRow";
import { VolumeSlider } from "@/components/ui/slider";
import { MuteButton } from "@/components/MuteButton";
import { Button } from "@/components/ui/button";

const SORT_OPTIONS: MenuOption[] = [
  { value: "currently-playing", label: "Currently Playing", hint: "Active apps first" },
  { value: "name", label: "Application Name", hint: "Alphabetical order" },
  { value: "volume", label: "Volume", hint: "Loudest first" },
  { value: "recently-active", label: "Recently Active", hint: "Last played first" },
];

export function MixerPage() {
  const apps = useStore((s) => s.apps);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const sort = useStore((s) => s.settings.sort);
  const setSort = useStore((s) => s.setSort);
  const gridView = useStore((s) => s.settings.grid_view);
  const patchSettings = useStore((s) => s.patchSettings);
  const pinned = useStore((s) => s.pinned);
  const setPinned = useStore((s) => s.setPinned);
  const setPage = useStore((s) => s.setPage);
  const refresh = useStore((s) => s.refresh);

  const visible = visibleApps(apps, search, sort);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pb-2 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">
              Mixer
            </h1>
            <p className="text-[12.5px] text-muted-foreground">
              Control your audio environment
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh"
              title="Refresh audio"
              onClick={refresh}
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Keep on top"
              title={pinned ? "Unpin on top" : "Keep on top"}
              className={cn(pinned && "text-primary hover:text-primary")}
              onClick={() => setPinned(!pinned)}
            >
              <Pin className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Settings"
              title="Settings"
              onClick={() => setPage("settings")}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 mt-2">
          <OutputDeviceCard />
          <MasterSection />
        </div>

        <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search applications..."
            className="w-64"
          />
          <div className="flex items-center gap-2">
            <MenuSelect
              value={sort}
              options={SORT_OPTIONS}
              onSelect={(v) => setSort(v as SortMode)}
              label="Sort by"
              className="w-48"
            />
            <div className="flex items-center rounded-lg border border-border/70 bg-card p-0.5">
              <Button
                variant={!gridView ? "secondary" : "ghost"}
                size="icon-xs"
                className="h-7 w-7 rounded-md"
                aria-label="List view"
                onClick={() => patchSettings({ grid_view: false })}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={gridView ? "secondary" : "ghost"}
                size="icon-xs"
                className="h-7 w-7 rounded-md"
                aria-label="Grid view"
                onClick={() => patchSettings({ grid_view: true })}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div>
          {apps.length === 0 && <NoAppsEmpty />}
          {apps.length > 0 && visible.length === 0 && (
            <SearchEmpty query={search} />
          )}
          {gridView ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 pb-2">
              {visible.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 pb-2">
              {visible.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </div>
          )}
        </div>

        {apps.length > 0 && (
          <div className="mt-3 text-[11.5px] text-muted-foreground">
            Showing {visible.length} of {apps.length} applications
          </div>
        )}
      </div>
    </div>
  );
}

function OutputDeviceCard() {
  const devices = useStore((s) => s.devices);
  const defaultDeviceId = useStore((s) => s.defaultDeviceId);
  const setDefaultDevice = useStore((s) => s.setDefaultDevice);
  const refresh = useStore((s) => s.refresh);

  const device =
    devices.find((d) => d.id === defaultDeviceId) ??
    devices.find((d) => d.state === "active");

  if (!device) {
    return (
      <div className="flex h-[76px] items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">No output devices found</div>
          <div className="text-[11.5px] text-muted-foreground">
            Plug something in and refresh.
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <DevicePicker
      value={defaultDeviceId}
      onSelect={(id) => {
        if (id) setDefaultDevice(id);
      }}
      align="start"
      header={{
        title: "Select Output Device",
      }}
    >
      <div className="group flex h-[76px] items-center gap-3.5 rounded-xl border border-border/70 bg-card px-4 transition-colors hover:border-border hover:bg-elevated/40 cursor-pointer">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-foreground">
          <DeviceIcon kind={device.kind} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium leading-none text-muted-foreground">
            Output Device
          </div>
          <div className="mt-1 truncate text-[14.5px] font-semibold leading-tight text-foreground">
            {device.name}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] leading-none text-muted-foreground">
            {device.description}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-y-0.5" />
      </div>
    </DevicePicker>
  );
}

function MasterSection() {
  const master = useStore((s) => s.master);
  const setMasterVolume = useStore((s) => s.setMasterVolume);
  const toggleMasterMute = useStore((s) => s.toggleMasterMute);
  const safety = useStore((s) => s.safety);
  const defaultDeviceId = useStore((s) => s.defaultDeviceId);
  const nightActive = useStore((s) => s.nightActive);

  const limit = Math.min(
    defaultDeviceId ? (safety.device_limits[defaultDeviceId] ?? 100) : 100,
    100,
  );
  const cap = nightActive ? Math.min(limit, safety.night.max_volume) : limit;

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 4 : -4;
    setMasterVolume(master.volume + delta);
  };

  return (
    <div className="flex h-[76px] flex-col justify-between rounded-xl border border-border/70 bg-card px-4 py-3">
      <div className="text-[11px] font-medium leading-none text-muted-foreground">
        Master Volume
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {master.mute ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1" onWheel={onWheel}>
          <VolumeSlider
            value={[master.volume]}
            min={0}
            max={cap}
            step={1}
            muted={master.mute}
            onValueChange={(v) => setMasterVolume(v[0])}
          />
        </div>
        <span
          className={cn(
            "w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums",
            master.mute ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {Math.round(master.volume)}%
        </span>
        <MuteButton muted={master.mute} onToggle={toggleMasterMute} size="sm" />
      </div>
    </div>
  );
}

function NoAppsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-elevated text-muted-foreground">
        <AudioLines className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold">
        No apps are playing audio
      </h3>
      <p className="mt-1 max-w-60 text-[12.5px] text-muted-foreground">
        Start playing something and it will appear here.
      </p>
    </div>
  );
}

function SearchEmpty({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-elevated text-muted-foreground">
        <AudioLines className="h-5 w-5 opacity-40" />
      </div>
      <h3 className="mt-3 text-[14.5px] font-semibold">
        No apps match “{query}”
      </h3>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Try a different name, like &quot;spotify&quot;.
      </p>
    </div>
  );
}