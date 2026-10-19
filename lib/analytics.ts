// Analytics: turns the raw send / open / click rows into the numbers the Analytics screens show.
// Server only. Everything is computed from the database on request; nothing is cached.
import { supabaseAdmin } from "./supabase/admin";
import { PALETTES } from "./ministries";
import type { Perm } from "./roles-ui";
import { analyticsMinistries } from "./roles-ui";

type Admin = ReturnType<typeof supabaseAdmin>;

export type Kind = "real" | "test" | "all";
export type Filters = {
  from: string | null; // yyyy-mm-dd (Eastern), inclusive
  to: string | null;
  ministries: string[]; // empty = all the person may see
  kind: Kind;
  channel: "all" | "email" | "text";
  device: "all" | "phone" | "desktop" | "tablet";
  bots: boolean; // include link-scanner clicks
  group: "day" | "week" | "month";
};

export const DEFAULT_FILTERS: Filters = { from: null, to: null, ministries: [], kind: "real", channel: "all", device: "all", bots: false, group: "week" };
const TZ = "America/New_York";

// ---------- small helpers ----------
const fmtET = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourET = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false });
const dowET = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
export const dayKey = (iso: string | Date) => fmtET.format(typeof iso === "string" ? new Date(iso) : iso); // yyyy-mm-dd in Eastern
const hourOf = (iso: string) => { const h = parseInt(hourET.format(new Date(iso)), 10); return h === 24 ? 0 : h; };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dowOf = (iso: string) => DOW.indexOf(dowET.format(new Date(iso)));
const addDays = (key: string, n: number) => { const d = new Date(key + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a: string, b: string) => Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);
function weekStart(key: string) { const d = new Date(key + "T12:00:00Z"); return addDays(key, -d.getUTCDay()); } // weeks start Sunday
const bucketOf = (key: string, g: Filters["group"]) => (g === "day" ? key : g === "week" ? weekStart(key) : key.slice(0, 7) + "-01");
// Eastern midnight as an instant (handles daylight saving by probing the offset).
function etStart(key: string): string {
  const guess = new Date(key + "T05:00:00Z");
  const hh = parseInt(hourET.format(guess), 10);
  const hour = hh === 24 ? 0 : hh;
  return new Date(guess.getTime() - hour * 3600000).toISOString();
}
const pct = (n: number, d: number) => (d > 0 ? n / d : null);
const domainOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "other"; } };

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, max = 200000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function inChunks<T>(ids: string[], load: (part: string[]) => Promise<T[]>): Promise<T[]> {
  const parts = await Promise.all(chunk(ids, 150).map(load));
  return parts.flat();
}

// ---------- raw rows ----------
type SendRow = { id: string; email_id: string; kind: "test" | "real"; channel: string; started_at: string; emails: { ministry: string; title: string; subject: string | null; slug: string | null; status: string } | null };
type Rcpt = { id: string; send_id: string; channel: "email" | "text"; status: string; sent_at: string | null; bounced_at: string | null; complained_at: string | null; email?: string | null };
type Click = { link_id: string; recipient_id: string | null; send_id: string | null; channel: string; device: string | null; is_bot: boolean; at: string };
type Open = { recipient_id: string | null; send_id: string | null; at: string; device: string | null; is_proxy: boolean };
type LinkRow = { id: string; email_id: string; block_id: string; label: string; url: string };
type Supp = { email: string; ministry: string; reason: string; created_at: string; send_id: string | null };

type Raw = { sends: SendRow[]; rcpts: Rcpt[]; clicks: Click[]; opens: Open[]; links: LinkRow[]; supp: Supp[] };

function allowed(me: Perm, f: Filters): string[] {
  const mine = analyticsMinistries(me); // null = everything
  const all = Object.keys(PALETTES);
  const base = mine ?? all;
  return f.ministries.length ? f.ministries.filter((m) => base.includes(m)) : base;
}

async function loadSends(sb: Admin, f: Filters, ministries: string[], range: { from: string | null; to: string | null }, emailId?: string): Promise<SendRow[]> {
  const rows = await fetchAll<SendRow>((a, b) => {
    let q = sb.from("sends").select("id,email_id,kind,channel,started_at,emails(ministry,title,slug,status,subject:doc->>subject)").order("started_at", { ascending: false }).range(a, b);
    if (f.kind !== "all") q = q.eq("kind", f.kind);
    if (range.from) q = q.gte("started_at", etStart(range.from));
    if (range.to) q = q.lt("started_at", etStart(addDays(range.to, 1)));
    if (emailId) q = q.eq("email_id", emailId);
    return q as any;
  }, 20000);
  return rows.filter((s) => s.emails && ministries.includes(s.emails.ministry));
}

