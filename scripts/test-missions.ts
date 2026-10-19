// Checks the Missions map: what the public may see, the email picture, the embed data, and the email block.
import { Resvg } from "@resvg/resvg-js";
import { publicView, staticMapSvg, mapShapes, cleanCountry, cleanLevels, GEO_LIST, levelsFromRows, type Country } from "../lib/missions";
import { renderEmail, renderPlainText } from "../lib/render";
import { newBlock, type EmailDoc } from "../lib/blocks";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const mk = (iso2: string, name: string, level: 1 | 2 | 3, o: Partial<Country> = {}): Country => ({ iso2, name, level, since: "2013", religion: "Islam", peopleGroup: "Secret group", unreachedGroups: "12", unreachedPop: "1 Million", isPublic: true, showPeopleGroup: true, ...o });
const levels = levelsFromRows([]);
const all = [mk("EC", "Ecuador", 1), mk("CA", "Canada", 2), mk("AF", "Afghanistan", 3, { isPublic: false }), mk("PK", "Pakistan", 3, { showPeopleGroup: false })];

const v = publicView(all, levels);
ok(v.countries.length === 3 && v.counts.total === 3, "private country is left out of the public view");
ok(!JSON.stringify(v).includes("Afghanistan"), "private country name never appears");
ok(v.countries.find((c) => c.id === "PK")!.peopleGroup === "" && v.countries.find((c) => c.id === "EC")!.peopleGroup === "Secret group", "hidden people-group names are blank, others kept");
ok(v.counts[1] === 1 && v.counts[2] === 1 && v.counts[3] === 1, "counts come from the public list");
ok(GEO_LIST.length > 200 && GEO_LIST.some((g) => g.id === "BH") && GEO_LIST.some((g) => g.id === "HK"), "map has every country, including small ones");
const sh = mapShapes(["EC", "CA"]);
ok(sh.hit.length === 2 && sh.base.length > 10000, "engaged countries are separate shapes; the rest is one land shape");

const svg = staticMapSvg(v);
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
ok(png.length > 20000 && png[0] === 0x89 && png[1] === 0x50, `email picture renders as a PNG (${(png.length / 1024).toFixed(0)} KB)`);
ok(staticMapSvg(v, { level: 2 }) !== svg, "level filter changes the picture");

ok(cleanCountry("ZZ", { level: 1, name: "X" }).ok === false, "unknown country code is refused");
ok(cleanCountry("KE", { level: 4, name: "Kenya" }).ok === false, "bad level is refused");
const c = cleanCountry("KE", { level: 2, name: "  Kenya  ", since: "2020", isPublic: false });
ok(c.ok && c.value.name === "Kenya" && c.value.isPublic === false && c.value.showPeopleGroup === true, "input is trimmed and privacy switches are respected");
ok(cleanLevels({ levels: [{ level: 1, label: "A", blurb: "" }, { level: 2, label: "B", blurb: "" }, { level: 3, label: "C", blurb: "x" }] })?.length === 3, "level names accepted");
ok(cleanLevels({ levels: [] }) === null, "incomplete level names refused");

const doc: EmailDoc = { ministry: "missions", title: "t", subject: "s", previewText: "", monthLabel: "", footerNote: "f", blocks: [newBlock("map")] };
const opts = { mode: "email" as const, wrap: (u: string) => u, unsubscribeUrl: "#", preferencesUrl: "#", address: "a", siteUrl: "https://mail.brainerdhq.app" };
const html = renderEmail(doc, opts);
ok(html.includes("https://mail.brainerdhq.app/api/public/missions-map.png") && html.includes("Explore the interactive map"), "email block shows the map picture and button");
ok(renderEmail({ ...doc, blocks: [{ ...(doc.blocks[0] as any), level: 3 }] }, opts).includes("missions-map.png?level=3"), "highlighted level goes in the picture address");
ok(renderPlainText(doc, opts).includes("brainerdbaptist.org/missions"), "plain-text version links to the map");
ok(html.includes('width="520"') && html.includes("&#9679;") === false || html.includes('width="520"'), "email picture has a fixed width for Outlook");
const web = renderEmail(doc, { ...opts, mode: "web" as const });
ok(web.includes('class="mm-frame"') && web.includes("/embed/missions-map"), "web version shows the live interactive map");
ok(!html.includes("<iframe"), "email never contains a frame");
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
