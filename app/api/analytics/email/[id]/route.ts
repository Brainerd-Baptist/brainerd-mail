import { NextResponse } from "next/server";
import { staffAndId } from "@/lib/email-guard";
import { emailReport, parseFilters } from "@/lib/analytics";
import { canSeePeopleStats } from "@/lib/roles-ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The report for one email. Who-opened and who-clicked is only returned to the Owner and Admins.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const w = await staffAndId(params.id);
  if (w.err) return w.err;
  try {
    const f = parseFilters(new URL(req.url).searchParams);
    const r = await emailReport(w.me, { ...f, kind: new URL(req.url).searchParams.get("kind") ? f.kind : "all" }, params.id, canSeePeopleStats(w.me));
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "Couldn't load this report. Please try again." }, { status: 500 });
  }
}
