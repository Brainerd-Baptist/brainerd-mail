import { resolveAction } from "@/lib/review-core";
import { renderFor } from "@/lib/tracking";

export const dynamic = "force-dynamic";

// The email as it will look, for the approval page. Same signed link as the buttons.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const r = await resolveAction(params.token);
  if (r.state !== "ok") return new Response("This preview isn’t available.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  const html = renderFor(r.row.doc, new Map(), "preview", "000000000000").html;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
}
