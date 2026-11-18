// /api/stats?token=<secret>: the numbers for ONE affiliate's private stats page.
// The long random token in their link is the only "login". A wrong token gets
// the same vague answer whether or not it's close, so links can't be guessed.

import { clickCounts, findByToken, json, listSales, siteUrl, summarise } from "../lib/shared.mjs";

export default async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const affiliate = await findByToken(token).catch(() => null);
  if (!affiliate) return json({ error: "not found" }, 404);

  const [sales, clicks] = await Promise.all([listSales(), clickCounts(affiliate.code)]);
  const summary = summarise(affiliate, sales, clicks);

  return json({
    ...summary,
    // First name only on screen, and never their email or anyone else's numbers.
    name: affiliate.name.split(" ")[0],
    link: `${siteUrl(req)}/go/${affiliate.code}`,
  });
};

export const config = { path: "/api/stats" };
