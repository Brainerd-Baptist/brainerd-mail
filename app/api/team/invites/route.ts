import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { canManageTeam, isRole, rolesICanGrant } from "@/lib/roles";
import { isChurchEmail } from "@/lib/access";
import { PALETTES } from "@/lib/ministries";
import { sendInvite } from "@/lib/invite-mail";

// Invite someone by email. They sign in with their church Google account and are let in with this role.
export async function POST(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  const { me, sb, user } = w;
  if (!canManageTeam(me)) return NextResponse.json({ error: "Only the owner and admins can invite people." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!isChurchEmail(email)) return NextResponse.json({ error: "Only @brainerdbaptist.org addresses can be invited." }, { status: 400 });
  if (!isRole(b.role) || !rolesICanGrant(me).includes(b.role)) return NextResponse.json({ error: "You can't give that role." }, { status: 403 });
  const ministries = b.role === "editor" && Array.isArray(b.ministries) ? Array.from(new Set((b.ministries as unknown[]).filter((m): m is string => typeof m === "string" && !!PALETTES[m]))) : [];
  if (b.role === "editor" && !ministries.length) return NextResponse.json({ error: "Pick at least one ministry for an Editor." }, { status: 400 });

  const { data: existing } = await sb.from("staff").select("user_id,disabled_at").ilike("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: existing.disabled_at ? "That person is deactivated. Reactivate them from the list instead." : "That person is already on the team." }, { status: 409 });

  const now = new Date();
  const expires = new Date(now.getTime() + 14 * 86400000).toISOString();
  const { data: pending } = await sb.from("invites").select("id").ilike("email", email).is("accepted_at", null).is("revoked_at", null).maybeSingle();
  let id = pending?.id as string | undefined;
  if (id) {
    await sb.from("invites").update({ role: b.role, ministries, expires_at: expires, last_sent_at: now.toISOString(), invited_by: user.id }).eq("id", id);
  } else {
    const { data, error } = await sb.from("invites").insert({ email, role: b.role, ministries, invited_by: user.id, expires_at: expires }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Could not save the invitation." }, { status: 502 });
    id = data.id as string;
  }
  await sb.from("audit_log").insert({ actor: user.id, action: "invite_user", detail: { email, role: b.role, ministries } });
  let emailed = true;
  try { await sendInvite({ to: email, role: b.role, ministries, inviterName: me.name || me.email.split("@")[0], expiresAt: expires }); } catch { emailed = false; }
  return NextResponse.json({ ok: true, id, emailed });
}
