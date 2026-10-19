"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, MailPlus, RotateCw, ShieldCheck, UserPlus, X } from "lucide-react";
import { NavMenu } from "@/components/NavMenu";
import { HelpButton } from "@/components/HelpButton";
import { HeaderBrand } from "@/components/HeaderBrand";
import { PALETTES, paletteFor } from "@/lib/ministries";
import { ROLES, ROLE_BLURB, ROLE_LABEL, canManageTarget, rolesICanGrant, type Role } from "@/lib/roles-ui";

export type Member = { user_id: string; email: string; name: string | null; role: Role; ministries: string[] | null; disabled_at: string | null; created_at: string; can_approve?: boolean | null };
export type Invite = { id: string; email: string; first_name: string | null; last_name: string | null; role: Role; ministries: string[] | null; created_at: string; expires_at: string; last_sent_at: string };

const PILL: Record<Role, string> = {
  owner: "bg-[#00205b] text-white",
  admin: "bg-[#e8f0fb] text-[#00205b]",
  approver: "bg-[#e6f5ee] text-[#0d3b2c]",
  editor: "bg-[#fff3d6] text-[#5c3a00]",
  viewer: "bg-slate-100 text-slate-700",
};
const RolePill = ({ role }: { role: Role }) => <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${PILL[role]}`}>{ROLE_LABEL[role]}</span>;
const nameOf = (m: { name: string | null; email: string }) => m.name || m.email.split("@")[0];
const initials = (s: string) => s.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const scope = (r: Role, m: string[] | null) => (r === "editor" ? ((m ?? []).map((k) => paletteFor(k).label).join(", ") || "No ministries yet") : "All ministries");

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-navy">{title}</h2><button aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted"><X size={22} /></button></div>
        {children}
      </div>
    </div>
  );
}

function RolePicker({ value, onChange, options }: { value: Role; onChange: (r: Role) => void; options: Role[] }) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Role">
      {options.map((r) => (
        <button key={r} type="button" role="radio" aria-checked={value === r} onClick={() => onChange(r)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${value === r ? "border-[#1e61b9] bg-[#f4f8fd]" : "border-line bg-white"}`}>
          <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${value === r ? "border-[#1e61b9] bg-[#1e61b9] shadow-[inset_0_0_0_3px_#fff]" : "border-line"}`} />
          <span className="min-w-0"><span className="block text-[15px] font-semibold text-ink">{ROLE_LABEL[r]}</span><span className="block text-sm text-muted">{ROLE_BLURB[r]}</span></span>
        </button>
      ))}
    </div>
  );
}

function MinistryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <span className="label">Which ministries?</span>
      <div className="flex flex-wrap gap-2">
        {Object.values(PALETTES).map((p) => {
          const on = value.includes(p.key);
          return <button key={p.key} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((k) => k !== p.key) : [...value, p.key])} className={`h-10 rounded-full border px-4 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink"}`}>{p.label}</button>;
        })}
      </div>
      <p className="mt-1 text-xs text-muted">Editors can change emails for these ministries only. They can still see everything.</p>
    </div>
  );
}

const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";
const seen = (map: Record<string, string | null> | null, id: string) => (map ? (map[id] ? `Last active ${stamp(map[id]!)}` : "No activity yet") : null);

