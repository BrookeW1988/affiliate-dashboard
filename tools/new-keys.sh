#!/bin/bash
# Makes your admin key and saves it in .env (only if you don't have one yet).
# ADMIN_KEY unlocks your dashboard. It stays on your computer and in Netlify.
cd "$(dirname "$0")/.." || exit 1
[ -f .env ] || cp .env.example .env
if grep -q "^ADMIN_KEY=.\+" .env; then
  echo "ADMIN_KEY: already set, leaving it alone"
else
  key=$(openssl rand -hex 16)
  if grep -q "^ADMIN_KEY=" .env; then
    sed -i.bak "s/^ADMIN_KEY=.*/ADMIN_KEY=$key/" .env && rm -f .env.bak
  else
    echo "ADMIN_KEY=$key" >> .env
  fi
  echo "ADMIN_KEY: made a new one"
fi
# For testing on your computer, a made-up Stripe signing secret so `npm run fake-sale`
# works before you've connected Stripe. Your real one replaces it when you go live.
if ! grep -q "^STRIPE_WEBHOOK_SECRET=.\+" .env; then
  secret="whsec_localtest$(openssl rand -hex 16)"
  if grep -q "^STRIPE_WEBHOOK_SECRET=" .env; then
    sed -i.bak "s/^STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=$secret/" .env && rm -f .env.bak
  else
    echo "STRIPE_WEBHOOK_SECRET=$secret" >> .env
  fi
  echo "STRIPE_WEBHOOK_SECRET: made a test one (swap in your real one from Stripe before going live)"
fi
echo "Saved in .env (that file stays on your computer)."
