import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { spellIssues } from "@/lib/spell";
import type { EmailDoc } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// Spelling check for the editor's Check tab. Signed-in staff only; nothing is sent anywhere else.
export async function POST(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  const body = await req.json().catch(() => ({}));
  const doc = body.doc as EmailDoc | undefined;
  if (!doc || !Array.isArray(doc.blocks)) return NextResponse.json({ error: "Nothing to check." }, { status: 400 });
  return NextResponse.json({ issues: spellIssues(doc) });
}
