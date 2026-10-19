import { NextResponse } from "next/server";
import { resolveAction, decide } from "@/lib/review-core";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const WHY: Record<string, string> = {
  invalid: "This link isn’t valid. Open the newest approval request, or use the dashboard.",
  expired: "This link has expired. Open the newest approval request, or use the dashboard.",
  noaccess: "Your access to approve emails has changed. Ask the owner.",
};

// The two buttons in the approval email. The link is signed and tied to one approver and one "sent for approval" moment.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const r = await resolveAction(params.token);
  if (r.state === "gone") return NextResponse.json({ error: r.status === "changed" ? "This email was changed or sent again after that message went out." : `This email has already been decided (${r.status.replace("_", " ")}).`, stale: true }, { status: 409 });
  if (r.state !== "ok") return NextResponse.json({ error: WHY[r.state] }, { status: 403 });
  if (r.own) return NextResponse.json({ error: "You sent this one for approval, so someone else needs to approve it." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.action !== "approve" && b.action !== "changes") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (b.action === "changes" && !String(b.note ?? "").trim() && !b.newTime) return NextResponse.json({ error: "Write what to change, or suggest a different time." }, { status: 400 });
  const out = await decide(supabaseAdmin(), r.actor, r.claims.e, { action: b.action, note: b.note, newTime: b.newTime || undefined, confirmExpedited: b.confirmExpedited === true }, { via: "email", submittedAt: r.claims.s });
  return NextResponse.json(out.json, { status: out.status });
}
