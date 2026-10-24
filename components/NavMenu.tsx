"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Globe, Map as MapIcon, Compass, HelpCircle, LifeBuoy, LogOut, Mail, Menu, Monitor, Moon, Send, Sun, UsersRound, Users, X } from "lucide-react";
import { HeaderBrand } from "@/components/HeaderBrand";
import { ROLE_LABEL, type Role } from "@/lib/roles-ui";
import { THEME_MODES, applyMode, getMode, type ThemeMode } from "@/lib/theme";

// The one menu for every section of Brainerd Mail. Same hamburger on every screen size.
const ITEMS = [
  { href: "/emails", label: "Emails", icon: Mail, match: (p: string) => p === "/emails" || p.startsWith("/editor") || p.startsWith("/review") },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { href: "/analytics", label: "Analytics", icon: BarChart3, match: (p: string) => p.startsWith("/analytics") },
  { href: "/missions", label: "Missions map", icon: MapIcon, match: (p: string) => p.startsWith("/missions") },
  { href: "/roster", label: "Serving list", icon: Globe, match: (p: string) => p.startsWith("/roster") },
];

export function NavMenu() {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [team, setTeam] = useState(false);
  const [roster, setRoster] = useState(true);
  const [who, setWho] = useState<{ name: string; role: string } | null>(null);
  const [fresh, setFresh] = useState(0);
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => { setMode(getMode()); }, []);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/feedback?summary=1").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j?.role) return;
      setAdmin(!!j.admin); setTeam(!!j.team); setRoster(!!j.roster); setFresh(j.new ?? 0);
      setWho({ name: j.name || String(j.email || "").split("@")[0], role: ROLE_LABEL[j.role as Role] ?? "" });
    }).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function chooseMode(next: ThemeMode) { applyMode(next); setMode(next); }

  const link = (href: string, label: string, Icon: typeof Mail, active: boolean, badge?: number) => (
    <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-lg px-4 text-[16px] font-semibold ${active ? "bg-brand/10 text-navy" : "text-ink active:bg-mist"}`}>
      <Icon size={20} className={active ? "text-brand" : "text-muted"} />
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{badge}</span> : null}
    </Link>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-mist lg:hover:bg-mist"><Menu size={24} /></button>
      {open ? createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <HeaderBrand label="Mail" />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-mist"><X size={22} /></button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {ITEMS.filter((i) => i.href !== "/roster" || roster).map((i) => link(i.href, i.label, i.icon, i.match(path)))}
              {team ? link("/team", "Team", Users, path.startsWith("/team")) : null}
              {team ? link("/audience", "Audiences", UsersRound, path.startsWith("/audience")) : null}
              {team ? link("/sending", "Sending", Send, path.startsWith("/sending")) : null}
              {admin ? link("/feedback", "Feedback inbox", LifeBuoy, path.startsWith("/feedback"), fresh) : null}
            </div>
            <form action="/auth/signout" method="post" className="border-t border-line p-3">
              {who ? <p className="px-4 pb-2 text-sm text-muted"><span className="font-semibold text-ink">{who.name}</span>{who.role ? ` · ${who.role}` : ""}</p> : null}
              <p className="px-4 pb-1 pt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Appearance</p>
              <div className="grid grid-cols-3 gap-1 px-3 pb-2">
                {THEME_MODES.map((m) => {
                  const Icon = m.id === "auto" ? Monitor : m.id === "light" ? Sun : Moon;
                  return (
                    <button key={m.id} type="button" onClick={() => chooseMode(m.id)} title={m.description} aria-pressed={mode === m.id} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-semibold ${mode === m.id ? "border-brand/50 bg-brand/15 text-ink" : "border-transparent text-muted active:bg-mist"}`}>
                      <Icon size={16} />{m.label}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("bm-help")); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-[16px] font-semibold text-muted active:bg-mist"><HelpCircle size={20} />Help</button>
              <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("bm-tour")); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-[16px] font-semibold text-muted active:bg-mist"><Compass size={20} />Take the tour</button>
              <button className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-[16px] font-semibold text-muted active:bg-mist"><LogOut size={20} />Sign out</button>
            </form>
          </nav>
        </div>,
        document.body
      ) : null}
    </>
  );
}
