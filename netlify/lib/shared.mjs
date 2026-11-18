// Shared helpers for the dashboard's server functions (netlify/functions/*).
//
// Storage is Netlify Blobs: it comes free with every Netlify site, so there's no
// database to set up. Everything lives in one store called "affiliates":
//   affiliates/<code>.json      one affiliate: name, email, rate, secret token, payouts
//   tokens/<token>              which affiliate a private stats link belongs to
//   emails/<hash>               which affiliate an email address belongs to (stops double sign-ups)
//   clicks/<code>/<time>-<rnd>  one empty file per click on someone's link (we just count them)
//   sales/<stripe session>.json one Stripe sale credited to an affiliate
//   payments/<payment intent>   which sale a Stripe payment belongs to (so refunds find it)
//
// We never store who BOUGHT: a sale is just an amount, a date and the Stripe
// session id (look the buyer up in Stripe if you need them).

import { getStore } from "@netlify/blobs";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import config from "../../public/affiliates.config.json" with { type: "json" };

export { config as settings };

// "strong" = a new sale or click shows the moment it's saved, not up to 60s later.
export const store = () => getStore({ name: "affiliates", consistency: "strong" });

/** Read a setting from Netlify's environment variables (or .env when testing locally). */
export function env(name) {
  const fromNetlify = globalThis.Netlify?.env?.get?.(name);
  return String(fromNetlify ?? process.env[name] ?? "").trim();
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Does the key the page sent match ADMIN_KEY? */
export function isAdmin(req) {
  const given = req.headers.get("x-admin-key") ?? "";
  const expected = env("ADMIN_KEY");
  // A missing or too-short key in the environment locks the admin page, on purpose.
  if (expected.length < 8 || !given) return false;
  // Compare hashes so the check takes the same time whether it's close or not.
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** The site's own address, for building links in emails and on screen. */
export function siteUrl(req) {
  return (env("SITE_URL") || new URL(req.url).origin).replace(/\/$/, "");
}

// ---- affiliate codes ---------------------------------------------------------

// An affiliate's code is the bit at the end of their link: /go/sarah.
// Lowercase letters, numbers and hyphens, 2–40 long, no hyphen at either end.
// (The ticketing kit accepts any code matching ^[a-z0-9-]{1,40}$, so every code
// we allow here also works there.)
export const CODE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])$/;
export const TOKEN_RE = /^[a-f0-9]{48}$/;

export function cleanCode(value) {
  const code = String(value ?? "").trim().toLowerCase();
  return CODE_RE.test(code) ? code : null;
}

/** Turn "Sarah Jones" into "sarah-jones". */
export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

const emailKey = (email) =>
  `emails/${createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex")}`;

// ---- affiliates --------------------------------------------------------------

export async function getAffiliate(code) {
  if (!cleanCode(code)) return null;
  return store().get(`affiliates/${code}.json`, { type: "json" });
}

export async function saveAffiliate(affiliate) {
  await store().setJSON(`affiliates/${affiliate.code}.json`, affiliate);
}

export async function listAffiliates() {
  const { blobs } = await store().list({ prefix: "affiliates/" });
  const all = await inBatches(blobs, (b) => store().get(b.key, { type: "json" }));
  return all.filter(Boolean);
}

export async function findByToken(token) {
  if (!TOKEN_RE.test(token ?? "")) return null;
  const code = await store().get(`tokens/${token}`);
  return code ? getAffiliate(code) : null;
}

export async function findByEmail(email) {
  const code = await store().get(emailKey(email));
  return code ? getAffiliate(code) : null;
}

/**
 * Make a new affiliate. Returns { error } if the code or email is already used.
 * The secret token is what makes their stats link private: 48 random characters,
 * so nobody can guess someone else's.
 */
export async function createAffiliate({ name, email, code, commissionPct, socials = "" }) {
  if (await getAffiliate(code)) return { error: "code-taken" };
  if (await findByEmail(email)) return { error: "email-taken" };
  const affiliate = {
    code,
    name: String(name).trim(),
    email: String(email).trim(),
    socials: String(socials ?? "").trim(),
    commissionPct: Number(commissionPct),
    token: randomBytes(24).toString("hex"),
    createdAt: new Date().toISOString(),
    payouts: [],
  };
  await saveAffiliate(affiliate);
  await store().set(`tokens/${affiliate.token}`, code);
  await store().set(emailKey(email), code);
  return { affiliate };
}

/** Remove an affiliate. Their past sales stay in storage (for your records) but stop showing. */
export async function deleteAffiliate(affiliate) {
  await Promise.all([
    store().delete(`affiliates/${affiliate.code}.json`),
    store().delete(`tokens/${affiliate.token}`),
    store().delete(emailKey(affiliate.email)),
  ]);
}

// ---- clicks + sales ----------------------------------------------------------

export async function recordClick(code) {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  await store().set(`clicks/${code}/${stamp}-${randomBytes(4).toString("hex")}`, "");
}

