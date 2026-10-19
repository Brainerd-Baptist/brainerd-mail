import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_FILTERS, emailReport, overview, type EmailReport } from "@/lib/analytics";
import type { Perm } from "@/lib/roles-ui";

// The written summary on an email's report. The numbers and the plain rules are worked out here in code;
// Claude (see the insights route) only puts them into words and suggests next steps. Nothing about
// individual people is ever included, so every role that can see the report can see this.

export type Notes = { summary: string; working: string[]; improve: string[] };
export type Facts = ReturnType<typeof toFacts>;

const pc = (x: number | null | undefined, d = 1) => (x == null ? null : Math.round(x * 100 * 10 ** d) / 10 ** d);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export async function loadFacts(me: Perm, emailId: string) {
  let kind: "real" | "all" = "real";
  let r = await emailReport(me, { ...DEFAULT_FILTERS, kind }, emailId, false);
  if (!r) return null;
  if (r.t.recipients === 0) { kind = "all"; r = (await emailReport(me, { ...DEFAULT_FILTERS, kind }, emailId, false)) as EmailReport; }
  const sb = supabaseAdmin();
  const { data: row } = await sb.from("emails").select("doc").eq("id", emailId).maybeSingle();
  const doc = (row?.doc ?? {}) as { subject?: string; previewText?: string; blocks?: { hidden?: boolean }[] };

  let baseline: { clickRate: number; emails: number } | null = null;
  try {
    const o = await overview(me, { ...DEFAULT_FILTERS, kind, ministries: [r.email.ministry], from: null, to: null }, false);
    const rates = o.emails.filter((e) => e.emailId !== emailId && e.tally.delivered >= 20 && e.tally.clickRate != null).map((e) => e.tally.clickRate as number);
    const m = median(rates);
    if (m != null && rates.length >= 2) baseline = { clickRate: m, emails: rates.length };
  } catch { /* a missing comparison just means no comparison */ }

  return { r, kind, doc, baseline };
}

export function toFacts(x: NonNullable<Awaited<ReturnType<typeof loadFacts>>>) {
  const { r, kind, doc, baseline } = x;
  const t = r.t;
  const links = r.links.filter((l) => l.inEmail);
  const totalClicks = links.reduce((a, l) => a + l.clicks, 0);
  const n = links.length;
  const third = Math.max(1, Math.ceil(n / 3));
  const top = links.slice(0, third), bottom = links.slice(-third);
  const clicksOf = (ls: typeof links) => ls.reduce((a, l) => a + l.clicks, 0);
  const sorted = [...links].sort((a, b) => b.clicks - a.clicks);
  const dev = r.devices; const devTotal = dev.phone + dev.desktop + dev.tablet;
  const bandClicks = r.firstDays.map((d) => d.clicks); const bandTotal = bandClicks.reduce((a, b) => a + b, 0);
  const peak = [...r.hours].sort((a, b) => b.clicks - a.clicks)[0];
  const subject = doc.subject ?? r.email.subject ?? "";
  const sent = r.sends.length ? r.sends[r.sends.length - 1].at : null;
  const hoursSince = sent ? Math.round((Date.now() - new Date(sent).getTime()) / 3600e3) : null;
  return {
    ministry: r.email.ministryLabel,
    dataFrom: kind === "real" ? "real sends" : "test sends only (not a real send yet)",
    sends: r.sends.length,
    hoursSinceFirstSend: hoursSince,
    peopleEmailed: t.recipients, delivered: t.delivered, peopleWhoClicked: t.clickers, totalClicks: t.clicks,
    clickRatePct: pc(t.clickRate), openRateEstimatePct: pc(t.openRate), clickToOpenPct: pc(t.clickToOpen),
    unsubscribes: r.unsubscribes, bouncePct: pc(t.bounceRate), webViews: r.webViews,
    smallSample: t.delivered < 50 || t.clickers < 10,
    ministryTypicalClickRatePct: baseline ? pc(baseline.clickRate) : null,
    ministryComparisonBasedOnEmails: baseline?.emails ?? 0,
    subjectCharacters: subject.length, hasPreviewText: !!(doc.previewText ?? "").trim(),
    trackedLinks: n,
    links: links.map((l) => ({ position: l.position, block: l.blockType, label: l.label, clicks: l.clicks, peopleWhoClicked: l.unique, pctOfDelivered: pc(l.shareOfDelivered) })),
    topLink: sorted[0] && sorted[0].clicks > 0 ? { label: sorted[0].label, position: sorted[0].position, clicks: sorted[0].clicks, pctOfAllClicks: totalClicks ? pc(sorted[0].clicks / totalClicks, 0) : null } : null,
    linksWithNoClicks: links.filter((l) => l.clicks === 0).map((l) => ({ label: l.label, position: l.position, block: l.blockType })),
    upperThirdSharePct: n >= 3 && totalClicks ? pc(clicksOf(top) / totalClicks, 0) : null,
    lowerThirdSharePct: n >= 3 && totalClicks ? pc(clicksOf(bottom) / totalClicks, 0) : null,
    phoneSharePct: devTotal ? pc(dev.phone / devTotal, 0) : null, desktopSharePct: devTotal ? pc(dev.desktop / devTotal, 0) : null,
    clicksInFirstHourPct: bandTotal ? pc(bandClicks[0] / bandTotal, 0) : null,
    clicksInFirstDayPct: bandTotal ? pc(bandClicks.slice(0, 5).reduce((a, b) => a + b, 0) / bandTotal, 0) : null,
    busiestClickHourET: peak && peak.clicks > 0 ? peak.hour : null,
  };
}

