import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { overview, parseFilters } from "@/lib/analytics";
import { canSeePeopleStats } from "@/lib/roles-ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Numbers for the Analytics screen. Everyone signed in may read it; editors only get their own ministries.
export async function GET(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  try {
    const f = parseFilters(new URL(req.url).searchParams);
    return NextResponse.json(await overview(w.me, f, canSeePeopleStats(w.me)));
  } catch (e: any) {
    return NextResponse.json({ error: "Couldn't load analytics. Please try again." }, { status: 500 });
  }
}
