import { useState } from "react";
import {
  Plus,
  Layers,
  CheckCheck,
  Pencil,
  Trash2,
  Copy,
  SlidersHorizontal,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/controls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileEditor } from "./ProfileEditor";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const EMOJIS = ["🎮", "💼", "🎵", "🎬", "🏠", "📻", "🧘", "🔴"];

export function ProfilesPage() {
  const profiles = useStore((s) => s.profiles);
  const updateProfiles = useStore((s) => s.updateProfiles);
  const applyProfile = useStore((s) => s.applyProfile);
  const lastAppliedProfile = useStore((s) => s.lastAppliedProfile);
  const captureCurrentProfile = useStore((s) => s.captureCurrentProfile);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [name, setName] = useState("My mix");
  const [emoji, setEmoji] = useState("🎮");

  const remove = (id: string) => {
    updateProfiles(profiles.filter((p) => p.id !== id));
  };

  const duplicate = (p: Profile) => {
    const copy: Profile = {
      ...p,
      id: `p-${Date.now()}`,
      name: `${p.name} copy`,
    };
    updateProfiles([copy, ...profiles]);
  };

  const create = async () => {
    await captureCurrentProfile(name.trim() || "My mix", emoji);
    setCaptureOpen(false);
    setName("My mix");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pb-3 pt-[18px]">
        <PageHeader
          title="Profiles"
          subtitle="One-click audio environments."
          right={
            <Button
              size="sm"
              className="h-8 gap-2 text-[12.5px]"
              onClick={() => setCaptureOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Capture current mix
            </Button>
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {lastAppliedProfile && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[12.5px] text-primary">
            <CheckCheck className="h-3.5 w-3.5" />
            <span>
              Profile{" "}
              <span className="font-semibold">
                {profiles.find((p) => p.id === lastAppliedProfile)?.name ??
                  lastAppliedProfile}
              </span>{" "}
              applied.
            </span>
            <button
              onClick={() => useStore.setState({ lastAppliedProfile: null })}
              className="ml-auto text-[11px] text-primary/70 hover:text-primary"
            >
              Dismiss
            </button>
          </div>
        )}

        {profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-elevated">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-[15px] font-semibold">No profiles yet</h3>
            <p className="mt-1 max-w-xs text-[12.5px] text-muted-foreground">
              Set the perfect volumes once, then switch between Gaming, Work and
              Music with a single click.
            </p>
            <Button
              size="sm"
              className="mt-4 gap-2"
              onClick={() => setCaptureOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Capture current mix
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((p) => {
            const active = p.id === lastAppliedProfile;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-4",
                  active ? "border-primary/50" : "border-border/70",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-lg">
                    {p.emoji || "🎛️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold leading-tight">
                        {p.name}
                      </span>
                      {active && <Badge variant="accent">Active</Badge>}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {p.apps.length} app{p.apps.length === 1 ? "" : "s"}
                      {p.device_id ? " · custom output" : ""}
                      {p.master_volume != null
                        ? ` · master ${Math.round(p.master_volume)}%`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {p.apps.map((a) => (
                    <span
                      key={a.exe}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border border-border/70 bg-elevated/60 px-1.5 py-0.5 text-[11px]",
                        a.mute && "text-destructive",
                      )}
                    >
                      <span className="max-w-24 truncate">{a.exe}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {a.mute ? "muted" : `${Math.round(a.volume)}%`}
                      </span>
                    </span>
                  ))}
                  {p.apps.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Applies master & output only
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    className="h-7 flex-1 gap-1.5 text-[12px]"
                    onClick={() => applyProfile(p.id)}
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Edit profile"
                    onClick={() => setEditing(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Duplicate profile"
                    onClick={() => duplicate(p)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Delete profile"
                    className="text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => remove(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Save current mix as a profile</DialogTitle>
          <DialogDescription>
            Everything that is playing right now is captured, ready to restore
            later with one click.
          </DialogDescription>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[12px] text-muted-foreground">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gaming"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void create()}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-muted-foreground">
                Icon
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-colors",
                      emoji === e
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-elevated/60 hover:bg-elevated",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCaptureOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void create()}>
              <Plus className="h-3.5 w-3.5" />
              Save profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editing && (
        <ProfileEditor
          profile={editing}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            updateProfiles(
              profiles.map((p) => (p.id === updated.id ? updated : p)),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}