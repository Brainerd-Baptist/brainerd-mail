import type { EmailDoc, Block } from "./blocks";

export type Check = { ok: boolean; label: string; detail?: string; severity: "block" | "warn" };

function links(b: Block): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const push = (x?: { label: string; url: string }) => x && out.push(x);
  switch (b.type) {
    case "hero": case "card": case "event": push(b.button); break;
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
    default: return [];
  }
}

// Plain-language checks shown before sending. "block" ones stop a send;
// "warn" ones are advice.
export function runChecks(doc: EmailDoc, htmlBytes: number, address: string): Check[] {
  const blocks = doc.blocks.filter((b) => !b.hidden);
  const all = blocks.flatMap(links);
  const bad = all.filter((l) => l.label.trim() && !/^https?:\/\/\S+\.\S+/.test(l.url.trim()));
  const emptyLabels = all.filter((l) => !l.label.trim() || !l.url.trim());
  const noAlt = blocks.flatMap(images).filter((i) => !i.alt.trim());
  const kb = Math.round(htmlBytes / 1024);
  const unUploaded = blocks.flatMap(images).filter((i) => i.url.startsWith("data:"));
  const subj = doc.subject.trim().length;
  const checks: Check[] = [
    {
      ok: bad.length === 0 && emptyLabels.length === 0,
      severity: "block",
      label: bad.length || emptyLabels.length ? `${bad.length + emptyLabels.length} button${bad.length + emptyLabels.length === 1 ? "" : "s"} need a working link` : `All ${all.length} button links look right`,
      detail: [...bad, ...emptyLabels].map((l) => l.label || "(no label)").join(", ") || undefined,
    },
    { ok: subj >= 8 && subj <= 70, severity: "block", label: subj ? `Subject is ${subj} characters` : "Add a subject line", detail: subj > 70 ? "Under about 60 reads best on a phone" : undefined },
    { ok: !!doc.previewText.trim(), severity: "warn", label: doc.previewText.trim() ? "Preview text added" : "Add preview text (the gray line in the inbox)" },
    { ok: kb < 90, severity: "block", label: `${kb} KB, ${kb < 90 ? "under" : "close to"} Gmail's ~102 KB clip limit` },
    { ok: noAlt.length === 0, severity: "warn", label: noAlt.length ? `${noAlt.length} photo${noAlt.length === 1 ? "" : "s"} missing a description` : "All photos have descriptions", detail: noAlt.length ? "Helps people using screen readers and when images are blocked" : undefined },
    { ok: unUploaded.length === 0, severity: "block", label: unUploaded.length ? `${unUploaded.length} photo${unUploaded.length === 1 ? " hasn't" : "s haven't"} finished uploading` : "All photos are uploaded" },
    { ok: !!address && !address.includes("["), severity: "block", label: !!address && !address.includes("[") ? "Mailing address and unsubscribe are in the footer" : "Church mailing address still needs to be set" },
  ];
  return checks;
}
