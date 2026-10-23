"use client";

import { when } from "@/lib/approval";
import { OCTOBER } from "@/lib/templates/blank";
import { STARTERS } from "@/lib/templates/starters";
import { useMemo, useState } from "react";
import Link from "next/link";
import { HeaderBrand } from "@/components/HeaderBrand";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { useRouter } from "next/navigation";
import { CalendarDays, Copy, Globe, LogOut, Plus, Search, Trash2, X } from "lucide-react";
import { PALETTES, paletteFor, swatch } from "@/lib/ministries";
import { canBuildIn, type Perm } from "@/lib/roles-ui";
import { ago } from "@/lib/time";

export type Item = { id: string; ministry: string; title: string; subject: string | null; status: string; updated_at: string; scheduled_at?: string | null; expedited?: boolean };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-line/60 text-ink" },
  pending_approval: { label: "Waiting for approval", cls: "bg-[#fff3d6] text-[#7a4a00]" },
  approved: { label: "Approved", cls: "bg-[#e3f3ea] text-[#17603c]" },
  scheduled: { label: "Scheduled", cls: "bg-[#e3effc] text-[#1e4f99]" },
  sending: { label: "Sending", cls: "bg-[#e3effc] text-[#1e4f99]" },
  sent: { label: "Sent", cls: "bg-[#e3f3ea] text-[#17603c]" },
  cancelled: { label: "Cancelled", cls: "bg-[#fbe9eb] text-[#8a1020]" },
};
const canDelete = (s: string) => s === "draft" || s === "cancelled";

