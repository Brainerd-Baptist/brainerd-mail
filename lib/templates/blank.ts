import { newBlock, type EmailDoc } from "../blocks";
import { MISSIONS_TEMPLATE } from "./missions";
import { BX_OCTOBER } from "./bx-october";
import { STARTERS } from "./starters";

// A fresh email for any ministry: a header and a text block to start from.
export function blankDoc(ministry: string): EmailDoc {
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" }).toUpperCase();
  return {
    ministry,
    title: "Untitled email",
    subject: "",
    previewText: "",
    monthLabel: month,
    footerNote: MISSIONS_TEMPLATE.footerNote,
    blocks: [newBlock("hero"), newBlock("text")],
  };
}

// "Start from": the ministry's own starter, or the October Global Update (Missions only).
export function templateDoc(ministry: string): EmailDoc {
  return STARTERS[ministry] ? STARTERS[ministry].build() : blankDoc(ministry);
}
// Ready-made October 2026 emails rebuilt from the Canva newsletters.
export const OCTOBER: Record<string, { label: string; blurb: string; doc: EmailDoc }> = {
  missions: { label: "The October Global Update", blurb: "The email we sent for Missions, ready to edit.", doc: MISSIONS_TEMPLATE },
  bx: { label: "October BX News", blurb: "The 5K, Cherish Hamill, and new equipment, rebuilt from the Canva newsletter.", doc: BX_OCTOBER },
};
export function octoberDoc(ministry = "missions"): EmailDoc {
  return JSON.parse(JSON.stringify((OCTOBER[ministry] ?? OCTOBER.missions).doc));
}
