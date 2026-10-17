import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BOT_UA, deviceOf } from "@/lib/tracking";

const UUID = /^[0-9a-f-]{36}$/i;

// Counts the click, then sends the reader on to the real address. Never blocks the reader:
// if counting fails, they still get where they were going.
export async function GET(req: Request, { params }: { params: { token: string; link: string } }) {
  const fallback = process.env.NEXT_PUBLIC_SITE_URL || "https://brainerdbaptist.org";
  if (!UUID.test(params.link)) return NextResponse.redirect(fallback, 302);
  try {
    const admin = supabaseAdmin();
    const { data: link } = await admin.from("links").select("id,url").eq("id", params.link).maybeSingle();
    if (!link || !/^https?:\/\//i.test(link.url)) return NextResponse.redirect(fallback, 302);

    const ua = req.headers.get("user-agent") ?? "";
    let recipient: { id: string; send_id: string } | null = null;
    if (params.token !== "web") {
      const { data } = await admin.from("recipients").select("id,send_id").eq("token", params.token).maybeSingle();
      recipient = data;
    }
    await admin.from("clicks").insert({
      link_id: link.id, recipient_id: recipient?.id ?? null, send_id: recipient?.send_id ?? null,
      channel: params.token === "web" ? "web" : "email", device: deviceOf(ua), is_bot: BOT_UA.test(ua),
    });
    return NextResponse.redirect(link.url, 302);
  } catch {
    return NextResponse.redirect(fallback, 302);
  }
}
