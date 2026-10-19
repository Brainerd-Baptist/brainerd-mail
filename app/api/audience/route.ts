import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { canManageTeam } from "@/lib/roles-ui";
import { PALETTES } from "@/lib/ministries";
import { fetchLists, ClearstreamError } from "@/lib/clearstream";
import { runCheck } from "@/lib/audience";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (e: any) => {
  if (e instanceof ClearstreamError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "not_configured" ? 200 : 502 });
  return NextResponse.json({ error: e?.message || "Something went wrong." }, { status: 500 });
};

// Owner and admins. GET: each ministry's saved list and latest check. GET ?lists=1: also the lists in ClearStream.
export async function GET(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  if (!canManageTeam(w.me)) return NextResponse.json({ error: "Owner and admins only" }, { status: 403 });
  const { data: maps } = await w.sb.from("audience_lists").select("ministry,list_id,list_name,expected");
  const out = [];
  for (const p of Object.values(PALETTES)) {
    const m = (maps ?? []).find((x) => x.ministry === p.key);
    let latest: any = null;
    if (m) {
      const { data } = await w.sb.from("audience_snapshots").select("taken_at,total,email_ok").eq("ministry", p.key).order("taken_at", { ascending: false }).limit(1).maybeSingle();
      latest = data;
    }
    out.push({ ministry: p.key, label: p.label, list_id: m?.list_id ?? null, list_name: m?.list_name ?? null, expected: m?.expected ?? null, latest });
  }
  const configured = !!process.env.CLEARSTREAM_API_KEY;
  let lists: any[] | null = null, listsError: string | null = null;
  if (new URL(req.url).searchParams.get("lists") && configured) {
    try { lists = await fetchLists(); } catch (e: any) { listsError = e?.message || "Couldn't load the lists."; }
  }
  return NextResponse.json({ configured, ministries: out, lists, listsError });
}

// Check now: pull the list from ClearStream and compare.
export async function POST(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  if (!canManageTeam(w.me)) return NextResponse.json({ error: "Owner and admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!Object.values(PALETTES).some((p) => p.key === b.ministry)) return NextResponse.json({ error: "Unknown ministry" }, { status: 400 });
  try {
    const check = await runCheck(b.ministry, w.user.id);
    await w.sb.from("audit_log").insert({ actor: w.user.id, action: "audience_check", detail: { ministry: b.ministry, total: check.total, mail: check.mailCount } });
    return NextResponse.json({ check });
  } catch (e) { return fail(e); }
}

// Choose the ClearStream list for a ministry and the headcount you expect.
export async function PATCH(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  if (!canManageTeam(w.me)) return NextResponse.json({ error: "Owner and admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!Object.values(PALETTES).some((p) => p.key === b.ministry)) return NextResponse.json({ error: "Unknown ministry" }, { status: 400 });
  const { data: cur } = await w.sb.from("audience_lists").select("list_id,list_name,expected").eq("ministry", b.ministry).maybeSingle();
  const listId = b.list_id !== undefined ? String(b.list_id || "") : (cur?.list_id as string | undefined) ?? "";
  if (!listId) return NextResponse.json({ error: "Choose a list first." }, { status: 400 });
  let expected: number | null = (cur?.expected as number | null) ?? null;
  if (b.expected !== undefined) {
    if (b.expected === null || b.expected === "") expected = null;
    else { const n = Math.floor(Number(b.expected)); if (!Number.isFinite(n) || n < 0 || n > 100000) return NextResponse.json({ error: "Enter a whole number." }, { status: 400 }); expected = n; }
  }
  const { error } = await w.sb.from("audience_lists").upsert({ ministry: b.ministry, list_id: listId, list_name: b.list_name !== undefined ? String(b.list_name).slice(0, 120) : (cur?.list_name as string) ?? "", expected, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
