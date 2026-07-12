import { useState } from "react";
import type { Id } from "./api.js";
import { RunsView } from "./views/RunsView.js";
import { RunDetail } from "./views/RunDetail.js";
import { DiffView } from "./views/DiffView.js";
import { CompetitorsView } from "./views/CompetitorsView.js";
import { AlertsView } from "./views/AlertsView.js";
import { ActionsView } from "./views/ActionsView.js";
import { EvalsView } from "./views/EvalsView.js";
import { SearchView } from "./views/SearchView.js";

export type View =
  | { name: "runs" }
  | { name: "run"; runId: Id<"runs"> }
  | { name: "diff" }
  | { name: "competitors" }
  | { name: "alerts" }
  | { name: "actions" }
  | { name: "evals" }
  | { name: "search" };

const TABS: { key: View["name"]; label: string }[] = [
  { key: "runs", label: "Runs" },
  { key: "competitors", label: "Competitors & Trackers" },
  { key: "alerts", label: "Alerts" },
  { key: "actions", label: "Action Queue" },
  { key: "diff", label: "Run Diff" },
  { key: "search", label: "Search" },
  { key: "evals", label: "Evals" },
];

export function App() {
  const [view, setView] = useState<View>({ name: "runs" });
  const go = (v: View) => setView(v);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          🕵️ Stalker Hermes <span className="tag">competitive-intel agency</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={view.name === t.key ? "tab active" : "tab"}
              onClick={() => go({ name: t.key } as View)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {view.name === "runs" && <RunsView onOpen={(runId) => go({ name: "run", runId })} />}
        {view.name === "run" && (
          <RunDetail runId={view.runId} onBack={() => go({ name: "runs" })} />
        )}
        {view.name === "diff" && <DiffView />}
        {view.name === "competitors" && <CompetitorsView />}
        {view.name === "alerts" && <AlertsView />}
        {view.name === "actions" && <ActionsView />}
        {view.name === "evals" && <EvalsView />}
        {view.name === "search" && <SearchView />}
      </main>
    </div>
  );
}
