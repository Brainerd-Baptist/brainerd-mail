"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ChevronUp, ChevronDown, Copy, Trash2, Plus, Smartphone, Monitor, Moon, MessageSquare, Check, AlertTriangle, Send, FlaskConical, Pencil, LayoutList, ListChecks, Settings2, X } from "lucide-react";
import { BLOCK_LABELS, newBlock, uid, type Block, type BlockType, type EmailDoc } from "@/lib/blocks";
import { PALETTES, paletteFor } from "@/lib/ministries";
import { renderEmail, renderPlainText } from "@/lib/render";
import { runChecks } from "@/lib/checks";
import { MISSIONS_TEMPLATE } from "@/lib/templates/missions";
import { CHURCH_ADDRESS, CONTACT_EMAIL } from "@/lib/church";
import { Area, Field } from "./fields";
import Inspector from "./Inspector";

type Device = "phone" | "desktop" | "dark" | "text";
type Tab = "edit" | "blocks" | "check" | "details";

function useIsDesktop(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setV(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}
const STORE_KEY = "brainerd-mail:draft:missions";
const ADDRESS = CHURCH_ADDRESS;
const ADDABLE: BlockType[] = ["hero", "text", "photo", "event", "travel", "partners", "cta", "card", "divider"];

export default function Builder() {
  const [doc, setDoc] = useState<EmailDoc>(MISSIONS_TEMPLATE);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("phone");
  const [saved, setSaved] = useState<"saved" | "saving">("saved");
  const [status, setStatus] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const [tab, setTab] = useState<Tab>("edit");
  const [sendOpen, setSendOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const prevSel = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emailIdRef = useRef<string | undefined>(undefined);
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
      contactEmail: CONTACT_EMAIL,
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
    const changed = prevSel.current !== selected;
    prevSel.current = selected;
    requestAnimationFrame(() => {
      if (!d.scrollingElement) return;
      d.scrollingElement.scrollTop = y;
      if (changed && selected) d.querySelector(`[data-bid="${selected}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [doc, device, selected, baseOpts]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && typeof e.data === "object" && "bid" in e.data) { setSelected(e.data.bid); setTab("edit"); }
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
      const res = await fetch("/api/test-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc, emailId: emailIdRef.current }) });
      const j = await res.json();
      if (j.emailId) emailIdRef.current = j.emailId;
      setStatus(res.ok ? `Test sent to ${j.to}. Check your inbox and phone.` : j.error || "Could not send the test.");
    } catch { setStatus("Could not send the test."); }
  }

  const isPhoneLayout = isDesktop === false;
  const frameWidth = device === "phone" ? 390 : 760;
  const statusPill = blocking ? `${blocking} to fix` : warns ? `${warns} suggestion${warns > 1 ? "s" : ""}` : "All clear";
  const statusColor = blocking ? "text-[#c8102e]" : warns ? "text-[#9a5a00]" : "text-[#1e7a4c]";

  const ministrySelect = (
    <select aria-label="Ministry" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold" style={{ color: palette.dark }} value={doc.ministry} onChange={(e) => setDoc({ ...doc, ministry: e.target.value })}>
      {Object.values(PALETTES).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
    </select>
  );

  const deviceToggle = (kinds: Device[]) => (
    <div className="flex items-center gap-1 rounded-full bg-[#e3eaf2] p-1">
      {([["phone", Smartphone, "Phone"], ["desktop", Monitor, "Desktop"], ["dark", Moon, "Dark"], ["text", MessageSquare, "Text"]] as const).filter(([k]) => kinds.includes(k)).map(([k, Icon, label]) => (
        <button key={k} onClick={() => setDevice(k)} aria-label={label} className={`flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition lg:px-4 ${device === k ? "bg-white text-navy shadow-sm" : "text-muted"}`}><Icon size={16} /><span className={isPhoneLayout && device !== k ? "hidden" : ""}>{label}</span></button>
      ))}
    </div>
  );

  const checksPanel = (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink">Before you send</h3>
        <span className={`text-xs font-bold ${statusColor}`}>{statusPill}</span>
      </div>
      <ul className="space-y-3">
        {checks.map((c, i) => (
          <li key={i} className="flex gap-2 text-[15px] text-[#33445d]">
            {c.ok ? <Check size={18} className="mt-0.5 shrink-0 text-[#1e7a4c]" /> : <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${c.severity === "block" ? "text-[#c8102e]" : "text-[#9a5a00]"}`} />}
            <span>{c.label}{c.detail ? <span className="block text-xs text-muted">{c.detail}</span> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const detailsPanel = (
    <div className="space-y-4">
      <h2 className="font-serif text-xl font-semibold text-navy">Email details</h2>
      <Field label="Subject line" value={doc.subject} onChange={(v) => setDoc({ ...doc, subject: v })} hint={`${doc.subject.length} characters`} />
      <Area label="Preview text" value={doc.previewText} onChange={(v) => setDoc({ ...doc, previewText: v })} rows={2} hint="The gray line people see next to the subject" />
      <Area label="Footer note" value={doc.footerNote} onChange={(v) => setDoc({ ...doc, footerNote: v })} rows={3} />
    </div>
  );

  const blocksPanel = (
    <>
      <div className="label">Add to this email</div>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {ADDABLE.map((t) => (
          <button key={t} onClick={() => { add(t); if (isPhoneLayout) setTab("edit"); }} className="flex min-h-12 items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-[15px] font-semibold text-ink transition active:bg-[#f4f8fd] lg:hover:border-brand"><Plus size={16} className="shrink-0 text-brand" />{BLOCK_LABELS[t]}</button>
        ))}
      </div>
      <div className="label">In this email</div>
      <ol className="space-y-1.5">
        {doc.blocks.map((b, i) => (
          <li key={b.id}>
            <div className={`flex items-center gap-0.5 rounded-xl border px-2 py-1 text-sm transition ${selected === b.id ? "border-brand bg-[#f4f8fd]" : "border-line bg-white"}`}>
              <button className={`min-h-11 min-w-0 flex-1 truncate text-left text-[15px] font-semibold ${b.hidden ? "text-muted line-through" : "text-ink"}`} onClick={() => { setSelected(b.id); if (isPhoneLayout) setTab("edit"); }}>{BLOCK_LABELS[b.type]}</button>
              <IconBtn label={b.hidden ? "Show" : "Hide"} onClick={() => setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))}>{b.hidden ? <EyeOff size={18} /> : <Eye size={18} />}</IconBtn>
              <IconBtn label="Move up" disabled={i === 0} onClick={() => move(b.id, -1)}><ChevronUp size={18} /></IconBtn>
              <IconBtn label="Move down" disabled={i === doc.blocks.length - 1} onClick={() => move(b.id, 1)}><ChevronDown size={18} /></IconBtn>
              <IconBtn label="Duplicate" onClick={() => dup(b.id)}><Copy size={16} /></IconBtn>
              <IconBtn label="Delete" danger onClick={() => { if (confirm("Remove this block?")) del(b.id); }}><Trash2 size={16} /></IconBtn>
            </div>
          </li>
        ))}
      </ol>
    </>
  );

  const textPreview = (
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
  );

  const inspector = sel ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-navy">{BLOCK_LABELS[sel.type]}</h2>
        <div className="flex items-center">
          {isPhoneLayout ? (<>
            <IconBtn label="Move up" onClick={() => move(sel.id, -1)}><ChevronUp size={20} /></IconBtn>
            <IconBtn label="Move down" onClick={() => move(sel.id, 1)}><ChevronDown size={20} /></IconBtn>
            <IconBtn label="Delete" danger onClick={() => { if (confirm("Remove this block?")) del(sel.id); }}><Trash2 size={18} /></IconBtn>
          </>) : null}
          <button className="ml-2 min-h-11 px-2 text-sm font-semibold text-brand" onClick={() => setSelected(null)}>Done</button>
        </div>
      </div>
      <Inspector block={sel} onChange={(nb) => setBlocks((bs) => bs.map((b) => (b.id === nb.id ? nb : b)))} />
    </div>
  ) : null;

  if (isDesktop === null) return null;

  const sendActions = (
    <div className="flex flex-col gap-3">
      <button onClick={sendTest} className="pill-btn w-full border-2 border-navy text-navy"><FlaskConical size={16} className="mr-1.5" />Send me a test</button>
      <button disabled={blocking > 0} className={`pill-btn w-full ${blocking ? "cursor-not-allowed bg-[#c4cfdc] text-white" : "bg-[#1e61b9] text-white"}`}><Send size={16} className="mr-1.5" />Send for approval</button>
      {blocking ? <p className="text-center text-xs text-muted">Fix the {blocking} item{blocking > 1 ? "s" : ""} in the checklist first.</p> : null}
    </div>
  );

  /* ---------- Phone layout ---------- */
  if (isPhoneLayout) {
    return (
      <div className="flex h-[100dvh] flex-col bg-mist">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-white px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: palette.button }} />
            <div className="min-w-0">
              <input aria-label="Email name" className="w-full min-w-0 truncate bg-transparent text-[16px] font-semibold outline-none" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
              <div className="-mt-0.5 text-xs text-muted">{palette.label} · {saved === "saving" ? "Saving…" : "Saved"}</div>
            </div>
          </div>
          <button onClick={() => setSendOpen(true)} className="pill-btn shrink-0 bg-[#1e61b9] px-4 text-white"><Send size={15} className="mr-1.5" />Send</button>
        </header>
        {status ? <div className="bg-[#e8f5ee] px-4 py-2 text-sm text-[#0d3b2c]">{status}</div> : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "edit" ? (
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">{ministrySelect}{deviceToggle(["phone", "dark", "text"])}</div>
              <div className="min-h-0 flex-1 overflow-auto px-0">
                {device === "text" ? <div className="p-3">{textPreview}</div> : (
                  <iframe ref={iframeRef} title="Email preview" className="block h-full w-full bg-white" />
                )}
              </div>
              {inspector ? (
                <div className="max-h-[48dvh] shrink-0 overflow-y-auto rounded-t-2xl border-t border-line bg-[#f7f9fc] p-4 shadow-[0_-8px_24px_rgba(0,32,91,0.12)]">{inspector}</div>
              ) : (
                <div className="shrink-0 border-t border-line bg-white px-4 py-2 text-center text-sm text-muted">Tap any part of the email to edit it</div>
              )}
            </div>
          ) : null}
          {tab === "blocks" ? <div className="h-full overflow-y-auto bg-white p-4">{blocksPanel}</div> : null}
          {tab === "check" ? <div className="h-full overflow-y-auto p-4">{checksPanel}</div> : null}
          {tab === "details" ? <div className="h-full overflow-y-auto bg-[#f7f9fc] p-4">{detailsPanel}</div> : null}
        </div>

        <nav className="grid shrink-0 grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
          {([["edit", Pencil, "Edit"], ["blocks", LayoutList, "Blocks"], ["check", ListChecks, "Check"], ["details", Settings2, "Details"]] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${tab === k ? "text-navy" : "text-muted"}`}>
              <Icon size={22} />{label}
              {k === "check" && (blocking + warns) > 0 ? <span className="absolute right-[28%] top-2 h-2.5 w-2.5 rounded-full bg-[#c8102e]" /> : null}
            </button>
          ))}
        </nav>

        {sendOpen ? (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setSendOpen(false)}>
            <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">Ready to send?</h2><IconBtn label="Close" onClick={() => setSendOpen(false)}><X size={22} /></IconBtn></div>
              <div className="mb-4">{checksPanel}</div>
              {sendActions}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------- Desktop layout ---------- */
  return (
    <div className="flex h-screen flex-col bg-mist">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-white px-5">
        <div className="flex items-center gap-4">
          <span className="text-[17px] font-bold tracking-[0.16em] text-navy">BRAINERD <span className="font-medium text-[#008299]">MAIL</span></span>
          <span className="h-7 w-px bg-line" />
          {ministrySelect}
          <div>
            <input aria-label="Email name" className="w-64 bg-transparent text-[15px] font-semibold outline-none" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
            <div className="text-xs text-muted">{saved === "saving" ? "Saving…" : "Draft saved"}</div>
          </div>
        </div>
        {deviceToggle(["phone", "desktop", "dark", "text"])}
        <div className="flex items-center gap-3">
          <button onClick={sendTest} className="pill-btn border-2 border-navy text-navy"><FlaskConical size={16} className="mr-1.5" />Send me a test</button>
          <button disabled={blocking > 0} className={`pill-btn ${blocking ? "cursor-not-allowed bg-[#c4cfdc] text-white" : "bg-[#1e61b9] text-white"}`}><Send size={16} className="mr-1.5" />Send for approval</button>
        </div>
      </header>
      {status ? <div className="bg-[#e8f5ee] px-5 py-2 text-sm text-[#0d3b2c]">{status}</div> : null}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="overflow-y-auto border-r border-line bg-white p-4">{blocksPanel}</aside>
        <main className="min-w-0 overflow-auto p-6">
          {device === "text" ? textPreview : (
            <div className="mx-auto" style={{ width: frameWidth }}>
              <div className={device === "phone" ? "overflow-hidden rounded-[40px] border-[10px] border-[#1b2a41] bg-white" : "overflow-hidden rounded-xl border border-line bg-white shadow-sm"}>
                <iframe ref={iframeRef} title="Email preview" className="block w-full bg-white" style={{ height: device === "phone" ? 760 : "calc(100vh - 170px)" }} />
              </div>
              <p className="mt-3 text-center text-sm text-muted">Click any part of the email to edit it.</p>
            </div>
          )}
        </main>
        <aside className="overflow-y-auto border-l border-line bg-[#f7f9fc] p-5">
          {inspector ?? detailsPanel}
          <div className="mt-8">{checksPanel}</div>
        </aside>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`flex h-11 w-11 items-center justify-center rounded-lg text-muted transition active:bg-black/5 disabled:opacity-30 ${danger ? "lg:hover:text-[#c8102e]" : "lg:hover:text-ink"}`}>{children}</button>
  );
}
