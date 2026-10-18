import { NextResponse } from "next/server";
import { staffAndId, blockingChecks } from "@/lib/email-guard";
import { canApprove } from "@/lib/roles";
import { snapshot } from "@/lib/versions";
import { notify } from "@/lib/notify";
import { paletteFor } from "@/lib/ministries";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EmailDoc } from "@/lib/blocks";

// The approver's decision: approve, or send it back with a note.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const { user, sb } = g;
  if (!canApprove(g.me)) return NextResponse.json({ error: "Only an approver can do this." }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const { data: row } = await sb.from("emails").select("id,doc,status,title,ministry,expedited,scheduled_at,submitted_by").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "pending_approval") return NextResponse.json({ error: "This email isn’t waiting for approval (it may have been changed or withdrawn). Reload to see where it stands." , stale: true }, { status: 409 });
  const doc = row.doc as EmailDoc;
  const now = new Date().toISOString();

  if (body.action === "approve") {
    if (row.submitted_by === user.id && g.me.role !== "owner") return NextResponse.json({ error: "You sent this one for approval, so someone else needs to approve it." }, { status: 403 });
    const blocking = blockingChecks(doc);
    if (blocking.length) return NextResponse.json({ error: `Can’t approve yet: ${blocking.map((c) => c.label).join("; ")}` }, { status: 422 });
    if (row.expedited && body.confirmExpedited !== true) return NextResponse.json({ error: "Confirm that you approve an expedited send." }, { status: 400 });
    if (row.scheduled_at && new Date(row.scheduled_at).getTime() < Date.now()) return NextResponse.json({ error: "The planned send time has passed. Send it back and pick a new time." }, { status: 409 });
    await sb.from("emails").update({ status: "approved", approved_by: user.id, approved_at: now, approval_kind: "manual", updated_at: now }).eq("id", params.id);
    await snapshot(sb, params.id, doc, user.id, "Approved");
    await sb.from("audit_log").insert({ actor: user.id, action: "approve_email", email_id: params.id, detail: { expedited: row.expedited } });
    await notifySubmitter(row, "approved", null);
    return NextResponse.json({ ok: true, status: "approved" });
  }
  if (body.action === "changes") {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 600) : "";
    await sb.from("emails").update({ status: "draft", review_note: note || null, submitted_at: null, scheduled_at: null, expedited: false, reminders_sent: [], updated_at: now }).eq("id", params.id);
    await sb.from("audit_log").insert({ actor: user.id, action: "request_changes", email_id: params.id, detail: { note } });
    await notifySubmitter(row, "changes", note);
    return NextResponse.json({ ok: true, status: "draft" });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function notifySubmitter(row: { id: string; title: string; ministry: string; doc: unknown; scheduled_at: string | null; submitted_by: string | null }, kind: "approved" | "changes", note: string | null) {
  if (!row.submitted_by) return;
  const { data } = await supabaseAdmin().auth.admin.getUserById(row.submitted_by);
  const to = data?.user?.email;
  if (!to) return;
  await notify([to], { kind, emailId: row.id, title: row.title, subject: (row.doc as EmailDoc).subject, ministry: paletteFor(row.ministry).label, sendAt: row.scheduled_at, note });
}
