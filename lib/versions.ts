import type { SupabaseClient } from "@supabase/supabase-js";

// Saves a restorable copy of an email. `minGapMinutes` avoids a copy on every autosave.
export async function snapshot(sb: SupabaseClient, emailId: string, doc: unknown, userId: string | null, note: string, minGapMinutes = 0) {
  if (minGapMinutes > 0) {
    const { data } = await sb.from("email_versions").select("created_at").eq("email_id", emailId).order("created_at", { ascending: false }).limit(1);
    if (data?.[0] && Date.now() - new Date(data[0].created_at).getTime() < minGapMinutes * 60000) return;
  }
  await sb.from("email_versions").insert({ email_id: emailId, doc, saved_by: userId, note });
  const { data: old } = await sb.from("email_versions").select("id").eq("email_id", emailId).order("created_at", { ascending: false }).range(60, 500);
  if (old?.length) await sb.from("email_versions").delete().in("id", old.map((o: { id: string }) => o.id));
}
