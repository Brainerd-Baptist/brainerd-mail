import { renderEmail, renderPlainText, type RenderOpts } from "./render";
import type { EmailDoc } from "./blocks";
import { CHURCH_ADDRESS, CONTACT_EMAIL } from "./church";
import { siteUrl } from "./site";
import { supabaseAdmin } from "./supabase/admin";

type Admin = ReturnType<typeof supabaseAdmin>;
export const linkKey = (blockId: string, label: string, url: string) => `${blockId}|${label}|${url}`;
const countable = (url: string) => /^https?:\/\//i.test(url);

// Finds every link in the email (buttons and footer links) so each can be counted on its own.
export function collectLinks(doc: EmailDoc, base: Omit<RenderOpts, "wrap">) {
  const found = new Map<string, { block_id: string; label: string; url: string }>();
  renderEmail(doc, { ...base, wrap: (url, id, label) => {
    if (countable(url) && !id.startsWith("footer-")) found.set(linkKey(id, label, url), { block_id: id, label, url });
    return url;
  } });
  return [...found.values()];
}

// Saves the links to the database and returns their ids, keyed by linkKey().
export async function syncLinks(admin: Admin, emailId: string, doc: EmailDoc, base: Omit<RenderOpts, "wrap">) {
  const links = collectLinks(doc, base);
  const map = new Map<string, string>();
  if (!links.length) return map;
  const { data, error } = await admin.from("links")
    .upsert(links.map((l) => ({ ...l, email_id: emailId })), { onConflict: "email_id,block_id,label,url" })
    .select("id,block_id,label,url");
  if (error) throw new Error("Could not save links: " + error.message);
  for (const r of data ?? []) map.set(linkKey(r.block_id, r.label, r.url), r.id);
  return map;
}

// Renders the email for one person: counted links, and their own unsubscribe link.
export function renderFor(doc: EmailDoc, linkIds: Map<string, string>, token: string, webSlug: string, mode: "email" | "web" = "email") {
  const site = siteUrl();
  const opts: RenderOpts = {
    mode, siteUrl: site, address: CHURCH_ADDRESS, contactEmail: CONTACT_EMAIL, issueSlug: webSlug,
    webUrl: `${site}/w/${webSlug}`,
    unsubscribeUrl: `${site}/u/${token}`,
    preferencesUrl: `${site}/u/${token}`,
    wrap: (url, id, label) => {
      const lid = linkIds.get(linkKey(id, label, url));
      return lid && countable(url) ? `${site}/r/${token}/${lid}` : url;
    },
  };
  return { html: renderEmail(doc, opts), text: renderPlainText(doc, opts), unsubscribeUrl: opts.unsubscribeUrl };
}

export const BOT_UA = /(proofpoint|mimecast|barracuda|trendmicro|symantec|messagelabs|forcepoint|ironport|bot\b|crawler|spider|preview|scanner|headless|python-requests|curl\/)/i;
export const deviceOf = (ua: string) => (/ipad|tablet/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "phone" : "desktop");
