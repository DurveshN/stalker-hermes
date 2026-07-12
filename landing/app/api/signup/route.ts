import { NextRequest, NextResponse } from "next/server";

// Signup capture. Forwards to the Cloudflare Worker (which writes to Convex)
// when configured; otherwise accepts and logs so the form works in dev.
export async function POST(req: NextRequest) {
  let body: { email?: string; company?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const workerUrl = process.env.WORKER_URL;
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company: body.company, source: "landing" }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("worker signup failed", e);
      return NextResponse.json({ error: "could not save signup" }, { status: 502 });
    }
  } else {
    console.log("[signup] (no WORKER_URL set)", email, body.company ?? "");
  }

  return NextResponse.json({ ok: true });
}
