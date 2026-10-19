import { supabaseAdmin } from "@/lib/supabase/admin";
import { paletteFor, swatch } from "@/lib/ministries";
import { CONTACT_EMAIL } from "@/lib/church";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email preferences · Brainerd Baptist Church", robots: { index: false } };


export default async function Unsubscribe({ params, searchParams }: { params: { token: string }; searchParams: { done?: string; error?: string } }) {
  let ministry = "";
  if (/^[0-9a-f]{24}$/.test(params.token)) {
    const { data: r } = await supabaseAdmin().from("recipients").select("sends(emails(ministry))").eq("token", params.token).maybeSingle();
    ministry = ((r as any)?.sends?.emails?.ministry as string) ?? "";
  }
  const p = paletteFor(ministry || "church-wide");
  const name = ministry ? p.label : "";
  const known = !!ministry;
  const done = !!searchParams.done;
  return (
    <main style={{ minHeight: "100dvh", background: p.tint, display: "grid", placeItems: "center", padding: "24px 16px", fontFamily: "Barlow, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, border: `1px solid ${p.tint}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div style={{ background: swatch(p), padding: "22px 24px" }}><img src="/brand/brainerd-full-white.png" alt="Brainerd Baptist Church" width={160} height={37} style={{ display: "block", width: 160, height: "auto" }} /></div>
        <div style={{ padding: 24 }}>
          {done ? (
            <>
              <h1 style={{ margin: 0, fontSize: 24, color: p.dark }}>You're unsubscribed.</h1>
              <p style={{ fontSize: 16, lineHeight: 1.5, color: "#33445d" }}>You won't get any more {name} emails. Your other Brainerd emails and texts aren't affected. It can take a little while for the change to reach every list.</p>
            </>
          ) : known ? (
            <>
              <h1 style={{ margin: 0, fontSize: 24, color: p.dark }}>Unsubscribe from {name} emails?</h1>
              <p style={{ fontSize: 16, lineHeight: 1.5, color: "#33445d" }}>You'll stop getting {name} emails from Brainerd. You'll stay on our other lists, and text messages aren't affected. To stop texts, reply STOP to any text.</p>
              <form method="post" action={`/api/unsubscribe/${params.token}`}>
                <button type="submit" style={{ width: "100%", height: 52, borderRadius: 999, border: 0, background: p.button, color: p.btnText, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Unsubscribe from {name} emails</button>
              </form>
            </>
          ) : (
            <>
              <h1 style={{ margin: 0, fontSize: 24, color: p.dark }}>We couldn't find that link.</h1>
              <p style={{ fontSize: 16, lineHeight: 1.5, color: "#33445d" }}>Please write us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we'll take care of it.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
