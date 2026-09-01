import { useEffect, useState, type ReactNode } from "react";
import {
  Focus,
  Keyboard,
  PanelRight,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { ShortcutBinding } from "@/lib/types";
import { PageHeader } from "@/components/controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const META: Record<
  string,
  { label: string; desc: string; icon: typeof Volume2 }
> = {
  open_quick: {
    label: "Open Quick Mixer",
    desc: "Show the floating mini mixer anywhere on screen.",
    icon: PanelRight,
  },
  open_mixer: {
    label: "Open Mixer",
    desc: "Bring the main Mixero window to the front.",
    icon: Square,
  },
  master_up: {
    label: "Master volume up",
    desc: "Raise system volume by 5%.",
    icon: Volume2,
  },
  master_down: {
    label: "Master volume down",
    desc: "Lower system volume by 5%.",
    icon: Volume2,
  },
  master_mute: {
    label: "Toggle master mute",
    desc: "Mute or unmute everything at once.",
    icon: VolumeX,
  },
  focus_toggle: {
    label: "Toggle Focus Audio",
    desc: "Instantly enter or leave Focus Audio mode.",
    icon: Focus,
  },
};

const DEFAULT_BINDINGS: ShortcutBinding[] = [
  { action: "open_quick", keys: "ctrl+alt+m", enabled: true },
  { action: "master_up", keys: "ctrl+alt+up", enabled: true },
  { action: "master_down", keys: "ctrl+alt+down", enabled: true },
  { action: "master_mute", keys: "ctrl+alt+u", enabled: true },
  { action: "focus_toggle", keys: "ctrl+alt+f", enabled: true },
];

const KEY_LABEL: Record<string, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  super: "Win",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  space: "Space",
  tab: "Tab",
  enter: "Enter",
  esc: "Esc",
};

export function displayKeys(keys: string): string[] {
  if (!keys) return ["—"];
  return keys.split("+").map((k) => {
    const pretty = KEY_LABEL[k];
    if (pretty) return pretty;
    if (/^f\d{1,2}$/i.test(k)) return k.toUpperCase();
    if (/^[a-z]$/i.test(k)) return k.toUpperCase();
    return k;
  });
}

function captureKeys(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("ctrl");
  if (e.altKey) mods.push("alt");
  if (e.shiftKey) mods.push("shift");
  if (e.metaKey) mods.push("super");

  const code = e.code;
  const raw = e.key;

  if (["Control", "Alt", "Shift", "Meta"].includes(raw)) return null;

  let key: string | null = null;

  // Handle standard keys via code to be layout independent
  if (/^Key([A-Z])$/i.test(code)) {
    key = code.replace(/^Key/i, "").toLowerCase();
  } else if (/^Digit([0-9])$/i.test(code)) {
    key = code.replace(/^Digit/i, "");
  } else if (/^F([1-9]|1\d|2[0-4])$/i.test(code)) {
    key = code.toLowerCase();
  } else if (code === "ArrowUp" || raw === "ArrowUp") {
    key = "up";
  } else if (code === "ArrowDown" || raw === "ArrowDown") {
    key = "down";
  } else if (code === "ArrowLeft" || raw === "ArrowLeft") {
    key = "left";
  } else if (code === "ArrowRight" || raw === "ArrowRight") {
    key = "right";
  } else if (code === "Space" || raw === " ") {
    key = "space";
  } else if (code === "Tab" || raw === "Tab") {
    key = "tab";
  } else if (code === "Enter" || raw === "Enter") {
    key = "enter";
  } else if (code === "Escape" || raw === "Escape") {
    key = "esc";
  } else {
    const low = raw.toLowerCase();
    if (/^[a-z0-9]$/.test(low)) key = low;
  }

  if (!key) return null;
  if (mods.length === 0) return null;
  return [...mods, key].join("+");
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

export function ShortcutsPage() {
  const shortcuts = useStore((s) => s.shortcuts);
  const updateShortcuts = useStore((s) => s.updateShortcuts);
  const [recording, setRecording] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const plainEsc =
        e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
      if (plainEsc) {
        setRecording(null);
        return;
      }
      const keys = captureKeys(e);
      if (!keys) return;
      const used = shortcuts.some(
        (b) => b.action !== recording && b.enabled && b.keys === keys,
      );
      if (used) {
        setError(
          `${displayKeys(keys).join(" ")} is already assigned to another shortcut.`,
        );
        setTimeout(() => setError(null), 2800);
        setRecording(null);
        return;
      }
      const next = shortcuts.map((b) =>
        b.action === recording ? { ...b, keys } : b,
      );
      void updateShortcuts(next);
      setRecording(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording, shortcuts, updateShortcuts]);

  const toggleEnabled = (action: string, enabled: boolean) => {
    void updateShortcuts(
      shortcuts.map((b) => (b.action === action ? { ...b, enabled } : b)),
    );
  };

  const resetDefaults = () => {
    setRecording(null);
    void updateShortcuts(DEFAULT_BINDINGS);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pb-3 pt-[18px]">
        <PageHeader
          title="Shortcuts"
          subtitle="Global hotkeys that work even when Mixero is hidden."
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
        <Card
          title="Global shortcuts"
          desc="Registered system-wide. Click a key combo to record a new one."
          right={<Keyboard className="h-4 w-4 text-muted-foreground" />}
        >
          {error && (
            <div className="mb-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-0.5">
            {shortcuts.map((b) => {
              const meta = META[b.action] ?? {
                label: b.action,
                desc: "",
                icon: Keyboard,
              };
              const Icon = meta.icon;
              return (
                <div
                  key={b.action}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-elevated text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-foreground/95">
                      {meta.label}
                    </div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {meta.desc}
                    </div>
                  </div>

                  {recording === b.action ? (
                    <button
                      onClick={() => setRecording(null)}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2.5 text-[12px] font-medium text-primary animate-pulse"
                      title="Click to cancel"
                    >
                      Press a shortcut…
                    </button>
                  ) : (
                    <button
                      onClick={() => setRecording(b.action)}
                      disabled={!b.enabled}
                      className="flex h-8 shrink-0 items-center gap-1 rounded-md px-1 transition-colors hover:bg-accent disabled:opacity-40"
                      title={`Record a new shortcut for ${meta.label}`}
                    >
                      {displayKeys(b.keys).map((k) => (
                        <kbd key={k} className="kbd">
                          {k}
                        </kbd>
                      ))}
                    </button>
                  )}

                  <Switch
                    checked={b.enabled}
                    onCheckedChange={(v) => toggleEnabled(b.action, v)}
                    aria-label={`Toggle ${meta.label}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <p className="text-[11.5px] text-muted-foreground">
              Tip: a shortcut needs at least one modifier (Ctrl, Alt, Win…).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[12px]"
              onClick={resetDefaults}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset defaults
            </Button>
          </div>
        </Card>

        <Card
          title="How they work"
          desc="A quick reference for what each hotkey does."
        >
          <ul className="space-y-2 text-[12.5px] text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <span className="kbd mr-1 align-middle">Ctrl Alt M</span>
                toggles the compact Quick Mixer overlay — always on top, ready in
                a keystroke.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                Volume shortcuts step by 5%, so a quick press is never dramatic.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                Shortcuts are registered when you change them — no restart
                needed.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}