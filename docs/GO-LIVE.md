# Go live

The easy way: tell Claude **"put it live"**. Here's what happens, so you know what you're saying yes to.

## Netlify, step by step

1. Make a free account at [netlify.com](https://www.netlify.com) (email or Google is fine).
2. Claude runs `netlify login`. Your browser opens and asks you to say yes.
3. Claude makes your site, e.g. `yourbusiness-affiliates.netlify.app`.
4. Claude copies your keys from `.env` to Netlify (`env:import`), without them going through the chat.
5. Claude checks everything and does a **live deploy**. Your site is online.
6. Claude updates `my-links.md` with your live links: your dashboard (keep it private), your sign-up page (share it), and the address Stripe needs.
7. Then connect Stripe: [STRIPE.md](STRIPE.md).

Every change after this (words, colours, rate) only shows on the live site after another live deploy. New keys need `env:import` and a deploy.

## What the free plans allow

- **Netlify:** 300 credits a month. A live deploy uses 15. Visits, clicks and sales use very little. If the credits run out, Netlify pauses the site until next month and every affiliate link stops working, so test on your computer and batch your changes. Business use is allowed on the free plan.
- **Netlify Blobs** (where your affiliates and sales are stored) comes with every site at no cost.

## Turn on the welcome email (optional)

Without it, affiliates see both their links on screen when they sign up, and you can copy anyone's links from their stats page.

1. Make a free account at [resend.com](https://resend.com) (up to 100 emails a day).
2. Add your domain in Resend and add the records it shows wherever your domain lives (GoDaddy, Crazy Domains, Cloudflare...). Claude can talk you through each one. Wait until it says **Verified**.
3. Make an API key with sending access.
4. Paste it into `.env` yourself as `RESEND_API_KEY=`, and add `EMAIL_FROM=Your Business <hello@yourdomain.com>` (the address must be on the domain you verified).
5. Test it on your computer by signing up with your own email.
6. Ask Claude to `env:import` and deploy.

## Your own web address (optional)

Want `affiliates.yourbusiness.com` instead of the netlify.app address? In Netlify, open your site > **Domain management** > **Add a domain**, and follow the steps (it's one DNS record). Then:
- ask Claude to run `tools/links.sh` with the new address, so your links update
- change the webhook address in Stripe to the new one

Links already shared on the netlify.app address keep working.

## Keeping it safe

- Your dashboard link is `.../admin#key=...`. Anyone with it can see affiliates' emails and add or remove affiliates. Don't share it or post a screenshot of it.
- Think your key's got out? Delete the `ADMIN_KEY=` line from `.env`, run `npm run setup` for a new one, then `env:import` and deploy. The old link stops working.
