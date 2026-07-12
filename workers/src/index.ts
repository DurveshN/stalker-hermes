import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex-backend/convex/_generated/api.js";

interface Env {
  CONVEX_URL: string;
  DODO_WEBHOOK_SECRET: string;
  ALLOW_ORIGIN: string;
}

function cors(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
const json = (data: unknown, env: Env, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });

// HMAC-SHA256 hex over the raw body. [Unverified] Dodo's exact signature
// scheme — adjust header name / encoding to match Dodo's docs if needed.
async function verifyHmac(secret: string, body: string, sig: string | null): Promise<boolean> {
  if (!secret) return true; // no secret configured → skip (dev)
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const provided = sig.replace(/^sha256=/, "").trim();
  return hex === provided;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(env) });

    const convex = new ConvexHttpClient(env.CONVEX_URL);

    if (url.pathname === "/health") return json({ ok: true }, env);

    // On-demand trigger — landing page / external callers enqueue a run.
    if (url.pathname === "/track" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as {
        competitorId?: string;
        focus?: string;
      };
      const id = await convex.mutation(api.runQueue.enqueue, {
        competitorId: body.competitorId as any,
        trigger: "worker",
        requestedBy: "cf-worker",
        focus: body.focus,
      });
      return json({ enqueued: id }, env);
    }

    // Signup capture from the landing page (Convex-backed).
    if (url.pathname === "/signup" && req.method === "POST") {
      const b = (await req.json().catch(() => ({}))) as {
        email?: string;
        company?: string;
        source?: string;
      };
      if (!b.email) return json({ error: "email required" }, env, 400);
      const id = await convex.mutation(api.signups.create, {
        email: b.email,
        company: b.company,
        source: b.source ?? "landing",
      });
      return json({ ok: true, id }, env);
    }

    // Dodo Payments webhook — promote signup to Pro after live checkout.
    if (url.pathname === "/webhooks/dodo" && req.method === "POST") {
      const raw = await req.text();
      const sig =
        req.headers.get("webhook-signature") ??
        req.headers.get("x-dodo-signature") ??
        req.headers.get("dodo-signature");
      if (!(await verifyHmac(env.DODO_WEBHOOK_SECRET, raw, sig))) {
        return json({ error: "bad signature" }, env, 401);
      }
      const evt = JSON.parse(raw) as any;
      const type = evt.type ?? evt.event_type ?? "";
      const data = evt.data ?? evt;
      const email =
        data.customer?.email ?? data.customer_email ?? data.email ?? data.metadata?.email;
      if (email && /payment|subscription|checkout/i.test(type) && /succeed|active|complete/i.test(JSON.stringify(evt))) {
        await convex.mutation(api.signups.upgradeToPro, {
          email,
          dodoCustomerId: data.customer?.customer_id ?? data.customer_id,
          dodoSubscriptionId: data.subscription_id ?? data.subscription?.subscription_id,
        });
      }
      return json({ received: true }, env);
    }

    return json({ error: "not found" }, env, 404);
  },

  // CF cron backup hourly trigger.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const convex = new ConvexHttpClient(env.CONVEX_URL);
    ctx.waitUntil(
      convex.mutation(api.runQueue.enqueue, {
        trigger: "cron",
        requestedBy: "cf-cron",
      }) as unknown as Promise<unknown>,
    );
  },
};
