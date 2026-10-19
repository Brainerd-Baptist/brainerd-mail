import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { getSettings, EMAIL_RE, type SendMode } from "@/lib/settings";
import { canManageTeam } from "@/lib/roles-ui";

export const dynamic = "force-dynamic";

// Owner and Admins can look. Only the Owner can change anything, except that an Admin can press Stop (switch to Off).
export async function GET() {
  const w = await whoAmI();
  if (w.err) return w.err;
  if (!canManageTeam(w.me)) return NextResponse.json({ error: "Owner and admins only" }, { status: 403 });
  const settings = await getSettings();
  const { data: log } = await w.sb.from("audit_log").select("at,actor,detail").eq("action", "send_settings").order("at", { ascending: false }).limit(12);
  const ids = Array.from(new Set((log ?? []).map((l) => l.actor as string).filter(Boolean)));
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: st } = await w.sb.from("staff").select("user_id,name,email").in("user_id", ids);
    for (const s of st ?? []) names[s.user_id as string] = (s.name as string) || String(s.email).split("@")[0];
  }
  return NextResponse.json({
    settings,
    canChange: w.me.role === "owner",
    updatedBy: settings.updated_by ? names[settings.updated_by] ?? null : null,
    log: (log ?? []).map((l) => ({ at: l.at, who: names[l.actor as string] ?? "Someone", detail: l.detail })),
  });
}

export async function PATCH(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  if (!canManageTeam(w.me)) return NextResponse.json({ error: "Owner and admins only" }, { status: 403 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const owner = w.me.role === "owner";
  const patch: Record<string, unknown> = {};
  const change: Record<string, unknown> = {};
  const cur = await getSettings();

  if (b.send_mode !== undefined) {
    const m = b.send_mode as SendMode;
    if (!["off", "staff", "live"].includes(m)) return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    if (m !== "off" && !owner) return NextResponse.json({ error: "Only the owner can turn sending on. You can always press Stop." }, { status: 403 });
    if (m === "live" && b.confirm !== "SEND LIVE") return NextResponse.json({ error: "Type SEND LIVE to confirm." }, { status: 400 });
    patch.send_mode = m; change.send_mode = [cur.send_mode, m];
  }
  if (b.safe_list !== undefined) {
    if (!owner) return NextResponse.json({ error: "Only the owner can change the safe list." }, { status: 403 });
    const list = Array.from(new Set((Array.isArray(b.safe_list) ? b.safe_list : []).map((s: unknown) => String(s).trim().toLowerCase()).filter(Boolean)));
    if (list.some((e) => !EMAIL_RE.test(e as string))) return NextResponse.json({ error: "One of those isn't a valid email address." }, { status: 400 });
    if (list.length > 20) return NextResponse.json({ error: "Keep the safe list to 20 people or fewer." }, { status: 400 });
    patch.safe_list = list; change.safe_list = [cur.safe_list.length, list.length];
  }
  if (b.live_cap !== undefined) {
    if (!owner) return NextResponse.json({ error: "Only the owner can change the cap." }, { status: 403 });
    const n = Math.floor(Number(b.live_cap));
    if (!Number.isFinite(n) || n < 1 || n > 5000) return NextResponse.json({ error: "The cap must be between 1 and 5,000." }, { status: 400 });
    patch.live_cap = n; change.live_cap = [cur.live_cap, n];
  }
  if (b.auto_send !== undefined) {
    if (!owner) return NextResponse.json({ error: "Only the owner can change automatic sending." }, { status: 403 });
    patch.auto_send = !!b.auto_send; change.auto_send = [cur.auto_send, !!b.auto_send];
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  patch.updated_at = new Date().toISOString();
  patch.updated_by = w.user.id;
  const { error } = await w.sb.from("mail_settings").upsert({ id: 1, ...patch });
  if (error) return NextResponse.json({ error: "Couldn't save. Nothing was changed." }, { status: 500 });
  await w.sb.from("audit_log").insert({ actor: w.user.id, action: "send_settings", detail: change });
  return NextResponse.json({ ok: true, settings: await getSettings() });
}
