"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Globe, Compass, HelpCircle, LifeBuoy, LogOut, Mail, Menu, Users, X } from "lucide-react";
import { HeaderBrand } from "@/components/HeaderBrand";
import { ROLE_LABEL, type Role } from "@/lib/roles-ui";

// The one menu for every section of Brainerd Mail. Same hamburger on every screen size.
const ITEMS = [
  { href: "/emails", label: "Emails", icon: Mail, match: (p: string) => p === "/emails" || p.startsWith("/editor") || p.startsWith("/review") },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
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

  const link = (href: string, label: string, Icon: typeof Mail, active: boolean, badge?: number) => (
    <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-[16px] font-semibold ${active ? "bg-[#e8f0fb] text-navy" : "text-ink active:bg-[#f4f8fd]"}`}>
      <Icon size={20} className={active ? "text-[#1e61b9]" : "text-muted"} />
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-[#c8102e] px-2 py-0.5 text-xs font-bold text-white">{badge}</span> : null}
    </Link>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-[#f4f8fd] lg:hover:bg-[#f4f8fd]"><Menu size={24} /></button>
      {open ? createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <HeaderBrand label="Mail" />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-[#f4f8fd]"><X size={22} /></button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {ITEMS.filter((i) => i.href !== "/roster" || roster).map((i) => link(i.href, i.label, i.icon, i.match(path)))}
              {team ? link("/team", "Team", Users, path.startsWith("/team")) : null}
              {admin ? link("/feedback", "Feedback inbox", LifeBuoy, path.startsWith("/feedback"), fresh) : null}
            </div>
            <form action="/auth/signout" method="post" className="border-t border-line p-3">
              {who ? <p className="px-4 pb-2 text-sm text-muted"><span className="font-semibold text-ink">{who.name}</span>{who.role ? ` · ${who.role}` : ""}</p> : null}
              <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("bm-help")); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-[16px] font-semibold text-muted active:bg-[#f4f8fd]"><HelpCircle size={20} />Help</button>
              <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("bm-tour")); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-[16px] font-semibold text-muted active:bg-[#f4f8fd]"><Compass size={20} />Take the tour</button>
              <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-[16px] font-semibold text-muted active:bg-[#f4f8fd]"><LogOut size={20} />Sign out</button>
            </form>
          </nav>
        </div>,
        document.body
      ) : null}
    </>
  );
}
