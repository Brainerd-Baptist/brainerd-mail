import { createHash } from "crypto";
import type { Overview } from "@/lib/analytics";
import { numbersOk, type Notes } from "@/lib/insights";

// The written summary for the main Analytics page: a team's emails together, or the whole church for
// Owners and Admins. As with a single email, the numbers and plain rules are worked out here in code and
// Claude only puts them into words. Nothing about individual people is included.

const pc = (x: number | null | undefined, d = 1) => (x == null ? null : Math.round(x * 100 * 10 ** d) / 10 ** d);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function overviewFacts(o: Overview) {
  const t = o.totals;
  const rated = o.emails.filter((e) => e.tally.delivered >= 20 && e.tally.clickRate != null).sort((a, b) => (b.tally.clickRate as number) - (a.tally.clickRate as number));
  const buckets = o.series.filter((s) => s.t.delivered > 0 && s.t.clickRate != null);
  const half = Math.floor(buckets.length / 2);
  const early = avg(buckets.slice(0, half).map((s) => s.t.clickRate as number));
  const late = avg(buckets.slice(buckets.length - half).map((s) => s.t.clickRate as number));
  const trendPts = buckets.length >= 4 && early != null && late != null ? Math.round((late - early) * 1000) / 10 : null;
  const devTotal = o.devices.phone + o.devices.desktop + o.devices.tablet;
  const bestHour = [...o.hours].sort((a, b) => b.clicks - a.clicks)[0];
  const bestDay = [...o.weekdays].sort((a, b) => b.clicks - a.clicks)[0];
  const sendHourBest = o.sendHours.filter((h) => h.sends >= 2 && h.avgClickRate != null).sort((a, b) => (b.avgClickRate as number) - (a.avgClickRate as number))[0];
  const fastTotal = o.timeToClick.reduce((a, b) => a + b.n, 0);
  const multi = o.meta.ministries.length > 1;
  return {
    scope: multi ? "several ministries (church-wide view)" : (o.byMinistry[0]?.label ?? "one ministry"),
    ministriesIncluded: o.byMinistry.map((m) => m.label),
    dataFrom: o.filters.kind === "real" ? "real sends" : o.filters.kind === "test" ? "test sends only" : "real and test sends together",
    range: o.range.from && o.range.to ? `${o.range.from} to ${o.range.to}` : "all time",
    emailsSent: o.emails.length, sends: t.sends,
    peopleEmailed: t.recipients, delivered: t.delivered, peopleWhoClicked: t.clickers, totalClicks: t.clicks,
    clickRatePct: pc(t.clickRate), openRateEstimatePct: pc(t.openRate), unsubscribes: t.unsubs, bouncePct: pc(t.bounceRate),
    previousPeriodClickRatePct: o.previous ? pc(o.previous.clickRate) : null,
    previousPeriodPeopleEmailed: o.previous ? o.previous.recipients : null,
    clickRateTrendPointsFirstHalfToSecondHalf: trendPts,
    smallSample: t.delivered < 100 || o.emails.length < 3,
    bestEmails: rated.slice(0, 3).map((e) => ({ subject: e.subject, ministry: e.ministryLabel, clickRatePct: pc(e.tally.clickRate), peopleEmailed: e.tally.recipients })),
    weakestEmails: rated.length >= 4 ? rated.slice(-2).reverse().map((e) => ({ subject: e.subject, ministry: e.ministryLabel, clickRatePct: pc(e.tally.clickRate), peopleEmailed: e.tally.recipients })) : [],
    byMinistry: multi ? o.byMinistry.filter((m) => m.t.delivered > 0).map((m) => ({ ministry: m.label, peopleEmailed: m.t.recipients, clickRatePct: pc(m.t.clickRate) })) : [],
    topLinks: o.topLinks.slice(0, 3).map((l) => ({ label: l.label, email: l.emailTitle, clicks: l.clicks, pctOfAllClicks: pc(l.share, 0) })),
    phoneSharePct: devTotal ? pc(o.devices.phone / devTotal, 0) : null,
    busiestClickHourET: bestHour && bestHour.clicks > 0 ? bestHour.hour : null,
    busiestClickDay: bestDay && bestDay.clicks > 0 ? bestDay.day : null,
    bestSendHourET: sendHourBest ? { hour: sendHourBest.hour, avgClickRatePct: pc(sendHourBest.avgClickRate), sends: sendHourBest.sends } : null,
    clicksWithinFirstDayPct: fastTotal ? pc(o.timeToClick.slice(0, 3).reduce((a, b) => a + b.n, 0) / fastTotal, 0) : null,
    unsubscribeRatePct: pc(t.unsubRate, 2),
  };
}
export type OFacts = ReturnType<typeof overviewFacts>;

