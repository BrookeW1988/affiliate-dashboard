// npm run check: looks over your settings and tells you, in plain English,
// anything that's missing or broken. Run it after any change and before going live.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath (not .pathname) so folders with spaces in their names work.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUB = join(ROOT, "public");
let problems = 0;
let warnings = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => (problems++, console.log(`  ✗ ${msg}`));
const warn = (msg) => (warnings++, console.log(`  ! ${msg}`));
const isColour = (c) => typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);

console.log("\nYour settings (public/affiliates.config.json)");
let cfg = null;
try {
  cfg = JSON.parse(readFileSync(join(PUB, "affiliates.config.json"), "utf8"));
} catch (err) {
  bad(`affiliates.config.json isn't valid JSON (usually a missing comma or quote): ${err.message}`);
}

if (cfg) {
  cfg.business?.name ? ok(`business name: "${cfg.business.name}"`) : bad("business.name is empty");
  if (cfg.business?.name === "Your Business") warn('business.name is still "Your Business"');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.business?.contactEmail ?? "")) bad("business.contactEmail should be an email address");
  else if (cfg.business.contactEmail.endsWith("@example.com")) warn("business.contactEmail is still the example address");
  if (cfg.business?.logo) {
    existsSync(join(PUB, cfg.business.logo.replace(/^\//, ""))) ? ok(`logo: ${cfg.business.logo}`) : bad(`can't find the logo file ${cfg.business.logo}`);
  }

  let dest = null;
  try {
    dest = new URL(cfg.destination);
  } catch {
    bad('destination should be a full web address, like "https://yoursite.com/tickets"');
  }
  if (dest) {
    if (dest.protocol !== "https:") warn("destination doesn't start with https://");
    if (dest.hostname === "example.com") warn("destination is still example.com: set it to the page where people buy");
    else if (dest.hostname === "buy.stripe.com") ok(`destination: a Stripe Payment Link (sales get credited automatically)`);
    else ok(`destination: ${dest.href} (make sure that page's checkout passes the ref on: see docs/STRIPE.md)`);
  }

  /^[A-Z]{3}$/.test(cfg.money?.currency ?? "") ? ok(`currency: ${cfg.money.currency}`) : bad('money.currency should be a 3-letter code like "AUD"');
  const pct = cfg.signup?.commissionPct;
  if (typeof pct !== "number" || pct < 0 || pct > 100) bad("signup.commissionPct should be a number from 0 to 100");
  else ok(`sign-ups ${cfg.signup.open ? "open" : "closed"}, at ${pct}%`);

  for (const [name, value] of Object.entries(cfg.look?.colours ?? {})) {
    if (!isColour(value)) bad(`colour "${name}" should look like #e4457a, but it's ${JSON.stringify(value)}`);
  }

  for (const c of cfg.shareKit?.captions ?? []) {
    if (!c.text?.includes("{link}")) warn(`share caption "${c.label}" has no {link} in it, so affiliates' links won't be added`);
  }
  for (const img of cfg.shareKit?.images ?? []) {
    existsSync(join(PUB, String(img.file ?? "").replace(/^\//, ""))) ? ok(`share image: ${img.file}`) : bad(`can't find share image ${img.file}`);
  }
}

console.log("\nYour keys (.env)");
const envPath = join(ROOT, ".env");
if (!existsSync(envPath)) {
  bad("no .env file yet: run `npm run setup`");
} else {
  const env = Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
  (env.ADMIN_KEY ?? "").length >= 16 ? ok("ADMIN_KEY is set") : bad("ADMIN_KEY is missing or too short: run `npm run setup`");
  const secret = env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) warn("STRIPE_WEBHOOK_SECRET isn't set: sales won't be counted until it is (docs/STRIPE.md)");
  else if (secret.startsWith("whsec_localtest")) warn("STRIPE_WEBHOOK_SECRET is the test one: fine on this computer, swap in your real one from Stripe for the live site");
  else if (!secret.startsWith("whsec_")) bad("STRIPE_WEBHOOK_SECRET should start with whsec_ (it's the webhook's signing secret, not your API key)");
  else ok("STRIPE_WEBHOOK_SECRET is set");
  if (/^(sk|rk)_/.test(secret)) bad("that's a Stripe API key, not a webhook signing secret. Remove it and use the whsec_ one");
  const hasKey = Boolean(env.RESEND_API_KEY);
  const hasFrom = Boolean(env.EMAIL_FROM);
  if (hasKey && hasFrom) ok("welcome email is on");
  else if (hasKey || hasFrom) bad("for email you need BOTH RESEND_API_KEY and EMAIL_FROM (or leave both empty)");
  else ok("welcome email is off (affiliates see their links on screen)");
}

console.log(
  problems
    ? `\n${problems} thing${problems === 1 ? "" : "s"} to fix${warnings ? `, ${warnings} to look at` : ""}.\n`
    : `\nAll good${warnings ? ` (${warnings} thing${warnings === 1 ? "" : "s"} to look at)` : ""}.\n`,
);
process.exit(problems ? 1 : 0);
