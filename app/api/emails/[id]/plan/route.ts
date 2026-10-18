import { NextResponse } from "next/server";
import { staffAndId } from "@/lib/email-guard";

// Sets (or clears) the day and time a draft is planned to go out. Shows on the calendar.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const { user, sb } = g;
  const body = await req.json().catch(() => ({}));
  let plannedAt: string | null = null;
  if (body.plannedAt !== null && body.plannedAt !== undefined) {
    const d = new Date(body.plannedAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Pick a valid day and time." }, { status: 400 });
    plannedAt = d.toISOString();
  }
  const { data: row } = await sb.from("emails").select("status").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "draft") return NextResponse.json({ error: "The send time is set when an email goes for approval. Use Edit again to change it." }, { status: 409 });
  const { error } = await sb.from("emails").update({ planned_at: plannedAt }).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not save the planned time." }, { status: 502 });
  await sb.from("audit_log").insert({ actor: user.id, action: "plan_email", email_id: params.id, detail: { plannedAt } });
  return NextResponse.json({ ok: true, plannedAt });
}
