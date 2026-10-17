import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";

// Runs only when the person presses the button (or their mail app's one-tap Unsubscribe).
// Link scanners only open pages, so they can never unsubscribe anyone by accident.
// Blocks them from THIS ministry's email right away, and adds a task for staff to
// make the matching change in ClearStream by hand.
export async function POST(_: Request, { params }: { params: { token: string } }) {
  const back = (q: string) => NextResponse.redirect(`${siteUrl()}/u/${params.token}?${q}`, { status: 303 });
  if (!/^[0-9a-f]{24}$/.test(params.token)) return back("error=1");
  const admin = supabaseAdmin();
  const { data: r } = await admin.from("recipients").select("email,sends(emails(ministry))").eq("token", params.token).maybeSingle();
  const email = r?.email?.toLowerCase();
  const ministry = (r as any)?.sends?.emails?.ministry as string | undefined;
  if (!email || !ministry) return back("error=1");

  await admin.from("suppressions").upsert({ email, ministry, reason: "unsubscribed" }, { onConflict: "email,ministry", ignoreDuplicates: true });
  const { data: open } = await admin.from("unsubscribe_tasks").select("id").eq("email", email).eq("ministry", ministry).eq("status", "open").limit(1);
  if (!open?.length) await admin.from("unsubscribe_tasks").insert({ email, ministry });
  return back("done=1");
}
