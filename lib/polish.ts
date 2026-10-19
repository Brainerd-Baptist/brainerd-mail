import type { EmailDoc, Block, Img } from "./blocks";

// Polish: advice that keeps the author's words and nudges the email toward the
// premium look. Rules are plain functions over the block list (no HTML), so
// nothing here can break the design. Wording suggestions never change text on
// their own; only mechanical tidying and structure fixes carry an Apply button.

export type Suggestion = {
  id: string; // stable, used to remember dismissals
  rule: string;
  level: "improve" | "tip";
  kind: "mechanical" | "wording" | "structure" | "photo";
  blockId?: string;
  title: string;
  detail?: string;
  fix?: { label: string; apply: (doc: EmailDoc) => EmailDoc };
};

const TEXT_KEYS = new Set([
  "eyebrow", "headline", "body", "heading", "title", "caption", "note", "label",
  "name", "dates", "places", "date", "place", "prayer", "alt", "subject",
  "previewText", "footerNote", "monthLabel",
]);

function mapText(v: unknown, f: (s: string) => string, key?: string): unknown {
  if (typeof v === "string") return key && TEXT_KEYS.has(key) ? f(v) : v;
  if (Array.isArray(v)) return v.map((x) => mapText(x, f, key));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = mapText(val, f, k);
    return out;
  }
  return v;
}

function textsOf(v: unknown, key?: string, out: { key: string; text: string }[] = []) {
  if (typeof v === "string") { if (key && TEXT_KEYS.has(key) && v.trim()) out.push({ key, text: v }); }
  else if (Array.isArray(v)) v.forEach((x) => textsOf(x, key, out));
  else if (v && typeof v === "object") for (const [k, val] of Object.entries(v as Record<string, unknown>)) textsOf(val, k, out);
  return out;
}

// Typography a designer would fix by hand: stray spaces, straight quotes,
// three dots. Never changes a word.
export function tidyText(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/\.{3}/g, "…")
    .replace(/(\w)'(\w)/g, "$1’$2")
    .replace(/"([^"\n]+)"/g, "“$1”")
    .trim();
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const PLACEHOLDER = /^(Write something here\.|Your headline goes here\.|Heading|Event title|Team name|Dates|Prayer point|Update from)$/;
const GENERIC_BUTTON = /^(click here|here|learn more|read more|more|submit|link|go|click)$/i;

function setBlock(doc: EmailDoc, id: string, patch: Partial<Block> | null): EmailDoc {
  return { ...doc, blocks: patch ? doc.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) : doc.blocks.filter((b) => b.id !== id) };
}

function buttons(b: Block): { label: string }[] {
  switch (b.type) {
    case "hero": case "card": case "event": case "map": return b.button ? [b.button] : [];
    case "cta": return [b.button];
    case "partners": return b.items.flatMap((i) => (i.button ? [i.button] : []));
    default: return [];
  }
}

function photosOf(b: Block): { slot: string; img: Img }[] {
  switch (b.type) {
    case "hero": return b.showImage && b.image?.url ? [{ slot: "header", img: b.image }] : [];
    case "photo": return b.image.url ? [{ slot: "photo", img: b.image }] : [];
    case "partners": return b.showImages ? b.items.flatMap((i) => (i.image?.url ? [{ slot: i.id, img: i.image }] : [])) : [];
    case "travel": return b.teams.flatMap((t) => (t.image?.url ? [{ slot: t.id, img: t.image }] : []));
    default: return [];
  }
}

export const dismissedKey = (ministry: string) => `brainerd-mail:polish-dismissed:${ministry}`;
export function readDismissed(ministry: string): string[] {
  try { return JSON.parse(localStorage.getItem(dismissedKey(ministry)) || "[]"); } catch { return []; }
}

