import type { EmailDoc } from "./blocks";
import { BLOCK_LABELS } from "./blocks";

// The words in an email, with where each one lives. Used by the spelling check and the "show me" links.
// Safe for the browser and the server (no file access here).
const SKIP = new Set(["id", "url", "type", "layout", "original", "edit", "quality", "level", "showImage", "showImages", "showLegend"]);

export type TextPart = { blockId: string; label: string; text: string };

function walk(v: unknown, out: string[]) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => walk(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!SKIP.has(k)) walk(x, out);
}

export function collectTexts(doc: EmailDoc): TextPart[] {
  const parts: TextPart[] = [];
  if (doc.subject.trim()) parts.push({ blockId: "doc", label: "Subject line", text: doc.subject });
  if (doc.previewText.trim()) parts.push({ blockId: "doc", label: "Preview text", text: doc.previewText });
  for (const b of doc.blocks) {
    if (b.hidden) continue;
    const strs: string[] = [];
    walk(b, strs);
    for (const t of strs) if (t.trim()) parts.push({ blockId: b.id, label: BLOCK_LABELS[b.type], text: t });
  }
  return parts;
}

function mapStrings(v: any, fn: (s: string) => string): any {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn));
  if (v && typeof v === "object") { const o: any = {}; for (const [k, x] of Object.entries(v)) o[k] = SKIP.has(k) ? x : mapStrings(x, fn); return o; }
  return v;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Replace a whole word everywhere in one block (or in the subject and preview text when blockId is "doc").
export function replaceWord(doc: EmailDoc, blockId: string, from: string, to: string): EmailDoc {
  const re = new RegExp(`(?<![A-Za-z’'])${esc(from)}(?![A-Za-z’'])`, "g");
  const fn = (s: string) => s.replace(re, to);
  if (blockId === "doc") return { ...doc, subject: fn(doc.subject), previewText: fn(doc.previewText) };
  return { ...doc, blocks: doc.blocks.map((b) => (b.id === blockId ? (mapStrings(b, fn) as typeof b) : b)) };
}
