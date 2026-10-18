import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";

// Finished or skipped the first-run tour: don't open it by itself again. (Replay is always in the menu.)
export async function POST() {
  const w = await whoAmI();
  if (w.err) return w.err;
  await w.sb.from("staff").update({ tour_done_at: new Date().toISOString() }).eq("user_id", w.me.userId);
  return NextResponse.json({ ok: true });
}
