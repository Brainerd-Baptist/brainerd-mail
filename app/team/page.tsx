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
    sb.from("invites").select("id,email,first_name,last_name,role,ministries,created_at,expires_at,last_sent_at").is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  // Owner only: when each person last signed in (read from the sign-in system, never sent to anyone else).
  let lastSignIn: Record<string, string | null> | null = null;
  if (me.role === "owner") {
    lastSignIn = {};
    const rows = await Promise.all((people ?? []).map(async (p) => {
      try { const { data } = await sb.auth.admin.getUserById(p.user_id as string); return [p.user_id as string, data.user?.last_sign_in_at ?? null] as const; } catch { return [p.user_id as string, null] as const; }
    }));
    for (const [k, v] of rows) lastSignIn[k] = v;
  }
  return <TeamManager me={{ userId: me.userId, role: me.role }} members={(people ?? []) as Member[]} invites={(invites ?? []) as Invite[]} lastSignIn={lastSignIn} />;
}
