import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PALETTES } from "@/lib/ministries";
import { ensureSlots, fromRepeat, type Series } from "@/lib/series";

// Create a repeating email: "Kids, third Friday of every month at 7:00 AM".
export async function POST(req: Request) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.ministry !== "string" || !PALETTES[b.ministry]) return NextResponse.json({ error: "Pick a ministry." }, { status: 400 });
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 120) : "";
  if (!label) return NextResponse.json({ error: "Give the repeating email a name, like “Monthly Kids update”." }, { status: 400 });
  const rule = fromRepeat(b.repeat, String(b.date ?? ""), String(b.time ?? ""));
  if (!rule) return NextResponse.json({ error: "Pick how often it repeats." }, { status: 400 });
  const endsOn = typeof b.endsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.endsOn) ? b.endsOn : null;
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("send_series").insert({ ministry: b.ministry, label, ...rule, ends_on: endsOn, created_by: auth.user.id }).select("*").single();
  if (error || !data) return NextResponse.json({ error: "Could not save the repeating email." }, { status: 502 });
  await ensureSlots(sb, [data as Series]);
  return NextResponse.json({ ok: true, id: data.id });
}
