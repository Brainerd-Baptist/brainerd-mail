import type { Block, EmailDoc } from "./blocks";

const KIND: Record<string, string> = { hero: "header", text: "text block", travel: "travel block", partners: "partner block", cta: "button block", card: "card", photo: "photo", event: "event card", divider: "divider", map: "Missions map" };

function blockName(b: Block): string {
  const x = b as unknown as Record<string, unknown>;
  const t = [x.headline, x.heading, x.title, x.name].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  return t ? `“${t.length > 28 ? t.slice(0, 27) + "…" : t}”` : `the ${KIND[b.type] ?? b.type}`;
}

// A short, human description of what changed between two copies of an email.
export function summarizeChange(older: EmailDoc | null | undefined, newer: EmailDoc | null | undefined): string {
  if (!older || !newer) return "";
  const out: string[] = [];
  if (older.ministry !== newer.ministry) out.push("changed ministry");
  if ((older.theme ?? "") !== (newer.theme ?? "")) out.push("changed colors");
  if (older.subject !== newer.subject) out.push("changed the subject");
  if (older.previewText !== newer.previewText) out.push("changed the preview text");
  if (older.footerNote !== newer.footerNote) out.push("changed the footer note");
  if (older.title !== newer.title) out.push("renamed the email");

  const oi = new Map(older.blocks.map((b) => [b.id, b]));
  const ni = new Map(newer.blocks.map((b) => [b.id, b]));
  const added = newer.blocks.filter((b) => !oi.has(b.id));
  const removed = older.blocks.filter((b) => !ni.has(b.id));
  const edited = newer.blocks.filter((b) => oi.has(b.id) && JSON.stringify(oi.get(b.id)) !== JSON.stringify(b));
  const kept = newer.blocks.filter((b) => oi.has(b.id)).map((b) => b.id);
  const keptOld = older.blocks.filter((b) => ni.has(b.id)).map((b) => b.id);
  const moved = kept.join() !== keptOld.join();

  if (edited.length === 1) out.unshift(`edited ${blockName(edited[0])}`);
  else if (edited.length > 1) out.unshift(`edited ${edited.length} blocks`);
  if (added.length === 1) out.push(`added ${blockName(added[0])}`);
  else if (added.length > 1) out.push(`added ${added.length} blocks`);
  if (removed.length === 1) out.push(`removed ${blockName(removed[0])}`);
  else if (removed.length > 1) out.push(`removed ${removed.length} blocks`);
  if (moved) out.push("reordered blocks");

  if (!out.length) return "";
  const s = out.slice(0, 3).join("; ") + (out.length > 3 ? `; +${out.length - 3} more` : "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
