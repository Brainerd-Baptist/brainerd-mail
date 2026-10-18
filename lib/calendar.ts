// The email calendar's rules in one place: which date an email sits on, and whether
// it went out on time. Everything is judged in Eastern time, like the rest of the app.
export const TZ = "America/New_York";
export const ON_TIME_MIN = 60; // sent within an hour of the plan counts as on time
export const MISSED_AFTER_MIN = 120; // still unsent two hours past the plan counts as missed

export type CalEmail = {
  id: string; ministry: string; title: string; subject: string | null; status: string;
  planned_at: string | null; scheduled_at: string | null; sent_at: string | null; sent_marked_by: string | null;
};
export type CalSlot = { id: string; ministry: string; label: string; note: string | null; planned_at: string; email_id: string | null };

export type Outcome = "draft" | "waiting" | "approved" | "on_time" | "late" | "early" | "missed" | "cancelled";
export type Kind = Outcome | "slot" | "slot_missed";

/** When this email is meant to go out: the approved time if it has one, else the plan. */
export const plannedFor = (e: Pick<CalEmail, "scheduled_at" | "planned_at">) => e.scheduled_at ?? e.planned_at;
/** The moment that decides which day it sits on: when it really went out, else the plan. */
export const whenOf = (e: CalEmail) => e.sent_at ?? plannedFor(e);

export function outcome(e: CalEmail, now = Date.now()): Outcome {
  if (e.status === "cancelled") return "cancelled";
  const plan = plannedFor(e);
  if (e.status === "sent") {
    if (!plan || !e.sent_at) return "on_time";
    const diff = (new Date(e.sent_at).getTime() - new Date(plan).getTime()) / 60000;
    if (Math.abs(diff) <= ON_TIME_MIN) return "on_time";
    return diff > 0 ? "late" : "early";
  }
  if (plan && now > new Date(plan).getTime() + MISSED_AFTER_MIN * 60000) return "missed";
  if (e.status === "pending_approval") return "waiting";
  if (e.status === "approved" || e.status === "scheduled" || e.status === "sending") return "approved";
  return "draft";
}

export const LABEL: Record<Kind, string> = {
  draft: "Planned (draft)", waiting: "Waiting for approval", approved: "Approved", on_time: "Sent on time",
  late: "Sent late", early: "Sent early", missed: "Missed", cancelled: "Cancelled", slot: "Open slot", slot_missed: "Slot not used",
};
export const BADGE: Record<Kind, string> = {
  draft: "bg-[#eef1f5] text-[#33445d]", waiting: "bg-[#fff3d6] text-[#7a4a00]", approved: "bg-[#e3effc] text-[#1e4f99]",
  on_time: "bg-[#e3f3ea] text-[#17603c]", late: "bg-[#fde8d8] text-[#8a3b00]", early: "bg-[#fde8d8] text-[#8a3b00]",
  missed: "bg-[#fbe9eb] text-[#8a1020]", cancelled: "bg-[#eef1f5] text-[#6b7686]",
  slot: "bg-white text-[#33445d] border border-dashed border-[#9aa8bd]", slot_missed: "bg-[#fbe9eb] text-[#8a1020] border border-dashed border-[#d9a1a9]",
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
