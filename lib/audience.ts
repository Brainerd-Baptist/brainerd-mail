import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchListPeople, type CsPerson } from "@/lib/clearstream";

// Compares a ministry's ClearStream list with who Mail would actually email.
// Mail emails = ClearStream list (active) − no email address − email not subscribed − duplicates − people who unsubscribed in Mail.
export type Member = { id: string; name: string; email: string; ok: boolean; why?: string };
export type Reason = "no_email" | "email_off" | "duplicate" | "mail_unsub";
export const REASON_LABEL: Record<Reason, string> = { no_email: "No email address", email_off: "Email turned off in ClearStream", duplicate: "Same address listed twice", mail_unsub: "Unsubscribed in Brainerd Mail" };

const OFF = /unsub|opt|bounce|invalid|block|complain|suppress|inactive|disabled|stop|undeliver/;

export type Excluded = { id: string; name: string; email: string; reason: Reason; detail?: string };
export type Check = {
  ministry: string; listId: string; takenAt: string;
  total: number; mailCount: number; expected: number | null;
  excluded: Excluded[]; statusMix: Record<string, number>;
  prev: null | { takenAt: string; total: number; mailCount: number };
  added: { id: string; name: string; email: string }[]; removed: { id: string; name: string; email: string }[];
  changedEmailable: { id: string; name: string; now: "emailable" | "excluded" }[];
};

export function classify(people: CsPerson[], suppressed: Set<string>) {
  const seen = new Set<string>();
  const members: Member[] = [];
  const excluded: Excluded[] = [];
  const statusMix: Record<string, number> = {};
  for (const p of people) {
    const st = p.emailStatus || "(blank)";
    statusMix[st] = (statusMix[st] ?? 0) + 1;
    let why: Reason | undefined;
    if (!p.email) why = "no_email";
    else if (p.emailStatus && OFF.test(p.emailStatus)) why = "email_off";
    else if (seen.has(p.email)) why = "duplicate";
    else if (suppressed.has(p.email)) why = "mail_unsub";
    if (p.email && !why) seen.add(p.email);
    members.push({ id: p.id, name: p.name, email: p.email, ok: !why, why });
    if (why) excluded.push({ id: p.id, name: p.name, email: p.email, reason: why, detail: why === "email_off" ? p.emailStatus : undefined });
  }
  return { members, excluded, statusMix };
}

export async function runCheck(ministry: string, userId: string): Promise<Check> {
  const sb = supabaseAdmin();
  const { data: map } = await sb.from("audience_lists").select("list_id,expected").eq("ministry", ministry).maybeSingle();
  if (!map) throw new Error("Choose which ClearStream list this ministry uses first.");
  const people = await fetchListPeople(map.list_id as string);
  const { data: sup } = await sb.from("suppressions").select("email").eq("ministry", ministry);
  const suppressed = new Set((sup ?? []).map((s) => String(s.email).toLowerCase()));
  const { members, excluded, statusMix } = classify(people, suppressed);

  const { data: prevRow } = await sb.from("audience_snapshots").select("taken_at,total,email_ok,members").eq("ministry", ministry).order("taken_at", { ascending: false }).limit(1).maybeSingle();
  const takenAt = new Date().toISOString();
  const mailCount = members.filter((m) => m.ok).length;
  const compact = members.map((m) => ({ id: m.id, n: m.name, e: m.email, ok: m.ok }));
  await sb.from("audience_snapshots").insert({ ministry, taken_by: userId, list_id: map.list_id, total: people.length, email_ok: mailCount, text_ok: 0, members: compact });

  let added: Check["added"] = [], removed: Check["removed"] = [], changedEmailable: Check["changedEmailable"] = [];
  let prev: Check["prev"] = null;
  if (prevRow) {
    const old = new Map<string, { id: string; n: string; e: string; ok: boolean }>(((prevRow.members as any[]) ?? []).map((m) => [m.id, m]));
    const now = new Map(members.map((m) => [m.id, m]));
    added = members.filter((m) => !old.has(m.id)).map((m) => ({ id: m.id, name: m.name, email: m.email }));
    removed = Array.from(old.values()).filter((m) => !now.has(m.id)).map((m) => ({ id: m.id, name: m.n, email: m.e }));
    changedEmailable = members.filter((m) => old.has(m.id) && old.get(m.id)!.ok !== m.ok).map((m) => ({ id: m.id, name: m.name, now: m.ok ? "emailable" : "excluded" }));
    prev = { takenAt: prevRow.taken_at as string, total: prevRow.total as number, mailCount: prevRow.email_ok as number };
  }
  return { ministry, listId: map.list_id as string, takenAt, total: people.length, mailCount, expected: (map.expected as number | null) ?? null, excluded, statusMix, prev, added, removed, changedEmailable };
}
