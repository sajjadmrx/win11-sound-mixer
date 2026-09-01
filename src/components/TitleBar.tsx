import { Minus, Pin, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "@/lib/ipc";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function TitleBtn({
  onClick,
  danger,
  active,
  label,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        danger && "hover:bg-destructive/15 hover:text-destructive",
        active && "text-primary",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const pinned = useStore((s) => s.pinned);
  const setPinned = useStore((s) => s.setPinned);

  return (
    <div className="flex h-10 shrink-0 items-center border-b border-border/70 bg-background pl-4 pr-2">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-2.5"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-primary/15">
          <span className="h-2 w-2 rounded-[3px] bg-primary" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight">Mixero</span>
        <span className="hidden text-[11px] text-muted-foreground sm:block">
          Audio Mixer
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <TitleBtn
          label={pinned ? "Unpin on top" : "Keep on top"}
          active={pinned}
          onClick={() => setPinned(!pinned)}
        >
          <Pin className="h-[15px] w-[15px]" />
        </TitleBtn>
        <TitleBtn label="Minimize" onClick={() => api.minimizeWindow("main")}>
          <Minus className="h-4 w-4" />
        </TitleBtn>
        <TitleBtn
          label="Maximize"
          onClick={() => api.toggleMaximizeWindow("main")}
        >
          <Square className="h-3.5 w-3.5" />
        </TitleBtn>
        <TitleBtn label="Close (to tray)" danger onClick={() => getCurrentWindow().close()}>
          <X className="h-4 w-4" />
        </TitleBtn>
      </div>
    </div>
  );
}