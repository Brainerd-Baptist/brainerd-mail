import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isChurchEmail, isOwnerEmail } from "@/lib/access";

// Google sends people back here. Only church accounts that are on the team (or have a live invitation)
// get in; everyone else is signed straight back out.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_SITE_URL || origin;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${base}/login?error=missing`);

  const supabase = supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${base}/login?error=failed`);

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const email = user?.email?.toLowerCase();
  if (!user || !email) { await supabase.auth.signOut(); return NextResponse.redirect(`${base}/login?error=failed`); }
  const denied = async () => { await supabase.auth.signOut(); return NextResponse.redirect(`${base}/login?error=denied`); };

  // Church Google accounts only, whatever the invitation says.
  if (!isChurchEmail(email)) return denied();

  const admin = supabaseAdmin();
  const name = (user.user_metadata?.full_name as string | undefined) ?? null;
  const { data: row } = await admin.from("staff").select("user_id,name,disabled_at").eq("user_id", user.id).maybeSingle();
  if (row) {
    if (row.disabled_at) return denied();
    if (!row.name && name) await admin.from("staff").update({ name }).eq("user_id", user.id);
    return NextResponse.redirect(`${base}/emails`);
  }

  // The owner address is always let in as Owner (first sign-in creates the row).
  if (isOwnerEmail(email)) {
    const { error: e } = await admin.from("staff").upsert({ user_id: user.id, email, name, role: "owner", ministries: [] }, { onConflict: "user_id" });
    if (e) return denied();
    return NextResponse.redirect(`${base}/emails`);
  }

  // Everyone else needs a live invitation for this exact address.
  const { data: inv } = await admin.from("invites").select("id,role,ministries,invited_by,first_name,last_name").ilike("email", email).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!inv) return denied();
  const { error: e2 } = await admin.from("staff").insert({ user_id: user.id, email, name: `${inv.first_name ?? ""} ${inv.last_name ?? ""}`.trim() || name, role: inv.role, ministries: inv.ministries ?? [], invited_by: inv.invited_by });
  if (e2) return denied();
  await admin.from("invites").update({ accepted_at: new Date().toISOString(), accepted_user: user.id }).eq("id", inv.id);
  await admin.from("audit_log").insert({ actor: user.id, action: "accept_invite", detail: { email, role: inv.role, ministries: inv.ministries } });
  return NextResponse.redirect(`${base}/emails`);
}
