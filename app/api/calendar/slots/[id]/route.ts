import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UUID } from "@/lib/email-guard";

async function guard(id: string) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return { err: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  if (!UUID.test(id)) return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return { sb: supabaseAdmin() } as const;
}

// Skip (or restore) one repeat, or move one slot to another time. The rest of a series is untouched.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guard(params.id);
  if (g.err) return g.err;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.skipped === "boolean") patch.skipped = b.skipped;
  if (b.plannedAt) {
    const d = new Date(b.plannedAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Pick a valid day and time." }, { status: 400 });
    patch.planned_at = d.toISOString();
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const { error } = await g.sb.from("send_slots").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not update the slot." }, { status: 502 });
  return NextResponse.json({ ok: true });
}

// A one-off slot is deleted. A slot from a repeating series is skipped instead, so it doesn't come back.
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const g = await guard(params.id);
  if (g.err) return g.err;
  const { data: row } = await g.sb.from("send_slots").select("series_id").eq("id", params.id).maybeSingle();
  const { error } = row?.series_id
    ? await g.sb.from("send_slots").update({ skipped: true }).eq("id", params.id)
    : await g.sb.from("send_slots").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not remove the slot." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
