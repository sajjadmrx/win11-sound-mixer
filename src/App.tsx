import { useEffect } from "react";
import { useStore, type Page } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar } from "@/components/Sidebar";
import { MixerPage } from "@/pages/MixerPage";
import { DevicesPage } from "@/pages/DevicesPage";
import { ProfilesPage } from "@/pages/ProfilesPage";
import { RulesPage } from "@/pages/RulesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ShortcutsPage } from "@/pages/ShortcutsPage";
import { AudioLines } from "lucide-react";

function Splash() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-elevated text-primary animate-pulse-glow">
        <AudioLines className="h-5 w-5" />
      </div>
      <div className="text-[13px] text-muted-foreground">Waking up the mixer…</div>
    </div>
  );
}

const PAGES: Record<Page, React.ComponentType> = {
  mixer: MixerPage,
  devices: DevicesPage,
  profiles: ProfilesPage,
  rules: RulesPage,
  settings: SettingsPage,
  shortcuts: ShortcutsPage,
};

export function App() {
  const loaded = useStore((s) => s.loaded);
  const page = useStore((s) => s.page);
  const init = useStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  const Page = PAGES[page] ?? MixerPage;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-hidden">
            {loaded ? <Page /> : <Splash />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}