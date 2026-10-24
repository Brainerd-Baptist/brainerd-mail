"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Area, Field, ImageFields, Toggle } from "@/components/fields";
import { REGIONS, type Member } from "@/lib/serving";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0"));

export function RosterEditor({ initial, version }: { initial: Member[]; version: string }) {
  const [list, setList] = useState<Member[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const verRef = useRef(version);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const dirty = useMemo(() => JSON.stringify(list) !== saved, [list, saved]);
  const regions = useMemo(() => Array.from(new Set([...REGIONS, ...list.map((m) => m.region).filter(Boolean)])), [list]);

  const upd = (id: string, p: Partial<Member>) => setList((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const move = (id: string, dir: -1 | 1) => setList((l) => {
    const i = l.findIndex((m) => m.id === id);
    // swap with the neighbor in the same region
    let j = i + dir;
    while (j >= 0 && j < l.length && l[j].region !== l[i].region) j += dir;
    if (j < 0 || j >= l.length) return l;
    const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const remove = (id: string) => { setList((l) => l.filter((m) => m.id !== id)); if (open === id) setOpen(null); };
  const add = (region: string) => {
    const m: Member = { id: newId(), region, who: "", place: "", deployed: "", note: "", photo: "", hidden: false };
    setList((l) => { const last = l.map((x) => x.region).lastIndexOf(region); const c = [...l]; c.splice(last === -1 ? c.length : last + 1, 0, m); return c; });
    setOpen(m.id);
  };

  async function save() {
    setBusy(true); setMsg(""); setErr("");
    try {
      const r = await fetch("/api/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ members: list, version: verRef.current }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Could not save. Try again."); return; }
      if (j.version) verRef.current = j.version; setSaved(JSON.stringify(list)); setMsg("Saved. The public page updates within a minute.");
    } catch { setErr("Could not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  const grouped = regions.map((region) => ({ region, items: list.filter((m) => m.region === region) })).filter((g) => g.items.length || REGIONS.includes(g.region));

  return (
    <div className="min-h-full bg-mist pb-32">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <NavMenu />
          <h1 className="flex-1 truncate text-center font-serif text-lg font-semibold text-navy">Members serving globally</h1>
          <HelpButton />
          <a href="/serving" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-brand">View<ExternalLink size={14} /></a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 pt-6">
        <p className="text-[15px] text-muted">This list is the page at <b className="text-ink">mail.brainerdhq.app/serving</b>. The link never changes. Edit, then tap Save.</p>

        {grouped.map((g) => (
          <section key={g.region} className="space-y-3">
            <h2 className="label !mb-0 flex items-center justify-between"><span>{g.region}</span><button type="button" onClick={() => add(g.region)} className="flex items-center gap-1 text-brand normal-case tracking-normal"><Plus size={16} />Add person</button></h2>
            {g.items.length === 0 ? <p className="rounded-lg border border-dashed border-line bg-surface p-4 text-sm text-muted">No one listed here yet.</p> : null}
            {g.items.map((m) => {
              const isOpen = open === m.id;
              return (
                <article key={m.id} className={`overflow-hidden rounded-lg border bg-surface ${m.hidden ? "border-dashed opacity-70" : "border-line"}`}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : m.id)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={isOpen}>
                    {m.photo ? <img src={m.photo} alt="" className="h-14 w-[74px] flex-none rounded-md object-cover" /> : <span className="flex h-14 w-[74px] flex-none items-center justify-center rounded-md bg-mist text-xs text-muted">No photo</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{m.who || "New person"}</span>
                      <span className="block truncate text-sm text-muted">{[m.place, m.deployed && `Deployed ${m.deployed}`].filter(Boolean).join(" · ") || "Tap to fill in"}{m.hidden ? " · Hidden" : ""}</span>
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="space-y-4 border-t border-line p-4">
                      <ImageFields label="Photo (shown as a 4:3 picture)" aspect={4 / 3} value={{ url: m.photo, alt: m.who }} onChange={(v) => upd(m.id, { photo: v.url })} />
                      <Field label="Names" value={m.who} onChange={(v) => upd(m.id, { who: v })} placeholder="Jim, Mandy, Micah & Ellie" hint="First names only is best." />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Where" value={m.place} onChange={(v) => upd(m.id, { place: v })} placeholder="Peru" />
                        <Field label="Deployed" value={m.deployed} onChange={(v) => upd(m.id, { deployed: v })} placeholder="November 2014" />
                      </div>
                      <Area label="How to pray, or what they do" value={m.note} rows={3} onChange={(v) => upd(m.id, { note: v })} />
                      <label className="block">
                        <span className="label">Region</span>
                        <select className="field" value={m.region} onChange={(e) => upd(m.id, { region: e.target.value })}>{regions.map((r) => <option key={r}>{r}</option>)}</select>
                      </label>
                      <Toggle label="Show on the public page" checked={!m.hidden} onChange={(v) => upd(m.id, { hidden: !v })} />
                      <div className="flex items-center gap-2 border-t border-line pt-3">
                        <button type="button" onClick={() => move(m.id, -1)} className="pill-btn border border-line px-3 text-ink" aria-label="Move up"><ArrowUp size={16} /></button>
                        <button type="button" onClick={() => move(m.id, 1)} className="pill-btn border border-line px-3 text-ink" aria-label="Move down"><ArrowDown size={16} /></button>
                        <span className="flex-1" />
                        <button type="button" onClick={() => { if (window.confirm(`Remove ${m.who || "this person"} from the list?`)) remove(m.id); }} className="pill-btn px-3 text-[#b3261e]"><Trash2 size={16} className="mr-1" />Remove</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <span className={`min-w-0 flex-1 text-sm ${err ? "text-[#b3261e]" : "text-muted"}`} role="status">{err || msg || (dirty ? "You have unsaved changes." : "Everything is saved.")}</span>
          <button type="button" onClick={save} disabled={busy || !dirty} className="pill-btn bg-brand px-6 text-white disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
