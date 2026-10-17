import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/access";

// Google sends people back here. Only people on the allowlist (or already in
// the staff table) get in; everyone else is signed straight back out.
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

  const admin = supabaseAdmin();
  let allowed = false;
  if (isAdminEmail(email)) {
    await admin.from("staff").upsert(
      { user_id: user.id, email, name: user.user_metadata?.full_name ?? null, role: "admin", ministries: [] },
      { onConflict: "user_id" }
    );
    allowed = true;
  } else {
    const { data: row } = await admin.from("staff").select("user_id").eq("user_id", user.id).maybeSingle();
    allowed = !!row;
  }
  if (!allowed) { await supabase.auth.signOut(); return NextResponse.redirect(`${base}/login?error=denied`); }
  return NextResponse.redirect(`${base}/editor`);
}
