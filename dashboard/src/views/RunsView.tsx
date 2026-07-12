import { useQuery, useMutation } from "convex/react";
import { api, type Id } from "../api.js";
import { usd, ms, when, tokens, STATUS_COLOR } from "../format.js";

export function RunsView({ onOpen }: { onOpen: (id: Id<"runs">) => void }) {
  const runs = useQuery(api.runs.recent, { limit: 50 });
  const competitors = useQuery(api.competitors.list, { activeOnly: true });
  const enqueue = useMutation(api.runQueue.enqueue);

  return (
    <div>
      <div className="row-between">
        <h2>Runs</h2>
        <button
          className="primary"
          onClick={() => enqueue({ trigger: "dashboard", requestedBy: "dashboard" })}
        >
          ▶ Track all active competitors now
        </button>
      </div>

      <div className="chips">
        {competitors?.map((c) => (
          <button
            key={c._id}
            className="chip"
            onClick={() =>
              enqueue({ competitorId: c._id, trigger: "dashboard", requestedBy: "dashboard" })
            }
            title="Trigger an on-demand run for this competitor"
          >
            ▶ {c.name}
          </button>
        ))}
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Competitor</th>
            <th>Status</th>
            <th>Trigger</th>
            <th>New</th>
            <th>Escal.</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Latency</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {runs?.map((r) => (
            <tr key={r._id} className="clickable" onClick={() => onOpen(r._id)}>
              <td>{r.competitorName}</td>
              <td>
                <span className="dot" style={{ background: STATUS_COLOR[r.status] }} /> {r.status}
              </td>
              <td>{r.trigger}</td>
              <td>{r.newFindingsCount}</td>
              <td>{r.escalations}</td>
              <td>{tokens(r.totalTokensIn + r.totalTokensOut)}</td>
              <td>{usd(r.totalCostUsd)}</td>
              <td>{ms(r.latencyMs)}</td>
              <td>{when(r.startedAt)}</td>
            </tr>
          ))}
          {runs?.length === 0 && (
            <tr>
              <td colSpan={9} className="empty">
                No runs yet. Add a competitor, then trigger a run.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
