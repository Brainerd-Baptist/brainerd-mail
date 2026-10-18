import { validateEdits, applyEdit, outline, userMessage } from "../lib/polish-ai";
import { MISSIONS_TEMPLATE as D } from "../lib/templates/missions";

const hero: any = D.blocks[0];
const good = { kind: "rewrite", blockId: "hero1", field: "headline", before: hero.headline, after: "Kingdom work, around the globe.", why: "ok" };
const edits = validateEdits(D, [
  good,
  { ...good, field: "button.label", before: hero.button.label, after: "Explore the map today" },                 // ok
  { kind: "rewrite", blockId: "hero1", field: "body", before: hero.body, after: hero.body + " Join 500 of us on Oct 30." }, // invents facts -> reject
  { kind: "rewrite", blockId: "hero1", field: "headline", before: "wrong before text", after: "x" },                 // stale before -> reject
  { kind: "rewrite", blockId: "hero1", field: "image.url", before: "", after: "http://evil" },                        // disallowed field -> reject
  { kind: "rewrite", blockId: "nope", field: "headline", before: "a", after: "b" },                                    // unknown block -> reject
  { kind: "rewrite", blockId: "doc", field: "subject", before: D.subject, after: "A great venue for missions" },       // venue -> reject
  { kind: "move", blockId: "travel1", toIndex: 0, why: "ok" },
  { kind: "move", blockId: "travel1", toIndex: 99, why: "bad" },
]);
console.log(edits.map((e) => e.kind + ":" + (e as any).field + "@" + e.blockId));
if (edits.length !== 3) { console.error("expected 3 accepted edits, got", edits.length); process.exit(1); }
const a = applyEdit(D, edits[0])!;
if ((a.blocks[0] as any).headline !== good.after) { console.error("rewrite not applied"); process.exit(1); }
if (applyEdit(a, edits[0]) !== null) { console.error("stale edit should not apply twice"); process.exit(1); }
const m = applyEdit(D, edits[2])!;
if (m.blocks[0].id !== "travel1") { console.error("move failed"); process.exit(1); }
if (JSON.stringify(outline(D)).includes("http")) console.log("note: outline includes button labels only, checking for urls..."), process.exit(JSON.stringify(outline(D)).includes("brainerdbaptist.org/") ? 1 : 0);
console.log("ok", userMessage(D).length, "chars sent to the model");