async function loadRaw(sb: Admin, sends: SendRow[], withEmail = false): Promise<Raw> {
  const sendIds = sends.map((s) => s.id);
  const emailIds = [...new Set(sends.map((s) => s.email_id))];
  if (!sendIds.length) return { sends, rcpts: [], clicks: [], opens: [], links: [], supp: [] };
  const rcptCols = "id,send_id,channel,status,sent_at,bounced_at,complained_at" + (withEmail ? ",email" : "");
  const [rcpts, clicks, opens, links, supp] = await Promise.all([
    inChunks<Rcpt>(sendIds, (p) => fetchAll<Rcpt>((a, b) => sb.from("recipients").select(rcptCols).in("send_id", p).range(a, b) as any)),
    inChunks<Click>(sendIds, (p) => fetchAll<Click>((a, b) => sb.from("clicks").select("link_id,recipient_id,send_id,channel,device,is_bot,at").in("send_id", p).range(a, b) as any)),
    inChunks<Open>(sendIds, (p) => fetchAll<Open>((a, b) => sb.from("opens").select("recipient_id,send_id,at,device,is_proxy").in("send_id", p).range(a, b) as any)),
    inChunks<LinkRow>(emailIds, (p) => fetchAll<LinkRow>((a, b) => sb.from("links").select("id,email_id,block_id,label,url").in("email_id", p).range(a, b) as any)),
    inChunks<Supp>(sendIds, (p) => fetchAll<Supp>((a, b) => sb.from("suppressions").select("email,ministry,reason,created_at,send_id").in("send_id", p).range(a, b) as any)),
  ]);
  return { sends, rcpts, clicks, opens, links, supp };
}

// ---------- the math ----------
export type Tally = {
  sends: number; recipients: number; delivered: number; bounced: number; complained: number; failed: number;
  openers: number; opens: number; proxyOpeners: number;
  clickers: number; clicks: number; webClicks: number; botClicks: number;
  unsubs: number;
  openRate: number | null; clickRate: number | null; clickToOpen: number | null; bounceRate: number | null; unsubRate: number | null; complaintRate: number | null;
};

type Ctx = { f: Filters; rc: Map<string, Rcpt>; sendOf: Map<string, SendRow> };

function clickOK(c: Click, ctx: Ctx) {
  if (!ctx.f.bots && c.is_bot) return false;
  if (ctx.f.device !== "all" && c.device !== ctx.f.device) return false;
  if (ctx.f.channel !== "all") {
    if (!c.recipient_id) return false; // web-version clicks have no channel
    if (ctx.rc.get(c.recipient_id)?.channel !== ctx.f.channel) return false;
  }
  return true;
}
function openOK(o: Open, ctx: Ctx) {
  if (ctx.f.device !== "all" && o.device !== ctx.f.device) return false;
  if (ctx.f.channel !== "all" && o.recipient_id && ctx.rc.get(o.recipient_id)?.channel !== ctx.f.channel) return false;
  return true;
}
const rcptOK = (r: Rcpt, f: Filters) => f.channel === "all" || r.channel === f.channel;

