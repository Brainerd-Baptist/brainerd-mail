import { EmailReport } from "@/components/EmailReport";
import { currentMe } from "@/lib/roles";
import { canSeePeopleStats } from "@/lib/roles-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email report | Brainerd Mail" };

export default async function EmailReportPage({ params }: { params: { id: string } }) {
  const me = await currentMe();
  return <EmailReport id={params.id} people={!!me && canSeePeopleStats(me)} />;
}
