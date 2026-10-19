import { redirect } from "next/navigation";
import { Audience } from "@/components/Audience";
import { currentMe, canManageTeam } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audiences | Brainerd Mail" };

// Compare each ministry's ClearStream list with who Mail would email. Owner and admins only.
export default async function AudiencePage() {
  const me = await currentMe();
  if (!me || !canManageTeam(me)) redirect("/emails");
  return <Audience />;
}
