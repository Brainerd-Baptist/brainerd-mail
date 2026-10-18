import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { EmailDoc } from "@/lib/blocks";
import { SYSTEM, TOOL, userMessage, validateEdits } from "@/lib/polish-ai";

// "Ask for ideas": staff only, runs only when they tap the button.
export async function POST(req: Request) {
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) {
    const { data } = await supabaseServer().auth.getUser();
    if (!data.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Writing ideas aren't switched on yet (missing ANTHROPIC_API_KEY)." }, { status: 501 });

  const body = await req.json().catch(() => ({}));
  const doc = body.doc as EmailDoc | undefined;
  if (!doc?.blocks?.length) return NextResponse.json({ error: "Nothing to review yet." }, { status: 400 });

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 2000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: userMessage(doc) }],
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "The writing helper is unavailable right now. Try again in a minute." }, { status: 502 });
    const j = await res.json();
    const use = (j.content || []).find((c: any) => c.type === "tool_use");
    return NextResponse.json({ edits: validateEdits(doc, use?.input?.edits) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.name === "AbortError" ? "That took too long. Try again." : "Could not get ideas right now." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
