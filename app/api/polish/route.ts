import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { meFor, canBuild } from "@/lib/roles";
import type { EmailDoc } from "@/lib/blocks";
import { SYSTEM, TOOL, userMessage, validateEdits } from "@/lib/polish-ai";

// "Ask for ideas": staff only, runs only when they tap the button.
export async function POST(req: Request) {
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) {
    const { data } = await supabaseServer().auth.getUser();
    if (!data.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const me = await meFor(data.user.id);
    if (!me || !canBuild(me)) return NextResponse.json({ error: "Your role can't use writing ideas." }, { status: 403 });
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
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 400);
      console.error("polish: Anthropic API returned", res.status, detail);
      const msg =
        res.status === 401 ? "The Anthropic key isn’t being accepted. Check ANTHROPIC_API_KEY in Vercel."
        : /credit|billing/i.test(detail) ? "The Anthropic account is out of credit. Add billing in the Anthropic Console."
        : res.status === 404 ? "The writing model name isn’t recognized. Set ANTHROPIC_MODEL in Vercel."
        : "The writing helper is unavailable right now. Try again in a minute.";
      return NextResponse.json({ error: msg, status: res.status }, { status: 502 });
    }
    const j = await res.json();
    const use = (j.content || []).find((c: any) => c.type === "tool_use");
    return NextResponse.json({ edits: validateEdits(doc, use?.input?.edits) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.name === "AbortError" ? "That took too long. Try again." : "Could not get ideas right now." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
