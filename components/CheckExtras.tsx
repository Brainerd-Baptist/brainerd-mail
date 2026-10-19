"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Eye, Loader2 } from "lucide-react";
import type { EmailDoc } from "@/lib/blocks";
import { collectTexts, replaceWord } from "@/lib/doc-text";
import { applyEdit, canApply, currentValue, type Edit } from "@/lib/polish-ai";

type Issue = { word: string; blockId: string; label: string; before: string; after: string; suggestions: string[] };

const rememberKey = (kind: string, ministry: string) => `brainerd-mail:${kind}-ignored:${ministry}`;
function useIgnored(kind: string, ministry: string) {
  const key = rememberKey(kind, ministry);
  const [list, setList] = useState<string[]>([]);
  useEffect(() => { try { setList(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setList([]); } }, [key]);
  const add = (id: string) => { const next = [...list, id]; setList(next); try { localStorage.setItem(key, JSON.stringify(next.slice(-300))); } catch {} };
  return [list, add] as const;
}

const btn = "min-h-9 rounded-full px-3.5 text-sm font-semibold";

// Spelling: checks automatically a moment after you stop typing. Names and church words a dictionary
// doesn't know can be ignored, and the choice is shared with the whole team.
export function SpellRow({ doc, setDoc, onShow }: { doc: EmailDoc; setDoc: (d: EmailDoc) => void; onShow: (blockId: string) => void }) {
  const [ignored, ignore] = useIgnored("spell", doc.ministry);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sig = useMemo(() => collectTexts(doc).map((p) => p.blockId + p.text).join("\u0001"), [doc]);
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/spellcheck", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc }) });
        const j = await r.json().catch(() => ({}));
        if (mine !== seq.current) return;
        if (!r.ok) { setErr(j.error || "Spelling check isn't available right now."); setIssues(null); }
        else { setErr(""); setIssues(j.issues || []); }
      } catch { if (mine === seq.current) { setErr("Couldn't reach the spelling check."); setIssues(null); } }
      if (mine === seq.current) setBusy(false);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const live = (issues || []).filter((i) => !ignored.includes(i.word.toLowerCase()));
  const icon = err ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#9a5a00]" /> : !issues || (busy && !live.length) ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-muted" /> : live.length ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#9a5a00]" /> : <Check size={18} className="mt-0.5 shrink-0 text-[#1e7a4c]" />;
  const label = err ? err : !issues ? "Checking spelling…" : live.length ? `${live.length} word${live.length === 1 ? "" : "s"} to check for spelling` : "No spelling mistakes found";
  return (
    <li className="flex gap-2 text-[15px] text-[#33445d]">
      {icon}
      <div className="min-w-0 flex-1">
        <span>{label}</span>
        {live.length ? <span className="block text-xs text-muted">Names and special words may show up here. Tap Ignore for those.</span> : null}
        {live.length ? (
          <ul className="mt-2 space-y-2">
            {live.map((i) => (
              <li key={i.blockId + i.word} className="rounded-lg bg-[#f4f8fd] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">{i.label}</div>
                <div className="mt-0.5 text-[15px] text-ink">…{i.before} <b className="rounded bg-[#fdecc8] px-1">{i.word}</b> {i.after}…</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {i.suggestions.map((s) => <button key={s} onClick={() => setDoc(replaceWord(doc, i.blockId, i.word, s))} className={`${btn} bg-brand text-white`}>{s}</button>)}
                  <button onClick={() => onShow(i.blockId)} className={`${btn} flex items-center gap-1 border border-line text-ink`}><Eye size={14} />Show me</button>
                  <button onClick={() => { ignore(i.word.toLowerCase()); fetch("/api/spellcheck", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ignore: i.word }) }).catch(() => {}); }} className={`${btn} px-2 text-muted`}>Ignore</button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

// Clarity: "do the sentences make sense?" Runs only when asked, because Claude reads the email.
export function ClarityRow({ doc, setDoc, onShow }: { doc: EmailDoc; setDoc: (d: EmailDoc) => void; onShow: (blockId: string) => void }) {
  const [dismissed, dismiss] = useIgnored("clarity", doc.ministry);
  const [edits, setEdits] = useState<Edit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/polish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc, mode: "clarity" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error || "Couldn't check the sentences right now.");
      else setEdits(j.edits || []);
    } catch { setErr("Couldn't reach the writing helper. Check your connection."); }
    setBusy(false);
  };
  const keyOf = (e: Edit) => (e.kind === "rewrite" ? `${e.blockId}:${e.field}:${e.after.slice(0, 24)}` : "");
  const live = (edits || []).filter((e) => e.kind === "rewrite" && canApply(doc, e) && !dismissed.includes(keyOf(e)));
  const checked = edits !== null;
  const icon = busy ? <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-muted" /> : err || live.length ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#9a5a00]" /> : checked ? <Check size={18} className="mt-0.5 shrink-0 text-[#1e7a4c]" /> : <Eye size={18} className="mt-0.5 shrink-0 text-muted" />;
  const label = busy ? "Reading your sentences…" : err ? err : live.length ? `${live.length} sentence${live.length === 1 ? "" : "s"} could be clearer` : checked ? "Sentences read clearly" : "Do the sentences make sense?";
  return (
    <li className="flex gap-2 text-[15px] text-[#33445d]">
      {icon}
      <div className="min-w-0 flex-1">
        <span>{label}</span>
        {!checked && !busy && !err ? <span className="block text-xs text-muted">Claude reads the email for sentences that are unclear or don’t make sense. It never changes anything on its own.</span> : null}
        {!busy ? <div className="mt-2"><button onClick={run} className={`${btn} border border-brand text-brand`}>{checked || err ? "Check again" : "Check the sentences"}</button></div> : null}
        {live.length ? (
          <ul className="mt-2 space-y-2">
            {live.map((e) => e.kind === "rewrite" && (
              <li key={keyOf(e)} className="rounded-lg bg-[#f4f8fd] p-3">
                <div className="text-xs text-muted">{e.why}</div>
                <div className="mt-1 text-sm text-muted line-through">{currentValue(doc, e.blockId, e.field) ?? e.before}</div>
                <div className="mt-1 font-semibold text-ink">{e.after}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => { const d = applyEdit(doc, e); if (d) setDoc(d); }} className={`${btn} bg-brand text-white`}>Use this</button>
                  <button onClick={() => onShow(e.blockId)} className={`${btn} flex items-center gap-1 border border-line text-ink`}><Eye size={14} />Show me</button>
                  <button onClick={() => dismiss(keyOf(e))} className={`${btn} px-2 text-muted`}>Keep mine</button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
