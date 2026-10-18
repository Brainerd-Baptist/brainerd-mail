import { NextResponse } from "next/server";
import { whoAmI, UUID } from "@/lib/email-guard";

// The owner hands ownership to another active member. The previous owner becomes an Admin.
export async function POST(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  const { me, sb, user } = w;
  if (me.role !== "owner") return NextResponse.json({ error: "Only the owner can hand off ownership." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.userId !== "string" || !UUID.test(b.userId) || b.userId === me.userId) return NextResponse.json({ error: "Pick another person." }, { status: 400 });
  const { data: t } = await sb.from("staff").select("user_id,email,disabled_at").eq("user_id", b.userId).maybeSingle();
  if (!t || t.disabled_at) return NextResponse.json({ error: "Pick an active member of the team." }, { status: 404 });
  if (typeof b.confirmEmail !== "string" || b.confirmEmail.trim().toLowerCase() !== String(t.email).toLowerCase()) return NextResponse.json({ error: "Type their email to confirm." }, { status: 400 });

  // Only one owner can exist at a time, so step down first, then promote.
  const d1 = await sb.from("staff").update({ role: "admin", ministries: [] }).eq("user_id", me.userId);
  if (d1.error) return NextResponse.json({ error: "Could not hand off ownership." }, { status: 502 });
  const d2 = await sb.from("staff").update({ role: "owner", ministries: [] }).eq("user_id", t.user_id);
  if (d2.error) {
    await sb.from("staff").update({ role: "owner" }).eq("user_id", me.userId);
    return NextResponse.json({ error: "Could not hand off ownership." }, { status: 502 });
  }
  await sb.from("audit_log").insert({ actor: user.id, action: "transfer_ownership", detail: { to: t.email } });
  return NextResponse.json({ ok: true });
}
