import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api, type Id } from "../api.js";

const CHANNELS = ["linkedin", "twitter", "news", "blog", "seo", "product"] as const;
const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

export function CompetitorsView() {
  const competitors = useQuery(api.competitors.list, {});
  const add = useMutation(api.competitors.add);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");

  return (
    <div>
      <h2>Competitors & tracker roles</h2>

      <div className="card">
        <h3>Add a competitor</h3>
        <p className="hint">
          Adding a competitor auto-creates a default tracker role. Tune it below — that
          form <b>is</b> the agent-role definition (which specialists run, how deep, spend
          guardrail, escalation threshold).
        </p>
        <div className="row">
          <input placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="domain.com (optional)" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={async () => {
              await add({ name: name.trim(), domain: domain.trim() || undefined });
              setName("");
              setDomain("");
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {competitors?.map((c) => (
        <TrackerCard key={c._id} competitorId={c._id} name={c.name} />
      ))}
    </div>
  );
}

function TrackerCard({ competitorId, name }: { competitorId: Id<"competitors">; name: string }) {
  const tracker = useQuery(api.trackers.forCompetitor, { competitorId });
  const upsert = useMutation(api.trackers.upsert);
  const enqueue = useMutation(api.runQueue.enqueue);

  if (tracker === undefined) return null;
  const channels = tracker?.channels ?? [...CHANNELS];
  const depth = tracker?.depth ?? "standard";
  const spendCap = tracker?.spendCapUsd ?? 0.5;
  const escalateAt = tracker?.escalateAtSeverity ?? "high";
  const voice = tracker?.voiceBrief ?? true;
  const cadence = tracker?.cadenceCron ?? "0 * * * *";

  const save = (patch: Record<string, unknown>) =>
    upsert({
      competitorId,
      channels,
      depth,
      spendCapUsd: spendCap,
      escalateAtSeverity: escalateAt,
      voiceBrief: voice,
      cadenceCron: cadence,
      active: true,
      ...patch,
    });

  const toggleChannel = (ch: string) => {
    const next = channels.includes(ch as any)
      ? channels.filter((x) => x !== ch)
      : [...channels, ch];
    save({ channels: next });
  };

  return (
    <div className="card">
      <div className="row-between">
        <h3>{name}</h3>
        <button className="chip" onClick={() => enqueue({ competitorId, trigger: "dashboard" })}>
          ▶ Track now
        </button>
      </div>

      <label className="field-label">Specialists (tools this role uses)</label>
      <div className="chips">
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            className={channels.includes(ch) ? "chip on" : "chip"}
            onClick={() => toggleChannel(ch)}
          >
            {channels.includes(ch) ? "✓ " : ""}
            {ch}
          </button>
        ))}
      </div>

      <div className="row wrap">
        <div className="field">
          <label className="field-label">Search depth</label>
          <select value={depth} onChange={(e) => save({ depth: e.target.value })}>
            <option value="fast">fast</option>
            <option value="standard">standard</option>
            <option value="deep">deep</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Spend cap / run (guardrail)</label>
          <input
            type="number"
            step="0.1"
            defaultValue={spendCap}
            onBlur={(e) => save({ spendCapUsd: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label className="field-label">Escalate at (guardrail)</label>
          <select value={escalateAt} onChange={(e) => save({ escalateAtSeverity: e.target.value })}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Cadence (cron)</label>
          <input
            defaultValue={cadence}
            onBlur={(e) => save({ cadenceCron: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label">Voice brief</label>
          <button className={voice ? "chip on" : "chip"} onClick={() => save({ voiceBrief: !voice })}>
            {voice ? "✓ on" : "off"}
          </button>
        </div>
      </div>
    </div>
  );
}
