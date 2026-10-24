"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

type Ins = { summary: string; working: string[]; improve: string[]; source: "claude" | "rules"; thin: boolean; note?: string; updatedAt: string; basedOn: { people: number; clickers?: number; emails?: number; from: string; scope?: string } };

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

// A plain-language read-out at the top of an email's report: what happened, what worked, what to try.
export function EmailInsights({ id, url, title = "What’s happening", scopeNote }: { id?: string; url?: string; title?: string; scopeNote?: string }) {
  const [d, setD] = useState<Ins | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);

  async function load(refresh = false) {
    setBusy(true); setErr("");
    try {
      const base = url ?? `/api/analytics/email/${id}/insights`;
      const r = await fetch(refresh ? `${base}${base.includes("?") ? "&" : "?"}refresh=1` : base);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't load the summary.");
      setD(j as Ins);
    } catch (e: any) { setErr(e?.message || "Couldn't load the summary."); } finally { setBusy(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, url]);

  return (
    <section aria-label="Summary" className="rounded-lg border border-[#cfe3f3] bg-[#f4f9fe] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-lg text-ink"><Sparkles size={18} className="text-brand" />{title}</h2>
        <button onClick={() => load(true)} disabled={busy} aria-label="Refresh summary" className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-brand hover:bg-surface disabled:opacity-50"><RefreshCw size={14} className={busy ? "animate-spin" : ""} />Refresh</button>
      </div>
      {err ? <p role="alert" className="mt-2 text-sm text-[#8a1020]">{err}</p> : null}
      {!d && busy ? <div className="mt-3 space-y-2"><div className="h-4 w-11/12 animate-pulse rounded bg-surface" /><div className="h-4 w-8/12 animate-pulse rounded bg-surface" /></div> : null}
      {d ? (
        <div className={busy ? "opacity-60 transition" : "transition"}>
          <p className="mt-2 text-sm leading-relaxed text-ink">{d.summary}</p>
          {d.working.length ? (
            <div className="mt-4"><h3 className="label">Working well</h3>
              <ul className="mt-1 space-y-1.5 text-[14px] leading-snug text-ink">{d.working.map((w, i) => <li key={i} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#33bc53]" />{w}</li>)}</ul></div>
          ) : null}
          {d.improve.length ? (
            <div className="mt-4"><h3 className="label">Worth trying</h3>
              <ul className="mt-1 space-y-1.5 text-[14px] leading-snug text-ink">{d.improve.map((w, i) => <li key={i} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{w}</li>)}</ul></div>
          ) : null}
          <p className="mt-4 text-[12px] leading-snug text-muted">
            {d.source === "claude" ? "Written by Claude from this email's numbers. " : "Basic notes from this email's numbers. "}
            Based on {d.basedOn.emails != null ? `${d.basedOn.emails} email${d.basedOn.emails === 1 ? "" : "s"} and ` : ""}{d.basedOn.people} {d.basedOn.people === 1 ? "person" : "people"}{d.basedOn.from.startsWith("test") ? " (test sends)" : ""}{d.basedOn.scope ? ` · ${d.basedOn.scope}` : ""}. Suggestions to try, not rules. Updated {ago(d.updatedAt)}.{d.note ? ` ${d.note}` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
