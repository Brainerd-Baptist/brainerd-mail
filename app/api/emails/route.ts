import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PALETTES } from "@/lib/ministries";
import { blankDoc, octoberDoc, templateDoc } from "@/lib/templates/blank";
import type { EmailDoc } from "@/lib/blocks";

// Creates an email: blank, from the Missions template, or a copy of an existing one.
export async function POST(req: Request) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  let doc: EmailDoc;
  if (typeof body.fromId === "string") {
    const { data: src } = await sb.from("emails").select("doc,title").eq("id", body.fromId).maybeSingle();
    if (!src) return NextResponse.json({ error: "That email no longer exists." }, { status: 404 });
    doc = JSON.parse(JSON.stringify(src.doc));
    doc.title = `${String(src.title || doc.title || "Untitled").replace(/ \(copy\)$/, "")} (copy)`;
  } else {
    const ministry = typeof body.ministry === "string" && PALETTES[body.ministry] ? body.ministry : "church-wide";
    doc = body.start === "october" ? octoberDoc(ministry) : body.start === "starter" || body.start === "template" ? templateDoc(ministry) : blankDoc(ministry);
  }

  const { data: row, error } = await sb.from("emails").insert({ ministry: doc.ministry, title: doc.title || "Untitled", doc, created_by: auth.user.id }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Could not create the email." }, { status: 502 });
  await sb.from("audit_log").insert({ actor: auth.user.id, action: body.fromId ? "duplicate_email" : "create_email", email_id: row.id, detail: {} });
  return NextResponse.json({ ok: true, id: row.id });
}
