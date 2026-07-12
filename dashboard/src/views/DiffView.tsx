import { useState } from "react";
import { useQuery } from "convex/react";
import { api, type Id } from "../api.js";
import { usd } from "../format.js";

const STATE_COLOR: Record<string, string> = {
  same: "#6b7280",
  changed: "#f59e0b",
  added: "#16a34a",
  removed: "#dc2626",
};

// Side-by-side run diff (L5 observability): aligns steps and highlights
// changed/added/removed — how you explain a regression.
export function DiffView() {
  const runs = useQuery(api.runs.recent, { limit: 30 });
  const [a, setA] = useState<Id<"runs"> | "">("");
  const [b, setB] = useState<Id<"runs"> | "">("");
  const diff = useQuery(
    api.traces.diff,
    a && b ? { runA: a as Id<"runs">, runB: b as Id<"runs"> } : "skip",
  );

  const opts = runs ?? [];
  return (
    <div>
      <h2>Run diff</h2>
      <div className="row">
        <select value={a} onChange={(e) => setA(e.target.value as Id<"runs">)}>
          <option value="">Run A…</option>
          {opts.map((r) => (
            <option key={r._id} value={r._id}>
              {r.competitorName} · {new Date(r.startedAt).toLocaleString()} · {r.status}
            </option>
          ))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value as Id<"runs">)}>
          <option value="">Run B…</option>
          {opts.map((r) => (
            <option key={r._id} value={r._id}>
              {r.competitorName} · {new Date(r.startedAt).toLocaleString()} · {r.status}
            </option>
          ))}
        </select>
      </div>

      {diff && (
        <table className="grid">
          <thead>
            <tr>
              <th>Δ</th>
              <th>Agent</th>
              <th>Step</th>
              <th>A</th>
              <th>B</th>
            </tr>
          </thead>
          <tbody>
            {diff.rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <span className="badge" style={{ background: STATE_COLOR[row.state] }}>
                    {row.state}
                  </span>
                </td>
                <td className={`agent agent-${row.agent}`}>{row.agent}</td>
                <td>
                  {row.type}: {row.label}
                </td>
                <td>{row.a ? `${row.a.status} · ${usd(row.a.costUsd)}` : "—"}</td>
                <td>{row.b ? `${row.b.status} · ${usd(row.b.costUsd)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
