import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/access";
import { FeedbackInbox, type Note } from "@/components/FeedbackInbox";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const { data } = await supabaseServer().auth.getUser();
  if (!isAdminEmail(data.user?.email)) redirect("/");
  const { data: rows } = await supabaseAdmin().from("feedback").select("*").order("created_at", { ascending: false }).limit(300);
  return <FeedbackInbox initial={(rows ?? []) as Note[]} />;
}
