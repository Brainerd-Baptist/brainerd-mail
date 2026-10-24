"use client";

import { useEffect, useState } from "react";
import { OctagonX, ShieldCheck, Users, Zap } from "lucide-react";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { HeaderBrand } from "@/components/HeaderBrand";
import { HqLink } from "@/components/HqLink";
import { Card, Chip } from "@/components/charts";

type Mode = "off" | "staff" | "live";
type S = { send_mode: Mode; safe_list: string[]; live_cap: number; auto_send: boolean; updated_at: string | null };
type Log = { at: string; who: string; detail: Record<string, any> };

const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";
const MODES: { key: Mode; title: string; body: string; icon: typeof Zap }[] = [
  { key: "off", title: "Off", body: "Nothing real can be sent. Test sends to yourself still work. This is where Mail stays during beta.", icon: OctagonX },
  { key: "staff", title: "Staff only", body: "Real sends go only to the safe list below, even if an email is aimed at a whole ministry. The audience is never looked up.", icon: ShieldCheck },
  { key: "live", title: "Live", body: "Real sends go to the chosen audience, up to the cap below. Owner only.", icon: Zap },
];

function describeChange(d: Record<string, any>) {
  const out: string[] = [];
  if (d.send_mode) out.push(`mode ${d.send_mode[0]} → ${d.send_mode[1]}`);
  if (d.safe_list) out.push(`safe list ${d.safe_list[0]} → ${d.safe_list[1]} people`);
  if (d.live_cap) out.push(`cap ${d.live_cap[0]} → ${d.live_cap[1]}`);
  if (d.auto_send) out.push(`automatic sending ${d.auto_send[1] ? "on" : "off"}`);
  return out.join(", ") || "changed";
}

