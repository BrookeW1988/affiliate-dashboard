// Bits every page shares: load the settings, apply your colours and fonts,
// format money and dates, and copy-to-clipboard buttons.

export async function loadSettings() {
  const res = await fetch("/affiliates.config.json", { cache: "no-store" });
  const cfg = await res.json();
  applyLook(cfg);
  return cfg;
}

function applyLook(cfg) {
  const c = cfg.look?.colours ?? {};
  const root = document.documentElement.style;
  const map = { background: "--bg", card: "--card", text: "--text", muted: "--muted", accent: "--accent", accentText: "--accent-text", line: "--line" };
  for (const [key, cssVar] of Object.entries(map)) if (c[key]) root.setProperty(cssVar, c[key]);

  // Google Fonts: load whichever two fonts the settings name.
  const fonts = [cfg.look?.fonts?.headings, cfg.look?.fonts?.body].filter(Boolean);
  if (fonts.length) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fonts
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`)
      .join("&")}&display=swap`;
    document.head.append(link);
    if (cfg.look.fonts.headings) root.setProperty("--font-head", `"${cfg.look.fonts.headings}", Georgia, serif`);
    if (cfg.look.fonts.body) root.setProperty("--font-body", `"${cfg.look.fonts.body}", system-ui, sans-serif`);
  }
}

/** Fill {pct}, {name} etc. in a line of words from the settings. */
export function fill(text, values) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m));
}

export function money(cents, cfg) {
  const { currency = "AUD", locale = "en-AU" } = cfg.money ?? {};
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format((cents ?? 0) / 100);
}

/** DD/MM/YYYY */
export function date(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Any button with data-copy="text" copies that text when tapped. */
export function wireCopyButtons(root = document) {
  root.querySelectorAll("[data-copy]").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", async () => {
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = "Copied";
      } catch {
        btn.textContent = "Select and copy";
      }
      setTimeout(() => (btn.textContent = label), 1600);
    });
  });
}

export function logoHtml(cfg) {
  return cfg.business?.logo ? `<img class="logo" src="${esc(cfg.business.logo)}" alt="${esc(cfg.business.name)}">` : "";
}
