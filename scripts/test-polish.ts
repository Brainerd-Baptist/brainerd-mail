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
import { measure, judge } from "../lib/image-quality";
const W = 64, H = 64;
const flat = (v: number) => { const a = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { a[i*4] = v; a[i*4+1] = v; a[i*4+2] = v; a[i*4+3] = 255; } return a; };
const checker = () => { const a = flat(0); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = (x + y) % 2 ? 230 : 120; const i = (y * W + x) * 4; a[i] = a[i+1] = a[i+2] = v; } return a; };
const jd = judge(measure(flat(30), W, H), 1600);
const jb = judge(measure(checker(), W, H), 1600);
const js = judge(measure(checker(), W, H), 600);
if (!jd.dark || !jd.soft) { console.error("flat dark image should be dark and soft", jd); process.exit(1); }
if (jb.dark || jb.soft || jb.small) { console.error("bright detailed image should pass", jb); process.exit(1); }
if (!js.small) { console.error("narrow source should be small", js); process.exit(1); }
const ph: any = { ...MISSIONS_TEMPLATE, blocks: [{ id: "p1", type: "photo", image: { url: "https://x/y/abc123.jpg", alt: "a", quality: jd }, caption: "" }] };
const pr = polish(ph).filter((s) => s.kind === "photo").map((s) => s.rule);
if (!pr.includes("photo-dark") || !pr.includes("photo-soft")) { console.error("photo rules missing", pr); process.exit(1); }
console.log("photo rules:", pr);
console.log("ok");
