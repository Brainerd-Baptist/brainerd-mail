import { supabaseAdmin } from "@/lib/supabase/admin";
import { EmailList, type Item } from "@/components/EmailList";
import { currentMe } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Emails | Brainerd Mail" };

// Home screen: every email, newest edit first. Signed-in staff only (middleware.ts).
export default async function EmailsPage() {
  const me = await currentMe();
  const { data } = await supabaseAdmin()
    .from("emails")
    .select("id,ministry,title,status,updated_at,scheduled_at,expedited,subject:doc->>subject")
    .order("updated_at", { ascending: false })
    .limit(300);
  return <EmailList initial={(data ?? []) as unknown as Item[]} perm={{ role: me?.role ?? "viewer", ministries: me?.ministries ?? [] }} />;
}
