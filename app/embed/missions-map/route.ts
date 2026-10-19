import { loadPublic } from "@/lib/missions-db";
import { MAP_H, MAP_W, mapShapes } from "@/lib/missions";

export const dynamic = "force-dynamic";

// The live, interactive missions map. The website shows this in a frame, so a change saved in
// Brainerd Mail shows up here within seconds. Add ?standalone=1 to open it as a full page.
// Safe to frame from any page: it only shows what the missions team marked public.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const standalone = q.get("standalone") === "1";
  const lv = Number(q.get("level"));
  const initial = { level: lv === 1 || lv === 2 || lv === 3 ? lv : 0, view: q.get("view") === "list" ? "list" : "map" };
  try {
    const view = await loadPublic();
    const { base, hit } = mapShapes(view.countries.map((c) => c.id));
    const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
    const data = JSON.stringify({ W: MAP_W, H: MAP_H, base, hit, countries: view.countries, levels: view.levels, counts: view.counts, initial })
      .replace(/</g, "\\u003c").split(LS).join("\\u2028").split(PS).join("\\u2029");
    const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brainerd Missions Map</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap">
<link rel="stylesheet" href="/embed/missions-map.css">
</head><body${standalone ? ' class="standalone"' : ""}>
<section class="mm" id="mm" aria-labelledby="mm-title"></section>
<script id="mm-data" type="application/json">${data}</script>
<script src="/embed/missions-map.js"></script>
<noscript><p style="font-family:sans-serif;padding:20px">The interactive map needs JavaScript. Visit brainerdbaptist.org/missions to learn where we serve.</p></noscript>
</body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=5, stale-if-error=300", "content-security-policy": "frame-ancestors *" } });
  } catch {
    return new Response("The map isn't available right now.", { status: 503, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
  }
}
