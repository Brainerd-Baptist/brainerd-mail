import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentMe, canEditMissions } from "@/lib/roles";
import { cleanLevels } from "@/lib/missions";
import { afterMissionsSave } from "@/lib/missions-db";

// Saves what each level is called and means (the legend on the public map).
export async function PUT(req: Request) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const me = await currentMe();
  if (!me || !canEditMissions(me)) return NextResponse.json({ error: "Your role can look at the Missions map but not change it." }, { status: 403 });
  const levels = cleanLevels(await req.json().catch(() => null));
  if (!levels) return NextResponse.json({ error: "Something is missing from the levels." }, { status: 400 });
  const db = supabaseAdmin();
  const { error } = await db.from("missions_levels").upsert(levels.map((l) => ({ level: l.level, label: l.label, blurb: l.blurb, updated_at: new Date().toISOString() })));
  if (error) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  await db.from("audit_log").insert({ actor: auth.user.id, action: "missions_levels_update", detail: { labels: levels.map((l) => l.label) } });
  await afterMissionsSave();
  return NextResponse.json({ ok: true, levels });
}
