import { NextResponse } from "next/server";
import { whoAmI, UUID } from "@/lib/email-guard";
import { canManageTeam, canManageTarget, isRole, rolesICanGrant } from "@/lib/roles";
import { PALETTES } from "@/lib/ministries";

// Change someone's role or ministries, or deactivate / reactivate them.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const w = await whoAmI();
  if (w.err) return w.err;
  const { me, sb, user } = w;
  if (!canManageTeam(me)) return NextResponse.json({ error: "Only the owner and admins can manage people." }, { status: 403 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (params.id === me.userId) return NextResponse.json({ error: "You can't change your own access." }, { status: 400 });
  const { data: t } = await sb.from("staff").select("user_id,email,role,ministries,disabled_at").eq("user_id", params.id).maybeSingle();
  if (!t || !isRole(t.role)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageTarget(me.role, t.role)) return NextResponse.json({ error: t.role === "owner" ? "The owner can't be changed. Use Make owner to hand it off." : "Only the owner can change an Admin." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  const detail: Record<string, unknown> = { email: t.email };

  let role = t.role;
  if (b.role !== undefined) {
    if (!isRole(b.role) || !rolesICanGrant(me).includes(b.role)) return NextResponse.json({ error: "You can't give that role." }, { status: 403 });
    role = b.role;
  }
  let ministries: string[] = t.ministries ?? [];
  if (Array.isArray(b.ministries)) ministries = Array.from(new Set((b.ministries as unknown[]).filter((m): m is string => typeof m === "string" && !!PALETTES[m])));
  if (role !== "editor") ministries = [];
  if (role === "editor" && !ministries.length) return NextResponse.json({ error: "Pick at least one ministry for an Editor." }, { status: 400 });
  if (role !== t.role) { patch.role = role; detail.role = { from: t.role, to: role }; }
  if (JSON.stringify(ministries) !== JSON.stringify(t.ministries ?? [])) { patch.ministries = ministries; detail.ministries = ministries; }

  if (typeof b.disabled === "boolean") {
    patch.disabled_at = b.disabled ? new Date().toISOString() : null;
    detail.disabled = b.disabled;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
  const { error } = await sb.from("staff").update(patch).eq("user_id", t.user_id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 502 });
  await sb.from("audit_log").insert({ actor: user.id, action: typeof b.disabled === "boolean" ? (b.disabled ? "deactivate_user" : "reactivate_user") : "change_user", detail });
  return NextResponse.json({ ok: true });
}
