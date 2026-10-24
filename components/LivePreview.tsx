"use client";
// A full-window live preview of one email, meant to sit in its own browser tab
// beside the editor. Edits arrive instantly from the editor tab (same browser),
// and the saved copy is re-read every few seconds so it also follows edits made
// on another device.
import { useEffect, useMemo, useRef, useState } from "react";
import { renderEmail } from "@/lib/render";
import { CHURCH_ADDRESS, CONTACT_EMAIL } from "@/lib/church";
import type { EmailDoc } from "@/lib/blocks";

type View = "both" | "phone" | "desktop";

export function previewChannel(id: string) { return `brainerd-mail:preview:${id}`; }

function Frame({ html, width, height, phone }: { html: string; width: number; height: string; phone?: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const d = ref.current?.contentDocument;
    if (!d) return;
    const y = d.scrollingElement?.scrollTop ?? 0;
    d.open(); d.write(html); d.close();
    requestAnimationFrame(() => { if (d.scrollingElement) d.scrollingElement.scrollTop = y; });
  }, [html]);
  return (
    <div className={phone ? "overflow-hidden rounded-[40px] border-[10px] border-ink bg-surface shadow-lg" : "overflow-hidden rounded-lg border border-line bg-surface shadow-sm"} style={{ width, maxWidth: "100%" }}>
      <iframe ref={ref} title={phone ? "Phone preview" : "Desktop preview"} className="block w-full bg-surface" style={{ height }} />
    </div>
  );
}

export default function LivePreview({ emailId }: { emailId: string }) {
  const [doc, setDoc] = useState<EmailDoc | null>(null);
  const [view, setView] = useState<View>("both");
  const [dark, setDark] = useState(false);
  const [wide, setWide] = useState(true);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const fromEditor = useRef(false);
  const lastJson = useRef("");

  const take = (d: EmailDoc) => {
    const j = JSON.stringify(d);
    if (j === lastJson.current) return;
    lastJson.current = j; setDoc(d); setUpdated(new Date());
  };

  useEffect(() => {
    try { const v = localStorage.getItem("brainerd-mail:preview-view"); if (v === "both" || v === "phone" || v === "desktop") setView(v); } catch {}
    const onResize = () => setWide(window.innerWidth >= 1100);
    onResize(); window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/emails/${emailId}`, { cache: "no-store" });
        if (r.status === 404) { setErr("This email doesn’t exist any more."); return; }
        if (!r.ok) throw new Error();
        const j = await r.json();
        // The editor's unsaved edits are newer than the saved copy, so once they have arrived, keep them.
        if (alive && !fromEditor.current) { take(j.doc); setErr(""); }
      } catch { if (alive && !lastJson.current) setErr("Could not load this email. Check your connection."); }
    };
    load();
    const t = setInterval(load, 6000);
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(previewChannel(emailId));
      ch.onmessage = (e) => { if (e.data?.doc) { fromEditor.current = true; take(e.data.doc as EmailDoc); setErr(""); } };
      ch.postMessage({ hello: true });
    } catch {}
    return () => { alive = false; clearInterval(t); ch?.close(); };
  }, [emailId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://mail.brainerdhq.app";
  const html = useMemo(() => {
    if (!doc) return "";
    let h = renderEmail(doc, { mode: "email", wrap: (u: string) => u, webUrl: `${origin}/w/preview`, unsubscribeUrl: "#unsubscribe", preferencesUrl: "#preferences", address: CHURCH_ADDRESS, contactEmail: CONTACT_EMAIL, siteUrl: origin });
    h = h.replace("@media (prefers-color-scheme:dark)", dark ? "@media all" : "@media not all");
    return h.replace("</body>", `<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(a){e.preventDefault();var h=a.getAttribute("href")||"";if(/^https?:/i.test(h))window.open(h,"_blank","noopener");}});</script></body>`);
  }, [doc, dark, origin]);

  const pick = (v: View) => { setView(v); try { localStorage.setItem("brainerd-mail:preview-view", v); } catch {} };
  const showPhone = view === "phone" || (view === "both" && wide) || (view === "both" && !wide);
  const showDesktop = view === "desktop" || (view === "both" && wide);
  const btn = (on: boolean) => `flex h-9 items-center rounded-full px-4 text-sm font-semibold ${on ? "bg-surface text-navy shadow-sm" : "text-muted"}`;

  return (
    <div className="min-h-[100dvh] bg-mist">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="mr-auto">
          <h1 className="font-serif text-lg font-semibold text-navy">{doc?.subject || "Live preview"}</h1>
          <p className="text-xs text-muted">{updated ? `Updated ${updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Loading…"} · follows your edits automatically</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-line p-1">
          {wide ? <button onClick={() => pick("both")} className={btn(view === "both")}>Both</button> : null}
          <button onClick={() => pick("phone")} className={btn(view === "phone" || (view === "both" && !wide))}>Phone</button>
          <button onClick={() => pick("desktop")} className={btn(view === "desktop")}>Desktop</button>
        </div>
        <button onClick={() => setDark((d) => !d)} aria-pressed={dark} className={`flex h-11 items-center rounded-full border px-4 text-sm font-semibold ${dark ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink"}`}>{dark ? "Dark on" : "Dark mode"}</button>
      </header>
      {err ? <p className="m-4 rounded-lg bg-[#fdecec] px-4 py-3 text-sm text-[#8a1c1c]">{err}</p> : null}
      {doc ? (
        <main className="flex flex-wrap items-start justify-center gap-8 p-6">
          {showPhone ? <Frame phone html={html} width={400} height="min(820px, calc(100dvh - 130px))" /> : null}
          {showDesktop ? <div className="min-w-0 flex-1" style={{ maxWidth: 760 }}><Frame html={html} width={760} height="calc(100dvh - 130px)" /></div> : null}
        </main>
      ) : null}
    </div>
  );
}
