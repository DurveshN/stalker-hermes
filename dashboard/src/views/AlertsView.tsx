import { useQuery, useMutation } from "convex/react";
import { api } from "../api.js";
import { when, SEV_COLOR } from "../format.js";

export function AlertsView() {
  const alerts = useQuery(api.alerts.recent, { limit: 50 });
  const ack = useMutation(api.alerts.acknowledge);

  return (
    <div>
      <h2>Escalations</h2>
      <p className="hint">
        The crew escalates by exception — only findings at/above each tracker's severity
        threshold land here and get pushed to Telegram + voice.
      </p>
      {alerts?.map((a) => (
        <div key={a._id} className={`alert ${a.acknowledged ? "ack" : ""}`}>
          <span className="badge" style={{ background: SEV_COLOR[a.severity] }}>
            {a.severity}
          </span>
          <span className="alert-msg">{a.message}</span>
          <span className="alert-meta">
            via {a.deliveredVia.join(", ") || "—"} · {when(a.ts)}
          </span>
          {a.voiceUrl && (
            <audio controls src={a.voiceUrl} className="voice" preload="none" />
          )}
          {!a.acknowledged && (
            <button className="chip" onClick={() => ack({ id: a._id })}>
              ack
            </button>
          )}
        </div>
      ))}
      {alerts?.length === 0 && <div className="empty">No escalations yet.</div>}
    </div>
  );
}