const hourName = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "a.m." : "p.m."}`;

export function overviewRules(f: OFacts): Notes {
  const working: string[] = []; const improve: string[] = [];
  if (!f.peopleEmailed) return { summary: "Nothing has been sent in this view yet, so there's nothing to read.", working, improve };
  let summary = `${f.emailsSent} email${f.emailsSent === 1 ? "" : "s"} reached ${f.peopleEmailed} people${f.dataFrom === "real sends" ? "" : ` (${f.dataFrom})`}, with a ${f.clickRatePct}% click rate.`;
  if (f.previousPeriodClickRatePct != null && f.clickRatePct != null) {
    const d = Math.round((f.clickRatePct - f.previousPeriodClickRatePct) * 10) / 10;
    if (Math.abs(d) >= 0.5) summary += ` That's ${Math.abs(d)} points ${d > 0 ? "up" : "down"} from the period before.`;
  }
  if (f.smallSample) summary += " There isn't much data yet, so treat patterns as hints.";
  if (f.bestEmails[0] && f.emailsSent >= 3) working.push(`"${f.bestEmails[0].subject}" did best (${f.bestEmails[0].clickRatePct}% clicked). Look at what it did differently and repeat it.`);
  if (f.clickRateTrendPointsFirstHalfToSecondHalf != null && f.clickRateTrendPointsFirstHalfToSecondHalf >= 1.5 && !f.smallSample) working.push(`Click rate has been climbing, about ${f.clickRateTrendPointsFirstHalfToSecondHalf} points higher recently than earlier in this range.`);
  if (f.topLinks[0]) working.push(`The most-tapped link was "${f.topLinks[0].label}" (${f.topLinks[0].clicks} click${f.topLinks[0].clicks === 1 ? "" : "s"}).`);
  if (f.clickRateTrendPointsFirstHalfToSecondHalf != null && f.clickRateTrendPointsFirstHalfToSecondHalf <= -1.5 && !f.smallSample) improve.push(`Click rate has slipped, about ${Math.abs(f.clickRateTrendPointsFirstHalfToSecondHalf)} points lower recently. Look at the newest emails: fewer actions and clearer button wording usually help.`);
  if (f.weakestEmails[0] && !f.smallSample) improve.push(`"${f.weakestEmails[0].subject}" had the lowest click rate (${f.weakestEmails[0].clickRatePct}%). Compare it to your best email for subject line, link placement and length.`);
  if (f.bestSendHourET && !f.smallSample) improve.push(`Emails sent around ${hourName(f.bestSendHourET.hour)} Eastern averaged a ${f.bestSendHourET.avgClickRatePct}% click rate, your best sending hour so far.`);
  if (f.phoneSharePct != null && f.phoneSharePct >= 60) improve.push(`${f.phoneSharePct}% of clicks come from phones, so check the phone view before every send.`);
  return { summary, working: working.slice(0, 3), improve: improve.slice(0, 3) };
}

export const hashOverview = (f: OFacts) => createHash("sha1").update(JSON.stringify([f.emailsSent, f.sends, f.peopleEmailed, f.peopleWhoClicked, Math.round(f.totalClicks / 10), f.dataFrom, f.range])).digest("hex").slice(0, 16);

export const keyOverview = (o: Overview) => createHash("sha1").update(JSON.stringify([[...o.meta.ministries].sort(), o.range, o.filters.kind, o.filters.channel, o.filters.device, o.filters.bots])).digest("hex");

export const OSYSTEM = `You help ministry leaders at Brainerd Baptist Church see how their emails are doing overall, in warm, plain language.
You are given FACTS about a set of emails as JSON (one team's emails, or several ministries together). Write:
- summary: two or three sentences on how things are going.
- working: up to 3 things going well (including trends or the best emails).
- improve: up to 3 specific things to try.
Rules:
- Use only numbers that appear in FACTS. Never invent or estimate numbers, dates or causes. Percentages must match FACTS.
- If smallSample is true, say plainly that there isn't much data yet and treat everything as a hint, not a trend.
- Only talk about a trend if clickRateTrendPointsFirstHalfToSecondHalf is given and it is at least 1.5 points either way.
- Compare ministries only when byMinistry has entries. Otherwise talk only about this team's emails.
- Clicks are the number to trust. Open rates are rough estimates, so mention them only lightly.
- Suggestions must be things a person can do in Brainerd Mail: rewrite or shorten a subject, move the main button higher, use fewer links, check the phone view, add preview text, or send at a time FACTS supports. Point to a specific email from FACTS when you can.
- Only say something if one specific fact supports it. Do not pad. If there is little to say, say less.
- Never mention individual people. No headings, bullets or emojis inside the strings. No hype.`;
