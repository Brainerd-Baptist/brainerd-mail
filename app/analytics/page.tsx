import { Analytics } from "@/components/Analytics";
import { currentMe } from "@/lib/roles";
import { analyticsMinistries, canSeePeopleStats } from "@/lib/roles-ui";
import { PALETTES, swatch } from "@/lib/ministries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics | Brainerd Mail" };

// What people did with the emails: opens, clicks, devices, timing, by ministry and by email.
export default async function AnalyticsPage() {
  const me = await currentMe();
  const mine = me ? analyticsMinistries(me) : null;
  const ministries = Object.values(PALETTES).filter((p) => !mine || mine.includes(p.key)).map((p) => ({ key: p.key, label: p.label, color: swatch(p) }));
  return <Analytics ministries={ministries} people={!!me && canSeePeopleStats(me)} own={!!mine} />;
}
