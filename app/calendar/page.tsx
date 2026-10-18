import { supabaseAdmin } from "@/lib/supabase/admin";
import { CalendarView } from "@/components/CalendarView";
import { addDays, etKey, monthGrid, weekStartOf, type CalEmail, type CalSlot } from "@/lib/calendar";
import { ensureSlots, type Series } from "@/lib/series";
import { currentMe } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar | Brainerd Mail" };

const COLS = "id,ministry,title,status,series_id,planned_at,scheduled_at,sent_at,sent_marked_by,subject:doc->>subject";

// The planner: what each ministry plans to send, and what actually went out. Signed-in staff only.
export default async function CalendarPage({ searchParams }: { searchParams: { m?: string; v?: string; d?: string } }) {
  const me = await currentMe();
  const today = etKey(new Date());
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") ? searchParams.m! : today.slice(0, 7);
  const view = searchParams.v === "week" ? "week" : "month";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? "") ? searchParams.d! : today;
  const weekStart = weekStartOf(anchor);
  const first = view === "week" ? weekStart : monthGrid(ym)[0][0];
  const last = view === "week" ? addDays(weekStart, 6) : monthGrid(ym).slice(-1)[0][6];
  // A day of slack on each side so Eastern-time days are never clipped; the view sorts them into days.
  const from = new Date(new Date(first + "T00:00:00Z").getTime() - 86400000).toISOString();
  const to = new Date(new Date(last + "T00:00:00Z").getTime() + 2 * 86400000).toISOString();
  const sb = supabaseAdmin();
  // Repeating emails: make sure their slots exist before reading them.
  const { data: seriesRows } = await sb.from("send_series").select("*").order("created_at");
  const series = (seriesRows ?? []) as Series[];
  await ensureSlots(sb, series);
  const inRange = (c: string) => `and(${c}.gte.${from},${c}.lt.${to})`;
  const [emails, slots, undated] = await Promise.all([
    sb.from("emails").select(COLS).or([inRange("planned_at"), inRange("scheduled_at"), inRange("sent_at")].join(",")).limit(500),
    sb.from("send_slots").select("id,ministry,label,note,planned_at,email_id,series_id,skipped").gte("planned_at", from).lt("planned_at", to).is("email_id", null).limit(300),
    sb.from("emails").select(COLS).in("status", ["draft", "pending_approval", "approved"]).is("planned_at", null).is("scheduled_at", null).order("updated_at", { ascending: false }).limit(40),
  ]);
  return (
    <CalendarView
      key={view === "week" ? `w${weekStart}` : `m${ym}`}
      view={view}
      ym={view === "week" ? weekStart.slice(0, 7) : ym}
      weekStart={weekStart}
      today={today}
      emails={(emails.data ?? []) as unknown as CalEmail[]}
      slots={(slots.data ?? []) as unknown as CalSlot[]}
      undated={(undated.data ?? []) as unknown as CalEmail[]}
      series={series}
      perm={{ role: me?.role ?? "viewer", ministries: me?.ministries ?? [] }}
    />
  );
}
