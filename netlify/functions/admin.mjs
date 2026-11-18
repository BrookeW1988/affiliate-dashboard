// /api/admin: everything your dashboard does. Needs ADMIN_KEY.
//
//   GET  ?action=list                                  every affiliate + their numbers
//   GET  ?action=csv                                   the same, as a spreadsheet
//   POST {action:"add", name, email, code, commissionPct, sendEmail}
//   POST {action:"payout", code, amountCents, note}    record that you paid them
//   POST {action:"rate", code, commissionPct}          change their rate (new sales only)
//   POST {action:"resend", code}                       email them their links again
//   POST {action:"delete", code}                       remove an affiliate

import {
  cleanCode,
  clickCounts,
  settings,
  createAffiliate,
  deleteAffiliate,
  emailOn,
  env,
  getAffiliate,
  isAdmin,
  json,
  listAffiliates,
  listSales,
  saveAffiliate,
  sendWelcome,
  siteUrl,
  summarise,
} from "../lib/shared.mjs";

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "admin key invalid" }, 403);
  const base = siteUrl(req);

  if (req.method === "GET") {
    const action = new URL(req.url).searchParams.get("action") ?? "list";
    const [affiliates, sales, clicks] = await Promise.all([listAffiliates(), listSales(), clickCounts()]);
    const rows = affiliates
      .map((a) => ({
        ...summarise(a, sales, clicks),
        email: a.email,
        socials: a.socials,
        createdAt: a.createdAt,
        link: `${base}/go/${a.code}`,
        statsLink: `${base}/s/${a.token}`,
        payouts: a.payouts ?? [],
      }))
      // Leaderboard: most revenue first.
      .sort((x, y) => y.revenueCents - x.revenueCents);

    if (action === "csv") return csv(rows);

    // Sales with a code that isn't (or is no longer) an affiliate: worth knowing about.
    const known = new Set(affiliates.map((a) => a.code));
    const orphanSales = sales.filter((s) => !known.has(s.code)).length;
    return json({
      rows,
      orphanSales,
      emailOn: emailOn(),
      stripeOn: Boolean(env("STRIPE_WEBHOOK_SECRET")),
      lastSaleAt: sales.map((s) => s.createdAt).sort().at(-1) ?? null,
    });
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  if (body.action === "add") {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const code = cleanCode(body.code);
    const pct = Number(body.commissionPct);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "add a name and a real email" }, 400);
    if (!code) return json({ error: "code: lowercase letters, numbers and hyphens, 2 to 40 long" }, 400);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return json({ error: "commission should be between 0 and 100" }, 400);
    const result = await createAffiliate({ name, email, code, commissionPct: pct });
    if (result.error === "code-taken") return json({ error: "that code is already taken" }, 409);
    if (result.error === "email-taken") return json({ error: "someone with that email is already an affiliate" }, 409);
    const sent = body.sendEmail ? await sendWelcome(result.affiliate, base) : { ok: false };
    return json({ ok: true, emailed: sent.ok });
  }

  const affiliate = await getAffiliate(body.code);
  if (!affiliate) return json({ error: "affiliate not found" }, 404);

  if (body.action === "payout") {
    const amountCents = Math.round(Number(body.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) return json({ error: "enter the amount you paid" }, 400);
    affiliate.payouts = [
      ...(affiliate.payouts ?? []),
      { amountCents, at: new Date().toISOString(), note: String(body.note ?? "").slice(0, 200) },
    ];
    await saveAffiliate(affiliate);
    return json({ ok: true });
  }

  if (body.action === "rate") {
    // Only affects NEW sales: each past sale kept the rate it was made at.
    const pct = Number(body.commissionPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return json({ error: "commission should be between 0 and 100" }, 400);
    affiliate.commissionPct = pct;
    await saveAffiliate(affiliate);
    return json({ ok: true });
  }

  if (body.action === "resend") {
    const sent = await sendWelcome(affiliate, base);
    return sent.ok ? json({ ok: true, sentTo: affiliate.email }) : json({ error: sent.error }, 500);
  }

  if (body.action === "delete") {
    await deleteAffiliate(affiliate);
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
};

function csv(rows) {
  const money = (c) => (c / 100).toFixed(2);
  const cell = (v) => {
    let s = String(v ?? "");
    // Stop spreadsheet apps treating a value like "=SUM(...)" as a formula.
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const header = ["name", "email", "code", "socials", "rate %", "clicks", "sales", "revenue", "commission earned", "paid", "owed", "last paid", "link", "joined"];
  const lines = rows.map((r) =>
    [r.name, r.email, r.code, r.socials, r.commissionPct, r.clicks, r.sales, money(r.revenueCents), money(r.earnedCents), money(r.paidCents), money(r.owedCents), r.lastPaidAt?.slice(0, 10) ?? "", r.link, r.createdAt.slice(0, 10)]
      .map(cell)
      .join(","),
  );
  const currency = settings.money?.currency ?? "";
  return new Response([`# amounts in ${currency}`, header.join(","), ...lines].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="affiliates-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}

export const config = { path: "/api/admin" };
