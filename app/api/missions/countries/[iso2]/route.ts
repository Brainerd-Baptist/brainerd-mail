import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentMe, canEditMissions } from "@/lib/roles";
import { cleanCountry, fromRow, toRow, type CountryRow } from "@/lib/missions";
import { afterMissionsSave } from "@/lib/missions-db";

const ISO = /^[A-Z]{2}$/;

async function who() {
  const { data } = await supabaseServer().auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const me = await currentMe();
  if (!me || !canEditMissions(me)) return { error: NextResponse.json({ error: "Your role can look at the Missions map but not change it." }, { status: 403 }) } as const;
  return { id: data.user.id } as const;
}

// Add a country or save changes to one. Saved changes show on the public map within seconds.
export async function PUT(req: Request, { params }: { params: { iso2: string } }) {
  const iso2 = params.iso2.toUpperCase();
  if (!ISO.test(iso2)) return NextResponse.json({ error: "Bad country" }, { status: 400 });
  const w = await who(); if ("error" in w) return w.error;
  const body = await req.json().catch(() => null);
  const clean = cleanCountry(iso2, body);
  if (!clean.ok) return NextResponse.json({ error: clean.error }, { status: 400 });

  const db = supabaseAdmin();
  const { data: before } = await db.from("missions_countries").select("*").eq("iso2", iso2).maybeSingle();
  // Stale-copy guard: refuse to save over a change someone else made since this person opened the page.
  const seen = typeof (body as { version?: unknown })?.version === "string" ? (body as { version: string }).version : null;
  if (before && seen !== before.updated_at && !(seen && new Date(seen).getTime() === new Date(before.updated_at).getTime())) {
    return NextResponse.json({ error: `${before.name} was changed somewhere else since you opened it. Reload this page, then make your edit again.`, stale: true }, { status: 409 });
  }
  if (!before && seen) return NextResponse.json({ error: "That country was removed somewhere else. Reload this page.", stale: true }, { status: 409 });

  const row = toRow(clean.value, w.id);
  const { data, error } = await db.from("missions_countries").upsert(row).select("*").single();
  if (error || !data) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  const changed = before ? Object.keys(row).filter((k) => !["updated_at", "updated_by"].includes(k) && (before as Record<string, unknown>)[k] !== (row as Record<string, unknown>)[k]) : ["added"];
  await db.from("audit_log").insert({ actor: w.id, action: before ? "missions_country_update" : "missions_country_add", detail: { iso2, name: clean.value.name, changed } });
  await afterMissionsSave();
  return NextResponse.json({ ok: true, country: fromRow(data as CountryRow) });
}

export async function DELETE(_req: Request, { params }: { params: { iso2: string } }) {
  const iso2 = params.iso2.toUpperCase();
  if (!ISO.test(iso2)) return NextResponse.json({ error: "Bad country" }, { status: 400 });
  const w = await who(); if ("error" in w) return w.error;
  const db = supabaseAdmin();
  const { data: before } = await db.from("missions_countries").select("name").eq("iso2", iso2).maybeSingle();
  const { error } = await db.from("missions_countries").delete().eq("iso2", iso2);
  if (error) return NextResponse.json({ error: "Could not remove. Please try again." }, { status: 502 });
  await db.from("audit_log").insert({ actor: w.id, action: "missions_country_remove", detail: { iso2, name: before?.name ?? iso2 } });
  await afterMissionsSave();
  return NextResponse.json({ ok: true });
}
