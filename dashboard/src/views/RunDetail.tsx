import { useState } from "react";
import { useQuery } from "convex/react";
import { api, type Id, type Doc } from "../api.js";
import { usd, ms, tokens, STATUS_COLOR } from "../format.js";

type Trace = Doc<"traces">;

interface Node extends Trace {
  children: Node[];
}

function buildTree(traces: Trace[]): Node[] {
  const bySeq = new Map<number, Node>();
  const roots: Node[] = [];
  const sorted = [...traces].sort((a, b) => a.seq - b.seq);
  for (const t of sorted) bySeq.set(t.seq, { ...t, children: [] });
  for (const t of sorted) {
    const node = bySeq.get(t.seq)!;
    if (t.parentSeq != null && bySeq.has(t.parentSeq)) bySeq.get(t.parentSeq)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function TraceRow({ node, depth }: { node: Node; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasDetail = node.input || node.output || node.error;
  return (
    <>
      <div className="trace-row" style={{ paddingLeft: depth * 18 + 8 }}>
        <button className="tw" onClick={() => setOpen((o) => !o)} disabled={!hasDetail}>
          {hasDetail ? (open ? "▾" : "▸") : "·"}
        </button>
        <span className="dot" style={{ background: STATUS_COLOR[node.status] ?? "#888" }} />
        <span className={`agent agent-${node.agent}`}>{node.agent}</span>
        <span className="ttype">{node.type}</span>
        <span className="tlabel">{node.label}</span>
        <span className="tmetrics">
          {node.model ? <em>{node.model}</em> : null}
          {node.tokensIn + node.tokensOut > 0 && (
            <span> {tokens(node.tokensIn + node.tokensOut)} tok</span>
          )}
          {node.costUsd > 0 && <span> · {usd(node.costUsd)}</span>}
          {node.latencyMs > 0 && <span> · {ms(node.latencyMs)}</span>}
        </span>
      </div>
      {open && hasDetail && (
        <pre className="trace-detail" style={{ marginLeft: depth * 18 + 32 }}>
          {node.error ? `ERROR: ${node.error}\n` : ""}
          {node.input ? `IN: ${node.input}\n` : ""}
          {node.output ? `OUT: ${node.output}` : ""}
        </pre>
      )}
      {node.children.map((c) => (
        <TraceRow key={c._id} node={c} depth={depth + 1} />
      ))}
    </>
  );
}

export function RunDetail({ runId, onBack }: { runId: Id<"runs">; onBack: () => void }) {
  const run = useQuery(api.runs.get, { id: runId });
  const traces = useQuery(api.traces.forRun, { runId });
  const rollup = useQuery(api.traces.rollupByAgent, { runId });
  const findings = useQuery(api.findings.forRun, { runId });

  if (!run) return <div className="empty">Loading run…</div>;
  const tree = traces ? buildTree(traces) : [];

  return (
    <div>
      <button className="link" onClick={onBack}>
        ← back to runs
      </button>
      <h2>
        {run.competitorName}{" "}
        <span className="dot" style={{ background: STATUS_COLOR[run.status] }} /> {run.status}
      </h2>
      <div className="stats">
        <Stat label="New findings" value={String(run.newFindingsCount)} />
        <Stat label="Escalations" value={String(run.escalations)} />
        <Stat label="Tokens" value={tokens(run.totalTokensIn + run.totalTokensOut)} />
        <Stat label="Cost" value={usd(run.totalCostUsd)} />
        <Stat label="Latency" value={ms(run.latencyMs)} />
        <Stat label="Version" value={run.version} />
      </div>

      {run.summary && (
        <div className="brief">
          <h3>Brief</h3>
          <p>{run.summary}</p>
        </div>
      )}

      <div className="two-col">
        <div>
          <h3>Trace tree ({traces?.length ?? 0} steps)</h3>
          <div className="trace-tree">
            {tree.map((n) => (
              <TraceRow key={n._id} node={n} depth={0} />
            ))}
          </div>
        </div>
        <div>
          <h3>Cost by agent</h3>
          <table className="grid small">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Steps</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Err</th>
              </tr>
            </thead>
            <tbody>
              {rollup &&
                Object.entries(rollup)
                  .sort((a, b) => b[1].costUsd - a[1].costUsd)
                  .map(([agent, r]) => (
                    <tr key={agent}>
                      <td className={`agent agent-${agent}`}>{agent}</td>
                      <td>{r.steps}</td>
                      <td>{tokens(r.tokensIn + r.tokensOut)}</td>
                      <td>{usd(r.costUsd)}</td>
                      <td>{r.errors || ""}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <h3>Findings ({findings?.length ?? 0})</h3>
      <table className="grid">
        <thead>
          <tr>
            <th>Channel</th>
            <th>Category</th>
            <th>Sev</th>
            <th>Title</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {findings?.map((f) => (
            <tr key={f._id}>
              <td>{f.channel}</td>
              <td>{f.category}</td>
              <td>{f.severity}</td>
              <td>{f.title}</td>
              <td>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer">
                    link
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-val">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
