import { newBlock, type EmailDoc } from "../blocks";
import { MISSIONS_TEMPLATE } from "./missions";
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
export function octoberDoc(): EmailDoc {
  return JSON.parse(JSON.stringify(MISSIONS_TEMPLATE));
}
