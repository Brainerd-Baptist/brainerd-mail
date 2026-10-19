"use client";

import { useMemo, useState } from "react";
import { Check, Eye, MessageSquareWarning } from "lucide-react";
import { LEAD_HOURS } from "@/lib/approval";

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const pretty = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

export function ActionPage({ token, title, subject, ministry, sendAt, approverName, own, preset, dashUrl }: { token: string; title: string; subject: string; ministry: string; sendAt: string | null; approverName: string; own: boolean; preset: "approve" | "changes" | null; dashUrl: string }) {
  const [mode, setMode] = useState<"approve" | "changes" | null>(own ? null : preset);
  const [preview, setPreview] = useState(false);
  const [changeTime, setChangeTime] = useState(false);
  const [time, setTime] = useState(toLocalInput(sendAt));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<null | { kind: "approve" | "changes"; at?: string }>(null);

  const chosenIso = useMemo(() => { if (!changeTime || !time) return null; const d = new Date(time); return isNaN(d.getTime()) ? null : d.toISOString(); }, [changeTime, time]);
  const finalAt = chosenIso ?? sendAt;
  const expedited = finalAt ? (new Date(finalAt).getTime() - Date.now()) / 3600000 < LEAD_HOURS : false;

  async function submit(action: "approve" | "changes") {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/a/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note, newTime: chosenIso, confirmExpedited: true }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong. Nothing was changed.");
      setDone({ kind: action, at: j.sendAt });
    } catch (e: any) { setErr(e.message || "Something went wrong."); }
    setBusy(false);
  }

  const card = (children: React.ReactNode) => (
    <main style={{ minHeight: "100dvh", background: "#f1f5f9", padding: "24px 16px", fontFamily: "Barlow, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div style={{ background: "#00205b", padding: "22px 24px" }}><img src="/brand/brainerd-full-white.png" alt="Brainerd Baptist Church" width={160} height={37} style={{ display: "block", width: 160, height: "auto" }} /></div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </main>
  );

  if (done) {
    return card(
      <div role="status">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e3f4ea] text-[#0d5a37]"><Check size={26} /></div>
        <h1 className="font-serif text-2xl font-semibold text-navy">{done.kind === "approve" ? "Approved" : "Sent back for changes"}</h1>
        <p className="mt-2 text-[16px] leading-snug text-[#33445d]">{done.kind === "approve" ? `“${title}” is approved${done.at ? ` for ${pretty(done.at)}` : ""}. The person who sent it has been told.` : `“${title}” went back to its editor with your note. They’ve been told.`}</p>
        <a href={dashUrl} className="mt-4 inline-block text-[15px] font-bold text-brand">Open it in Brainerd Mail</a>
      </div>
    );
  }

  return card(
    <>
      <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">Waiting for your approval</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight text-navy">{title}</h1>
      <dl className="mt-3 divide-y divide-line rounded-xl bg-[#f4f8fd] text-[15px]">
        <div className="flex gap-3 px-4 py-2.5"><dt className="w-24 shrink-0 text-[12px] font-bold uppercase tracking-wider text-muted">Ministry</dt><dd className="text-ink">{ministry}</dd></div>
        <div className="flex gap-3 px-4 py-2.5"><dt className="w-24 shrink-0 text-[12px] font-bold uppercase tracking-wider text-muted">Subject</dt><dd className="min-w-0 break-words text-ink">{subject}</dd></div>
        {sendAt ? <div className="flex gap-3 px-4 py-2.5"><dt className="w-24 shrink-0 text-[12px] font-bold uppercase tracking-wider text-muted">Planned send</dt><dd className="text-ink">{pretty(sendAt)}</dd></div> : null}
      </dl>

      <button onClick={() => setPreview((v) => !v)} className="mt-3 inline-flex min-h-11 items-center gap-2 text-[15px] font-bold text-brand"><Eye size={18} />{preview ? "Hide the email" : "Look at the email"}</button>
      {preview ? <iframe title="The email" src={`/api/a/${encodeURIComponent(token)}/preview`} sandbox="" className="mb-2 h-[520px] w-full rounded-xl border border-line bg-white" /> : null}

      {own ? <p className="mt-3 rounded-xl bg-[#fdf1d8] px-4 py-3 text-[14px] text-[#7a4a05]">Hi {approverName}. You sent this one for approval, so someone else needs to approve it.</p> : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Your decision">
            <button onClick={() => { setMode("approve"); setErr(""); }} aria-pressed={mode === "approve"} className={`flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-[16px] font-bold ${mode === "approve" ? "bg-[#118058] text-white" : "border-2 border-[#118058] text-[#0d5a37]"}`}><Check size={18} />Approve</button>
            <button onClick={() => { setMode("changes"); setErr(""); }} aria-pressed={mode === "changes"} className={`flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-[16px] font-bold ${mode === "changes" ? "bg-navy text-white" : "border-2 border-navy text-navy"}`}><MessageSquareWarning size={18} />Request changes</button>
          </div>

          {mode ? (
            <div className="mt-4 space-y-3 rounded-xl border border-line p-4">
              {mode === "changes" ? (
                <label className="block"><span className="label">What should change?</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={600} className="w-full rounded-lg border border-line p-3 text-[16px]" placeholder="For example: move the date to the 24th, and shorten the first paragraph." /></label>
              ) : null}
              <label className="flex items-start gap-3"><input type="checkbox" checked={changeTime} onChange={(e) => setChangeTime(e.target.checked)} className="mt-0.5 h-5 w-5" />
                <span className="text-[15px] font-semibold text-ink">{mode === "approve" ? "Change the send day or time" : "Suggest a different send day or time"}</span></label>
              {changeTime ? <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Send day and time" className="h-12 w-full rounded-lg border border-line px-3 text-[16px]" /> : null}
              {mode === "approve" && expedited ? <p className="rounded-lg bg-[#fdf1d8] px-3 py-2 text-[14px] text-[#7a4a05]">This send time is less than 72 hours away. Approving means you agree to it going out on a short timeline.</p> : null}
              {err ? <p role="alert" className="rounded-lg bg-[#fbe9eb] px-3 py-2 text-[14px] text-[#8a1020]">{err}</p> : null}
              <button onClick={() => submit(mode)} disabled={busy || (mode === "changes" && !note.trim() && !chosenIso)} className={`min-h-12 w-full rounded-full text-[16px] font-bold text-white disabled:opacity-50 ${mode === "approve" ? "bg-[#118058]" : "bg-navy"}`}>{busy ? "Saving…" : mode === "approve" ? (changeTime && chosenIso ? "Approve with this time" : "Confirm approval") : "Send back with my note"}</button>
            </div>
          ) : null}
          <p className="mt-4 text-[12px] leading-snug text-muted">This page works only for you, only for this version of the email, and expires in a week. {approverName}, if you didn’t expect it, ignore it.</p>
        </>
      )}
    </>
  );
}