function tally(raw: Raw, ctx: Ctx, pick?: (sendId: string) => boolean): Tally {
  const keepSend = (id: string | null) => !!id && (!pick || pick(id));
  const rcpts = raw.rcpts.filter((r) => keepSend(r.send_id) && rcptOK(r, ctx.f));
  const sends = raw.sends.filter((s) => keepSend(s.id));
  const delivered = rcpts.filter((r) => r.status === "sent" || r.status === "delivered").length;
  const bounced = rcpts.filter((r) => r.status === "bounced" || r.bounced_at).length;
  const complained = rcpts.filter((r) => r.status === "complained" || r.complained_at).length;
  const failed = rcpts.filter((r) => r.status === "failed").length;
  const opens = raw.opens.filter((o) => keepSend(o.send_id) && openOK(o, ctx));
  const openers = new Set(opens.map((o) => o.recipient_id).filter(Boolean) as string[]);
  const realOpeners = new Set(opens.filter((o) => !o.is_proxy).map((o) => o.recipient_id).filter(Boolean) as string[]);
  const allClicks = raw.clicks.filter((c) => keepSend(c.send_id));
  const clicks = allClicks.filter((c) => clickOK(c, ctx));
  const clickers = new Set(clicks.map((c) => c.recipient_id).filter(Boolean) as string[]);
  const unsubs = raw.supp.filter((s) => keepSend(s.send_id) && s.reason === "unsubscribed").length;
  const botClicks = allClicks.filter((c) => c.is_bot).length;
  const t: Tally = {
    sends: sends.length, recipients: rcpts.length, delivered, bounced, complained, failed,
    openers: openers.size, opens: opens.length, proxyOpeners: openers.size - realOpeners.size,
    clickers: clickers.size, clicks: clicks.length, webClicks: clicks.filter((c) => !c.recipient_id).length, botClicks,
    unsubs,
    openRate: pct(openers.size, delivered), clickRate: pct(clickers.size, delivered),
    clickToOpen: openers.size ? Math.min(1, clickers.size / openers.size) : null,
    bounceRate: pct(bounced, rcpts.length), unsubRate: pct(unsubs, delivered), complaintRate: pct(complained, delivered),
  };
  return t;
}

const ministryLabel = (k: string) => PALETTES[k]?.label ?? k;

export type EmailRow = {
  emailId: string; title: string; subject: string; ministry: string; ministryLabel: string; slug: string | null;
  lastSent: string; sends: number; kind: "real" | "test" | "mixed"; tally: Tally;
};

export type Overview = {
  filters: Filters;
  range: { from: string | null; to: string | null };
  prevRange: { from: string; to: string } | null;
  meta: { realSends: number; testSends: number; ministries: string[]; people: boolean; scope: "all" | "own" };
  totals: Tally;
  previous: Tally | null;
  series: { bucket: string; label: string; t: Tally }[];
  byMinistry: { key: string; label: string; t: Tally }[];
  byChannel: { key: string; label: string; t: Tally }[];
  emails: EmailRow[];
  devices: { phone: number; desktop: number; tablet: number; unknown: number; opensPhone: number; opensDesktop: number; opensTablet: number };
  hours: { hour: number; clicks: number; opens: number }[];
  weekdays: { day: string; clicks: number; opens: number; sends: number }[];
  sendHours: { hour: number; sends: number; avgClickRate: number | null }[];
  timeToClick: { label: string; n: number }[];
  topLinks: { linkId: string; label: string; url: string; domain: string; emailId: string; emailTitle: string; ministry: string; clicks: number; unique: number; share: number }[];
  domains: { domain: string; clicks: number; share: number }[];
  deliverability: { bounced: number; complained: number; failed: number; unsubscribed: number; suppressedByReason: Record<string, number>; openUnsubTasks: number | null };
  webViews: { total: number; byEmail: { emailId: string; title: string; views: number }[] };
  prayers: { total: number; byIssue: { slug: string; title: string; taps: number }[] };
  insights: string[];
};

function defaultRange(f: Filters, raw: SendRow[]): { from: string | null; to: string | null } {
  return { from: f.from, to: f.to };
}

