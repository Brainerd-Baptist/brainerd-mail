import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { spellIssues } from "@/lib/spell";
import type { EmailDoc } from "@/lib/blocks";

export const dynamic = "force-dynamic";

// Spelling check for the editor's Check tab. Signed-in staff only; nothing is sent anywhere else.
// Words anyone on the team has marked "Ignore" (names, church words) are kept in spell_words and skipped for everyone.
export async function POST(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  const body = await req.json().catch(() => ({}));

  if (typeof body.ignore === "string") {
    if (w.me.role === "viewer") return NextResponse.json({ error: "Viewers can't change the shared word list." }, { status: 403 });
    const word = body.ignore.trim().toLowerCase();
    if (!/^[\p{L}'’-]{2,40}$/u.test(word)) return NextResponse.json({ error: "That doesn't look like a word." }, { status: 400 });
    await w.sb.from("spell_words").upsert({ word, added_by: w.user.id }, { onConflict: "word" });
    return NextResponse.json({ ok: true });
  }

  const doc = body.doc as EmailDoc | undefined;
  if (!doc || !Array.isArray(doc.blocks)) return NextResponse.json({ error: "Nothing to check." }, { status: 400 });
  const { data } = await w.sb.from("spell_words").select("word");
  const skip = new Set((data ?? []).map((r) => String(r.word).toLowerCase()));
  return NextResponse.json({ issues: spellIssues(doc).filter((i) => !skip.has(i.word.toLowerCase())) });
}