export function polish(doc: EmailDoc): Suggestion[] {
  const out: Suggestion[] = [];
  const visible = doc.blocks.filter((b) => !b.hidden);
  const add = (s: Omit<Suggestion, "id"> & { id?: string }) => out.push({ ...s, id: s.id ?? `${s.rule}:${s.blockId ?? "doc"}` });

  // 1. Mechanical typography across the whole email.
  const tidied = mapText(doc, tidyText) as EmailDoc;
  if (JSON.stringify(tidied) !== JSON.stringify(doc)) {
    add({
      rule: "tidy", level: "tip", kind: "mechanical",
      title: "Tidy spacing and punctuation",
      detail: "Curly quotes and apostrophes, extra spaces, and … instead of three dots. No words change.",
      fix: { label: "Tidy up", apply: (d) => mapText(d, tidyText) as EmailDoc },
    });
  }

  // 2. Subject and preview.
  const subj = doc.subject.trim();
  if (subj) {
    const letters = subj.replace(/[^A-Za-z]/g, "");
    if (letters.length > 8 && subj === subj.toUpperCase()) add({ rule: "subject-caps", level: "improve", kind: "wording", title: "Subject is all capitals", detail: "Sentence case feels warmer and is less likely to look like spam." });
    if ((subj.match(/!/g) || []).length > 1) add({ rule: "subject-bang", level: "tip", kind: "wording", title: "Several exclamation marks in the subject", detail: "One at most. Let the words carry the excitement." });
  }
  const prev = doc.previewText.trim();
  if (prev && subj && prev.toLowerCase() === subj.toLowerCase()) add({ rule: "preview-same", level: "tip", kind: "wording", title: "Preview text repeats the subject", detail: "Use it to add something the subject doesn't say." });
  else if (prev && prev.length < 30) add({ rule: "preview-short", level: "tip", kind: "wording", title: "Preview text is very short", detail: "Around 40 to 90 characters fills the inbox line well." });

  // 3. Block-by-block.
  const first = visible[0];
  if (first && first.type !== "hero") add({ rule: "no-hero", level: "tip", kind: "structure", blockId: first.id, title: "Open with a Header block", detail: "A headline and one clear button at the top is what makes the email feel finished." });

  for (const b of doc.blocks) {
    if (b.hidden) continue;
    const ts = textsOf(b);

    if (ts.some((t) => PLACEHOLDER.test(t.text.trim()))) {
      add({ rule: "placeholder", level: "improve", kind: "structure", blockId: b.id, title: "Placeholder text is still in this block", detail: "Replace it, or hide the block so it isn't sent.", fix: { label: "Hide block", apply: (d) => setBlock(d, b.id, { hidden: true }) } });
    }
    if ((b.type === "text" || b.type === "card") && !b.heading.trim() && !b.body.trim()) {
      add({ rule: "empty", level: "improve", kind: "structure", blockId: b.id, title: "This block is empty", fix: { label: "Remove block", apply: (d) => setBlock(d, b.id, null) } });
    }
    if (ts.some((t) => /\bvenue\b/i.test(t.text))) {
      add({ rule: "venue", level: "improve", kind: "wording", blockId: b.id, title: "House style avoids the word “venue”", detail: "Try the building or room name." });
    }

    for (const { slot, img } of photosOf(b)) {
      const q = img.quality;
      if (!q) continue;
      const tail = img.url.slice(-14);
      const warn = (flag: string, title: string, detail: string) =>
        add({ id: `photo-${flag}:${b.id}:${slot}:${tail}`, rule: `photo-${flag}`, level: "improve", kind: "photo", blockId: b.id, title, detail });
      if (q.dark) warn("dark", "This photo is dark", "It may be hard to see on a phone. A brighter shot, or one taken near a window or outdoors, will look better.");
      if (q.soft) warn("soft", "This photo looks blurry", "Motion or low light can smear details. A sharper shot will look more finished.");
      if (q.small) warn("small", "This photo is small", "It may look soft on newer phones. A larger original will stay crisp.");
    }

    if (b.type === "hero") {
      if (b.headline.length > 70 || words(b.headline) > 10) add({ rule: "headline-long", level: "improve", kind: "wording", blockId: b.id, title: "Headline is long for a phone", detail: `${words(b.headline)} words. Aim for about 3 to 8.` });
      const letters = b.headline.replace(/[^A-Za-z]/g, "");
      if (letters.length > 12 && b.headline === b.headline.toUpperCase()) add({ rule: "headline-caps", level: "improve", kind: "wording", blockId: b.id, title: "Headline is all capitals", detail: "The serif headline looks best in sentence case." });
      if (words(b.body) > 45) add({ rule: "hero-body-long", level: "tip", kind: "wording", blockId: b.id, title: "Header intro is more than a short paragraph", detail: `${words(b.body)} words. Two sentences is the sweet spot; move the rest into a Text block.` });
      if (b.showImage && !b.image?.url) add({ rule: "hero-image-empty", level: "improve", kind: "structure", blockId: b.id, title: "Header photo is turned on but empty", fix: { label: "Turn photo off", apply: (d) => setBlock(d, b.id, { showImage: false } as Partial<Block>) } });
      if (!b.button) add({ rule: "hero-no-button", level: "tip", kind: "structure", blockId: b.id, title: "Header has no button", detail: "One clear next step up top gets the most taps." });
    }

    if (b.type === "text" || b.type === "card" || b.type === "cta") {
      const longest = Math.max(0, ...b.body.split(/\n\s*\n/).map(words));
      if (longest > 70) add({ rule: "wall", level: "improve", kind: "wording", blockId: b.id, title: "Long paragraph", detail: `${longest} words in one block of text. Break it up, or trim it to the part people need.` });
    }

    for (const btn of buttons(b)) {
      const label = btn.label.trim();
      if (!label) continue;
      if (GENERIC_BUTTON.test(label)) add({ id: `button-generic:${b.id}:${label}`, rule: "button-generic", level: "improve", kind: "wording", blockId: b.id, title: `Button says “${label}”`, detail: "Say what happens next, like “Give to Missions” or “Sign up for the trip”." });
      else if (words(label) > 5 || label.length > 32) add({ id: `button-long:${b.id}:${label}`, rule: "button-long", level: "tip", kind: "wording", blockId: b.id, title: "Button label is long", detail: "Two to four words fit cleanly on a phone." });
    }

    if (b.type === "travel") {
      for (const t of b.teams) if (t.prayer.length > 5) add({ id: `prayer-long:${t.id}`, rule: "prayer-long", level: "tip", kind: "wording", blockId: b.id, title: `${t.name || "A team"} has ${t.prayer.length} prayer points`, detail: "Three to five get read. More tend to get skipped." });
    }
  }

  // 4. Dividers that do nothing.
  visible.forEach((b, i) => {
    if (b.type !== "divider") return;
    const p = visible[i - 1], n = visible[i + 1];
    if (!p || !n || p.type === "divider") {
      add({ rule: "divider", level: "tip", kind: "mechanical", blockId: b.id, title: !p ? "Divider at the very top" : !n ? "Divider at the very end" : "Two dividers in a row", fix: { label: "Remove divider", apply: (d) => setBlock(d, b.id, null) } });
    }
  });

  // 5. Overall shape.
  const ctaCount = visible.reduce((n, b) => n + buttons(b).length, 0);
  if (ctaCount > 5) add({ rule: "many-buttons", level: "tip", kind: "structure", title: `${ctaCount} buttons in one email`, detail: "When everything is a button, nothing stands out. Aim for one main action and a couple of supporting ones." });
  if (visible.length > 10) add({ rule: "long-email", level: "tip", kind: "structure", title: `${visible.length} blocks is a long scroll`, detail: "Consider moving some of it to a web page and linking to it." });

  return out;
}

export function polishSummary(list: Suggestion[]): { label: string; tone: "good" | "ok" | "work" } {
  const improve = list.filter((s) => s.level === "improve").length;
  const tips = list.length - improve;
  if (!list.length) return { label: "Polished", tone: "good" };
  if (!improve) return { label: `${tips} small tip${tips === 1 ? "" : "s"}`, tone: "ok" };
  return { label: `${improve} to improve${tips ? `, ${tips} tip${tips === 1 ? "" : "s"}` : ""}`, tone: "work" };
}
