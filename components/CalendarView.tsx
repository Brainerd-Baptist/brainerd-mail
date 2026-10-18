"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, CircleDashed, Clock, ExternalLink, Plus, Trash2, Undo2, X } from "lucide-react";
import { PALETTES, paletteFor } from "@/lib/ministries";
import {
  BADGE, LABEL, dayTitle, etKey, monthGrid, monthTitle, outcome, plannedFor, shiftMonth, shortTime, timeLabel, toLocalInput, whenOf,
  type CalEmail, type CalSlot, type Kind,
} from "@/lib/calendar";

type Entry =
  | { type: "email"; at: string; kind: Kind; e: CalEmail }
  | { type: "slot"; at: string; kind: Kind; s: CalSlot };

const ICON: Partial<Record<Kind, JSX.Element>> = {
  on_time: <Check size={12} />, late: <Clock size={12} />, early: <Clock size={12} />, missed: <AlertTriangle size={12} />,
  slot: <CircleDashed size={12} />, slot_missed: <AlertTriangle size={12} />, cancelled: <X size={12} />,
};
const hrefFor = (e: CalEmail) => (e.status === "pending_approval" ? `/review/${e.id}` : `/editor?e=${e.id}`);

export function CalendarView({ ym, today, emails, slots, undated }: { ym: string; today: string; emails: CalEmail[]; slots: CalSlot[]; undated: CalEmail[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<string>(today.startsWith(ym) ? today : ym + "-01");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [markOpen, setMarkOpen] = useState<string | null>(null);
  const [markAt, setMarkAt] = useState("");
  const [moveOpen, setMoveOpen] = useState<string | null>(null);
  const [moveAt, setMoveAt] = useState("");
  const [sMin, setSMin] = useState("church-wide");
  const [sAt, setSAt] = useState("");
  const [sLabel, setSLabel] = useState("");

  const now = Date.now();
  const grid = useMemo(() => monthGrid(ym), [ym]);

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
      push(etKey(s.planned_at), { type: "slot", at: s.planned_at, kind: new Date(s.planned_at).getTime() < now - 2 * 3600000 ? "slot_missed" : "slot", s });
    }
    m.forEach((l) => l.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()));
    return m;
  }, [emails, slots, filter, now]);

  // Totals for the month on screen (days in the grid that belong to this month).
  const totals = useMemo(() => {
    const t: Record<string, number> = { planned: 0, on_time: 0, late: 0, missed: 0 };
    byDay.forEach((l, k) => {
      if (!k.startsWith(ym)) return;
      for (const en of l) {
        if (en.kind === "on_time") t.on_time++;
        else if (en.kind === "late" || en.kind === "early") t.late++;
        else if (en.kind === "missed" || en.kind === "slot_missed") t.missed++;
        else if (en.kind !== "cancelled") t.planned++;
      }
    });
    return t;
  }, [byDay, ym]);

  const ministryKeys = Object.keys(PALETTES);
  const dayList = byDay.get(sel) ?? [];

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
  const post = (url: string, body: unknown, key: string) => call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, key);

  async function markSent(e: CalEmail) {
    const j = await post(`/api/emails/${e.id}/mark-sent`, { sentAt: markAt ? new Date(markAt).toISOString() : undefined }, e.id);
    if (j) { setMarkOpen(null); router.refresh(); }
  }
  async function unmark(e: CalEmail) {
    if (!confirm(`Undo “Sent” for “${e.title}”?`)) return;
    const j = await call(`/api/emails/${e.id}/mark-sent`, { method: "DELETE" }, e.id);
    if (j) router.refresh();
  }
  async function move(e: CalEmail) {
    const j = await post(`/api/emails/${e.id}/plan`, { plannedAt: moveAt ? new Date(moveAt).toISOString() : null }, e.id);
    if (j) { setMoveOpen(null); router.refresh(); }
  }
  async function addSlot() {
    if (!sAt) { setErr("Pick a day and time."); return; }
    const j = await post("/api/calendar/slots", { ministry: sMin, plannedAt: new Date(sAt).toISOString(), label: sLabel }, "slot");
    if (j) { setAdding(false); setSLabel(""); router.refresh(); }
  }
  async function removeSlot(s: CalSlot) {
    if (!confirm("Remove this open slot?")) return;
    const j = await call(`/api/calendar/slots/${s.id}`, { method: "DELETE" }, s.id);
    if (j) router.refresh();
  }
  async function startEmail(s: CalSlot) {
    const j = await post("/api/emails", { ministry: s.ministry, start: "starter", plannedAt: s.planned_at, slotId: s.id }, s.id);
    if (j) router.push(`/editor?e=${j.id}`);
  }
  function openAdd() {
    const d = new Date(sel + "T12:00:00");
    d.setHours(7, 0, 0, 0);
    setSAt(toLocalInput(d)); setAdding(true); setErr("");
  }

  const present = Array.from(new Set([...emails.map((e) => e.ministry), ...slots.map((s) => s.ministry)]));

  return (
    <div className="min-h-full bg-mist pb-16">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href="/emails" className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-[#f4f8fd]"><ArrowLeft size={18} /><span className="hidden sm:inline">Emails</span></Link>
          <span className="flex items-center gap-3"><img src="/brand/brainerd-logo.png" alt="Brainerd Baptist Church" width={112} height={17} className="h-[17px] w-auto" /><span className="text-[15px] font-bold tracking-[0.16em] text-navy">MAIL</span></span>
          <span className="flex-1" />
          <button onClick={openAdd} className="pill-btn bg-[#1e61b9] text-white"><Plus size={16} className="mr-1.5" />Reserve a slot</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 font-serif text-2xl font-semibold text-navy">{monthTitle(ym)}</h1>
          <Link href={`/calendar?m=${shiftMonth(ym, -1)}`} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink"><ChevronLeft size={20} /></Link>
          <Link href={`/calendar?m=${shiftMonth(ym, 1)}`} aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink"><ChevronRight size={20} /></Link>
          <Link href="/calendar" className="flex h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink">Today</Link>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className={`rounded-full px-3 py-1 ${BADGE.draft}`}>{totals.planned} coming up</span>
          <span className={`rounded-full px-3 py-1 ${BADGE.on_time}`}>{totals.on_time} sent on time</span>
          <span className={`rounded-full px-3 py-1 ${BADGE.late}`}>{totals.late} sent early or late</span>
          <span className={`rounded-full px-3 py-1 ${BADGE.missed}`}>{totals.missed} missed</span>
        </div>

        {present.length > 1 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {["all", ...present].map((m) => (
              <button key={m} onClick={() => setFilter(m)} className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === m ? "border-navy bg-navy text-white" : "border-line bg-white text-ink"}`}>{m === "all" ? "All" : paletteFor(m).label}</button>
            ))}
          </div>
        ) : null}

        {err ? <p role="alert" className="rounded-xl bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}

        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="grid grid-cols-7 border-b border-line bg-[#f7f9fc] text-center text-xs font-semibold text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
              {week.map((day) => {
                const list = byDay.get(day) ?? [];
                const inMonth = day.startsWith(ym);
                const isSel = day === sel;
                return (
                  <div key={day} onClick={() => setSel(day)} className={`min-h-[56px] cursor-pointer border-r border-line p-1 last:border-r-0 sm:min-h-[104px] sm:p-1.5 ${inMonth ? "bg-white" : "bg-[#f7f9fc]"} ${isSel ? "ring-2 ring-inset ring-[#1e61b9]" : ""}`}>
                    <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${day === today ? "bg-[#1e61b9] text-white" : inMonth ? "text-ink" : "text-[#9aa8bd]"}`}>{Number(day.slice(8))}</div>
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {list.slice(0, 6).map((en, i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: paletteFor(en.type === "email" ? en.e.ministry : en.s.ministry).button }} />)}
                    </div>
                    <div className="hidden space-y-1 sm:block">
                      {list.slice(0, 3).map((en) => {
                        const p = paletteFor(en.type === "email" ? en.e.ministry : en.s.ministry);
                        const text = en.type === "email" ? en.e.title || "Untitled" : en.s.label || "Open slot";
                        const cls = `flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-semibold leading-4 ${BADGE[en.kind]}`;
                        const inner = (<><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.button }} />{ICON[en.kind]}<span className="truncate">{shortTime(en.at)} {text}</span></>);
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

        <section aria-label={dayTitle(sel)} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold text-navy">{dayTitle(sel)}</h2>
            <button onClick={openAdd} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[#1e61b9] hover:bg-[#f4f8fd]"><Plus size={16} />Reserve a slot</button>
          </div>
          {dayList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-[15px] text-muted">Nothing planned for this day.</div>
          ) : (
            <ul className="space-y-3">
              {dayList.map((en) => {
                const m = en.type === "email" ? en.e.ministry : en.s.ministry;
                const p = paletteFor(m);
                const id = en.type === "email" ? en.e.id : en.s.id;
                return (
                  <li key={id} className={`flex overflow-hidden rounded-xl border border-line bg-white ${busy === id ? "opacity-60" : ""}`}>
                    <span className="w-1.5 shrink-0" style={{ background: p.button }} />
                    <div className="min-w-0 flex-1 p-4">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-semibold" style={{ color: p.dark }}>{p.label}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${BADGE[en.kind]}`}>{ICON[en.kind]}{LABEL[en.kind]}</span>
                      </div>
                      {en.type === "email" ? (
                        <>
                          <p className="mt-1 truncate text-[16px] font-semibold text-ink">{en.e.title || "Untitled"}</p>
                          {en.e.subject ? <p className="truncate text-sm text-muted">{en.e.subject}</p> : null}
                          <p className="mt-1 text-sm text-muted">
                            {plannedFor(en.e) ? <>Planned {timeLabel(plannedFor(en.e)!)} ET</> : "No planned time"}
                            {en.e.sent_at ? <> &middot; Sent {new Date(en.e.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })} at {timeLabel(en.e.sent_at)} ET</> : null}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link href={hrefFor(en.e)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-[#1e61b9]"><ExternalLink size={15} />Open email</Link>
                            {en.e.status !== "sent" && en.e.status !== "cancelled" ? (
                              <button onClick={() => { setMarkOpen(markOpen === en.e.id ? null : en.e.id); setMarkAt(toLocalInput(new Date())); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-ink"><Check size={15} />Mark as sent</button>
                            ) : null}
                            {en.e.status === "sent" && en.e.sent_marked_by ? <button onClick={() => unmark(en.e)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted"><Undo2 size={15} />Undo</button> : null}
                            {en.e.status === "draft" ? (
                              <button onClick={() => { setMoveOpen(moveOpen === en.e.id ? null : en.e.id); setMoveAt(toLocalInput(plannedFor(en.e) ? new Date(plannedFor(en.e)!) : new Date())); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted"><Clock size={15} />Change time</button>
                            ) : null}
                          </div>
                          {markOpen === en.e.id ? (
                            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-[#f7f9fc] p-3">
                              <label className="block"><span className="label">When did it go out?</span><input type="datetime-local" className="field" value={markAt} onChange={(ev) => setMarkAt(ev.target.value)} /></label>
                              <button onClick={() => markSent(en.e)} disabled={busy === en.e.id} className="pill-btn bg-[#1e61b9] text-white disabled:opacity-60">Mark as sent</button>
                            </div>
                          ) : null}
                          {moveOpen === en.e.id ? (
                            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-[#f7f9fc] p-3">
                              <label className="block"><span className="label">Planned to go out</span><input type="datetime-local" className="field" value={moveAt} onChange={(ev) => setMoveAt(ev.target.value)} /></label>
                              <button onClick={() => move(en.e)} disabled={busy === en.e.id} className="pill-btn bg-[#1e61b9] text-white disabled:opacity-60">Save</button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p className="mt-1 truncate text-[16px] font-semibold text-ink">{en.s.label || "Open slot"}</p>
                          <p className="mt-1 text-sm text-muted">Reserved for {timeLabel(en.s.planned_at)} ET. No email yet.</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => startEmail(en.s)} disabled={!!busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#1e61b9] px-4 text-sm font-semibold text-white disabled:opacity-60"><Plus size={15} />Start the email</button>
                            <button onClick={() => removeSlot(en.s)} disabled={!!busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted disabled:opacity-60"><Trash2 size={15} />Remove</button>
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {undated.length > 0 ? (
          <section className="space-y-2 pt-2">
            <h2 className="font-serif text-lg font-semibold text-navy">Not on the calendar yet</h2>
            <p className="text-sm text-muted">Drafts with no planned time. Open one and set when it should go out.</p>
            <ul className="space-y-2">
              {undated.map((e) => (
                <li key={e.id}><Link href={hrefFor(e)} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 active:bg-[#f4f8fd]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: paletteFor(e.ministry).button }} /><span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{e.title || "Untitled"}</span><span className="shrink-0 text-xs text-muted">{paletteFor(e.ministry).label}</span></Link></li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      {adding ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => busy !== "slot" && setAdding(false)}>
          <div className="w-full rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">Reserve a slot</h2><button aria-label="Close" onClick={() => setAdding(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button></div>
            <p className="mb-4 text-sm text-muted">Hold a day and time for a ministry before the email exists, so everyone can see the plan.</p>
            <label className="mb-3 block"><span className="label">Ministry</span>
              <select className="field" value={sMin} onChange={(e) => setSMin(e.target.value)}>{ministryKeys.map((k) => <option key={k} value={k}>{PALETTES[k].label}</option>)}</select>
            </label>
            <label className="mb-3 block"><span className="label">Goes out</span><input type="datetime-local" className="field" value={sAt} onChange={(e) => setSAt(e.target.value)} /></label>
            <label className="mb-5 block"><span className="label">What is it for? (optional)</span><input className="field" value={sLabel} maxLength={120} onChange={(e) => setSLabel(e.target.value)} placeholder="Weekly update, Fall Fest, …" /></label>
            {err ? <p role="alert" className="mb-3 rounded-xl bg-[#fbe9eb] p-3 text-sm text-[#8a1020]">{err}</p> : null}
            <button onClick={addSlot} disabled={busy === "slot"} className="pill-btn w-full bg-[#1e61b9] text-white disabled:opacity-60">{busy === "slot" ? "Saving…" : "Reserve slot"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
