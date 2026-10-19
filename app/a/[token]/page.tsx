import { resolveAction } from "@/lib/review-core";
import { paletteFor } from "@/lib/ministries";
import { siteUrl } from "@/lib/site";
import { ActionPage } from "@/components/ActionPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review an email | Brainerd Mail", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const wrap = (children: React.ReactNode) => (
  <main style={{ minHeight: "100dvh", background: "#f1f5f9", display: "grid", placeItems: "center", padding: "24px 16px", fontFamily: "Barlow, system-ui, sans-serif" }}>
    <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <div style={{ background: "#00205b", padding: "22px 24px" }}><img src="/brand/brainerd-full-white.png" alt="Brainerd Baptist Church" width={160} height={37} style={{ display: "block", width: 160, height: "auto" }} /></div>
      <div style={{ padding: 24, color: "#33445d", fontSize: 16, lineHeight: 1.5 }}>{children}</div>
    </div>
  </main>
);

// Opened from the buttons in an approval email. No sign-in: the link itself is the key.
export default async function Page({ params, searchParams }: { params: { token: string }; searchParams: { do?: string } }) {
  const r = await resolveAction(params.token);
  const dash = (id: string) => `${siteUrl()}/review/${id}`;
  if (r.state === "invalid") return wrap(<><h1 style={{ margin: 0, fontSize: 22, color: "#00205b" }}>This link isn’t valid</h1><p>Open the newest approval request in your email, or use Brainerd Mail directly.</p></>);
  if (r.state === "expired") return wrap(<><h1 style={{ margin: 0, fontSize: 22, color: "#00205b" }}>This link has expired</h1><p>Links last a week. Open the newest approval request in your email, or use Brainerd Mail directly.</p></>);
  if (r.state === "noaccess") return wrap(<><h1 style={{ margin: 0, fontSize: 22, color: "#00205b" }}>Your access has changed</h1><p>You can no longer approve emails. Ask the owner if that’s a mistake.</p></>);
  if (r.state === "gone") {
    const msg = r.status === "changed" ? "was changed or sent for approval again after that message went out." : r.status === "draft" ? "was sent back for changes." : r.status === "approved" ? "has already been approved." : `is now ${r.status.replace("_", " ")}.`;
    return wrap(<><h1 style={{ margin: 0, fontSize: 22, color: "#00205b" }}>Nothing to do here</h1><p>“{r.title}” {msg}</p><p><a href={dash(r.emailId)} style={{ color: "#1e61b9", fontWeight: 700 }}>Open it in Brainerd Mail</a></p></>);
  }
  const p = paletteFor(r.row.ministry);
  return <ActionPage token={params.token} title={r.row.title} subject={r.row.doc.subject} ministry={p.label} sendAt={r.row.scheduled_at} approverName={r.actor.name} own={r.own} preset={searchParams.do === "changes" ? "changes" : searchParams.do === "approve" ? "approve" : null} dashUrl={dash(r.row.id)} />;
}
