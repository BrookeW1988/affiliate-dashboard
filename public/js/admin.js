// Your dashboard: add affiliates, see the leaderboard, record payouts.
// The admin key comes from the #key=... part of the link, which browsers never
// send to the server or to other sites. We pass it in a header on each request.

import { date, esc, loadSettings, money, wireCopyButtons } from "./common.js";

const app = document.getElementById("app");
const cfg = await loadSettings();
const key = new URLSearchParams(location.hash.slice(1)).get("key") ?? "";

const api = async (method, body, query = "") => {
  const res = await fetch(`/api/admin${query}`, {
    method,
    headers: { "x-admin-key": key, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `error ${res.status}`);
  return data;
};

const slug = (v) =>
  v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

async function load() {
  let data;
  try {
    data = await api("GET", null, "?action=list");
  } catch (err) {
    app.innerHTML = `<h1>Affiliate dashboard</h1><p class="error">${
      err.message === "admin key invalid"
        ? "This link is missing your admin key. Open the admin link from my-links.md."
        : esc(err.message)
    }</p>`;
    return;
  }
  render(data);
}

function render({ rows, orphanSales, emailOn, stripeOn, lastSaleAt }) {
  const t = rows.reduce(
    (a, r) => ({ clicks: a.clicks + r.clicks, sales: a.sales + r.sales, revenue: a.revenue + r.revenueCents, owed: a.owed + Math.max(0, r.owedCents) }),
    { clicks: 0, sales: 0, revenue: 0, owed: 0 },
  );
  const stat = (label, value, accent) =>
    `<div class="card stat${accent ? " accent" : ""}"><span class="value">${esc(value)}</span><span class="label">${esc(label)}</span></div>`;

  const banners = [
    !stripeOn && `Stripe isn't connected yet, so no sales will be counted. See docs/STRIPE.md (or ask Claude: "connect Stripe").`,
    orphanSales > 0 && `${orphanSales} sale${orphanSales === 1 ? "" : "s"} came in with the code of an affiliate you've since removed. They're kept in storage but not shown here.`,
  ].filter(Boolean);

  const table = rows.length
    ? `<div class="table-wrap"><table>
        <thead><tr>
          <th>Affiliate</th><th>Link</th><th class="num">Clicks</th><th class="num">Sales</th>
          <th class="num">Revenue</th><th class="num">Earned</th><th class="num">Paid</th><th class="num">Owed</th><th></th>
        </tr></thead>
        <tbody>${rows.map(row).join("")}</tbody>
      </table></div>`
    : `<p class="muted card">No affiliates yet. Add one above, or share your sign-up page: <a href="/">${esc(location.origin)}/</a></p>`;

  app.innerHTML = `
    <div class="stack">
      <header>
        <h1>Affiliates</h1>
        <p class="muted">${rows.length} affiliate${rows.length === 1 ? "" : "s"} ·
          sign-ups are ${cfg.signup?.open ? `open at ${cfg.signup.commissionPct}%` : "closed"} ·
          welcome email ${emailOn ? "on" : "off"}${lastSaleAt ? ` · last sale ${date(lastSaleAt)}` : ""}</p>
      </header>
      ${banners.map((b) => `<p class="banner">${esc(b)}</p>`).join("")}

      <section class="grid">
        ${stat("clicks", t.clicks)}
        ${stat("sales", t.sales)}
        ${stat("revenue from affiliates", money(t.revenue, cfg))}
        ${stat("commission owed", money(t.owed, cfg), true)}
      </section>

      <section>
        <h2>Leaderboard</h2>
        ${table}
        <p class="small"><a href="#" id="csv">Download as a spreadsheet</a></p>
      </section>

      <section>
        <h2>Add an affiliate</h2>
        <form id="add" class="card">
          <div class="two">
            <label>Name<input name="name" required></label>
            <label>Email<input name="email" type="email" required></label>
            <label>Code <span class="hint">the end of their link</span><input name="code" required autocapitalize="none" spellcheck="false"></label>
            <label>Commission %<input name="commissionPct" type="number" min="0" max="100" step="0.5" value="${cfg.signup?.commissionPct ?? 10}" required></label>
          </div>
          ${emailOn ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" name="sendEmail" checked style="width:auto"> Email them their link</label>` : ""}
          <p class="error" id="add-err" hidden></p>
          <div><button type="submit">Add affiliate</button></div>
        </form>
      </section>
    </div>`;

  wireCopyButtons();
  wireActions(rows, emailOn);
}

function row(r) {
  return `<tr>
    <td><strong>${esc(r.name)}</strong><br><a class="small" href="mailto:${esc(r.email)}">${esc(r.email)}</a>
      <br><span class="muted small">${r.commissionPct}%${r.socials ? ` · ${esc(r.socials)}` : ""}</span></td>
    <td><code class="small">/go/${esc(r.code)}</code><br><button type="button" class="quiet small" data-copy="${esc(r.link)}">Copy</button></td>
    <td class="num">${r.clicks}</td>
    <td class="num">${r.sales}</td>
    <td class="num">${money(r.revenueCents, cfg)}</td>
    <td class="num">${money(r.earnedCents, cfg)}</td>
    <td class="num">${money(r.paidCents, cfg)}${r.lastPaidAt ? `<br><span class="muted small">${date(r.lastPaidAt)}</span>` : ""}</td>
    <td class="num"><strong>${money(r.owedCents, cfg)}</strong></td>
    <td><div class="actions">
      <a class="button quiet small" href="${esc(r.statsLink)}" target="_blank" rel="noopener noreferrer">Their stats</a>
      <button type="button" class="small" data-act="payout" data-code="${esc(r.code)}">Record payout</button>
      <button type="button" class="quiet small" data-act="rate" data-code="${esc(r.code)}">Change rate</button>
      <button type="button" class="quiet small" data-act="resend" data-code="${esc(r.code)}">Resend email</button>
      <button type="button" class="quiet small" data-act="delete" data-code="${esc(r.code)}" title="Remove">Remove</button>
    </div></td>
  </tr>`;
}

function wireActions(rows, emailOn) {
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));

  app.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const r = byCode[btn.dataset.code];
      try {
        if (btn.dataset.act === "payout") {
          const suggested = (Math.max(0, r.owedCents) / 100).toFixed(2);
          const entered = prompt(`How much did you pay ${r.name}? (${cfg.money?.currency ?? ""})`, suggested);
          if (entered === null) return;
          const amountCents = Math.round(Number(entered.replace(/[^0-9.]/g, "")) * 100);
          if (!(amountCents > 0)) return alert("Enter an amount, like 74.50");
          const note = prompt("A note for your records (optional), e.g. 'bank transfer, invoice 12'", "") ?? "";
          btn.disabled = true;
          await api("POST", { action: "payout", code: r.code, amountCents, note });
        }
        if (btn.dataset.act === "rate") {
          const entered = prompt(`New commission % for ${r.name}? (now ${r.commissionPct}%). Past sales keep the rate they were made at.`, r.commissionPct);
          if (entered === null) return;
          btn.disabled = true;
          await api("POST", { action: "rate", code: r.code, commissionPct: Number(entered) });
        }
        if (btn.dataset.act === "resend") {
          if (!emailOn) return alert("Email isn't turned on yet. See docs/GO-LIVE.md, or copy their links from 'Their stats'.");
          if (!confirm(`Email ${r.name} their link and stats page again?`)) return;
          btn.disabled = true;
          const out = await api("POST", { action: "resend", code: r.code });
          alert(`Sent to ${out.sentTo}`);
        }
        if (btn.dataset.act === "delete") {
          if (!confirm(`Remove ${r.name}? Their link will stop earning commission. You can't undo this.`)) return;
          btn.disabled = true;
          await api("POST", { action: "delete", code: r.code });
        }
        await load();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    }),
  );

  const form = document.getElementById("add");
  let codeTouched = false;
  form.elements.name.addEventListener("input", () => {
    if (!codeTouched) form.elements.code.value = slug(form.elements.name.value);
  });
  form.elements.code.addEventListener("input", () => (codeTouched = true));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("add-err");
    err.hidden = true;
    const f = form.elements;
    try {
      const out = await api("POST", {
        action: "add",
        name: f.name.value,
        email: f.email.value,
        code: f.code.value,
        commissionPct: Number(f.commissionPct.value),
        sendEmail: Boolean(f.sendEmail?.checked),
      });
      if (f.sendEmail?.checked && !out.emailed) alert("Added, but the welcome email didn't send. Check your email settings, then use 'Resend email'.");
      await load();
    } catch (error) {
      err.textContent = error.message;
      err.hidden = false;
    }
  });

  // The spreadsheet needs the admin key too, so fetch it and save it as a file.
  document.getElementById("csv").addEventListener("click", async (e) => {
    e.preventDefault();
    const res = await fetch("/api/admin?action=csv", { headers: { "x-admin-key": key } });
    if (!res.ok) return alert("Couldn't download it.");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: `affiliates-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  });
}

load();
