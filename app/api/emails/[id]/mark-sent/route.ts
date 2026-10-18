import { NextResponse } from "next/server";
import { staffAndId } from "@/lib/email-guard";

// Real sending isn't switched on yet. Until it is, whoever sends through ClearStream marks it
// here so the calendar can show what actually went out, and when.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const { user, sb } = g;
  const body = await req.json().catch(() => ({}));
  const at = body.sentAt ? new Date(body.sentAt) : new Date();
  if (isNaN(at.getTime())) return NextResponse.json({ error: "Pick a valid day and time." }, { status: 400 });
  if (at.getTime() > Date.now() + 5 * 60000) return NextResponse.json({ error: "That time is in the future. Mark it sent after it goes out." }, { status: 400 });
  const { data: row } = await sb.from("emails").select("status").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "sent") return NextResponse.json({ error: "This email is already marked as sent." }, { status: 409 });
  if (row.status === "cancelled") return NextResponse.json({ error: "This email was cancelled." }, { status: 409 });
  const now = new Date().toISOString();
  const { error } = await sb.from("emails").update({ status: "sent", sent_at: at.toISOString(), sent_marked_by: user.id, updated_at: now }).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not mark it as sent." }, { status: 502 });
  await sb.from("audit_log").insert({ actor: user.id, action: "mark_email_sent", email_id: params.id, detail: { sentAt: at.toISOString(), from: row.status } });
  return NextResponse.json({ ok: true, sentAt: at.toISOString() });
}

// Undo a mark made by hand (a slip of the finger). Emails sent by the app itself can't be undone.
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const { user, sb } = g;
  const { data: row } = await sb.from("emails").select("status,sent_marked_by,approved_at").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "sent" || !row.sent_marked_by) return NextResponse.json({ error: "Only a mark made by hand can be undone." }, { status: 409 });
  await sb.from("emails").update({ status: row.approved_at ? "approved" : "draft", sent_at: null, sent_marked_by: null, updated_at: new Date().toISOString() }).eq("id", params.id);
  await sb.from("audit_log").insert({ actor: user.id, action: "unmark_email_sent", email_id: params.id, detail: {} });
  return NextResponse.json({ ok: true });
}
