import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Profile, ProfileApp } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VolumeSlider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DevicePicker } from "@/components/DevicePicker";
import { MuteButton } from "@/components/MuteButton";
import { AppIcon } from "@/components/AppIcon";

const EMOJIS = ["🎮", "💼", "🎵", "🎬", "🏠", "📻", "🧘", "🔴"];

export function ProfileEditor({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (p: Profile) => void;
}) {
  const apps = useStore((s) => s.apps);
  const icons = useStore((s) => s.icons);

  const [draft, setDraft] = useState<Profile>(() =>
    JSON.parse(JSON.stringify(profile)),
  );

  const appName = (exe: string) =>
    apps.find((a) => a.exe === exe)?.display_name ??
    exe.charAt(0).toUpperCase() + exe.slice(1);

  const available: string[] = Array.from(
    new Set([...apps.map((a) => a.exe), ...draft.apps.map((a) => a.exe)]),
  );

  const setVolume = (exe: string, volume: number) => {
    setDraft((d) => ({
      ...d,
      apps: d.apps.map((a) => (a.exe === exe ? { ...a, volume, mute: false } : a)),
    }));
  };
  const setMute = (exe: string, mute: boolean) => {
    setDraft((d) => ({
      ...d,
      apps: d.apps.map((a) => (a.exe === exe ? { ...a, mute } : a)),
    }));
  };
  const toggleInclude = (exe: string) => {
    setDraft((d) => {
      const exists = d.apps.some((a) => a.exe === exe);
      if (exists) return { ...d, apps: d.apps.filter((a) => a.exe !== exe) };
      const source = apps.find((a) => a.exe === exe);
      const entry: ProfileApp = {
        exe,
        volume: source?.volume ?? 50,
        mute: source?.mute ?? false,
      };
      return { ...d, apps: [...d.apps, entry] };
    });
  };

  const setMaster = (v: number | null) => setDraft((d) => ({ ...d, master_volume: v }));
  const setDevice = (deviceId: string | null) =>
    setDraft((d) => ({ ...d, device_id: deviceId }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>
          When you apply this profile, Mixero restores everything below.
        </DialogDescription>

        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="mb-1 block text-[12px] text-muted-foreground">
                Name
              </label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-muted-foreground">
                Icon
              </label>
              <div className="flex items-center gap-1">
                {EMOJIS.slice(0, 5).map((e) => (
                  <button
                    key={e}
                    onClick={() => setDraft((d) => ({ ...d, emoji: e }))}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border text-base",
                      draft.emoji === e
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-elevated/60",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
              Output device
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant={!draft.device_id ? "default" : "outline"}
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => setDevice(null)}
              >
                System default
              </Button>
              <DevicePicker
                compact
                value={draft.device_id}
                onSelect={setDevice}
                className="w-[180px]"
                showFooter={false}
                header={{ title: "Output device", subtitle: "Send this profile's audio here" }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-elevated/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium">Master volume</div>
                <div className="text-[11px] text-muted-foreground">
                  Set the master output when this profile activates
                </div>
              </div>
              <Switch
                checked={draft.master_volume != null}
                onCheckedChange={(on) => setMaster(on ? 60 : null)}
              />
            </div>
            {draft.master_volume != null && (
              <div className="mt-3 flex items-center gap-3">
                <VolumeSlider
                  value={[draft.master_volume]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => setMaster(v[0])}
                />
                <span className="w-10 text-right text-[13px] font-semibold tabular-nums">
                  {Math.round(draft.master_volume)}%
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
              Applications
            </label>
            {available.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-[12px] text-muted-foreground">
                Start some apps and they will appear here.
              </div>
            )}
            <div className="space-y-1.5">
              {available.map((exe) => {
                const entry = draft.apps.find((a) => a.exe === exe);
                const source = apps.find((a) => a.exe === exe);
                const included = !!entry;
                return (
                  <div
                    key={exe}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors",
                      included
                        ? "border-border/80 bg-elevated/40"
                        : "border-border/50 bg-transparent",
                    )}
                  >
                    <AppIcon
                      appId={source?.id ?? exe}
                      name={appName(exe)}
                      icon={source ? icons[source.id] ?? source.icon : null}
                      className="h-6 w-6 shrink-0 rounded-md"
                    />
                    <span className="w-28 min-w-0 truncate text-[12.5px] font-medium">
                      {appName(exe)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {included ? (
                        <VolumeSlider
                          value={[entry.volume]}
                          min={0}
                          max={100}
                          step={1}
                          muted={entry.mute}
                          onValueChange={(v) => setVolume(exe, v[0])}
                        />
                      ) : (
                        <div className="text-[11px] text-muted-foreground/70">
                          Not included in this profile
                        </div>
                      )}
                    </div>
                    {included && (
                      <span className="w-9 text-right text-[12px] font-medium tabular-nums text-muted-foreground">
                        {Math.round(entry.volume)}%
                      </span>
                    )}
                    {included && (
                      <MuteButton
                        muted={entry.mute}
                        onToggle={() => setMute(exe, !entry.mute)}
                        size="sm"
                      />
                    )}
                    <Switch
                      checked={included}
                      onCheckedChange={() => toggleInclude(exe)}
                      aria-label={`Include ${appName(exe)}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave({ ...draft, name: draft.name.trim() || "My mix" })}
          >
            <Plus className="h-3.5 w-3.5" />
            Save profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}