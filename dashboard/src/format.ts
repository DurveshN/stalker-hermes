export const usd = (n: number) => `$${n.toFixed(4)}`;
export const ms = (n?: number) => (n == null ? "—" : n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`);
export const when = (t: number) => new Date(t).toLocaleString();
export const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

export const SEV_COLOR: Record<string, string> = {
  info: "#6b7280",
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#b91c1c",
};

export const STATUS_COLOR: Record<string, string> = {
  succeeded: "#16a34a",
  running: "#f59e0b",
  partial: "#f59e0b",
  failed: "#dc2626",
  ok: "#16a34a",
  error: "#dc2626",
  queued: "#6b7280",
};
