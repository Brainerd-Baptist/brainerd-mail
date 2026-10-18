import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";
import { feedbackEmails, currentMe, canSeeFeedback, canManageTeam, canEditRoster } from "@/lib/roles";

const KINDS = { problem: "Problem", feature: "Feature request", feedback: "Feedback" } as const;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// "Report a problem / request a feature / give feedback" from inside the builder.
// Saved to the feedback table and emailed to the admins (best effort).
export async function POST(req: Request) {
  const { data } = await supabaseServer().auth.getUser();
  const user = data.user;
  if (!user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Feedback isn't switched on yet." }, { status: 501 });
  if (!(await currentMe())) return NextResponse.json({ error: "Your access to Brainerd Mail has changed." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind as keyof typeof KINDS;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  if (!(kind in KINDS)) return NextResponse.json({ error: "Pick what kind of note this is." }, { status: 400 });
  if (message.length < 3) return NextResponse.json({ error: "Write a few words first." }, { status: 400 });
  const context = body.context && typeof body.context === "object" ? JSON.parse(JSON.stringify(body.context).slice(0, 4000)) : {};

  try {
    const admin = supabaseAdmin();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("feedback").select("id", { count: "exact", head: true }).eq("created_by", user.id).gte("created_at", since);
    if ((count ?? 0) >= 20) return NextResponse.json({ error: "That's a lot of notes in an hour. Try again a little later." }, { status: 429 });

    const { error } = await admin.from("feedback").insert({ created_by: user.id, email: user.email, kind, message, context });
    if (error) throw new Error("Could not save");

    if (process.env.RESEND_API_KEY) {
      const ctx = Object.entries(context).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n");
      const text = `${KINDS[kind]} from ${user.email}\n\n${message}\n\n---\n${ctx}`;
      const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#1b2a41"><p><b>${KINDS[kind]}</b> from ${esc(user.email)}</p><p style="white-space:pre-wrap">${esc(message)}</p><pre style="font-size:12px;color:#5b6b80;white-space:pre-wrap">${esc(ctx)}</pre></div>`;
      await Promise.all((await feedbackEmails()).map((to) => sendEmail({ to, subject: `[Brainerd Mail] ${KINDS[kind]}: ${message.slice(0, 60)}`, html, text, replyTo: user.email! }).catch(() => null)));
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not send that right now. Please try again." }, { status: 502 });
  }
}

// Owner and admins: the inbox list. Anyone signed in: ?summary=1 says what their role lets them see (for the menu) and how many notes are new.
export async function GET(req: Request) {
  const me = await currentMe();
  const summary = new URL(req.url).searchParams.get("summary");
  if (!me) return summary ? NextResponse.json({ role: null }) : NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const admin = canSeeFeedback(me);
  const info = { role: me.role, email: me.email, name: me.name, admin, team: canManageTeam(me), roster: canEditRoster(me) };
  if (!admin) return summary ? NextResponse.json(info) : NextResponse.json({ error: "Owner and admins only" }, { status: 403 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ...info, new: 0, items: [] });
  const db = supabaseAdmin();
  if (summary) {
    const { count } = await db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new");
    return NextResponse.json({ ...info, new: count ?? 0 });
  }
  const { data: items } = await db.from("feedback").select("*").order("created_at", { ascending: false }).limit(300);
  return NextResponse.json({ ...info, items: items ?? [] });
}
