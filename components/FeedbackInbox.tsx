"use client";
import { useMemo, useState } from "react";
import { ArrowLeft, Bug, HelpCircle, Lightbulb, MessageCircle } from "lucide-react";

export type Note = {
  id: number; created_at: string; email: string | null; kind: "problem" | "feature" | "feedback" | "question";
  message: string; context: Record<string, unknown>; status: "new" | "seen" | "planned" | "done" | "wont"; note: string | null;
};

const KIND = { problem: { label: "Problem", Icon: Bug }, feature: { label: "Feature request", Icon: Lightbulb }, feedback: { label: "Feedback", Icon: MessageCircle }, question: { label: "Help question", Icon: HelpCircle } } as const;
const STATUS: { k: Note["status"]; label: string }[] = [
  { k: "new", label: "New" }, { k: "seen", label: "Seen" }, { k: "planned", label: "Planned" }, { k: "done", label: "Done" }, { k: "wont", label: "Won't do" },
];
const FILTERS = [
  { k: "open", label: "Open", match: (n: Note) => n.status === "new" || n.status === "seen" || n.status === "planned" },
  { k: "new", label: "New", match: (n: Note) => n.status === "new" },
  { k: "done", label: "Closed", match: (n: Note) => n.status === "done" || n.status === "wont" },
  { k: "all", label: "All", match: () => true },
] as const;

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Card({ n, onChange }: { n: Note; onChange: (id: number, patch: Partial<Note>) => void }) {
  const [note, setNote] = useState(n.note ?? "");
  const [err, setErr] = useState("");
  const { label, Icon } = KIND[n.kind];

  async function save(patch: { status?: Note["status"]; note?: string }) {
    setErr("");
    const res = await fetch(`/api/feedback/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (res.ok) onChange(n.id, patch); else setErr("Could not save that.");
  }
  const c = n.context as Record<string, string | undefined>;
  const bits = [c.ministry, c.emailTitle && `“${c.emailTitle}”`, c.tab && `${c.tab} tab`, c.device, c.selectedBlock && `${c.selectedBlock} block`, c.viewport, c.build && `build ${c.build}`].filter(Boolean);

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><Icon size={14} className="text-brand" />{label}</span>
        <span className="text-xs text-muted">{when(n.created_at)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink">{n.message}</p>
      <p className="mt-2 text-xs text-muted">From {n.email ?? "unknown"}{bits.length ? ` · ${bits.join(" · ")}` : ""}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS.map((s) => (
          <button key={s.k} onClick={() => save({ status: s.k })} className={`min-h-9 rounded-full px-3 text-sm font-semibold ${n.status === s.k ? "bg-brand text-white" : "border border-line text-ink"}`}>{s.label}</button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== (n.note ?? "")) save({ note }); }} rows={2} placeholder="Private note (what we decided, where it's tracked)" className="field mt-3 w-full text-sm" />
      {err ? <p className="mt-1 text-xs text-[#c8102e]">{err}</p> : null}
    </li>
  );
}

export function FeedbackInbox({ initial }: { initial: Note[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["k"]>("open");
  const f = FILTERS.find((x) => x.k === filter)!;
  const shown = useMemo(() => items.filter(f.match), [items, f]);
  const update = (id: number, patch: Partial<Note>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="mx-auto min-h-[100dvh] max-w-2xl bg-mist px-4 pb-16 pt-4">
      <a href="/" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand"><ArrowLeft size={16} />Back to Brainerd Mail</a>
      <h1 className="mb-3 font-serif text-2xl font-medium text-navy">Feedback inbox</h1>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((x) => (
          <button key={x.k} onClick={() => setFilter(x.k)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${filter === x.k ? "bg-navy text-white" : "bg-surface text-ink border border-line"}`}>{x.label} <span className="opacity-70">{items.filter(x.match).length}</span></button>
        ))}
      </div>
      {shown.length === 0 ? <p className="rounded-lg bg-surface p-6 text-center text-sm text-muted">Nothing here. New notes from the builder will show up in this list.</p> : (
        <ul className="space-y-3">{shown.map((n) => <Card key={n.id} n={n} onChange={update} />)}</ul>
      )}
    </div>
  );
}
