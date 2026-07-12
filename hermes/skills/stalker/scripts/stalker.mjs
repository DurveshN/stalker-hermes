#!/usr/bin/env node
// Stalker skill helper. Talks to Convex over HTTP using anyApi (no generated
// types required on the VM). Run from the Hermes skill dir.
//   node stalker.mjs <track|sweep|add|latest|list> [args...]
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("CONVEX_URL not set. Export it or add to ~/.hermes/.env.");
  process.exit(1);
}
const convex = new ConvexHttpClient(CONVEX_URL);
const [cmd, a, b] = process.argv.slice(2);

async function findCompetitor(name) {
  const all = await convex.query(anyApi.competitors.list, {});
  return all.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
}

async function main() {
  switch (cmd) {
    case "list": {
      const all = await convex.query(anyApi.competitors.list, {});
      console.log(JSON.stringify(all.map((c) => ({ name: c.name, active: c.active })), null, 2));
      break;
    }
    case "add": {
      if (!a) throw new Error('usage: add "<name>" ["domain"]');
      const id = await convex.mutation(anyApi.competitors.add, { name: a, domain: b });
      console.log(JSON.stringify({ added: a, id }));
      break;
    }
    case "track": {
      if (!a) throw new Error('usage: track "<name>" ["focus"]');
      let c = await findCompetitor(a);
      let competitorId = c?._id;
      if (!competitorId) {
        competitorId = await convex.mutation(anyApi.competitors.add, { name: a });
      }
      const jobId = await convex.mutation(anyApi.runQueue.enqueue, {
        competitorId,
        trigger: "telegram",
        requestedBy: "hermes",
        focus: b,
      });
      console.log(JSON.stringify({ queued: a, focus: b ?? null, jobId }));
      break;
    }
    case "sweep": {
      const jobId = await convex.mutation(anyApi.runQueue.enqueue, {
        trigger: "telegram",
        requestedBy: "hermes",
      });
      console.log(JSON.stringify({ queued: "all active competitors", jobId }));
      break;
    }
    case "latest": {
      if (!a) throw new Error('usage: latest "<name>"');
      const c = await findCompetitor(a);
      if (!c) {
        console.log(JSON.stringify({ error: `not tracking "${a}"` }));
        break;
      }
      const findings = await convex.query(anyApi.findings.forCompetitor, {
        competitorId: c._id,
        limit: 10,
      });
      console.log(
        JSON.stringify(
          findings.map((f) => ({
            severity: f.severity,
            category: f.category,
            title: f.title,
            url: f.url,
            summary: f.summary,
          })),
          null,
          2,
        ),
      );
      break;
    }
    default:
      console.error("commands: track | sweep | add | latest | list");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message ?? String(e));
  process.exit(1);
});
