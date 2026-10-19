import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncLinks, renderFor, BOT_UA, deviceOf } from "@/lib/tracking";
import { siteUrl } from "@/lib/site";
import { CHURCH_ADDRESS, CONTACT_EMAIL } from "@/lib/church";
import type { EmailDoc } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// The web version of an email, opened from "View in browser" and from text messages.
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const notFound = new Response("This email isn't available.", { status: 404, headers: { "content-type": "text/plain" } });
  if (!/^[0-9a-f]{12}$/.test(params.slug)) return notFound;
  const admin = supabaseAdmin();
  const { data: email } = await admin.from("emails").select("id,doc,status,slug").eq("slug", params.slug).maybeSingle();
  if (!email || email.status === "cancelled") return notFound;

  const doc = email.doc as EmailDoc;
  const base = { mode: "web" as const, siteUrl: siteUrl(), address: CHURCH_ADDRESS, contactEmail: CONTACT_EMAIL,
    issueSlug: params.slug, webUrl: `${siteUrl()}/w/${params.slug}`, unsubscribeUrl: `${siteUrl()}/u/web`, preferencesUrl: `${siteUrl()}/u/web` };
  const linkIds = await syncLinks(admin, email.id, doc, base);
  const { html } = renderFor(doc, linkIds, "web", params.slug, "web");
  try {
    const ua = req.headers.get("user-agent") ?? "";
    await admin.from("web_views").insert({ email_id: email.id, device: deviceOf(ua), is_bot: BOT_UA.test(ua) });
  } catch {}
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
