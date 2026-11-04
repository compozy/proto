import { createHash } from "node:crypto";

// Plain CSS mirror of the shell tokens (src/shell/theme.css); the page loads nothing else.
const css = `:root{color-scheme:light dark;--bg:oklch(0.97 0.004 340);--dot:oklch(0.86 0.008 340);--card:oklch(1 0 0);--fg:oklch(0.18 0.01 330);--muted:oklch(0.48 0.015 330);--border:oklch(0.91 0.006 340);--primary:oklch(0.57 0.22 354);--primary-text:oklch(0.47 0.2 354);--primary-soft:oklch(0.57 0.22 354 / 12%);--shadow:0 1px 2px oklch(0.18 0.01 330 / 4%),0 12px 32px -12px oklch(0.18 0.01 330 / 12%)}
@media (prefers-color-scheme:dark){:root{--bg:oklch(0.155 0.004 300);--dot:oklch(1 0 0 / 7%);--card:oklch(0.185 0.005 300);--fg:oklch(0.96 0.003 340);--muted:oklch(0.7 0.012 300);--border:oklch(1 0 0 / 8%);--primary:oklch(0.74 0.19 352);--primary-text:oklch(0.74 0.19 352);--primary-soft:oklch(0.74 0.19 352 / 14%);--shadow:0 1px 2px oklch(0 0 0 / 30%),0 16px 40px -16px oklch(0 0 0 / 60%)}}
*{box-sizing:border-box}
html{font-family:"Inter Variable",Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fg);background:var(--bg);-webkit-font-smoothing:antialiased}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;background-image:radial-gradient(var(--dot) 1px,transparent 1px);background-size:20px 20px}
main{width:100%;max-width:420px;padding:40px 36px 32px;background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);text-align:center}
.mark{display:block;width:44px;height:44px;margin:0 auto 24px}
.badge{display:inline-flex;align-items:center;gap:6px;margin:0 0 14px;padding:3px 10px;border-radius:999px;background:var(--primary-soft);color:var(--primary-text);font-size:12px;font-weight:600;letter-spacing:.02em}
.badge svg{width:12px;height:12px}
h1{margin:0 0 10px;font-size:22px;line-height:1.25;font-weight:650;letter-spacing:-.015em}
p{margin:0;font-size:14.5px;line-height:1.6;color:var(--muted);text-wrap:balance}
footer{margin-top:28px;padding-top:18px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}
@media (max-width:480px){body{padding:16px}main{padding:32px 22px 24px}h1{font-size:20px}}`;

const styleHash = createHash("sha256").update(css).digest("base64");

const mark = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect x="0.5" y="0.5" width="63" height="63" rx="14.5" fill="#0b0b0e" stroke="#2c2c33"/><g transform="translate(-2.5 0.5)"><g fill="none" stroke="#fafafa" stroke-width="6.5" stroke-linecap="round"><path d="M19.5 24v27"/><circle cx="29" cy="33" r="9.5"/></g><path d="M40 22v-6.5a6.5 6.5 0 1 1 6.5 6.5z" fill="#ff70b7"/></g></svg>`;
const lock = `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>`;

const copy = {
  en: {
    title: "Access not granted",
    badge: "Invitation required",
    message: "This email was not invited. Ask the person who sent the link.",
    footer: "Shared prototype review",
  },
  "pt-BR": {
    title: "Acesso não concedido",
    badge: "Convite necessário",
    message: "Este e-mail não foi convidado. Peça acesso à pessoa que enviou o link.",
    footer: "Revisão de protótipo compartilhada",
  },
} as const;

/** A signIn callback with no gallery, identity or return URL reflected into the page. */
export function notInvitedPage(locale: "en" | "pt-BR") {
  const text = copy[locale];
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${text.title}</title><style>${css}</style></head><body><main>${mark}<p class="badge">${lock}${text.badge}</p><h1>${text.title}</h1><p>${text.message}</p><footer>${text.footer}</footer></main></body></html>`;
  return (_request: Request, _returnTo: string): Response =>
    new Response(html, {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; style-src 'sha256-${styleHash}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      },
    });
}
