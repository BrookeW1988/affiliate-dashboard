# Affiliate dashboard (instructions for Codex)

An affiliate program you host yourself: plain HTML + JavaScript in `public/`, small server functions in `netlify/functions/`, hosted on Netlify's free plan, data stored in Netlify Blobs, sales counted from Stripe webhooks. The full playbook (setup, customising, Stripe, going live, email, paying affiliates, troubleshooting) is in `.claude/skills/affiliate-dashboard/SKILL.md`. Read it and follow it, whichever AI you are.

The user is usually not technical: do the work, explain in plain English, one step at a time.

## Non-negotiables

- Never print or ask for keys in chat. Keys live in `.env` and in Netlify. Use `bash tools/links.sh` → `my-links.md` for links.
- The dashboard needs Stripe's webhook signing secret (`whsec_`) only. Never ask for or use a Stripe secret key.
- Customising = `public/affiliates.config.json`, `public/brand/`, `public/kit/`. Leave the code alone unless asked.
- Every `npm run deploy:live` uses 15 of the 300 free Netlify credits a month. Test with `npm run dev` first and say so before each live deploy.
- Stripe test mode first, then live mode (separate webhooks, separate secrets).
- Run `npm run check` after changes.
