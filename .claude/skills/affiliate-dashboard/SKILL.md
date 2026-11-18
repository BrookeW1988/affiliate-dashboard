---
name: affiliate-dashboard
description: Set up, customise, test and run this affiliate dashboard. Use when the user says "set up my affiliate program", "set up my affiliates", "make it mine", "change the colours / words / commission", "connect Stripe", "test a sale", "go live", "put it on Netlify", "turn on email", "add an affiliate", "pay my affiliates", "add promo graphics", "close sign-ups", or asks how any part of this dashboard works.
---

# Affiliate dashboard

This folder is a complete affiliate program: a public sign-up page, a tracked link for every affiliate (`/go/<code>`), a private live stats page for each affiliate, and an admin dashboard for the owner. It counts real sales from Stripe and works out commission. It runs on Netlify's free plan with no database (Netlify Blobs).

The user is usually not technical. Do the work yourself, explain in plain English, and give them one next step at a time. Talk to them as "you". Keep replies short.

## How a sale gets credited (explain this simply when it comes up)

1. An affiliate shares `https://<site>/go/sarah`.
2. Someone taps it. The dashboard counts the click and sends them to the user's sales page (`destination` in the settings), adding `?ref=sarah`. For a Stripe Payment Link it also adds `client_reference_id=sarah`, which Stripe carries through to the sale.
3. They pay through Stripe Checkout. Stripe tells the dashboard (the webhook) and the sale lands on Sarah's stats with her commission.

So it works with: **Stripe Payment Links** (no code at all), **the Event Ticketing kit** (it reads `?ref=` and passes it to Stripe), or **any Stripe Checkout** that sets `client_reference_id` or `metadata.ref` to the code. It does NOT see sales from Shopify, Squarespace Commerce, Kajabi, Skool, Gumroad or anything that doesn't go through the user's own Stripe Checkout. If that's their set-up, tell them straight before they put work in.

## What to change (and what to leave alone)

Customising only ever means these files:
- `public/affiliates.config.json`: business name, contact email, logo, `destination`, currency, sign-up rate and open/closed, colours, fonts, every word on screen, share captions and images, email subject and intro
- `public/brand/`: their logo (and `icon.svg`, the browser-tab icon, if they want)
- `public/kit/`: promo graphics affiliates can download

Don't edit `netlify/`, `public/js/` or `public/css/` unless they ask for something the settings can't do. If they do, keep it small and tell them what you changed.

## Golden rules

1. **Keys stay in files.** ADMIN_KEY, STRIPE_WEBHOOK_SECRET and RESEND_API_KEY live in `.env` (and in Netlify). Never print them in chat and never ask the user to paste them in chat: tell them to paste into `.env` themselves. To give them their links, run `bash tools/links.sh` and tell them to open `my-links.md`.
2. **The dashboard only ever needs the webhook signing secret (whsec_...)**, never their Stripe secret key (sk_...). If they offer the secret key, say no thanks and explain it isn't needed.
3. **Test on the computer first, deploy rarely.** Netlify's free plan has 300 credits a month and every live deploy uses 15. If credits run out, Netlify pauses the site until next month and every affiliate link stops working. Before each `npm run deploy:live`, say so and count it ("that's live deploy number 3 this month, 45 of your 300 credits"). Batch changes into one deploy.
4. **Stripe test mode before live mode.** Always get a test-mode sale through end to end before they switch Stripe to live.
5. **After any change, run `npm run check`** and fix what it reports before you say it's done. If you changed `affiliates.config.json` while `npm run dev` is running, restart it: the server functions bundle the settings when they start, so rate, sign-ups open/closed, `destination` and email words are stale until a restart (the pages themselves update on refresh). Live, a deploy does this.
6. **Affiliates' emails are personal information.** Never post or share them. The admin link shows them, so it stays private.

## First-time setup ("set up my affiliate program")

