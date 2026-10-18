import { NextResponse } from "next/server";
import { staffAndId, UUID } from "@/lib/email-guard";
import { snapshot } from "@/lib/versions";
import { summarizeChange } from "@/lib/doc-diff";

// GET: the list (or one version's content with ?v=). POST: save a copy of the current email now.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const v = new URL(req.url).searchParams.get("v");
  if (v) {
    if (!UUID.test(v)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data } = await g.sb.from("email_versions").select("id,doc,created_at,note").eq("id", v).eq("email_id", params.id).maybeSingle();
    return data ? NextResponse.json(data) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data } = await g.sb.from("email_versions").select("id,created_at,note,named,saved_by,doc").eq("email_id", params.id).order("created_at", { ascending: false }).limit(60);
  const rows = data ?? [];
  const ids = Array.from(new Set(rows.map((r) => r.saved_by).filter(Boolean)));
  const { data: staff } = ids.length ? await g.sb.from("staff").select("user_id,name,email").in("user_id", ids) : { data: [] as { user_id: string; name: string | null; email: string }[] };
  const who = new Map((staff ?? []).map((s) => [s.user_id, s.name || s.email.split("@")[0]]));
  const versions = rows.map((r, i) => ({
    id: r.id, created_at: r.created_at, note: r.note, named: r.named,
    by: r.saved_by ? who.get(r.saved_by) ?? null : null,
    subject: r.doc?.subject ?? null,
    summary: i + 1 < rows.length ? summarizeChange(rows[i + 1].doc, r.doc) : "First saved copy",
  }));
  return NextResponse.json({ versions });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const body = await req.json().catch(() => ({}));
  const { data: row } = await g.sb.from("emails").select("doc").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.auto) {
    // Idle snapshot: skip if nothing changed since the last copy.
    const { data: last } = await g.sb.from("email_versions").select("doc").eq("email_id", params.id).order("created_at", { ascending: false }).limit(1);
    if (last?.[0] && JSON.stringify(last[0].doc) === JSON.stringify(row.doc)) return NextResponse.json({ ok: true, skipped: true });
  }
  const named = body.named === true;
  await snapshot(g.sb, params.id, row.doc, g.user.id, typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 80) : "Saved copy", 0, named);
  return NextResponse.json({ ok: true });
}

// Name (or rename) a version. Named versions are kept permanently.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const v = new URL(req.url).searchParams.get("v") ?? "";
  if (!UUID.test(v)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 80) : "";
  const { error } = await g.sb.from("email_versions").update(note ? { note, named: true } : { note: "Saved copy", named: false }).eq("id", v).eq("email_id", params.id);
  if (error) return NextResponse.json({ error: "Could not rename." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
