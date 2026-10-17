import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export async function POST(req: Request) {
  await supabaseServer().auth.signOut();
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  return NextResponse.redirect(`${base}/login`, { status: 303 });
}
