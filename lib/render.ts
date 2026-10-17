// Turns an EmailDoc into email-safe HTML (tables, inline styles, Outlook
// button fallbacks, phone and dark-mode rules) and a plain-text version.
// The same function renders the hosted web version (mode "web"), which
// adds the interactive extras email can't do.

import type { Block, EmailDoc, Btn, Img } from "./blocks";
import { paletteFor, type Palette } from "./ministries";

export type RenderOpts = {
  mode: "email" | "web";
  // Wraps every outgoing link so clicks can be counted. In previews it just returns the url.
  wrap: (url: string, linkId: string, label: string) => string;
  webUrl?: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  address: string;
  contactEmail?: string;
  siteUrl?: string; // for relative sample images and the web "I'm praying" call
  issueSlug?: string;
  editable?: boolean; // adds data-bid so the editor preview can select blocks
};

const SERIF = `'Source Serif 4',Georgia,'Times New Roman',serif`;
const SANS = `Barlow,'Helvetica Neue',Helvetica,Arial,sans-serif`;

export function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(body: string, color: string, size = 16, cls = "dm-text"): string {
  return (body ?? "")
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(
      (t) =>
        `<p class="${cls}" style="margin:0 0 14px 0;font-family:${SANS};font-size:${size}px;line-height:1.6;color:${color};">${esc(t).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function eyebrow(text: string, color: string): string {
  if (!text) return "";
  return `<div style="font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.14em;color:${color};text-transform:uppercase;margin:0 0 10px 0;">${esc(text)}</div>`;
}

function bullets(items: string[], title = "PRAY FOR", color: string, accent: string): string {
  const list = items.map((i) => i.trim()).filter(Boolean);
  if (!list.length) return "";
  return `<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.14em;color:${accent};margin:6px 0 8px 0;">${esc(title)}</div>
<ul class="dm-text" style="margin:0 0 6px 0;padding-left:20px;font-family:${SANS};font-size:15px;line-height:1.55;color:${color};">${list
    .map((i) => `<li style="margin:0 0 4px 0;">${esc(i)}</li>`)
    .join("")}</ul>`;
}

type BtnKind = "primary" | "secondary" | "onDark";

function button(b: Btn | undefined, kind: BtnKind, p: Palette, o: RenderOpts, linkId: string, full = false): string {
  if (!b || !b.label || !b.url) return "";
  const href = esc(o.wrap(b.url, linkId, b.label));
  const h = kind === "secondary" ? 44 : 48;
  const w = Math.min(420, Math.max(150, b.label.length * 10 + 64));
  let bg = p.button, fg = p.btnText, border = p.button;
  if (kind === "secondary") { bg = "#ffffff"; fg = p.dark; border = p.dark; }
  if (kind === "onDark") { bg = p.tint; fg = p.dark; border = p.tint; }
  const style = `display:inline-block;box-sizing:border-box;min-height:${h}px;line-height:${h - 4}px;padding:0 28px;border-radius:999px;background:${bg};border:2px solid ${border};color:${fg};font-family:${SANS};font-size:${kind === "secondary" ? 15 : 16}px;font-weight:600;letter-spacing:0.04em;text-decoration:none;text-align:center;`;
  return `<div class="btn-wrap" style="margin:6px 0 0 0;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:${h}px;v-text-anchor:middle;width:${w}px;" arcsize="50%" strokecolor="${border}" strokeweight="2px" fillcolor="${bg}"><w:anchorlock/><center style="color:${fg};font-family:Arial,sans-serif;font-size:15px;font-weight:600;">${esc(b.label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a class="btn${full ? " btn-full" : ""}" href="${href}" style="${style}">${esc(b.label)}</a><!--<![endif]-->
</div>`;
}

// The real Brainerd logo (white version, for the dark header and footer).
// Must be a full https address so email apps can load it.
function logo(o: RenderOpts, w: number, key: string): string {
  const base = (o.siteUrl || "https://mail.brainerdhq.app").replace(/\/+$/, "");
  const h = Math.round((w * 130) / 560);
  return `<img src="${esc(base)}/brand/logo-${esc(key)}.png" alt="Brainerd Baptist Church" width="${w}" height="${h}" style="display:inline-block;vertical-align:middle;width:${w}px;height:${h}px;border:0;outline:none;text-decoration:none;">`;
}

function image(img: Img | undefined, o: RenderOpts, style = "width:100%;height:auto;display:block;border:0;"): string {
  if (!img?.url) return "";
  const src = img.url.startsWith("/") && o.siteUrl ? o.siteUrl.replace(/\/+$/, "") + img.url : img.url;
  return `<img src="${esc(src)}" alt="${esc(img.alt)}" width="100%" style="${style}">`;
}

function section(inner: string, pad = "32px 40px 8px 40px"): string {
  return `<tr><td class="px" style="padding:${pad};">${inner}</td></tr>`;
}

function renderBlock(b: Block, p: Palette, o: RenderOpts): string {
  switch (b.type) {
    case "hero": {
      const img = b.showImage ? image(b.image, o, "width:100%;height:auto;display:block;border:0;border-radius:12px;") : "";
      return `<tr><td class="px" style="background:${p.dark};background-image:linear-gradient(${p.dark},${p.dark});padding:28px 40px 40px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.16em;color:${p.soft};">${logo(o, 150, p.key)}${p.name === "BRAINERD" ? "" : `<span class="hdr-label" style="display:inline-block;vertical-align:middle;margin-left:14px;padding-left:14px;border-left:1px solid ${p.soft};line-height:30px;">${esc(p.label.toUpperCase())}</span>`}</td>
<td align="right" style="font-family:${SANS};font-size:13px;font-weight:600;letter-spacing:0.14em;color:${p.soft};">${esc(b.eyebrow)}</td>
</tr></table>
<h1 class="h1" style="margin:28px 0 14px 0;font-family:${SERIF};font-weight:700;font-size:42px;line-height:1.1;color:#f6faf8;">${esc(b.headline)}</h1>
${b.body ? `<p style="margin:0 0 20px 0;font-family:${SANS};font-size:18px;line-height:1.55;color:${p.soft};max-width:500px;">${esc(b.body)}</p>` : ""}
${img ? `<div style="margin:0 0 20px 0;">${img}</div>` : ""}
${button(b.button, "onDark", p, o, b.id)}
</td></tr>`;
    }
    case "text":
      return section(
        `${b.heading ? `<h2 class="dm-head" style="margin:0 0 12px 0;font-family:${SERIF};font-weight:600;font-size:24px;line-height:1.2;color:${p.dark};">${esc(b.heading)}</h2>` : ""}${paragraphs(b.body, "#33445d")}`
      );
    case "travel": {
      const cardOf = (t: (typeof b.teams)[number]) => `<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" class="dm-card" style="border:1px solid #dbe3ec;border-radius:12px;height:100%;"><tr><td valign="top" style="padding:24px;">
<h3 class="dm-head" style="margin:0 0 12px 0;font-family:${SERIF};font-weight:600;font-size:22px;line-height:1.2;color:${p.dark};">${esc(t.name)}</h3>
<div style="margin:0 0 14px 0;"><span style="display:inline-block;background:${p.tint};color:${p.dark};border-radius:999px;padding:6px 12px;font-family:${SANS};font-size:13px;font-weight:600;margin:0 6px 6px 0;">${esc(t.dates)}</span>${t.places ? `<span style="display:inline-block;background:${p.tint};color:${p.dark};border-radius:999px;padding:6px 12px;font-family:${SANS};font-size:13px;font-weight:600;margin:0 6px 6px 0;">${esc(t.places)}</span>` : ""}</div>
${bullets(t.prayer, "PRAY FOR", "#33445d", p.button)}
${o.mode === "web" ? `<div style="margin-top:14px;"><a href="#" class="pray" data-team="${esc(t.id)}" style="display:inline-block;min-height:44px;line-height:40px;padding:0 24px;border-radius:999px;background:${p.button};border:2px solid ${p.button};color:${p.btnText};font-family:${SANS};font-size:15px;font-weight:600;text-decoration:none;">I'm praying</a> <span class="pray-count" data-team="${esc(t.id)}" style="font-family:${SANS};font-size:13px;color:#5b6b80;margin-left:8px;"></span></div>` : ""}
</td></tr></table>`;
      const rows: string[] = [];
      if (b.layout === "stacked") {
        b.teams.forEach((t) => rows.push(`<tr><td style="padding:0 0 16px 0;">${cardOf(t)}</td></tr>`));
      } else {
        for (let i = 0; i < b.teams.length; i += 2) {
          const a = b.teams[i], c = b.teams[i + 1];
          rows.push(`<tr><td class="stack" valign="top" width="${c ? "50%" : "100%"}" style="padding:0 ${c ? "8px" : "0"} 16px 0;">${cardOf(a)}</td>${c ? `<td class="stack" valign="top" width="50%" style="padding:0 0 16px 8px;">${cardOf(c)}</td>` : ""}</tr>`);
        }
      }
      return section(
        `${eyebrow(b.heading, p.button)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>`,
        "40px 40px 0 40px"
      );
    }
    case "partners": {
      const items = b.items.map((it) => {
        const img = b.showImages && it.image?.url ? image(it.image, o, "width:100%;height:100%;min-height:200px;object-fit:cover;display:block;border:0;") : "";
        const text = `${eyebrow(it.label, p.button)}<h3 class="dm-head" style="margin:0 0 10px 0;font-family:${SERIF};font-weight:600;font-size:22px;line-height:1.2;color:${p.dark};">${esc(it.heading)}</h3>${paragraphs(it.body, "#33445d", 15)}${bullets(it.prayer, "PRAYER REQUESTS", "#33445d", p.button)}${button(it.button, "secondary", p, o, it.id)}`;
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dm-card" style="border:1px solid #dbe3ec;border-radius:12px;overflow:hidden;margin:0 0 16px 0;"><tr>
${img ? `<td class="stack" width="180" valign="top" style="width:180px;">${img}</td>` : ""}
<td class="stack" valign="top" style="padding:24px;">${text}</td></tr></table>`;
      });
      return section(`${eyebrow(b.heading, p.button)}${items.join("")}`, "24px 40px 0 40px");
    }
    case "cta":
      return section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="dm-panel" style="background:${p.tint};border-radius:12px;padding:32px;">
<h2 class="dm-head" style="margin:0 0 12px 0;font-family:${SERIF};font-weight:600;font-size:28px;line-height:1.2;color:${p.dark};">${esc(b.heading)}</h2>
${paragraphs(b.body, "#33445d")}
${button(b.button, "primary", p, o, b.id)}
${b.note ? `<p class="dm-muted" style="margin:14px 0 0 0;font-family:${SANS};font-size:14px;color:#33445d;">${esc(b.note)}</p>` : ""}
</td></tr></table>`,
        "24px 40px 8px 40px"
      );
    case "card":
      return section(
        `<h3 class="dm-head" style="margin:0 0 10px 0;font-family:${SERIF};font-weight:600;font-size:22px;line-height:1.2;color:${p.dark};">${esc(b.heading)}</h3>${paragraphs(b.body, "#33445d")}${button(b.button, "secondary", p, o, b.id)}`,
        "24px 40px 24px 40px"
      );
    case "photo":
      return section(
        `${image(b.image, o, "width:100%;height:auto;display:block;border:0;border-radius:12px;")}${b.caption ? `<p class="dm-muted" style="margin:10px 0 0 0;font-family:${SANS};font-size:14px;color:#5b6b80;">${esc(b.caption)}</p>` : ""}`,
        "24px 40px 8px 40px"
      );
    case "event":
      return section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dm-card" style="border:1px solid #dbe3ec;border-radius:12px;"><tr><td style="padding:24px;">
${eyebrow(b.eyebrow, p.button)}
<h3 class="dm-head" style="margin:0 0 10px 0;font-family:${SERIF};font-weight:600;font-size:22px;line-height:1.2;color:${p.dark};">${esc(b.title)}</h3>
${paragraphs(b.body, "#33445d", 15)}
<div style="margin:0 0 14px 0;">${b.date ? `<span style="display:inline-block;background:${p.tint};color:${p.dark};border-radius:999px;padding:6px 12px;font-family:${SANS};font-size:13px;font-weight:600;margin:0 6px 6px 0;">${esc(b.date)}</span>` : ""}${b.place ? `<span style="display:inline-block;background:${p.tint};color:${p.dark};border-radius:999px;padding:6px 12px;font-family:${SANS};font-size:13px;font-weight:600;margin:0 6px 6px 0;">${esc(b.place)}</span>` : ""}</div>
${button(b.button, "primary", p, o, b.id)}
</td></tr></table>`,
        "24px 40px 8px 40px"
      );
    case "divider":
      return section(`<div style="height:1px;background:#dbe3ec;line-height:1px;font-size:1px;">&nbsp;</div>`, "24px 40px 8px 40px");
  }
}

