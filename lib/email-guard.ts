import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runChecks } from "@/lib/checks";
import { renderFor } from "@/lib/tracking";
import { CHURCH_ADDRESS } from "@/lib/church";
import { meFor, canBuildIn, type Me } from "@/lib/roles";
import type { EmailDoc } from "@/lib/blocks";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NO_ACCESS = "Your access to Brainerd Mail has changed. Sign in again, or ask the owner.";

// The signed-in person with their current role, or a ready-made error response.
// Everything is re-checked on every request, so a change of role or a deactivation takes effect right away.
export async function whoAmI() {
  const { data: auth } = await supabaseServer().auth.getUser();
  if (!auth.user) return { err: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const me = await meFor(auth.user.id);
  if (!me) return { err: NextResponse.json({ error: NO_ACCESS }, { status: 403 }) } as const;
  return { user: auth.user, me, sb: supabaseAdmin() } as const;
}

// Signed-in staff member + a valid email id, or a ready-made error response.
export async function staffAndId(id: string) {
  const w = await whoAmI();
  if (w.err) return w;
  if (!UUID.test(id)) return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return w;
}

export const forbidden = (ministryLabel?: string) =>
  NextResponse.json({ error: ministryLabel ? `You can view ${ministryLabel}, but only people assigned to it can change it.` : "Your role can look at this but not change it." }, { status: 403 });

// Can this person change emails in that ministry? Null means yes; otherwise the error to return.
export function needBuild(me: Me, ministry: string) {
  if (canBuildIn(me, ministry)) return null;
  return me.role === "viewer" ? forbidden() : forbidden(ministry.replace(/-/g, " "));
}

// Same, for an existing email (looks up its ministry).
export async function requireBuild(sb: ReturnType<typeof supabaseAdmin>, me: Me, emailId: string) {
  const { data } = await sb.from("emails").select("ministry").eq("id", emailId).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return needBuild(me, data.ministry as string);
}

// The same blocking checks the editor shows, run on the server so they can't be skipped.
export function blockingChecks(doc: EmailDoc) {
  const preview = renderFor(doc, new Map(), "preview", "000000000000");
  return runChecks(doc, Buffer.byteLength(preview.html), CHURCH_ADDRESS).filter((c) => !c.ok && c.severity === "block");
}
