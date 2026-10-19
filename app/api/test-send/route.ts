import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runChecks } from "@/lib/checks";
import { renderFor, syncLinks } from "@/lib/tracking";
import { sendEmail } from "@/lib/resend";
import { siteUrl } from "@/lib/site";
import { CHURCH_ADDRESS, CONTACT_EMAIL } from "@/lib/church";
import { snapshot } from "@/lib/versions";
import { meFor } from "@/lib/roles";
import type { EmailDoc } from "@/lib/blocks";

// "Send me a test": goes only to the signed-in staff member's own address.
// Uses the same tracked links and unsubscribe link a real send would.
export async function POST(req: Request) {
  const { data } = await supabaseServer().auth.getUser();
  const user = data.user;
  if (!user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!(await meFor(user.id))) return NextResponse.json({ error: "Your access to Brainerd Mail has changed." }, { status: 403 });
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: "Test sending isn't switched on yet (missing server keys)." }, { status: 501 });

  const body = await req.json().catch(() => ({}));
  const doc = body.doc as EmailDoc | undefined;
  // Who gets it: you (unless unticked) plus up to 9 more, picked from the team or typed. Validated here, not just in the screen.
  const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  const extra: string[] = Array.isArray(body.extra) ? body.extra.map((x: unknown) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  if (extra.some((x) => !EMAIL_RE.test(x))) return NextResponse.json({ error: "One of those email addresses isn't valid." }, { status: 400 });
  const includeMe = body.includeMe !== false;
  const targets = Array.from(new Set([...(includeMe ? [user.email.toLowerCase()] : []), ...extra]));
  if (!targets.length) return NextResponse.json({ error: "Choose at least one person." }, { status: 400 });
  if (targets.length > 10) return NextResponse.json({ error: "Tests can go to 10 people at a time." }, { status: 400 });
  if (!doc?.blocks || !doc.subject) return NextResponse.json({ error: "Nothing to send" }, { status: 400 });
  const preview = renderFor(doc, new Map(), "preview", "000000000000");
  if (runChecks(doc, Buffer.byteLength(preview.html), CHURCH_ADDRESS).some((c) => !c.ok && c.severity === "block"))
    return NextResponse.json({ error: "Fix the items marked in Check first." }, { status: 422 });

  try {
    const admin = supabaseAdmin();
    let emailId: string | undefined = body.emailId;
    let slug = "";
    let version = "";
    if (emailId) {
      const { data: row } = await admin.from("emails").update({ doc, title: doc.title, ministry: doc.ministry, updated_at: new Date().toISOString() }).eq("id", emailId).select("id,slug,updated_at").maybeSingle();
      if (row) { slug = row.slug; version = row.updated_at; } else emailId = undefined;
    }
    if (!emailId) {
      const { data: row, error } = await admin.from("emails").insert({ ministry: doc.ministry, title: doc.title || "Untitled", doc, created_by: user.id }).select("id,slug,updated_at").single();
      if (error || !row) throw new Error("Could not save the draft");
      emailId = row.id; slug = row.slug; version = row.updated_at;
    }

    await snapshot(admin, emailId!, doc, user.id, "Test sent", 5);
    const site = siteUrl();
    const base = { mode: "email" as const, siteUrl: site, address: CHURCH_ADDRESS, contactEmail: CONTACT_EMAIL, issueSlug: slug,
      webUrl: `${site}/w/${slug}`, unsubscribeUrl: `${site}/u/x`, preferencesUrl: `${site}/u/x` };
    const linkIds = await syncLinks(admin, emailId!, doc, base);

    const { data: send } = await admin.from("sends").insert({ email_id: emailId, kind: "test", channel: "email", counts: { to: targets.length } }).select("id").single();
    const stampNow = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
    const sent: string[] = [], failed: string[] = [];
    for (const to of targets) {
      try {
        const { data: rcpt } = await admin.from("recipients").insert({ send_id: send!.id, email: to, channel: "email" }).select("token,id").single();
        const out = renderFor(doc, linkIds, rcpt!.token, slug);
        await sendEmail({ to, subject: `[TEST ${stampNow}] ${doc.subject}`, html: out.html, text: out.text, unsubscribeUrl: out.unsubscribeUrl });
        await admin.from("recipients").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", rcpt!.id);
        sent.push(to);
      } catch { failed.push(to); }
    }
    await admin.from("sends").update({ finished_at: new Date().toISOString() }).eq("id", send!.id);
    await admin.from("audit_log").insert({ actor: user.id, action: "test_send", email_id: emailId, detail: { to: sent, failed } });
    if (!sent.length) throw new Error("The test couldn't be sent. Please try again.");
    return NextResponse.json({ ok: true, to: sent.length === 1 ? sent[0] : `${sent.length} people`, sent, failed, emailId, version, webUrl: `${site}/w/${slug}` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Test send failed" }, { status: 502 });
  }
}
