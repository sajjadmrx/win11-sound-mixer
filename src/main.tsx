import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { QuickMixer } from "./windows/QuickMixer";
import { TrayMenu } from "./windows/TrayMenu";

function Root() {
  const hash = window.location.hash;
  if (hash.startsWith("#/quick")) return <QuickMixer />;
  if (hash.startsWith("#/tray")) return <TrayMenu />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);