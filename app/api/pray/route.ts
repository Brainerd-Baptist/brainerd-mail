import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SLUG = /^[0-9a-f]{12}$/;

// Counts for the web version: { counts: { <team>: <taps> } }
export async function GET(req: Request) {
  const issue = new URL(req.url).searchParams.get("issue") ?? "";
  if (!SLUG.test(issue)) return NextResponse.json({ counts: {} });
  const { data } = await supabaseAdmin().from("prays").select("team_id").eq("issue_slug", issue).limit(50000);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.team_id] = (counts[r.team_id] ?? 0) + 1;
  return NextResponse.json({ counts }, { headers: { "cache-control": "no-store" } });
}

// One "I'm praying" tap.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const issue = String(b.issue ?? ""), team = String(b.team ?? "");
  if (!SLUG.test(issue) || !team || team.length > 60) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await supabaseAdmin().from("prays").insert({ issue_slug: issue, team_id: team });
  return NextResponse.json({ ok: true });
}
