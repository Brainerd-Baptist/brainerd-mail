import fs from "fs";
import path from "path";
import nspell from "nspell";
import type { EmailDoc } from "./blocks";
import { collectTexts } from "./doc-text";

// Server-side spelling check. Dictionary files live in lib/dict (American English).
// Names and church words that a dictionary doesn't know are added below; anything else
// a person can tap "Ignore" on.
const CHURCH_WORDS = ["Brainerd", "ClearStream", "Hixson", "Ooltewah", "Chattanooga", "Signal", "Lookout", "Missions", "unreached", "livestream", "livestreams", "emailed", "RSVP", "RSVPs", "Wi-Fi", "WiFi", "checkin", "checkins", "discipleship", "Wednesdays", "Sundays", "Gotham", "BX", "Rooibos", "Quichua", "Banyankole", "Kissan"];

let speller: ReturnType<typeof nspell> | null = null;
function sp() {
  if (!speller) {
    const dir = path.join(process.cwd(), "lib", "dict");
    speller = nspell(fs.readFileSync(path.join(dir, "en.aff")), fs.readFileSync(path.join(dir, "en.dic")));
    for (const w of CHURCH_WORDS) speller.add(w);
  }
  return speller;
}

export type SpellIssue = { word: string; blockId: string; label: string; before: string; after: string; suggestions: string[] };

const WORD = /[A-Za-z][A-Za-z’'-]*[A-Za-z]/g;

export function spellIssues(doc: EmailDoc): SpellIssue[] {
  const s = sp();
  const seen = new Set<string>();
  const out: SpellIssue[] = [];
  for (const part of collectTexts(doc)) {
    const text = part.text.replace(/https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+/g, (m) => " ".repeat(m.length));
    for (const m of text.matchAll(WORD)) {
      const raw = m[0];
      const idx = m.index ?? 0;
      const w = raw.replace(/’/g, "'");
      if (w.length < 3 || w === w.toUpperCase()) continue; // acronyms
      const prev = text.slice(0, idx).replace(/[\s"“”‘’'(\[]+$/, "").slice(-1);
      const sentenceStart = !prev || /[.!?:\n]/.test(prev);
      if (/^[A-Z]/.test(w) && !sentenceStart) continue; // names mid-sentence
      const base = w.replace(/'s$/i, "");
      if (base.length < 3) continue;
      const parts = base.split("-").filter(Boolean);
      if (s.correct(base) || parts.every((p) => p.length < 3 || s.correct(p))) continue;
      const key = `${part.blockId}:${base.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sug = s.suggest(base).filter((x) => !/\s/.test(x)).slice(0, 3);
      out.push({ word: base, blockId: part.blockId, label: part.label, before: text.slice(Math.max(0, idx - 24), idx).trimStart(), after: text.slice(idx + raw.length, idx + raw.length + 24).trimEnd(), suggestions: sug });
      if (out.length >= 40) return out;
    }
  }
  return out;
}
