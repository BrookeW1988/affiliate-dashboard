# Connect Stripe

Stripe tells your dashboard every time someone pays, using a **webhook** (an automatic message from Stripe to your site). You set it up once. Do this after your site is live on Netlify, because Stripe needs the live address.

The dashboard only needs the webhook's **signing secret** (it starts with `whsec_`). It never needs your Stripe secret key (`sk_...`), so it can't charge, refund or see anything else in your account.

## 1. Test mode first

1. In your Stripe dashboard, turn on **Test mode** (the switch is top right, or in the account menu).
2. Go to **Developers > Webhooks** and click **Add destination** (some accounts say **Add endpoint**).
3. Choose **Your account**, then tick these three events (search for each):
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
4. Choose **Webhook endpoint** and paste your address: `https://your-site.netlify.app/api/stripe-webhook` (Claude puts it in `my-links.md`).
5. Save it, then open it and click to reveal the **Signing secret**.
6. Paste it into `.env` on your computer, on the `STRIPE_WEBHOOK_SECRET=` line, replacing the test one that's there. Don't paste it into the chat.
7. Ask Claude to send your keys to Netlify and deploy (that's `env:import` and a live deploy).

## 2. A test sale

1. Make a **test-mode** Payment Link in Stripe for one of your products, and set `destination` to it for now (or use the ticketing kit in test mode).
2. Sign yourself up as an affiliate, then open your own `/go/your-code` link.
3. Pay with Stripe's test card: **4242 4242 4242 4242**, any future expiry, any CVC, any postcode.
4. Refresh your dashboard. The sale and the commission should be there.
5. In Stripe, open the webhook: the event should show a green 200.

Want to test a refund? Refund the test payment in Stripe and refresh: the sale shows as refunded and the commission goes.

## 3. Going live

Test mode and live mode keep **separate** webhooks with **separate** signing secrets.

1. Turn off Test mode in Stripe.
2. Add the webhook again in live mode, same address, same three events.
3. Put the **live** signing secret in `.env` (replacing the test one), then `env:import` and deploy.
4. Set `destination` to your **live** Payment Link (test links start `https://buy.stripe.com/test_`). Deploy.

## How each way of selling passes the code along

The dashboard credits a sale when the Stripe Checkout carries the affiliate's code in `client_reference_id` or in `metadata.ref`.

**Stripe Payment Links:** nothing to do. When `destination` is a buy.stripe.com link, the dashboard adds `client_reference_id=<code>` to it, and Stripe keeps it with the sale. Note: if someone leaves and comes back later without the link, that sale isn't credited.

**The Event Ticketing kit:** nothing to do. Its tickets page remembers `?ref=<code>` for 30 days and sends it to Stripe on both fields.

**Your own Stripe Checkout code:** when you create the Checkout Session, set `client_reference_id` to the `ref` from the page address (and keep it in the browser for a while, so people who come back later still count). Ask Claude: "my checkout needs to pass the affiliate ref to Stripe".

**A Stripe Buy Button on your website:** the button takes a `client-reference-id` attribute. A few lines of script can copy `?ref=` from the address into it. Ask Claude to add it.

**Not Stripe Checkout** (Shopify, Squarespace Commerce, Kajabi, Skool, Gumroad and so on): the dashboard can't see those sales. Use that platform's own affiliate feature instead.

## Selling more than one thing

Every sale in your Stripe account that carries an affiliate's code is credited, whatever the product. Affiliate links all go to one `destination`, so if you want affiliates promoting several products, the simplest way is a page listing them all, with each buy button passing the code along (Claude can set this up).

## Subscriptions and memberships

Only the first payment is credited. Renewals aren't counted, so recurring commission would need to be worked out by hand (the Stripe customer list is the place to look).

## Which amount does commission come from?

What the buyer actually paid at checkout (after any discount code), minus any refund. If your prices include GST and you'd rather pay commission on the amount before GST, set the rate a little lower to match (for 15% of the ex-GST amount on a GST-inclusive price, use about 13.6%).

## Something not working?

| What you see | What it means |
|---|---|
| No events in the webhook's log | The address is wrong, or the events aren't ticked |
| Events show 400 | The signing secret doesn't match (usually the test one on a live webhook, or the other way round). Copy it again, `env:import`, deploy |
| Events show 200 but no sale appears | The checkout didn't carry the code. Check `destination` is the Payment Link itself, or that your checkout sets `client_reference_id` |
| Events show 500 | A storage hiccup. Stripe tries again by itself over the next few hours |
