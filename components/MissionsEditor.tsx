"use client";
import { useMemo, useState } from "react";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { ChevronDown, Copy, ExternalLink, Eye, EyeOff, Plus, Search, Trash2 } from "lucide-react";
import { Area, Field, Segmented, Toggle } from "@/components/fields";
import { GEO_LIST, LEVEL_COLOR, type Country, type Level, type LevelInfo } from "@/lib/missions";

type Filter = "all" | "1" | "2" | "3" | "private";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function CountryCard({ c, isNew, canEdit, levels, onSaved, onRemoved, onCancel }: {
  c: Country; isNew?: boolean; canEdit: boolean; levels: LevelInfo[];
  onSaved: (c: Country) => void; onRemoved: (iso2: string) => void; onCancel?: () => void;
}) {
  const [open, setOpen] = useState(!!isNew);
  const [d, setD] = useState<Country>(c);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = isNew || !same({ ...d, updatedAt: 0 }, { ...c, updatedAt: 0 });
  const set = (p: Partial<Country>) => setD((x) => ({ ...x, ...p }));
  const lname = (l: Level) => levels.find((x) => x.level === l)?.label ?? `Level ${l}`;

  async function save() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/missions/countries/${c.iso2}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, version: isNew ? undefined : c.updatedAt }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Could not save. Try again."); return; }
      onSaved(j.country as Country); setD(j.country as Country);
      if (isNew) setOpen(false);
    } catch { setErr("Could not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Remove ${c.name} from the map? It disappears from the website and from future emails.`)) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/missions/countries/${c.iso2}`, { method: "DELETE" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || "Could not remove."); return; }
      onRemoved(c.iso2);
    } catch { setErr("Could not remove. Check your connection."); }
    finally { setBusy(false); }
  }

  return (
    <article className={`overflow-hidden rounded-xl border bg-white ${c.isPublic ? "border-line" : "border-dashed border-[#c4cfdc]"}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left">
        <span className="h-3.5 w-3.5 flex-none rounded-full" style={{ background: LEVEL_COLOR[d.level] }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{c.name}{isNew ? " (new)" : ""}</span>
          <span className="block truncate text-sm text-muted">{lname(c.level)}{c.since ? ` · since ${c.since}` : ""}{!c.isPublic ? " · Private" : !c.showPeopleGroup && c.peopleGroup ? " · Group names private" : ""}{dirty && !isNew ? " · Unsaved" : ""}</span>
        </span>
        {!c.isPublic ? <EyeOff size={18} className="flex-none text-muted" aria-label="Not shown publicly" /> : null}
        <ChevronDown size={18} className={`flex-none text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <fieldset disabled={!canEdit || busy} className="min-w-0 space-y-4 border-t border-line p-4">
          <Segmented label="Engagement level" value={String(d.level) as "1" | "2" | "3"} options={levels.map((l) => ({ value: String(l.level) as "1" | "2" | "3", label: l.label }))} onChange={(v) => set({ level: Number(v) as Level })} />
          <Field label="Country name" value={d.name} onChange={(v) => set({ name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Engaged since" value={d.since} onChange={(v) => set({ since: v })} placeholder="2013" />
            <Field label="Primary religion" value={d.religion} onChange={(v) => set({ religion: v })} placeholder="Islam" />
          </div>
          <Field label="Engaged people group" value={d.peopleGroup} onChange={(v) => set({ peopleGroup: v })} hint="Separate several with commas." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unreached people groups" value={d.unreachedGroups} onChange={(v) => set({ unreachedGroups: v })} placeholder="37" />
            <Field label="Unreached population" value={d.unreachedPop} onChange={(v) => set({ unreachedPop: v })} placeholder="41.4 Million" />
          </div>
          <div className="rounded-xl bg-mist p-3">
            <Toggle label="Show on the public map and in emails" checked={d.isPublic} onChange={(v) => set({ isPublic: v })} />
            <p className="pb-1 text-xs text-muted">Turn this off to keep the country in your list, but off the website and out of every email.</p>
            <div className={d.isPublic ? "" : "opacity-50"}>
              <Toggle label="Show people group names publicly" checked={d.isPublic && d.showPeopleGroup} onChange={(v) => d.isPublic && set({ showPeopleGroup: v })} />
              <p className="text-xs text-muted">Off keeps the names private. Everything else about the country still shows.</p>
            </div>
          </div>
          {err ? <p className="text-sm font-semibold text-[#b3261e]" role="alert">{err}</p> : null}
          {canEdit ? (
            <div className="flex items-center gap-2 border-t border-line pt-3">
              {isNew ? <button type="button" onClick={onCancel} className="pill-btn border border-line text-ink">Cancel</button> : <button type="button" onClick={remove} className="pill-btn px-3 text-[#b3261e]"><Trash2 size={16} className="mr-1" />Remove</button>}
              <span className="flex-1" />
              {!isNew && dirty ? <button type="button" onClick={() => setD(c)} className="pill-btn border border-line text-ink">Undo</button> : null}
              <button type="button" onClick={save} disabled={!dirty || busy} className="pill-btn bg-brand px-6 text-white disabled:opacity-40">{busy ? "Saving…" : isNew ? "Add to the map" : "Save"}</button>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </article>
  );
}

export function MissionsEditor({ initialCountries, initialLevels, canEdit }: { initialCountries: Country[]; initialLevels: LevelInfo[]; canEdit: boolean }) {
  const [list, setList] = useState<Country[]>(initialCountries);
  const [levels, setLevels] = useState<LevelInfo[]>(initialLevels);
  const [lvDraft, setLvDraft] = useState<LevelInfo[]>(initialLevels);
  const [lvBusy, setLvBusy] = useState(false);
  const [lvMsg, setLvMsg] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [draftNew, setDraftNew] = useState<Country | null>(null);
  const [stamp, setStamp] = useState(() => Date.now());
  const [copied, setCopied] = useState("");

  const bump = () => setStamp(Date.now());
  const counts = useMemo(() => {
    const pub = list.filter((c) => c.isPublic);
    return { all: list.length, pub: pub.length, priv: list.length - pub.length, 1: pub.filter((c) => c.level === 1).length, 2: pub.filter((c) => c.level === 2).length, 3: pub.filter((c) => c.level === 3).length };
  }, [list]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter((c) => (filter === "all" || (filter === "private" ? !c.isPublic : String(c.level) === filter)) && (!t || c.name.toLowerCase().includes(t))).sort((a, b) => a.name.localeCompare(b.name));
  }, [list, filter, q]);
  const available = useMemo(() => {
    const have = new Set(list.map((c) => c.iso2));
    const t = pick.trim().toLowerCase();
    return GEO_LIST.filter((g) => !have.has(g.id) && (!t || g.name.toLowerCase().includes(t))).slice(0, 8);
  }, [list, pick]);
  const lvDirty = !same(lvDraft, levels);

  const upsert = (c: Country) => { setList((l) => (l.some((x) => x.iso2 === c.iso2) ? l.map((x) => (x.iso2 === c.iso2 ? c : x)) : [...l, c])); setDraftNew(null); bump(); };
  const drop = (iso2: string) => { setList((l) => l.filter((x) => x.iso2 !== iso2)); bump(); };

  async function saveLevels() {
    setLvBusy(true); setLvMsg("");
    try {
      const r = await fetch("/api/missions/levels", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ levels: lvDraft }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setLvMsg(j.error || "Could not save."); return; }
      setLevels(j.levels); setLvDraft(j.levels); setLvMsg("Saved. The public map shows these within seconds.");
    } catch { setLvMsg("Could not save. Check your connection."); }
    finally { setLvBusy(false); }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://mail.brainerdhq.app";
  const embedSnippet = `<iframe id="bbc-missions-map" src="${origin}/embed/missions-map" title="Where Brainerd is engaged in missions" loading="lazy" style="width:100%;border:0;min-height:560px"></iframe>\n<script>addEventListener("message",function(e){var d=e.data;if(d&&d.source==="brainerd-missions-map"){document.getElementById("bbc-missions-map").style.height=d.height+"px"}})</script>`;
  const copy = async (what: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { setCopied("failed"); } };

  const chips: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: counts.all },
    ...levels.map((l) => ({ id: String(l.level) as Filter, label: l.label, n: counts[l.level] })),
    { id: "private", label: "Private", n: counts.priv },
  ];

  return (
    <div className="min-h-full bg-mist pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <NavMenu />
          <h1 className="flex-1 truncate text-center font-serif text-lg font-semibold text-navy">Missions map</h1>
          <HelpButton />
          <a href="/embed/missions-map?standalone=1" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-brand">View<ExternalLink size={14} /></a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6">
        {!canEdit ? <p className="rounded-xl border border-line bg-white p-3 text-sm text-muted">Your role can look at the Missions map but not change it. Ask the Owner or an Admin if you need to edit.</p> : null}
        <p className="text-[15px] text-muted">This is the map on the website’s missions page and in missions emails. Change a country and tap Save: the website updates within seconds.</p>

        <section aria-label="Preview" className="overflow-hidden rounded-xl border border-line bg-white">
          <img src={`/api/public/missions-map.png?t=${stamp}`} alt="Preview of the public world map" className="block w-full" />
          <p className="px-4 py-3 text-sm text-muted"><b className="text-ink">{counts.pub}</b> countries shown publicly{counts.priv ? <> · <b className="text-ink">{counts.priv}</b> private</> : null}. This is the picture emails use.</p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="label !mb-0">Countries</h2>
            {canEdit ? <button type="button" onClick={() => { setAdding(!adding); setPick(""); }} className="flex items-center gap-1 text-sm font-semibold text-brand"><Plus size={16} />Add a country</button> : null}
          </div>

          {adding && canEdit ? (
            <div className="space-y-2 rounded-xl border border-line bg-white p-3">
              <label className="block"><span className="label">Find a country</span><input autoFocus className="field" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Start typing, for example Kenya" /></label>
              <ul>{available.map((g) => (
                <li key={g.id}><button type="button" onClick={() => { setDraftNew({ iso2: g.id, name: g.name, level: 1, since: "", religion: "", peopleGroup: "", unreachedGroups: "", unreachedPop: "", isPublic: true, showPeopleGroup: true }); setAdding(false); }} className="flex min-h-12 w-full items-center rounded-lg px-3 text-left text-[16px] text-ink active:bg-mist">{g.name}</button></li>
              ))}</ul>
              {available.length === 0 ? <p className="px-1 text-sm text-muted">No match. Every country on the map is already in your list, or the name is spelled differently.</p> : null}
            </div>
          ) : null}

          {draftNew ? <CountryCard key={draftNew.iso2} c={draftNew} isNew canEdit={canEdit} levels={levels} onSaved={upsert} onRemoved={() => {}} onCancel={() => setDraftNew(null)} /> : null}

          <label className="relative block">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field !pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your countries" aria-label="Search your countries" />
          </label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter the list">
            {chips.map((c) => (
              <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)} className={`flex-none rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filter === c.id ? "border-navy bg-navy text-white" : "border-line bg-white text-ink"}`}>{c.label} <span className={filter === c.id ? "text-white/70" : "text-muted"}>{c.n}</span></button>
            ))}
          </div>

          {shown.map((c) => <CountryCard key={c.iso2} c={c} canEdit={canEdit} levels={levels} onSaved={upsert} onRemoved={drop} />)}
          {shown.length === 0 ? <p className="rounded-xl border border-dashed border-line bg-white p-4 text-sm text-muted">{list.length ? "No countries match." : "No countries yet. Tap Add a country."}</p> : null}
        </section>

        <section className="space-y-3 rounded-xl border border-line bg-white p-4">
          <h2 className="label !mb-0">What the levels mean</h2>
          <p className="text-sm text-muted">Shown as the key on the public map. Use words a visitor would understand. Leave the description empty to show only the name.</p>
          <fieldset disabled={!canEdit || lvBusy} className="min-w-0 space-y-4">
            {lvDraft.map((l) => (
              <div key={l.level} className="space-y-2 rounded-xl bg-mist p-3">
                <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full" style={{ background: LEVEL_COLOR[l.level] }} /><span className="label !mb-0">Level {l.level}</span></div>
                <Field label="Name" value={l.label} onChange={(v) => setLvDraft((d) => d.map((x) => (x.level === l.level ? { ...x, label: v } : x)))} />
                <Area label="Description" rows={2} value={l.blurb} onChange={(v) => setLvDraft((d) => d.map((x) => (x.level === l.level ? { ...x, blurb: v } : x)))} />
              </div>
            ))}
          </fieldset>
          {canEdit ? <div className="flex items-center gap-3"><span className="flex-1 text-sm text-muted" role="status">{lvMsg}</span><button type="button" onClick={saveLevels} disabled={!lvDirty || lvBusy} className="pill-btn bg-brand px-6 text-white disabled:opacity-40">{lvBusy ? "Saving…" : "Save"}</button></div> : null}
        </section>

        <details className="rounded-xl border border-line bg-white p-4">
          <summary className="cursor-pointer text-[15px] font-semibold text-ink">For the website team</summary>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <p>The missions page can show this map in a frame. It always shows the latest saved version, and it only contains what is marked public.</p>
            <button type="button" onClick={() => copy("embed", embedSnippet)} className="pill-btn border border-line text-ink"><Copy size={16} className="mr-1" />{copied === "embed" ? "Copied" : "Copy the embed code"}</button>
            <button type="button" onClick={() => copy("json", `${origin}/api/public/missions`)} className="pill-btn ml-2 border border-line text-ink"><Copy size={16} className="mr-1" />{copied === "json" ? "Copied" : "Copy the data address"}</button>
            <p className="flex items-center gap-1"><Eye size={14} />The data address returns the same public list as JSON, for a native version of the map.</p>
          </div>
        </details>
      </main>
    </div>
  );
}
