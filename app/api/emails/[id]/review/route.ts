import { NextResponse } from "next/server";
import { staffAndId } from "@/lib/email-guard";
import { canApprove } from "@/lib/roles";
import { decide } from "@/lib/review-core";

// The approver's decision: approve, or send it back with a note. The same rules also run behind the buttons in the approval email.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  if (!canApprove(g.me)) return NextResponse.json({ error: "Only an approver can do this." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const out = await decide(g.sb, { userId: g.user.id, role: g.me.role }, params.id, { action: body.action, note: body.note, confirmExpedited: body.confirmExpedited === true, newTime: body.newTime || undefined }, { via: "dashboard" });
  return NextResponse.json(out.json, { status: out.status });
}
