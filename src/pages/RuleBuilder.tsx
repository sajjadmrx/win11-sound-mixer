import { useState } from "react";
import { Plus, Trash2, Workflow } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Rule, RuleAction } from "@/lib/types";
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
import { DevicePicker } from "@/components/DevicePicker";
import { MenuSelect, type MenuOption } from "@/components/controls";

const KINDS: MenuOption[] = [
  { value: "set_volume", label: "Set volume" },
  { value: "set_mute", label: "Set mute" },
  { value: "set_device", label: "Set output" },
  { value: "activate_profile", label: "Activate profile" },
];

const TRIGGER_KINDS: MenuOption[] = [
  { value: "app_start", label: "App starts" },
  { value: "device_connect", label: "Device connects" },
];

export function RuleBuilder({
  rule,
  onClose,
  onSave,
}: {
  rule: Rule;
  onClose: () => void;
  onSave: (r: Rule) => void;
}) {
  const apps = useStore((s) => s.apps);
  const devices = useStore((s) => s.devices);
  const profiles = useStore((s) => s.profiles);

  const [draft, setDraft] = useState<Rule>(() =>
    JSON.parse(JSON.stringify(rule)),
  );

  const setAction = (i: number, patch: Partial<RuleAction>) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    }));
  };
  const addAction = () => {
    setDraft((d) => ({
      ...d,
      actions: [...d.actions, { kind: "set_volume", value: "60" }],
    }));
  };
  const removeAction = (i: number) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.filter((_, idx) => idx !== i),
    }));
  };

  const profileOptions: MenuOption[] = profiles.map((p) => ({
    value: p.id,
    label: `${p.emoji || ""} ${p.name}`.trim(),
  }));

  const actionValue = (a: RuleAction, i: number) => {
    switch (a.kind) {
      case "set_volume":
        return (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <VolumeSlider
              value={[Number(a.value) || 0]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setAction(i, { value: String(v[0]) })}
            />
            <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums">
              {Math.round(Number(a.value) || 0)}%
            </span>
          </div>
        );
      case "set_mute":
        return (
          <MenuSelect
            value={a.value}
            align="start"
            className="h-8 w-40"
            options={[
              { value: "true", label: "Muted" },
              { value: "false", label: "Unmuted" },
            ]}
            onSelect={(v) => setAction(i, { value: v })}
          />
        );
      case "set_device":
        return (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DevicePicker
              compact
              value={a.value || null}
              onSelect={(id) => setAction(i, { value: id ?? "" })}
              className="w-[190px]"
              showFooter={false}
              header={{ title: "Output device", subtitle: "Route to this output" }}
            />
            {a.value !== "" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11.5px] text-muted-foreground"
                onClick={() => setAction(i, { value: "" })}
              >
                Default
              </Button>
            ) : (
              <span className="text-[11.5px] text-muted-foreground">
                System default
              </span>
            )}
          </div>
        );
      case "activate_profile":
        return (
          <MenuSelect
            value={a.value}
            align="start"
            className="h-8 w-48"
            placeholder="Choose a profile…"
            options={profileOptions}
            onSelect={(v) => setAction(i, { value: v })}
          />
        );
      default:
        return null;
    }
  };

  const triggerNames = [
    ...apps.map((a) => a.exe),
    ...devices.map((d) => d.name),
    "headphones",
    "speakers",
  ];
return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Automation rule</DialogTitle>
        <DialogDescription>
          Mixero performs these actions automatically — no buttons needed.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {/* WHEN */}
          <div className="rounded-xl border border-border/70 bg-elevated/30 p-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              When
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <MenuSelect
                value={draft.trigger_kind}
                align="start"
                className="h-8 w-40"
                options={TRIGGER_KINDS}
                onSelect={(v) =>
                  setDraft((d) => ({
                    ...d,
                    trigger_kind: v as Rule["trigger_kind"],
                  }))
                }
              />
              <Input
                value={draft.trigger_value}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, trigger_value: e.target.value }))
                }
                list="rule-triggers"
                placeholder={
                  draft.trigger_kind === "app_start"
                    ? "e.g. Spotify, Discord, Valorant"
                    : "e.g. Headphones, Speaker name"
                }
                className="h-8 text-[13px]"
              />
              <datalist id="rule-triggers">
                {triggerNames.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {draft.trigger_kind === "app_start" ? "starts" : "connects"}
              </span>
            </div>
          </div>

          {/* DO */}
          <div className="rounded-xl border border-border/70 bg-elevated/30 p-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Do
            </span>
            <div className="mt-1.5 space-y-2">
              {draft.actions.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-center text-[12px] text-muted-foreground">
                  Add an action below.
                </div>
              )}
              {draft.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-px w-4 shrink-0 bg-border" />
                  <MenuSelect
                    value={a.kind}
                    align="start"
                    className="h-8 w-36 shrink-0"
                    options={KINDS}
                    onSelect={(v) => setAction(i, { kind: v as RuleAction["kind"] })}
                  />
                  {actionValue(a, i)}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove action"
                    className={cn(
                      "shrink-0 text-muted-foreground hover:text-destructive",
                      draft.actions.length === 1 && "invisible",
                    )}
                    onClick={() => removeAction(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            {draft.actions.length > 0 && (
              <div className="my-1 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/80">
                <div className="h-px w-4 bg-border" />
                AND
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-8 gap-1.5 text-[12px]"
              onClick={addAction}
            >
              <Plus className="h-3.5 w-3.5" />
              Add action
            </Button>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!draft.trigger_value.trim()}
            onClick={() => onSave(draft)}
          >
            <Workflow className="h-3.5 w-3.5" />
            Save rule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}