export function SendingPanel() {
  const [s, setS] = useState<S | null>(null);
  const [canChange, setCan] = useState(false);
  const [by, setBy] = useState<string | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [safe, setSafe] = useState("");
  const [cap, setCap] = useState("25");
  const [typed, setTyped] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);

  async function load() {
    setErr(null);
    try {
      const r = await fetch("/api/sending", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load.");
      setS(j.settings); setCan(!!j.canChange); setBy(j.updatedBy); setLog(j.log ?? []);
      setSafe((j.settings.safe_list as string[]).join("\n")); setCap(String(j.settings.live_cap));
    } catch (e: any) { setErr(e.message || "Couldn't load."); }
  }
  useEffect(() => { load(); }, []);

  async function save(body: Record<string, unknown>, done: string) {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/sending", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't save.");
      setMsg(done); setLiveOpen(false); setTyped("");
      await load();
    } catch (e: any) { setErr(e.message || "Couldn't save."); }
    setSaving(false);
  }

  const mode = s?.send_mode ?? "off";
  const banner = mode === "off" ? { c: "bg-line/40 text-muted", t: "Sending is OFF. Nothing real can go out." } : mode === "staff" ? { c: "bg-[#fdf1d8] text-[#7a4a05]", t: `Staff-only. Real sends reach only the ${s?.safe_list.length ?? 0} on the safe list.` } : { c: "bg-[#fbe6e8] text-[#8a1020]", t: `LIVE. Real sends can reach audiences, up to ${s?.live_cap} people per send.` };

  return (
    <div className="min-h-full bg-mist pb-20">
      <header className="sticky top-0 z-10 border-b border-brand/15 bg-surface/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3"><NavMenu /><HeaderBrand label="Mail" /><span className="flex-1" /><HelpButton /><HqLink /></div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        {err ? <p role="alert" className="rounded-lg bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}
        {msg ? <p role="status" className="rounded-lg bg-[#e3f4ea] px-4 py-3 text-sm text-[#0d5a37]">{msg}</p> : null}
        {!s ? <div className="h-40 animate-pulse rounded-lg border border-line bg-surface" /> : (
          <>
            <div className={`flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 ${banner.c}`}>
              <span className="min-w-0 flex-1 text-sm font-medium">{banner.t}</span>
              {mode !== "off" ? <button disabled={saving} onClick={() => save({ send_mode: "off" }, "Sending is off.")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ad0b1c] px-5 text-sm font-semibold text-white disabled:opacity-60"><OctagonX size={18} />Stop all sending</button> : null}
            </div>
            {!canChange ? <p className="text-[13px] text-muted">You can look at these settings and press Stop. Only the owner can turn sending on or change the rules.</p> : null}

            <Card title="Sending mode" note="Beta stays on Off or Staff only. Live is for later, after the safe-list tests pass.">
              <div role="radiogroup" aria-label="Sending mode" className="space-y-2">
                {MODES.map((m) => {
                  const on = mode === m.key; const Icon = m.icon;
                  const disabled = !canChange && m.key !== "off";
                  return (
                    <button key={m.key} type="button" role="radio" aria-checked={on} disabled={disabled || saving} onClick={() => { if (on) return; if (m.key === "live") setLiveOpen(true); else save({ send_mode: m.key }, `Mode is now ${m.title}.`); }}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left disabled:opacity-50 ${on ? "border-brand bg-mist" : "border-line bg-surface"}`}>
                      <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-brand bg-brand shadow-[inset_0_0_0_3px_#fff]" : "border-line"}`} />
                      <span className="min-w-0"><span className="flex items-center gap-2 text-sm font-medium text-ink"><Icon size={16} className="text-muted" />{m.title}</span><span className="block text-sm text-muted">{m.body}</span></span>
                    </button>
                  );
                })}
              </div>
              {liveOpen && canChange ? (
                <div className="mt-3 rounded-lg border border-[#ad0b1c]/40 bg-[#fff7f8] p-3">
                  <p className="text-[14px] text-ink">Live lets Mail send to real people. Type <b>SEND LIVE</b> to confirm.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type SEND LIVE" autoCapitalize="characters" className="h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-[16px]" placeholder="SEND LIVE" />
                    <button disabled={typed !== "SEND LIVE" || saving} onClick={() => save({ send_mode: "live", confirm: typed }, "Mode is now Live.")} className="h-11 rounded-full bg-[#ad0b1c] px-5 text-sm font-semibold text-white disabled:opacity-40">Go live</button>
                    <button onClick={() => { setLiveOpen(false); setTyped(""); }} className="h-11 rounded-full px-4 text-sm font-semibold text-muted">Cancel</button>
                  </div>
                </div>
              ) : null}
            </Card>

            <Card title="Safe list" right={<Chip tone="blue">{s.safe_list.length} {s.safe_list.length === 1 ? "person" : "people"}</Chip>} note="In Staff-only mode, real sends go to these addresses and no one else. One per line.">
              <textarea value={safe} onChange={(e) => setSafe(e.target.value)} disabled={!canChange} rows={4} aria-label="Safe list, one email per line" className="w-full rounded-lg border border-line p-3 text-[16px] disabled:bg-[#f6f8fb]" />
              {canChange ? <button disabled={saving} onClick={() => save({ safe_list: safe.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean) }, "Safe list saved.")} className="mt-2 h-11 rounded-full bg-navy px-5 text-sm font-semibold text-white disabled:opacity-60"><Users size={16} className="mr-2 inline" />Save safe list</button> : null}
            </Card>

            <Card title="Limits" note="A send over the cap is refused, whatever the mode. Raise it on purpose, not by accident.">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block"><span className="label">Most people per send</span>
                  <input value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} disabled={!canChange} inputMode="numeric" className="h-11 w-32 rounded-lg border border-line px-3 text-[16px] disabled:bg-[#f6f8fb]" /></label>
                {canChange ? <button disabled={saving} onClick={() => save({ live_cap: Number(cap) }, "Cap saved.")} className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-white disabled:opacity-60">Save cap</button> : null}
              </div>
              <label className="mt-4 flex items-start gap-3">
                <input type="checkbox" checked={s.auto_send} disabled={!canChange || saving} onChange={(e) => save({ auto_send: e.target.checked }, e.target.checked ? "Scheduled emails may now send themselves." : "Scheduled emails will wait for a person to send.")} className="mt-1 h-5 w-5" />
                <span><span className="block text-sm font-medium text-ink">Let scheduled emails send themselves</span><span className="block text-sm text-muted">Off means a scheduled email waits until a person presses send. Keep this off during beta.</span></span>
              </label>
            </Card>

            <Card title="Recent changes">
              {log.length === 0 ? <p className="text-[14px] text-muted">No changes yet.</p> : (
                <ul className="divide-y divide-line">
                  {log.map((l, i) => <li key={i} className="py-2 text-[14px]"><span className="font-medium text-ink">{l.who}</span> <span className="text-muted">{describeChange(l.detail)}</span><span className="block text-[12px] text-muted">{stamp(l.at)}</span></li>)}
                </ul>
              )}
              {by && s.updated_at ? <p className="mt-2 text-[12px] text-muted">Last changed by {by}, {stamp(s.updated_at)}.</p> : null}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