export function renderEmail(doc: EmailDoc, o: RenderOpts): string {
  const p = paletteFor(doc.ministry);
  const blocks = doc.blocks
    .filter((b) => !b.hidden)
    .map((b) => {
      const html = renderBlock(b, p, o);
      return o.editable ? html.replace(/^<tr>/, `<tr data-bid="${b.id}">`) : html;
    })
    .join("\n");
  const footerLink = (url: string, label: string, id: string) =>
    `<a href="${esc(o.wrap(url, id, label))}" style="color:#f6faf8;text-decoration:underline;font-family:${SANS};font-size:14px;font-weight:600;margin-right:20px;">${esc(label)}</a>`;
  const links = [
    o.mode === "email" && o.webUrl ? footerLink(o.webUrl, "View in browser", "footer-web") : "",
    footerLink(o.preferencesUrl, "Manage preferences", "footer-prefs"),
    footerLink(o.unsubscribeUrl, "Unsubscribe", "footer-unsub"),
  ].join("");
  const preview = doc.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(doc.previewText)}${"&nbsp;&zwnj;".repeat(60)}</div>`
    : "";
  const webScript =
    o.mode === "web"
      ? `<script>(function(){var s=${JSON.stringify(o.issueSlug ?? "")};function load(){fetch("/api/pray?issue="+encodeURIComponent(s)).then(function(r){return r.json()}).then(function(d){document.querySelectorAll(".pray-count").forEach(function(e){var n=(d.counts||{})[e.getAttribute("data-team")]||0;e.textContent=n?n+" praying":""})}).catch(function(){})}load();document.querySelectorAll(".pray").forEach(function(a){a.addEventListener("click",function(ev){ev.preventDefault();var t=a.getAttribute("data-team");fetch("/api/pray",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({issue:s,team:t})}).then(load);a.textContent="Thank you";})})})();</script>`
      : "";
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(doc.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap">
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
table{border-collapse:collapse;}
img{-ms-interpolation-mode:bicubic;}
a{color:inherit;}
@media (max-width:620px){.hdr-label{display:block!important;margin:10px 0 0 0!important;padding:0!important;border:0!important;line-height:1.2!important;}
 .px{padding-left:20px!important;padding-right:20px!important;}
 .h1{font-size:32px!important;}
 .stack{display:block!important;width:100%!important;box-sizing:border-box;padding-left:0!important;padding-right:0!important;}
 .btn{display:block!important;width:100%!important;}
 .stack img{max-height:220px!important;height:220px!important;object-fit:cover!important;}
 .wrap{border-radius:0!important;width:100%!important;max-width:100%!important;}
 .outer{padding:0!important;}
}
@media (prefers-color-scheme:dark){
 .dm-bg{background:#0f141b!important;}
 .dm-wrap{background:#17202b!important;}
 .dm-card{background:#1d2836!important;border-color:#33425a!important;}
 .dm-panel{background:#1d2836!important;}
 .dm-head{color:#ffffff!important;}
 .dm-text{color:#d4dce8!important;}
 .dm-muted{color:#a9b6c8!important;}
}
</style>
</head>
<body class="dm-bg" style="margin:0;padding:0;background:#e6ecf2;">
${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dm-bg" style="background:#e6ecf2;"><tr><td align="center" class="outer" style="padding:32px 12px;">
<table role="presentation" class="wrap dm-wrap" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">
${blocks}
<tr><td style="height:32px;line-height:32px;font-size:1px;">&nbsp;</td></tr>
<tr><td class="px" style="background:${p.dark};background-image:linear-gradient(${p.dark},${p.dark});padding:36px 40px;">
<div style="margin:0 0 16px 0;">${logo(o, 150, p.key)}</div>
<p style="margin:0 0 16px 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${p.soft};">${esc(doc.footerNote)}</p>
${o.contactEmail ? `<p style="margin:0 0 14px 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${p.soft};">Questions? Write us at <a href="mailto:${esc(o.contactEmail)}" style="color:#f6faf8;text-decoration:underline;">${esc(o.contactEmail)}</a></p>` : ""}
<div style="margin:0 0 16px 0;">${links}</div>
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${p.soft};">${esc(o.address)}</p>
</td></tr>
</table>
</td></tr></table>
${webScript}
</body>
</html>`;
}

