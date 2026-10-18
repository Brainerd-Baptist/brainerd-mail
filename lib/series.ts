import { etInstant, etKey } from "@/lib/calendar";

// Repeating emails. A series is a rule ("third Friday of every month at 7:00 AM"); it creates real
// send_slots a year ahead, so each one can be started, moved or skipped on its own.
export type Series = {
  id: string; ministry: string; label: string;
  kind: "nth_weekday" | "last_weekday" | "day_of_month" | "every_n_weeks";
  weekday: number | null; nth: number | null; day_of_month: number | null; interval_weeks: number | null;
  time_local: string; starts_on: string; ends_on: string | null; paused: boolean;
};
export type Repeat = "nth" | "last" | "dom" | "weekly" | "biweekly";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORD = ["", "first", "second", "third", "fourth"];
const key = (t: number) => new Date(t).toISOString().slice(0, 10);
const parts = (k: string) => ({ y: +k.slice(0, 4), m: +k.slice(5, 7), d: +k.slice(8, 10) });
const weekdayOf = (k: string) => new Date(k + "T12:00:00Z").getUTCDay();
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** Does this day belong to the series? */
export function matches(s: Pick<Series, "kind" | "weekday" | "nth" | "day_of_month" | "interval_weeks" | "starts_on">, k: string): boolean {
  const { y, m, d } = parts(k);
  if (s.kind === "nth_weekday") return weekdayOf(k) === s.weekday && Math.ceil(d / 7) === s.nth;
  if (s.kind === "last_weekday") return weekdayOf(k) === s.weekday && d + 7 > daysIn(y, m);
  if (s.kind === "day_of_month") return d === Math.min(s.day_of_month ?? 1, daysIn(y, m));
  const gap = Math.round((new Date(k + "T12:00:00Z").getTime() - new Date(s.starts_on + "T12:00:00Z").getTime()) / 86400000);
  return gap >= 0 && gap % (7 * (s.interval_weeks ?? 1)) === 0;
}

/** Every matching day from `from` to `to` (inclusive), within the series' own start and end. */
export function occurrences(s: Series, from: string, to: string): string[] {
  const out: string[] = [];
  const start = from > s.starts_on ? from : s.starts_on;
  const end = s.ends_on && s.ends_on < to ? s.ends_on : to;
  for (let t = new Date(start + "T12:00:00Z").getTime(); key(t) <= end; t += 86400000) if (matches(s, key(t))) out.push(key(t));
  return out;
}

/** Plain-language pattern, e.g. "Monthly on the third Friday at 7:00 AM". */
export function describe(s: Pick<Series, "kind" | "weekday" | "nth" | "day_of_month" | "interval_weeks" | "time_local">): string {
  const [h, mi] = s.time_local.split(":").map(Number);
  const at = `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  const day = DAYS[s.weekday ?? 0];
  const what =
    s.kind === "nth_weekday" ? `Monthly on the ${ORD[s.nth ?? 1]} ${day}` :
    s.kind === "last_weekday" ? `Monthly on the last ${day}` :
    s.kind === "day_of_month" ? `Monthly on the ${ordinal(s.day_of_month ?? 1)}` :
    (s.interval_weeks ?? 1) === 1 ? `Every week on ${day}` : `Every ${s.interval_weeks} weeks on ${day}`;
  return `${what} at ${at}`;
}

/** The choices to offer for a chosen day, with their wording. */
export function repeatOptions(dateKey: string): { value: Repeat; label: string }[] {
  const { y, m, d } = parts(dateKey);
  const day = DAYS[weekdayOf(dateKey)];
  const nth = Math.ceil(d / 7);
  const opts: { value: Repeat; label: string }[] = [];
  if (nth <= 4) opts.push({ value: "nth", label: `Monthly on the ${ORD[nth]} ${day}` });
  if (d + 7 > daysIn(y, m)) opts.push({ value: "last", label: `Monthly on the last ${day}` });
  opts.push({ value: "dom", label: `Monthly on the ${ordinal(d)}` }, { value: "weekly", label: `Every week on ${day}` }, { value: "biweekly", label: `Every 2 weeks on ${day}` });
  return opts;
}

/** Turns the form's choice into the series columns. */
export function fromRepeat(repeat: Repeat, dateKey: string, time: string): Omit<Series, "id" | "ministry" | "label" | "ends_on" | "paused"> | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const weekday = weekdayOf(dateKey);
  const base = { weekday, nth: null, day_of_month: null, interval_weeks: null, time_local: time, starts_on: dateKey };
  if (repeat === "nth") return { ...base, kind: "nth_weekday", nth: Math.min(4, Math.ceil(+dateKey.slice(8, 10) / 7)) };
  if (repeat === "last") return { ...base, kind: "last_weekday" };
  if (repeat === "dom") return { ...base, kind: "day_of_month", weekday: null, day_of_month: +dateKey.slice(8, 10) };
  if (repeat === "weekly") return { ...base, kind: "every_n_weeks", interval_weeks: 1 };
  if (repeat === "biweekly") return { ...base, kind: "every_n_weeks", interval_weeks: 2 };
  return null;
}

const HORIZON_DAYS = 400;
/** Makes sure every series has its slots, from its start (at most a year back) to about a year ahead. */
export async function ensureSlots(sb: any, series: Series[]) {
  const today = etKey(new Date());
  const to = key(new Date(today + "T12:00:00Z").getTime() + HORIZON_DAYS * 86400000);
  const back = key(new Date(today + "T12:00:00Z").getTime() - 365 * 86400000);
  const rows = series.filter((s) => !s.paused).flatMap((s) =>
    occurrences(s, back, to).map((day) => ({ series_id: s.id, occurrence_date: day, ministry: s.ministry, label: s.label, planned_at: etInstant(day, s.time_local) })));
  if (rows.length) await sb.from("send_slots").upsert(rows, { onConflict: "series_id,occurrence_date", ignoreDuplicates: true });
}
