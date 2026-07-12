import pg from "pg";
import { config } from "../config.js";

// Postgres = durable analytical warehouse. Convex holds hot reactive state;
// here we keep the append-only history: raw Linkup payloads (JSONB), the full
// findings ledger, and SEO/website snapshots for time-series trend analysis.

let pool: pg.Pool | null = null;

export function pgEnabled(): boolean {
  return config.postgres.enabled;
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined,
      max: 4,
    });
  }
  return pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS raw_searches (
  id            BIGSERIAL PRIMARY KEY,
  run_id        TEXT NOT NULL,
  competitor    TEXT NOT NULL,
  channel       TEXT NOT NULL,
  depth         TEXT NOT NULL,
  query         TEXT NOT NULL,
  response      JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_raw_searches_competitor ON raw_searches (competitor, created_at DESC);

CREATE TABLE IF NOT EXISTS findings_history (
  id            BIGSERIAL PRIMARY KEY,
  run_id        TEXT NOT NULL,
  competitor    TEXT NOT NULL,
  channel       TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  summary       TEXT NOT NULL,
  category      TEXT NOT NULL,
  severity      TEXT NOT NULL,
  relevance     REAL NOT NULL,
  dedup_hash    TEXT NOT NULL,
  published_at  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_dedup ON findings_history (dedup_hash);
CREATE INDEX IF NOT EXISTS idx_findings_competitor ON findings_history (competitor, created_at DESC);

CREATE TABLE IF NOT EXISTS seo_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  competitor    TEXT NOT NULL,
  domain        TEXT,
  snapshot      JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_competitor ON seo_snapshots (competitor, created_at DESC);

CREATE TABLE IF NOT EXISTS run_costs (
  id            BIGSERIAL PRIMARY KEY,
  run_id        TEXT NOT NULL,
  competitor    TEXT NOT NULL,
  tokens_in     INTEGER NOT NULL,
  tokens_out    INTEGER NOT NULL,
  cost_usd      REAL NOT NULL,
  latency_ms    INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initSchema(): Promise<void> {
  if (!pgEnabled()) return;
  await getPool().query(SCHEMA);
}

export async function saveRawSearch(row: {
  runId: string;
  competitor: string;
  channel: string;
  depth: string;
  query: string;
  response: unknown;
}): Promise<void> {
  if (!pgEnabled()) return;
  await getPool().query(
    `INSERT INTO raw_searches (run_id, competitor, channel, depth, query, response)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [row.runId, row.competitor, row.channel, row.depth, row.query, JSON.stringify(row.response)],
  );
}

export async function saveFindingHistory(row: {
  runId: string;
  competitor: string;
  channel: string;
  title: string;
  url?: string;
  summary: string;
  category: string;
  severity: string;
  relevance: number;
  dedupHash: string;
  publishedAt?: string;
}): Promise<void> {
  if (!pgEnabled()) return;
  await getPool().query(
    `INSERT INTO findings_history
       (run_id, competitor, channel, title, url, summary, category, severity, relevance, dedup_hash, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (dedup_hash) DO NOTHING`,
    [
      row.runId, row.competitor, row.channel, row.title, row.url ?? null,
      row.summary, row.category, row.severity, row.relevance, row.dedupHash,
      row.publishedAt ?? null,
    ],
  );
}

export async function saveSeoSnapshot(row: {
  competitor: string;
  domain?: string;
  snapshot: unknown;
}): Promise<void> {
  if (!pgEnabled()) return;
  await getPool().query(
    `INSERT INTO seo_snapshots (competitor, domain, snapshot) VALUES ($1,$2,$3)`,
    [row.competitor, row.domain ?? null, JSON.stringify(row.snapshot)],
  );
}

export async function saveRunCost(row: {
  runId: string;
  competitor: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
}): Promise<void> {
  if (!pgEnabled()) return;
  await getPool().query(
    `INSERT INTO run_costs (run_id, competitor, tokens_in, tokens_out, cost_usd, latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [row.runId, row.competitor, row.tokensIn, row.tokensOut, row.costUsd, row.latencyMs],
  );
}

// Prior finding hashes for a competitor — feeds cross-run dedup + memory layer 2.
export async function priorHashes(competitor: string, limit = 500): Promise<Set<string>> {
  if (!pgEnabled()) return new Set();
  const res = await getPool().query(
    `SELECT dedup_hash FROM findings_history WHERE competitor = $1 ORDER BY created_at DESC LIMIT $2`,
    [competitor, limit],
  );
  return new Set(res.rows.map((r) => r.dedup_hash as string));
}
