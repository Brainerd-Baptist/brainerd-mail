import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/email-guard";
import { canBuild, ROLE_LABEL } from "@/lib/roles-ui";

export const dynamic = "force-dynamic";

// Who can be picked as a test-send recipient: everyone who currently has access to Mail.
export async function GET() {
  const w = await whoAmI();
  if (w.err) return w.err;
  if (!canBuild(w.me)) return NextResponse.json({ error: "Your role can't send tests." }, { status: 403 });
  const { data } = await w.sb.from("staff").select("name,email,role").is("disabled_at", null).order("name", { ascending: true });
  return NextResponse.json({ me: w.me.email, people: (data ?? []).map((s) => ({ name: (s.name as string) || String(s.email).split("@")[0], email: s.email as string, role: ROLE_LABEL[s.role as keyof typeof ROLE_LABEL] ?? "" })) });
}
