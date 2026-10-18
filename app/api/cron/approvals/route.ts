import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notify, approverEmails } from "@/lib/notify";
import { REMINDER_HOURS } from "@/lib/approval";
import { paletteFor } from "@/lib/ministries";
import { blockingChecks } from "@/lib/email-guard";
import type { EmailDoc } from "@/lib/blocks";

// Runs every hour (vercel.json). Reminders at 24, 48 and 66 hours; a note when a send time
// passes without a decision. Auto-approval stays OFF until AUTO_APPROVE=on is set, because the
// plan is manual approval for the first few months. Expedited emails never auto-approve.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data: rows } = await sb.from("emails").select("id,title,ministry,doc,scheduled_at,submitted_at,expedited,reminders_sent").eq("status", "pending_approval");
  const out = { reminded: 0, passed: 0, autoApproved: 0 };
  const autoOn = process.env.AUTO_APPROVE === "on";

  for (const r of rows ?? []) {
    const doc = r.doc as EmailDoc;
    const sendAt = r.scheduled_at ? new Date(r.scheduled_at).getTime() : 0;
    const waited = (Date.now() - new Date(r.submitted_at).getTime()) / 3600000;
    const sent: number[] = r.reminders_sent ?? [];
    const base = { emailId: r.id, title: r.title, subject: doc.subject, ministry: paletteFor(r.ministry).label, sendAt: r.scheduled_at, expedited: r.expedited };

    if (sendAt && Date.now() >= sendAt) {
      if (autoOn && !r.expedited && blockingChecks(doc).length === 0) {
        const now = new Date().toISOString();
        await sb.from("emails").update({ status: "approved", approved_at: now, approval_kind: "auto", updated_at: now }).eq("id", r.id);
        await sb.from("audit_log").insert({ action: "auto_approve", email_id: r.id, detail: {} });
        out.autoApproved++;
      } else if (!sent.includes(-1)) {
        await notify(approverEmails(), { kind: "passed", ...base });
        await sb.from("emails").update({ reminders_sent: [...sent, -1] }).eq("id", r.id);
        out.passed++;
      }
      continue;
    }
    const due = REMINDER_HOURS.filter((h) => waited >= h && !sent.includes(h)).pop();
    if (due) {
      await notify(approverEmails(), { kind: "reminder", ...base, hoursWaiting: waited });
      await sb.from("emails").update({ reminders_sent: [...sent, ...REMINDER_HOURS.filter((h) => h <= due && !sent.includes(h))] }).eq("id", r.id);
      out.reminded++;
    }
  }
  return NextResponse.json({ ok: true, checked: rows?.length ?? 0, ...out });
}
