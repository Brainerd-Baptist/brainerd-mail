import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { renderEmail } from "@/lib/render";
import { paletteFor } from "@/lib/ministries";
import { CHURCH_ADDRESS, CONTACT_EMAIL } from "@/lib/church";
import { isAdmin, when } from "@/lib/approval";
import { ReviewActions } from "@/components/ReviewActions";
import type { EmailDoc } from "@/lib/blocks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review | Brainerd Mail" };

const UUID = /^[0-9a-f-]{36}$/i;

// Phone-friendly review screen. Signed-in staff only (middleware.ts); only the approver sees the buttons.
export default async function ReviewPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const { data: row } = await supabaseAdmin().from("emails").select("id,doc,status,title,ministry,expedited,scheduled_at,submitted_at,review_note").eq("id", params.id).maybeSingle();
  if (!row) notFound();
  const { data: u } = await supabaseServer().auth.getUser();
  const admin = isAdmin(u.user?.email);
  const doc = row.doc as EmailDoc;
  const p = paletteFor(row.ministry);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://mail.brainerdhq.app";
  const html = renderEmail(doc, { mode: "email", wrap: (url: string) => url, webUrl: `${origin}/w/preview`, unsubscribeUrl: "#unsubscribe", preferencesUrl: "#preferences", address: CHURCH_ADDRESS, contactEmail: CONTACT_EMAIL, siteUrl: origin });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-mist">
      <header className="border-b border-line bg-white px-4 py-3">
        <Link href="/emails" className="text-sm font-semibold text-brand">← All emails</Link>
        <h1 className="mt-1 font-serif text-xl font-semibold text-navy">{row.title || "Untitled"}</h1>
        <p className="text-sm text-muted"><span className="font-semibold" style={{ color: p.dark }}>{p.label}</span>{doc.subject ? ` · ${doc.subject}` : ""}</p>
        {row.scheduled_at ? <p className="mt-1 text-sm text-ink">Planned to go out <b>{when(row.scheduled_at)}</b>{row.expedited ? " (expedited)" : ""}</p> : null}
      </header>
      <ReviewActions id={row.id} status={row.status} admin={admin} expedited={!!row.expedited} editHref={`/editor?e=${row.id}`} />
      <iframe title="Email preview" srcDoc={html} className="mx-auto block w-full max-w-[680px] flex-1 border-0 bg-white" style={{ minHeight: "70dvh" }} />
    </div>
  );
}
