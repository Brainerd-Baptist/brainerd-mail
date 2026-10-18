import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UUID } from "@/lib/email-guard";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabaseAdmin().from("send_slots").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not remove the slot." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
