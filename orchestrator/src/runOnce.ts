import { convex, api } from "./convexClient.js";
import { initSchema } from "./db/postgres.js";
import { runCrew } from "./runCrew.js";
import type { Id } from "../../convex-backend/convex/_generated/dataModel.js";

// One-shot CLI runner for local testing + eval harness.
//   npm run once -- <competitorName|competitorId> ["optional focus"]
async function main() {
  await initSchema();
  const arg = process.argv[2];
  const focus = process.argv[3];
  if (!arg) {
    console.error('usage: npm run once -- "<competitorName>" ["focus"]');
    process.exit(1);
  }

  const all = await convex.query(api.competitors.list, {});
  const match = all.find(
    (c: { _id: Id<"competitors">; name: string }) =>
      c._id === arg || c.name.toLowerCase() === arg.toLowerCase(),
  );
  const competitorId: Id<"competitors"> = match
    ? match._id
    : await convex.mutation(api.competitors.add, { name: arg });
  if (!match) console.log(`created competitor ${arg} = ${competitorId}`);

  const outcome = await runCrew({ competitorId, trigger: "manual", focus });
  console.log(JSON.stringify(outcome, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
