# Affiliate Dashboard

Your own affiliate program. People sign up and get their own link straight away. Every click and every Stripe sale through that link is counted, and each affiliate gets a private stats page showing what they've earned. You get a dashboard with the leaderboard, what you owe everyone, and a button to record each payout.

No monthly fee to an affiliate app, no database to set up. It runs on Netlify's free plan, and Claude sets it up for you.

## What you get

- **A sign-up page** with your words, colours and logo. Affiliates pick their own code and get their link on the spot (or you add them yourself at any rate you like)
- **A tracked link for every affiliate:** `yoursite.netlify.app/go/sarah`. It counts the click and sends people to your sales page
- **A private stats page per affiliate:** clicks, sales, commission earned, what's been paid and what's still to come, plus ready-to-copy captions with their link in them and your promo graphics to download
- **Your dashboard:** totals, a leaderboard, owed amounts, record payouts, change rates, resend links, download a spreadsheet for your bookkeeper
- **Refunds handled:** a refunded sale stops earning commission by itself
- **Optional welcome email** with their links and captions

## Does it work with how I sell?

It counts sales that go through **your own Stripe Checkout**. That means:

| You sell with | Works? |
|---|---|
| A Stripe Payment Link (buy.stripe.com/...) | Yes, with nothing extra to set up |
| The Event Ticketing kit | Yes: it passes the affiliate code to Stripe for you |
| Your own site using Stripe Checkout | Yes, if the checkout sets `client_reference_id` (or `metadata.ref`) to the code. Claude can add this |
| Shopify, Squarespace Commerce, Kajabi, Skool, Gumroad, Teachable... | No. Those take payment their own way, so the dashboard never hears about the sale |

Subscriptions: the first payment is credited, renewals aren't.

## What you need

- A computer with **Claude Code** (or Codex)
- A **Stripe** account (the one you already take payments with)
- A free **Netlify** account, to put it online. The free plan allows business use
- Optional: a free **Resend** account and your own domain, to email affiliates their links

## Set it up (the easy way)

1. Download this folder and open it in Claude Code (or Codex).
2. Say: **"Set up my affiliate program"**. Claude asks what you're selling, where people pay, your commission rate, your colours and logo, and does the rest.
3. Try it on your laptop: sign yourself up, click your own link, and Claude sends a pretend sale through so you can watch it land on your dashboard.
4. Say: **"Put it live"**, then **"Connect Stripe"**. Claude walks you through Netlify and Stripe, test mode first.

Then share your sign-up page with your community.

## The guides

| Guide | What's in it |
|---|---|
| [Customise it](docs/CUSTOMISE.md) | Every setting in plain English: words, rate, colours, captions, promo graphics |
| [Connect Stripe](docs/STRIPE.md) | The webhook, test mode, going live, and how each way of selling passes the code along |
| [Go live](docs/GO-LIVE.md) | Netlify step by step, turning on email, your own web address, what the free plans allow |
| [Paying affiliates](docs/PAYING-AFFILIATES.md) | When to pay, recording payouts, refunds after payout, the spreadsheet |

## Using it with the Event Ticketing kit

Set `destination` in `public/affiliates.config.json` to your tickets page. The affiliate link sends people there with `?ref=their-code`, the ticketing kit hands the code to Stripe, and the sale shows up here. Both kits listen to the same Stripe account, each with its own webhook.

## What it costs

Nothing, for most programs:
- **Netlify free plan:** 300 credits a month. Each time you put a new version live uses 15, so test on your computer first and go live once or twice. Clicks, sign-ups and sales use very little. If the credits run out, Netlify pauses the site until next month (and affiliate links stop working), so don't redeploy 20 times in a launch week.
- **Stripe:** your normal fees on each sale. The dashboard adds nothing.
- **Resend free plan (optional email):** up to 100 emails a day.
- Commission is whatever you agree to pay your affiliates.

## Privacy and safety

- The dashboard only ever needs Stripe's **webhook signing secret**, never your Stripe secret key. It can't charge, refund or look around your Stripe account.
- It never stores who bought. A sale is just an amount, a date and the Stripe reference.
- Affiliates' stats pages use long random links, so nobody can guess someone else's. Affiliates see only their own numbers, never buyers' details.
- Your dashboard link has your admin key in it. Keep it to yourself.
- Affiliates' names and emails are personal information you're looking after: only use them to run your program, and only add them to your mailing list if they've said yes.

## What's in the folder

| Where | What it is |
|---|---|
| `public/affiliates.config.json` | **all your settings**: business name, where links go, rate, colours, fonts, every word on screen, captions |
| `public/kit/` | promo graphics affiliates can download |
| `public/brand/` | your logo and the browser-tab icon |
| `public/*.html`, `public/js/`, `public/css/` | the sign-up page, stats page and dashboard |
| `netlify/functions/` | the small server bits: the `/go/` link, sign-up, stats, dashboard, Stripe |
| `tools/` | `check.mjs` (checks your setup), `links.sh` (your private links), `fake-sale.mjs` (a pretend sale for testing) |
| `docs/` | the guides |

## Licence

MIT: use it, change it, run it for your clients. Fonts load from Google Fonts.
