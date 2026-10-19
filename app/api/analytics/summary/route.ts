import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { overview, parseFilters } from "@/lib/analytics";
import { cleanNotes, TOOL, type Notes } from "@/lib/insights";
import { overviewFacts, overviewRules, hashOverview, keyOverview, OSYSTEM } from "@/lib/overview-insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FRESH_MS = 30 * 60 * 1000;
type Body = Notes & { source: "claude" | "rules"; thin: boolean; note?: string };

// A written read-out of whatever the Analytics page is showing. Scope comes from the person's role, the same
// as the numbers themselves: ministry editors see their own ministries, Owners and Admins can see everything.
export async function GET(req: Request) {
  const w = await whoAmI();
  if (w.err) return w.err;
  try {
    const sp = new URL(req.url).searchParams;
    const o = await overview(w.me, parseFilters(sp), false);
    const facts = overviewFacts(o);
    const basedOn = { emails: facts.emailsSent, people: facts.peopleEmailed, from: facts.dataFrom, scope: facts.scope };
    if (!facts.peopleEmailed) return NextResponse.json({ ...overviewRules(facts), source: "rules", thin: true, basedOn, updatedAt: new Date().toISOString() });

    const key = keyOverview(o), hash = hashOverview(facts), refresh = sp.get("refresh") === "1";
    const { data: cached } = await w.sb.from("analytics_insights").select("facts_hash,body,created_at").eq("key", key).maybeSingle();
    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (!refresh ? cached.facts_hash === hash || age < FRESH_MS : cached.facts_hash === hash && age < 60 * 1000) return NextResponse.json({ ...(cached.body as Body), basedOn, updatedAt: cached.created_at });
    }

    let notes: Notes = overviewRules(facts); let source: Body["source"] = "rules"; let note: string | undefined;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) note = "Showing basic notes. The written summary isn't switched on yet.";
    else {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 40000);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", signal: ctl.signal,
          headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", max_tokens: 900, system: OSYSTEM, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content: `FACTS:\n${JSON.stringify(facts)}` }] }),
        });
        if (res.ok) {
          const j = await res.json(); const use = (j.content || []).find((c: any) => c.type === "tool_use");
          const clean = cleanNotes(use?.input, facts);
          if (clean) { notes = clean; source = "claude"; } else note = "Showing basic notes for now.";
        } else { console.error("summary: Anthropic API returned", res.status); note = "Showing basic notes. The writing helper is unavailable right now."; }
      } catch { note = "Showing basic notes. The writing helper didn't answer in time."; } finally { clearTimeout(timer); }
    }
    const body: Body = { ...notes, source, thin: facts.smallSample, ...(note ? { note } : {}) };
    if (source === "claude") await w.sb.from("analytics_insights").upsert({ key, facts_hash: hash, body, created_at: new Date().toISOString() });
    return NextResponse.json({ ...body, basedOn, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("analytics summary failed", e);
    return NextResponse.json({ error: "Couldn't write the summary. Please try again." }, { status: 500 });
  }
}
