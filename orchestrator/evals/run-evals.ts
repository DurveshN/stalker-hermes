import { convex, api } from "../src/convexClient.js";
import { config } from "../src/config.js";
import { initSchema } from "../src/db/postgres.js";
import { runCrew } from "../src/runCrew.js";
import { SEED_CASES, type EvalCase } from "./dataset.js";
import { scoreCase, type CaseScore } from "./scorers.js";
import type { Id } from "../../convex-backend/convex/_generated/dataModel.js";

// CI-style eval pipeline. Runs the named set through the live crew, scores
// deterministically, records the result to Convex (version-tagged), and FAILS
// the release (exit 1) if the pass rate regresses vs the previous eval run.
//   npm run evals            # run + gate
//   npm run evals -- --no-gate

async function ensureCompetitor(name: string): Promise<Id<"competitors">> {
  const all = await convex.query(api.competitors.list, {});
  const m = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (m) return m._id;
  return await convex.mutation(api.competitors.add, { name });
}

async function loadAllCases(): Promise<EvalCase[]> {
  // Seed cases + regression cases captured from human feedback (closed loop).
  const regression = await convex.query(api.evals.activeCases, {});
  const regCases: EvalCase[] = regression
    .filter((c) => c.source === "regression")
    .map((c) => ({
      name: c.name,
      competitorName: c.competitorName,
      focus: c.focus,
      minFindings: c.minFindings,
      requireSourceUrls: c.requireSourceUrls,
      expectCategories: c.expectCategories,
    }));
  // Dedup by name (seed wins).
  const byName = new Map<string, EvalCase>();
  for (const c of [...SEED_CASES, ...regCases]) byName.set(c.name, c);
  return [...byName.values()];
}

async function main() {
  const gate = !process.argv.includes("--no-gate");
  await initSchema();
  const cases = await loadAllCases();
  console.log(`Running ${cases.length} eval cases @ version=${config.version}`);

  const scores: CaseScore[] = [];
  for (const c of cases) {
    console.log(`\n▶ ${c.name} (${c.competitorName})`);
    try {
      const competitorId = await ensureCompetitor(c.competitorName);
      const outcome = await runCrew({ competitorId, trigger: "manual", focus: c.focus });
      const findings = await convex.query(api.findings.forRun, { runId: outcome.runId });
      const score = await scoreCase(
        c,
        findings.map((f) => ({ title: f.title, url: f.url, category: f.category, severity: f.severity })),
      );
      scores.push(score);
      console.log(`  ${score.passed ? "✅ PASS" : "❌ FAIL"} — ${score.detail}`);
    } catch (e) {
      scores.push({
        name: c.name,
        passed: false,
        checks: { ran: false },
        detail: `error: ${e instanceof Error ? e.message : String(e)}`,
      });
      console.log(`  ❌ FAIL — crashed`);
    }
  }

  const passed = scores.filter((s) => s.passed).length;
  const total = scores.length;
  const passRate = total ? passed / total : 0;
  console.log(`\n=== ${passed}/${total} passed (${(passRate * 100).toFixed(0)}%) ===`);

  // Compare to previous recorded eval run BEFORE recording this one.
  const trend = await convex.query(api.evals.trend, {});
  const prev = trend.length ? trend[trend.length - 1] : null;

  await convex.mutation(api.evals.recordRun, {
    version: config.version,
    passed,
    total,
    details: JSON.stringify(scores),
  });

  if (gate && prev && passRate < prev.passRate) {
    console.error(
      `\n🚫 REGRESSION: pass rate ${(passRate * 100).toFixed(0)}% < previous ${(prev.passRate * 100).toFixed(0)}% (v=${prev.version}). Failing release.`,
    );
    process.exit(1);
  }
  console.log("\n✅ Eval gate passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
