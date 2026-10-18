// The email is a list of blocks. Staff add, reorder and fill in blocks;
// they never place things by pixel. Every block has `id` and may be hidden.

import type { PhotoEdit } from "./photo-edit";
export type Img = { url: string; alt: string; shape?: "original" | "banner" | "standard" | "square" | "tall" | "circle"; original?: string; edit?: PhotoEdit; quality?: { dark?: boolean; soft?: boolean; small?: boolean; brightness?: number; sharpness?: number } };
export type Btn = { label: string; url: string };

export type HeroBlock = {
  id: string; type: "hero";
  eyebrow: string; headline: string; body: string;
  image?: Img; showImage: boolean; button?: Btn;
};
export type TextBlock = { id: string; type: "text"; heading: string; body: string };
export type TravelTeam = { id: string; name: string; dates: string; places: string; prayer: string[]; image?: Img };
export type TravelBlock = {
  id: string; type: "travel"; heading: string;
  teams: TravelTeam[]; layout: "side-by-side" | "stacked";
};
export type PartnerItem = {
  id: string; label: string; heading: string; body: string;
  prayer: string[]; image?: Img; button?: Btn;
};
export type PartnerBlock = { id: string; type: "partners"; heading: string; items: PartnerItem[]; showImages: boolean };
export type CtaBlock = { id: string; type: "cta"; heading: string; body: string; button: Btn; note: string };
export type CardBlock = { id: string; type: "card"; heading: string; body: string; button?: Btn };
export type PhotoBlock = { id: string; type: "photo"; image: Img; caption: string; enlarge?: boolean }; // enlarge defaults to on
export type EventBlock = {
  id: string; type: "event"; eyebrow: string; title: string; body: string;
  date: string; place: string; button?: Btn;
};
export type DividerBlock = { id: string; type: "divider" };

export type Block = (
  | HeroBlock | TextBlock | TravelBlock | PartnerBlock | CtaBlock
  | CardBlock | PhotoBlock | EventBlock | DividerBlock
) & { hidden?: boolean };

export type EmailDoc = {
  ministry: string; // key into PALETTES
  theme?: string; // optional color override (key into PALETTES); logo stays the ministry's
  title: string; // internal name
  subject: string;
  previewText: string;
  monthLabel: string; // e.g. "OCTOBER 2026"
  blocks: Block[];
  footerNote: string;
};

export type BlockType = Block["type"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Header",
  text: "Text",
  travel: "Travel team",
  partners: "Partner update",
  cta: "Give or sign up",
  card: "Card with button",
  photo: "Photo",
  event: "Event card",
  divider: "Divider",
};

export function uid(prefix = "b"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newBlock(type: BlockType): Block {
  switch (type) {
    case "hero":
      return { id: uid(), type, eyebrow: "", headline: "Your headline goes here.", body: "", showImage: false };
    case "text":
      return { id: uid(), type, heading: "", body: "Write something here." };
    case "travel":
      return { id: uid(), type, heading: "UPCOMING TRAVEL", layout: "side-by-side", teams: [{ id: uid("t"), name: "Team name", dates: "Dates", places: "", prayer: ["Prayer point"] }] };
    case "partners":
      return { id: uid(), type, heading: "PARTNER UPDATES", showImages: true, items: [{ id: uid("p"), label: "SERVING IN", heading: "Update from", body: "", prayer: [] }] };
    case "cta":
      return { id: uid(), type, heading: "Give", body: "", button: { label: "Give", url: "" }, note: "" };
    case "card":
      return { id: uid(), type, heading: "Heading", body: "", button: { label: "Learn more", url: "" } };
    case "photo":
      return { id: uid(), type, image: { url: "", alt: "" }, caption: "" };
    case "event":
      return { id: uid(), type, eyebrow: "FEATURED EVENT", title: "Event title", body: "", date: "", place: "" };
    case "divider":
      return { id: uid(), type };
  }
}
