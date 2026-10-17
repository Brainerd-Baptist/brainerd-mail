import { writeFileSync, mkdirSync } from "fs";
import { renderEmail, renderPlainText } from "../lib/render";
import { MISSIONS_TEMPLATE } from "../lib/templates/missions";
import { CHURCH_ADDRESS, CONTACT_EMAIL } from "../lib/church";

const links: string[] = [];
const opts = {
  mode: "email" as const,
  wrap: (url: string, id: string) => { links.push(url); return url; },
  webUrl: "http://localhost:3000/w/test",
  unsubscribeUrl: "http://localhost:3000/u/test",
  preferencesUrl: "http://localhost:3000/p/test",
  address: CHURCH_ADDRESS,
  contactEmail: CONTACT_EMAIL,
  siteUrl: "http://localhost:3000",
};
const html = renderEmail(MISSIONS_TEMPLATE, opts);
mkdirSync("out", { recursive: true });
writeFileSync("out/missions.html", html);
writeFileSync("out/missions.txt", renderPlainText(MISSIONS_TEMPLATE, opts));
const kb = Buffer.byteLength(html) / 1024;
console.log(`html ${kb.toFixed(1)} KB (Gmail clips near 102 KB), ${links.length} links`);
if (kb > 100) { console.error("too large"); process.exit(1); }
