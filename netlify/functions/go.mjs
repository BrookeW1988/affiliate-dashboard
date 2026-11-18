// /go/<code>: an affiliate's link. Counts the click, then sends the person on to
// your sales page (the "destination" in affiliates.config.json) with the code
// attached, so the sale can be credited to the right affiliate:
//   - ?ref=<code>                  read by the ticketing kit (and easy for any checkout to read)
//   - ?client_reference_id=<code>  added for Stripe Payment Links (buy.stripe.com), which
//                                  pass it straight through to the sale. No code needed.
//
// An unknown code still sends people to your page (never a dead link), just without credit.

import { cleanCode, settings, getAffiliate, recordClick } from "../lib/shared.mjs";

// Link previews (Instagram, WhatsApp, Slack...) "visit" a link the moment it's
// posted. Don't count those as clicks.
const PREVIEW_BOTS =
  /bot|crawl|spider|preview|facebookexternalhit|meta-externalagent|whatsapp|telegram|discord|slack|linkedin|skype|embedly|pinterest|vkshare|google-inspectiontool/i;

export default async (req, context) => {
  const destination = new URL(settings.destination);
  const code = cleanCode(context.params.code);
  const affiliate = code ? await getAffiliate(code).catch(() => null) : null;

  if (affiliate) {
    destination.searchParams.set("ref", affiliate.code);
    if (destination.hostname === "buy.stripe.com") {
      destination.searchParams.set("client_reference_id", affiliate.code);
    }
    const agent = req.headers.get("user-agent") ?? "";
    if (req.method === "GET" && !PREVIEW_BOTS.test(agent)) {
      // A dropped click is fine; a broken link isn't. Never let counting fail the redirect.
      await recordClick(affiliate.code).catch((err) => console.error("[go] click not saved:", err));
    }
  }

  return new Response(null, {
    status: 302,
    headers: { location: destination.toString(), "cache-control": "no-store" },
  });
};

export const config = { path: "/go/:code" };
