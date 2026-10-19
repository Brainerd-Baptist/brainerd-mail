import { supabaseAdmin } from "@/lib/supabase/admin";
import { deviceOf } from "@/lib/tracking";

export const dynamic = "force-dynamic";

// A 1x1 transparent picture at the bottom of each email. When a mail app loads it, we log an open.
// Opens are estimates: Apple Mail loads images for everyone ahead of time, and Gmail loads them through its own proxy.
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const PROXY = /(googleimageproxy|yahoomailproxy|apple-mail|applemail)/i;

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const headers = { "content-type": "image/gif", "cache-control": "no-store, max-age=0", "content-length": String(GIF.length) };
  try {
    const token = params.token.replace(/\.gif$/i, "");
    if (/^[0-9a-f]{24}$/.test(token)) {
      const admin = supabaseAdmin();
      const { data: r } = await admin.from("recipients").select("id,send_id").eq("token", token).maybeSingle();
      if (r) {
        const ua = req.headers.get("user-agent") ?? "";
        await admin.from("opens").insert({ recipient_id: r.id, send_id: r.send_id, device: deviceOf(ua), is_proxy: PROXY.test(ua) });
      }
    }
  } catch {}
  return new Response(GIF, { headers });
}
