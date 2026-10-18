import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";

// The signed-in person's role and whether they've finished the first-run tour.
export async function GET() {
  const w = await whoAmI();
  if (w.err) return w.err;
  const { data } = await w.sb.from("staff").select("tour_done_at").eq("user_id", w.me.userId).maybeSingle();
  return NextResponse.json({ role: w.me.role, name: w.me.name || w.me.email.split("@")[0], email: w.me.email, tourDone: !!data?.tour_done_at });
}
