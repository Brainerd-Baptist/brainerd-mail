"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/roles-ui";
import { THEME_MODES, applyMode, getMode, type ThemeMode } from "@/lib/theme";

// One account menu in every header, same as Personnel/HQ: an avatar with your
// initials that opens name, email, role, Appearance (Auto / Light / Dark),
// the tour, and Sign out. The slide-out menu is for pages only.
function initials(name: string, email: string) {
  const source = (name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }
  return (email || "?").slice(0, 2).toUpperCase();
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>("auto");
  const [who, setWho] = useState<{ name: string; email: string; role: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMode(getMode()); }, []);
  useEffect(() => {
    fetch("/api/feedback?summary=1").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j?.role) return;
      const email = String(j.email || "");
      setWho({ name: j.name || "", email, role: ROLE_LABEL[j.role as Role] ?? "" });
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  function chooseMode(next: ThemeMode) { applyMode(next); setMode(next); }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        aria-expanded={open}
        title={who?.name || who?.email || "Profile"}
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${open ? "border-brand/50 bg-brand/20 text-brand-soft" : "border-brand/25 bg-brand/10 text-muted hover:border-brand/40 hover:text-brand-soft"}`}
      >
        {who ? initials(who.name, who.email) : "··"}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-brand/20 p-2 shadow-xl" style={{ backgroundColor: "rgb(var(--color-surface))" }}>
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm text-ink">{who?.name || who?.email || "Signed in"}</p>
            {who?.name && who.email ? <p className="mt-0.5 truncate text-xs text-muted">{who.email}</p> : null}
            {who?.role ? <span className="mt-1.5 inline-block rounded-full border border-brand/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">{who.role}</span> : null}
          </div>
          <div className="my-1 border-t border-brand/10" />
          <p className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-muted/70">Appearance</p>
          <div className="grid grid-cols-3 gap-1 px-1 pb-1.5">
            {THEME_MODES.map((m) => {
              const Icon = m.id === "auto" ? Monitor : m.id === "light" ? Sun : Moon;
              return (
                <button key={m.id} type="button" onClick={() => chooseMode(m.id)} title={m.description} aria-pressed={mode === m.id} className={`flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${mode === m.id ? "border-brand/50 bg-brand/15 text-ink" : "border-transparent text-muted hover:bg-brand/5 hover:text-brand-soft"}`}>
                  <Icon size={14} />{m.label}
                </button>
              );
            })}
          </div>
          <div className="my-1 border-t border-brand/10" />
          <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("bm-tour")); }} className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-sm text-ink transition-colors hover:bg-brand/5"><Compass size={13} className="text-muted" />Take the tour</button>
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-brand/5 hover:text-red-600"><LogOut size={13} />Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