export async function overview(me: Perm, f: Filters, people = false): Promise<Overview> {
  const sb = supabaseAdmin();
  const ministries = allowed(me, f);
  const range = defaultRange(f, []);
  // The comparison window: the same number of days directly before the chosen one.
  let prevRange: Overview["prevRange"] = null;
  if (range.from && range.to) { const n = diffDays(range.from, range.to) + 1; prevRange = { from: addDays(range.from, -n), to: addDays(range.from, -1) }; }

  const [sends, prevSends, kindCounts] = await Promise.all([
    loadSends(sb, f, ministries, range),
    prevRange ? loadSends(sb, f, ministries, prevRange) : Promise.resolve([] as SendRow[]),
    countKinds(sb, ministries),
  ]);
  const [raw, prevRaw] = await Promise.all([loadRaw(sb, sends), prevRange ? loadRaw(sb, prevSends) : Promise.resolve(null)]);
  const rc = new Map(raw.rcpts.map((r) => [r.id, r]));
  const sendOf = new Map(sends.map((s) => [s.id, s]));
  const ctx: Ctx = { f, rc, sendOf };
  const totals = tally(raw, ctx);
  const previous = prevRaw ? tally(prevRaw, { f, rc: new Map(prevRaw.rcpts.map((r) => [r.id, r])), sendOf: new Map() }) : null;

  // Performance by send period
  const buckets = new Map<string, Set<string>>();
  for (const s of sends) { const b = bucketOf(dayKey(s.started_at), f.group); (buckets.get(b) ?? buckets.set(b, new Set()).get(b)!).add(s.id); }
  const series = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([bucket, ids]) => ({ bucket, label: bucketLabel(bucket, f.group), t: tally(raw, ctx, (id) => ids.has(id)) }));

  const byMinistry = ministries.map((m) => ({ key: m, label: ministryLabel(m), ids: new Set(sends.filter((s) => s.emails!.ministry === m).map((s) => s.id)) }))
    .filter((m) => m.ids.size).map((m) => ({ key: m.key, label: m.label, t: tally(raw, ctx, (id) => m.ids.has(id)) }))
    .sort((a, b) => b.t.recipients - a.t.recipients);

  const byChannel: { key: string; label: string; t: Tally }[] = (["email", "text"] as const).filter((c) => f.channel === "all" || f.channel === c).map((c) => {
    const sub: Ctx = { ...ctx, f: { ...f, channel: c } };
    return { key: c, label: c === "email" ? "Email" : "Text", t: tally(raw, sub) };
  }).filter((c) => c.t.recipients > 0);
  if (f.channel === "all" && totals.webClicks) byChannel.push({ key: "web", label: "Web version", t: { ...emptyTally(), clicks: totals.webClicks } });

  // Per email
  const byEmail = new Map<string, SendRow[]>();
  for (const s of sends) (byEmail.get(s.email_id) ?? byEmail.set(s.email_id, []).get(s.email_id)!).push(s);
  const emails: EmailRow[] = [...byEmail.entries()].map(([emailId, ss]) => {
    const ids = new Set(ss.map((s) => s.id));
    const e = ss[0].emails!;
    const kinds = new Set(ss.map((s) => s.kind));
    return {
      emailId, title: e.title, subject: e.subject || e.title, ministry: e.ministry, ministryLabel: ministryLabel(e.ministry), slug: e.slug,
      lastSent: ss.map((s) => s.started_at).sort().slice(-1)[0], sends: ss.length, kind: (kinds.size > 1 ? "mixed" : ss[0].kind) as EmailRow["kind"],
      tally: tally(raw, ctx, (id) => ids.has(id)),
    };
  }).sort((a, b) => b.lastSent.localeCompare(a.lastSent));

  // Devices, hours, weekdays
  const humanClicks = raw.clicks.filter((c) => clickOK(c, ctx));
  const okOpens = raw.opens.filter((o) => openOK(o, ctx));
  const dev = (arr: { device: string | null }[], d: string) => arr.filter((x) => x.device === d).length;
  const devices = {
    phone: dev(humanClicks, "phone"), desktop: dev(humanClicks, "desktop"), tablet: dev(humanClicks, "tablet"),
    unknown: humanClicks.filter((c) => !["phone", "desktop", "tablet"].includes(c.device ?? "")).length,
    opensPhone: dev(okOpens, "phone"), opensDesktop: dev(okOpens, "desktop"), opensTablet: dev(okOpens, "tablet"),
  };
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, clicks: 0, opens: 0 }));
  for (const c of humanClicks) hours[hourOf(c.at)].clicks++;
  for (const o of okOpens) hours[hourOf(o.at)].opens++;
  const weekdays = DOW.map((day) => ({ day, clicks: 0, opens: 0, sends: 0 }));
  for (const c of humanClicks) weekdays[dowOf(c.at)].clicks++;
  for (const o of okOpens) weekdays[dowOf(o.at)].opens++;
  for (const s of sends) weekdays[dowOf(s.started_at)].sends++;

  // Which send hour works best (by unique-click rate, hours with at least one send)
  const sendHours = Array.from({ length: 24 }, (_, hour) => ({ hour, ids: new Set(sends.filter((s) => hourOf(s.started_at) === hour).map((s) => s.id)) }))
    .map((h) => ({ hour: h.hour, sends: h.ids.size, avgClickRate: h.ids.size ? tally(raw, ctx, (id) => h.ids.has(id)).clickRate : null }));

  // How soon after sending people click
  const startOf = new Map(sends.map((s) => [s.id, new Date(s.started_at).getTime()]));
  const tb = [["Under 1 hour", 3600e3], ["1 to 6 hours", 6 * 3600e3], ["6 to 24 hours", 24 * 3600e3], ["1 to 3 days", 3 * 86400e3], ["Over 3 days", Infinity]] as const;
  const timeToClick = tb.map(([label]) => ({ label: label as string, n: 0 }));
  const firstClick = new Map<string, number>();
  for (const c of humanClicks) {
    if (!c.recipient_id || !c.send_id) continue;
    const dt = new Date(c.at).getTime() - (startOf.get(c.send_id) ?? 0);
    const k = c.recipient_id;
    if (!firstClick.has(k) || dt < firstClick.get(k)!) firstClick.set(k, dt);
  }
  for (const dt of firstClick.values()) { const i = tb.findIndex(([, lim]) => dt < lim); timeToClick[i < 0 ? 4 : i].n++; }

  // Links
  const linkById = new Map(raw.links.map((l) => [l.id, l]));
  const emailOfLink = new Map<string, EmailRow>(emails.map((e) => [e.emailId, e]));
  const perLink = new Map<string, { clicks: number; who: Set<string> }>();
  for (const c of humanClicks) {
    const p = perLink.get(c.link_id) ?? perLink.set(c.link_id, { clicks: 0, who: new Set() }).get(c.link_id)!;
    p.clicks++; if (c.recipient_id) p.who.add(c.recipient_id);
  }
  const topLinks = [...perLink.entries()].map(([linkId, p]) => {
    const l = linkById.get(linkId); const e = l ? emailOfLink.get(l.email_id) : undefined;
    return l && e ? { linkId, label: l.label, url: l.url, domain: domainOf(l.url), emailId: e.emailId, emailTitle: e.title, ministry: e.ministry, clicks: p.clicks, unique: p.who.size, share: humanClicks.length ? p.clicks / humanClicks.length : 0 } : null;
  }).filter(Boolean).sort((a, b) => b!.clicks - a!.clicks).slice(0, 25) as Overview["topLinks"];
  const dom = new Map<string, number>();
  for (const c of humanClicks) { const l = linkById.get(c.link_id); if (l) { const d = domainOf(l.url); dom.set(d, (dom.get(d) ?? 0) + 1); } }
  const domains = [...dom.entries()].map(([domain, clicks]) => ({ domain, clicks, share: humanClicks.length ? clicks / humanClicks.length : 0 })).sort((a, b) => b.clicks - a.clicks).slice(0, 10);

  // Deliverability and the unsubscribe queue
  const suppressedByReason: Record<string, number> = {};
  for (const s of raw.supp) suppressedByReason[s.reason] = (suppressedByReason[s.reason] ?? 0) + 1;
  let openUnsubTasks: number | null = null;
  { const { count } = await sb.from("unsubscribe_tasks").select("id", { count: "exact", head: true }).eq("status", "open").in("ministry", ministries); openUnsubTasks = count ?? 0; }

  // Web version views and "I'm praying" taps
  const emailIds = emails.map((e) => e.emailId);
  const wv = emailIds.length ? await inChunks<{ email_id: string; is_bot: boolean; device: string | null }>(emailIds, (p) => fetchAll((a, b) => {
    let q = sb.from("web_views").select("email_id,is_bot,device").in("email_id", p).eq("is_bot", false).range(a, b);
    if (range.from) q = q.gte("at", etStart(range.from));
    if (range.to) q = q.lt("at", etStart(addDays(range.to, 1)));
    return q as any;
  })) : [];
  const wvBy = new Map<string, number>();
  for (const v of wv) wvBy.set(v.email_id, (wvBy.get(v.email_id) ?? 0) + 1);
  const webViews = { total: wv.length, byEmail: [...wvBy.entries()].map(([emailId, views]) => ({ emailId, title: emailOfLink.get(emailId)?.title ?? "", views })).sort((a, b) => b.views - a.views).slice(0, 8) };

  const slugs = emails.map((e) => e.slug).filter(Boolean) as string[];
  const prays = slugs.length ? await inChunks<{ issue_slug: string }>(slugs, (p) => fetchAll((a, b) => {
    let q = sb.from("prays").select("issue_slug").in("issue_slug", p).range(a, b);
    if (range.from) q = q.gte("at", etStart(range.from));
    if (range.to) q = q.lt("at", etStart(addDays(range.to, 1)));
    return q as any;
  })) : [];
  const prBy = new Map<string, number>();
  for (const p of prays) prBy.set(p.issue_slug, (prBy.get(p.issue_slug) ?? 0) + 1);
  const bySlug = new Map(emails.map((e) => [e.slug, e.title]));
  const prayers = { total: prays.length, byIssue: [...prBy.entries()].map(([slug, taps]) => ({ slug, title: bySlug.get(slug) ?? slug, taps })).sort((a, b) => b.taps - a.taps).slice(0, 8) };

  // Plain-language highlights
  const insights: string[] = [];
  const ranked = emails.filter((e) => e.tally.delivered >= 1 && e.tally.clickRate !== null).sort((a, b) => (b.tally.clickRate! - a.tally.clickRate!));
  if (ranked.length >= 2) insights.push(`Best click rate: "${ranked[0].subject}" (${ranked[0].ministryLabel}) at ${Math.round(ranked[0].tally.clickRate! * 100)}%.`);
  if (topLinks[0]) insights.push(`Most-tapped link: "${topLinks[0].label}" with ${topLinks[0].clicks} click${topLinks[0].clicks === 1 ? "" : "s"} (${Math.round(topLinks[0].share * 100)}% of all clicks).`);
  const bestHour = [...hours].sort((a, b) => b.clicks - a.clicks)[0];
  if (bestHour && bestHour.clicks > 0) insights.push(`People tap most around ${hourLabel(bestHour.hour)} Eastern.`);
  const bestDay = [...weekdays].sort((a, b) => b.clicks - a.clicks)[0];
  if (bestDay && bestDay.clicks > 0) insights.push(`${bestDay.day} is the busiest day for clicks.`);
  const dTotal = devices.phone + devices.desktop + devices.tablet;
  if (dTotal > 0) insights.push(`${Math.round((devices.phone / dTotal) * 100)}% of clicks come from phones.`);
  if (totals.botClicks) insights.push(`${totals.botClicks} click${totals.botClicks === 1 ? "" : "s"} came from link scanners and ${f.bots ? "are included" : "were left out"}.`);
  if (previous && previous.clickRate !== null && totals.clickRate !== null && previous.delivered > 0) {
    const d = Math.round((totals.clickRate - previous.clickRate) * 100);
    if (d !== 0) insights.push(`Click rate is ${Math.abs(d)} point${Math.abs(d) === 1 ? "" : "s"} ${d > 0 ? "up" : "down"} from the previous ${prevRange ? diffDays(prevRange.from, prevRange.to) + 1 : ""} days.`);
  }

  return {
    filters: f, range, prevRange,
    meta: { realSends: kindCounts.real, testSends: kindCounts.test, ministries, people, scope: analyticsMinistries(me) ? "own" : "all" },
    totals, previous, series, byMinistry, byChannel, emails, devices, hours, weekdays, sendHours, timeToClick, topLinks, domains,
    deliverability: { bounced: totals.bounced, complained: totals.complained, failed: totals.failed, unsubscribed: totals.unsubs, suppressedByReason, openUnsubTasks },
    webViews, prayers, insights,
  };
}

