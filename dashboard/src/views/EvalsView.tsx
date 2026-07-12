import { useQuery } from "convex/react";
import { api } from "../api.js";
import { when } from "../format.js";

// Eval pass-rate trend across versions — evidence of "measurable gains".
export function EvalsView() {
  const trend = useQuery(api.evals.trend, {});
  const cases = useQuery(api.evals.activeCases, {});
  const max = 100;

  return (
    <div>
      <h2>Evaluation & iteration</h2>

      <div className="card">
        <h3>Pass rate across versions</h3>
        {trend && trend.length > 0 ? (
          <div className="bars">
            {trend.map((t) => (
              <div key={t._id} className="bar-col">
                <div className="bar" style={{ height: `${t.passRate * max}%` }} title={`${(t.passRate * 100).toFixed(0)}%`} />
                <div className="bar-label">
                  {t.version}
                  <br />
                  {(t.passRate * 100).toFixed(0)}%
                </div>
                <div className="bar-sub">{when(t.startedAt).split(",")[0]}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No eval runs recorded yet. Run `npm run orch:evals`.</div>
        )}
      </div>

      <div className="card">
        <h3>Eval cases ({cases?.length ?? 0})</h3>
        <table className="grid small">
          <thead>
            <tr>
              <th>Name</th>
              <th>Competitor</th>
              <th>Source</th>
              <th>Min</th>
              <th>Categories</th>
            </tr>
          </thead>
          <tbody>
            {cases?.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>{c.competitorName}</td>
                <td>
                  <span className={c.source === "regression" ? "badge warn" : "badge"}>
                    {c.source}
                  </span>
                </td>
                <td>{c.minFindings}</td>
                <td>{c.expectCategories.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