// Plain rules, used when Claude isn't available and as the safety net for its answer.
export function ruleNotes(f: Facts): Notes {
  const working: string[] = []; const improve: string[] = [];
  if (!f.peopleEmailed) return { summary: "This email hasn't been sent yet, so there's nothing to read.", working, improve };
  const cr = f.clickRatePct;
  let summary = `${f.peopleEmailed} people were emailed${f.dataFrom.startsWith("test") ? " (test sends only)" : ""}. ${f.peopleWhoClicked} clicked${cr != null ? `, a ${cr}% click rate` : ""}.`;
  if (f.ministryTypicalClickRatePct != null && cr != null) {
    const d = Math.round((cr - f.ministryTypicalClickRatePct) * 10) / 10;
    summary += Math.abs(d) < 1 ? ` That's about typical for ${f.ministry} (${f.ministryTypicalClickRatePct}%).` : d > 0 ? ` That's ${d} points above ${f.ministry}'s usual ${f.ministryTypicalClickRatePct}%.` : ` That's ${Math.abs(d)} points below ${f.ministry}'s usual ${f.ministryTypicalClickRatePct}%.`;
  }
  if (f.smallSample) summary += " The group is small, so treat patterns as hints, not conclusions.";
  if (f.topLink) working.push(`"${f.topLink.label}" was tapped most (${f.topLink.clicks} click${f.topLink.clicks === 1 ? "" : "s"}${f.topLink.pctOfAllClicks != null ? `, ${f.topLink.pctOfAllClicks}% of all clicks` : ""}).`);
  if (f.clicksInFirstDayPct != null && f.clicksInFirstDayPct >= 70 && f.totalClicks >= 10) working.push(`Most clicks (${f.clicksInFirstDayPct}%) came in the first day, so people are acting while it's fresh.`);
  if (f.ministryTypicalClickRatePct != null && cr != null && cr - f.ministryTypicalClickRatePct >= 2) working.push(`The click rate is above this ministry's usual, so whatever this email did differently is worth repeating.`);
  if (f.linksWithNoClicks.length && f.trackedLinks > 1) {
    const l = f.linksWithNoClicks[0];
    improve.push(`"${l.label}" (link ${l.position} of ${f.trackedLinks}) hasn't been tapped. Try moving it higher, or making the button wording more specific.`);
  }
  if (f.lowerThirdSharePct != null && f.upperThirdSharePct != null && f.lowerThirdSharePct + 5 <= f.upperThirdSharePct && f.totalClicks >= 10) improve.push(`Links near the top got ${f.upperThirdSharePct}% of clicks and links near the bottom ${f.lowerThirdSharePct}%. Put the most important action near the top.`);
  if (f.phoneSharePct != null && f.phoneSharePct >= 60 && f.totalClicks >= 10) improve.push(`${f.phoneSharePct}% of clicks came from phones. Check the phone view, and keep buttons large and wording short.`);
  if (!f.hasPreviewText) improve.push("There's no preview text, so inboxes show random words next to the subject. A short preview line helps people open it.");
  if (f.subjectCharacters > 60) improve.push(`The subject is ${f.subjectCharacters} characters. Phones cut it off, so try getting the key words into the first 40 or so.`);
  if (f.ministryTypicalClickRatePct != null && cr != null && f.ministryTypicalClickRatePct - cr >= 2 && !f.smallSample) improve.push(`Clicks are below this ministry's usual. Try one clear action instead of several, with a button label that says exactly what happens next.`);
  if (f.unsubscribes > 0 && f.peopleEmailed >= 50 && f.unsubscribes / f.peopleEmailed > 0.01) improve.push(`${f.unsubscribes} people unsubscribed. If that keeps happening, consider sending less often or tightening who gets this email.`);
  return { summary, working: working.slice(0, 3), improve: improve.slice(0, 3) };
}

