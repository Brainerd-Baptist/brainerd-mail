import { NextResponse } from "next/server";
import { staffAndId } from "@/lib/email-guard";
import { EDITING_CANCELS } from "@/lib/approval";

// Back to draft so it can be edited. Cancels any approval; it has to be submitted again.
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const { user, sb } = g;
  const { data: row } = await sb.from("emails").select("status").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "draft") return NextResponse.json({ ok: true });
  if (!EDITING_CANCELS.includes(row.status)) return NextResponse.json({ error: "This email has already gone out and can’t be edited. Duplicate it instead." }, { status: 409 });
  const now = new Date().toISOString();
  await sb.from("emails").update({ status: "draft", scheduled_at: null, submitted_at: null, expedited: false, approved_by: null, approved_at: null, approval_kind: null, reminders_sent: [], updated_at: now }).eq("id", params.id);
  await sb.from("audit_log").insert({ actor: user.id, action: "withdraw_email", email_id: params.id, detail: { from: row.status } });
  return NextResponse.json({ ok: true, version: now });
}
