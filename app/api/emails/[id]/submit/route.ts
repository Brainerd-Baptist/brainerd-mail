import { NextResponse } from "next/server";
import { staffAndId, requireBuild, blockingChecks } from "@/lib/email-guard";
import { MIN_SEND_MINUTES, isExpedited } from "@/lib/approval";
import { snapshot } from "@/lib/versions";
import { notify } from "@/lib/notify";
import { approverEmails } from "@/lib/roles";
import { paletteFor } from "@/lib/ministries";
import type { EmailDoc } from "@/lib/blocks";

// "Send for approval": picks the send time, starts the 72-hour clock, tells the approvers.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  { const deny = await requireBuild(g.sb, g.me, params.id); if (deny) return deny; }
  const { user, sb } = g;
  const body = await req.json().catch(() => ({}));
  const sendAt = new Date(body.sendAt);
  if (isNaN(sendAt.getTime())) return NextResponse.json({ error: "Pick a day and time to send." }, { status: 400 });
  if (sendAt.getTime() < Date.now() + MIN_SEND_MINUTES * 60000) return NextResponse.json({ error: "Pick a send time at least half an hour from now." }, { status: 400 });

  const { data: row } = await sb.from("emails").select("id,doc,status,title,ministry").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "draft") return NextResponse.json({ error: row.status === "pending_approval" ? "This email is already waiting for approval." : "This email can’t be submitted now." }, { status: 409 });

  const doc = row.doc as EmailDoc;
  const blocking = blockingChecks(doc);
  if (blocking.length) return NextResponse.json({ error: `Fix first: ${blocking.map((c) => c.label).join("; ")}` }, { status: 422 });

  const now = new Date().toISOString();
  const expedited = isExpedited(sendAt);
  const { error } = await sb.from("emails").update({
    status: "pending_approval", scheduled_at: sendAt.toISOString(), planned_at: sendAt.toISOString(), submitted_at: now, submitted_by: user.id, expedited,
    approved_by: null, approved_at: null, approval_kind: null, reminders_sent: [], review_note: null, updated_at: now,
  }).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not submit." }, { status: 502 });

  await snapshot(sb, params.id, doc, user.id, "Sent for approval");
  await sb.from("audit_log").insert({ actor: user.id, action: "submit_for_approval", email_id: params.id, detail: { sendAt: sendAt.toISOString(), expedited } });
  await notify(await approverEmails(), { kind: "submitted", emailId: params.id, title: row.title, subject: doc.subject, ministry: paletteFor(row.ministry).label, sendAt: sendAt.toISOString(), expedited });
  return NextResponse.json({ ok: true, expedited, version: now });
}