/** Click count per affiliate code: { sarah: 12, ... } */
export async function clickCounts(code) {
  const { blobs } = await store().list({ prefix: code ? `clicks/${code}/` : "clicks/" });
  const counts = {};
  for (const { key } of blobs) {
    const c = key.split("/")[1];
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

export async function listSales() {
  const { blobs } = await store().list({ prefix: "sales/" });
  const all = await inBatches(blobs, (b) => store().get(b.key, { type: "json" }));
  return all.filter(Boolean);
}

/**
 * The numbers for one affiliate. Commission is worked out per sale, at the rate
 * the affiliate had when that sale happened, on what the buyer actually paid
 * minus any refund. Fully refunded sales don't count as sales.
 */
export function summarise(affiliate, sales, clicks) {
  const mine = sales
    .filter((s) => s.code === affiliate.code)
    .map((s) => {
      const netCents = Math.max(0, s.amountCents - (s.refundedCents ?? 0));
      return { ...s, netCents, commissionCents: Math.round((netCents * s.commissionPct) / 100) };
    });
  const counted = mine.filter((s) => s.netCents > 0);
  const earnedCents = counted.reduce((sum, s) => sum + s.commissionCents, 0);
  const paidCents = (affiliate.payouts ?? []).reduce((sum, p) => sum + p.amountCents, 0);
  return {
    code: affiliate.code,
    name: affiliate.name,
    commissionPct: affiliate.commissionPct,
    clicks: clicks[affiliate.code] ?? 0,
    sales: counted.length,
    revenueCents: counted.reduce((sum, s) => sum + s.netCents, 0),
    earnedCents,
    paidCents,
    // Can dip below zero if a sale is refunded after you've paid it out: that
    // shows as a credit you can take off their next payout.
    owedCents: earnedCents - paidCents,
    lastPaidAt: (affiliate.payouts ?? []).at(-1)?.at ?? null,
    recentSales: mine
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 20)
      .map((s) => ({
        date: s.createdAt,
        amountCents: s.netCents,
        commissionCents: s.commissionCents,
        refunded: s.netCents === 0,
      })),
  };
}

// ---- Stripe ------------------------------------------------------------------

/**
 * Check a Stripe webhook really came from Stripe. Stripe signs every message
 * with your webhook's signing secret; we recompute the signature and compare.
 * Done by hand (it's 20 lines) so the dashboard never needs your Stripe secret
 * key: it can't charge, refund or read anything in your Stripe account.
 * https://docs.stripe.com/webhooks#verify-manually
 */
export function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!header || !secret) return false;
  let timestamp = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  // Reject old messages, so a captured one can't be replayed later.
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some(
    (sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)),
  );
}

// ---- email -------------------------------------------------------------------

export const emailOn = () => Boolean(env("RESEND_API_KEY") && env("EMAIL_FROM"));

/** Send the welcome email. Never throws: a failed email mustn't break a sign-up. */
export async function sendWelcome(affiliate, base) {
  if (!emailOn()) return { ok: false, error: "email isn't turned on" };
  const link = `${base}/go/${affiliate.code}`;
  const stats = `${base}/s/${affiliate.token}`;
  const first = affiliate.name.split(" ")[0] || "there";
  const accent = config.look?.colours?.accent ?? "#e4457a";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const captions = (config.shareKit?.captions ?? [])
    .map((c) => `<p style="margin:16px 0 4px;font-weight:bold">${esc(c.label)}</p>
      <p style="margin:0;padding:12px;background:#f6f3f4;border-radius:8px;white-space:pre-wrap">${esc(c.text.replaceAll("{link}", link))}</p>`)
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2b2230;line-height:1.5">
    <p>Hi ${esc(first)},</p>
    <p>${esc(config.email?.intro ?? "")}</p>
    <p>You earn <strong>${affiliate.commissionPct}%</strong> of every sale through your link.</p>
    <p style="margin:24px 0 4px;font-weight:bold">Your link (share this one)</p>
    <p style="margin:0"><a href="${link}" style="color:${accent}">${link}</a></p>
    <p style="margin:24px 0 4px;font-weight:bold">Your private stats page (bookmark it, don't share it)</p>
    <p style="margin:0"><a href="${stats}" style="color:${accent}">${stats}</a></p>
    ${captions ? `<p style="margin:24px 0 0">Some words to get you started, with your link already in them:</p>${captions}` : ""}
    <p style="margin-top:24px">${esc(config.words?.payoutTerms ?? "")}</p>
    <p>${esc(config.business?.name ?? "")}</p>
  </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env("EMAIL_FROM"),
        to: affiliate.email,
        subject: config.email?.subject ?? "Your affiliate link",
        html,
        reply_to: config.business?.contactEmail || undefined,
      }),
    });
    if (!res.ok) {
      console.error("[welcome email] Resend said no:", res.status, await res.text());
      return { ok: false, error: "the email service said no (check EMAIL_FROM uses your verified domain)" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[welcome email] failed:", err);
    return { ok: false, error: "couldn't reach the email service" };
  }
}

// ---- small helpers -----------------------------------------------------------

/** Run fn over items 20 at a time (fast, without flooding the storage service). */
export async function inBatches(items, fn, size = 20) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}
