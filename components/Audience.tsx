"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { HeaderBrand } from "@/components/HeaderBrand";
import { Card, Chip, num, etDate, downloadCsv } from "@/components/charts";

type Row = { ministry: string; label: string; list_id: string | null; list_name: string | null; expected: number | null; latest: { taken_at: string; total: number; email_ok: number } | null };
type CsList = { id: string; name: string; count: number | null };
type Person = { id: string; name: string; email: string };
type Excluded = Person & { reason: string; detail?: string };
type Check = { ministry: string; takenAt: string; total: number; mailCount: number; expected: number | null; excluded: Excluded[]; statusMix: Record<string, number>; prev: null | { takenAt: string; total: number; mailCount: number }; added: Person[]; removed: Person[]; changedEmailable: { id: string; name: string; now: string }[] };
const REASON: Record<string, string> = { no_email: "No email address", email_off: "Email turned off in ClearStream", duplicate: "Same address listed twice", mail_unsub: "Unsubscribed in Brainerd Mail" };

export function Audience() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [lists, setLists] = useState<CsList[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  async function load(withLists = false) {
    try {
      const r = await fetch(`/api/audience${withLists ? "?lists=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load.");
      setRows(j.ministries); setConfigured(!!j.configured);
      if (j.lists) setLists(j.lists);
      if (j.listsError) setErr(j.listsError);
    } catch (e: any) { setErr(e.message || "Couldn't load."); }
  }
  useEffect(() => { load(true); }, []);

  async function patch(ministry: string, body: Record<string, unknown>) {
    setErr(null);
    const r = await fetch("/api/audience", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ministry, ...body }) });
    const j = await r.json();
    if (!r.ok) setErr(j.error || "Couldn't save."); else await load();
  }
  async function check(ministry: string) {
    setBusy(ministry); setErr(null);
    try {
      const r = await fetch("/api/audience", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ministry }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Couldn't check.");
      setChecks((c) => ({ ...c, [ministry]: j.check })); setOpen(ministry); await load();
    } catch (e: any) { setErr(e.message || "Couldn't check."); }
    setBusy(null);
  }

  return (
    <div className="min-h-full bg-mist pb-20">
      <header className="sticky top-0 z-10 border-b border-brand/15 bg-surface/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3"><NavMenu /><HeaderBrand label="Audiences" /><span className="flex-1" /><HelpButton /></div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-5">
        <p className="text-[14px] leading-snug text-muted">Pick each ministry&apos;s ClearStream list, then Check. Mail reads the list (it never changes anything in ClearStream) and shows how many people it would actually email, and exactly who is left out and why.</p>
        {!configured ? <p className="rounded-lg bg-[#fdf1d8] px-4 py-3 text-sm text-[#7a4a05]">ClearStream isn&apos;t connected yet. The owner needs to add the ClearStream key to Mail&apos;s settings in Vercel. Until then, nothing can be checked.</p> : null}
        {err ? <p role="alert" className="rounded-lg bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}
        {!rows ? <div className="h-40 animate-pulse rounded-lg border border-line bg-surface" /> : rows.map((r) => {
          const c = checks[r.ministry];
          const gap = c && c.expected !== null ? c.mailCount - c.expected : null;
          return (
            <Card key={r.ministry} title={r.label} right={r.latest ? <span className="text-[12px] text-muted">Last check {etDate(r.latest.taken_at, true)}</span> : <Chip>Never checked</Chip>}>
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                <label className="block"><span className="label">ClearStream list</span>
                  <select value={r.list_id ?? ""} disabled={!lists} onChange={(e) => { const l = lists?.find((x) => x.id === e.target.value); if (l) patch(r.ministry, { list_id: l.id, list_name: l.name }); }} className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-[16px]">
                    <option value="">{lists ? "Choose a list…" : configured ? "Loading lists…" : "Not connected"}</option>
                    {r.list_id && !lists?.some((l) => l.id === r.list_id) ? <option value={r.list_id}>{r.list_name || r.list_id}</option> : null}
                    {(lists ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}{l.count !== null ? ` (${num(l.count)})` : ""}</option>)}
                  </select></label>
                <label className="block"><span className="label">People I expect</span>
                  <input defaultValue={r.expected ?? ""} key={`${r.ministry}-${r.expected}`} inputMode="numeric" disabled={!r.list_id} onBlur={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v !== String(r.expected ?? "")) patch(r.ministry, { expected: v === "" ? null : Number(v) }); }} className="h-11 w-full rounded-lg border border-line px-3 text-[16px]" placeholder="e.g. 200" /></label>
                <button disabled={!r.list_id || !configured || busy !== null} onClick={() => check(r.ministry)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-navy px-5 text-[15px] font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={busy === r.ministry ? "animate-spin" : ""} />{busy === r.ministry ? "Checking…" : "Check now"}</button>
              </div>

              {c && open === r.ministry ? (
                <div className="mt-4 space-y-4 border-t border-line pt-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-mist p-3"><div className="font-serif text-2xl font-semibold text-navy">{num(c.total)}</div><div className="text-[12px] text-muted">in ClearStream</div></div>
                    <div className="rounded-lg bg-mist p-3"><div className="font-serif text-2xl font-semibold text-navy">−{num(c.excluded.length)}</div><div className="text-[12px] text-muted">left out</div></div>
                    <div className="rounded-lg bg-[#e3f4ea] p-3"><div className="font-serif text-2xl font-semibold text-[#0d5a37]">{num(c.mailCount)}</div><div className="text-[12px] text-muted">Mail would email</div></div>
                  </div>
                  {gap === null ? <p className="text-[13px] text-muted">Type the number you expect above to compare it.</p>
                    : gap === 0 ? <p className="flex items-center gap-2 text-[14px] font-semibold text-[#0d5a37]"><CheckCircle2 size={18} />Matches the {num(c.expected!)} you expected.</p>
                    : <p className="flex items-start gap-2 text-[14px] font-semibold text-[#8a4b00]"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{num(Math.abs(gap))} {gap < 0 ? "fewer" : "more"} than the {num(c.expected!)} you expected. {gap < 0 ? "The list below shows who is left out." : "Someone may have been added in ClearStream."}</p>}

                  {c.excluded.length ? (
                    <div>
                      <div className="mb-1 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Left out, and why</h3>
                        <button onClick={() => downloadCsv(`${r.ministry}-left-out.csv`, ["Name", "Email", "Reason"], c.excluded.map((x) => [x.name, x.email, REASON[x.reason] + (x.detail ? ` (${x.detail})` : "")]))} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-brand"><Download size={14} />CSV</button></div>
                      <ul className="divide-y divide-line rounded-lg border border-line">
                        {c.excluded.map((x) => <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-[14px]"><span className="min-w-0"><b className="text-ink">{x.name}</b> <span className="break-all text-muted">{x.email}</span></span><Chip tone={x.reason === "mail_unsub" ? "amber" : "gray"}>{REASON[x.reason]}{x.detail ? ` · ${x.detail}` : ""}</Chip></li>)}
                      </ul>
                    </div>
                  ) : <p className="text-[14px] text-muted">Nobody is left out. Everyone on the list can be emailed.</p>}

                  {c.prev ? (
                    <div>
                      <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Since the last check ({etDate(c.prev.takenAt, true)})</h3>
                      {!c.added.length && !c.removed.length && !c.changedEmailable.length ? <p className="text-[14px] text-muted">No changes. {num(c.prev.total)} then, {num(c.total)} now.</p> : (
                        <ul className="space-y-1 text-[14px]">
                          {c.added.map((p) => <li key={"a" + p.id}><Chip tone="green">Added</Chip> <b className="text-ink">{p.name}</b> <span className="break-all text-muted">{p.email}</span></li>)}
                          {c.removed.map((p) => <li key={"r" + p.id}><Chip tone="red">Removed</Chip> <b className="text-ink">{p.name}</b> <span className="break-all text-muted">{p.email}</span></li>)}
                          {c.changedEmailable.map((p) => <li key={"c" + p.id}><Chip tone="amber">{p.now === "emailable" ? "Now emailable" : "No longer emailable"}</Chip> <b className="text-ink">{p.name}</b></li>)}
                        </ul>
                      )}
                    </div>
                  ) : <p className="text-[13px] text-muted">This is the first check. The next one will show who was added or removed since now.</p>}

                  <details className="text-[13px] text-muted"><summary className="cursor-pointer font-semibold">How ClearStream labels email status</summary>
                    <p className="mt-1">{Object.entries(c.statusMix).map(([k, v]) => `${k}: ${num(v)}`).join(" · ")}</p></details>
                  {c.added.length + c.removed.length > 0 || c.excluded.length ? (
                    <button onClick={() => downloadCsv(`${r.ministry}-changes.csv`, ["Type", "Name", "Email"], [...c.added.map((p) => ["Added", p.name, p.email]), ...c.removed.map((p) => ["Removed", p.name, p.email])])} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-brand"><Download size={14} />Changes CSV</button>
                  ) : null}
                </div>
              ) : r.latest ? <p className="mt-3 text-[13px] text-muted">Last check: {num(r.latest.total)} in ClearStream, {num(r.latest.email_ok)} Mail would email. Press Check now for the details.</p> : null}
            </Card>
          );
        })}
      </main>
    </div>
  );
}