export function TeamManager({ me, members, invites, lastSignIn }: { me: { userId: string; role: Role }; members: Member[]; invites: Invite[]; lastSignIn: Record<string, string | null> | null }) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [guide, setGuide] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const active = useMemo(() => members.filter((m) => !m.disabled_at).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || nameOf(a).localeCompare(nameOf(b))), [members]);
  const off = useMemo(() => members.filter((m) => m.disabled_at), [members]);
  const grant = rolesICanGrant({ role: me.role, ministries: [] });

  async function call(url: string, init: RequestInit, key: string): Promise<{ ok: boolean; data: any }> {
    setBusy(key); setErr("");
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "That didn't work. Please try again."); return { ok: false, data: j }; }
      return { ok: true, data: j };
    } catch { setErr("No connection. Please try again."); return { ok: false, data: {} }; }
    finally { setBusy(""); }
  }

  async function inviteAction(i: Invite, action: "resend" | "revoke") {
    const r = await call(`/api/team/invites/${i.id}`, { method: "POST", body: JSON.stringify({ action }) }, i.id + action);
    if (!r.ok) return;
    setNote(action === "revoke" ? `Invitation to ${i.email} was cancelled.` : r.data.emailed === false ? "Saved, but the email didn't go out. Try Resend again in a minute." : `Invitation sent again to ${i.email}.`);
    router.refresh();
  }

  return (
    <div className="min-h-full bg-mist pb-16">
      <header className="sticky top-0 z-10 border-b border-[#00abc9]/15 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <NavMenu />
          <HeaderBrand label="Team" />
          <span className="flex-1" />
          <HelpButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold text-navy">Team</h1>
          <button onClick={() => { setNote(""); setErr(""); setInviteOpen(true); }} className="pill-btn shrink-0 whitespace-nowrap bg-[#1e61b9] text-white"><UserPlus size={16} className="mr-1.5" />Invite someone</button>
        </div>

        {note ? <p role="status" className="rounded-xl bg-[#e8f5ee] px-4 py-3 text-sm text-[#0d3b2c]">{note}</p> : null}
        {err && !inviteOpen && !editing ? <p role="alert" className="rounded-xl bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}

        <section aria-label="People" className="overflow-hidden rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">People · {active.length}</h2>
          <ul className="divide-y divide-line">
            {active.map((m) => {
              const mine = m.user_id === me.userId;
              const can = !mine && canManageTarget(me.role, m.role);
              return (
                <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f0fb] text-sm font-bold text-navy">{initials(nameOf(m))}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="truncate text-[15px] font-semibold text-ink">{nameOf(m)}{mine ? " (you)" : ""}</span><RolePill role={m.role} />{m.role !== "owner" && m.can_approve ? <span className="inline-flex items-center rounded-full bg-[#e3f4ea] px-2.5 py-0.5 text-xs font-bold text-[#0d5a37]">Approves emails</span> : null}</div>
                    <div className="truncate text-sm text-muted">{m.email}</div>
                    <div className="truncate text-xs text-muted">{scope(m.role, m.ministries)} · joined {day(m.created_at)}</div>
                    {lastSignIn ? <div className="truncate text-xs font-semibold text-[#00205b]">{seen(lastSignIn, m.user_id)}</div> : null}
                  </div>
                  {can ? <button onClick={() => { setErr(""); setNote(""); setEditing(m); }} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-4 text-sm font-semibold text-ink">Manage</button>
                    : me.role === "owner" && !mine ? null : null}
                </li>
              );
            })}
          </ul>
        </section>

        {invites.length ? (
          <section aria-label="Invitations" className="overflow-hidden rounded-2xl border border-line bg-white">
            <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Invitations · {invites.length}</h2>
            <ul className="divide-y divide-line">
              {invites.map((i) => {
                const expired = new Date(i.expires_at).getTime() < Date.now();
                const can = canManageTarget(me.role, i.role);
                return (
                  <li key={i.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><MailPlus size={16} className="text-muted" /><span className="truncate text-[15px] font-semibold text-ink">{[i.first_name, i.last_name].filter(Boolean).join(" ") || i.email}</span><RolePill role={i.role} /></div>
                    {i.first_name || i.last_name ? <div className="truncate text-sm text-muted">{i.email}</div> : null}
                    <div className="mt-0.5 text-xs text-muted">{scope(i.role, i.ministries)} · {expired ? <span className="font-semibold text-[#8a1020]">expired {day(i.expires_at)}</span> : <>sent {day(i.last_sent_at)}, good until {day(i.expires_at)}</>}</div>
                    {can ? (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => inviteAction(i, "resend")} disabled={!!busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60"><RotateCw size={15} />{expired ? "Send a new invitation" : "Resend"}</button>
                        <button onClick={() => inviteAction(i, "revoke")} disabled={!!busy} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted disabled:opacity-60">Cancel invitation</button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {off.length ? (
          <section aria-label="Removed" className="overflow-hidden rounded-2xl border border-line bg-white">
            <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Removed · {off.length}</h2>
            <ul className="divide-y divide-line">
              {off.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold text-muted">{nameOf(m)}</div><div className="truncate text-sm text-muted">{m.email} · {ROLE_LABEL[m.role]}</div>{lastSignIn ? <div className="truncate text-xs text-muted">{seen(lastSignIn, m.user_id)}</div> : null}</div>
                  {canManageTarget(me.role, m.role) ? <button disabled={!!busy} onClick={async () => { const r = await call(`/api/team/members/${m.user_id}`, { method: "PATCH", body: JSON.stringify({ disabled: false }) }, m.user_id); if (r.ok) { setNote(`${nameOf(m)} has access again.`); router.refresh(); } }} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60">Restore access</button> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-line bg-white">
          <button onClick={() => setGuide(!guide)} aria-expanded={guide} className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[15px] font-semibold text-navy"><ShieldCheck size={18} />What each role can do<span className="flex-1" /><span className="text-sm text-muted">{guide ? "Hide" : "Show"}</span></button>
          {guide ? (
            <ul className="space-y-3 border-t border-line px-4 py-4">
              {ROLES.map((r) => <li key={r} className="flex items-start gap-3"><RolePill role={r} /><span className="text-sm text-muted">{ROLE_BLURB[r]}</span></li>)}
              <li className="text-xs text-muted">Nobody approves an email they sent for approval themselves, except the owner. Anyone can send themselves a test and send feedback.</li>
            </ul>
          ) : null}
        </section>
      </main>

      {inviteOpen ? <InviteSheet grant={grant} onClose={() => setInviteOpen(false)} onDone={(msg) => { setInviteOpen(false); setNote(msg); router.refresh(); }} call={call} busy={busy} err={err} /> : null}
      {editing ? <ManageSheet m={editing} me={me} grant={grant} onClose={() => setEditing(null)} onDone={(msg) => { setEditing(null); setNote(msg); router.refresh(); }} call={call} busy={busy} err={err} /> : null}
    </div>
  );
}

type Call = (url: string, init: RequestInit, key: string) => Promise<{ ok: boolean; data: any }>;

function InviteSheet({ grant, onClose, onDone, call, busy, err }: { grant: Role[]; onClose: () => void; onDone: (msg: string) => void; call: Call; busy: string; err: string }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(grant.includes("editor") ? "editor" : grant[0]);
  const [ministries, setMinistries] = useState<string[]>([]);
  const valid = !!first.trim() && !!last.trim() && /^[^@\s]+@brainerdbaptist\.org$/i.test(email.trim()) && (role !== "editor" || ministries.length > 0);
  return (
    <Sheet title="Invite someone" onClose={() => !busy && onClose()}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block"><span className="label">First name</span><input className="field" autoComplete="off" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
        <label className="block"><span className="label">Last name</span><input className="field" autoComplete="off" value={last} onChange={(e) => setLast(e.target.value)} /></label>
      </div>
      <label className="mb-4 block"><span className="label">Church email</span>
        <input type="email" inputMode="email" autoCapitalize="none" autoComplete="off" className="field" placeholder="name@brainerdbaptist.org" value={email} onChange={(e) => setEmail(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">Only @brainerdbaptist.org addresses. They sign in with Google.</span>
      </label>
      <span className="label">Role</span>
      <RolePicker value={role} onChange={setRole} options={grant} />
      {role === "editor" ? <div className="mt-4"><MinistryPicker value={ministries} onChange={setMinistries} /></div> : null}
      {err ? <p role="alert" className="mt-4 rounded-xl bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}
      <button disabled={!valid || !!busy} onClick={async () => { const r = await call("/api/team/invites", { method: "POST", body: JSON.stringify({ firstName: first, lastName: last, email, role, ministries }) }, "invite"); if (r.ok) onDone(r.data.emailed === false ? `Invitation saved for ${first.trim()}, but the email didn't go out. Use Resend in a minute.` : `Invitation sent to ${first.trim()} ${last.trim()} (${email.trim()}).`); }} className="pill-btn mt-5 w-full bg-[#1e61b9] text-white disabled:bg-[#c4cfdc]">{busy === "invite" ? "Sending…" : "Send invitation"}</button>
    </Sheet>
  );
}

function ManageSheet({ m, me, grant, onClose, onDone, call, busy, err }: { m: Member; me: { userId: string; role: Role }; grant: Role[]; onClose: () => void; onDone: (msg: string) => void; call: Call; busy: string; err: string }) {
  const parts = nameOf(m).split(" ");
  const [first, setFirst] = useState(parts[0] ?? "");
  const [last, setLast] = useState(parts.slice(1).join(" "));
  const [role, setRole] = useState<Role>(m.role);
  const [ministries, setMinistries] = useState<string[]>(m.ministries ?? []);
  const [approves, setApproves] = useState(!!m.can_approve);
  const [handoff, setHandoff] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [off, setOff] = useState(false);
  const fullName = `${first.trim()} ${last.trim()}`.trim();
  const changed = (!!fullName && fullName !== nameOf(m)) || role !== m.role || (me.role === "owner" && approves !== !!m.can_approve) || (role === "editor" && JSON.stringify([...ministries].sort()) !== JSON.stringify([...(m.ministries ?? [])].sort()));
  const valid = role !== "editor" || ministries.length > 0;
  const url = `/api/team/members/${m.user_id}`;
  return (
    <Sheet title={nameOf(m)} onClose={() => !busy && onClose()}>
      <p className="-mt-2 mb-4 text-sm text-muted">{m.email}</p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block"><span className="label">First name</span><input className="field" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
        <label className="block"><span className="label">Last name</span><input className="field" value={last} onChange={(e) => setLast(e.target.value)} /></label>
      </div>
      <span className="label">Role</span>
      <RolePicker value={role} onChange={setRole} options={grant} />
      {role === "editor" ? <div className="mt-4"><MinistryPicker value={ministries} onChange={setMinistries} /></div> : null}
      {me.role === "owner" ? (
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" checked={approves} onChange={(e) => setApproves(e.target.checked)} className="mt-0.5 h-5 w-5" />
          <span><span className="block text-[15px] font-semibold text-ink">Can approve emails</span><span className="block text-sm text-muted">They get the approval requests and can approve or send emails back. They can't approve an email they sent themselves. You can always approve.</span></span>
        </label>
      ) : null}
      {err ? <p role="alert" className="mt-4 rounded-xl bg-[#fbe9eb] px-4 py-3 text-sm text-[#8a1020]">{err}</p> : null}
      <button disabled={!changed || !valid || !!busy} onClick={async () => { const r = await call(url, { method: "PATCH", body: JSON.stringify({ name: fullName, role, ministries, ...(me.role === "owner" ? { approves } : {}) }) }, "save"); if (r.ok) onDone(`Saved. ${fullName || nameOf(m)} is now ${role === "admin" || role === "approver" || role === "editor" ? "an" : "a"} ${ROLE_LABEL[role]}.`); }} className="pill-btn mt-5 w-full bg-[#1e61b9] text-white disabled:bg-[#c4cfdc]">{busy === "save" ? "Saving…" : "Save changes"}</button>

      <div className="mt-6 space-y-3 border-t border-line pt-4">
        {off ? (
          <div className="rounded-xl bg-[#fff3d6] p-3 text-sm text-[#5c3a00]">
            <p><b>Remove {nameOf(m)}'s access?</b> They are signed out on their next click and can't sign in again unless you restore access. Their name and past work stay on the history.</p>
            <div className="mt-3 flex gap-2">
              <button disabled={!!busy} onClick={async () => { const r = await call(url, { method: "PATCH", body: JSON.stringify({ disabled: true }) }, "off"); if (r.ok) onDone(`${nameOf(m)} no longer has access.`); }} className="pill-btn bg-[#c8102e] text-white disabled:opacity-60">{busy === "off" ? "Working…" : "Remove access"}</button>
              <button onClick={() => setOff(false)} className="pill-btn text-muted">Keep them</button>
            </div>
          </div>
        ) : <button onClick={() => { setOff(true); setHandoff(false); }} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-[#8a1020]">Remove access…</button>}

        {me.role === "owner" ? (
          handoff ? (
            <div className="rounded-xl bg-[#f4f8fd] p-3 text-sm text-ink">
              <p><b>Make {nameOf(m)} the owner?</b> You become an Admin. Only they can change Admins or hand ownership back.</p>
              <label className="mt-3 block"><span className="label">Type their email to confirm</span><input className="field" autoCapitalize="none" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={m.email} /></label>
              <div className="mt-3 flex gap-2">
                <button disabled={!!busy || confirm.trim().toLowerCase() !== m.email.toLowerCase()} onClick={async () => { const r = await call("/api/team/transfer", { method: "POST", body: JSON.stringify({ userId: m.user_id, confirmEmail: confirm }) }, "xfer"); if (r.ok) { onDone(`${nameOf(m)} is now the owner.`); window.location.assign("/team"); } }} className="pill-btn bg-[#00205b] text-white disabled:bg-[#c4cfdc]">{busy === "xfer" ? "Working…" : "Hand off ownership"}</button>
                <button onClick={() => setHandoff(false)} className="pill-btn text-muted">Cancel</button>
              </div>
            </div>
          ) : <button onClick={() => { setHandoff(true); setOff(false); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-navy"><Crown size={15} />Make owner…</button>
        ) : null}
      </div>
    </Sheet>
  );
}
