// /api/stripe-webhook: Stripe tells us here when someone pays or gets a refund.
//
// Set it up in Stripe: Developers > Webhooks > Add endpoint
//   URL:    https://<your site>/api/stripe-webhook
//   Events: checkout.session.completed
//           checkout.session.async_payment_succeeded
//           charge.refunded
// then put the endpoint's signing secret in STRIPE_WEBHOOK_SECRET.
//
// A sale is credited to an affiliate when the Stripe Checkout has their code in
// client_reference_id (Stripe Payment Links do this from the /go/ link) or in
// metadata.ref (the ticketing kit sets both). Sales without a code, or with a
// code that isn't an affiliate, are ignored: they're just normal sales.
//
// Stripe sometimes sends the same message twice. Each sale is saved under its
// Stripe session id, so a repeat finds it already there and changes nothing.

import {
  cleanCode,
  env,
  getAffiliate,
  json,
  store,
  verifyStripeSignature,
} from "../lib/shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // The signature is worked out from the exact bytes Stripe sent, so read the
  // raw text BEFORE turning it into an object.
  const raw = await req.text();
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET isn't set, so no sales can be counted");
    return json({ error: "not set up" }, 500);
  }
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
    return json({ error: "bad signature" }, 400);
  }

  const event = JSON.parse(raw);
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await recordSale(event.data.object);
    } else if (event.type === "charge.refunded") {
      await recordRefund(event.data.object);
    }
  } catch (err) {
    // A 500 tells Stripe to try again later, so a storage hiccup doesn't lose a sale.
    console.error(`[stripe] couldn't handle ${event.type}:`, err);
    return json({ error: "try again" }, 500);
  }
  return json({ received: true });
};

async function recordSale(session) {
  // Bank transfers etc. finish later: Stripe sends "completed" as unpaid, then
  // "async_payment_succeeded" once the money's in. Only count paid sales.
  if (session.payment_status !== "paid") return;

  const code = cleanCode(session.client_reference_id) ?? cleanCode(session.metadata?.ref);
  if (!code) return;
  const affiliate = await getAffiliate(code);
  if (!affiliate) return;

  const key = `sales/${session.id}.json`;
  if (await store().get(key)) return; // already counted

  await store().setJSON(key, {
    sessionId: session.id,
    paymentIntent: session.payment_intent ?? null,
    code,
    amountCents: session.amount_total ?? 0,
    currency: (session.currency ?? "").toUpperCase(),
    // Saved with the sale, so changing someone's rate later only affects new sales.
    commissionPct: affiliate.commissionPct,
    refundedCents: 0,
    // Subscriptions: only this first payment is credited (see docs/STRIPE.md).
    mode: session.mode ?? "payment",
    createdAt: new Date((session.created ?? Date.now() / 1000) * 1000).toISOString(),
  });
  if (session.payment_intent) {
    await store().set(`payments/${session.payment_intent}`, session.id);
  }
}

async function recordRefund(charge) {
  if (!charge.payment_intent) return;
  const sessionId = await store().get(`payments/${charge.payment_intent}`);
  if (!sessionId) return; // not an affiliate sale
  const key = `sales/${sessionId}.json`;
  const sale = await store().get(key, { type: "json" });
  if (!sale) return;
  // amount_refunded is the running total refunded on this payment, so partial
  // refunds and repeat messages both land on the right number.
  sale.refundedCents = Math.min(sale.amountCents, charge.amount_refunded ?? 0);
  sale.refundedAt = new Date().toISOString();
  await store().setJSON(key, sale);
}

export const config = { path: "/api/stripe-webhook" };
