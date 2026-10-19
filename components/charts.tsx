"use client";
// Small, dependency-free chart pieces for the Analytics screens. Every chart has a text equivalent
// (the numbers are printed on or under it) so nothing depends on colour or on seeing the picture.
import type { ReactNode } from "react";

export const C = { navy: "#00205b", brand: "#1e61b9", teal: "#00abc9", sky: "#acdceb", soft: "#cfdcf0", green: "#118058", red: "#ad0b1c", amber: "#b45309", grid: "#e6ecf3" };

export const num = (n: number) => n.toLocaleString("en-US");
export function pct(v: number | null | undefined, digits?: number) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const p = v * 100;
  if (digits !== undefined) return `${p.toFixed(digits)}%`;
  return p >= 10 || p === 0 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}
export const etDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "America/New_York" }) + (withTime ? " ET" : "");
export const hourName = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

// ---- Card shell ----
export function Card({ title, note, right, children, id }: { title: string; note?: ReactNode; right?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{title}</h2>
        {right}
      </div>
      {note ? <p className="px-4 pt-3 text-[13px] leading-snug text-muted">{note}</p> : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

// ---- A number tile, with an optional change from the period before ----
export function Tile({ label, value, sub, delta, goodWhenDown, hint }: { label: string; value: string; sub?: string; delta?: { text: string; dir: -1 | 0 | 1 } | null; goodWhenDown?: boolean; hint?: string }) {
  const tone = !delta || delta.dir === 0 ? "text-muted" : (delta.dir > 0) !== !!goodWhenDown ? "text-[#0d6b44]" : "text-[#9a1b1b]";
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4" title={hint}>
      <div className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 font-serif text-[28px] font-semibold leading-none text-navy">{value}</div>
      <div className="mt-1.5 flex min-h-[18px] flex-wrap items-center gap-x-2 text-[12px] text-muted">
        {sub ? <span>{sub}</span> : null}
        {delta ? <span className={`font-semibold ${tone}`}>{delta.dir > 0 ? "▲" : delta.dir < 0 ? "▼" : "•"} {delta.text}</span> : null}
      </div>
    </div>
  );
}

export function deltaCount(cur: number, prev: number | undefined | null): { text: string; dir: -1 | 0 | 1 } | null {
  if (prev === undefined || prev === null) return null;
  if (prev === 0) return cur === 0 ? null : { text: "new", dir: 1 };
  const d = Math.round(((cur - prev) / prev) * 100);
  return { text: `${Math.abs(d)}%`, dir: d > 0 ? 1 : d < 0 ? -1 : 0 };
}
export function deltaRate(cur: number | null, prev: number | null | undefined): { text: string; dir: -1 | 0 | 1 } | null {
  if (cur === null || prev === null || prev === undefined) return null;
  const d = Math.round((cur - prev) * 1000) / 10; // percentage points
  return { text: `${Math.abs(d)} pt`, dir: d > 0 ? 1 : d < 0 ? -1 : 0 };
}

// ---- Vertical bars, one or two series side by side ----
export type VSeries = { name: string; color: string; values: number[] };
export function VBars({ labels, series, height = 150, fmt = num, aria, labelEvery = 1, showValues = true }: { labels: string[]; series: VSeries[]; height?: number; fmt?: (n: number) => string; aria: string; labelEvery?: number; showValues?: boolean }) {
  const n = labels.length;
  const max = Math.max(1e-9, ...series.flatMap((s) => s.values));
  const slot = 44, W = Math.max(n * slot, 280), plotH = height - 34, base = height - 22;
  const bw = Math.min(26, (slot - 8) / series.length);
  const empty = max <= 1e-9;
  return (
    <div>
      <div className="overflow-x-auto">
        <svg role="img" aria-label={aria} viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", minWidth: Math.min(W, 560), height }} className="block">
          {[0.5, 1].map((g) => <line key={g} x1={0} x2={W} y1={base - plotH * g} y2={base - plotH * g} stroke={C.grid} strokeWidth={1} />)}
          <line x1={0} x2={W} y1={base} y2={base} stroke="#c9d4e0" />
          {labels.map((l, i) => {
            const x0 = (W / n) * i + (W / n - bw * series.length) / 2;
            return (
              <g key={i}>
                {series.map((s, k) => {
                  const v = s.values[i] ?? 0, h = empty ? 0 : (v / max) * plotH;
                  return (
                    <g key={k}>
                      <rect x={x0 + k * bw} y={base - h} width={bw - 2} height={Math.max(h, v > 0 ? 2 : 0)} rx={3} fill={s.color}><title>{`${l}: ${s.name} ${fmt(v)}`}</title></rect>
                      {showValues && v > 0 && n <= 14 && series.length === 1 ? <text x={x0 + k * bw + (bw - 2) / 2} y={base - h - 4} textAnchor="middle" fontSize={10} fill={C.navy} fontWeight={600}>{fmt(v)}</text> : null}
                    </g>
                  );
                })}
                {i % labelEvery === 0 ? <text x={(W / n) * i + W / n / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="#5b6b80">{l}</text> : null}
              </g>
            );
          })}
        </svg>
      </div>
      {series.length > 1 ? (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
        </div>
      ) : null}
      {empty ? <p className="mt-1 text-[13px] text-muted">Nothing to show yet for these filters.</p> : null}
    </div>
  );
}

// ---- Horizontal bars with a label and a value ----
export function HBars({ rows, fmt = num, color = C.brand, max }: { rows: { label: ReactNode; value: number; sub?: ReactNode; color?: string; href?: string }[]; fmt?: (n: number) => string; color?: string; max?: number }) {
  const m = max ?? Math.max(1e-9, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate font-semibold text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink">{fmt(r.value)}{r.sub ? <span className="ml-2 text-[12px] text-muted">{r.sub}</span> : null}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eaf0f7]"><div className="h-full rounded-full" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / m) * 100)}%`, background: r.color ?? color }} /></div>
        </li>
      ))}
    </ul>
  );
}

// ---- One stacked bar split into parts (devices, channels) ----
export function Split({ parts, fmt = num }: { parts: { label: string; value: number; color: string }[]; fmt?: (n: number) => string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <p className="text-[13px] text-muted">Nothing yet.</p>;
  return (
    <div>
      <div role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")} className="flex h-4 overflow-hidden rounded-full bg-[#eaf0f7]">
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${fmt(p.value)}`} />)}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
        {parts.map((p) => <li key={p.label} className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} /><span className="text-muted">{p.label}</span><span className="ml-auto font-semibold tabular-nums text-ink">{fmt(p.value)} <span className="font-normal text-muted">{Math.round((p.value / total) * 100)}%</span></span></li>)}
      </ul>
    </div>
  );
}

// ---- Funnel: each step as a bar relative to the first ----
export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const top = Math.max(1, steps[0]?.n ?? 1);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between text-[14px]"><span className="font-semibold text-ink">{s.label}</span><span className="tabular-nums text-ink">{num(s.n)} <span className="text-[12px] text-muted">{i === 0 ? "" : pct(s.n / top)}</span></span></div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-[#eaf0f7]"><div className="h-full rounded-full" style={{ width: `${Math.max(s.n > 0 ? 2 : 0, (s.n / top) * 100)}%`, background: [C.navy, C.brand, C.teal, C.green][i] ?? C.brand }} /></div>
        </li>
      ))}
    </ol>
  );
}

export function Chip({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "blue" | "amber" | "green" | "red" }) {
  const t = { gray: "bg-[#eef2f6] text-[#41536a]", blue: "bg-[#e8f0fb] text-[#17458c]", amber: "bg-[#fdf1d8] text-[#7a4a05]", green: "bg-[#e3f4ea] text-[#0d5a37]", red: "bg-[#fbe6e8] text-[#8a1020]" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${t}`}>{children}</span>;
}

export function downloadCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => { const s = v === null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
