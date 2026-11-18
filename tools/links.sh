#!/bin/bash
# Writes my-links.md: your sign-up page and your private dashboard link (with your key in it).
# The file stays on your computer (it's in .gitignore), so your key never goes in a chat.
#
#   bash tools/links.sh                                     links for testing on this computer
#   bash tools/links.sh https://your-affiliates.netlify.app adds your live links (remembered)
cd "$(dirname "$0")/.." || exit 1
[ -f .env ] || { echo "No .env yet: run 'npm run setup' first."; exit 1; }
get() { grep "^$1=" .env | head -n 1 | cut -d= -f2-; }

if [ -n "$1" ]; then
  live="${1%/}"
  if grep -q '^SITE_URL=' .env; then
    sed -i.bak "s#^SITE_URL=.*#SITE_URL=$live#" .env && rm -f .env.bak
  else
    echo "SITE_URL=$live" >> .env
  fi
fi
live=$(get SITE_URL)
admin=$(get ADMIN_KEY)

{
  echo "# My affiliate links"
  echo
  echo "Keep the dashboard link to yourself: anyone with it can see your affiliates' emails and add or remove affiliates."
  for base in $live http://localhost:8888; do
    echo
    if [ "$base" = "http://localhost:8888" ]; then
      echo "## Testing on this computer (run \`npm run dev\` first)"
    else
      echo "## Live"
    fi
    echo
    echo "- Your dashboard (you only): $base/admin#key=$admin"
    echo "- Sign-up page (share this with would-be affiliates): $base/"
    echo "- Stripe webhook address (paste into Stripe): $base/api/stripe-webhook"
  done
} > my-links.md
echo "Saved your links in my-links.md (open it from the file list)."
