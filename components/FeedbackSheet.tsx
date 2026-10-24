"use client";
import { useState } from "react";
import { X, Bug, Lightbulb, MessageCircle, Check } from "lucide-react";

const KINDS = [
  { k: "problem", label: "Report a problem", Icon: Bug, ph: "What went wrong? What did you expect to happen?" },
  { k: "feature", label: "Request a feature", Icon: Lightbulb, ph: "What would you like Brainerd Mail to do?" },
  { k: "feedback", label: "Share feedback", Icon: MessageCircle, ph: "What's working, or what feels off?" },
] as const;

// Slides up from the bottom on phones. Sends along where the person was, so
// "it broke" arrives with enough to find the cause.
export function FeedbackSheet({ onClose, context, inboxNew }: { onClose: () => void; context: Record<string, unknown>; inboxNew?: number | null }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["k"]>("problem");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const cur = KINDS.find((x) => x.k === kind)!;

  async function submit() {
    setState("sending"); setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, context: { ...context, viewport: `${window.innerWidth}x${window.innerHeight}`, userAgent: navigator.userAgent, at: new Date().toISOString() } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || "Could not send that."); setState("idle"); return; }
      setState("sent");
    } catch { setError("Could not reach the server. Check your connection."); setState("idle"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:items-center lg:justify-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-8 lg:max-w-md lg:rounded-lg lg:pb-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-navy">Help us improve Brainerd Mail</h2>
          <button aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-muted"><X size={22} /></button>
        </div>
        {inboxNew != null ? <a href="/feedback" className="mb-3 flex min-h-11 items-center justify-between rounded-lg bg-mist px-3 text-[15px] font-semibold text-navy">Open the feedback inbox<span className="text-sm text-muted">{inboxNew ? `${inboxNew} new` : "all caught up"}</span></a> : null}
        {state === "sent" ? (
          <div className="py-6 text-center">
            <Check size={36} className="mx-auto mb-2 text-[#1e7a4c]" />
            <p className="text-[17px] font-semibold text-ink">Thank you. We got it.</p>
            <p className="mt-1 text-sm text-muted">Someone will read this and follow up if we have questions.</p>
            <button onClick={onClose} className="pill-btn mt-5 w-full bg-brand text-white">Done</button>
          </div>
        ) : (
          <>
            <div className="mb-3 grid gap-2">
              {KINDS.map(({ k, label, Icon }) => (
                <button key={k} onClick={() => setKind(k)} className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 text-left text-[15px] font-semibold ${kind === k ? "border-brand bg-mist text-navy" : "border-line text-ink"}`}><Icon size={18} className="text-brand" />{label}</button>
              ))}
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder={cur.ph} className="field w-full" autoFocus />
            <p className="mt-1 text-xs text-muted">We'll include which email you were working on and what kind of device you're using. We never see anything else.</p>
            {error ? <p className="mt-2 text-sm text-[#c8102e]">{error}</p> : null}
            <button onClick={submit} disabled={state === "sending" || message.trim().length < 3} className="pill-btn mt-4 w-full bg-brand text-white disabled:opacity-50">{state === "sending" ? "Sending…" : "Send"}</button>
          </>
        )}
      </div>
    </div>
  );
}
