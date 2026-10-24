"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Check, Eye, Loader2, Wand2 } from "lucide-react";
import type { EmailDoc } from "@/lib/blocks";
import { polish, polishSummary } from "@/lib/polish";
import { applyEdit, canApply, type Edit } from "@/lib/polish-ai";

// Advice that keeps the author's words. Wording suggestions only point at the
// problem; mechanical ones carry a one-tap fix. Dismissals are remembered per
// ministry so the same nudge doesn't nag every month.
export function PolishPanel({ doc, setDoc, onShow }: { doc: EmailDoc; setDoc: (d: EmailDoc) => void; onShow: (blockId: string) => void }) {
  const key = `brainerd-mail:polish-dismissed:${doc.ministry}`;
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setDismissed([]); }
  }, [key]);
  const remember = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(key, JSON.stringify(next.slice(-200))); } catch {}
  };

  const [ideas, setIdeas] = useState<Edit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const askForIdeas = async () => {
    setBusy(true); setAiError("");
    try {
      const res = await fetch("/api/polish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setAiError(j.error || "Could not get ideas right now.");
      else setIdeas(j.edits || []);
    } catch { setAiError("Could not reach the writing helper. Check your connection."); }
    setBusy(false);
  };
  const ideaKey = (e: Edit) => (e.kind === "move" ? `ai-move:${e.blockId}:${e.toIndex}` : `ai:${e.blockId}:${e.field}:${e.after.slice(0, 24)}`);
  const liveIdeas = (ideas || []).filter((e) => canApply(doc, e) && !dismissed.includes(ideaKey(e)));
  const blockName = (id: string) => (id === "doc" ? "Email details" : doc.blocks.find((b) => b.id === id)?.type ?? "");

  const all = useMemo(() => polish(doc), [doc]);
  const list = all.filter((s) => !dismissed.includes(s.id));
  const summary = polishSummary(list);
  const mechanical = list.filter((s) => s.kind === "mechanical" && s.fix);
  const tone = summary.tone === "good" ? "text-[#1e7a4c]" : summary.tone === "ok" ? "text-[#9a5a00]" : "text-[#c8102e]";

  const applyAll = () => {
    let d = doc;
    for (let pass = 0; pass < 5; pass++) {
      const m = polish(d).filter((s) => s.kind === "mechanical" && s.fix && !dismissed.includes(s.id));
      if (!m.length) break;
      for (const s of m) d = s.fix!.apply(d);
    }
    setDoc(d);
  };

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-ink"><Sparkles size={16} className="text-brand" />Polish</h3>
        <span className={`text-xs font-bold ${tone}`}>{summary.label}</span>
      </div>
      <p className="mb-3 text-xs text-muted">Ideas to make this feel more finished. Your words stay yours: only spacing and layout fixes apply on their own.</p>
      {list.length === 0 ? (
        <p className="flex items-center gap-2 text-[15px] text-ink"><Check size={18} className="text-[#1e7a4c]" />Nothing to improve. This looks polished.</p>
      ) : (
        <ul className="space-y-4">
          {list.map((s) => (
            <li key={s.id} className="text-[15px] text-ink">
              <div className="flex gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.level === "improve" ? "bg-red-600" : "bg-[#9a5a00]"}`} />
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{s.title}</div>
                  {s.detail ? <div className="text-xs text-muted">{s.detail}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.fix ? <button onClick={() => setDoc(s.fix!.apply(doc))} className="min-h-9 rounded-full bg-brand px-3.5 text-sm font-semibold text-white">{s.fix.label}</button> : null}
                    {s.blockId ? <button onClick={() => onShow(s.blockId!)} className="flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-sm font-semibold text-ink"><Eye size={14} />Show me</button> : null}
                    <button onClick={() => remember(s.id)} className="min-h-9 px-2 text-sm font-semibold text-muted">{s.kind === "photo" ? "Use it anyway" : "Dismiss"}</button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink"><Wand2 size={15} className="text-brand" />Writing ideas</h4>
          <button onClick={askForIdeas} disabled={busy} className="flex min-h-9 items-center gap-1.5 rounded-full border border-brand px-3.5 text-sm font-semibold text-brand disabled:opacity-60">
            {busy ? <><Loader2 size={14} className="animate-spin" />Reading…</> : ideas ? "Ask again" : "Ask for ideas"}
          </button>
        </div>
        {aiError ? <p className="text-sm text-[#c8102e]">{aiError}</p> : null}
        {!ideas && !aiError && !busy ? <p className="text-xs text-muted">Claude reads your email and suggests clearer wording or a better order. You choose what to apply.</p> : null}
        {ideas && liveIdeas.length === 0 && !busy ? <p className="flex items-center gap-2 text-[15px] text-ink"><Check size={18} className="text-[#1e7a4c]" />No more ideas. The writing reads well.</p> : null}
        <ul className="space-y-4">
          {liveIdeas.map((e) => (
            <li key={ideaKey(e)} className="rounded-lg bg-mist p-3 text-[15px] text-ink">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{e.kind === "move" ? `Move ${blockName(e.blockId)} block` : `${blockName(e.blockId)} · ${e.field.replace("button.label", "button")}`}</div>
              {e.kind === "rewrite" ? (
                <>
                  <div className="text-sm text-muted line-through">{e.before}</div>
                  <div className="mt-1 font-semibold text-ink">{e.after}</div>
                </>
              ) : (
                <div className="font-semibold text-ink">Move to position {e.toIndex + 1}</div>
              )}
              <div className="mt-1 text-xs text-muted">{e.why}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => { const d = applyEdit(doc, e); if (d) setDoc(d); }} className="min-h-9 rounded-full bg-brand px-3.5 text-sm font-semibold text-white">Apply</button>
                <button onClick={() => remember(ideaKey(e))} className="min-h-9 px-2 text-sm font-semibold text-muted">Dismiss</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {mechanical.length > 1 ? <button onClick={applyAll} className="mt-4 min-h-10 w-full rounded-full border border-brand text-sm font-semibold text-brand">Apply all {mechanical.length} quick fixes</button> : null}
    </div>
  );
}
