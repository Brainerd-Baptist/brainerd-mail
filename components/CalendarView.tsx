"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HeaderBrand } from "@/components/HeaderBrand";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, CircleDashed, Clock, ExternalLink, Pause, Play, Plus, Repeat, SkipForward, Trash2, Undo2, X } from "lucide-react";
import { PALETTES, paletteFor, swatch } from "@/lib/ministries";
import { canBuildIn, type Perm } from "@/lib/roles-ui";
import {
  BADGE, LABEL, addDays, approvalDeadline, dayDiff, dayTitle, etKey, monthGrid, monthTitle, outcome, plannedFor, shiftMonth, shortTime, timeLabel, timingNote, toLocalInput, weekDays, weekTitle, whenOf,
  type CalEmail, type CalSlot, type Kind,
} from "@/lib/calendar";
import { describe, repeatOptions, type Series } from "@/lib/series";

type Entry =
  | { type: "email"; at: string; kind: Kind; e: CalEmail }
  | { type: "slot"; at: string; kind: Kind; s: CalSlot };

const ICON: Partial<Record<Kind, JSX.Element>> = {
  on_time: <Check size={12} />, late: <Clock size={12} />, missed: <AlertTriangle size={12} />,
  slot: <CircleDashed size={12} />, slot_missed: <AlertTriangle size={12} />, cancelled: <X size={12} />, skipped: <SkipForward size={12} />,
};
const hrefFor = (e: CalEmail) => (e.status === "pending_approval" ? `/review/${e.id}` : `/editor?e=${e.id}`);
const fullWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

