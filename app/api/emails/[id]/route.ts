import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { snapshot } from "@/lib/versions";
import type { EmailDoc } from "@/lib/blocks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELETABLE = ["draft", "cancelled"];

async function guard(id: string) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return { err: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  if (!UUID.test(id)) return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { user: auth.user };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const g = await guard(params.id);
  if (g.err) return g.err;
  const { data } = await supabaseAdmin().from("emails").select("id,doc,status,updated_at,review_note,scheduled_at,planned_at,expedited,approved_at").eq("id", params.id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: data.id, doc: data.doc, status: data.status, version: data.updated_at, reviewNote: data.review_note, scheduledAt: data.scheduled_at, plannedAt: data.planned_at, expedited: data.expedited, approvedAt: data.approved_at });
}

// Autosave. `version` is the updated_at this copy was loaded from: if the email changed
// somewhere else since, refuse instead of overwriting newer work.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await guard(params.id);
  if (g.err) return g.err;
  const body = await req.json().catch(() => null);
  const doc = body?.doc as EmailDoc | undefined;
  if (!doc || !Array.isArray(doc.blocks) || typeof doc.ministry !== "string") return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: row } = await sb.from("emails").select("status,updated_at,doc").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "This email was deleted." , gone: true }, { status: 404 });
  if (row.status !== "draft") return NextResponse.json({ error: row.status === "pending_approval" || row.status === "approved" ? "This email was sent for approval, so it can’t be changed. Use Edit to return it to a draft first." : "This email has already gone out. Duplicate it to make changes.", locked: true }, { status: 409 });
  const seen = typeof body.version === "string" ? new Date(body.version).getTime() : NaN;
  if (!(seen >= new Date(row.updated_at).getTime())) return NextResponse.json({ error: "This email was changed on another device or tab. Reload to get the latest.", stale: true }, { status: 409 });

  const now = new Date().toISOString();
  const { error } = await sb.from("emails").update({ doc, title: (doc.title || "Untitled").slice(0, 200), ministry: doc.ministry, updated_at: now }).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 502 });
  await snapshot(sb, params.id, row.doc, g.user!.id, "Auto-saved copy", 15);
  return NextResponse.json({ ok: true, version: now });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const g = await guard(params.id);
  if (g.err) return g.err;
  const sb = supabaseAdmin();
  const { data: row } = await sb.from("emails").select("status,title").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ ok: true });
  if (!DELETABLE.includes(row.status)) return NextResponse.json({ error: "Emails that were sent are kept for the record." }, { status: 409 });
  const { error } = await sb.from("emails").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not delete." }, { status: 502 });
  await sb.from("audit_log").insert({ actor: g.user!.id, action: "delete_email", detail: { title: row.title } });
  return NextResponse.json({ ok: true });
}
