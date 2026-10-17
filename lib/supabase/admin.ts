import { createClient } from "@supabase/supabase-js";

// Server-only client with full access. Used by public routes (tracked links,
// unsubscribe, web version) and by the sign-in step. Never import in browser code.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server key is not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
