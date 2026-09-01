import { RefreshCw, Star, Route, Moon } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/controls";
import { DevicePicker, DeviceIcon } from "@/components/DevicePicker";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VolumeSlider } from "@/components/ui/slider";

export function DevicesPage() {
  const devices = useStore((s) => s.devices);
  const apps = useStore((s) => s.apps);
  const icons = useStore((s) => s.icons);
  const defaultDeviceId = useStore((s) => s.defaultDeviceId);
  const setDefaultDevice = useStore((s) => s.setDefaultDevice);
  const setAppDevice = useStore((s) => s.setAppDevice);
  const safety = useStore((s) => s.safety);
  const updateSafety = useStore((s) => s.updateSafety);
  const nightActive = useStore((s) => s.nightActive);
  const refresh = useStore((s) => s.refresh);

  const setLimit = (id: string, value: number) => {
    const limits = { ...safety.device_limits };
    if (value >= 100) {
      delete limits[id];
    } else {
      limits[id] = value;
    }
    updateSafety({ ...safety, device_limits: limits });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pb-3 pt-[18px]">
        <PageHeader
          title="Devices"
          subtitle="Output hardware, routing, and safety limits."
          right={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-[12.5px]"
              onClick={refresh}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh devices
            </Button>
          }
        />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Route className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold">App routing</h2>
            <span className="truncate pl-1 text-[11.5px] text-muted-foreground">
              Send each app to any output. Volume is remembered per device.
            </span>
          </div>
          {apps.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-[12.5px] text-muted-foreground">
              No apps running. Start an app to route it.
            </div>
          )}
          <div className="space-y-1.5">
            {apps.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2"
              >
                <AppIcon
                  appId={app.id}
                  name={app.display_name}
                  icon={icons[app.id] ?? app.icon}
                  className="h-8 w-8 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {app.display_name}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {app.exe}
                  </div>
                </div>
                <DevicePicker
                  compact
                  value={app.routed_device}
                  onSelect={(devId) => setAppDevice(app.id, devId)}
                  className="w-48"
                  header={{
                    title: "Route app",
                    subtitle: `Where ${app.display_name} should play`,
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold">Devices</h2>
            <span className="truncate pl-1 text-[11.5px] text-muted-foreground">
              Change the default output or set a maximum volume per device.
            </span>
          </div>
          {devices.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-[12.5px] text-muted-foreground">
              No output devices available.
            </div>
          )}
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
            {devices.map((d) => {
              const isDefault = d.id === defaultDeviceId;
              const limit = Math.min(safety.device_limits[d.id] ?? 100, 100);
              const nightCapped =
                nightActive && isDefault && safety.night.max_volume < limit;
              return (
                <div
                  key={d.id}
                  className={cn(
                    "rounded-xl border bg-card p-3.5",
                    isDefault ? "border-primary/40" : "border-border/70",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-elevated",
                        isDefault
                          ? "border-primary/30 text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <DeviceIcon kind={d.kind} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold leading-tight">
                          {d.name}
                        </span>
                        {isDefault && <Badge variant="accent">Default</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground leading-tight">
                        <span className="truncate">{d.description}</span>
                        <span className="opacity-60">·</span>
                        <span className="capitalize">{d.state}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Maximum volume</span>
                      <span className="font-medium tabular-nums">
                        {limit < 100 ? `${Math.round(limit)}%` : "No limit"}
                      </span>
                    </div>
                    <VolumeSlider
                      value={[limit]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(v) => setLimit(d.id, v[0])}
                    />
                    {limit < 100 && (
                      <button
                        onClick={() => setLimit(d.id, 100)}
                        className="mt-1 text-[11px] text-primary hover:underline"
                      >
                        Remove limit
                      </button>
                    )}
                  </div>

                  {nightCapped && (
                    <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-1.5 text-[11px] text-indigo-300">
                      <Moon className="h-3 w-3" />
                      Night quiet hours: max {Math.round(safety.night.max_volume)}%
                    </div>
                  )}

                  {!isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 h-7 w-full gap-1.5 text-[12px]"
                      onClick={() => setDefaultDevice(d.id)}
                    >
                      <Star className="h-3 w-3" />
                      Set as default
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}