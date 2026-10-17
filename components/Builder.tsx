"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ChevronUp, ChevronDown, Copy, Trash2, Plus, Smartphone, Monitor, Moon, MessageSquare, Check, AlertTriangle, Send, FlaskConical } from "lucide-react";
import { BLOCK_LABELS, newBlock, uid, type Block, type BlockType, type EmailDoc } from "@/lib/blocks";
import { PALETTES, paletteFor } from "@/lib/ministries";
import { renderEmail, renderPlainText } from "@/lib/render";
import { runChecks } from "@/lib/checks";
import { MISSIONS_TEMPLATE } from "@/lib/templates/missions";
import { Area, Field } from "./fields";
import Inspector from "./Inspector";

type Device = "phone" | "desktop" | "dark" | "text";
const STORE_KEY = "brainerd-mail:draft:missions";
const ADDRESS = process.env.NEXT_PUBLIC_MAIL_ADDRESS || "[Church mailing address]";
const ADDABLE: BlockType[] = ["hero", "text", "photo", "event", "travel", "partners", "cta", "card", "divider"];

export default function Builder() {
  const [doc, setDoc] = useState<EmailDoc>(MISSIONS_TEMPLATE);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("phone");
  const [saved, setSaved] = useState<"saved" | "saving">("saved");
  const [status, setStatus] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const palette = paletteFor(doc.ministry);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setDoc(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaved("saving");
    const t = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(doc)); } catch {}
      setSaved("saved");
    }, 500);
    return () => clearTimeout(t);
  }, [doc, loaded]);

  const baseOpts = useMemo(
    () => ({
      mode: "email" as const,
      wrap: (url: string) => url,
      webUrl: `${origin}/w/preview`,
      unsubscribeUrl: "#unsubscribe",
      preferencesUrl: "#preferences",
      address: ADDRESS,
      siteUrl: origin,
    }),
    [origin]
  );

  const sentHtml = useMemo(() => renderEmail(doc, baseOpts), [doc, baseOpts]);
  const checks = useMemo(() => runChecks(doc, new Blob([sentHtml]).size, ADDRESS), [doc, sentHtml]);
  const plain = useMemo(() => renderPlainText(doc, baseOpts), [doc, baseOpts]);

  // Live preview: rewrite the iframe in place so scroll position survives edits.
  useEffect(() => {
    if (device === "text") return;
    const frame = iframeRef.current;
    if (!frame) return;
    let html = renderEmail(doc, { ...baseOpts, editable: true });
    if (device === "dark") html = html.replace("@media (prefers-color-scheme:dark)", "@media all");
    const sel = selected ? `[data-bid="${selected}"]{outline:3px solid #1e61b9;outline-offset:-3px;}` : "";
    const inject = `<style>[data-bid]{cursor:pointer}[data-bid]:hover{outline:2px dashed rgba(30,97,185,.55);outline-offset:-2px}${sel}</style><script>document.addEventListener("click",function(e){e.preventDefault();var t=e.target.closest("[data-bid]");parent.postMessage({bid:t?t.getAttribute("data-bid"):null},"*")},true)</script>`;
    html = html.replace("</body>", `${inject}</body>`);
    const d = frame.contentDocument;
    if (!d) return;
    const y = d.scrollingElement?.scrollTop ?? 0;
    d.open(); d.write(html); d.close();
    requestAnimationFrame(() => { if (d.scrollingElement) d.scrollingElement.scrollTop = y; });
  }, [doc, device, selected, baseOpts]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && typeof e.data === "object" && "bid" in e.data) setSelected(e.data.bid);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const setBlocks = useCallback((fn: (b: Block[]) => Block[]) => setDoc((d) => ({ ...d, blocks: fn(d.blocks) })), []);
  const sel = doc.blocks.find((b) => b.id === selected) ?? null;

  const add = (type: BlockType) => {
    const nb = newBlock(type);
    setBlocks((bs) => {
      const i = selected ? bs.findIndex((b) => b.id === selected) : -1;
      const at = i >= 0 ? i + 1 : bs.length;
      return [...bs.slice(0, at), nb, ...bs.slice(at)];
    });
    setSelected(nb.id);
  };
  const move = (id: string, dir: -1 | 1) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const c = [...bs]; [c[i], c[j]] = [c[j], c[i]]; return c;
    });
  const dup = (id: string) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const copy = JSON.parse(JSON.stringify(bs[i])) as Block; copy.id = uid();
      return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)];
    });
  const del = (id: string) => { setBlocks((bs) => bs.filter((b) => b.id !== id)); if (selected === id) setSelected(null); };

  const blocking = checks.filter((c) => !c.ok && c.severity === "block").length;
  const warns = checks.filter((c) => !c.ok && c.severity === "warn").length;

  async function sendTest() {
    setStatus("Sending a test to you…");
    try {
      const res = await fetch("/api/test-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc }) });
      const j = await res.json();
      setStatus(res.ok ? `Test sent to ${j.to}. Check your inbox and phone.` : j.error || "Could not send the test.");
    } catch { setStatus("Could not send the test."); }
  }

  const frameWidth = device === "phone" ? 390 : 760;

  return (
    <div className="flex h-screen flex-col bg-mist">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-white px-5">
        <div className="flex items-center gap-4">
          <span className="text-[17px] font-bold tracking-[0.16em] text-navy">BRAINERD <span className="font-medium text-[#008299]">MAIL</span></span>
          <span className="h-7 w-px bg-line" />
          <select aria-label="Ministry" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold" style={{ color: palette.dark }} value={doc.ministry} onChange={(e) => setDoc({ ...doc, ministry: e.target.value })}>
            {Object.values(PALETTES).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <div>
            <input aria-label="Email name" className="w-64 bg-transparent text-[15px] font-semibold outline-none" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
            <div className="text-xs text-muted">{saved === "saving" ? "Saving…" : "Draft saved"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-[#e3eaf2] p-1">
          {([["phone", Smartphone, "Phone"], ["desktop", Monitor, "Desktop"], ["dark", Moon, "Dark"], ["text", MessageSquare, "Text"]] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setDevice(k)} className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${device === k ? "bg-white text-navy shadow-sm" : "text-muted"}`}><Icon size={16} />{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={sendTest} className="pill-btn border-2 border-navy text-navy"><FlaskConical size={16} className="mr-1.5" />Send me a test</button>
          <button disabled={blocking > 0} className={`pill-btn ${blocking ? "cursor-not-allowed bg-[#c4cfdc] text-white" : "bg-[#1e61b9] text-white"}`}><Send size={16} className="mr-1.5" />Send for approval</button>
        </div>
      </header>

      {status ? <div className="bg-[#e8f5ee] px-5 py-2 text-sm text-[#0d3b2c]">{status}</div> : null}

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* Left rail */}
        <aside className="overflow-y-auto border-r border-line bg-white p-4">
          <div className="label">Add to this email</div>
          <div className="mb-6 grid grid-cols-2 gap-2">
            {ADDABLE.map((t) => (
              <button key={t} onClick={() => add(t)} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:border-brand hover:bg-[#f4f8fd]"><Plus size={14} className="text-brand" />{BLOCK_LABELS[t]}</button>
            ))}
          </div>
          <div className="label">In this email</div>
          <ol className="space-y-1.5">
            {doc.blocks.map((b, i) => (
              <li key={b.id}>
                <div className={`group flex items-center gap-1 rounded-xl border px-2 py-2 text-sm transition ${selected === b.id ? "border-brand bg-[#f4f8fd]" : "border-line bg-white"}`}>
                  <button className={`min-w-0 flex-1 truncate text-left font-semibold ${b.hidden ? "text-muted line-through" : "text-ink"}`} onClick={() => setSelected(b.id)}>{BLOCK_LABELS[b.type]}</button>
                  <button aria-label={b.hidden ? "Show" : "Hide"} title={b.hidden ? "Show" : "Hide"} className="p-1 text-muted hover:text-ink" onClick={() => setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))}>{b.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  <button aria-label="Move up" disabled={i === 0} className="p-1 text-muted hover:text-ink disabled:opacity-30" onClick={() => move(b.id, -1)}><ChevronUp size={15} /></button>
                  <button aria-label="Move down" disabled={i === doc.blocks.length - 1} className="p-1 text-muted hover:text-ink disabled:opacity-30" onClick={() => move(b.id, 1)}><ChevronDown size={15} /></button>
                  <button aria-label="Duplicate" className="p-1 text-muted hover:text-ink" onClick={() => dup(b.id)}><Copy size={14} /></button>
                  <button aria-label="Delete" className="p-1 text-muted hover:text-[#c8102e]" onClick={() => { if (confirm("Remove this block?")) del(b.id); }}><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        {/* Preview */}
        <main className="min-w-0 overflow-auto p-6">
          {device === "text" ? (
            <div className="mx-auto max-w-[380px] rounded-[28px] bg-white p-5 shadow-sm">
              <div className="mb-3 text-center text-xs font-semibold text-muted">Brainerd Baptist Church · Today</div>
              <div className="rounded-2xl bg-[#eef1f5] p-4 text-[16px] leading-snug text-ink">
                {palette.label === "Church-Wide" ? "Brainerd" : `Brainerd ${palette.label}`}: {doc.previewText || doc.subject}
                <div className="mt-2 text-[#1e5fa8] underline">{origin.replace(/^https?:\/\//, "")}/w/xxxx</div>
                <div className="mt-2 text-sm text-muted">Reply STOP to opt out</div>
              </div>
              <p className="mt-4 text-sm text-muted">This is the text subscribers get. The link opens the web version of this same email.</p>
              <details className="mt-4 text-sm text-muted"><summary className="cursor-pointer font-semibold">Plain-text version of the email</summary><pre className="mt-2 whitespace-pre-wrap text-xs">{plain}</pre></details>
            </div>
          ) : (
            <div className="mx-auto" style={{ width: frameWidth }}>
              <div className={device === "phone" ? "rounded-[40px] border-[10px] border-[#1b2a41] bg-white overflow-hidden" : "rounded-xl border border-line bg-white overflow-hidden shadow-sm"}>
                <iframe ref={iframeRef} title="Email preview" className="block w-full bg-white" style={{ height: device === "phone" ? 760 : "calc(100vh - 170px)" }} />
              </div>
              <p className="mt-3 text-center text-sm text-muted">Click any part of the email to edit it.</p>
            </div>
          )}
        </main>

        {/* Inspector */}
        <aside className="overflow-y-auto border-l border-line bg-[#f7f9fc] p-5">
          {sel ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-navy">{BLOCK_LABELS[sel.type]}</h2>
                <button className="text-sm font-semibold text-brand" onClick={() => setSelected(null)}>Done</button>
              </div>
              <Inspector block={sel} onChange={(nb) => setBlocks((bs) => bs.map((b) => (b.id === nb.id ? nb : b)))} />
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-serif text-xl font-semibold text-navy">Email details</h2>
              <Field label="Subject line" value={doc.subject} onChange={(v) => setDoc({ ...doc, subject: v })} hint={`${doc.subject.length} characters`} />
              <Area label="Preview text" value={doc.previewText} onChange={(v) => setDoc({ ...doc, previewText: v })} rows={2} hint="The gray line people see next to the subject" />
              <Area label="Footer note" value={doc.footerNote} onChange={(v) => setDoc({ ...doc, footerNote: v })} rows={3} />
            </div>
          )}

          <div className="mt-8 rounded-xl border border-line bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-ink">Before you send</h3>
              <span className={`text-xs font-bold ${blocking ? "text-[#c8102e]" : warns ? "text-[#9a5a00]" : "text-[#1e7a4c]"}`}>{blocking ? `${blocking} to fix` : warns ? `${warns} suggestion${warns > 1 ? "s" : ""}` : "All clear"}</span>
            </div>
            <ul className="space-y-2.5">
              {checks.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#33445d]">
                  {c.ok ? <Check size={16} className="mt-0.5 shrink-0 text-[#1e7a4c]" /> : <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${c.severity === "block" ? "text-[#c8102e]" : "text-[#9a5a00]"}`} />}
                  <span>{c.label}{c.detail ? <span className="block text-xs text-muted">{c.detail}</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
