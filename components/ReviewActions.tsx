"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, MessageSquareWarning } from "lucide-react";

export function ReviewActions({ id, status, admin, expedited, editHref }: { id: string; status: string; admin: boolean; expedited: boolean; editHref: string }) {
  const [st, setSt] = useState(status);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [confirmExp, setConfirmExp] = useState(false);
  const [msg, setMsg] = useState("");

  async function act(action: "approve" | "changes") {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/emails/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note, confirmExpedited: confirmExp }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Something went wrong."); return; }
    setSt(j.status);
  }

  if (st === "approved") return <div className="bg-[#e8f5ee] px-4 py-3 text-sm text-[#0d3b2c]"><b>Approved.</b> It will wait until sending is switched on. <Link href="/emails" className="font-semibold underline">Back to emails</Link></div>;
  if (st === "draft") return <div className="bg-[#fff3d6] px-4 py-3 text-sm text-[#5c3a00]">Sent back for changes. <Link href="/emails" className="font-semibold underline">Back to emails</Link></div>;
  if (st !== "pending_approval") return <div className="bg-brand/10 px-4 py-3 text-sm text-navy">This email isn’t waiting for approval (status: {st.replace("_", " ")}). <Link href={editHref} className="font-semibold underline">Open it</Link></div>;
  if (!admin) return <div className="bg-brand/10 px-4 py-3 text-sm text-navy">Waiting for the approver to review this. <Link href={editHref} className="font-semibold underline">Open in editor</Link></div>;

  return (
    <div className="space-y-3 border-b border-line bg-surface p-4">
      {expedited ? <label className="flex items-start gap-2 rounded-lg bg-[#fff3d6] p-3 text-sm text-[#5c3a00]"><input type="checkbox" className="mt-1" checked={confirmExp} onChange={(e) => setConfirmExp(e.target.checked)} /><span>This is an <b>expedited</b> send, under 72 hours. I approve it knowing that.</span></label> : null}
      {asking ? (
        <div>
          <label className="label" htmlFor="note">What should change?</label>
          <textarea id="note" className="field min-h-24" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short note for the sender" />
          <div className="mt-2 flex gap-2">
            <button disabled={busy || !note.trim()} onClick={() => act("changes")} className="pill-btn flex-1 bg-brand text-white disabled:opacity-50">{busy ? "Sending…" : "Send back"}</button>
            <button onClick={() => setAsking(false)} className="pill-btn border-2 border-navy text-navy">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button disabled={busy || (expedited && !confirmExp)} onClick={() => act("approve")} className="pill-btn flex-1 bg-brand text-white disabled:opacity-50"><Check size={16} className="mr-1.5" />{busy ? "Approving…" : "Approve"}</button>
          <button disabled={busy} onClick={() => setAsking(true)} className="pill-btn flex-1 border-2 border-navy text-navy"><MessageSquareWarning size={16} className="mr-1.5" />Request changes</button>
        </div>
      )}
      {msg ? <p role="alert" className="rounded-lg bg-[#fbe9eb] p-3 text-sm text-[#8a1020]">{msg}</p> : null}
    </div>
  );
}
