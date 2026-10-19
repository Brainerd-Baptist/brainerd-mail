import { snapshot } from "@/lib/versions";
import { notify } from "@/lib/notify";
import { paletteFor } from "@/lib/ministries";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { blockingChecks } from "@/lib/email-guard";
import { MIN_SEND_MINUTES, isExpedited, when } from "@/lib/approval";
import { meFor } from "@/lib/roles";
import { canApprove, type Role } from "@/lib/roles-ui";
import { verifyAction, type ActionClaims } from "@/lib/action-token";
import type { EmailDoc } from "@/lib/blocks";

type Sb = ReturnType<typeof supabaseAdmin>;
export type Decision = { action: "approve" | "changes"; note?: string; confirmExpedited?: boolean; newTime?: string };
export type Result = { status: number; json: Record<string, unknown> };

// The approver's decision, in one place for the dashboard and for the buttons in the email.
// Optional newTime: on approve it changes the send time; on changes it is the time the approver suggests.
export async function decide(sb: Sb, actor: { userId: string; role: Role }, emailId: string, body: Decision, opts: { via: "dashboard" | "email"; submittedAt?: string } = { via: "dashboard" }): Promise<Result> {
  const { data: row } = await sb.from("emails").select("id,doc,status,title,ministry,expedited,scheduled_at,submitted_by,submitted_at").eq("id", emailId).maybeSingle();
  if (!row) return { status: 404, json: { error: "Not found" } };
  if (row.status !== "pending_approval") return { status: 409, json: { error: "This email isn’t waiting for approval (it may have been changed or withdrawn). Reload to see where it stands.", stale: true } };
  if (opts.submittedAt && new Date(row.submitted_at as string).getTime() !== new Date(opts.submittedAt).getTime()) return { status: 409, json: { error: "This email was changed or sent again after that message went out. Open the newest approval request.", stale: true } };
  const doc = row.doc as EmailDoc;
  const now = new Date().toISOString();

  let newTime: Date | null = null;
  if (body.newTime) {
    newTime = new Date(body.newTime);
    if (isNaN(newTime.getTime())) return { status: 400, json: { error: "That day and time isn’t valid." } };
    if (newTime.getTime() < Date.now() + MIN_SEND_MINUTES * 60000) return { status: 400, json: { error: "Pick a send time at least half an hour from now." } };
  }

  if (body.action === "approve") {
    if (row.submitted_by === actor.userId && actor.role !== "owner") return { status: 403, json: { error: "You sent this one for approval, so someone else needs to approve it." } };
    const blocking = blockingChecks(doc);
    if (blocking.length) return { status: 422, json: { error: `Can’t approve yet: ${blocking.map((c) => c.label).join("; ")}` } };
    const finalAt = newTime ?? (row.scheduled_at ? new Date(row.scheduled_at as string) : null);
    const expedited = finalAt ? isExpedited(finalAt) : !!row.expedited;
    if (expedited && body.confirmExpedited !== true) return { status: 400, json: { error: "Confirm that you approve an expedited send." } };
    if (finalAt && finalAt.getTime() < Date.now()) return { status: 409, json: { error: "The planned send time has passed. Send it back and pick a new time." } };
    const patch: Record<string, unknown> = { status: "approved", approved_by: actor.userId, approved_at: now, approval_kind: "manual", updated_at: now };
    if (newTime) { patch.scheduled_at = newTime.toISOString(); patch.planned_at = newTime.toISOString(); patch.expedited = expedited; }
    await sb.from("emails").update(patch).eq("id", emailId);
    await snapshot(sb, emailId, doc, actor.userId, newTime ? `Approved, send time changed to ${when(newTime.toISOString())}` : "Approved");
    await sb.from("audit_log").insert({ actor: actor.userId, action: "approve_email", email_id: emailId, detail: { expedited, via: opts.via, newTime: newTime?.toISOString() ?? null } });
    await notifySubmitter(row, "approved", null, newTime?.toISOString() ?? (row.scheduled_at as string | null));
    return { status: 200, json: { ok: true, status: "approved", sendAt: newTime?.toISOString() ?? row.scheduled_at } };
  }

  if (body.action === "changes") {
    let note = typeof body.note === "string" ? body.note.trim().slice(0, 600) : "";
    if (newTime) note = `${note ? note + "\n" : ""}Suggested send time: ${when(newTime.toISOString())}`.slice(0, 700);
    const patch: Record<string, unknown> = { status: "draft", review_note: note || null, submitted_at: null, scheduled_at: null, expedited: false, reminders_sent: [], updated_at: now };
    if (newTime) patch.planned_at = newTime.toISOString();
    await sb.from("emails").update(patch).eq("id", emailId);
    await sb.from("audit_log").insert({ actor: actor.userId, action: "request_changes", email_id: emailId, detail: { note, via: opts.via, newTime: newTime?.toISOString() ?? null } });
    await notifySubmitter(row, "changes", note, null);
    return { status: 200, json: { ok: true, status: "draft" } };
  }
  return { status: 400, json: { error: "Unknown action" } };
}

async function notifySubmitter(row: { id: string; title: string; ministry: string; doc: unknown; submitted_by: string | null }, kind: "approved" | "changes", note: string | null, sendAt: string | null) {
  if (!row.submitted_by) return;
  const { data } = await supabaseAdmin().auth.admin.getUserById(row.submitted_by);
  const to = data?.user?.email;
  if (!to) return;
  await notify([to], { kind, emailId: row.id, title: row.title, subject: (row.doc as EmailDoc).subject, ministry: paletteFor(row.ministry).label, sendAt, note });
}

// What a link in an email points at right now.
export type Resolved =
  | { state: "ok"; claims: ActionClaims; row: { id: string; title: string; ministry: string; doc: EmailDoc; scheduled_at: string | null; expedited: boolean; submitted_by: string | null; submitted_at: string }; actor: { userId: string; role: Role; name: string }; own: boolean }
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "noaccess" }
  | { state: "gone"; emailId: string; status: string; title: string };

export async function resolveAction(token: string): Promise<Resolved> {
  const v = verifyAction(token);
  if (!v.ok) return { state: v.expired ? "expired" : "invalid" };
  const sb = supabaseAdmin();
  const me = await meFor(v.claims.u);
  if (!me || !canApprove(me)) return { state: "noaccess" };
  const { data: row } = await sb.from("emails").select("id,doc,status,title,ministry,expedited,scheduled_at,submitted_by,submitted_at").eq("id", v.claims.e).maybeSingle();
  if (!row) return { state: "invalid" };
  const stale = row.status === "pending_approval" && new Date(row.submitted_at as string).getTime() !== new Date(v.claims.s).getTime();
  if (row.status !== "pending_approval" || stale) return { state: "gone", emailId: row.id as string, status: stale ? "changed" : (row.status as string), title: row.title as string };
  return { state: "ok", claims: v.claims, row: row as never, actor: { userId: me.userId, role: me.role, name: me.name || me.email.split("@")[0] }, own: row.submitted_by === me.userId && me.role !== "owner" };
}
