// The public sign-up page: how it works, the form, then their link on screen.

import { esc, fill, loadSettings, logoHtml, wireCopyButtons } from "./common.js";

const app = document.getElementById("app");
const cfg = await loadSettings();
const words = cfg.words ?? {};
const pct = cfg.signup?.commissionPct ?? 0;
const vals = { pct, business: cfg.business?.name ?? "" };
document.title = `${fill(words.joinTitle, vals)} · ${cfg.business?.name ?? ""}`;

const steps = (words.steps ?? [])
  .map(
    (s, i) => `<div class="card step">
      <div class="num">0${i + 1}</div>
      <h3>${esc(fill(s.title, vals))}</h3>
      <p class="muted small">${esc(fill(s.text, vals))}</p>
    </div>`,
  )
  .join("");

const form = cfg.signup?.open
  ? `<form id="join" class="card" novalidate>
      <h2>Get your link</h2>
      <div class="two">
        <label>Your name<input name="name" autocomplete="name" required></label>
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
      </div>
      <label>Your code <span class="hint">The end of your link. Lowercase letters, numbers and hyphens.</span>
        <input name="code" required autocapitalize="none" spellcheck="false" maxlength="40">
      </label>
      <p class="muted small" id="preview"></p>
      <label>Instagram or website <span class="hint">Optional, so we know who you are.</span>
        <input name="socials" maxlength="200">
      </label>
      <label class="trap" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="error" id="err" hidden></p>
      <div><button type="submit">Sign me up</button></div>
      <p class="muted small">${esc(words.payoutTerms)}</p>
    </form>`
  : `<div class="card"><p>${esc(words.closedMessage)}</p></div>`;

app.innerHTML = `
  <div class="stack">
    <header class="centre">
      ${logoHtml(cfg)}
      <h1>${esc(fill(words.joinTitle, vals))}</h1>
      <p class="muted">${esc(fill(words.joinIntro, vals))}</p>
    </header>
    <section class="grid">${steps}</section>
    <section id="form-area">${form}</section>
  </div>`;

const el = document.getElementById("join");
if (el) {
  const nameIn = el.elements.name;
  const codeIn = el.elements.code;
  const preview = document.getElementById("preview");
  let codeTouched = false;

  const slug = (v) =>
    v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const showPreview = () => (preview.textContent = `Your link will be ${location.origin}/go/${codeIn.value || "your-code"}`);

  // Suggest a code from their name until they type their own.
  nameIn.addEventListener("input", () => {
    if (!codeTouched) codeIn.value = slug(nameIn.value);
    showPreview();
  });
  codeIn.addEventListener("input", () => {
    codeTouched = true;
    codeIn.value = codeIn.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    showPreview();
  });
  showPreview();

  el.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("err");
    const btn = el.querySelector("button");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Signing you up…";
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(el))),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error(data.error ?? "Something went wrong. Try again.");
      showDone(data);
    } catch (error) {
      err.textContent = error.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Sign me up";
    }
  });
}

function showDone(data) {
  document.getElementById("form-area").innerHTML = `
    <div class="card stack">
      <div>
        <h2>You're in!</h2>
        <p>You earn <strong>${data.commissionPct}%</strong> of every sale through your link.
        ${data.emailed ? "We've emailed you these links too." : "Save these two links somewhere safe."}</p>
      </div>
      <div>
        <h3>Your link (share this one)</h3>
        <div class="copy-row"><code>${esc(data.link)}</code><button type="button" data-copy="${esc(data.link)}">Copy</button></div>
      </div>
      <div>
        <h3>Your private stats page (bookmark it, don't share it)</h3>
        <div class="copy-row"><code>${esc(data.statsLink)}</code><a class="button quiet" href="${esc(data.statsLink)}">Open</a></div>
      </div>
    </div>`;
  wireCopyButtons();
}
