"use client";
import Link from "next/link";
import { EmailInsights } from "@/components/EmailInsights";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight, Download, Filter, Info, RotateCcw, Search } from "lucide-react";
import { NavMenu } from "@/components/NavMenu";
import { HeaderBrand } from "@/components/HeaderBrand";
import { HelpButton } from "@/components/HelpButton";
import { C, Card, Chip, HBars, Split, Tile, VBars, deltaCount, deltaRate, downloadCsv, etDate, hourName, num, pct } from "@/components/charts";
import type { Filters, Overview, Tally } from "@/lib/analytics";

type Min = { key: string; label: string; color: string };
const DEFAULTS: Filters = { from: null, to: null, ministries: [], kind: "real", channel: "all", device: "all", bots: false, group: "week" };

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 86400000));
const PRESETS: { id: string; label: string; range: () => { from: string | null; to: string | null } }[] = [
  { id: "7", label: "7 days", range: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  { id: "30", label: "30 days", range: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
  { id: "90", label: "90 days", range: () => ({ from: daysAgo(89), to: daysAgo(0) }) },
  { id: "ytd", label: "This year", range: () => ({ from: ymd(new Date()).slice(0, 4) + "-01-01", to: daysAgo(0) }) },
  { id: "all", label: "All time", range: () => ({ from: null, to: null }) },
];

function toQuery(f: Filters) {
  const q = new URLSearchParams();
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  if (f.ministries.length) q.set("m", f.ministries.join(","));
  if (f.kind !== "real") q.set("kind", f.kind);
  if (f.channel !== "all") q.set("channel", f.channel);
  if (f.device !== "all") q.set("device", f.device);
  if (f.bots) q.set("bots", "1");
  if (f.group !== "week") q.set("group", f.group);
  return q.toString();
}
function fromQuery(s: string): Filters {
  const q = new URLSearchParams(s);
  const d = (k: string) => { const v = q.get(k); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };
  const one = <T extends string>(k: string, list: readonly T[], dflt: T): T => { const v = q.get(k) as T | null; return v && list.includes(v) ? v : dflt; };
  const hasRange = q.has("from") || q.has("to");
  return {
    from: hasRange ? d("from") : daysAgo(89), to: hasRange ? d("to") : daysAgo(0),
    ministries: (q.get("m") ?? "").split(",").filter(Boolean),
    kind: one("kind", ["real", "test", "all"] as const, "real"), channel: one("channel", ["all", "email", "text"] as const, "all"),
    device: one("device", ["all", "phone", "desktop", "tablet"] as const, "all"), bots: q.get("bots") === "1", group: one("group", ["day", "week", "month"] as const, "week"),
  };
}

type Metric = { id: string; label: string; get: (t: Tally) => number | null; rate?: boolean; goodWhenDown?: boolean };
const METRICS: Metric[] = [
  { id: "recipients", label: "People emailed", get: (t) => t.recipients },
  { id: "delivered", label: "Delivered", get: (t) => t.delivered },
  { id: "clickRate", label: "Click rate", get: (t) => t.clickRate, rate: true },
  { id: "openRate", label: "Open rate (estimate)", get: (t) => t.openRate, rate: true },
  { id: "clickers", label: "People who clicked", get: (t) => t.clickers },
  { id: "clicks", label: "Total clicks", get: (t) => t.clicks },
  { id: "openers", label: "People who opened (estimate)", get: (t) => t.openers },
  { id: "unsubs", label: "Unsubscribes", get: (t) => t.unsubs, goodWhenDown: true },
  { id: "bounced", label: "Bounces", get: (t) => t.bounced, goodWhenDown: true },
];

type SortKey = "lastSent" | "recipients" | "delivered" | "openRate" | "clickRate" | "clicks" | "unsubs";

export function Analytics({ ministries, people, own }: { ministries: Min[]; people: boolean; own: boolean }) {
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState("clickRate");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "lastSent", dir: -1 });
  const [rows, setRows] = useState(15);
  const [note, setNote] = useState("");
  const autoSwitched = useRef(false);
  const abort = useRef<AbortController | null>(null);

  // Read the filters from the address once, so a link or the back button restores the same view.
  useEffect(() => { setF(fromQuery(window.location.search)); setReady(true); }, []);

  const load = useCallback(async (filters: Filters) => {
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    setLoading(true); setErr("");
    try {
      const r = await fetch(`/api/analytics?${toQuery(filters)}`, { signal: ac.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't load analytics.");
      const d = j as Overview;
      // First visit, before any real send: show the test sends instead of an empty screen.
      if (!autoSwitched.current && filters.kind === "real" && d.meta.realSends === 0 && d.meta.testSends > 0) {
        autoSwitched.current = true;
        setNote("No real emails have been sent yet, so this shows your test sends.");
        setF((p) => ({ ...p, kind: "test", from: null, to: null }));
        return;
      }
      autoSwitched.current = true;
      setData(d);
    } catch (e: any) { if (e?.name !== "AbortError") setErr(e?.message || "Couldn't load analytics."); }
    finally { if (!ac.signal.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const s = toQuery(f);
    window.history.replaceState(null, "", s ? `/analytics?${s}` : "/analytics");
    const t = setTimeout(() => load(f), 150);
    return () => clearTimeout(t);
  }, [f, ready, load]);

  const upd = (p: Partial<Filters>) => { setNote(""); setF((x) => ({ ...x, ...p })); };
  const activePreset = PRESETS.find((p) => { const r = p.range(); return r.from === f.from && r.to === f.to; })?.id ?? "custom";
  const activeCount = [f.ministries.length > 0, f.kind !== "real", f.channel !== "all", f.device !== "all", f.bots].filter(Boolean).length;
  const reset = () => { setNote(""); setQ(""); setF({ ...DEFAULTS, from: daysAgo(89), to: daysAgo(0) }); };

  const T = data?.totals; const P = data?.previous;
  const m = METRICS.find((x) => x.id === metric)!;
  const empty = !!data && data.totals.sends === 0;

  const emailRows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const list = data.emails.filter((e) => !needle || `${e.subject} ${e.title} ${e.ministryLabel}`.toLowerCase().includes(needle));
    const val = (e: (typeof list)[number]) => sort.k === "lastSent" ? e.lastSent : sort.k === "recipients" ? e.tally.recipients : sort.k === "delivered" ? e.tally.delivered : sort.k === "openRate" ? e.tally.openRate ?? -1 : sort.k === "clickRate" ? e.tally.clickRate ?? -1 : sort.k === "clicks" ? e.tally.clicks : e.tally.unsubs;
    return [...list].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [data, q, sort]);
  const head = (k: SortKey, label: string, cls = "") => (
    <th scope="col" className={`whitespace-nowrap px-3 py-2 text-right font-bold ${cls}`} aria-sort={sort.k === k ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))} className="inline-flex items-center gap-0.5 uppercase tracking-wide hover:text-navy">{label}{sort.k === k ? <span aria-hidden>{sort.dir > 0 ? "▲" : "▼"}</span> : null}</button>
    </th>
  );

  const exportEmails = () => data && downloadCsv("brainerd-mail-emails.csv", ["Subject", "Internal name", "Ministry", "Last sent", "Send type", "People emailed", "Delivered", "Bounced", "Complaints", "Unsubscribes", "Opened (est.)", "Open rate (est.)", "Clicked", "Click rate", "Total clicks"],
    emailRows.map((e) => [e.subject, e.title, e.ministryLabel, e.lastSent, e.kind, e.tally.recipients, e.tally.delivered, e.tally.bounced, e.tally.complained, e.tally.unsubs, e.tally.openers, e.tally.openRate?.toFixed(4) ?? "", e.tally.clickers, e.tally.clickRate?.toFixed(4) ?? "", e.tally.clicks]));
  const exportLinks = () => data && downloadCsv("brainerd-mail-links.csv", ["Link", "Destination", "Email", "Ministry", "Total clicks", "People who clicked", "Share of clicks"], data.topLinks.map((l) => [l.label, l.url, l.emailTitle, l.ministry, l.clicks, l.unique, l.share.toFixed(4)]));

  const seg = (value: string, cur: string, set: (v: any) => void, opts: [string, string][], label: string) => (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-full border border-line bg-surface text-[13px] font-semibold">
      {opts.map(([v, l]) => <button key={v} onClick={() => set(v)} aria-pressed={cur === v} className={`min-h-9 px-3 ${cur === v ? "bg-navy text-white" : "text-ink hover:bg-mist"}`}>{l}</button>)}
    </div>
  );

  const FilterBar = (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Dates (Eastern time)</div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => <button key={p.id} onClick={() => upd(p.range())} aria-pressed={activePreset === p.id} className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold ${activePreset === p.id ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink hover:bg-mist"}`}>{p.label}</button>)}
          <label className="flex items-center gap-1.5 text-[13px] text-muted">From <input type="date" value={f.from ?? ""} max={f.to ?? undefined} onChange={(e) => upd({ from: e.target.value || null })} className="h-9 rounded-lg border border-line px-2 text-[14px] text-ink" /></label>
          <label className="flex items-center gap-1.5 text-[13px] text-muted">To <input type="date" value={f.to ?? ""} min={f.from ?? undefined} onChange={(e) => upd({ to: e.target.value || null })} className="h-9 rounded-lg border border-line px-2 text-[14px] text-ink" /></label>
        </div>
      </div>
      {ministries.length > 1 ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Ministries</span>{f.ministries.length ? <button onClick={() => upd({ ministries: [] })} className="text-[12px] font-semibold text-brand">Show all</button> : null}</div>
          <div className="flex flex-wrap gap-2">
            {ministries.map((mm) => { const on = f.ministries.includes(mm.key); return (
              <button key={mm.key} aria-pressed={on} onClick={() => upd({ ministries: on ? f.ministries.filter((x) => x !== mm.key) : [...f.ministries, mm.key] })} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${on ? "border-navy bg-brand/10 text-navy" : "border-line bg-surface text-ink hover:bg-mist"}`}>
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: mm.color }} />{mm.label}
              </button>); })}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        <div><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Send type</div>{seg(f.kind, f.kind, (v) => upd({ kind: v }), [["real", "Real sends"], ["test", "Tests"], ["all", "Both"]], "Send type")}</div>
        <div><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Channel</div>{seg(f.channel, f.channel, (v) => upd({ channel: v }), [["all", "All"], ["email", "Email"], ["text", "Text"]], "Channel")}</div>
        <div><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Device</div>{seg(f.device, f.device, (v) => upd({ device: v }), [["all", "All"], ["phone", "Phone"], ["desktop", "Desktop"], ["tablet", "Tablet"]], "Device")}</div>
        <div><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Group by</div>{seg(f.group, f.group, (v) => upd({ group: v }), [["day", "Day"], ["week", "Week"], ["month", "Month"]], "Group by")}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[14px] text-ink"><input type="checkbox" checked={f.bots} onChange={(e) => upd({ bots: e.target.checked })} className="h-4 w-4" />Include link-scanner clicks <span className="text-[12px] text-muted">(off by default)</span></label>
        <button onClick={reset} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-brand"><RotateCcw size={14} />Reset filters</button>
      </div>
    </div>
  );

  const rangeText = f.from || f.to ? `${f.from ? etDate(f.from + "T12:00:00Z") : "Start"} to ${f.to ? etDate(f.to + "T12:00:00Z") : "today"}` : "All time";

  return (
    <div className="min-h-full bg-mist pb-20">
      <header className="sticky top-0 z-10 border-b border-brand/15 bg-surface/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3"><NavMenu /><HeaderBrand label="Analytics" /><span className="flex-1" /><HelpButton /></div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-navy">Analytics</h1>
            <p className="mt-0.5 text-[14px] text-muted">{rangeText}{own ? " · your ministries" : ""}{data ? ` · ${data.totals.sends} send${data.totals.sends === 1 ? "" : "s"}` : ""}</p>
          </div>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="pill-btn border border-line bg-surface text-ink"><Filter size={16} className="mr-1.5" />Filters{activeCount ? <span className="ml-1.5 rounded-full bg-navy px-1.5 text-[11px] text-white">{activeCount}</span> : null}<ChevronDown size={16} className={`ml-1 transition ${open ? "rotate-180" : ""}`} /></button>
        </div>

        {/* Dates and the two most-used choices are always visible; the rest sits in the Filters panel. */}
        {open ? FilterBar : (
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => <button key={p.id} onClick={() => upd(p.range())} aria-pressed={activePreset === p.id} className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold ${activePreset === p.id ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink hover:bg-mist"}`}>{p.label}</button>)}
            {activePreset === "custom" ? <Chip tone="blue">Custom dates</Chip> : null}
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
            {seg(f.kind, f.kind, (v) => upd({ kind: v }), [["real", "Real"], ["test", "Tests"], ["all", "Both"]], "Send type")}
          </div>
        )}

        {note ? <p role="status" className="flex items-start gap-2 rounded-xl bg-brand/10 px-4 py-3 text-sm text-navy"><Info size={16} className="mt-0.5 shrink-0" />{note}</p> : null}
        {err ? <p role="alert" className="rounded-xl bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err} <button onClick={() => load(f)} className="font-semibold underline">Try again</button></p> : null}
        {loading && !data ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[98px] animate-pulse rounded-2xl border border-line bg-surface" />)}</div> : null}

        {data && T ? (
          <div className={loading ? "opacity-60 transition" : "transition"} aria-busy={loading}>
            {empty ? (
              <div className="rounded-2xl border border-line bg-surface p-8 text-center">
                <BarChart3 size={36} className="mx-auto text-[#9db3cc]" />
                <h2 className="mt-3 font-serif text-xl font-semibold text-navy">Nothing to show for these filters</h2>
                <p className="mx-auto mt-1 max-w-md text-[14px] text-muted">{data.meta.realSends === 0 && data.meta.testSends === 0 ? "Numbers appear here after the first email goes out. Send yourself a test from the editor to see how it works." : "Try a longer date range, another ministry, or switch Send type."}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2"><button className="pill-btn bg-navy text-white" onClick={reset}>Reset filters</button>{f.kind === "real" && data.meta.testSends ? <button className="pill-btn border border-line bg-surface text-ink" onClick={() => upd({ kind: "test", from: null, to: null })}>Show test sends</button> : null}</div>
              </div>
            ) : (
              <div className="space-y-5">
                <EmailInsights url={`/api/analytics/summary?${toQuery(f)}`} title="How your emails are doing" />
                {/* Headline numbers */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="Emails sent" value={num(T.sends)} delta={P ? deltaCount(T.sends, P.sends) : null} />
                  <Tile label="People emailed" value={num(T.recipients)} sub={`${num(T.delivered)} delivered`} delta={P ? deltaCount(T.recipients, P.recipients) : null} />
                  <Tile label="Click rate" value={pct(T.clickRate)} sub={`${num(T.clickers)} people`} delta={P ? deltaRate(T.clickRate, P.clickRate) : null} hint="People who clicked at least one link, out of people the email reached. The most reliable engagement number." />
                  <Tile label="Open rate (est.)" value={pct(T.openRate)} sub={`${num(T.openers)} people`} delta={P ? deltaRate(T.openRate, P.openRate) : null} hint="An estimate. Apple Mail opens every email in the background, which inflates this number." />
                  <Tile label="Total clicks" value={num(T.clicks)} sub={`${T.clickers ? (T.clicks / T.clickers).toFixed(1) : "0"} per person`} delta={P ? deltaCount(T.clicks, P.clicks) : null} />
                  <Tile label="Click-to-open" value={pct(T.clickToOpen)} sub="of those who opened" hint="Of the people who opened, how many clicked. Opens are estimates, so treat this as a rough guide." />
                  <Tile label="Unsubscribes" value={num(T.unsubs)} sub={pct(T.unsubRate, 2)} goodWhenDown delta={P ? deltaCount(T.unsubs, P.unsubs) : null} />
                  <Tile label="Bounces" value={num(T.bounced)} sub={`${pct(T.bounceRate, 1)}${T.complained ? ` · ${T.complained} spam report${T.complained === 1 ? "" : "s"}` : ""}`} goodWhenDown delta={P ? deltaCount(T.bounced, P.bounced) : null} />
                </div>

                {data.insights.length ? (
                  <Card title="Highlights">
                    <ul className="space-y-1.5 text-[14px] text-ink">{data.insights.map((s, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span>{s}</span></li>)}</ul>
                    {P && data.prevRange ? <p className="mt-3 text-[12px] text-muted">Arrows compare with the {Math.round((new Date(data.prevRange.to).getTime() - new Date(data.prevRange.from).getTime()) / 86400000) + 1} days before.</p> : null}
                  </Card>
                ) : null}

                {/* Trend */}
                <Card title="Over time" right={
                  <label className="flex items-center gap-2 text-[13px] text-muted"><span className="sr-only sm:not-sr-only">Show</span>
                    <select value={metric} onChange={(e) => setMetric(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[14px] font-semibold text-ink">{METRICS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                  </label>}
                  note={`By the ${f.group} each email was sent. ${m.rate ? "Rates are shown as a percent of people reached." : ""}`}>
                  <VBars labels={data.series.map((s) => s.label)} aria={`${m.label} by ${f.group}`} labelEvery={Math.ceil(data.series.length / 12)}
                    series={[{ name: m.label, color: C.brand, values: data.series.map((s) => m.get(s.t) ?? 0) }]} fmt={m.rate ? (n) => pct(n) : num} />
                </Card>

                {/* Ministries */}
                {data.byMinistry.length > 0 ? (
                  <Card title="By ministry" right={<button onClick={() => downloadCsv("brainerd-mail-ministries.csv", ["Ministry", "Emails", "People emailed", "Delivered", "Open rate (est.)", "Click rate", "Total clicks", "Unsubscribes", "Bounces"], data.byMinistry.map((r) => [r.label, r.t.sends, r.t.recipients, r.t.delivered, r.t.openRate?.toFixed(4) ?? "", r.t.clickRate?.toFixed(4) ?? "", r.t.clicks, r.t.unsubs, r.t.bounced]))} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand"><Download size={14} />CSV</button>}>
                    <div className="-mx-4 overflow-x-auto px-4">
                      <table className="w-full min-w-[620px] text-[14px]">
                        <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="py-2 pr-3 font-bold">Ministry</th><th className="px-3 text-right font-bold">Emails</th><th className="px-3 text-right font-bold">Reached</th><th className="px-3 text-right font-bold">Opens</th><th className="px-3 text-right font-bold">Clicks</th><th className="px-3 text-right font-bold">Click rate</th><th className="px-3 text-right font-bold">Unsubs</th><th className="pl-3 text-right font-bold">Bounces</th></tr></thead>
                        <tbody className="divide-y divide-line">
                          {data.byMinistry.map((r) => (
                            <tr key={r.key}>
                              <td className="py-2.5 pr-3 font-semibold text-ink">{r.label}</td>
                              <td className="px-3 text-right tabular-nums">{num(r.t.sends)}</td>
                              <td className="px-3 text-right tabular-nums">{num(r.t.delivered)}</td>
                              <td className="px-3 text-right tabular-nums text-muted">{pct(r.t.openRate)}</td>
                              <td className="px-3 text-right tabular-nums">{num(r.t.clicks)}</td>
                              <td className="px-3 text-right font-semibold tabular-nums text-navy">{pct(r.t.clickRate)}</td>
                              <td className="px-3 text-right tabular-nums">{num(r.t.unsubs)}</td>
                              <td className="pl-3 text-right tabular-nums">{num(r.t.bounced)}</td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>
                    {data.byMinistry.length > 1 ? <div className="mt-5"><div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Click rate by ministry</div><HBars rows={data.byMinistry.filter((r) => r.t.clickRate !== null).sort((a, b) => b.t.clickRate! - a.t.clickRate!).map((r) => ({ label: r.label, value: r.t.clickRate!, sub: `${num(r.t.clickers)} people`, color: ministries.find((x) => x.key === r.key)?.color }))} fmt={(n) => pct(n)} /></div> : null}
                  </Card>
                ) : null}

                {/* All emails */}
                <Card title={`Emails · ${emailRows.length}`} right={<button onClick={exportEmails} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand"><Download size={14} />CSV</button>}>
                  <div className="relative mb-3"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => { setQ(e.target.value); setRows(15); }} placeholder="Search by subject, name or ministry" aria-label="Search emails" className="h-11 w-full rounded-xl border border-line pl-9 pr-3 text-[16px]" /></div>
                  <div className="-mx-4 overflow-x-auto px-4">
                    <table className="w-full min-w-[700px] text-[14px]">
                      <thead><tr className="text-[11px] text-muted"><th scope="col" className="py-2 pr-3 text-left font-bold uppercase tracking-wide"><button onClick={() => setSort((s) => ({ k: "lastSent", dir: s.k === "lastSent" ? (s.dir === 1 ? -1 : 1) : -1 }))} className="inline-flex items-center gap-0.5">EMAIL{sort.k === "lastSent" ? <span aria-hidden>{sort.dir > 0 ? "▲" : "▼"}</span> : null}</button></th>{head("recipients", "Sent")}{head("delivered", "Delivered")}{head("openRate", "Opens")}{head("clickRate", "Click rate")}{head("clicks", "Clicks")}{head("unsubs", "Unsubs", "pl-3")}<th className="w-6" /></tr></thead>
                      <tbody className="divide-y divide-line">
                        {emailRows.slice(0, rows).map((e) => (
                          <tr key={e.emailId} className="group">
                            <td className="max-w-[300px] py-2.5 pr-3">
                              <Link href={`/analytics/${e.emailId}?${toQuery({ ...f, from: null, to: null, kind: "all" })}`} className="block min-w-0">
                                <div className="truncate font-semibold text-ink group-hover:text-brand">{e.subject}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">{e.ministryLabel} · {etDate(e.lastSent)}{e.sends > 1 ? ` · ${e.sends} sends` : ""}{e.kind !== "real" ? <Chip tone="amber">{e.kind === "test" ? "Test" : "Real + test"}</Chip> : null}</div>
                              </Link>
                            </td>
                            <td className="px-3 text-right tabular-nums">{num(e.tally.recipients)}</td>
                            <td className="px-3 text-right tabular-nums">{num(e.tally.delivered)}</td>
                            <td className="px-3 text-right tabular-nums text-muted">{pct(e.tally.openRate)}</td>
                            <td className="px-3 text-right font-semibold tabular-nums text-navy">{pct(e.tally.clickRate)}</td>
                            <td className="px-3 text-right tabular-nums">{num(e.tally.clicks)}</td>
                            <td className="pl-3 text-right tabular-nums">{num(e.tally.unsubs)}</td>
                            <td className="pl-2 text-muted"><ChevronRight size={16} /></td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                  {emailRows.length === 0 ? <p className="py-4 text-center text-[14px] text-muted">No emails match.</p> : null}
                  {emailRows.length > rows ? <button onClick={() => setRows((r) => r + 20)} className="mt-3 w-full rounded-xl border border-line py-2.5 text-[14px] font-semibold text-brand">Show {Math.min(20, emailRows.length - rows)} more</button> : null}
                </Card>

                {/* When and on what */}
                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="Time of day" note="When people tap, in Eastern time.">
                    <VBars labels={data.hours.map((h) => hourName(h.hour))} aria="Clicks and opens by hour of day" labelEvery={3} height={140} showValues={false}
                      series={[{ name: "Clicks", color: C.brand, values: data.hours.map((h) => h.clicks) }, { name: "Opens (est.)", color: C.sky, values: data.hours.map((h) => h.opens) }]} />
                  </Card>
                  <Card title="Day of the week" note="Clicks and opens by the day they happened. Sends is how many emails went out that day.">
                    <VBars labels={data.weekdays.map((d) => d.day)} aria="Clicks and opens by day of week" height={140} showValues={false}
                      series={[{ name: "Clicks", color: C.brand, values: data.weekdays.map((d) => d.clicks) }, { name: "Opens (est.)", color: C.sky, values: data.weekdays.map((d) => d.opens) }, { name: "Sends", color: C.navy, values: data.weekdays.map((d) => d.sends) }]} />
                  </Card>
                  <Card title="Best send time" note="Average click rate by the hour emails were sent (Eastern). Only hours with at least one send.">
                    {data.sendHours.some((h) => h.sends > 0) ? (
                      <HBars rows={data.sendHours.filter((h) => h.sends > 0 && h.avgClickRate !== null).sort((a, b) => b.avgClickRate! - a.avgClickRate!).map((h) => ({ label: `${h.hour % 12 === 0 ? 12 : h.hour % 12}:00 ${h.hour < 12 ? "AM" : "PM"}`, value: h.avgClickRate!, sub: `${h.sends} send${h.sends === 1 ? "" : "s"}` }))} fmt={(n) => pct(n)} />
                    ) : <p className="text-[13px] text-muted">Nothing yet.</p>}
                  </Card>
                  <Card title="How fast people click" note="Time from sending to each person's first click.">
                    <HBars rows={data.timeToClick.map((t) => ({ label: t.label, value: t.n }))} />
                  </Card>
                  <Card title="Devices" note="What people used when they clicked (and opened).">
                    <Split parts={[{ label: "Phone", value: data.devices.phone, color: C.navy }, { label: "Desktop", value: data.devices.desktop, color: C.brand }, { label: "Tablet", value: data.devices.tablet, color: C.teal }, { label: "Unknown", value: data.devices.unknown, color: "#b9c6d6" }]} />
                    {data.devices.opensPhone + data.devices.opensDesktop + data.devices.opensTablet > 0 ? <div className="mt-4"><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Opens (estimate)</div><Split parts={[{ label: "Phone", value: data.devices.opensPhone, color: C.navy }, { label: "Desktop", value: data.devices.opensDesktop, color: C.brand }, { label: "Tablet", value: data.devices.opensTablet, color: C.teal }]} /></div> : null}
                  </Card>
                  <Card title="Channels" note="Email and text reach, and clicks from the web version.">
                    {data.byChannel.length ? (
                      <HBars rows={data.byChannel.map((c) => ({ label: c.label, value: c.t.clicks, sub: c.key === "web" ? "clicks" : `${pct(c.t.clickRate)} click rate · ${num(c.t.delivered)} reached` }))} />
                    ) : <p className="text-[13px] text-muted">Nothing yet.</p>}
                  </Card>
                </div>

                {/* Links */}
                <Card title="Top links" right={<button onClick={exportLinks} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand"><Download size={14} />CSV</button>} note="Every button and link, counted on its own. Link scanners are left out unless you turn them on in Filters.">
                  {data.topLinks.length ? (
                    <ul className="divide-y divide-line">
                      {data.topLinks.slice(0, 12).map((l) => (
                        <li key={l.linkId} className="py-2.5 first:pt-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <Link href={`/analytics/${l.emailId}`} className="min-w-0 truncate font-semibold text-ink hover:text-brand">{l.label}</Link>
                            <span className="shrink-0 tabular-nums font-semibold text-navy">{num(l.clicks)} <span className="text-[12px] font-normal text-muted">{pct(l.share)}</span></span>
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-muted">{l.domain} · {l.emailTitle} · {num(l.unique)} {l.unique === 1 ? "person" : "people"}</div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/50"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (l.clicks / data.topLinks[0].clicks) * 100)}%` }} /></div>
                        </li>))}
                    </ul>
                  ) : <p className="text-[13px] text-muted">No clicks yet.</p>}
                  {data.domains.length > 1 ? <div className="mt-5"><div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Where clicks go</div><HBars rows={data.domains.map((d) => ({ label: d.domain, value: d.clicks, sub: pct(d.share) }))} color={C.teal} /></div> : null}
                </Card>

                {/* Health and reach */}
                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="List health" note="Bounces, spam reports and unsubscribes in these sends.">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
                      <div><dt className="text-muted">Bounced</dt><dd className="font-semibold tabular-nums text-ink">{num(data.deliverability.bounced)} <span className="text-[12px] font-normal text-muted">{pct(T.bounceRate, 1)}</span></dd></div>
                      <div><dt className="text-muted">Spam reports</dt><dd className="font-semibold tabular-nums text-ink">{num(data.deliverability.complained)} <span className="text-[12px] font-normal text-muted">{pct(T.complaintRate, 2)}</span></dd></div>
                      <div><dt className="text-muted">Failed to send</dt><dd className="font-semibold tabular-nums text-ink">{num(data.deliverability.failed)}</dd></div>
                      <div><dt className="text-muted">Unsubscribed</dt><dd className="font-semibold tabular-nums text-ink">{num(data.deliverability.unsubscribed)} <span className="text-[12px] font-normal text-muted">{pct(T.unsubRate, 2)}</span></dd></div>
                    </dl>
                    {data.deliverability.openUnsubTasks ? <p className="mt-4 rounded-xl bg-[#fdf1d8] px-3 py-2 text-[13px] text-[#7a4a05]">{data.deliverability.openUnsubTasks} unsubscribe{data.deliverability.openUnsubTasks === 1 ? " is" : "s are"} waiting for someone to remove the person in ClearStream.</p> : null}
                    {T.botClicks ? <p className="mt-3 text-[12px] text-muted">{num(T.botClicks)} click{T.botClicks === 1 ? "" : "s"} from link scanners {f.bots ? "included above" : "left out of the counts"}.</p> : null}
                  </Card>
                  <Card title="Web version and prayer" note="People who opened “View in browser”, and “I'm praying” taps.">
                    <div className="grid grid-cols-2 gap-4">
                      <div><div className="font-serif text-[26px] font-semibold text-navy">{num(data.webViews.total)}</div><div className="text-[13px] text-muted">web version views</div></div>
                      <div><div className="font-serif text-[26px] font-semibold text-navy">{num(data.prayers.total)}</div><div className="text-[13px] text-muted">prayer taps</div></div>
                    </div>
                    {data.webViews.byEmail.length ? <div className="mt-4"><div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Most viewed</div><HBars rows={data.webViews.byEmail.slice(0, 5).map((w) => ({ label: w.title || "Email", value: w.views }))} color={C.teal} /></div> : null}
                    {data.prayers.byIssue.length ? <div className="mt-4"><div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Most prayed for</div><HBars rows={data.prayers.byIssue.slice(0, 5).map((w) => ({ label: w.title, value: w.taps }))} color={C.green} /></div> : null}
                  </Card>
                </div>

                <p className="flex items-start gap-2 px-1 text-[12px] leading-snug text-muted"><Info size={14} className="mt-0.5 shrink-0" />Opens are estimates: Apple Mail loads every email in the background and Gmail loads images through its own server, so real opens are lower than shown. Clicks are the number to trust. {people ? "You can see who opened and clicked inside each email's report." : "Individual names are visible to the Owner and Admins only."}</p>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
