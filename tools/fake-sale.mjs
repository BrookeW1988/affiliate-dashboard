// npm run fake-sale -- <code> [amount]       pretend someone bought through <code>'s link
// npm run fake-sale -- --refund <pi_...>      pretend that sale was refunded
//
// Only for testing on your computer (npm run dev must be running). It sends the
// dashboard the same signed message Stripe would, so you can watch a sale land
// on the leaderboard before you've connected Stripe at all.

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// PORT only matters if you started `npm run dev` on a different port.
const URL_LOCAL = `http://localhost:${process.env.PORT ?? 8888}/api/stripe-webhook`;

const env = Object.fromEntries(
  readFileSync(`${ROOT}.env`, "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const secret = env.STRIPE_WEBHOOK_SECRET;
if (!secret) {
  console.log("No STRIPE_WEBHOOK_SECRET in .env: run `npm run setup` first.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(`${ROOT}public/affiliates.config.json`, "utf8"));
const args = process.argv.slice(2);
const id = (prefix) => `${prefix}_test${randomBytes(10).toString("hex")}`;
const now = Math.floor(Date.now() / 1000);

let event;
if (args[0] === "--refund") {
  const pi = args[1];
  if (!pi?.startsWith("pi_")) {
    console.log("Usage: npm run fake-sale -- --refund pi_... (the payment id printed when you made the fake sale)");
    process.exit(1);
  }
  const amount = Math.round(Number(args[2] ?? 999999) * 100);
  event = {
    id: id("evt"),
    type: "charge.refunded",
    created: now,
    data: { object: { id: id("ch"), object: "charge", payment_intent: pi, refunded: true, amount_refunded: amount } },
  };
} else {
  const code = (args[0] ?? "").toLowerCase();
  if (!code) {
    console.log("Usage: npm run fake-sale -- <affiliate code> [amount, e.g. 97]");
    process.exit(1);
  }
  const amount = Math.round(Number(args[1] ?? 100) * 100);
  event = {
    id: id("evt"),
    type: "checkout.session.completed",
    created: now,
    data: {
      object: {
        id: id("cs"),
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        payment_intent: id("pi"),
        amount_total: amount,
        currency: (config.money?.currency ?? "aud").toLowerCase(),
        client_reference_id: code,
        metadata: { ref: code },
        created: now,
      },
    },
  };
}

const body = JSON.stringify(event);
const signature = createHmac("sha256", secret).update(`${now}.${body}`).digest("hex");
let res;
try {
  res = await fetch(URL_LOCAL, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": `t=${now},v1=${signature}` },
    body,
  });
} catch {
  console.log("Couldn't reach the dashboard. Start it first with `npm run dev`.");
  process.exit(1);
}
const out = await res.text();
if (!res.ok) {
  console.log(`The dashboard said no (${res.status}): ${out}`);
  process.exit(1);
}
if (event.type === "charge.refunded") {
  console.log(`Fake refund sent for ${args[1]}. Refresh your dashboard.`);
} else {
  const s = event.data.object;
  console.log(`Fake sale sent: ${(s.amount_total / 100).toFixed(2)} ${s.currency.toUpperCase()} via "${s.client_reference_id}".`);
  console.log(`Payment id (to fake a refund): ${s.payment_intent}`);
  console.log("Refresh your dashboard. No sale showing? That code isn't an affiliate yet.");
}
