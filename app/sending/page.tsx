import { redirect } from "next/navigation";
import { SendingPanel } from "@/components/SendingPanel";
import { currentMe, canManageTeam } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sending | Brainerd Mail" };

// The master switch for real sending. Owner and admins only.
export default async function SendingPage() {
  const me = await currentMe();
  if (!me || !canManageTeam(me)) redirect("/emails");
  return <SendingPanel />;
}
