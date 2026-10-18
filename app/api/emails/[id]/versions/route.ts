import { NextResponse } from "next/server";
import { staffAndId, UUID } from "@/lib/email-guard";
import { snapshot } from "@/lib/versions";

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
  const { data } = await g.sb.from("email_versions").select("id,created_at,note,subject:doc->>subject,title:doc->>title").eq("email_id", params.id).order("created_at", { ascending: false }).limit(60);
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await staffAndId(params.id);
  if (g.err) return g.err;
  const body = await req.json().catch(() => ({}));
  const { data: row } = await g.sb.from("emails").select("doc").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await snapshot(g.sb, params.id, row.doc, g.user.id, typeof body.note === "string" ? body.note.slice(0, 80) : "Saved copy");
  return NextResponse.json({ ok: true });
}
