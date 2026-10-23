"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bug, Check, ChevronRight, HelpCircle, Lightbulb, Search, Sparkles, X } from "lucide-react";
import { ARTICLES, AREAS, byId, forPage, search, visibleTo, type Article } from "@/lib/help";
import type { Role } from "@/lib/roles-ui";

type View =
  | { k: "home" }
  | { k: "browse" }
  | { k: "article"; id: string; back: View }
  | { k: "answer"; q: string; covered: boolean; text: string; ids: string[] }
  | { k: "request"; q: string; kind: "question" | "feature" };

// The ? in every page header. Opens help for the page you're on; or ask in plain English.
export function HelpButton() {
  return <button onClick={() => window.dispatchEvent(new Event("bm-help"))} aria-label="Help" title="Help" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-mist lg:hover:bg-mist"><HelpCircle size={22} /></button>;
}

// Mounted once in the layout: opens from any ? button or the menu's Help item.
export function HelpHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("bm-help", on);
    return () => window.removeEventListener("bm-help", on);
  }, []);
  return open ? <HelpSheet onClose={() => setOpen(false)} /> : null;
}

function ArticleCard({ a, onOpen }: { a: Article; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left active:bg-mist">
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{a.title}</span><span className="block text-sm text-muted">{a.summary}</span></span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </button>
  );
}

