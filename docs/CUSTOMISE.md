# Customise it

Everything you'd want to change is in one file: `public/affiliates.config.json`. The easiest way is to tell Claude what you want ("make the rate 20%", "change the colours to match my logo", "rewrite the sign-up page in my voice"). This is what each setting does, if you'd rather look yourself.

After any change, run `npm run check`. On your computer, words and colours change as soon as you refresh, but settings the server uses (the rate, sign-ups open or closed, `destination`, the email) need `npm run dev` stopped and started again. Everything only shows on the live site after a live deploy.

## business

| Setting | What it does |
|---|---|
| `name` | Your business name. Shows in the welcome email |
| `website` | Your main website |
| `contactEmail` | Where affiliates email you. Shows on the "link isn't working" page and is the reply-to on the welcome email |
| `logo` | Path to your logo, e.g. `/brand/logo.png`. Put the file in `public/brand/`. Leave as `""` for none |

## destination

Where affiliate links send people. Usually your Stripe Payment Link (`https://buy.stripe.com/...`) or your tickets page. The dashboard adds the affiliate's code to the end. If you sell more than one thing, see "Selling more than one thing" in [STRIPE.md](STRIPE.md).

## money

| Setting | What it does |
|---|---|
| `currency` | Three letters, e.g. `AUD`, `NZD`, `USD`, `GBP`. Use the same currency you sell in |
| `locale` | How money and numbers are written. `en-AU` gives $1,234.50 |

## signup

| Setting | What it does |
|---|---|
| `open` | `true` = anyone can sign up on your page. `false` = sign-ups closed; you add affiliates yourself on the dashboard. Existing links keep working either way |
| `commissionPct` | The rate people get when they sign up themselves. You can give anyone a different rate on the dashboard |
| `reservedCodes` | Codes nobody can pick (so nobody grabs `official` or `admin`). Add your business name |

## look

`colours`: background, card (the boxes), text, muted (the grey writing), accent (buttons and highlights), accentText (writing on buttons), line (borders). Each looks like `#e4457a`.

`fonts`: any two fonts from [Google Fonts](https://fonts.google.com), written exactly as Google spells them: one for headings, one for everything else.

## words

Every bit of writing on the sign-up and stats pages. Three placeholders get filled in for you:
- `{pct}`: the sign-up commission rate
- `{name}`: the affiliate's first name (stats page)
- `{link}`: the affiliate's link (captions)

`steps` are the four "how it works" boxes on the sign-up page. `payoutTerms` is your promise about when and how you pay: make it match what you'll actually do.

## shareKit

`captions`: ready-to-copy posts on each affiliate's stats page (and in the welcome email). Put `{link}` where their link goes. Add as many as you like. Each needs a `label` and a `text`.

`images`: promo graphics affiliates can download. Put the files in `public/kit/` (JPG or PNG, under 1 MB each), then list each one:

```json
"images": [
  { "file": "/kit/feed-post.jpg", "label": "Feed post" },
  { "file": "/kit/story.jpg", "label": "Story" }
]
```

## email

The welcome email's `subject` and opening line (`intro`). The rest of the email is their link, their stats page, your captions and your payout terms. Only used once email is turned on ([GO-LIVE.md](GO-LIVE.md)).
