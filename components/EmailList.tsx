"use client";

import { when } from "@/lib/approval";
import { OCTOBER } from "@/lib/templates/blank";
import { STARTERS } from "@/lib/templates/starters";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Globe, LogOut, Plus, Search, Trash2, X } from "lucide-react";
import { PALETTES, paletteFor } from "@/lib/ministries";
import { ago } from "@/lib/time";

export type Item = { id: string; ministry: string; title: string; subject: string | null; status: string; updated_at: string; scheduled_at?: string | null; expedited?: boolean };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-[#eef1f5] text-[#33445d]" },
  pending_approval: { label: "Waiting for approval", cls: "bg-[#fff3d6] text-[#7a4a00]" },
  approved: { label: "Approved", cls: "bg-[#e3f3ea] text-[#17603c]" },
  scheduled: { label: "Scheduled", cls: "bg-[#e3effc] text-[#1e4f99]" },
  sending: { label: "Sending", cls: "bg-[#e3effc] text-[#1e4f99]" },
  sent: { label: "Sent", cls: "bg-[#e3f3ea] text-[#17603c]" },
  cancelled: { label: "Cancelled", cls: "bg-[#fbe9eb] text-[#8a1020]" },
};
const canDelete = (s: string) => s === "draft" || s === "cancelled";

export function EmailList({ initial }: { initial: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [ministry, setMinistry] = useState("church-wide");
  const [start, setStart] = useState<"blank" | "starter" | "october">("blank");

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
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex items-center gap-3"><img src="/brand/brainerd-logo.png" alt="Brainerd Baptist Church" width={112} height={17} className="h-[17px] w-auto" /><span className="text-[15px] font-bold tracking-[0.16em] text-navy">MAIL</span></span>
          <span className="flex-1" />
          <Link href="/roster" className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-[#f4f8fd]"><Globe size={18} /><span className="hidden sm:inline">Serving list</span></Link>
          <form action="/auth/signout" method="post"><button className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-[#f4f8fd]" aria-label="Sign out"><LogOut size={18} /><span className="hidden sm:inline">Sign out</span></button></form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold text-navy">Emails</h1>
          <button onClick={() => setCreating(true)} className="pill-btn bg-[#1e61b9] text-white"><Plus size={16} className="mr-1.5" />New email</button>
        </div>

        {items.length > 4 ? (
          <label className="flex items-center gap-2 rounded-full border border-line bg-white px-4">
            <Search size={16} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or subject" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          </label>
        ) : null}

        {ministries.length > 1 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {["all", ...ministries].map((m) => (
              <button key={m} onClick={() => setFilter(m)} className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === m ? "border-navy bg-navy text-white" : "border-line bg-white text-ink"}`}>{m === "all" ? "All" : paletteFor(m).label}</button>
            ))}
          </div>
        ) : null}

        {err ? <p role="alert" className="rounded-xl bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-[15px] text-muted">
            {items.length === 0 ? "No emails yet. Tap New email to start one." : "Nothing matches. Clear the search or filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((it) => {
              const p = paletteFor(it.ministry);
              const st = STATUS[it.status] ?? STATUS.draft;
              return (
                <li key={it.id} className={`flex items-stretch overflow-hidden rounded-xl border border-line bg-white ${busy === it.id ? "opacity-60" : ""}`}>
                  <span className="w-1.5 shrink-0" style={{ background: p.button }} />
                  <Link href={it.status === "pending_approval" ? `/review/${it.id}` : `/editor?e=${it.id}`} className="min-w-0 flex-1 p-4 active:bg-[#f4f8fd]">
                    <span className="block truncate text-[16px] font-semibold text-ink">{it.title || "Untitled"}</span>
                    {it.subject ? <span className="mt-0.5 block truncate text-sm text-muted">{it.subject}</span> : null}
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="font-semibold" style={{ color: p.dark }}>{p.label}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
                      <span>{it.scheduled_at && ["pending_approval", "approved", "scheduled"].includes(it.status) ? `Goes out ${when(it.scheduled_at)}` : `Edited ${ago(it.updated_at)}`}</span>
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center pr-1">
                    <button onClick={() => create({ fromId: it.id }, it.id)} disabled={!!busy} aria-label={`Duplicate ${it.title}`} title="Duplicate" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-black/5 lg:hover:text-ink disabled:opacity-40"><Copy size={18} /></button>
                    {canDelete(it.status) ? <button onClick={() => remove(it)} disabled={!!busy} aria-label={`Delete ${it.title}`} title="Delete" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-black/5 lg:hover:text-[#c8102e] disabled:opacity-40"><Trash2 size={18} /></button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {creating ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => !busy && setCreating(false)}>
          <div className="w-full rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">New email</h2><button aria-label="Close" onClick={() => setCreating(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button></div>
            <label className="mb-4 block">
              <span className="label">Ministry</span>
              <select className="field" value={ministry} onChange={(e) => { setMinistry(e.target.value); if (start === "october" && !OCTOBER[e.target.value]) setStart("blank"); }}>
                {Object.values(PALETTES).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
            <fieldset className="mb-5 space-y-2">
              <legend className="label">Start from</legend>
              {([["blank", "A blank email", "A header and a text block."], ["starter", STARTERS[ministry]?.label ?? "A starter", STARTERS[ministry]?.blurb ?? "A ready-made layout to fill in."], ["october", OCTOBER[ministry]?.label ?? "October email", OCTOBER[ministry]?.blurb ?? ""]] as const).map(([k, t, d]) => {
                const off = k === "october" && !OCTOBER[ministry];
                return (
                  <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${start === k ? "border-brand bg-[#f4f8fd]" : "border-line"} ${off ? "opacity-40" : ""}`}>
                    <input type="radio" name="start" className="mt-1" checked={start === k} disabled={off} onChange={() => setStart(k)} />
                    <span><span className="block text-[15px] font-semibold text-ink">{t}</span><span className="block text-sm text-muted">{off ? "Only for Missions and the BX." : d}</span></span>
                  </label>
                );
              })}
            </fieldset>
            <button onClick={() => create({ ministry, start }, "new")} disabled={!!busy} className="pill-btn w-full bg-[#1e61b9] text-white disabled:opacity-60">{busy === "new" ? "Creating…" : "Create email"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
