"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";

type Person = { name: string; email: string; role: string };
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX = 10;

// "Send a test to…": yourself, teammates who have access to Mail, and any typed addresses.
export function TestSheet({ onClose, onSend }: { onClose: () => void; onSend: (extra: string[], includeMe: boolean) => Promise<void> }) {
  const [myEmail, setMyEmail] = useState<string | undefined>();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [me, setMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/test-send/people").then((r) => (r.ok ? r.json() : null)).then((j) => { setPeople(j?.people ?? []); setMyEmail(j?.me) }).catch(() => setPeople([]));
  }, []);

  const typedList = Array.from(new Set(typed.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)));
  const bad = typedList.filter((e) => !EMAIL_RE.test(e));
  const extras = Array.from(new Set([...picked, ...typedList.filter((e) => EMAIL_RE.test(e))])).filter((e) => e !== (myEmail ?? "").toLowerCase());
  const total = extras.length + (me ? 1 : 0);
  const others = (people ?? []).filter((p) => p.email.toLowerCase() !== (myEmail ?? "").toLowerCase());

  async function go() {
    if (!total || bad.length || total > MAX) return;
    setBusy(true); setErr("");
    try { await onSend(extras, me); onClose(); } catch (e: any) { setErr(e?.message || "Couldn't send."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => !busy && onClose()}>
      <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">Send a test to…</h2><button aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={20} /></button></div>
        <p className="mb-3 text-[14px] text-muted">The subject starts with [TEST]. Test emails are never counted as a real send.</p>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-[15px] font-semibold text-ink"><input type="checkbox" checked={me} onChange={(e) => setMe(e.target.checked)} className="h-5 w-5" />Me{myEmail ? <span className="truncate font-normal text-muted">{myEmail}</span> : null}</label>

        <div className="mt-3">
          <span className="label">People with access to Mail</span>
          {!people ? <div className="h-16 animate-pulse rounded-lg bg-line/40" /> : others.length === 0 ? <p className="text-[14px] text-muted">No one else has access yet.</p> : (
            <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {others.map((p) => {
                const on = picked.includes(p.email.toLowerCase());
                return (
                  <li key={p.email}><label className="flex min-h-11 items-center gap-3 px-3 py-1.5"><input type="checkbox" checked={on} onChange={() => setPicked((v) => (on ? v.filter((x) => x !== p.email.toLowerCase()) : [...v, p.email.toLowerCase()]))} className="h-5 w-5" />
                    <span className="min-w-0"><span className="block truncate text-[15px] font-semibold text-ink">{p.name}</span><span className="block truncate text-[12px] text-muted">{p.email} · {p.role}</span></span></label></li>
                );
              })}
            </ul>
          )}
        </div>

        <label className="mt-3 block"><span className="label">Or type email addresses</span>
          <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={2} placeholder="name@example.com, another@example.com" className="w-full rounded-lg border border-line p-3 text-[16px]" /></label>
        {bad.length ? <p className="mt-1 text-[13px] text-[#8a1020]">Check this one: {bad[0]}</p> : null}
        {total > MAX ? <p className="mt-1 text-[13px] text-[#8a1020]">Tests can go to {MAX} people at a time. You have {total}.</p> : null}
        {err ? <p role="alert" className="mt-2 rounded-lg bg-[#fbe9eb] px-3 py-2 text-sm text-[#8a1020]">{err}</p> : null}

        <button onClick={go} disabled={busy || !total || !!bad.length || total > MAX} className="pill-btn mt-4 w-full bg-navy text-white disabled:opacity-50"><FlaskConical size={16} className="mr-1.5" />{busy ? "Sending…" : total ? `Send test to ${total} ${total === 1 ? "person" : "people"}` : "Choose who to send to"}</button>
      </div>
    </div>
  );
}
