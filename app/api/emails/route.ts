import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PALETTES } from "@/lib/ministries";
import { blankDoc, octoberDoc, templateDoc, OCTOBER } from "@/lib/templates/blank";
import type { EmailDoc } from "@/lib/blocks";

// Creates an email: blank, from the Missions template, or a copy of an existing one.
export async function POST(req: Request) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  // Opens a ministry's own email: its most recent unsent one, or a fresh one if it has none.
  if (typeof body.openMinistry === "string" && PALETTES[body.openMinistry]) {
    const m: string = body.openMinistry;
    const { data: found } = await sb.from("emails").select("id").eq("ministry", m).not("status", "in", "(sent,sending,cancelled)").order("updated_at", { ascending: false }).limit(1);
    if (found && found[0]) return NextResponse.json({ ok: true, id: found[0].id, created: false });
    const d = OCTOBER[m] ? octoberDoc(m) : templateDoc(m);
    const { data: made, error: e2 } = await sb.from("emails").insert({ ministry: m, title: d.title || "Untitled", doc: d, created_by: auth.user.id }).select("id").single();
    if (e2 || !made) return NextResponse.json({ error: "Could not open that ministry's email." }, { status: 502 });
    await sb.from("audit_log").insert({ actor: auth.user.id, action: "create_email", email_id: made.id, detail: { via: "switcher" } });
    return NextResponse.json({ ok: true, id: made.id, created: true });
  }

  // Starting from a repeating slot: begin as a copy of the last email in that series, so only what's new changes.
  let seriesId: string | null = null;
  if (typeof body.slotId === "string" && /^[0-9a-f-]{36}$/i.test(body.slotId) && typeof body.fromId !== "string") {
    const { data: slot } = await sb.from("send_slots").select("series_id").eq("id", body.slotId).maybeSingle();
    if (slot?.series_id) {
      seriesId = slot.series_id;
      const { data: last } = await sb.from("emails").select("id").eq("series_id", slot.series_id).order("updated_at", { ascending: false }).limit(1);
      if (last && last[0]) body.fromId = last[0].id;
    }
  }

  let doc: EmailDoc;
  if (typeof body.fromId === "string") {
    const { data: src } = await sb.from("emails").select("doc,title").eq("id", body.fromId).maybeSingle();
    if (!src) return NextResponse.json({ error: "That email no longer exists." }, { status: 404 });
    doc = JSON.parse(JSON.stringify(src.doc));
    doc.title = seriesId ? String(src.title || doc.title || "Untitled").replace(/ \(copy\)$/, "") : `${String(src.title || doc.title || "Untitled").replace(/ \(copy\)$/, "")} (copy)`;
  } else {
    const ministry = typeof body.ministry === "string" && PALETTES[body.ministry] ? body.ministry : "church-wide";
    doc = body.start === "october" ? octoberDoc(ministry) : body.start === "starter" || body.start === "template" ? templateDoc(ministry) : blankDoc(ministry);
  }

  // From the calendar: start an email for a day and time (and claim the open slot it came from).
  const plan = typeof body.plannedAt === "string" && !isNaN(new Date(body.plannedAt).getTime()) ? new Date(body.plannedAt).toISOString() : null;
  const { data: row, error } = await sb.from("emails").insert({ ministry: doc.ministry, title: doc.title || "Untitled", doc, created_by: auth.user.id, planned_at: plan, series_id: seriesId }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Could not create the email." }, { status: 502 });
  if (typeof body.slotId === "string" && /^[0-9a-f-]{36}$/i.test(body.slotId)) await sb.from("send_slots").update({ email_id: row.id }).eq("id", body.slotId);
  await sb.from("audit_log").insert({ actor: auth.user.id, action: body.fromId ? "duplicate_email" : "create_email", email_id: row.id, detail: {} });
  return NextResponse.json({ ok: true, id: row.id });
}
