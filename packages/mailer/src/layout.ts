/** Minimal, client-safe HTML e-mail layout (tables + inline styles). */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailBlock =
  | { kind: "p"; text: string }
  | { kind: "button"; label: string; href: string }
  | { kind: "kv"; rows: Array<[string, string]> }
  | { kind: "muted"; text: string };

export function renderEmail(opts: {
  preheader: string;
  heading: string;
  blocks: EmailBlock[];
}): { html: string; text: string } {
  const body = opts.blocks
    .map((b) => {
      switch (b.kind) {
        case "p":
          return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#1B2A4A">${escapeHtml(b.text)}</p>`;
        case "muted":
          return `<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#5B6576">${escapeHtml(b.text)}</p>`;
        case "button":
          return `<p style="margin:24px 0"><a href="${escapeHtml(b.href)}" style="display:inline-block;background:#1B2A4A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">${escapeHtml(b.label)}</a></p>`;
        case "kv":
          return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border:1px solid #E7E2D8;border-radius:8px">${b.rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:10px 14px;font-size:13px;color:#5B6576;width:40%;border-bottom:1px solid #F1EDE5">${escapeHtml(k)}</td><td style="padding:10px 14px;font-size:14px;color:#1B2A4A;border-bottom:1px solid #F1EDE5">${escapeHtml(v)}</td></tr>`,
            )
            .join("")}</table>`;
      }
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px;font-family:Georgia,'Source Serif 4',serif;font-size:20px;color:#1B2A4A;font-weight:600">Kanso</td></tr>
<tr><td style="background:#ffffff;border:1px solid #E7E2D8;border-radius:12px;padding:32px">
<h1 style="margin:0 0 20px;font-family:Georgia,'Source Serif 4',serif;font-size:22px;line-height:30px;color:#1B2A4A;font-weight:600">${escapeHtml(opts.heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 4px;font-size:12px;line-height:18px;color:#8A93A3">Kanso — assistants pour cabinets, hébergés dans l'Union européenne.<br>Vous recevez cet e-mail en lien avec votre compte Kanso.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    opts.heading,
    "",
    ...opts.blocks.map((b) => {
      switch (b.kind) {
        case "p":
        case "muted":
          return b.text;
        case "button":
          return `${b.label} : ${b.href}`;
        case "kv":
          return b.rows.map(([k, v]) => `${k} : ${v}`).join("\n");
      }
    }),
    "",
    "— Kanso",
  ].join("\n");

  return { html, text };
}
