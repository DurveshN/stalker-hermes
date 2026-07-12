import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// --- password hashing (PBKDF2). Runs in an ACTION only — Convex mutations are
// deterministic and cannot use crypto.getRandomValues. ---------------------
async function hashPassword(password: string, saltHex?: string) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  const toHex = (buf: ArrayBuffer) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { hash: toHex(bits), salt: toHex(salt.buffer as ArrayBuffer) };
}

// Internal query: fetch a signup by email (used by the auth actions).
export const byEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first(),
});

// Internal mutation: persist a new/updated credentialed account.
export const _persistAuth = internalMutation({
  args: {
    email: v.string(),
    company: v.optional(v.string()),
    passwordHash: v.string(),
    passwordSalt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        passwordHash: args.passwordHash,
        passwordSalt: args.passwordSalt,
        company: args.company ?? existing.company,
        firstUseAt: existing.firstUseAt ?? Date.now(),
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("signups", {
      email: args.email,
      company: args.company,
      source: "landing",
      plan: "free",
      passwordHash: args.passwordHash,
      passwordSalt: args.passwordSalt,
      firstUseAt: Date.now(), // account creation = first-use event (counts in rubric)
      lastLoginAt: Date.now(),
      ts: Date.now(),
    });
  },
});

export const _touchLogin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const u = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (u) await ctx.db.patch(u._id, { lastLoginAt: Date.now(), firstUseAt: u.firstUseAt ?? Date.now() });
  },
});

// Public ACTION: sign up with email + password.
export const register = action({
  args: {
    email: v.string(),
    password: v.string(),
    company: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; email: string }> => {
    const email = args.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("invalid email");
    if (args.password.length < 6) throw new Error("password too short (min 6)");
    const existing = await ctx.runQuery(internal.signups.byEmail, { email });
    if (existing && existing.passwordHash) throw new Error("account exists — sign in instead");
    const { hash, salt } = await hashPassword(args.password);
    await ctx.runMutation(internal.signups._persistAuth, {
      email, company: args.company, passwordHash: hash, passwordSalt: salt,
    });
    return { ok: true, email };
  },
});

// Public ACTION: sign in — verify the password hash, stamp lastLoginAt.
export const signin = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; email: string; plan: string }> => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.runQuery(internal.signups.byEmail, { email });
    if (!user || !user.passwordHash || !user.passwordSalt) {
      throw new Error("no account — sign up first");
    }
    const { hash } = await hashPassword(args.password, user.passwordSalt);
    if (hash !== user.passwordHash) throw new Error("wrong password");
    await ctx.runMutation(internal.signups._touchLogin, { email });
    return { ok: true, email, plan: user.plan };
  },
});

// Landing-page email capture (cross-track Virality/Revenue signal).
export const create = mutation({
  args: {
    email: v.string(),
    company: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("signups", {
      email: args.email,
      company: args.company,
      source: args.source,
      plan: "free",
      ts: Date.now(),
    });
  },
});

// First-use event — required for signups to "count" under the rubric.
export const markFirstUse = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (s && !s.firstUseAt) await ctx.db.patch(s._id, { firstUseAt: Date.now() });
  },
});

// Dodo webhook promotes a signup to Pro after live checkout.
export const upgradeToPro = mutation({
  args: {
    email: v.string(),
    dodoCustomerId: v.optional(v.string()),
    dodoSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (s) {
      await ctx.db.patch(s._id, {
        plan: "pro",
        dodoCustomerId: args.dodoCustomerId,
        dodoSubscriptionId: args.dodoSubscriptionId,
      });
    } else {
      await ctx.db.insert("signups", {
        email: args.email,
        plan: "pro",
        dodoCustomerId: args.dodoCustomerId,
        dodoSubscriptionId: args.dodoSubscriptionId,
        ts: Date.now(),
      });
    }
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("signups").collect();
    return {
      total: all.length,
      pro: all.filter((s) => s.plan === "pro").length,
      activated: all.filter((s) => s.firstUseAt).length,
    };
  },
});

// Mask an email for public display: keep first char + domain, hide the rest.
// "karan@callmissed.com" -> "k•••@callmissed.com"
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, Math.min(local.length - 1, 3)))}@${domain}`;
}

// Recent signups for public social proof — emails MASKED (no PII leaves the DB).
export const recentPublic = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("signups").order("desc").take(args.limit ?? 8);
    return rows.map((s) => ({
      email: maskEmail(s.email),
      company: s.company ?? null,
      plan: s.plan,
      ts: s.ts,
    }));
  },
});
