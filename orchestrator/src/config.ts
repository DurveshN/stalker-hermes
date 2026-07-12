import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  version: "v1", // bump on prompt/agent changes → eval trend tracking

  anthropicApiKey: req("ANTHROPIC_API_KEY"),
  linkupApiKey: req("LINKUP_API_KEY"),
  convexUrl: req("CONVEX_URL"),

  // Models: manager reasons + synthesizes; specialists are fast + cheap.
  managerModel: opt("MANAGER_MODEL", "claude-sonnet-5"),
  specialistModel: opt("SPECIALIST_MODEL", "claude-haiku-4-5-20251001"),

  postgres: {
    host: opt("PGHOST"),
    port: Number(opt("PGPORT", "5432")),
    database: opt("PGDATABASE", "stalker"),
    user: opt("PGUSER"),
    password: opt("PGPASSWORD"),
    ssl: opt("PGSSLMODE", "require") !== "disable",
    enabled: !!process.env.PGHOST,
  },

  telegram: {
    botToken: opt("TELEGRAM_BOT_TOKEN"),
    chatId: opt("TELEGRAM_CHAT_ID"),
    enabled: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
  },

  elevenlabs: {
    apiKey: opt("ELEVENLABS_API_KEY"),
    voiceId: opt("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
    enabled: !!process.env.ELEVENLABS_API_KEY,
  },

  runQueuePollMs: Number(opt("RUNQUEUE_POLL_MS", "4000")),
  runCostCapUsd: Number(opt("RUN_COST_CAP_USD", "0.50")),
  maxParallelSpecialists: Number(opt("MAX_PARALLEL_SPECIALISTS", "5")),

  workerId: `orch-${process.pid}-${Math.random().toString(36).slice(2, 7)}`,
};

// [Unverified] Public per-1M-token USD pricing for the Claude 5 family was not
// confirmed at build time. These are editable placeholders — override via env
// (e.g. PRICE_IN_claude-sonnet-5). Cost *accounting* is structurally correct;
// only the rate constants need real values. AI pricing may vary.
type Rate = { in: number; out: number };
const DEFAULT_RATES: Record<string, Rate> = {
  "claude-sonnet-5": { in: 3.0, out: 15.0 },
  "claude-haiku-4-5-20251001": { in: 0.8, out: 4.0 },
  "claude-opus-4-8": { in: 15.0, out: 75.0 },
};

export function priceFor(model: string): Rate {
  const inEnv = process.env[`PRICE_IN_${model}`];
  const outEnv = process.env[`PRICE_OUT_${model}`];
  const base = DEFAULT_RATES[model] ?? { in: 3.0, out: 15.0 };
  return {
    in: inEnv ? Number(inEnv) : base.in,
    out: outEnv ? Number(outEnv) : base.out,
  };
}

// USD cost from token counts (rates are per 1M tokens).
export function costUsd(model: string, tokensIn: number, tokensOut: number): number {
  const r = priceFor(model);
  return (tokensIn / 1_000_000) * r.in + (tokensOut / 1_000_000) * r.out;
}