export function CalendarView({ view, ym, weekStart, today, emails, slots, undated, series, perm }: { view: "month" | "week"; ym: string; weekStart: string; today: string; emails: CalEmail[]; slots: CalSlot[]; undated: CalEmail[]; series: Series[]; perm: Perm }) {
  const can = (m: string) => canBuildIn(perm, m);
  const buildable = Object.keys(PALETTES).filter((k) => canBuildIn(perm, k));
  const router = useRouter();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const [sel, setSel] = useState<string>(view === "week" ? (days.includes(today) ? today : weekStart) : today.startsWith(ym) ? today : ym + "-01");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [markOpen, setMarkOpen] = useState<string | null>(null);
  const [markAt, setMarkAt] = useState("");
  const [moveOpen, setMoveOpen] = useState<string | null>(null);
  const [moveAt, setMoveAt] = useState("");
  const [sMin, setSMin] = useState(buildable.includes("church-wide") ? "church-wide" : buildable[0] ?? "church-wide");
  const [sAt, setSAt] = useState("");
  const [sLabel, setSLabel] = useState("");
  const [sRepeat, setSRepeat] = useState("none");

  const now = Date.now();
  const grid = useMemo(() => monthGrid(ym), [ym]);
  const inView = (k: string) => (view === "week" ? days.includes(k) : k.startsWith(ym));
  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series]);

  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    const push = (k: string, en: Entry) => m.set(k, [...(m.get(k) ?? []), en]);
    for (const e of emails) {
      if (filter !== "all" && e.ministry !== filter) continue;
      const at = whenOf(e);
      if (at) push(etKey(at), { type: "email", at, kind: outcome(e, now), e });
    }
    for (const s of slots) {
      if (filter !== "all" && s.ministry !== filter) continue;
      const kind: Kind = s.skipped ? "skipped" : dayDiff(etKey(s.planned_at), today) > 0 ? "slot_missed" : "slot";
      push(etKey(s.planned_at), { type: "slot", at: s.planned_at, kind, s });
    }
    m.forEach((l) => l.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()));
    return m;
  }, [emails, slots, filter, now, today]);

  // Totals for the month on screen (days in the grid that belong to this month).
  const totals = useMemo(() => {
    const t = { planned: 0, on_time: 0, late: 0, missed: 0 };
    byDay.forEach((l, k) => {
      if (!inView(k)) return;
      for (const en of l) {
        if (en.kind === "on_time") t.on_time++;
        else if (en.kind === "late") t.late++;
        else if (en.kind === "missed" || en.kind === "slot_missed") t.missed++;
        else if (en.kind !== "cancelled" && en.kind !== "skipped") t.planned++;
      }
    });
    return t;
  }, [byDay, ym, weekStart, view]);

  const ministryKeys = Object.keys(PALETTES);
  const dayList = byDay.get(sel) ?? [];
  const repeatChoices = useMemo(() => (sAt ? repeatOptions(sAt.slice(0, 10)) : []), [sAt]);

  async function call(url: string, init: RequestInit, key: string) {
    setBusy(key); setErr("");
    try {
      const r = await fetch(url, init);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
      return j;
    } catch (e: any) { setErr(e.message); return null; }
    finally { setBusy(null); }
  }
  const send = (method: string, url: string, body: unknown, key: string) => call(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, key);
  const post = (url: string, body: unknown, key: string) => send("POST", url, body, key);

  async function markSent(e: CalEmail) {
    const j = await post(`/api/emails/${e.id}/mark-sent`, { sentAt: markAt ? new Date(markAt).toISOString() : undefined }, e.id);
    if (j) { setMarkOpen(null); router.refresh(); }
  }
  async function unmark(e: CalEmail) {
    if (!confirm(`Undo “Sent” for “${e.title}”?`)) return;
    const j = await call(`/api/emails/${e.id}/mark-sent`, { method: "DELETE" }, e.id);
    if (j) router.refresh();
  }
  async function moveEmail(e: CalEmail) {
    const j = await post(`/api/emails/${e.id}/plan`, { plannedAt: moveAt ? new Date(moveAt).toISOString() : null }, e.id);
    if (j) { setMoveOpen(null); router.refresh(); }
  }
  async function moveSlot(s: CalSlot) {
    if (!moveAt) return;
    const j = await send("PATCH", `/api/calendar/slots/${s.id}`, { plannedAt: new Date(moveAt).toISOString() }, s.id);
    if (j) { setMoveOpen(null); router.refresh(); }
  }
  async function addSlot() {
    if (!sAt) { setErr("Pick a day and time."); return; }
    if (sRepeat !== "none" && !sLabel.trim()) { setErr("Give the repeating email a name, like “Monthly Kids update”."); return; }
    const j = sRepeat === "none"
      ? await post("/api/calendar/slots", { ministry: sMin, plannedAt: new Date(sAt).toISOString(), label: sLabel }, "slot")
      : await post("/api/calendar/series", { ministry: sMin, label: sLabel, repeat: sRepeat, date: sAt.slice(0, 10), time: sAt.slice(11, 16) }, "slot");
    if (j) { setAdding(false); setSLabel(""); setSRepeat("none"); router.refresh(); }
  }
  async function removeSlot(s: CalSlot) {
    if (!confirm(s.series_id ? "Skip this one? The rest of the series stays." : "Remove this open slot?")) return;
    const j = await call(`/api/calendar/slots/${s.id}`, { method: "DELETE" }, s.id);
    if (j) router.refresh();
  }
  async function restoreSlot(s: CalSlot) {
    const j = await send("PATCH", `/api/calendar/slots/${s.id}`, { skipped: false }, s.id);
    if (j) router.refresh();
  }
  async function startEmail(s: CalSlot) {
    const j = await post("/api/emails", { ministry: s.ministry, start: "starter", plannedAt: s.planned_at, slotId: s.id }, s.id);
    if (j) router.push(`/editor?e=${j.id}`);
  }
  async function pauseSeries(s: Series) {
    const j = await send("PATCH", `/api/calendar/series/${s.id}`, { paused: !s.paused }, s.id);
    if (j) router.refresh();
  }
  async function stopSeries(s: Series) {
    if (!confirm(`Stop “${s.label}” repeating? Empty slots coming up are removed. Emails already started keep their dates.`)) return;
    const j = await call(`/api/calendar/series/${s.id}`, { method: "DELETE" }, s.id);
    if (j) router.refresh();
  }
  function openAdd() {
    const d = new Date(sel + "T12:00:00");
    d.setHours(7, 0, 0, 0);
    setSAt(toLocalInput(d)); setSRepeat("none"); setAdding(true); setErr("");
  }

  const present = Array.from(new Set([...emails.map((e) => e.ministry), ...slots.map((s) => s.ministry)]));

  const weekView = (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const list = byDay.get(day) ?? [];
        return (
          <div key={day} className={`rounded-lg border bg-surface ${day === sel ? "border-brand ring-2 ring-brand/25" : "border-line"}`}>
            <button onClick={() => setSel(day)} className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left">
              <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-bold ${day === today ? "bg-brand text-white" : "text-ink"}`}>{Number(day.slice(8))}</span>
              <span className="text-xs font-semibold text-muted">{new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: day.endsWith("-01") ? "short" : undefined, timeZone: "UTC" })}</span>
            </button>
            <div className="min-h-[56px] space-y-2 p-2 sm:min-h-[220px]">
              {list.length === 0 ? <p className="px-1 text-xs text-muted">Nothing planned</p> : list.map((en) => {
                const p = paletteFor(en.type === "email" ? en.e.ministry : en.s.ministry);
                const text = en.type === "email" ? en.e.title || "Untitled" : en.s.label || "Open slot";
                const note = en.type === "email" ? timingNote(en.e, now) : null;
                const cls = `block w-full rounded-lg p-2 text-left text-xs ${BADGE[en.kind]}`;
                const inner = (
                  <>
                    <span className="flex items-center gap-1 font-semibold"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: swatch(p) }} />{ICON[en.kind]}<span className="truncate">{shortTime(en.at)} · {p.label}</span></span>
                    <span className="mt-0.5 block break-words text-[13px] font-semibold leading-snug">{text}</span>
                    <span className="mt-0.5 block opacity-80">{LABEL[en.kind]}{note ? ` · ${note}` : ""}</span>
                  </>
                );
                return en.type === "email"
                  ? <Link key={en.e.id} href={hrefFor(en.e)} className={cls}>{inner}</Link>
                  : <button key={en.s.id} onClick={() => setSel(day)} className={cls}>{inner}</button>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-full bg-mist pb-16">
      <header className="sticky top-0 z-10 border-b border-brand/15 bg-surface/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <NavMenu />
          <HeaderBrand label="Mail" />
          <span className="flex-1" />
          <HelpButton />
          {buildable.length ? <button onClick={openAdd} className="pill-btn shrink-0 whitespace-nowrap bg-brand text-white"><Plus size={16} className="mr-1.5" /><span className="sm:hidden">Plan</span><span className="hidden sm:inline">Plan an email</span></button> : null}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 font-serif text-2xl font-semibold text-navy">{view === "week" ? weekTitle(weekStart) : monthTitle(ym)}</h1>
          <Link href={view === "week" ? `/calendar?v=week&d=${addDays(weekStart, -7)}` : `/calendar?m=${shiftMonth(ym, -1)}`} aria-label={view === "week" ? "Previous week" : "Previous month"} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink"><ChevronLeft size={20} /></Link>
          <Link href={view === "week" ? `/calendar?v=week&d=${addDays(weekStart, 7)}` : `/calendar?m=${shiftMonth(ym, 1)}`} aria-label={view === "week" ? "Next week" : "Next month"} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink"><ChevronRight size={20} /></Link>
          <Link href={view === "week" ? "/calendar?v=week" : "/calendar"} className="flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink">Today</Link>
          <span className="flex-1" />
          <div role="tablist" aria-label="Calendar view" className="flex items-center gap-1 rounded-full bg-line p-1">
            <Link role="tab" aria-selected={view === "month"} href={`/calendar?m=${sel.slice(0, 7)}`} className={`flex h-9 items-center rounded-full px-4 text-sm font-semibold ${view === "month" ? "bg-surface text-navy shadow-sm" : "text-muted"}`}>Month</Link>
            <Link role="tab" aria-selected={view === "week"} href={`/calendar?v=week&d=${sel}`} className={`flex h-9 items-center rounded-full px-4 text-sm font-semibold ${view === "week" ? "bg-surface text-navy shadow-sm" : "text-muted"}`}>Week</Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className={`rounded-full px-3 py-1 ${BADGE.draft}`}>{totals.planned} coming up</span>
          <span className={`rounded-full px-3 py-1 ${BADGE.on_time}`}>{totals.on_time} sent on time</span>
          <span className={`rounded-full px-3 py-1 ${BADGE.late}`}>{totals.late} sent late</span>
          <span className={`rounded-full px-3 py-1 ${BADGE.missed}`}>{totals.missed} missed</span>
        </div>

        {present.length > 1 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {["all", ...present].map((m) => (
              <button key={m} onClick={() => setFilter(m)} className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === m ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink"}`}>{m === "all" ? "All" : paletteFor(m).label}</button>
            ))}
          </div>
        ) : null}

        {err && !adding ? <p role="alert" className="rounded-lg bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}

        {view === "week" ? weekView : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line bg-mist text-center text-xs font-semibold text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
              {week.map((day) => {
                const list = byDay.get(day) ?? [];
                const inMonth = day.startsWith(ym);
                const isSel = day === sel;
                return (
                  <div key={day} onClick={() => setSel(day)} className={`min-h-[56px] cursor-pointer border-r border-line p-1 last:border-r-0 sm:min-h-[104px] sm:p-1.5 ${inMonth ? "bg-surface" : "bg-mist"} ${isSel ? "ring-2 ring-inset ring-brand" : ""}`}>
                    <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${day === today ? "bg-brand text-white" : inMonth ? "text-ink" : "text-muted"}`}>{Number(day.slice(8))}</div>
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {list.slice(0, 6).map((en, i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: swatch(paletteFor(en.type === "email" ? en.e.ministry : en.s.ministry)) }} />)}
                    </div>
                    <div className="hidden space-y-1 sm:block">
                      {list.slice(0, 3).map((en) => {
                        const p = paletteFor(en.type === "email" ? en.e.ministry : en.s.ministry);
                        const text = en.type === "email" ? en.e.title || "Untitled" : en.s.label || "Open slot";
                        const cls = `flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-semibold leading-4 ${BADGE[en.kind]}`;
                        const inner = (<><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: swatch(p) }} />{ICON[en.kind]}<span className="truncate">{shortTime(en.at)} {text}</span></>);
                        return en.type === "email"
                          ? <Link key={en.e.id} href={hrefFor(en.e)} onClick={(ev) => ev.stopPropagation()} title={`${p.label}: ${text}`} className={cls}>{inner}</Link>
                          : <button key={en.s.id} onClick={(ev) => { ev.stopPropagation(); setSel(day); }} title={`${p.label}: ${text}`} className={`${cls} w-full text-left`}>{inner}</button>;
                      })}
                      {list.length > 3 ? <div className="px-1 text-[11px] font-semibold text-muted">+{list.length - 3} more</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        )}

        <section aria-label={dayTitle(sel)} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold text-navy">{dayTitle(sel)}</h2>
            {buildable.length ? <button onClick={openAdd} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand hover:bg-mist"><Plus size={16} />Plan an email</button> : null}
          </div>
          {dayList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-[15px] text-muted">Nothing planned for this day.</div>
          ) : (
            <ul className="space-y-3">
              {dayList.map((en) => {
                const m = en.type === "email" ? en.e.ministry : en.s.ministry;
                const p = paletteFor(m);
                const id = en.type === "email" ? en.e.id : en.s.id;
                const plan = en.type === "email" ? plannedFor(en.e) : en.s.planned_at;
                const note = en.type === "email" ? timingNote(en.e, now) : null;
                const ser = en.type === "slot" && en.s.series_id ? seriesById.get(en.s.series_id) : en.type === "email" && en.e.series_id ? seriesById.get(en.e.series_id) : undefined;
                const dueIso = plan && new Date(plan).getTime() > now ? approvalDeadline(plan) : null;
                return (
                  <li key={id} className={`flex overflow-hidden rounded-lg border border-line bg-surface ${busy === id ? "opacity-60" : ""}`}>
                    <span className="w-1.5 shrink-0" style={{ background: swatch(p) }} />
                    <div className="min-w-0 flex-1 p-4">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-semibold" style={{ color: p.dark }}>{p.label}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${BADGE[en.kind]}`}>{ICON[en.kind]}{LABEL[en.kind]}</span>
                        {note ? <span className={`font-semibold ${en.kind === "missed" || en.kind === "late" ? "text-[#8a3b00]" : "text-muted"}`}>{note}</span> : null}
                        {ser ? <span className="inline-flex items-center gap-1 text-muted"><Repeat size={12} />{describe(ser)}</span> : null}
                      </div>
                      {en.type === "email" ? (
                        <>
                          <p className="mt-1 truncate text-[16px] font-semibold text-ink">{en.e.title || "Untitled"}</p>
                          {en.e.subject ? <p className="truncate text-sm text-muted">{en.e.subject}</p> : null}
                          <p className="mt-1 text-sm text-muted">
                            {plannedFor(en.e) ? <>Planned {timeLabel(plannedFor(en.e)!)} ET</> : "No planned time"}
                            {en.e.sent_at ? <> &middot; Sent {new Date(en.e.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })} at {timeLabel(en.e.sent_at)} ET</> : null}
                          </p>
                          {en.e.status === "draft" && dueIso ? <p className="mt-1 text-sm text-muted">Send it for approval by {fullWhen(dueIso)} to allow 72 hours.</p> : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link href={hrefFor(en.e)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-brand"><ExternalLink size={15} />Open email</Link>
                            {en.e.status !== "sent" && en.e.status !== "cancelled" && can(en.e.ministry) ? (
                              <button onClick={() => { setMarkOpen(markOpen === en.e.id ? null : en.e.id); setMarkAt(toLocalInput(new Date())); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-ink"><Check size={15} />Mark as sent</button>
                            ) : null}
                            {en.e.status === "sent" && en.e.sent_marked_by && can(en.e.ministry) ? <button onClick={() => unmark(en.e)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted"><Undo2 size={15} />Undo</button> : null}
                            {en.e.status === "draft" && can(en.e.ministry) ? (
                              <button onClick={() => { setMoveOpen(moveOpen === en.e.id ? null : en.e.id); setMoveAt(toLocalInput(plannedFor(en.e) ? new Date(plannedFor(en.e)!) : new Date())); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted"><Clock size={15} />Change time</button>
                            ) : null}
                          </div>
                          {markOpen === en.e.id ? (
                            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-mist p-3">
                              <label className="block"><span className="label">When did it go out?</span><input type="datetime-local" className="field" value={markAt} onChange={(ev) => setMarkAt(ev.target.value)} /></label>
                              <button onClick={() => markSent(en.e)} disabled={busy === en.e.id} className="pill-btn bg-brand text-white disabled:opacity-60">Mark as sent</button>
                            </div>
                          ) : null}
                          {moveOpen === en.e.id ? (
                            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-mist p-3">
                              <label className="block"><span className="label">Planned to go out</span><input type="datetime-local" className="field" value={moveAt} onChange={(ev) => setMoveAt(ev.target.value)} /></label>
                              <button onClick={() => moveEmail(en.e)} disabled={busy === en.e.id} className="pill-btn bg-brand text-white disabled:opacity-60">Save</button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p className="mt-1 truncate text-[16px] font-semibold text-ink">{en.s.label || "Open slot"}</p>
                          <p className="mt-1 text-sm text-muted">{en.s.skipped ? "Skipped. It won’t count as missed." : `Reserved for ${timeLabel(en.s.planned_at)} ET. No email yet.`}</p>
                          {!en.s.skipped && dueIso ? <p className="mt-1 text-sm text-muted">Send it for approval by {fullWhen(dueIso)} to allow 72 hours.</p> : null}
                          {!en.s.skipped && en.s.series_id ? <p className="mt-1 text-sm text-muted">Starting it copies the last email in this series, so you only update what’s new.</p> : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {!can(en.s.ministry) ? null : en.s.skipped ? (
                              <button onClick={() => restoreSlot(en.s)} disabled={!!busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60"><Undo2 size={15} />Restore</button>
                            ) : (
                              <>
                                <button onClick={() => startEmail(en.s)} disabled={!!busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"><Plus size={15} />Start the email</button>
                                <button onClick={() => { setMoveOpen(moveOpen === en.s.id ? null : en.s.id); setMoveAt(toLocalInput(new Date(en.s.planned_at))); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted"><Clock size={15} />Change time</button>
                                <button onClick={() => removeSlot(en.s)} disabled={!!busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted disabled:opacity-60">{en.s.series_id ? <><SkipForward size={15} />Skip this one</> : <><Trash2 size={15} />Remove</>}</button>
                              </>
                            )}
                          </div>
                          {moveOpen === en.s.id ? (
                            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-mist p-3">
                              <label className="block"><span className="label">Goes out</span><input type="datetime-local" className="field" value={moveAt} onChange={(ev) => setMoveAt(ev.target.value)} /></label>
                              <button onClick={() => moveSlot(en.s)} disabled={busy === en.s.id} className="pill-btn bg-brand text-white disabled:opacity-60">Save</button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {series.length > 0 ? (
          <section className="space-y-2 pt-2">
            <h2 className="font-serif text-lg font-semibold text-navy">Repeating emails</h2>
            <ul className="space-y-2">
              {series.map((s) => {
                const p = paletteFor(s.ministry);
                return (
                  <li key={s.id} className={`flex items-center gap-3 rounded-lg border border-line bg-surface p-3 ${busy === s.id ? "opacity-60" : ""}`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch(p) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{s.label}{s.paused ? " (paused)" : ""}</span>
                      <span className="block truncate text-xs text-muted">{p.label} &middot; {describe(s)}{s.ends_on ? ` until ${s.ends_on}` : ""}</span>
                    </span>
                    {can(s.ministry) ? <button onClick={() => pauseSeries(s)} disabled={!!busy} aria-label={s.paused ? "Resume" : "Pause"} title={s.paused ? "Resume" : "Pause"} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-black/5 disabled:opacity-40">{s.paused ? <Play size={18} /> : <Pause size={18} />}</button> : null}
                    {can(s.ministry) ? <button onClick={() => stopSeries(s)} disabled={!!busy} aria-label="Stop repeating" title="Stop repeating" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-black/5 lg:hover:text-red-600 disabled:opacity-40"><Trash2 size={18} /></button> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {undated.length > 0 ? (
          <section className="space-y-2 pt-2">
            <h2 className="font-serif text-lg font-semibold text-navy">Not on the calendar yet</h2>
            <p className="text-sm text-muted">Drafts with no planned time. Open one and set when it should go out.</p>
            <ul className="space-y-2">
              {undated.map((e) => (
                <li key={e.id}><Link href={hrefFor(e)} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 active:bg-mist"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch(paletteFor(e.ministry)) }} /><span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{e.title || "Untitled"}</span><span className="shrink-0 text-xs text-muted">{paletteFor(e.ministry).label}</span></Link></li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      {adding ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => busy !== "slot" && setAdding(false)}>
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">Plan an email</h2><button aria-label="Close" onClick={() => setAdding(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button></div>
            <p className="mb-4 text-sm text-muted">Hold a day and time for a ministry before the email exists, once or on a repeat, so everyone can see the plan.</p>
            <label className="mb-3 block"><span className="label">Ministry</span>
              <select className="field" value={sMin} onChange={(e) => setSMin(e.target.value)}>{buildable.map((k) => <option key={k} value={k}>{PALETTES[k].label}</option>)}</select>
            </label>
            <label className="mb-3 block"><span className="label">Goes out</span><input type="datetime-local" className="field" value={sAt} onChange={(e) => setSAt(e.target.value)} /></label>
            <label className="mb-3 block"><span className="label">Repeat</span>
              <select className="field" value={sRepeat} onChange={(e) => setSRepeat(e.target.value)}>
                <option value="none">Doesn’t repeat</option>
                {repeatChoices.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="mb-5 block"><span className="label">{sRepeat === "none" ? "What is it for? (optional)" : "Name"}</span><input className="field" value={sLabel} maxLength={120} onChange={(e) => setSLabel(e.target.value)} placeholder={sRepeat === "none" ? "Fall Fest announcement, …" : "Monthly Kids update"} /></label>
            {err ? <p role="alert" className="mb-3 rounded-lg bg-[#fbe9eb] p-3 text-sm text-[#8a1020]">{err}</p> : null}
            <button onClick={addSlot} disabled={busy === "slot"} className="pill-btn w-full bg-brand text-white disabled:opacity-60">{busy === "slot" ? "Saving…" : sRepeat === "none" ? "Reserve slot" : "Start repeating"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