1. Run `npm run setup` (installs, makes their ADMIN_KEY and a local test Stripe secret in `.env`).
2. Ask these in ONE message (offer defaults for anything they don't know yet):
   - business name and the email affiliates should contact
   - what affiliates are selling and WHERE people pay: a Stripe Payment Link, the ticketing kit, or something else (see "How a sale gets credited": if it's not Stripe Checkout, stop and tell them)
   - the link to that sales page (becomes `destination`)
   - commission % for people who sign up themselves, and whether anyone can sign up or only people they add
   - their currency (default AUD)
   - logo (drag the file in) and 2–3 colours, or "match my logo"
3. Fill in `public/affiliates.config.json`. Write `words` and `shareKit.captions` in their voice; keep `{pct}`, `{name}` and `{link}` placeholders. If they have no logo, leave `business.logo` as `""`.
4. `npm run check`, then start `npm run dev` in the background and run `bash tools/links.sh`.
5. Walk them through a full test on their computer (tell them to open `my-links.md`):
   - open the **sign-up page**, sign themselves up with a test code
   - open their new link (`/go/<code>`): it should land on their sales page with `?ref=<code>` on the end
   - run `npm run fake-sale -- <code> 100` and refresh the **dashboard** and the **stats page**: a $100 sale and the commission appear
   - optional: `npm run fake-sale -- --refund <the pi_ id it printed>` to see a refund drop it
   - remove the test affiliate from the dashboard when they're done (local test data never goes live anyway)
6. Then Stripe (below), then go live (below).

## Connect Stripe ("connect Stripe")

Do this after going live on Netlify (Stripe needs the live address). Walk them through `docs/STRIPE.md`, one step at a time:
1. Stripe dashboard, **Test mode** on. Developers > Webhooks > **Add destination** (or "Add endpoint").
2. Endpoint URL: `https://<their site>/api/stripe-webhook` (it's in `my-links.md`).
3. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Nothing else is needed.
4. Copy the **Signing secret** (starts `whsec_`). They paste it into `.env` as `STRIPE_WEBHOOK_SECRET=` themselves, replacing the test one.
5. `npx -y netlify-cli@27.14.2 env:import .env`, then a live deploy (count it).
6. Test sale: they open their affiliate link, buy with Stripe's test card 4242 4242 4242 4242 (any future date, any CVC), and check the dashboard. In Stripe, the webhook's event log should show a 200 next to the event.
7. Going live in Stripe: switch off Test mode, add the same webhook again in live mode (live and test webhooks are separate, with separate signing secrets), put the live `whsec_` in `.env`, `env:import`, deploy. Make sure `destination` points at their LIVE Payment Link, not the test one.

Payment Links: no setting is needed in Stripe. The dashboard adds `client_reference_id` to buy.stripe.com links automatically.

## Go live (Netlify)

1. A free Netlify account (netlify.com, sign up with email or Google).
2. `npx -y netlify-cli@27.14.2 login` (opens their browser to say yes).
3. `npx -y netlify-cli@27.14.2 sites:create --name <business>-affiliates` (lowercase, dashes; add a number if taken). This links the folder to the new site.
4. `npx -y netlify-cli@27.14.2 env:import .env` (copies their keys to Netlify without showing them).
5. `npm run check`, then `npm run deploy:live` (live deploy: tell them, count it). It prints the live address.
6. `bash tools/links.sh https://<their-site>.netlify.app` and tell them to open `my-links.md`.
7. Connect Stripe (above) if they haven't.

Changing settings after going live needs another live deploy. Changing keys in `.env` needs `env:import` again AND a deploy. A custom address (affiliates.theirsite.com) is optional: Netlify > Domain management; then run `tools/links.sh` again with the new address and update the Stripe webhook URL.

## Turn on the welcome email (optional)

1. Free Resend account (resend.com, up to 100 emails a day: plenty).
2. In Resend, add their domain and add the DNS records it shows at their domain host (one record at a time, using their host's screens). Wait for "Verified".
3. Create an API key with sending access. They paste it into `.env` as `RESEND_API_KEY=` and add `EMAIL_FROM=Their Business <hello@theirdomain.com>`. Not in the chat.
4. Test on the computer: sign up with their own email.
5. Live: `env:import .env`, then a live deploy.

Without email, affiliates see both links on screen after signing up, and the user can copy them from "Their stats" on the dashboard.

## Day-to-day

- **Add an affiliate by hand:** the form at the bottom of the dashboard (any rate, e.g. a VIP partner on 25%).
- **Close sign-ups:** set `signup.open` to `false` and deploy. Existing links keep working.
- **Change the rate:** for one affiliate, **Change rate** on the dashboard. For everyone who signs up from now on, `signup.commissionPct` (then deploy). Each sale keeps the rate the affiliate had when it happened, so a change never rewrites past commission.
- **Promo graphics:** put JPG/PNG files in `public/kit/` (under 1 MB each), list them in `shareKit.images` as `{ "file": "/kit/name.jpg", "label": "Feed post" }`, check, deploy.

## Paying affiliates ("pay my affiliates")

Point them to `docs/PAYING-AFFILIATES.md`. In short: the dashboard's **Owed** column is what they owe right now. They pay by bank transfer (outside the dashboard), then click **Record payout** with the amount, and Owed drops. Recommend waiting until their refund window has passed before paying. Download the spreadsheet for their bookkeeper. Australian context: affiliates who are businesses may send an invoice; commission paid is usually a business expense: suggest they check with their accountant, don't give tax advice.

## Troubleshooting

| What they see | What to do |
|---|---|
| Dashboard says "missing your admin key" | They opened /admin without the key. Use the admin link in `my-links.md`. |
| Clicks count but sales don't | Check Stripe > Webhooks > the endpoint's event log. No events = wrong URL or wrong events ticked. 400 errors = wrong signing secret (test vs live mixup is the usual cause). 200 but no sale = the checkout didn't carry the code: check `destination` is the Payment Link, or that their checkout sets `client_reference_id` / `metadata.ref`. |
| Banner: "Stripe isn't connected" | STRIPE_WEBHOOK_SECRET isn't in Netlify. `env:import .env`, then deploy. |
| A sale went to the wrong affiliate | Last link clicked wins. That's normal. |
| Welcome email doesn't arrive | Check spam, then Resend > Logs. "Domain not verified" means EMAIL_FROM isn't on their verified domain. |
| Site paused / links dead | Netlify credits ran out. They return at the start of next month, or upgrade. Prevent it by deploying less. |
| Subscription sales | Only the FIRST payment is credited. Renewals aren't. Say so plainly if they sell memberships. |

## Where things live (for you)

- Settings: `public/affiliates.config.json`. Pages: `public/index.html` (sign-up), `stats.html` (`/s/<token>`), `admin.html` (`/admin#key=...`).
- Functions: `go.mjs` (`/go/:code`), `signup.mjs`, `stats.mjs`, `admin.mjs`, `stripe-webhook.mjs`. Shared logic and the storage layout: `netlify/lib/shared.mjs` (read its top comment).
- Tools: `tools/check.mjs`, `tools/links.sh`, `tools/new-keys.sh`, `tools/fake-sale.mjs` (local only).
