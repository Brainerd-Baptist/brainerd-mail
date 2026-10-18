"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Eye, History, Pencil, RotateCcw, Send, Star, X } from "lucide-react";
import { LEAD_HOURS, MIN_SEND_MINUTES, REMINDER_HOURS, SENDING_ENABLED, isExpedited, leadHours, when } from "@/lib/approval";
import { ago } from "@/lib/time";

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// Earliest 8:00 AM at least 72 hours out (the default send time).
function defaultSendTime(): string {
  const d = new Date(Date.now() + LEAD_HOURS * 3600000);
  d.setHours(8, 0, 0, 0);
  if (d.getTime() < Date.now() + LEAD_HOURS * 3600000) d.setDate(d.getDate() + 1);
  return local(d);
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">{title}</h2><button aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function SubmitSheet({ onClose, onSubmit, softWarnings, initial }: { onClose: () => void; onSubmit: (sendAtIso: string) => Promise<string | null>; softWarnings: number; initial?: string | null }) {
  // Start from the time planned on the calendar if it is still far enough away.
  const [value, setValue] = useState(() => (initial && new Date(initial).getTime() >= Date.now() + MIN_SEND_MINUTES * 60000 ? local(new Date(initial)) : defaultSendTime()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sendAt = useMemo(() => new Date(value), [value]);
  const valid = !isNaN(sendAt.getTime()) && sendAt.getTime() >= Date.now() + MIN_SEND_MINUTES * 60000;
  const hrs = valid ? leadHours(sendAt) : 0;
  const expedited = valid && isExpedited(sendAt);

  return (
    <Sheet title="Send for approval" onClose={() => !busy && onClose()}>
      <label className="mb-3 block">
        <span className="label">When should it go out?</span>
        <input type="datetime-local" className="field" value={value} min={local(new Date(Date.now() + MIN_SEND_MINUTES * 60000))} onChange={(e) => setValue(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">{valid ? `${when(sendAt.toISOString())}, ${hrs >= 48 ? `${Math.round(hrs / 24)} days` : `${Math.round(hrs)} hours`} from now` : "Pick a time at least half an hour from now."}</span>
      </label>
      {valid && !expedited ? (
        <p className="mb-4 rounded-xl bg-[#e8f5ee] p-3 text-sm text-[#0d3b2c]">That gives {LEAD_HOURS}+ hours of lead time. You’ll get reminders at {REMINDER_HOURS.join(", ")} hours if it hasn’t been reviewed.</p>
      ) : null}
      {expedited ? (
        <p className="mb-4 flex gap-2 rounded-xl bg-[#fff3d6] p-3 text-sm text-[#5c3a00]"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span><b>Expedited.</b> Under {LEAD_HOURS} hours, so it needs explicit approval and will never send on its own. For a normal send, pick a time {LEAD_HOURS} or more hours out.</span></p>
      ) : null}
      {softWarnings > 0 ? <p className="mb-4 text-sm text-muted">{softWarnings} suggestion{softWarnings === 1 ? "" : "s"} in the Check tab {softWarnings === 1 ? "is" : "are"} still open. They won’t stop this.</p> : null}
      {!SENDING_ENABLED ? <p className="mb-4 text-sm text-muted">Sending isn’t switched on yet, so approval won’t send anything for now.</p> : null}
      {err ? <p role="alert" className="mb-3 rounded-xl bg-[#fbe9eb] p-3 text-sm text-[#8a1020]">{err}</p> : null}
      <button disabled={!valid || busy} onClick={async () => { setBusy(true); setErr(""); const m = await onSubmit(sendAt.toISOString()); if (m) { setErr(m); setBusy(false); } }} className="pill-btn w-full bg-[#1e61b9] text-white disabled:opacity-50"><Send size={16} className="mr-1.5" />{busy ? "Sending…" : "Send for approval"}</button>
    </Sheet>
  );
}

// "When does this go out?": set the day and time right from the editor. Saving just the date puts it
// on the calendar; sending for approval locks the time in and starts the 72-hour clock.
export function ScheduleSheet({ onClose, initial, locked, lockedAt, onSave, onSubmit, blockedReason }: {
  onClose: () => void; initial: string | null; locked: boolean; lockedAt: string | null;
  onSave: (iso: string | null) => Promise<string | null>;
  onSubmit: (iso: string) => Promise<string | null>;
  blockedReason?: string;
}) {
  const [value, setValue] = useState(() => (initial && !isNaN(new Date(initial).getTime()) ? local(new Date(initial)) : defaultSendTime()));
  const [busy, setBusy] = useState<"" | "save" | "submit" | "clear">("");
  const [err, setErr] = useState("");
  const at = useMemo(() => new Date(value), [value]);
  const valid = !isNaN(at.getTime());
  const submitOk = valid && at.getTime() >= Date.now() + MIN_SEND_MINUTES * 60000;
  const hrs = valid ? leadHours(at) : 0;
  const expedited = submitOk && isExpedited(at);
  async function run(kind: "save" | "submit" | "clear") {
    setBusy(kind); setErr("");
    const m = kind === "clear" ? await onSave(null) : kind === "save" ? await onSave(at.toISOString()) : await onSubmit(at.toISOString());
    if (m) { setErr(m); setBusy(""); } else onClose();
  }

  if (locked) {
    return (
      <Sheet title="Schedule" onClose={onClose}>
        <p className="mb-3 flex items-start gap-2 text-[15px] text-ink"><CalendarClock size={20} className="mt-0.5 shrink-0 text-[#1e61b9]" /><span>{lockedAt ? <>Set to go out <b>{when(lockedAt)}</b>.</> : "This email already has a send time."}</span></p>
        <p className="mb-4 text-sm text-muted">The time is locked while the email is waiting or approved. Use “Edit again” on the banner above to change it. That cancels the approval.</p>
        <button onClick={onClose} className="pill-btn w-full border-2 border-navy text-navy">Close</button>
      </Sheet>
    );
  }
  return (
    <Sheet title="Schedule" onClose={() => !busy && onClose()}>
      <label className="mb-3 block">
        <span className="label">Goes out</span>
        <input type="datetime-local" className="field" value={value} onChange={(e) => setValue(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">{valid ? `${when(at.toISOString())}${at.getTime() > Date.now() ? `, ${hrs >= 48 ? `${Math.round(hrs / 24)} days` : `${Math.round(hrs)} hours`} from now` : ""}` : "Pick a day and time."}</span>
      </label>
      {submitOk && !expedited ? <p className="mb-4 rounded-xl bg-[#e8f5ee] p-3 text-sm text-[#0d3b2c]">That gives {LEAD_HOURS}+ hours of lead time for approval.</p> : null}
      {expedited ? <p className="mb-4 flex gap-2 rounded-xl bg-[#fff3d6] p-3 text-sm text-[#5c3a00]"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span><b>Expedited.</b> Under {LEAD_HOURS} hours, so it needs explicit approval and will never send on its own.</span></p> : null}
      {!SENDING_ENABLED ? <p className="mb-4 text-sm text-muted">Sending isn’t switched on yet. Scheduling sets the plan and the calendar entry, and nothing goes out on its own for now.</p> : null}
      {blockedReason ? <p className="mb-4 rounded-xl bg-[#fff3d6] p-3 text-sm text-[#5c3a00]">{blockedReason}</p> : null}
      {err ? <p role="alert" className="mb-3 rounded-xl bg-[#fbe9eb] p-3 text-sm text-[#8a1020]">{err}</p> : null}
      <div className="flex flex-col gap-2">
        <button disabled={!submitOk || !!busy || !!blockedReason} onClick={() => run("submit")} className="pill-btn w-full bg-[#1e61b9] text-white disabled:opacity-50"><Send size={16} className="mr-1.5" />{busy === "submit" ? "Sending…" : "Send for approval at this time"}</button>
        <button disabled={!valid || !!busy} onClick={() => run("save")} className="pill-btn w-full border-2 border-navy text-navy disabled:opacity-50">{busy === "save" ? "Saving…" : "Just save the date"}</button>
        {initial ? <button disabled={!!busy} onClick={() => run("clear")} className="min-h-11 text-sm font-semibold text-muted underline">{busy === "clear" ? "Clearing…" : "Remove the date"}</button> : null}
      </div>
    </Sheet>
  );
}

type V = { id: string; created_at: string; note: string | null; named?: boolean; by?: string | null; subject: string | null; summary?: string };

export function HistorySheet({ emailId, onClose, onRestore, onSaveCopy, readOnly, renderHtml }: { emailId: string; onClose: () => void; onRestore: (id: string) => Promise<string | null>; onSaveCopy: (name: string) => Promise<void>; readOnly: boolean; renderHtml: (doc: unknown) => string }) {
  const [list, setList] = useState<V[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const load = () => fetch(`/api/emails/${emailId}/versions`, { cache: "no-store" }).then((r) => r.json()).then((j) => setList(j.versions ?? [])).catch(() => setErr("Couldn’t load the history."));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [emailId]);

  async function preview(id: string) {
    if (open === id) { setOpen(null); setHtml(null); return; }
    setOpen(id); setHtml(null);
    const r = await fetch(`/api/emails/${emailId}/versions?v=${id}`, { cache: "no-store" });
    if (!r.ok) { setErr("Couldn’t load that copy."); setOpen(null); return; }
    const j = await r.json();
    setHtml(renderHtml(j.doc));
  }
  async function saveName(id: string) {
    setBusy(id);
    await fetch(`/api/emails/${emailId}/versions?v=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: draft }) });
    setRenaming(null); await load(); setBusy(null);
  }

  return (
    <Sheet title="Version history" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Earlier copies of this email, saved automatically when you pause and at key moments (a test, approval). Preview a copy to see exactly how it looked. Restoring brings it back as your current version; your present one is saved first. Named copies are kept permanently.</p>
      <div className="mb-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name this version (optional)" className="field min-w-0 flex-1" aria-label="Version name" />
        <button disabled={busy !== null} onClick={async () => { setBusy("copy"); await onSaveCopy(name.trim()); setName(""); await load(); setBusy(null); }} className="pill-btn shrink-0 border-2 border-navy px-4 text-navy disabled:opacity-50"><History size={16} className="mr-1.5" />{busy === "copy" ? "Saving…" : "Save"}</button>
      </div>
      {err ? <p role="alert" className="mb-3 text-sm text-[#8a1020]">{err}</p> : null}
      {list === null ? <p className="text-sm text-muted">Loading…</p> : list.length === 0 ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">No earlier copies yet. They appear as you keep working.</p> : (
        <ul className="space-y-2">
          {list.map((v) => (
            <li key={v.id} className="rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {renaming === v.id ? (
                    <div className="flex gap-2"><input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} className="field min-w-0 flex-1" aria-label="Rename version" /><button disabled={busy !== null} onClick={() => saveName(v.id)} className="pill-btn px-4 text-brand">Save</button></div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">{v.named ? <Star size={14} className="shrink-0 fill-[#e0a100] text-[#e0a100]" aria-label="Named version" /> : null}<span className="truncate">{v.note || "Saved copy"}</span>
                      {!readOnly || true ? <button aria-label="Name this version" onClick={() => { setRenaming(v.id); setDraft(v.named ? v.note ?? "" : ""); }} className="shrink-0 text-muted"><Pencil size={13} /></button> : null}</div>
                  )}
                  <div className="text-xs text-muted">{new Date(v.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} · {ago(v.created_at)}{v.by ? ` · ${v.by}` : ""}</div>
                  {v.summary ? <div className="mt-0.5 text-xs text-[#33445d]">{v.summary}</div> : null}
                  {v.subject ? <div className="truncate text-xs text-muted">Subject: {v.subject}</div> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <button onClick={() => preview(v.id)} className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand active:bg-[#f4f8fd]"><Eye size={15} />{open === v.id ? "Hide" : "Preview"}</button>
                  {!readOnly ? <button disabled={busy !== null} onClick={async () => { if (!confirm("Restore this copy? Your current version is saved first.")) return; setBusy(v.id); const m = await onRestore(v.id); if (m) { setErr(m); setBusy(null); } }} className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand active:bg-[#f4f8fd] disabled:opacity-50"><RotateCcw size={15} />{busy === v.id ? "…" : "Restore"}</button> : null}
                </div>
              </div>
              {open === v.id ? (html ? <iframe title="Preview of this copy" srcDoc={html} sandbox="" className="mt-3 h-[420px] w-full rounded-lg border border-line bg-white" /> : <p className="mt-3 text-sm text-muted">Loading preview…</p>) : null}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