async function countKinds(sb: Admin, ministries: string[]) {
  const rows = await fetchAll<{ kind: string; emails: { ministry: string } | null }>((a, b) => sb.from("sends").select("kind,emails(ministry)").range(a, b) as any, 20000);
  const mine = rows.filter((r) => r.emails && ministries.includes(r.emails.ministry));
  return { real: mine.filter((r) => r.kind === "real").length, test: mine.filter((r) => r.kind === "test").length };
}

function emptyTally(): Tally {
  return { sends: 0, recipients: 0, delivered: 0, bounced: 0, complained: 0, failed: 0, openers: 0, opens: 0, proxyOpeners: 0, clickers: 0, clicks: 0, webClicks: 0, botClicks: 0, unsubs: 0, openRate: null, clickRate: null, clickToOpen: null, bounceRate: null, unsubRate: null, complaintRate: null };
}
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
function bucketLabel(b: string, g: Filters["group"]) {
  const d = new Date(b + "T12:00:00Z");
  if (g === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  const l = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return g === "week" ? `Wk ${l}` : l;
}

// ---------- one email ----------
export type EmailReport = {
  email: { id: string; title: string; subject: string; ministry: string; ministryLabel: string; status: string; slug: string | null };
  people: boolean;
  sends: { id: string; kind: string; channel: string; at: string; recipients: number }[];
  t: Tally;
  funnel: { label: string; n: number }[];
  links: { linkId: string; blockId: string; position: number; inEmail: boolean; blockType: string; label: string; url: string; clicks: number; unique: number; phone: number; desktop: number; tablet: number; shareOfClickers: number | null; shareOfDelivered: number | null }[];
  devices: { phone: number; desktop: number; tablet: number; unknown: number };
  hours: { hour: number; clicks: number; opens: number }[];
  firstDays: { label: string; clicks: number; opens: number }[]; // by hours since send
  timeToClick: { label: string; n: number }[];
  unsubscribes: number; webViews: number; prayers: number;
  recipients: { email: string; channel: string; status: string; opened: boolean; clicks: number; links: string[]; lastActivity: string | null }[] | null;
};

export async function emailReport(me: Perm, f: Filters, emailId: string, people: boolean): Promise<EmailReport | null> {
  const sb = supabaseAdmin();
  const { data: e } = await sb.from("emails").select("id,ministry,title,status,slug,doc").eq("id", emailId).maybeSingle();
  if (!e) return null;
  const ministries = allowed(me, { ...f, ministries: [] });
  if (!ministries.includes(e.ministry)) return null;
  const sends = await loadSends(sb, { ...f, from: null, to: null }, ministries, { from: null, to: null }, emailId);
  const raw = await loadRaw(sb, sends, people);
  const rc = new Map(raw.rcpts.map((r) => [r.id, r]));
  const ctx: Ctx = { f, rc, sendOf: new Map(sends.map((s) => [s.id, s])) };
  const t = tally(raw, ctx);
  const clicks = raw.clicks.filter((c) => clickOK(c, ctx));
  const opens = raw.opens.filter((o) => openOK(o, ctx));
  const doc = e.doc as { blocks?: { id: string; type: string }[]; subject?: string };
  const order = new Map((doc.blocks ?? []).map((b, i) => [b.id, { i: i + 1, type: b.type }]));
  const typeName: Record<string, string> = { hero: "Header", text: "Text", travel: "Trips", partners: "Partners", cta: "Call to action", card: "Card", photo: "Photo", event: "Event", divider: "Divider" };

  const links = raw.links.map((l) => {
    const cs = clicks.filter((c) => c.link_id === l.id);
    const who = new Set(cs.map((c) => c.recipient_id).filter(Boolean) as string[]);
    const d = (x: string) => cs.filter((c) => c.device === x).length;
    const o = order.get(l.block_id);
    return { linkId: l.id, blockId: l.block_id, position: o?.i ?? 999, inEmail: !!o, blockType: typeName[o?.type ?? ""] ?? "Block", label: l.label, url: l.url, clicks: cs.length, unique: who.size, phone: d("phone"), desktop: d("desktop"), tablet: d("tablet"), shareOfClickers: pct(who.size, t.clickers), shareOfDelivered: pct(who.size, t.delivered) };
  }).sort((a, b) => a.position - b.position || b.clicks - a.clicks);

  const dev = (x: string) => clicks.filter((c) => c.device === x).length;
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, clicks: 0, opens: 0 }));
  for (const c of clicks) hours[hourOf(c.at)].clicks++;
  for (const o of opens) hours[hourOf(o.at)].opens++;

  // Hours after the first send: 0-1, 1-3, 3-6, 6-12, 12-24, 24-48, 48-72, 3 days+
  const first = sends.map((s) => new Date(s.started_at).getTime()).sort()[0] ?? 0;
  const startOf = new Map(sends.map((s) => [s.id, new Date(s.started_at).getTime()]));
  const bands = [["First hour", 1], ["1 to 3 h", 3], ["3 to 6 h", 6], ["6 to 12 h", 12], ["12 to 24 h", 24], ["Day 2", 48], ["Day 3", 72], ["Later", Infinity]] as const;
  const firstDays = bands.map(([label]) => ({ label: label as string, clicks: 0, opens: 0 }));
  const place = (iso: string, sid: string | null) => { const hrs = (new Date(iso).getTime() - (sid ? startOf.get(sid) ?? first : first)) / 3600e3; const i = bands.findIndex(([, lim]) => hrs < lim); return i < 0 ? bands.length - 1 : i; };
  for (const c of clicks) firstDays[place(c.at, c.send_id)].clicks++;
  for (const o of opens) firstDays[place(o.at, o.send_id)].opens++;

  const tb = [["Under 1 hour", 3600e3], ["1 to 6 hours", 6 * 3600e3], ["6 to 24 hours", 24 * 3600e3], ["1 to 3 days", 3 * 86400e3], ["Over 3 days", Infinity]] as const;
  const timeToClick = tb.map(([label]) => ({ label: label as string, n: 0 }));
  const firstClick = new Map<string, number>();
  for (const c of clicks) { if (!c.recipient_id || !c.send_id) continue; const dt = new Date(c.at).getTime() - (startOf.get(c.send_id) ?? first); const p = firstClick.get(c.recipient_id); if (p === undefined || dt < p) firstClick.set(c.recipient_id, dt); }
  for (const dt of firstClick.values()) { const i = tb.findIndex(([, lim]) => dt < lim); timeToClick[i < 0 ? 4 : i].n++; }

  const funnel = [
    { label: "Sent", n: t.recipients }, { label: "Delivered", n: t.delivered }, { label: "Opened (estimate)", n: t.openers }, { label: "Clicked", n: t.clickers },
  ];

  const { count: wv } = await sb.from("web_views").select("id", { count: "exact", head: true }).eq("email_id", emailId).eq("is_bot", false);
  const { count: pr } = e.slug ? await sb.from("prays").select("id", { count: "exact", head: true }).eq("issue_slug", e.slug) : { count: 0 };

  let recipients: EmailReport["recipients"] = null;
  if (people) {
    const linkLabel = new Map(raw.links.map((l) => [l.id, l.label]));
    const openedBy = new Map<string, string>();
    for (const o of raw.opens) if (o.recipient_id && (!openedBy.has(o.recipient_id) || o.at < openedBy.get(o.recipient_id)!)) openedBy.set(o.recipient_id, o.at);
    const clickBy = new Map<string, { n: number; links: Set<string>; last: string }>();
    for (const c of clicks) if (c.recipient_id) { const x = clickBy.get(c.recipient_id) ?? clickBy.set(c.recipient_id, { n: 0, links: new Set(), last: c.at }).get(c.recipient_id)!; x.n++; x.links.add(linkLabel.get(c.link_id) ?? "link"); if (c.at > x.last) x.last = c.at; }
    recipients = raw.rcpts.filter((r) => rcptOK(r, f)).map((r) => {
      const cl = clickBy.get(r.id); const op = openedBy.get(r.id);
      return { email: r.email ?? "", channel: r.channel, status: r.status, opened: !!op, clicks: cl?.n ?? 0, links: cl ? [...cl.links] : [], lastActivity: [cl?.last, op].filter(Boolean).sort().slice(-1)[0] ?? null };
    }).sort((a, b) => b.clicks - a.clicks || (a.email || "").localeCompare(b.email || "")).slice(0, 1000);
  }

  return {
    email: { id: e.id, title: e.title, subject: doc.subject || e.title, ministry: e.ministry, ministryLabel: ministryLabel(e.ministry), status: e.status, slug: e.slug },
    people,
    sends: sends.map((s) => ({ id: s.id, kind: s.kind, channel: s.channel, at: s.started_at, recipients: raw.rcpts.filter((r) => r.send_id === s.id).length })).sort((a, b) => b.at.localeCompare(a.at)),
    t, funnel, links,
    devices: { phone: dev("phone"), desktop: dev("desktop"), tablet: dev("tablet"), unknown: clicks.filter((c) => !["phone", "desktop", "tablet"].includes(c.device ?? "")).length },
    hours, firstDays, timeToClick, unsubscribes: t.unsubs, webViews: wv ?? 0, prayers: pr ?? 0, recipients,
  };
}

// ---------- reading filters from a URL ----------
export function parseFilters(q: URLSearchParams): Filters {
  const d = (k: string) => { const v = q.get(k); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };
  const oneOf = <T extends string>(k: string, list: readonly T[], dflt: T): T => { const v = q.get(k) as T | null; return v && list.includes(v) ? v : dflt; };
  return {
    from: d("from"), to: d("to"),
    ministries: (q.get("m") ?? "").split(",").filter((m) => m in PALETTES),
    kind: oneOf("kind", ["real", "test", "all"] as const, "real"),
    channel: oneOf("channel", ["all", "email", "text"] as const, "all"),
    device: oneOf("device", ["all", "phone", "desktop", "tablet"] as const, "all"),
    bots: q.get("bots") === "1",
    group: oneOf("group", ["day", "week", "month"] as const, "week"),
  };
}
