import { NextResponse } from "next/server";
import { staffAndId } from "@/lib/email-guard";
import { loadFacts, toFacts, ruleNotes, hashOf, cleanNotes, SYSTEM, TOOL, type Notes } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FRESH_MS = 30 * 60 * 1000; // after a change in the numbers, rewrite at most every 30 minutes

type Body = Notes & { source: "claude" | "rules"; thin: boolean; basedOn: { people: number; clickers: number; from: string }; note?: string };

// A written read-out of one email: what happened, what worked, what to try. Same access as the report itself,
// and it never includes anything about individual people.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const w = await staffAndId(params.id);
  if (w.err) return w.err;
  try {
    const x = await loadFacts(w.me, params.id);
    if (!x) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const facts = toFacts(x);
    const hash = hashOf(facts);
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const basedOn = { people: facts.peopleEmailed, clickers: facts.peopleWhoClicked, from: facts.dataFrom };
    if (!facts.peopleEmailed) return NextResponse.json({ ...ruleNotes(facts), source: "rules", thin: true, basedOn, updatedAt: new Date().toISOString() });

    const { data: cached } = await w.sb.from("email_insights").select("facts_hash,body,created_at").eq("email_id", params.id).maybeSingle();
    if (cached && !refresh) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (cached.facts_hash === hash || age < FRESH_MS) return NextResponse.json({ ...(cached.body as Body), basedOn, updatedAt: cached.created_at });
    }
    if (cached && refresh && Date.now() - new Date(cached.created_at).getTime() < 60 * 1000 && cached.facts_hash === hash) {
      return NextResponse.json({ ...(cached.body as Body), basedOn, updatedAt: cached.created_at });
    }

    let notes: Notes = ruleNotes(facts);
    let source: Body["source"] = "rules";
    let note: string | undefined;
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) note = "Showing basic notes. The written summary isn't switched on yet.";
    else {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 40000);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", signal: ctl.signal,
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", max_tokens: 900, system: SYSTEM,
            tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
            messages: [{ role: "user", content: `FACTS:\n${JSON.stringify(facts)}` }],
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const use = (j.content || []).find((c: any) => c.type === "tool_use");
          const clean = cleanNotes(use?.input, facts);
          if (clean) { notes = clean; source = "claude"; }
          else note = "Showing basic notes for now.";
        } else { console.error("insights: Anthropic API returned", res.status); note = "Showing basic notes. The writing helper is unavailable right now."; }
      } catch { note = "Showing basic notes. The writing helper didn't answer in time."; }
      finally { clearTimeout(timer); }
    }
    const body: Body = { ...notes, source, thin: facts.smallSample, basedOn, ...(note ? { note } : {}) };
    // Only keep a written answer; a fallback shouldn't block the next try.
    if (source === "claude") await w.sb.from("email_insights").upsert({ email_id: params.id, facts_hash: hash, body, created_at: new Date().toISOString() });
    return NextResponse.json({ ...body, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("insights failed", e);
    return NextResponse.json({ error: "Couldn't write the summary. Please try again." }, { status: 500 });
  }
}
