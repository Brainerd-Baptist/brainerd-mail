import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/access";

const STATUSES = ["new", "seen", "planned", "done", "wont"];

// Admins triage a note: change its status or add a private note.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { data } = await supabaseServer().auth.getUser();
  if (!isAdminEmail(data.user?.email)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") { if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Bad status" }, { status: 400 }); patch.status = body.status; }
  if (typeof body.note === "string") patch.note = body.note.slice(0, 2000);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const { error } = await supabaseAdmin().from("feedback").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
