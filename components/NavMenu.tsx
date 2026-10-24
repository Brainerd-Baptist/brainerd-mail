"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Globe, Map as MapIcon, LifeBuoy, Mail, Menu, Send, UsersRound, Users, X } from "lucide-react";
import { HeaderBrand } from "@/components/HeaderBrand";

// The one menu for every section of Brainerd Mail. Same hamburger on every screen size.
const ITEMS = [
  { href: "/emails", label: "Emails", icon: Mail, match: (p: string) => p === "/emails" || p.startsWith("/editor") || p.startsWith("/review") },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { href: "/analytics", label: "Analytics", icon: BarChart3, match: (p: string) => p.startsWith("/analytics") },
  { href: "/missions", label: "Missions Map", icon: MapIcon, match: (p: string) => p.startsWith("/missions") },
  { href: "/roster", label: "Serving List", icon: Globe, match: (p: string) => p.startsWith("/roster") },
];

export function NavMenu() {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [team, setTeam] = useState(false);
  const [roster, setRoster] = useState(true);
  const [fresh, setFresh] = useState(0);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/feedback?summary=1").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j?.role) return;
      setAdmin(!!j.admin); setTeam(!!j.team); setRoster(!!j.roster); setFresh(j.new ?? 0);
    }).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const link = (href: string, label: string, Icon: typeof Mail, active: boolean, badge?: number) => (
    <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`mx-2 my-0.5 flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${active ? "bg-brand/15 font-medium text-brand-soft" : "text-ink hover:bg-brand/5"}`}>
      <Icon size={18} className="shrink-0" />
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">{badge}</span> : null}
    </Link>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="shrink-0 text-muted transition-colors hover:text-brand-soft"><Menu size={20} /></button>
      {open ? createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-full flex-col border-r border-brand/15 sm:max-w-sm" style={{ backgroundColor: "rgb(var(--color-surface))" }}>
            <div className="flex items-center justify-between border-b border-brand/15 px-4 pb-3" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
              <span className="text-base text-ink">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="-m-1 p-1 text-muted transition-colors hover:text-navy"><X size={22} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-8 pt-1">
              {ITEMS.filter((i) => i.href !== "/roster" || roster).map((i) => link(i.href, i.label, i.icon, i.match(path)))}
              {team || admin ? <div className="mt-3 border-t border-brand/10 pt-3"><p className="px-5 pb-1 pt-1 text-[0.68rem] uppercase tracking-wider text-muted/70">Admin</p></div> : null}
              {team ? link("/team", "Team", Users, path.startsWith("/team")) : null}
              {team ? link("/audience", "Audiences", UsersRound, path.startsWith("/audience")) : null}
              {team ? link("/sending", "Sending", Send, path.startsWith("/sending")) : null}
              {admin ? link("/feedback", "Feedback inbox", LifeBuoy, path.startsWith("/feedback"), fresh) : null}
            </div>
          </nav>
        </div>,
        document.body
      ) : null}
    </>
  );
}
