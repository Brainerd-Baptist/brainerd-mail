// The email calendar's rules in one place: which date an email sits on, and whether
// it went out on time. Everything is judged in Eastern time, like the rest of the app.
export const TZ = "America/New_York";
// Timing is judged by the calendar day (Eastern), not the hour: sent on or before the planned day is
// on time, any later day is late, and a planned day that ends with nothing sent is missed.

export type CalEmail = {
  series_id?: string | null;
  id: string; ministry: string; title: string; subject: string | null; status: string;
  planned_at: string | null; scheduled_at: string | null; sent_at: string | null; sent_marked_by: string | null;
};
export type CalSlot = { id: string; ministry: string; label: string; note: string | null; planned_at: string; email_id: string | null; series_id: string | null; skipped: boolean };

export type Outcome = "draft" | "waiting" | "approved" | "on_time" | "late" | "missed" | "cancelled";
export type Kind = Outcome | "slot" | "slot_missed" | "skipped";

/** When this email is meant to go out: the approved time if it has one, else the plan. */
export const plannedFor = (e: Pick<CalEmail, "scheduled_at" | "planned_at">) => e.scheduled_at ?? e.planned_at;
/** The moment that decides which day it sits on: when it really went out, else the plan. */
export const whenOf = (e: CalEmail) => e.sent_at ?? plannedFor(e);

/** Whole days from one day key to another (positive when b is later). */
export const dayDiff = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function outcome(e: CalEmail, now = Date.now()): Outcome {
  if (e.status === "cancelled") return "cancelled";
  const plan = plannedFor(e);
  if (e.status === "sent") {
    if (!plan || !e.sent_at) return "on_time";
    return dayDiff(etKey(plan), etKey(e.sent_at)) > 0 ? "late" : "on_time";
  }
  if (plan && dayDiff(etKey(plan), etKey(new Date(now))) > 0) return "missed";
  if (e.status === "pending_approval") return "waiting";
  if (e.status === "approved" || e.status === "scheduled" || e.status === "sending") return "approved";
  return "draft";
}

/** "Sent 2 days late", "Sent a day early", "1 day overdue": the day-based note for a card. */
export function timingNote(e: CalEmail, now = Date.now()): string | null {
  const plan = plannedFor(e);
  if (!plan) return null;
  if (e.status === "sent" && e.sent_at) {
    const d = dayDiff(etKey(plan), etKey(e.sent_at));
    return d === 0 ? "Sent on the planned day" : d > 0 ? `Sent ${plural(d)} late` : `Sent ${d === -1 ? "a day" : plural(-d)} early`;
  }
  if (e.status === "cancelled") return null;
  const over = dayDiff(etKey(plan), etKey(new Date(now)));
  return over > 0 ? `${plural(over)} overdue` : null;
}

/** The last day an email can go for approval and still give the 72 hours. */
export const approvalDeadline = (plan: string) => new Date(new Date(plan).getTime() - 72 * 3600000).toISOString();

export const LABEL: Record<Kind, string> = {
  draft: "Planned (draft)", waiting: "Waiting for approval", approved: "Approved", on_time: "Sent on time",
  late: "Sent late", missed: "Missed", cancelled: "Cancelled", slot: "Open slot", slot_missed: "Slot not used", skipped: "Skipped",
};
export const BADGE: Record<Kind, string> = {
  draft: "bg-[#eef1f5] text-[#33445d]", waiting: "bg-[#fff3d6] text-[#7a4a00]", approved: "bg-[#e3effc] text-[#1e4f99]",
  on_time: "bg-[#e3f3ea] text-[#17603c]", late: "bg-[#fde8d8] text-[#8a3b00]",
  missed: "bg-[#fbe9eb] text-[#8a1020]", cancelled: "bg-[#eef1f5] text-[#6b7686]",
  slot: "bg-white text-[#33445d] border border-dashed border-[#9aa8bd]", slot_missed: "bg-[#fbe9eb] text-[#8a1020] border border-dashed border-[#d9a1a9]", skipped: "bg-[#f3f5f8] text-[#6b7686] border border-dashed border-[#c8d0dc]",
};

/** "2026-10-17" for the Eastern-time day an instant falls on. */
export const etKey = (iso: string | Date) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
export const shortTime = (iso: string) => timeLabel(iso).replace(":00", "").replace(" AM", "a").replace(" PM", "p");
export const dayTitle = (key: string) => new Date(key + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** Rows of seven day keys (Sunday first) covering the month. */
export function monthGrid(ym: string): string[][] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86400000);
  const last = new Date(Date.UTC(y, m, 0));
  const weeks = Math.ceil((first.getUTCDay() + last.getUTCDate()) / 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => new Date(start.getTime() + (w * 7 + d) * 86400000).toISOString().slice(0, 10)));
}
export const shiftMonth = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};
export const monthTitle = (ym: string) => new Date(ym + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Value for an <input type="datetime-local"> in the browser's own time. */
export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The UTC instant for a wall-clock time on an Eastern day ("2026-11-20", "07:00"). */
export function etInstant(key: string, hhmm: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let t = want;
  for (let i = 0; i < 3; i++) {
    const [dd, tt] = new Date(t).toLocaleString("sv-SE", { timeZone: TZ }).split(" ");
    const [Y, M, D] = dd.split("-").map(Number);
    const [H, Mi] = tt.split(":").map(Number);
    t += want - Date.UTC(Y, M - 1, D, H, Mi);
  }
  return new Date(t).toISOString();
}
