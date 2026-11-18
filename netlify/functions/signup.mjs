// /api/signup: the public "become an affiliate" form.
// Anyone can join (when signup.open is true) at the rate in signup.commissionPct.
// That's low risk: affiliates only ever earn on real, paid Stripe sales, and you
// pay commission yourself, so a junk sign-up costs you nothing.

import {
  cleanCode,
  settings,
  createAffiliate,
  emailOn,
  findByEmail,
  json,
  sendWelcome,
  siteUrl,
} from "../lib/shared.mjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!settings.signup?.open) return json({ error: settings.words?.closedMessage ?? "Sign-ups are closed." }, 403);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Something went wrong. Refresh and try again." }, 400);
  }

  // Honeypot: a hidden field real people never see. Bots fill it in. Pretend it
  // worked so they move on, and save nothing.
  if (String(body.website ?? "").trim()) return json({ ok: true });

  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().slice(0, 200);
  const socials = String(body.socials ?? "").trim().slice(0, 200);
  const code = cleanCode(body.code);

  if (!name) return json({ error: "Add your name." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "That email doesn't look right." }, 400);
  if (!code) return json({ error: "Your code can only use lowercase letters, numbers and hyphens (2 to 40 of them)." }, 400);
  if ((settings.signup.reservedCodes ?? []).includes(code)) return json({ error: "That code is reserved. Pick another." }, 409);

  const base = siteUrl(req);

  // Already signed up with this email? Don't show their links on screen (anyone
  // could type someone else's email). Email them instead, if email is on.
  const existing = await findByEmail(email);
  if (existing) {
    if (emailOn()) {
      await sendWelcome(existing, base);
      return json({ error: "You're already an affiliate! We've emailed your link and stats page again." }, 409);
    }
    return json({ error: `You're already an affiliate. Email ${settings.business?.contactEmail ?? "us"} and we'll resend your links.` }, 409);
  }

  try {
    const result = await createAffiliate({ name, email, code, socials, commissionPct: settings.signup.commissionPct });
    if (result.error === "code-taken") return json({ error: "That code's taken. Try another." }, 409);
    if (result.error) return json({ error: "You're already an affiliate." }, 409);

    // Awaited on purpose: Netlify can stop the function the moment we reply, and
    // cut the email off mid-send. sendWelcome never throws.
    const sent = await sendWelcome(result.affiliate, base);

    return json({
      ok: true,
      link: `${base}/go/${result.affiliate.code}`,
      statsLink: `${base}/s/${result.affiliate.token}`,
      commissionPct: result.affiliate.commissionPct,
      emailed: sent.ok,
    });
  } catch (err) {
    console.error("[signup] failed:", err);
    return json({ error: "Couldn't sign you up just now. Try again in a minute." }, 500);
  }
};

export const config = { path: "/api/signup" };
