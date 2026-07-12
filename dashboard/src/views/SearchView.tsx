import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../api.js";
import { usd, when, STATUS_COLOR } from "../format.js";

// Cross-run trace search (L5 observability: "search across runs").
export function SearchView() {
  const [term, setTerm] = useState("");
  const results = useQuery(api.traces.search, term.length >= 2 ? { term, limit: 100 } : "skip");

  return (
    <div>
      <h2>Search across runs</h2>
      <input
        className="search"
        placeholder="Search trace labels & outputs (e.g. funding, error, linkedin)…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {results && (
        <table className="grid">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Type</th>
              <th>Label</th>
              <th>Status</th>
              <th>Cost</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r._id}>
                <td className={`agent agent-${r.agent}`}>{r.agent}</td>
                <td>{r.type}</td>
                <td>{r.label}</td>
                <td>
                  <span className="dot" style={{ background: STATUS_COLOR[r.status] }} /> {r.status}
                </td>
                <td>{usd(r.costUsd)}</td>
                <td>{when(r.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {term.length >= 2 && results?.length === 0 && <div className="empty">No matches.</div>}
    </div>
  );
}
