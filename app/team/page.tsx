import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentMe, canManageTeam } from "@/lib/roles";
import { TeamManager, type Member, type Invite } from "@/components/TeamManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team | Brainerd Mail" };

// Owner and admins: who is on the team, invitations, roles.
export default async function TeamPage() {
  const me = await currentMe();
  if (!me || !canManageTeam(me)) redirect("/emails");
  const sb = supabaseAdmin();
  const [{ data: people }, { data: invites }] = await Promise.all([
    sb.from("staff").select("user_id,email,name,role,ministries,disabled_at,created_at").order("created_at", { ascending: true }),
    sb.from("invites").select("id,email,role,ministries,created_at,expires_at,last_sent_at").is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  return <TeamManager me={{ userId: me.userId, role: me.role }} members={(people ?? []) as Member[]} invites={(invites ?? []) as Invite[]} />;
}
