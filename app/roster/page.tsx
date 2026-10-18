import { supabaseAdmin } from "@/lib/supabase/admin";
import { fromRow, type Row } from "@/lib/serving";
import { RosterEditor } from "@/components/RosterEditor";

export const dynamic = "force-dynamic";

// Signed-in staff only (middleware.ts). Edits the list shown at /serving.
export default async function RosterPage() {
  const { data } = await supabaseAdmin().from("serving_members").select("*").order("sort", { ascending: true });
  return <RosterEditor initial={((data ?? []) as Row[]).map(fromRow)} />;
}