export const hashOf = (f: Facts) => createHash("sha1").update(JSON.stringify([f.peopleEmailed, f.delivered, f.peopleWhoClicked, Math.round(f.totalClicks / 5), f.sends, f.dataFrom, f.subjectCharacters, f.hasPreviewText, f.trackedLinks])).digest("hex").slice(0, 16);

// Every number Claude writes has to match a number we gave it (within rounding). Anything else is dropped.
export function numbersOk(text: string, f: Facts): boolean {
  const have = (JSON.stringify(f).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const used = (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  return used.every((u) => u <= 10 || have.some((h) => Math.abs(h - u) <= 0.51));
}

export const SYSTEM = `You help volunteer and staff ministry leaders at Brainerd Baptist Church understand how an email they sent performed, in warm, plain language.
You are given FACTS about one email as JSON. Write:
- summary: two or three sentences on what happened.
- working: up to 3 things that went well.
- improve: up to 3 specific things to try next time.
Rules:
- Use only the numbers in FACTS. Never invent or estimate numbers, dates or causes. Percentages must match FACTS.
- If smallSample is true, say plainly that the group is small and that patterns are hints, and do not call anything a trend.
- If dataFrom says test sends only, say this reflects test sends, not real readers.
- Clicks are the number to trust. Open rates are rough estimates (Apple Mail and Gmail load images in the background), so mention opens only lightly.
- Suggestions must be things the person can do in Brainerd Mail: move a block or button higher, shorten or rewrite the subject, add preview text, make a button label more specific, use fewer links, check the phone view, or send at a time that FACTS supports. Do not suggest anything FACTS can't support.
- If ministryTypicalClickRatePct is given, compare to it. If not, don't compare.
- Never mention or guess at individual people. Do not use headings, bullets or emojis inside the strings. No hype.
- Only state something if one specific fact supports it. Do not comment on link wording, label names, duplicate-looking links or how many links there are unless FACTS plainly shows a problem. Do not pad: "several people engaged" or "clicks were spread out" is not an insight.
- Compare links by their clicks and position only. A link with zero clicks is only worth mentioning if the email was sent to enough people (not smallSample) or it is clearly the main call to action.
- If there is little to say, say less. One good sentence beats three weak ones.`;

export const TOOL = {
  name: "write_insights",
  description: "Return the written summary for this email.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      working: { type: "array", items: { type: "string" }, maxItems: 3 },
      improve: { type: "array", items: { type: "string" }, maxItems: 3 },
    },
    required: ["summary", "working", "improve"],
  },
} as const;

export function cleanNotes(raw: any, f: Facts): Notes | null {
  if (!raw || typeof raw.summary !== "string") return null;
  const ok = (s: unknown): s is string => typeof s === "string" && s.trim().length > 5 && s.length < 400 && numbersOk(s, f);
  const summary = ok(raw.summary) ? raw.summary.trim() : "";
  if (!summary) return null;
  return {
    summary,
    working: (Array.isArray(raw.working) ? raw.working : []).filter(ok).map((s: string) => s.trim()).slice(0, 3),
    improve: (Array.isArray(raw.improve) ? raw.improve : []).filter(ok).map((s: string) => s.trim()).slice(0, 3),
  };
}
