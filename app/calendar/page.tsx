import { supabaseAdmin } from "@/lib/supabase/admin";
import { CalendarView } from "@/components/CalendarView";
import { etKey, monthGrid, type CalEmail, type CalSlot } from "@/lib/calendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar | Brainerd Mail" };

const COLS = "id,ministry,title,status,planned_at,scheduled_at,sent_at,sent_marked_by,subject:doc->>subject";

// The planner: what each ministry plans to send, and what actually went out. Signed-in staff only.
export default async function CalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const today = etKey(new Date());
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") ? searchParams.m! : today.slice(0, 7);
  const grid = monthGrid(ym);
  // A day of slack on each side so Eastern-time days are never clipped; the view sorts them into days.
  const from = new Date(new Date(grid[0][0] + "T00:00:00Z").getTime() - 86400000).toISOString();
  const to = new Date(new Date(grid[grid.length - 1][6] + "T00:00:00Z").getTime() + 2 * 86400000).toISOString();
  const sb = supabaseAdmin();
  const inRange = (c: string) => `and(${c}.gte.${from},${c}.lt.${to})`;
  const [emails, slots, undated] = await Promise.all([
    sb.from("emails").select(COLS).or([inRange("planned_at"), inRange("scheduled_at"), inRange("sent_at")].join(",")).limit(500),
    sb.from("send_slots").select("id,ministry,label,note,planned_at,email_id").gte("planned_at", from).lt("planned_at", to).is("email_id", null).limit(300),
    sb.from("emails").select(COLS).in("status", ["draft", "pending_approval", "approved"]).is("planned_at", null).is("scheduled_at", null).order("updated_at", { ascending: false }).limit(40),
  ]);
  return (
    <CalendarView
      ym={ym}
      today={today}
      emails={(emails.data ?? []) as unknown as CalEmail[]}
      slots={(slots.data ?? []) as unknown as CalSlot[]}
      undated={(undated.data ?? []) as unknown as CalEmail[]}
    />
  );
}
