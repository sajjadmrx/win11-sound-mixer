import {
  Speaker,
  Headphones,
  Bluetooth,
  Monitor,
  Usb,
  AudioLines,
  Check,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { DeviceInfo } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
  PopoverHeader,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function DeviceIcon({
  kind,
  className,
}: {
  kind: string;
  className?: string;
}) {
  switch (kind) {
    case "headphones":
      return <Headphones className={cn("h-4 w-4", className)} />;
    case "bluetooth":
      return <Bluetooth className={cn("h-4 w-4", className)} />;
    case "hdmi":
      return <Monitor className={cn("h-4 w-4", className)} />;
    case "usb":
      return <Usb className={cn("h-3.5 w-3.5", className)} />;
    default:
      return <Speaker className={cn("h-3.5 w-3.5", className)} />;
  }
}

function DeviceRow({
  device,
  selected,
  onSelect,
}: {
  device: DeviceInfo;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(device.id)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        selected ? "bg-primary/10 border border-primary/20" : "hover:bg-accent/70 border border-transparent",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-elevated text-muted-foreground",
          selected && "border-primary/40 text-primary",
        )}
      >
        <DeviceIcon kind={device.kind} className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-tight text-foreground/95">
          {device.name}
        </span>
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
          {device.description}
        </span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

interface DevicePickerProps {
  value: string | null;
  onSelect: (deviceId: string | null) => void;
  align?: "start" | "end" | "center";
  className?: string;
  compact?: boolean;
  showFooter?: boolean;
  children?: React.ReactNode;
  header?: {
    title?: string;
    subtitle?: string;
  };
}

export function DevicePicker({
  value,
  onSelect,
  align = "start",
  className,
  compact = false,
  showFooter = true,
  children,
  header,
}: DevicePickerProps) {
  const devices = useStore((s) => s.devices);
  const defaultDeviceId = useStore((s) => s.defaultDeviceId);
  const setPage = useStore((s) => s.setPage);

  const effective = value ?? defaultDeviceId;
  const selected = devices.find((d) => d.id === effective);
  const missing = effective != null && !selected;

  const label = missing
    ? "Device unavailable"
    : selected?.name ?? "Output device";
  const description = selected?.description ?? "";

  const isIconOnly = className?.includes("p-0") || className?.includes("w-6") || className?.includes("w-7");

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children ? (
          children
        ) : isIconOnly ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center p-0 text-muted-foreground hover:text-foreground rounded-md transition-colors",
              className,
            )}
            title={selected ? `${selected.name} (${selected.description})` : description}
          >
            {missing ? (
              <AudioLines className="h-3.5 w-3.5 text-destructive" />
            ) : selected ? (
              <DeviceIcon
                kind={selected.kind}
                className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground"
              />
            ) : (
              <Speaker className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className={cn(
              "justify-start gap-2 bg-elevated/50 font-normal text-foreground/90 hover:bg-elevated",
              "max-w-[200px] shrink-0 border-border/80 px-2.5",
              className,
            )}
            title={description}
          >
            {missing ? (
              <AudioLines className="h-4 w-4 shrink-0 text-destructive" />
            ) : selected ? (
              <DeviceIcon
                kind={selected.kind}
                className="shrink-0 text-muted-foreground"
              />
            ) : (
              <Speaker className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-[13px]">{label}</span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("p-0", compact ? "w-72" : "w-[320px]")}
      >
        <PopoverHeader {...header} />
        <div className="max-h-[300px] overflow-y-auto p-1.5 pt-1 space-y-0.5">
          {devices.filter((d) => d.state === "active").length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No active output devices found
            </div>
          )}
          {devices
            .filter((d) => d.state === "active")
            .map((d) => (
              <DeviceRow
                key={d.id}
                device={d}
                selected={d.id === effective}
                onSelect={(id) => onSelect(id)}
              />
            ))}
        </div>
        {showFooter && (
          <>
            <div className="mx-3 border-t border-border/70" />
            <PopoverClose asChild>
              <button
                className="flex w-full items-center gap-2.5 px-3.5 py-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                onClick={() => setPage("devices")}
              >
                <Settings2 className="h-4 w-4" />
                Device Settings
              </button>
            </PopoverClose>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