function HelpSheet({ onClose }: { onClose: () => void }) {
  const path = usePathname() ?? "/";
  const [role, setRole] = useState<Role | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>({ k: "home" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.role) setRole(j.role); }).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const here = useMemo(() => forPage(path, role), [path, role]);
  const matches = useMemo(() => (q.trim().length > 2 ? search(q, role) : []), [q, role]);
  const all = useMemo(() => visibleTo(role), [role]);

  async function ask() {
    const question = q.trim();
    if (question.length < 3 || busy) return;
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/help/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, page: path }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.answer) { setView({ k: "answer", q: question, covered: !!j.covered, text: j.answer, ids: j.articleIds ?? [] }); return; }
      setNote(j.error || "Couldn't get an answer right now.");
    } catch { setNote("Couldn't reach the server. Check your connection."); }
    finally { setBusy(false); }
  }

  const header = (title: string, back?: () => void) => (
    <div className="mb-4 flex items-center gap-1">
      {back ? <button onClick={back} aria-label="Back" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted"><ArrowLeft size={22} /></button> : null}
      <h2 className="flex-1 font-serif text-xl font-semibold text-navy">{title}</h2>
      <button aria-label="Close help" onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button>
    </div>
  );

  const stuck = (
    <button onClick={() => setView({ k: "request", q: q.trim() || "", kind: "question" })} className="mt-4 w-full rounded-xl bg-mist px-4 py-3 text-left text-[15px] font-semibold text-navy">Can't find it? Ask us or request it →</button>
  );

  let body: React.ReactNode;
  if (view.k === "article") {
    const a = byId(view.id);
    body = a ? (
      <>
        {header(a.title, () => setView(view.back))}
        <p className="text-[16px] text-ink">{a.summary}</p>
        {a.steps?.length ? <ol className="mt-3 list-decimal space-y-2 pl-5 text-[16px] text-ink">{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
        {a.note ? <p className="mt-4 rounded-xl bg-brand/10 p-3 text-sm text-navy">{a.note}</p> : null}
        {stuck}
      </>
    ) : null;
  } else if (view.k === "answer") {
    const src = view.ids.map(byId).filter(Boolean) as Article[];
    body = (
      <>
        {header("Answer", () => setView({ k: "home" }))}
        <p className="text-sm text-muted">You asked: “{view.q}”</p>
        <p className={`mt-3 rounded-xl p-4 text-[16px] leading-relaxed ${view.covered ? "bg-mist text-ink" : "bg-[#fff3d6] text-[#5c3a00]"}`}>{view.text}</p>
        {src.length ? <div className="mt-4 space-y-2"><div className="label">Related help</div>{src.map((a) => <ArticleCard key={a.id} a={a} onOpen={() => setView({ k: "article", id: a.id, back: view })} />)}</div> : null}
        <div className="mt-5 rounded-xl border border-line p-4">
          <p className="text-[15px] font-semibold text-ink">{view.covered ? "Did that answer it?" : "This doesn't look like something help covers."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {view.covered ? <button onClick={onClose} className="pill-btn bg-brand text-white"><Check size={16} className="mr-1.5" />Yes, thanks</button> : null}
            <button onClick={() => setView({ k: "request", q: view.q, kind: "question" })} className="pill-btn border border-line text-ink">{view.covered ? "Not quite" : "Ask us"}</button>
            {!view.covered ? <button onClick={() => setView({ k: "request", q: view.q, kind: "feature" })} className="pill-btn border border-line text-ink">Request it</button> : null}
          </div>
        </div>
      </>
    );
  } else if (view.k === "request") {
    body = <RequestForm key={view.kind + view.q} view={view} path={path} onBack={() => setView({ k: "home" })} onClose={onClose} header={header} />;
  } else if (view.k === "browse") {
    body = (
      <>
        {header("All help", () => setView({ k: "home" }))}
        <div className="space-y-5">
          {AREAS.map((area) => { const list = all.filter((a) => a.area === area); return list.length ? <section key={area}><div className="label">{area}</div><div className="space-y-2">{list.map((a) => <ArticleCard key={a.id} a={a} onOpen={() => setView({ k: "article", id: a.id, back: { k: "browse" } })} />)}</div></section> : null; })}
        </div>
        {stuck}
      </>
    );
  } else {
    const typing = q.trim().length > 2;
    body = (
      <>
        {header("Help")}
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mb-4">
          <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-brand">
            <Search size={16} className="shrink-0 text-muted" />
            <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setNote(""); }} placeholder="Ask anything, like “how do I make a photo bigger?”" className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none" enterKeyHint="search" />
          </label>
          {typing ? <button type="submit" disabled={busy} className="pill-btn mt-3 w-full bg-brand text-white disabled:opacity-60"><Sparkles size={16} className="mr-1.5" />{busy ? "Finding the answer…" : "Get an answer"}</button> : null}
          {note ? <p role="alert" className="mt-2 text-sm text-[#8a1020]">{note}</p> : null}
        </form>
        {typing ? (
          matches.length ? (
            <div className="space-y-2"><div className="label">Matching help</div>{matches.map((a) => <ArticleCard key={a.id} a={a} onOpen={() => setView({ k: "article", id: a.id, back: { k: "home" } })} />)}{stuck}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-[15px] text-muted">No help articles match yet. Tap Get an answer to ask, or send it to us.</div>
          )
        ) : (
          <>
            {here.length ? <section className="space-y-2"><div className="label">Help for this page</div>{here.map((a) => <ArticleCard key={a.id} a={a} onOpen={() => setView({ k: "article", id: a.id, back: { k: "home" } })} />)}</section> : null}
            <button onClick={() => setView({ k: "browse" })} className="mt-4 flex min-h-12 w-full items-center justify-between rounded-xl border border-line px-4 text-[15px] font-semibold text-navy">Browse all help<ChevronRight size={18} /></button>
            {stuck}
          </>
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose} role="dialog" aria-modal="true" aria-label="Help">
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>{body}</div>
    </div>
  );
}

function RequestForm({ view, path, onBack, onClose, header }: { view: Extract<View, { k: "request" }>; path: string; onBack: () => void; onClose: () => void; header: (t: string, b?: () => void) => React.ReactNode }) {
  const [kind, setKind] = useState<"question" | "feature">(view.kind);
  const [text, setText] = useState(view.q);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  async function send() {
    setState("sending"); setErr("");
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, message: text, context: { from: "help", page: path, searched: view.q, viewport: `${window.innerWidth}x${window.innerHeight}`, at: new Date().toISOString() } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Could not send that."); setState("idle"); return; }
      setState("sent");
    } catch { setErr("Could not reach the server. Check your connection."); setState("idle"); }
  }
  if (state === "sent") return (
    <div className="py-6 text-center">
      <Check size={36} className="mx-auto mb-2 text-[#1e7a4c]" />
      <p className="text-[17px] font-semibold text-ink">Thank you. We got it.</p>
      <p className="mt-1 text-sm text-muted">{kind === "feature" ? "We'll look at adding it." : "Someone will get back to you."}</p>
      <button onClick={onClose} className="pill-btn mt-5 w-full bg-brand text-white">Done</button>
    </div>
  );
  return (
    <>
      {header("Ask us or request it", onBack)}
      <div className="mb-3 grid gap-2">
        {([["question", "I need help with something", HelpCircle], ["feature", "Brainerd Mail should do this", Lightbulb]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setKind(k)} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-[15px] font-semibold ${kind === k ? "border-brand bg-mist text-navy" : "border-line text-ink"}`}><Icon size={18} />{label}</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="field w-full" placeholder={kind === "feature" ? "What would you like it to do?" : "What are you trying to do?"} autoFocus />
      <p className="mt-1 text-xs text-muted">We'll include the page you were on and what you searched for.</p>
      {err ? <p className="mt-2 text-sm text-[#c8102e]">{err}</p> : null}
      <button onClick={send} disabled={state === "sending" || text.trim().length < 3} className="pill-btn mt-4 w-full bg-brand text-white disabled:opacity-50">{state === "sending" ? "Sending…" : "Send"}</button>
    </>
  );
}
