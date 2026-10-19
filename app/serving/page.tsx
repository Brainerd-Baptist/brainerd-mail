import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fromRow, groupByRegion, regionId, type Row } from "@/lib/serving";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Members Serving Globally | Brainerd Baptist Church",
  description: "The Brainerd family members we have sent around the world, and how to pray for them.",
  robots: { index: false, follow: false },
};

const CSS = `
.sv{--bg:#f1f5f9;--card:#fff;--ink:#0b1b33;--muted:#5b6b82;--line:#d6dfeb;--dark:#00205b;--accent:#1e61b9;--tint:#e8eff9;--soft:#c9d9f0;background:var(--bg);color:var(--ink);min-height:100%;font-family:Barlow,system-ui,sans-serif;font-size:17px;line-height:1.5}
@media (prefers-color-scheme:dark){.sv{--bg:#0a1424;--card:#111c2e;--ink:#e9eff7;--muted:#93a4bd;--line:#26364f;--accent:#7fb0ee;--tint:#16253d}}
.sv *{box-sizing:border-box}
.sv-top{background:var(--dark);color:#fff;padding:22px max(20px,env(safe-area-inset-left)) 28px}
.sv-in{max-width:1000px;margin:0 auto}
.sv-top img{display:block;height:34px;width:auto;margin-bottom:26px}
.sv h1{font-family:"Source Serif 4",Georgia,serif;font-size:clamp(30px,6vw,46px);line-height:1.08;margin:0;text-wrap:balance}
.sv-lede{color:var(--soft);margin:12px 0 0;max-width:56ch}
.sv-nav{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:10px max(20px,env(safe-area-inset-left))}
.sv-nav .sv-in{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
.sv-nav a{flex:none;font-weight:600;font-size:15px;color:var(--ink);text-decoration:none;border:1px solid var(--line);background:var(--card);padding:6px 14px;border-radius:999px}
.sv-nav a:hover,.sv-nav a:focus-visible{border-color:var(--accent);color:var(--accent)}
.sv-main{padding:8px max(20px,env(safe-area-inset-left)) 56px}
.sv-reg{padding-top:36px;scroll-margin-top:56px}
.sv-reg h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 16px;display:flex;align-items:center;gap:14px}
.sv-reg h2::after{content:"";flex:1;height:1px;background:var(--line)}
.sv-grid{display:grid;grid-template-columns:1fr;gap:20px;list-style:none;margin:0;padding:0}
@media (min-width:720px){.sv-grid{grid-template-columns:1fr 1fr}}
.sv-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-width:0}
.sv-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;object-position:50% 30%;background:var(--tint)}
.sv-body{padding:18px 20px 22px;display:flex;flex-direction:column;gap:8px}
.sv-card h3{font-family:"Source Serif 4",Georgia,serif;font-size:21px;line-height:1.2;margin:0;text-wrap:balance}
.sv-meta{display:flex;flex-wrap:wrap;gap:8px}
.sv-meta span{font-size:14px;font-weight:600;background:var(--tint);color:var(--accent);padding:3px 11px;border-radius:999px}
.sv-meta span.d{color:var(--muted)}
.sv-card p{margin:2px 0 0;color:var(--ink)}
.sv-foot{border-top:1px solid var(--line);padding:28px max(20px,env(safe-area-inset-left)) calc(36px + env(safe-area-inset-bottom));color:var(--muted);font-size:15px}
.sv-foot a{color:var(--accent);font-weight:600}
`;

export default async function ServingPage() {
  let rows: Row[] = [];
  try {
    const { data } = await supabaseAdmin().from("serving_members").select("*").eq("hidden", false).order("sort", { ascending: true });
    rows = (data ?? []) as Row[];
  } catch { /* storage not connected: show an empty page */ }
  const groups = groupByRegion(rows.map(fromRow));
  const updated = rows.map((r) => r.updated_at ?? "").sort().pop();
  const when = updated ? new Date(updated).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" }) : "";

  return (
    <div className="sv">
      <style>{CSS}</style>
      <header className="sv-top">
        <div className="sv-in">
          <img src="/brand/logo-missions.png" alt="Brainerd Missions" />
          <h1>Members serving globally</h1>
          <p className="sv-lede">Brainerd family members we have sent to share Christ’s love around the world. Please pray for them by name.</p>
        </div>
      </header>
      {groups.length > 1 ? (
        <nav className="sv-nav" aria-label="Regions"><div className="sv-in">{groups.map((g) => <a key={g.region} href={`#${regionId(g.region)}`}>{g.region}</a>)}</div></nav>
      ) : null}
      <main className="sv-main"><div className="sv-in">
        {groups.length === 0 ? <p style={{ paddingTop: 36 }}>The list is being updated. Please check back soon.</p> : null}
        {groups.map((g) => (
          <section key={g.region} id={regionId(g.region)} className="sv-reg" aria-labelledby={`h-${regionId(g.region)}`}>
            <h2 id={`h-${regionId(g.region)}`}>{g.region}</h2>
            <ul className="sv-grid">
              {g.members.map((m) => (
                <li key={m.id} className="sv-card">
                  {m.photo ? <img src={m.photo} alt={`${m.who}${m.place ? `, serving in ${m.place}` : ""}`} loading="lazy" /> : null}
                  <div className="sv-body">
                    <h3>{m.who}</h3>
                    <div className="sv-meta">{m.place ? <span>{m.place}</span> : null}{m.deployed ? <span className="d">Deployed {m.deployed}</span> : null}</div>
                    {m.note ? <p>{m.note}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div></main>
      <footer className="sv-foot"><div className="sv-in">
        Questions? Write <a href="mailto:missions@brainerdbaptist.org">missions@brainerdbaptist.org</a>.{when ? ` Updated ${when}.` : ""}
      </div></footer>
    </div>
  );
}
