import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runChecks } from "@/lib/checks";
import { renderFor } from "@/lib/tracking";
import { CHURCH_ADDRESS } from "@/lib/church";
import type { EmailDoc } from "@/lib/blocks";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Signed-in staff member + a valid email id, or a ready-made error response.
export async function staffAndId(id: string) {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return { err: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  if (!UUID.test(id)) return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return { user: auth.user, sb: supabaseAdmin() } as const;
}

// The same blocking checks the editor shows, run on the server so they can't be skipped.
export function blockingChecks(doc: EmailDoc) {
  const preview = renderFor(doc, new Map(), "preview", "000000000000");
  return runChecks(doc, Buffer.byteLength(preview.html), CHURCH_ADDRESS).filter((c) => !c.ok && c.severity === "block");
}
