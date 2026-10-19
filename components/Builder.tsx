"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ChevronUp, ChevronDown, Copy, Trash2, Plus, Smartphone, Monitor, Moon, MessageSquare, Check, AlertTriangle, Send, FlaskConical, Pencil, LayoutList, ListChecks, Settings2, X, LifeBuoy, Globe, ArrowLeft, History, Undo2, Redo2, CalendarClock, MoreHorizontal } from "lucide-react";
import { BLOCK_LABELS, newBlock, uid, type Block, type BlockType, type EmailDoc } from "@/lib/blocks";
import { PALETTES, paletteFor } from "@/lib/ministries";
import { renderEmail, renderPlainText } from "@/lib/render";
import { runChecks } from "@/lib/checks";
import { PolishPanel } from "@/components/PolishPanel";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { polish, readDismissed } from "@/lib/polish";
import { MISSIONS_TEMPLATE } from "@/lib/templates/missions";
import { SubmitSheet, HistorySheet, ScheduleSheet } from "@/components/ApprovalSheets";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { SENDING_ENABLED, when } from "@/lib/approval";
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
const ADDRESS = CHURCH_ADDRESS;
const ADDABLE: BlockType[] = ["hero", "text", "photo", "event", "travel", "partners", "cta", "card", "divider"];

type SaveState = "saved" | "saving" | "error" | "conflict";