export function EmailList({ initial, perm }: { initial: Item[]; perm: Perm }) {
  const buildable = Object.keys(PALETTES).filter((k) => canBuildIn(perm, k));
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [ministry, setMinistry] = useState(buildable.includes("church-wide") ? "church-wide" : buildable[0] ?? "church-wide");
  const [start, setStart] = useState<"blank" | "starter" | "october" | "homegoing">("blank");

  const ministries = useMemo(() => Array.from(new Set(items.map((i) => i.ministry))), [items]);
  const shown = items.filter((i) => (filter === "all" || i.ministry === filter) && (!q.trim() || `${i.title} ${i.subject ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));

  async function call(url: string, init: RequestInit) {
    const r = await fetch(url, init);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
    return j;
  }

  async function create(body: Record<string, unknown>, key: string) {
    setBusy(key); setErr("");
    try {
      const j = await call("/api/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      router.push(`/editor?e=${j.id}`);
    } catch (e: any) { setErr(e.message); setBusy(null); }
  }

  async function remove(it: Item) {
    if (!confirm(`Delete “${it.title}”? This can’t be undone.`)) return;
    setBusy(it.id); setErr("");
    try {
      await call(`/api/emails/${it.id}`, { method: "DELETE" });
      setItems((l) => l.filter((x) => x.id !== it.id));
    } catch (e: any) { setErr(e.message); }
    setBusy(null);
  }

  return (
    <div className="min-h-full bg-mist pb-16">
      <header className="sticky top-0 z-10 border-b border-brand/15 bg-surface/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <NavMenu />
          <HeaderBrand label="Mail" />
          <span className="flex-1" />
          <HelpButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold text-navy">Emails</h1>
          {buildable.length ? <button onClick={() => setCreating(true)} className="pill-btn bg-brand text-white"><Plus size={16} className="mr-1.5" />New email</button> : null}
        </div>

        {items.length > 4 ? (
          <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-4">
            <Search size={16} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or subject" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          </label>
        ) : null}

        {ministries.length > 1 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {["all", ...ministries].map((m) => (
              <button key={m} onClick={() => setFilter(m)} className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === m ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink"}`}>{m === "all" ? "All" : paletteFor(m).label}</button>
            ))}
          </div>
        ) : null}

        {err ? <p role="alert" className="rounded-xl bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-[15px] text-muted">
            {items.length === 0 ? (buildable.length ? "No emails yet. Tap New email to start one." : "No emails yet.") : "Nothing matches. Clear the search or filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((it) => {
              const p = paletteFor(it.ministry);
              const st = STATUS[it.status] ?? STATUS.draft;
              return (
                <li key={it.id} className={`flex items-stretch overflow-hidden rounded-xl border border-line bg-surface ${busy === it.id ? "opacity-60" : ""}`}>
                  <span className="w-1.5 shrink-0" style={{ background: swatch(p) }} />
                  <Link href={it.status === "pending_approval" ? `/review/${it.id}` : `/editor?e=${it.id}`} className="min-w-0 flex-1 p-4 active:bg-mist">
                    <span className="block truncate text-[16px] font-semibold text-ink">{it.title || "Untitled"}</span>
                    {it.subject ? <span className="mt-0.5 block truncate text-sm text-muted">{it.subject}</span> : null}
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="font-semibold" style={{ color: p.dark }}>{p.label}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
                      <span>{it.scheduled_at && ["pending_approval", "approved", "scheduled"].includes(it.status) ? `Goes out ${when(it.scheduled_at)}` : `Edited ${ago(it.updated_at)}`}</span>
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center pr-1">
                    {canBuildIn(perm, it.ministry) ? <button onClick={() => create({ fromId: it.id }, it.id)} disabled={!!busy} aria-label={`Duplicate ${it.title}`} title="Duplicate" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-black/5 lg:hover:text-ink disabled:opacity-40"><Copy size={18} /></button> : null}
                    {canDelete(it.status) && canBuildIn(perm, it.ministry) ? <button onClick={() => remove(it)} disabled={!!busy} aria-label={`Delete ${it.title}`} title="Delete" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-black/5 lg:hover:text-red-600 disabled:opacity-40"><Trash2 size={18} /></button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {creating ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => !busy && setCreating(false)}>
          <div className="w-full rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">New email</h2><button aria-label="Close" onClick={() => setCreating(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button></div>
            <label className="mb-4 block">
              <span className="label">Ministry</span>
              <select className="field" value={ministry} onChange={(e) => { setMinistry(e.target.value); if ((start === "october" && !OCTOBER[e.target.value]) || (start === "homegoing" && e.target.value !== "church-wide")) setStart("blank"); }}>
                {buildable.map((k) => <option key={k} value={k}>{PALETTES[k].label}</option>)}
              </select>
            </label>
            <fieldset className="mb-5 space-y-2">
              <legend className="label">Start from</legend>
              {([["blank", "A blank email", "A header and a text block."], ["starter", STARTERS[ministry]?.label ?? "A starter", STARTERS[ministry]?.blurb ?? "A ready-made layout to fill in."], ["october", OCTOBER[ministry]?.label ?? "October email", OCTOBER[ministry]?.blurb ?? ""], ["homegoing", "Homegoing announcement", "Announcing the passing of a church member: name, photo, visitation and service details."]] as const).map(([k, t, d]) => {
                const off = (k === "october" && !OCTOBER[ministry]) || (k === "homegoing" && ministry !== "church-wide");
                return (
                  <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${start === k ? "border-brand bg-mist" : "border-line"} ${off ? "opacity-40" : ""}`}>
                    <input type="radio" name="start" className="mt-1" checked={start === k} disabled={off} onChange={() => setStart(k)} />
                    <span><span className="block text-[15px] font-semibold text-ink">{t}</span><span className="block text-sm text-muted">{off ? (k === "homegoing" ? "Only for Church-Wide." : "Only for Missions and the BX.") : d}</span></span>
                  </label>
                );
              })}
            </fieldset>
            <button onClick={() => create({ ministry, start }, "new")} disabled={!!busy} className="pill-btn w-full bg-brand text-white disabled:opacity-60">{busy === "new" ? "Creating…" : "Create email"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
