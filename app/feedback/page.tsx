import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentMe, canSeeFeedback } from "@/lib/roles";
import { FeedbackInbox, type Note } from "@/components/FeedbackInbox";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const me = await currentMe();
  if (!me || !canSeeFeedback(me)) redirect("/");
  const { data: rows } = await supabaseAdmin().from("feedback").select("*").order("created_at", { ascending: false }).limit(300);
  return <FeedbackInbox initial={(rows ?? []) as Note[]} />;
}
