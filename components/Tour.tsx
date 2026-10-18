"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { tourFor, type TourStep } from "@/lib/tour";
import type { Role } from "@/lib/roles-ui";

// Pages readers see (or sign-in) never get the tour.
const SKIP = ["/login", "/auth", "/w/", "/r/", "/u/", "/serving", "/sample/"];

// First-run tour for each role. Opens by itself once; "Take the tour" in the menu opens it again.
export function TourHost() {
  const path = usePathname() ?? "";
  const hidden = SKIP.some((p) => path.startsWith(p));
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      setRole(j.role); setName(j.name || ""); setSteps(tourFor(j.role, j.name || ""));
      return j as { role: Role; name: string; tourDone: boolean };
    } catch { return null; }
  }, []);

  useEffect(() => {
    if (hidden || asked) return;
    setAsked(true);
    load().then((j) => { if (j && !j.tourDone) { setI(0); setOpen(true); } });
  }, [hidden, asked, load]);

  useEffect(() => {
    const onOpen = async () => {
      if (!steps) await load();
      setI(0); setOpen(true);
    };
    window.addEventListener("bm-tour", onOpen);
    return () => window.removeEventListener("bm-tour", onOpen);
  }, [steps, load]);

  const finish = useCallback(() => {
    setOpen(false);
    fetch("/api/me/tour", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open || !steps || hidden) return null;
  const s = steps[i];
  const last = i === steps.length - 1;
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/50 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Brainerd Mail tour">
      <div className="w-full rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Step {i + 1} of {steps.length}</span>
          <button onClick={finish} aria-label="Close tour" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button>
        </div>
        <h2 className="font-serif text-2xl font-semibold text-navy">{s.title}</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">{s.body}</p>
        {s.hint ? <p className="mt-3 inline-block rounded-full bg-[#e8f0fb] px-3 py-1 text-xs font-bold text-[#00205b]">{s.hint}</p> : null}
        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {steps.map((_, k) => <span key={k} className={`h-1.5 rounded-full ${k === i ? "w-5 bg-[#1e61b9]" : "w-1.5 bg-[#c4cfdc]"}`} />)}
        </div>
        <div className="mt-5 flex items-center gap-2">
          {i > 0 ? <button onClick={() => setI(i - 1)} className="pill-btn border border-line text-ink"><ChevronLeft size={16} className="mr-1" />Back</button> : <button onClick={finish} className="pill-btn text-muted">Skip tour</button>}
          <span className="flex-1" />
          {last ? <button onClick={finish} className="pill-btn bg-[#1e61b9] text-white">Done</button> : <button onClick={() => setI(i + 1)} className="pill-btn bg-[#1e61b9] text-white">Next<ChevronRight size={16} className="ml-1" /></button>}
        </div>
        {i > 0 && !last ? <button onClick={finish} className="mt-2 w-full text-center text-sm font-semibold text-muted">Skip tour</button> : null}
      </div>
    </div>
  );
}
