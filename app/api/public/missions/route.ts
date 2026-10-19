import { loadPublic } from "@/lib/missions-db";

export const dynamic = "force-dynamic";

// The public missions data as JSON, for the website. Only what the missions team marked public:
// private countries are not here at all, and hidden people-group names are blank.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET() {
  try {
    const view = await loadPublic();
    return Response.json(view, { headers: { ...CORS, "cache-control": "public, max-age=0, s-maxage=5, stale-if-error=300" } });
  } catch {
    return Response.json({ error: "Missions data isn't available right now." }, { status: 503, headers: { ...CORS, "cache-control": "no-store" } });
  }
}
