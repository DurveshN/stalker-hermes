import { useQuery } from "convex/react";
import { api } from "../api.js";
import { when } from "../format.js";

export function ActionsView() {
  const items = useQuery(api.actionItems.recent, { limit: 60 });

  return (
    <div>
      <h2>Action Queue</h2>
      <p className="hint">
        GitHub issues and PRs the crew filed off the back of findings. Each links to the
        upstream item so you can act on it.
      </p>
      <table className="grid">
        <thead>
          <tr>
            <th>Kind</th>
            <th>Title</th>
            <th>Status</th>
            <th>GitHub</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((a) => (
            <tr key={a._id}>
              <td>
                <span className={`badge kind-${a.kind}`}>{a.kind}</span>
              </td>
              <td>{a.title}</td>
              <td>
                <span className="chip">{a.status}</span>
              </td>
              <td>
                {a.ghUrl ? (
                  <a href={a.ghUrl} target="_blank" rel="noreferrer">
                    {a.ghNumber != null ? `#${a.ghNumber}` : "link"}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td>{when(a.ts)}</td>
            </tr>
          ))}
          {items?.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                No action items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
