import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isRole, type Me, type Role } from "@/lib/roles-ui";
export * from "@/lib/roles-ui";

type Row = { user_id: string; email: string; name: string | null; role: string; ministries: string[] | null; disabled_at: string | null };
const toMe = (r: Row): Me | null => (r.disabled_at || !isRole(r.role) ? null : { userId: r.user_id, email: r.email, name: r.name, role: r.role, ministries: r.ministries ?? [] });

export async function meFor(userId: string): Promise<Me | null> {
  const { data } = await supabaseAdmin().from("staff").select("user_id,email,name,role,ministries,disabled_at").eq("user_id", userId).maybeSingle();
  return data ? toMe(data as Row) : null;
}

// The signed-in person and their current role, or null if signed out / deactivated / not on the team.
export async function currentMe(): Promise<Me | null> {
  const { data } = await supabaseServer().auth.getUser();
  return data.user ? meFor(data.user.id) : null;
}

// Everyone who should be told an email needs approval (and who gets feedback).
export async function emailsWithRole(roles: Role[]): Promise<string[]> {
  const { data } = await supabaseAdmin().from("staff").select("email,role,disabled_at").in("role", roles).is("disabled_at", null);
  return (data ?? []).map((r) => r.email as string);
}
export const approverEmails = () => emailsWithRole(["owner", "admin", "approver"]);
export const feedbackEmails = () => emailsWithRole(["owner", "admin"]);
