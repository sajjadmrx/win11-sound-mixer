import { useState } from "react";
import { Plus, Workflow, Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Rule, RuleAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RuleBuilder } from "./RuleBuilder";

const KIND_LABEL: Record<string, string> = {
  set_volume: "Set volume",
  set_mute: "Set mute",
  set_device: "Set output",
  activate_profile: "Activate profile",
};

function actionName(
  a: RuleAction,
  deviceName: (id: string | null) => string,
  profileName: (id: string) => string,
) {
  switch (a.kind) {
    case "set_volume":
      return `Volume → ${Math.round(Number(a.value))}%`;
    case "set_mute":
      return a.value === "true" ? "Mute" : "Unmute";
    case "set_device":
      return `Output → ${deviceName(a.value) || "Default"}`;
    case "activate_profile":
      return `Profile → ${profileName(a.value)}`;
    default:
      return a.kind;
  }
}

export function RulesPage() {
  const rules = useStore((s) => s.rules);
  const updateRules = useStore((s) => s.updateRules);
  const devices = useStore((s) => s.devices);
  const apps = useStore((s) => s.apps);
  const profiles = useStore((s) => s.profiles);

  const [editing, setEditing] = useState<Rule | "new" | null>(null);

  const deviceName = (id: string | null) =>
    id ? devices.find((d) => d.id === id)?.name ?? id : "Default";
  const profileName = (id: string) =>
    profiles.find((p) => p.id === id)?.name ?? id;
  const appName = (exe: string) =>
    apps.find((a) => a.exe === exe)?.display_name ??
    exe.charAt(0).toUpperCase() + exe.slice(1);

  const remove = (id: string) => updateRules(rules.filter((r) => r.id !== id));

  const newRule = (): Rule => ({
    id: `r-${Date.now()}`,
    enabled: true,
    trigger_kind: "app_start",
    trigger_value: "",
    actions: [],
  });

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pb-3 pt-[18px]">
        <PageHeader
          title="Rules"
          subtitle="Make Mixero react to apps and devices automatically."
          right={
            <Button
              size="sm"
              className="h-8 gap-2 text-[12.5px]"
              onClick={() => setEditing(newRule())}
            >
              <Plus className="h-3.5 w-3.5" />
              Add rule
            </Button>
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {rules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-elevated">
              <Workflow className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-[15px] font-semibold">No rules yet</h3>
            <p className="mt-1 max-w-xs text-[12.5px] text-muted-foreground">
              Example: “When Discord starts, set its volume to 75% and route it
              to Headphones.”
            </p>
            <Button
              size="sm"
              className="mt-4 gap-2"
              onClick={() => setEditing(newRule())}
            >
              <Plus className="h-3.5 w-3.5" />
              Create your first rule
            </Button>
          </div>
        )}
<div className="space-y-2">
          {rules.map((r) => {
            const trigger =
              r.trigger_kind === "device_connect"
                ? `${deviceName(r.trigger_value) || "A device"} connects`
                : `${appName(r.trigger_value) || "An app"} starts`;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3",
                  r.enabled ? "border-border/70" : "border-border/40 opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-elevated",
                    r.enabled
                      ? "border-primary/25 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <Workflow className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      When
                    </span>
                    <span className="truncate font-semibold">{trigger}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      Do
                    </span>
                    {r.actions.length === 0 && (
                      <span className="text-[11.5px] text-muted-foreground">
                        nothing (not yet configured)
                      </span>
                    )}
                    {r.actions.map((a, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="rounded-md border border-border/70 bg-elevated/60 px-1.5 py-0.5 text-[11.5px] text-foreground/90">
                          {KIND_LABEL[a.kind]}: {actionName(a, deviceName, profileName)}
                        </span>
                        {i < r.actions.length - 1 && (
                          <span className="text-[10px] text-muted-foreground">AND</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(on) =>
                    updateRules(
                      rules.map((x) =>
                        x.id === r.id ? { ...x, enabled: on } : x,
                      ),
                    )
                  }
                  aria-label="Toggle rule"
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Edit rule"
                  onClick={() => setEditing(r)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Delete rule"
                  className="text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <RuleBuilder
          rule={editing === "new" ? newRule() : editing}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            const exists = rules.some((r) => r.id === updated.id);
            updateRules(
              exists
                ? rules.map((r) => (r.id === updated.id ? updated : r))
                : [updated, ...rules],
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}