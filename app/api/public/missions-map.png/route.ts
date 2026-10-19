import { Resvg } from "@resvg/resvg-js";
import { loadPublic } from "@/lib/missions-db";
import { staticMapSvg, type Level } from "@/lib/missions";

export const dynamic = "force-dynamic";

// The map as a picture, for emails (email apps can't run the interactive map).
// ?level=1|2|3 colors only that level. Shows the public view only. Cached for a few minutes.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lv = Number(q.get("level"));
  const level = lv === 1 || lv === 2 || lv === 3 ? (lv as Level) : null;
  try {
    const svg = staticMapSvg(await loadPublic(), { level });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=300, s-maxage=300, stale-if-error=3600", "access-control-allow-origin": "*" } });
  } catch {
    return new Response("Map unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }
}
