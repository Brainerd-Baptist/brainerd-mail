import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fromRow, levelsFromRows, publicView, type Country, type CountryRow, type LevelInfo, type LevelRow, type PublicView } from "@/lib/missions";

// Everything, including countries kept private. Signed-in staff screens only.
export async function loadAll(): Promise<{ countries: Country[]; levels: LevelInfo[] }> {
  const db = supabaseAdmin();
  const [c, l] = await Promise.all([
    db.from("missions_countries").select("*").order("name", { ascending: true }),
    db.from("missions_levels").select("*").order("level", { ascending: true }),
  ]);
  if (c.error) throw new Error("Could not read countries");
  return { countries: ((c.data ?? []) as CountryRow[]).map(fromRow), levels: levelsFromRows((l.data ?? []) as LevelRow[]) };
}

// What visitors and emails may see (private countries and hidden people groups already removed).
export async function loadPublic(): Promise<PublicView> {
  const { countries, levels } = await loadAll();
  return publicView(countries, levels);
}

// After any change: refresh Brainerd Mail's own pages, and, if the website has an address set up for it,
// tell the website so its missions page refreshes within seconds. Never blocks or fails the save.
export async function afterMissionsSave() {
  try { revalidatePath("/missions"); } catch {}
  const url = process.env.WEBSITE_REVALIDATE_URL, secret = process.env.WEBSITE_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify({ source: "brainerd-mail", what: "missions-map" }), signal: AbortSignal.timeout(4000) });
  } catch {}
}
