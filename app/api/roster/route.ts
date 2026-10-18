import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Member } from "@/lib/serving";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Saves the whole roster in the order shown. People removed from the list are deleted.
export async function POST(req: Request) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const list: Partial<Member>[] | null = Array.isArray(body?.members) ? body.members : null;
  if (!list || list.length > 120) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  const now = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const photo = clip(m.photo, 600);
    if (!m.id || !UUID.test(m.id)) return NextResponse.json({ error: "Bad entry" }, { status: 400 });
    if (photo && !/^https:\/\//i.test(photo)) return NextResponse.json({ error: "A photo has not finished uploading. Add it again, then save." }, { status: 400 });
    const who = clip(m.who, 200), region = clip(m.region, 60);
    if (!who || !region) return NextResponse.json({ error: "Every person needs names and a region." }, { status: 400 });
    rows.push({ id: m.id, region, who, place: clip(m.place, 80), deployed: clip(m.deployed, 60), note: clip(m.note, 600), photo_url: photo, hidden: !!m.hidden, sort: i, updated_at: now });
  }

  const sb = supabaseAdmin();
  // Stale-copy guard: refuse to save over changes made since this page was opened.
  const { data: latest } = await sb.from("serving_members").select("updated_at").order("updated_at", { ascending: false }).limit(1);
  const current = latest?.[0]?.updated_at ? new Date(latest[0].updated_at).getTime() : 0;
  const seen = typeof body?.version === "string" ? new Date(body.version).getTime() : NaN;
  if (current && !(seen >= current)) return NextResponse.json({ error: "The list was changed somewhere else since you opened it. Reload this page, then make your edits again.", stale: true }, { status: 409 });

  const { error } = await sb.from("serving_members").upsert(rows);
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 502 });
  const { data: existing } = await sb.from("serving_members").select("id");
  const keep = new Set(rows.map((r) => r.id));
  const gone = (existing ?? []).map((e: { id: string }) => e.id).filter((id) => !keep.has(id));
  if (gone.length) await sb.from("serving_members").delete().in("id", gone);
  revalidatePath("/serving");
  return NextResponse.json({ ok: true, saved: rows.length, version: now });
}
