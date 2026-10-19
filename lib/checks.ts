import type { EmailDoc, Block } from "./blocks";
import { BLOCK_LABELS } from "./blocks";

// Words left over from a template or a new block: prompts in [brackets] and the stock phrases.
const STOCK = ["Your headline goes here.", "Write something here.", "Team name", "Prayer point", "Event title", "Heading", "Update from", "SERVING IN"];
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!["id", "url", "type", "layout", "original", "edit", "quality"].includes(k)) strings(x, out);
  return out;
}
export function leftoverText(doc: EmailDoc): string[] {
  const texts = doc.blocks.filter((b) => !b.hidden).flatMap((b) => strings(b)).map((t) => t.trim());
  texts.push(doc.subject.trim(), doc.previewText.trim());
  return Array.from(new Set(texts.filter((t) => /\[[^\]\n]{2,}\]/.test(t) || STOCK.includes(t)))).map((t) => (t.length > 40 ? t.slice(0, 40) + "…" : t));
}

// Where the template wording is, block by block (so the Check tab can point at it).
export function leftoverItems(doc: EmailDoc): { blockId: string; text: string }[] {
  const out: { blockId: string; text: string }[] = [];
  const bad = (x: string) => /\[[^\]\n]{2,}\]/.test(x) || STOCK.includes(x);
  const short = (x: string) => (x.length > 40 ? x.slice(0, 40) + "…" : x);
  for (const [label, v] of [["Subject line", doc.subject], ["Preview text", doc.previewText]] as const) if (bad(v.trim())) out.push({ blockId: "doc", text: `${label}: “${short(v.trim())}”` });
  for (const b of doc.blocks.filter((x) => !x.hidden)) {
    const seen = new Set<string>();
    for (const s of strings(b).map((x) => x.trim())) if (bad(s) && !seen.has(s)) { seen.add(s); out.push({ blockId: b.id, text: `${BLOCK_LABELS[b.type]}: “${short(s)}”` }); }
  }
  return out;
}

export type CheckItem = { blockId: string; text: string };
export type Check = { ok: boolean; label: string; detail?: string; severity: "block" | "warn"; items?: CheckItem[] };

function links(b: Block): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const push = (x?: { label: string; url: string }) => x && out.push(x);
  switch (b.type) {
    case "hero": case "card": case "event": case "map": push(b.button); break;
    case "cta": push(b.button); break;
    case "partners": b.items.forEach((i) => push(i.button)); break;
  }
  return out;
}

function images(b: Block): { alt: string; url: string }[] {
  switch (b.type) {
    case "hero": return b.showImage && b.image?.url ? [b.image] : [];
    case "photo": return b.image.url ? [b.image] : [];
    case "partners": return b.showImages ? b.items.filter((i) => i.image?.url).map((i) => i.image!) : [];
    case "travel": return b.teams.filter((t) => t.image?.url).map((t) => t.image!);
    default: return [];
  }
}

// Plain-language checks shown before sending. "block" ones stop a send;
// "warn" ones are advice.
export function runChecks(doc: EmailDoc, htmlBytes: number, address: string): Check[] {
  const blocks = doc.blocks.filter((b) => !b.hidden);
  // A button left completely blank shows nothing in the email, so it isn't a problem.
  // Half-filled or broken ones are, and each is listed with the block it's in.
  const btnItems: CheckItem[] = [];
  let btnTotal = 0;
  for (const b of blocks) {
    for (const l of links(b)) {
      const label = l.label.trim(), url = l.url.trim();
      if (!label && !url) continue;
      btnTotal++;
      if (!label) btnItems.push({ blockId: b.id, text: `${BLOCK_LABELS[b.type]}: a button has a link but no words on it` });
      else if (!url) btnItems.push({ blockId: b.id, text: `${BLOCK_LABELS[b.type]}: the “${label}” button has no link yet` });
      else if (!/^https?:\/\/\S+\.\S+/.test(url)) btnItems.push({ blockId: b.id, text: `${BLOCK_LABELS[b.type]}: the “${label}” link should start with https://` });
    }
  }
  const noAlt = blocks.flatMap(images).filter((i) => !i.alt.trim());
  const kb = Math.round(htmlBytes / 1024);
  const unUploaded = blocks.flatMap(images).filter((i) => i.url.startsWith("data:"));
  const subj = doc.subject.trim().length;
  const left = leftoverText(doc);
  const checks: Check[] = [
    {
      ok: btnItems.length === 0,
      severity: "block",
      label: btnItems.length ? `${btnItems.length} button${btnItems.length === 1 ? "" : "s"} need${btnItems.length === 1 ? "s" : ""} fixing` : `All ${btnTotal} button links look right`,
      items: btnItems.length ? btnItems : undefined,
    },
    { ok: subj >= 8 && subj <= 70, severity: "block", label: subj ? `Subject is ${subj} characters` : "Add a subject line", detail: subj > 70 ? "Under about 60 reads best on a phone" : undefined },
    { ok: !!doc.previewText.trim(), severity: "warn", label: doc.previewText.trim() ? "Preview text added" : "Add preview text (the gray line in the inbox)" },
    { ok: kb < 90, severity: "block", label: `${kb} KB, ${kb < 90 ? "under" : "close to"} Gmail's ~102 KB clip limit` },
    { ok: noAlt.length === 0, severity: "warn", label: noAlt.length ? `${noAlt.length} photo${noAlt.length === 1 ? "" : "s"} missing a description` : "All photos have descriptions", detail: noAlt.length ? "Helps people using screen readers and when images are blocked" : undefined },
    { ok: unUploaded.length === 0, severity: "block", label: unUploaded.length ? `${unUploaded.length} photo${unUploaded.length === 1 ? " hasn't" : "s haven't"} finished uploading` : "All photos are uploaded" },
    { ok: left.length === 0, severity: "block", label: left.length ? `${left.length} spot${left.length === 1 ? " still has" : "s still have"} template wording` : "No leftover template wording", items: left.length ? leftoverItems(doc) : undefined },
    { ok: !!address && !address.includes("["), severity: "block", label: !!address && !address.includes("[") ? "Mailing address and unsubscribe are in the footer" : "Church mailing address still needs to be set" },
  ];
  return checks;
}
