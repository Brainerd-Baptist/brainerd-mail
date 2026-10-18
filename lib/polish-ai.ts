import type { EmailDoc, Block } from "./blocks";

// The Claude layer. Claude only ever proposes small edits to named text fields
// (or a block move); this file defines what an edit may touch, checks every
// proposal against the live email, and applies accepted ones. The email's
// design and HTML are never in play.

export type Edit =
  | { kind: "rewrite"; blockId: string; field: string; before: string; after: string; why: string }
  | { kind: "move"; blockId: string; toIndex: number; why: string };

export const DOC_ID = "doc";
const DOC_FIELDS = ["subject", "previewText"];
const BLOCK_FIELDS: Partial<Record<Block["type"], string[]>> = {
  hero: ["eyebrow", "headline", "body", "button.label"],
  text: ["heading", "body"],
  card: ["heading", "body", "button.label"],
  cta: ["heading", "body", "note", "button.label"],
  event: ["eyebrow", "title", "body"],
  photo: ["caption"],
};

export function fieldsFor(b: Block): string[] {
  return BLOCK_FIELDS[b.type] ?? [];
}

function getAt(o: any, path: string): string | undefined {
  const v = path.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  return typeof v === "string" ? v : undefined;
}
function setAt(o: any, path: string, val: string): any {
  const [k, ...rest] = path.split(".");
  return { ...o, [k]: rest.length ? setAt(o[k] ?? {}, rest.join("."), val) : val };
}

export function currentValue(doc: EmailDoc, blockId: string, field: string): string | undefined {
  if (blockId === DOC_ID) return DOC_FIELDS.includes(field) ? getAt(doc, field) : undefined;
  const b = doc.blocks.find((x) => x.id === blockId);
  return b && fieldsFor(b).includes(field) ? getAt(b, field) : undefined;
}

// What Claude gets to read: only the words, with ids and field names.
export function outline(doc: EmailDoc) {
  return {
    ministry: doc.ministry,
    doc: { subject: doc.subject, previewText: doc.previewText },
    blocks: doc.blocks.filter((b) => !b.hidden).map((b, i) => {
      const fields: Record<string, string> = {};
      for (const f of fieldsFor(b)) { const v = getAt(b, f); if (v?.trim()) fields[f] = v; }
      return { index: doc.blocks.indexOf(b), id: b.id, type: b.type, fields };
    }),
  };
}

const facts = (s: string) => (s.match(/https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+|\d[\d,.:/-]*/g) || []).map((x) => x.replace(/[.,]$/, ""));

// Accept only edits that are real, current, small, and don't invent facts.
export function validateEdits(doc: EmailDoc, raw: unknown): Edit[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: Edit[] = [];
  const seen = new Set<string>();
  for (const r of list as any[]) {
    if (!r || typeof r !== "object" || typeof r.blockId !== "string" || typeof r.why !== "string") continue;
    if (r.kind === "move") {
      const from = doc.blocks.findIndex((b) => b.id === r.blockId);
      const to = Number(r.toIndex);
      if (from < 0 || !Number.isInteger(to) || to < 0 || to >= doc.blocks.length || to === from) continue;
      const k = `move:${r.blockId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ kind: "move", blockId: r.blockId, toIndex: to, why: r.why.slice(0, 240) });
    } else if (r.kind === "rewrite" && typeof r.field === "string" && typeof r.after === "string") {
      const cur = currentValue(doc, r.blockId, r.field);
      const after = r.after.trim();
      if (cur === undefined || !after || after === cur.trim()) continue;
      if (typeof r.before === "string" && r.before.trim() !== cur.trim()) continue;
      if (after.length > Math.max(cur.length * 1.6, cur.length + 60)) continue;
      const known = new Set(facts(cur));
      if (facts(after).some((f) => !known.has(f))) continue; // never invent numbers, dates, links
      if (/\bvenue\b/i.test(after)) continue;
      const k = `${r.blockId}:${r.field}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ kind: "rewrite", blockId: r.blockId, field: r.field, before: cur, after, why: r.why.slice(0, 240) });
    }
  }
  return out.slice(0, 6);
}

// Returns null when the email has changed since the suggestion was made.
export function applyEdit(doc: EmailDoc, e: Edit): EmailDoc | null {
  if (e.kind === "move") {
    const from = doc.blocks.findIndex((b) => b.id === e.blockId);
    if (from < 0 || e.toIndex >= doc.blocks.length) return null;
    const bs = [...doc.blocks];
    const [b] = bs.splice(from, 1);
    bs.splice(e.toIndex, 0, b);
    return { ...doc, blocks: bs };
  }
  const cur = currentValue(doc, e.blockId, e.field);
  if (cur === undefined || cur.trim() !== e.before.trim()) return null;
  if (e.blockId === DOC_ID) return setAt(doc, e.field, e.after);
  return { ...doc, blocks: doc.blocks.map((b) => (b.id === e.blockId ? setAt(b, e.field, e.after) : b)) };
}

export const canApply = (doc: EmailDoc, e: Edit) => applyEdit(doc, e) !== null;

const VOICE: Record<string, string> = {
  kids: "Playful and short; written for parents who skim.",
  students: "Energetic and direct; speaks to students and their parents.",
  missions: "Warm and prayerful; stories about people, with clear next steps.",
  men: "Direct and encouraging.",
  women: "Warm and encouraging.",
};

export const SYSTEM = `You are the editor for Brainerd Baptist Church's email tool, Brainerd Mail. Staff write their own emails; you help each one feel more finished and premium without changing what it says.

Rules:
- Keep the author's meaning, voice and every fact. Never add or change names, dates, times, numbers, links or promises.
- Suggest only edits that are clearly better. Fewer, stronger suggestions beat many small ones. Return an empty list if the email is already good.
- Good emails: a short headline (3 to 8 words), a one or two sentence intro, one clear main action, buttons that say what happens next (2 to 4 words), warm and plain language, no jargon, no church-speak a visitor wouldn't know.
- Subject lines are under about 60 characters, in sentence case, specific rather than vague. Preview text adds something the subject doesn't say.
- Never use the word "venue". Do not use exclamation marks unless the author already did.
- A block may be moved only if the order clearly buries the main action or the story.
- Each "why" is one plain sentence a busy staff member understands. No design jargon.
- For a rewrite, "before" must be the field's exact current text and "after" the full replacement text.`;

export const TOOL = {
  name: "suggest_edits",
  description: "Return up to 6 suggested edits to the email, or an empty list.",
  input_schema: {
    type: "object",
    properties: {
      edits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["rewrite", "move"] },
            blockId: { type: "string", description: "A block id from the outline, or \"doc\" for subject/previewText." },
            field: { type: "string", description: "Field name for a rewrite, e.g. headline or button.label." },
            before: { type: "string" },
            after: { type: "string" },
            toIndex: { type: "integer", description: "For a move: the block's new index in the full block list." },
            why: { type: "string" },
          },
          required: ["kind", "blockId", "why"],
        },
      },
    },
    required: ["edits"],
  },
};

export function userMessage(doc: EmailDoc): string {
  const voice = VOICE[doc.ministry];
  return `${voice ? `Ministry voice (${doc.ministry}): ${voice}\n\n` : ""}Here is the email as JSON. Suggest edits using suggest_edits.\n\n${JSON.stringify(outline(doc), null, 1)}`;
}
