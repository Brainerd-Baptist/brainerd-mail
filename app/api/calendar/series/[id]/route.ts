import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UUID } from "@/lib/email-guard";
import { ensureSlots, type Series } from "@/lib/series";

async function who(id: string) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return { err: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  if (!UUID.test(id)) return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return { sb: supabaseAdmin() } as const;
}
// Only slots that haven't happened and have no email yet are ever rebuilt or removed.
const clearFuture = (sb: ReturnType<typeof supabaseAdmin>, id: string) => sb.from("send_slots").delete().eq("series_id", id).is("email_id", null).gte("planned_at", new Date().toISOString());

// Pause or resume, rename, end it on a date, or change the time. Past slots and started emails stay as they are.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await who(params.id);
  if (g.err) return g.err;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.paused === "boolean") patch.paused = b.paused;
  if (typeof b.label === "string" && b.label.trim()) patch.label = b.label.trim().slice(0, 120);
  if (b.endsOn === null || (typeof b.endsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.endsOn))) patch.ends_on = b.endsOn;
  if (typeof b.time === "string" && /^\d{2}:\d{2}$/.test(b.time)) patch.time_local = b.time;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const { data, error } = await g.sb.from("send_series").update(patch).eq("id", params.id).select("*").single();
  if (error || !data) return NextResponse.json({ error: "Could not update the repeating email." }, { status: 502 });
  await clearFuture(g.sb, params.id);
  if (!data.paused) await ensureSlots(g.sb, [data as Series]);
  if (patch.label) await g.sb.from("send_slots").update({ label: patch.label as string }).eq("series_id", params.id).is("email_id", null);
  return NextResponse.json({ ok: true });
}

// Stop repeating: removes the coming empty slots. Emails already started keep their dates.
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const g = await who(params.id);
  if (g.err) return g.err;
  await clearFuture(g.sb, params.id);
  const { error } = await g.sb.from("send_series").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not remove the repeating email." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
