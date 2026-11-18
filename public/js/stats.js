// An affiliate's private stats page: their link, their numbers, and the share kit.

import { date, esc, fill, loadSettings, logoHtml, money, wireCopyButtons } from "./common.js";

const app = document.getElementById("app");
const cfg = await loadSettings();
const words = cfg.words ?? {};
const token = location.pathname.split("/").filter(Boolean).pop() ?? "";

const res = await fetch(`/api/stats?token=${encodeURIComponent(token)}`, { cache: "no-store" });
if (!res.ok) {
  app.innerHTML = `<div class="narrow centre" style="margin:auto">
    ${logoHtml(cfg)}
    <h1>This link isn't working</h1>
    <p class="muted">Check you've got the whole link we sent you. Or email
    <a href="mailto:${esc(cfg.business?.contactEmail)}">${esc(cfg.business?.contactEmail)}</a> and we'll send it again.</p>
  </div>`;
} else {
  render(await res.json());
}

function render(s) {
  // Sales can outnumber clicks (someone buys twice, or comes back later), and a
  // "300%" would just confuse people, so only show it when it makes sense.
  const conversion = s.clicks > 0 && s.sales <= s.clicks ? `${((s.sales / s.clicks) * 100).toFixed(1)}%` : "–";
  const stat = (label, value, accent = false) =>
    `<div class="card stat${accent ? " accent" : ""}"><span class="value">${esc(value)}</span><span class="label">${esc(label)}</span></div>`;

  const sales = s.recentSales.length
    ? `<ul class="plain">${s.recentSales
        .map(
          (x) => `<li><span>${date(x.date)}</span>
            ${x.refunded
              ? '<span class="muted">Refunded</span>'
              : `<span>${money(x.amountCents, cfg)} <span class="muted small">· you earn ${money(x.commissionCents, cfg)}</span></span>`}</li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">${esc(words.statsNoSales)}</p>`;

  const captions = (cfg.shareKit?.captions ?? [])
    .map((c) => {
      const text = c.text.replaceAll("{link}", s.link);
      return `<div><h3>${esc(c.label)}</h3><p class="caption">${esc(text)}</p>
        <button type="button" class="quiet small" data-copy="${esc(text)}">Copy</button></div>`;
    })
    .join("");
  const images = (cfg.shareKit?.images ?? [])
    .map((img) => `<a href="${esc(img.file)}" download><img src="${esc(img.file)}" alt="${esc(img.label)}" loading="lazy">
      <span class="small">${esc(img.label)} · download</span></a>`)
    .join("");

  app.innerHTML = `
    <div class="stack">
      <header class="centre">
        ${logoHtml(cfg)}
        <h1>${esc(fill(words.statsTitle, { name: s.name }))}</h1>
        <p class="muted">${esc(words.statsIntro)}</p>
      </header>

      <section class="card">
        <h3>Your link</h3>
        <div class="copy-row"><code>${esc(s.link)}</code><button type="button" data-copy="${esc(s.link)}">Copy link</button></div>
      </section>

      <section class="grid">
        ${stat("clicks", s.clicks)}
        ${stat("sales", s.sales)}
        ${stat("sales you brought in", money(s.revenueCents, cfg))}
        ${stat("commission earned", money(s.earnedCents, cfg), true)}
        ${stat("paid to you", money(s.paidCents, cfg))}
        ${stat("still to come", money(Math.max(0, s.owedCents), cfg))}
        ${stat("of clicks bought", conversion)}
        ${stat("your rate", `${s.commissionPct}%`)}
      </section>

      <section class="card">
        <h2>Your sales</h2>
        ${sales}
        ${s.lastPaidAt ? `<p class="muted small">Last paid ${date(s.lastPaidAt)}.</p>` : ""}
      </section>

      ${captions || images ? `<section class="card stack">
        <h2>Ready to share</h2>
        ${captions}
        ${images ? `<div class="kit">${images}</div>` : ""}
      </section>` : ""}

      <p class="centre muted small">${esc(words.payoutTerms)}<br>${esc(words.statsSignOff)}</p>
    </div>`;
  wireCopyButtons();
}
