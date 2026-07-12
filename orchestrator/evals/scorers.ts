import type { EvalCase } from "./dataset.js";

export interface ScoredFinding {
  title: string;
  url?: string;
  category: string;
  severity: string;
}

export interface CaseScore {
  name: string;
  passed: boolean;
  checks: Record<string, boolean>;
  detail: string;
}

// Deterministic scorers — the crew output must satisfy the case's assertions.
// URL-validity is a real check (dead/invalid links fail) so hallucinated
// sources are caught, not rewarded.
export async function scoreCase(
  c: EvalCase,
  findings: ScoredFinding[],
): Promise<CaseScore> {
  const checks: Record<string, boolean> = {};

  checks.minFindings = findings.length >= c.minFindings;

  if (c.requireSourceUrls) {
    checks.allHaveUrls = findings.length > 0 && findings.every((f) => !!f.url);
    checks.urlsWellFormed = findings.every(
      (f) => !f.url || /^https?:\/\/.+\..+/.test(f.url),
    );
    checks.urlsResolve = await urlsResolve(findings.map((f) => f.url).filter(Boolean) as string[]);
  }

  checks.categoryMatch =
    c.expectCategories.length === 0 ||
    findings.some((f) => c.expectCategories.includes(f.category));

  // No duplicate titles (dedup quality).
  const titles = findings.map((f) => f.title.toLowerCase().trim());
  checks.noDupes = new Set(titles).size === titles.length;

  const passed = Object.values(checks).every(Boolean);
  return {
    name: c.name,
    passed,
    checks,
    detail: `${findings.length} findings; checks=${JSON.stringify(checks)}`,
  };
}

// HEAD-check a sample of URLs (cap network cost); a URL that 4xx/5xx or errors
// fails validity. Redirects (3xx) and 405-on-HEAD are tolerated.
async function urlsResolve(urls: string[]): Promise<boolean> {
  const sample = urls.slice(0, 5);
  const results = await Promise.all(
    sample.map(async (u) => {
      try {
        const res = await fetch(u, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
        return res.status < 400 || res.status === 405;
      } catch {
        return false;
      }
    }),
  );
  return results.length === 0 || results.every(Boolean);
}
