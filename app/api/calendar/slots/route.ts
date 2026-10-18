import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PALETTES } from "@/lib/ministries";
import { whoAmI, needBuild } from "@/lib/email-guard";

// Reserve a send slot before the email exists, so everyone can see the plan.
export async function POST(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  const auth = { user: w.user };
  const body = await req.json().catch(() => ({}));
  if (typeof body.ministry !== "string" || !PALETTES[body.ministry]) return NextResponse.json({ error: "Pick a ministry." }, { status: 400 });
  { const deny = needBuild(w.me, body.ministry); if (deny) return deny; }
  const at = new Date(body.plannedAt);
  if (isNaN(at.getTime())) return NextResponse.json({ error: "Pick a day and time." }, { status: 400 });
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const { data, error } = await supabaseAdmin().from("send_slots").insert({ ministry: body.ministry, planned_at: at.toISOString(), label, note, created_by: auth.user.id }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Could not save the slot." }, { status: 502 });
  return NextResponse.json({ ok: true, id: data.id });
}
