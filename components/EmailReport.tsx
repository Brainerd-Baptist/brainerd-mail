"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Download, ExternalLink, Info } from "lucide-react";
import { NavMenu } from "@/components/NavMenu";
import { HeaderBrand } from "@/components/HeaderBrand";
import { HqLink } from "@/components/HqLink";
import { HelpButton } from "@/components/HelpButton";
import { EmailInsights } from "@/components/EmailInsights";
import { C, Card, Chip, Funnel, HBars, Split, Tile, VBars, downloadCsv, etDate, hourName, num, pct } from "@/components/charts";
import type { EmailReport as Report } from "@/lib/analytics";

// The report for one email: who it reached, what they did, and which parts of the email got tapped.
export function EmailReport({ id, people }: { id: string; people: boolean }) {
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [bots, setBots] = useState(false);
  const [device, setDevice] = useState<"all" | "phone" | "desktop" | "tablet">("all");
  const [channel, setChannel] = useState<"all" | "email" | "text">("all");
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState<"all" | "clicked" | "opened" | "quiet" | "problem">("all");
  const [shown, setShown] = useState(25);
  const [open, setOpen] = useState<string | null>(null);
  const [openLink, setOpenLink] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true); setErr("");
    const q = new URLSearchParams({ kind: "all", device, channel }); if (bots) q.set("bots", "1");
    fetch(`/api/analytics/email/${id}?${q}`, { signal: ac.signal }).then(async (x) => {
      const j = await x.json().catch(() => ({}));
      if (!x.ok) throw new Error(x.status === 404 ? "We couldn't find a report for this email." : j.error || "Couldn't load this report.");
      setR(j as Report);
    }).catch((e) => { if (e?.name !== "AbortError") setErr(e.message || "Couldn't load this report."); }).finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [id, bots, device, channel]);

  const people_ = useMemo(() => {
    if (!r?.recipients) return [];
    return r.recipients.filter((p) => who === "all" ? true : who === "clicked" ? p.clicks > 0 : who === "opened" ? p.opened : who === "quiet" ? !p.opened && p.clicks === 0 && (p.status === "sent" || p.status === "delivered") : ["bounced", "complained", "failed"].includes(p.status));
  }, [r, who]);

  const maxClicks = r ? Math.max(1, ...r.links.map((l) => l.clicks)) : 1;
  const seg = <T extends string>(cur: T, set: (v: T) => void, opts: [T, string][], label: string) => (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-full border border-line bg-surface text-[13px] font-medium">
      {opts.map(([v, l]) => <button key={v} onClick={() => set(v)} aria-pressed={cur === v} className={`min-h-9 px-3 ${cur === v ? "bg-navy text-white" : "text-ink hover:bg-mist"}`}>{l}</button>)}
    </div>
  );

  return (
    <div className="min-h-full bg-mist pb-20">
      <header className="sticky top-0 z-10 border-b border-brand/15 bg-surface/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3"><NavMenu /><HeaderBrand label="Mail" /><span className="flex-1" /><HelpButton /><HqLink /></div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-5">
        <Link href="/analytics" className="inline-flex min-h-9 items-center gap-1.5 text-[14px] font-medium text-brand"><ArrowLeft size={16} />All analytics</Link>
        {err ? <p role="alert" className="rounded-lg bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}
        {loading && !r ? <div className="h-40 animate-pulse rounded-lg border border-line bg-surface" /> : null}

        {r ? (
          <div className={`space-y-5 ${loading ? "opacity-60 transition" : "transition"}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2"><Chip tone="blue">{r.email.ministryLabel}</Chip><Chip>{r.email.status}</Chip>{r.sends.some((s) => s.kind === "test") ? <Chip tone="amber">includes test sends</Chip> : null}</div>
              <h1 className="mt-2 font-serif text-2xl leading-tight text-ink">{r.email.subject}</h1>
              <p className="mt-1 text-[13px] text-muted">{r.sends.length ? `${r.sends.length} send${r.sends.length === 1 ? "" : "s"} · last ${etDate(r.sends[0].at, true)}` : "Not sent yet"}{r.email.slug ? <> · <a href={`/w/${r.email.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand">Web version<ExternalLink size={12} /></a></> : null}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {seg(device, setDevice, [["all", "All devices"], ["phone", "Phone"], ["desktop", "Desktop"], ["tablet", "Tablet"]], "Device")}
              {seg(channel, setChannel, [["all", "All"], ["email", "Email"], ["text", "Text"]], "Channel")}
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-ink"><input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} className="h-4 w-4" />Include link scanners</label>
            </div>

            {r.t.recipients === 0 ? (
              <div className="rounded-lg border border-line bg-surface p-8 text-center"><h2 className="font-serif text-xl text-ink">No sends yet</h2><p className="mx-auto mt-1 max-w-md text-[14px] text-muted">Numbers appear after this email is sent. Use Send me a test in the editor to see tracking work.</p></div>
            ) : (
              <>
                <EmailInsights id={id} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="People emailed" value={num(r.t.recipients)} sub={`${num(r.t.delivered)} delivered`} />
                  <Tile label="Click rate" value={pct(r.t.clickRate)} sub={`${num(r.t.clickers)} people`} />
                  <Tile label="Open rate (est.)" value={pct(r.t.openRate)} sub={`${num(r.t.openers)} people`} hint="An estimate. Apple Mail opens every email in the background." />
                  <Tile label="Total clicks" value={num(r.t.clicks)} sub={`${r.t.clickers ? (r.t.clicks / r.t.clickers).toFixed(1) : "0"} per person`} />
                  <Tile label="Unsubscribes" value={num(r.unsubscribes)} sub={pct(r.t.unsubRate, 2)} goodWhenDown />
                  <Tile label="Bounces" value={num(r.t.bounced)} sub={pct(r.t.bounceRate, 1)} goodWhenDown />
                  <Tile label="Spam reports" value={num(r.t.complained)} sub={pct(r.t.complaintRate, 2)} goodWhenDown />
                  <Tile label="Web views" value={num(r.webViews)} sub={r.prayers ? `${num(r.prayers)} prayer taps` : undefined} />
                </div>

                <Card title="What got tapped" note="In the order they appear in the email. The bar shows each link's share of the busiest link; the percent is the share of people reached who clicked it.">
                  {r.links.filter((l) => l.inEmail || l.clicks > 0).length ? (
                    <ul className="divide-y divide-line">
                      {r.links.filter((l) => l.inEmail || l.clicks > 0).map((l) => (
                        <li key={l.linkId} className="py-3 first:pt-0 last:pb-0">
                          <button type="button" disabled={!(people && l.clicks)} onClick={() => setOpenLink(openLink === l.linkId ? null : l.linkId)} aria-expanded={openLink === l.linkId} className="block w-full text-left">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="min-w-0"><div className="truncate font-medium text-ink">{l.label}</div><div className="truncate text-[12px] text-muted">{l.inEmail ? `${l.blockType} · block ${l.position}` : "Removed from this email since"} · {l.url.replace(/^https?:\/\/(www\.)?/, "")}</div></div>
                            <div className="shrink-0 text-right"><div className="font-medium tabular-nums text-navy">{num(l.clicks)} <span className="text-[12px] font-normal text-muted">click{l.clicks === 1 ? "" : "s"}</span></div><div className="text-[12px] text-muted">{num(l.unique)} {l.unique === 1 ? "person" : "people"}{l.shareOfDelivered !== null ? ` · ${pct(l.shareOfDelivered)}` : ""}</div></div>
                          </div></button>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/50"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(l.clicks ? 2 : 0, (l.clicks / maxClicks) * 100)}%` }} /></div>
                          {l.clicks > 0 && (l.phone || l.desktop || l.tablet) ? <div className="mt-1 text-[12px] text-muted">{[l.phone ? `${l.phone} phone` : "", l.desktop ? `${l.desktop} desktop` : "", l.tablet ? `${l.tablet} tablet` : ""].filter(Boolean).join(" · ")}</div> : null}
                          {people && l.clicks > 0 ? <div className="mt-1 text-[12px] font-medium text-brand">{openLink === l.linkId ? "Hide who tapped" : "See who tapped"}</div> : null}
                          {openLink === l.linkId && r.linkWho?.[l.linkId] ? (
                            <ul className="mt-2 space-y-1 border-l-2 border-line pl-3 text-[13px]">
                              {r.linkWho[l.linkId].map((w, i) => <li key={i} className="flex justify-between gap-3"><span className="min-w-0 truncate text-ink">{w.name || w.email}</span><span className="shrink-0 text-muted"><span className="font-medium text-navy">{w.clicks} tap{w.clicks === 1 ? "" : "s"}</span> · last {etDate(w.last, true)}</span></li>)}
                            </ul>) : null}
                        </li>))}
                    </ul>
                  ) : <p className="text-[13px] text-muted">This email has no tracked links.</p>}
                </Card>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="From sent to clicked"><Funnel steps={r.funnel} /></Card>
                  <Card title="Devices"><Split parts={[{ label: "Phone", value: r.devices.phone, color: C.navy }, { label: "Desktop", value: r.devices.desktop, color: C.brand }, { label: "Tablet", value: r.devices.tablet, color: C.teal }, { label: "Unknown", value: r.devices.unknown, color: "#b9c6d6" }]} /></Card>
                  <Card title="After sending" note="Clicks and opens by time since the email went out."><VBars labels={r.firstDays.map((d) => d.label)} aria="Clicks and opens since sending" height={150} showValues={false} series={[{ name: "Clicks", color: C.brand, values: r.firstDays.map((d) => d.clicks) }, { name: "Opens (est.)", color: C.sky, values: r.firstDays.map((d) => d.opens) }]} /></Card>
                  <Card title="Time of day" note="Eastern time."><VBars labels={r.hours.map((h) => hourName(h.hour))} aria="Clicks and opens by hour" labelEvery={3} height={150} showValues={false} series={[{ name: "Clicks", color: C.brand, values: r.hours.map((h) => h.clicks) }, { name: "Opens (est.)", color: C.sky, values: r.hours.map((h) => h.opens) }]} /></Card>
                  <Card title="How fast people click"><HBars rows={r.timeToClick.map((t) => ({ label: t.label, value: t.n }))} /></Card>
                  <Card title="Sends">
                    <ul className="divide-y divide-line text-[14px]">{r.sends.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"><span className="text-ink">{etDate(s.at, true)}</span><span className="flex items-center gap-2 text-muted">{s.kind === "test" ? <Chip tone="amber">Test</Chip> : <Chip tone="green">Real</Chip>}{num(s.recipients)} {s.recipients === 1 ? "person" : "people"}</span></li>)}</ul>
                  </Card>
                </div>

                {people && r.recipients ? (
                  <Card title={`People · ${people_.length}`} note="Only the Owner and Admins can see this. Please keep it inside the church."
                    right={<button onClick={() => downloadCsv("brainerd-mail-recipients.csv", ["Name", "Email", "Times sent", "Channel", "Status", "Opens (est.)", "Clicks", "Links clicked"], people_.map((p) => [p.name ?? "", p.email, p.receivedCount, p.channel, p.status, p.opens, p.clicks, p.links.join("; ")]))} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand"><Download size={14} />CSV</button>}>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {([["all", "Everyone"], ["clicked", "Clicked"], ["opened", "Opened"], ["quiet", "No activity"], ["problem", "Bounced or failed"]] as const).map(([v, l]) => <button key={v} onClick={() => { setWho(v); setShown(25); }} aria-pressed={who === v} className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold ${who === v ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink"}`}>{l}</button>)}
                    </div>
                    <ul className="divide-y divide-line">
                      {people_.slice(0, shown).map((p) => {
                        const key = p.email || String(p.lastActivity);
                        const isOpen = open === key;
                        const sub = [p.opens ? `Opened ${p.opens} time${p.opens === 1 ? "" : "s"}` : p.status === "bounced" ? "Bounced" : "Not opened", p.clicks ? `tapped ${p.links.join(", ")}` : "no taps"].join(" · ");
                        return (
                          <li key={key} className="py-1 first:pt-0">
                            <button onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen} className="flex w-full items-start justify-between gap-3 rounded-lg py-2 text-left hover:bg-mist">
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-medium text-ink">{p.name || p.email || "(text)"}</div>
                                {p.name ? <div className="truncate text-[12px] text-muted">{p.email}</div> : null}
                                <div className="mt-0.5 text-[12px] text-muted">{sub}{p.receivedCount > 1 ? ` · received ${p.receivedCount} times` : ""}</div>
                              </div>
                              <div className="flex shrink-0 items-start gap-2 text-right text-[12px] text-muted">
                                <div>{p.clicks ? <span className="font-medium text-navy">{p.clicks} tap{p.clicks === 1 ? "" : "s"}</span> : null}{p.lastActivity ? <div>{etDate(p.lastActivity, true)}</div> : null}</div>
                                <ChevronDown size={16} className={`mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </div>
                            </button>
                            {isOpen ? (
                              <div className="mb-2 ml-1 space-y-2 border-l-2 border-line pl-3">
                                {p.receipts.map((rc, j) => (
                                  <div key={j} className="text-[13px]">
                                    <div className="flex flex-wrap items-center gap-x-2 text-ink"><span className="font-medium">Sent {rc.at ? etDate(rc.at, true) : ""}</span>{rc.kind === "test" ? <Chip tone="amber">Test</Chip> : null}<span className="text-muted">{["bounced", "complained", "failed"].includes(rc.status) ? rc.status : rc.opened ? `opened ${rc.openCount} time${rc.openCount === 1 ? "" : "s"}, first ${rc.openedAt ? etDate(rc.openedAt, true) : ""}` : "not opened yet"}</span></div>
                                    {rc.taps.length ? <ul className="mt-1 space-y-0.5">{rc.taps.map((t, k) => <li key={k} className="flex justify-between gap-3 text-muted"><span className="min-w-0 truncate text-ink">{t.label}</span><span className="shrink-0">{etDate(t.at, true)}{t.device ? ` · ${t.device}` : ""}</span></li>)}</ul> : <div className="text-muted">No taps</div>}
                                  </div>))}
                              </div>) : null}
                          </li>);
                      })}
                    </ul>
                    {people_.length === 0 ? <p className="text-[13px] text-muted">Nobody matches.</p> : null}
                    {people_.length > shown ? <button onClick={() => setShown((s) => s + 50)} className="mt-3 w-full rounded-lg border border-line py-2.5 text-[14px] font-semibold text-brand">Show more</button> : null}
                  </Card>
                ) : null}
                <p className="flex items-start gap-2 px-1 text-[12px] leading-snug text-muted"><Info size={14} className="mt-0.5 shrink-0" />Opens are estimates (Apple Mail and Gmail load images ahead of readers). Clicks are the number to trust.</p>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