// Plain-text alternative (also used for accessibility and some spam filters).
export function renderPlainText(doc: EmailDoc, o: RenderOpts): string {
  const lines: string[] = [];
  const link = (b?: Btn) => (b && b.url ? `${b.label}: ${b.url}` : "");
  for (const b of doc.blocks.filter((x) => !x.hidden)) {
    switch (b.type) {
      case "hero": lines.push(b.headline, b.body, link(b.button)); break;
      case "text": lines.push(b.heading, b.body); break;
      case "travel": lines.push(b.heading); b.teams.forEach((t) => lines.push(`${t.name} (${t.dates}${t.places ? ", " + t.places : ""})`, ...t.prayer.map((x) => `- ${x}`))); break;
      case "partners": lines.push(b.heading); b.items.forEach((i) => lines.push(i.heading, i.body, ...i.prayer.map((x) => `- ${x}`), link(i.button))); break;
      case "cta": lines.push(b.heading, b.body, link(b.button), b.note); break;
      case "card": lines.push(b.heading, b.body, link(b.button)); break;
      case "photo": lines.push(b.caption); break;
      case "event": lines.push(b.title, b.body, [b.date, b.place].filter(Boolean).join(" · "), link(b.button)); break;
      case "divider": lines.push("----"); break;
    }
    lines.push("");
  }
  lines.push(doc.footerNote, o.contactEmail ? `Questions? ${o.contactEmail}` : "", "", `Manage preferences: ${o.preferencesUrl}`, `Unsubscribe: ${o.unsubscribeUrl}`, o.address);
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}
