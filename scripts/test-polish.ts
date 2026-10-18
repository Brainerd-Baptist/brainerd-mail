import { polish, tidyText } from "../lib/polish";
import { MISSIONS_TEMPLATE } from "../lib/templates/missions";
import { newBlock } from "../lib/blocks";
import type { EmailDoc } from "../lib/blocks";

const clean = polish(MISSIONS_TEMPLATE);
console.log("Missions template suggestions:", clean.map((s) => `${s.rule}${s.blockId ? "@" + s.blockId : ""}`));

const hero = newBlock("hero");
if (hero.type === "hero") { hero.headline = "OUR AMAZING HEADLINE ABOUT EVERYTHING GOD IS DOING AROUND THE WORLD THIS MONTH"; hero.showImage = true; hero.button = { label: "Click here", url: "https://x.org" }; }
const messy: EmailDoc = {
  ...MISSIONS_TEMPLATE,
  subject: "BIG NEWS!! READ THIS!!",
  previewText: "BIG NEWS!! READ THIS!!",
  blocks: [newBlock("divider"), hero, newBlock("text"), { ...newBlock("text"), body: "We're thrilled  to share \"good news\"... come see the venue ." } as any, newBlock("divider"), newBlock("divider")],
};
const found = polish(messy);
console.log("Messy suggestions:", found.map((s) => s.rule));
let d = messy;
for (let pass = 0; pass < 5; pass++) { const m = polish(d).filter((x) => x.kind === "mechanical" && x.fix); if (!m.length) break; for (const s of m) d = s.fix!.apply(d); }
console.log("after mechanical fixes:", polish(d).map((s) => s.rule));
console.log(JSON.stringify(tidyText("We're  thrilled \"hi\"...  ok .")));
const must = ["tidy", "subject-caps", "preview-same", "headline-long", "headline-caps", "hero-image-empty", "button-generic", "placeholder", "venue", "divider", "no-hero"];
const miss = must.filter((r) => !found.some((s) => s.rule === r));
if (miss.length) { console.error("MISSING RULES:", miss); process.exit(1); }
if (polish(d).some((s) => s.kind === "mechanical")) { console.error("mechanical fixes did not clear"); process.exit(1); }
console.log("ok");
