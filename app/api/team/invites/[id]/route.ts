import { NextResponse } from "next/server";
import { whoAmI, UUID } from "@/lib/email-guard";
import { canManageTeam, canManageTarget, isRole } from "@/lib/roles";
import { sendInvite } from "@/lib/invite-mail";

// Resend or revoke a pending invitation.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const w = await whoAmI();
  if (w.err) return w.err;
  const { me, sb, user } = w;
  if (!canManageTeam(me)) return NextResponse.json({ error: "Only the owner and admins can do this." }, { status: 403 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const { data: inv } = await sb.from("invites").select("*").eq("id", params.id).maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at) return NextResponse.json({ error: "That invitation is no longer open." }, { status: 404 });
  if (!isRole(inv.role) || !canManageTarget(me.role, inv.role)) return NextResponse.json({ error: "Only the owner can manage an Admin invitation." }, { status: 403 });

  if (b.action === "revoke") {
    await sb.from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", inv.id);
    await sb.from("audit_log").insert({ actor: user.id, action: "revoke_invite", detail: { email: inv.email, role: inv.role } });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "resend") {
    const expires = new Date(Date.now() + 14 * 86400000).toISOString();
    await sb.from("invites").update({ expires_at: expires, last_sent_at: new Date().toISOString() }).eq("id", inv.id);
    let emailed = true;
    try { await sendInvite({ to: inv.email, firstName: inv.first_name ?? "", role: inv.role, ministries: inv.ministries ?? [], inviterName: me.name || me.email.split("@")[0], expiresAt: expires }); } catch { emailed = false; }
    await sb.from("audit_log").insert({ actor: user.id, action: "resend_invite", detail: { email: inv.email } });
    return NextResponse.json({ ok: true, emailed });
  }
  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
