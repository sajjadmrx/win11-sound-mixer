import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./App";
import { QuickMixer } from "./windows/QuickMixer";
import { TrayMenu } from "./windows/TrayMenu";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || String(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center text-red-500 bg-background">
          <div className="font-bold text-sm">UI Rendering Error</div>
          <div className="text-xs text-muted-foreground mt-2 break-all">{this.state.error}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  const [hash, setHash] = React.useState(() => window.location.hash);
  const [label, setLabel] = React.useState<string>("");

  React.useEffect(() => {
    try {
      const appWindow = getCurrentWebviewWindow();
      setLabel(appWindow.label);
    } catch {
      // Not in Tauri or fallback
    }

    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  let content = <App />;
  if (label === "quick" || hash.includes("quick")) {
    content = <QuickMixer />;
  } else if (label === "tray" || hash.includes("tray")) {
    content = <TrayMenu />;
  }

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={250}>
        <React.Suspense fallback={<div className="p-4 text-white">Loading...</div>}>
          {content}
        </React.Suspense>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);