export default function Builder({ emailId }: { emailId: string }) {
  const router = useRouter();
  const [doc, setDocRaw] = useState<EmailDoc>(MISSIONS_TEMPLATE);
  const [rowStatus, setRowStatus] = useState("draft");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [sched, setSched] = useState<{ at: string | null; expedited: boolean }>({ at: null, expedited: false });
  const [plannedAt, setPlannedAt] = useState<string | null>(null);
  const [planErr, setPlanErr] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [role, setRole] = useState("");
  const viewOnly = !canEdit;
  const locked = rowStatus !== "draft" || viewOnly;
  const lockedRef = useRef(false);
  lockedRef.current = locked;
  // Once an email is waiting for approval, approved or sent, nothing may change it by accident.
  const setDoc = useCallback((v: EmailDoc | ((d: EmailDoc) => EmailDoc)) => { if (!lockedRef.current) setDocRaw(v); }, []);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("phone");
  const [saved, setSaved] = useState<SaveState>("saved");
  const [loadErr, setLoadErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [status, setStatus] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const [tab, setTab] = useState<Tab>("edit");
  const [sendOpen, setSendOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [inboxNew, setInboxNew] = useState<number | null>(null); // null = not an admin
  useEffect(() => {
    fetch("/api/feedback?summary=1").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.admin) setInboxNew(j.new ?? 0); }).catch(() => {});
  }, [feedbackOpen]);
  const isDesktop = useIsDesktop();
  const prevSel = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emailIdRef = useRef<string | undefined>(emailId);
  const versionRef = useRef("");
  const docRef = useRef<EmailDoc>(doc);
  docRef.current = doc;
  const dirtyRef = useRef(false);
  const inflightRef = useRef(false);
  const stateRef = useRef<SaveState>("saved");
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupKey = `brainerd-mail:draft:${emailId}`;
  const palette = paletteFor(doc.theme ?? doc.ministry);

  // Load this email from the database. A copy kept on this device is only used if edits
  // were made after the last successful save (for example, the phone lost signal).
  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/emails/${emailId}`, { cache: "no-store" });
        if (r.status === 404) { if (!cancelled) setLoadErr("This email doesn’t exist any more. It may have been deleted."); return; }
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (cancelled) return;
        versionRef.current = j.version;
        let next: EmailDoc = j.doc;
        try {
          const raw = localStorage.getItem(backupKey);
          if (raw) {
            const b = JSON.parse(raw);
            if (b?.base === j.version && b.doc && JSON.stringify(b.doc) !== JSON.stringify(j.doc)) { next = b.doc; dirtyRef.current = true; }
          }
        } catch {}
        setCanEdit(j.canEdit !== false); setRole(j.role ?? ""); setRowStatus(j.status); setReviewNote(j.reviewNote ?? null); setSched({ at: j.scheduledAt ?? null, expedited: !!j.expedited }); setPlannedAt(j.plannedAt ?? null);
        if (j.status !== "draft" || j.canEdit === false) { next = j.doc; dirtyRef.current = false; }
        setDocRaw(next);
        setLoaded(true);
      } catch { if (!cancelled) setLoadErr("Couldn’t open this email. Check your connection and try again."); }
    })();
    return () => { cancelled = true; };
  }, [emailId, backupKey]);

  const setSave = (st: SaveState, msg = "") => { stateRef.current = st; setSaved(st); setSaveMsg(msg); };

  // Save to the database. One save at a time; if edits arrive meanwhile, save again right after.
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (stateRef.current === "conflict") return false;
    if (inflightRef.current) return false;
    inflightRef.current = true;
    try {
      for (let i = 0; i < 3; i++) {
        dirtyRef.current = false;
        const sent = docRef.current;
        let r: Response;
        try { r = await fetch(`/api/emails/${emailId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: sent, version: versionRef.current }), keepalive: true }); }
        catch { dirtyRef.current = true; setSave("error", "Offline. Your changes are kept on this device and will save when you’re back."); return false; }
        const j = await r.json().catch(() => ({}));
        if (r.status === 409 || r.status === 404) { setSave("conflict", j.error || "This email can’t be saved from here."); return false; }
        if (!r.ok) { dirtyRef.current = true; setSave("error", "Couldn’t save. Will keep trying."); return false; }
        versionRef.current = j.version;
        try { localStorage.setItem(backupKey, JSON.stringify({ base: j.version, doc: sent })); } catch {}
        if (idleRef.current) clearTimeout(idleRef.current);
        idleRef.current = setTimeout(() => { fetch(`/api/emails/${emailId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: "Auto-saved copy", auto: true }), keepalive: true }).catch(() => {}); }, 5 * 60000);
        if (!dirtyRef.current && docRef.current === sent) { setSave("saved"); return true; }
      }
      return true;
    } finally { inflightRef.current = false; }
  }, [emailId, backupKey]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    if (firstRun.current) { firstRun.current = false; if (!dirtyRef.current) return; }
    dirtyRef.current = true;
    if (stateRef.current === "conflict") return;
    try { localStorage.setItem(backupKey, JSON.stringify({ base: versionRef.current, doc })); } catch {}
    setSave("saving");
    const t = setTimeout(() => { saveNow(); }, 1200);
    return () => clearTimeout(t);
  }, [doc, loaded, saveNow, backupKey]);

  // Phone switched apps or tab hidden: save right away.
  useEffect(() => {
    const flush = () => { if (document.visibilityState === "hidden" && dirtyRef.current) saveNow(); };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [saveNow]);

  // Undo / redo: a stack of earlier states. Quick typing is grouped into one step.
  const undoStack = useRef<EmailDoc[]>([]);
  const redoStack = useRef<EmailDoc[]>([]);
  const prevDoc = useRef<EmailDoc | null>(null);
  const applying = useRef(false);
  const lastEditAt = useRef(0);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!loaded) return;
    if (prevDoc.current === null || applying.current) { applying.current = false; prevDoc.current = doc; return; }
    if (prevDoc.current === doc) return;
    const now = Date.now();
    if (now - lastEditAt.current > 800) { undoStack.current.push(prevDoc.current); if (undoStack.current.length > 100) undoStack.current.shift(); }
    redoStack.current = [];
    lastEditAt.current = now;
    prevDoc.current = doc;
    bump((n) => n + 1);
  }, [doc, loaded]);
  const undo = useCallback(() => {
    if (lockedRef.current || !undoStack.current.length) return;
    redoStack.current.push(docRef.current);
    applying.current = true; lastEditAt.current = 0;
    setDocRaw(undoStack.current.pop()!); bump((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    if (lockedRef.current || !redoStack.current.length) return;
    undoStack.current.push(docRef.current);
    applying.current = true; lastEditAt.current = 0;
    setDocRaw(redoStack.current.pop()!); bump((n) => n + 1);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (k === "y") { e.preventDefault(); redo(); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [undo, redo]);

  // Warn before leaving the page while something hasn't reached the database yet.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || stateRef.current === "saving" || stateRef.current === "error") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

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
      if (lockedRef.current) return;
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

  const testingRef = useRef(false);
  // Photos that look dark, blurry or small: warn, and ask before sending.
  const photoWarnings = useMemo(() => polish(doc).filter((s) => s.kind === "photo"), [doc]);
  function confirmPhotos(): boolean {
    const skip = readDismissed(doc.ministry);
    const open = photoWarnings.filter((s) => !skip.includes(s.id));
    if (!open.length) return true;
    const what = Array.from(new Set(open.map((s) => s.title.replace("This photo ", "").replace("is ", "").replace("looks ", "")))).join(", ");
    return confirm(`${open.length} photo${open.length === 1 ? "" : "s"} may not look their best (${what}). Look at the Check tab, or send for approval anyway?`);
  }
  async function sendTest() {
    if (testingRef.current) return;
    testingRef.current = true;
    setStatus("Sending a test to you…");
    try {
      if (dirtyRef.current || stateRef.current === "saving") { while (inflightRef.current) await new Promise((r) => setTimeout(r, 100)); await saveNow(); }
      if (stateRef.current === "conflict") { setStatus(saveMsg || "Reload this email before sending a test."); return; }
      const res = await fetch("/api/test-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc, emailId: emailIdRef.current }) });
      const j = await res.json();
      if (j.version) versionRef.current = j.version;
      setStatus(res.ok ? `Test sent to ${j.to}. Check your inbox and phone.` : j.error || "Could not send the test.");
    } catch { setStatus("Could not send the test."); }
    finally { testingRef.current = false; }
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function flushSave() {
    while (inflightRef.current) await sleep(100);
    if (dirtyRef.current) await saveNow();
  }
  async function submitForApproval(sendAtIso: string): Promise<string | null> {
    await flushSave();
    if (stateRef.current === "conflict") return "This email changed somewhere else. Reload it first.";
    try {
      const r = await fetch(`/api/emails/${emailId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sendAt: sendAtIso }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.error || "Could not send for approval.";
      versionRef.current = j.version;
      setRowStatus("pending_approval"); setSched({ at: sendAtIso, expedited: !!j.expedited }); setReviewNote(null); setSelected(null);
      setPlannedAt(sendAtIso);
      setSubmitOpen(false); setSendOpen(false);
      setStatus("Sent for approval. You’ll get an email when it’s reviewed.");
      return null;
    } catch { return "Couldn’t reach the server. Try again."; }
  }
  async function savePlan(iso: string | null): Promise<string | null> {
    try {
      const r = await fetch(`/api/emails/${emailId}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plannedAt: iso }) });
      if (!r.ok) return (await r.json().catch(() => ({}))).error || "Could not save the date.";
      setPlannedAt(iso); setStatus(iso ? "Date saved. It’s on the calendar." : "Date removed.");
      return null;
    } catch { return "Couldn’t reach the server. Try again."; }
  }
  async function scheduleAndSubmit(iso: string): Promise<string | null> {
    if (!confirmPhotos()) return "Cancelled. Check the photos, then try again.";
    return submitForApproval(iso);
  }
  async function startEditing() {
    if (!confirm("Editing cancels the approval. You’ll need to send it for approval again. Continue?")) return;
    const r = await fetch(`/api/emails/${emailId}/withdraw`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setStatus(j.error || "Couldn’t reopen this email for editing."); return; }
    if (j.version) versionRef.current = j.version;
    lockedRef.current = false; setRowStatus("draft"); setSched({ at: null, expedited: false }); setStatus("Back to a draft. Make your changes, then send it for approval again.");
  }
  async function duplicateThis() {
    const r = await fetch("/api/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromId: emailId }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) router.push(`/editor?e=${j.id}`); else setStatus(j.error || "Couldn’t duplicate this email.");
  }
  async function saveCopy(name = "") { await flushSave(); await fetch(`/api/emails/${emailId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: name || "Saved copy", named: !!name }) }); }
  async function restoreVersion(id: string): Promise<string | null> {
    const r = await fetch(`/api/emails/${emailId}/versions?v=${id}`, { cache: "no-store" });
    if (!r.ok) return "Couldn’t load that copy.";
    const j = await r.json();
    await flushSave();
    await fetch(`/api/emails/${emailId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: "Before restoring" }) });
    setDocRaw(j.doc); setSelected(null); setHistoryOpen(false);
    setStatus("Restored. It’s saved as your current version.");
    return null;
  }

  const saveLabel = saved === "saving" ? "Saving…" : saved === "error" ? "Not saved yet" : saved === "conflict" ? "Not saved" : "Saved";
  const isPhoneLayout = isDesktop === false;
  const frameWidth = device === "phone" ? 390 : 760;
  const statusPill = blocking ? `${blocking} to fix` : warns ? `${warns} suggestion${warns > 1 ? "s" : ""}` : "All clear";
  const statusColor = blocking ? "text-[#c8102e]" : warns ? "text-[#9a5a00]" : "text-[#1e7a4c]";

  const [switching, setSwitching] = useState(false);
  async function openMinistry(key: string) {
    if (key === doc.ministry || switching) return;
    setSwitching(true);
    try {
      await flushSave();
      const r = await fetch("/api/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openMinistry: key }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.id) router.push(`/editor?e=${j.id}`); else { setStatus(j.error || "Couldn’t open that email."); setSwitching(false); }
    } catch { setStatus("Couldn’t open that email."); setSwitching(false); }
  }
  const ministrySelect = (
    <select aria-label="Ministry email" disabled={switching} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-60" style={{ color: palette.dark }} value={doc.ministry} onChange={(e) => openMinistry(e.target.value)}>
      {Object.values(PALETTES).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
    </select>
  );
  const colorSelect = (
    <label className="block"><span className="label">Colors</span>
      <select aria-label="Color theme" className="field" value={doc.theme ?? doc.ministry} onChange={(e) => setDoc({ ...doc, theme: e.target.value === doc.ministry ? undefined : e.target.value })}>
        {Object.values(PALETTES).map((p) => <option key={p.key} value={p.key}>{p.label}{p.key === doc.ministry ? " (this ministry's own)" : ""}</option>)}
      </select>
    </label>
  );

  const deviceToggle = (kinds: Device[]) => (
    <div className="flex items-center gap-1 rounded-full bg-[#e3eaf2] p-1">
      {([["phone", Smartphone, "Phone"], ["desktop", Monitor, "Desktop"], ["dark", Moon, "Dark"], ["text", MessageSquare, "Text"]] as const).filter(([k]) => kinds.includes(k)).map(([k, Icon, label]) => (
        <button key={k} onClick={() => setDevice(k)} aria-label={label} className={`flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition lg:px-4 ${device === k ? "bg-white text-navy shadow-sm" : "text-muted"}`}><Icon size={16} /><span className={isPhoneLayout && device !== k ? "hidden" : ""}>{label}</span></button>
      ))}
    </div>
  );

  const checksPanel = (
    <div className="space-y-4">
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
    <PolishPanel doc={doc} setDoc={setDoc} onShow={(id) => { setSelected(id); setTab("edit"); }} />
    </div>
  );

  const feedbackSheet = feedbackOpen ? (
    <FeedbackSheet onClose={() => setFeedbackOpen(false)} inboxNew={inboxNew} context={{ ministry: doc.ministry, emailTitle: doc.title, tab, device, selectedBlock: selected ? doc.blocks.find((b) => b.id === selected)?.type : null, page: typeof location !== "undefined" ? location.pathname : "", build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) }} />
  ) : null;

  const detailsPanel = (
    <div className="space-y-4">
      <h2 className="font-serif text-xl font-semibold text-navy">Email details</h2>
      <Field label="Subject line" value={doc.subject} onChange={(v) => setDoc({ ...doc, subject: v })} hint={`${doc.subject.length} characters`} />
      <Area label="Preview text" value={doc.previewText} onChange={(v) => setDoc({ ...doc, previewText: v })} rows={2} hint="The gray line people see next to the subject" />
      {colorSelect}
      {emailId ? (
        <label className="block"><span className="label">Planned send</span>
          <input type="datetime-local" className="field" disabled={locked} value={plannedAt ? new Date(new Date(plannedAt).getTime() - new Date(plannedAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
            onChange={async (e) => {
              const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
              setPlannedAt(iso); setPlanErr("");
              try {
                const r = await fetch(`/api/emails/${emailId}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plannedAt: iso }) });
                if (!r.ok) setPlanErr((await r.json().catch(() => ({}))).error || "Could not save the planned time.");
              } catch { setPlanErr("Could not save the planned time."); }
            }} />
          <span className="mt-1 block text-xs text-muted">{planErr ? <span className="text-[#8a1020]">{planErr}</span> : <>Shows on the <a href="/calendar" className="underline">calendar</a>. The final time is confirmed when you send for approval.</>}</span>
        </label>
      ) : null}
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
  if (loadErr) return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-mist p-6 text-center">
      <p className="max-w-sm text-[16px] text-ink">{loadErr}</p>
      <div className="flex gap-3"><Link href="/emails" className="pill-btn border-2 border-navy text-navy">All emails</Link><button onClick={() => location.reload()} className="pill-btn bg-[#1e61b9] text-white">Try again</button></div>
    </div>
  );
  if (!loaded) return <div className="flex min-h-[100dvh] items-center justify-center bg-mist text-sm text-muted">Opening…</div>;

  const planIso = locked ? sched.at : plannedAt;
  const chipShort = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  const chipWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  const saveBanner = saveMsg && (saved === "conflict" || saved === "error") ? (
    <div role="alert" className="flex items-center justify-between gap-3 bg-[#fff3d6] px-4 py-2 text-sm text-[#5c3a00]">
      <span>{saveMsg}</span>
      {saved === "conflict" ? <button onClick={() => location.reload()} className="shrink-0 font-semibold underline">Reload</button> : null}
    </div>
  ) : null;

  const stateBanner = viewOnly ? (
    <div className="bg-[#e8f0fb] px-4 py-2 text-sm text-[#0d2b52]"><b>View only.</b> {role === "viewer" ? "Your role can look at emails but not change them." : `Only people assigned to ${paletteFor(doc.ministry).label} can change this email.`}</div>
  ) : locked ? (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#e8f0fb] px-4 py-2 text-sm text-[#0d2b52]">
      <span>
        {rowStatus === "pending_approval" ? <><b>Waiting for approval.</b> {sched.at ? `Set to go out ${when(sched.at)}.` : ""}{sched.expedited ? " Expedited." : ""}</> : null}
        {rowStatus === "approved" ? <><b>Approved.</b> {sched.at ? `Scheduled for ${when(sched.at)}.` : ""}{!SENDING_ENABLED ? " Sending isn’t switched on yet, so it will wait." : ""}</> : null}
        {rowStatus === "scheduled" || rowStatus === "sending" ? <b>This email is being sent.</b> : null}
        {rowStatus === "sent" ? <b>This email has been sent.</b> : null}
        {rowStatus === "cancelled" ? <b>This email was cancelled.</b> : null}
      </span>
      <span className="flex gap-3 font-semibold">
        {rowStatus === "pending_approval" || rowStatus === "approved" ? <button onClick={startEditing} className="min-h-11 underline">Edit again</button> : <button onClick={duplicateThis} className="min-h-11 underline">Duplicate</button>}
      </span>
    </div>
  ) : reviewNote ? (
    <div className="bg-[#fff3d6] px-4 py-2 text-sm text-[#5c3a00]"><b>Changes requested:</b> {reviewNote}</div>
  ) : null;

  const sheets = (
    <>
      {scheduleOpen ? <ScheduleSheet onClose={() => setScheduleOpen(false)} initial={plannedAt} locked={locked} lockedAt={sched.at} onSave={savePlan} onSubmit={scheduleAndSubmit} blockedReason={blocking > 0 ? `Fix the ${blocking} item${blocking > 1 ? "s" : ""} in the checklist before sending for approval.` : undefined} /> : null}
      {submitOpen ? <SubmitSheet onClose={() => setSubmitOpen(false)} onSubmit={submitForApproval} softWarnings={0} initial={plannedAt} /> : null}
      {historyOpen ? <HistorySheet emailId={emailId} onClose={() => setHistoryOpen(false)} onRestore={restoreVersion} onSaveCopy={saveCopy} readOnly={locked} renderHtml={(d) => renderEmail(d as EmailDoc, baseOpts)} /> : null}
    </>
  );

  const sendActions = locked ? (
    <p className="text-sm text-muted">This email is {rowStatus === "pending_approval" ? "waiting for approval" : rowStatus.replace("_", " ")}. Use “Edit again” above to change it.</p>
  ) : (
    <div className="flex flex-col gap-3">
      <button onClick={sendTest} className="pill-btn w-full border-2 border-navy text-navy"><FlaskConical size={16} className="mr-1.5" />Send me a test</button>
      <button onClick={() => { if (!confirmPhotos()) return; setSendOpen(false); setSubmitOpen(true); }} disabled={blocking > 0} className={`pill-btn w-full ${blocking ? "cursor-not-allowed bg-[#c4cfdc] text-white" : "bg-[#1e61b9] text-white"}`}><Send size={16} className="mr-1.5" />Send for approval</button>
      {blocking ? <p className="text-center text-xs text-muted">Fix the {blocking} item{blocking > 1 ? "s" : ""} in the checklist first.</p> : null}
    </div>
  );

  /* ---------- Phone layout ---------- */
  if (isPhoneLayout) {
    return (
      <div className="flex h-[100dvh] flex-col bg-mist">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-white px-3">
          <div className="flex min-w-0 items-center gap-1">
            <NavMenu />
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: palette.button }} />
            <div className="min-w-0">
              <input aria-label="Email name" readOnly={locked} className="w-full min-w-0 truncate bg-transparent text-[16px] font-semibold outline-none" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
              <div className="-mt-0.5 truncate text-xs text-muted">{palette.label} · {saveLabel}{planIso ? ` · ${chipWhen(planIso)}` : ""}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative">
              <button onClick={() => setMoreOpen((v) => !v)} aria-label="More: schedule, history, feedback" aria-haspopup="menu" aria-expanded={moreOpen} className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-[#f4f8fd]"><MoreHorizontal size={24} />{inboxNew ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#c8102e]" /> : null}</button>
              {moreOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div role="menu" className="absolute right-0 top-12 z-50 w-[min(280px,80vw)] overflow-hidden rounded-2xl border border-line bg-white py-1.5 shadow-xl">
                    <button role="menuitem" onClick={() => { setMoreOpen(false); setScheduleOpen(true); }} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[16px] font-semibold text-ink active:bg-[#f4f8fd]"><CalendarClock size={20} className={planIso ? "text-[#1e61b9]" : "text-muted"} /><span className="min-w-0 flex-1">Schedule{planIso ? <span className="block truncate text-xs font-normal text-muted">{chipWhen(planIso)}</span> : null}</span></button>
                    <button role="menuitem" onClick={() => { setMoreOpen(false); setHistoryOpen(true); }} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[16px] font-semibold text-ink active:bg-[#f4f8fd]"><History size={20} className="text-muted" />Version history</button>
                    {doc.ministry === "missions" ? <a role="menuitem" href="/roster" className="flex min-h-12 w-full items-center gap-3 px-4 text-[16px] font-semibold text-ink active:bg-[#f4f8fd]"><Globe size={20} className="text-muted" />Serving list</a> : null}
                    <button role="menuitem" onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[16px] font-semibold text-ink active:bg-[#f4f8fd]"><LifeBuoy size={20} className="text-muted" /><span className="flex-1">Feedback</span>{inboxNew ? <span className="rounded-full bg-[#c8102e] px-1.5 text-xs font-bold text-white">{inboxNew}</span> : null}</button>
                  </div>
                </>
              ) : null}
            </div>
            <button onClick={() => setSendOpen(true)} className="pill-btn shrink-0 bg-[#1e61b9] px-4 text-white"><Send size={15} className="mr-1.5" />{locked ? "Status" : "Send"}</button>
          </div>
        </header>
        {status ? <div className="bg-[#e8f5ee] px-4 py-2 text-sm text-[#0d3b2c]">{status}</div> : null}
        {saveBanner}
        {stateBanner}
        {sheets}
        {feedbackSheet}

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
                <div className="flex shrink-0 items-center justify-between border-t border-line bg-white px-2 py-1 text-sm text-muted">
                  <button onClick={undo} disabled={!undoStack.current.length || locked} aria-label="Undo" className="flex h-11 items-center gap-1 rounded-full px-3 font-semibold text-brand active:bg-[#f4f8fd] disabled:text-muted disabled:opacity-40"><Undo2 size={18} />Undo</button>
                  <span className="px-1 text-center">Tap any part of the email to edit it</span>
                  <button onClick={redo} disabled={!redoStack.current.length || locked} aria-label="Redo" className="flex h-11 items-center gap-1 rounded-full px-3 font-semibold text-brand active:bg-[#f4f8fd] disabled:text-muted disabled:opacity-40"><Redo2 size={18} />Redo</button>
                </div>
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
          <NavMenu />
                    {ministrySelect}
          <div>
            <input aria-label="Email name" readOnly={locked} className="w-44 bg-transparent text-[15px] font-semibold outline-none 2xl:w-64" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
            <div className="text-xs text-muted">{saveLabel}</div>
          </div>
        </div>
        {deviceToggle(["phone", "desktop", "dark", "text"])}
        <div className="flex items-center gap-3">
          {doc.ministry === "missions" ? <a href="/roster" className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-[#f4f8fd]"><Globe size={18} /><span className="hidden 2xl:inline">Serving list</span></a> : null}
          <button onClick={() => setScheduleOpen(true)} className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold hover:bg-[#f4f8fd] ${planIso ? "border-line text-ink" : "border-transparent text-[#1e61b9]"}`}><CalendarClock size={18} className={planIso ? "text-[#1e61b9]" : ""} />{planIso ? chipShort(planIso) : "Schedule"}</button>
          <button onClick={() => setFeedbackOpen(true)} aria-label="Feedback" title="Feedback" className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-[#f4f8fd]"><LifeBuoy size={18} /><span className="hidden 2xl:inline">Feedback</span>{inboxNew ? <span className="rounded-full bg-[#c8102e] px-1.5 text-xs font-bold text-white">{inboxNew}</span> : null}</button>
          <HelpButton />
          <button onClick={undo} disabled={!undoStack.current.length || locked} aria-label="Undo" title="Undo" className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-[#f4f8fd] disabled:opacity-30"><Undo2 size={20} /></button><button onClick={redo} disabled={!redoStack.current.length || locked} aria-label="Redo" title="Redo" className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-[#f4f8fd] disabled:opacity-30"><Redo2 size={20} /></button>
          <button onClick={() => setHistoryOpen(true)} aria-label="History" title="History" className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-[#f4f8fd]"><History size={18} /><span className="hidden 2xl:inline">History</span></button>
          <button onClick={sendTest} className="pill-btn shrink-0 whitespace-nowrap border-2 border-navy text-navy"><FlaskConical size={16} className="mr-1.5" />Send me a test</button>
          <button onClick={() => { if (!confirmPhotos()) return; setSubmitOpen(true); }} disabled={blocking > 0 || locked} className={`pill-btn shrink-0 whitespace-nowrap ${blocking ? "cursor-not-allowed bg-[#c4cfdc] text-white" : "bg-[#1e61b9] text-white"}`}><Send size={16} className="mr-1.5" />Send for approval</button>
        </div>
      </header>
      {status ? <div className="bg-[#e8f5ee] px-5 py-2 text-sm text-[#0d3b2c]">{status}</div> : null}
      {saveBanner}
      {stateBanner}
      {sheets}
      {feedbackSheet}
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
