import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isChurchEmail, isOwnerEmail } from "@/lib/access";
import { siteUrl } from "@/lib/site";
import { COOKIE_NONCE, COOKIE_STATE } from "@/lib/google-signin";

// Google posts the signed id_token here. We check our one-time state, hand the token to Supabase with
// our nonce, then apply the same access rules as the original callback (church accounts on the team or
// with a live invitation only).
export async function POST(req: Request) {
  const base = siteUrl();
  const store = cookies();
  const [nonce, state] = (store.get(COOKIE_NONCE)?.value || "").split(".");
  let idToken = "", gotState = "";
  try {
    const form = await req.formData();
    idToken = String(form.get("id_token") || "");
    gotState = String(form.get("state") || "");
  } catch { /* handled below */ }
  const fail = (e: string, why = "") => {
    if (why) console.error("[google-direct]", why);
    const res = NextResponse.redirect(`${base}/login?error=${e}`, { status: 303 });
    res.cookies.delete(COOKIE_NONCE); res.cookies.delete(COOKIE_STATE);
    return res;
  };
  if (!idToken) return fail("failed", "no id_token in form (keys: " + "n/a" + ")");
  if (!nonce || !state) return fail("failed", "flow cookies missing nonce=" + !!nonce + " state=" + !!state);
  if (gotState !== state) return fail("failed", "state mismatch");

  const supabase = supabaseServer();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce });
  if (error) return fail("failed", "signInWithIdToken: " + error.message);

  const ok = () => {
    const res = NextResponse.redirect(`${base}/emails`, { status: 303 });
    res.cookies.delete(COOKIE_NONCE); res.cookies.delete(COOKIE_STATE);
    return res;
  };
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const email = user?.email?.toLowerCase();
  if (!user || !email) { await supabase.auth.signOut(); return fail("failed"); }
  const denied = async () => { await supabase.auth.signOut(); return fail("denied"); };

  // Church Google accounts only, whatever the invitation says.
  if (!isChurchEmail(email)) return denied();

  const admin = supabaseAdmin();
  const name = (user.user_metadata?.full_name as string | undefined) ?? null;
  const { data: row } = await admin.from("staff").select("user_id,name,disabled_at").eq("user_id", user.id).maybeSingle();
  if (row) {
    if (row.disabled_at) return denied();
    if (!row.name && name) await admin.from("staff").update({ name }).eq("user_id", user.id);
    return ok();
  }

  // The owner address is always let in as Owner (first sign-in creates the row).
  if (isOwnerEmail(email)) {
    const { error: e } = await admin.from("staff").upsert({ user_id: user.id, email, name, role: "owner", ministries: [] }, { onConflict: "user_id" });
    if (e) return denied();
    return ok();
  }

  // Everyone else needs a live invitation for this exact address.
  const { data: inv } = await admin.from("invites").select("id,role,ministries,invited_by,first_name,last_name").ilike("email", email).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!inv) return denied();
  const { error: e2 } = await admin.from("staff").insert({ user_id: user.id, email, name: `${inv.first_name ?? ""} ${inv.last_name ?? ""}`.trim() || name, role: inv.role, ministries: inv.ministries ?? [], invited_by: inv.invited_by });
  if (e2) return denied();
  await admin.from("invites").update({ accepted_at: new Date().toISOString(), accepted_user: user.id }).eq("id", inv.id);
  await admin.from("audit_log").insert({ actor: user.id, action: "accept_invite", detail: { email, role: inv.role, ministries: inv.ministries } });
  return ok();
}
