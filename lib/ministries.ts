// One look, many color profiles. Layout, type and buttons never change;
// only these colors do. Every `button` + `btnText` pair passes 4.5:1
// contrast. `bright` is decoration only (never text on white).

export type Palette = {
  key: string;
  name: string; // shown in the wordmark, e.g. "MISSIONS"
  label: string; // human label, e.g. "Missions"
  dark: string; // header + footer background, and heading text
  dot?: string; // a brighter stand-in for dots and charts when the masthead color is near-black
  accent?: string; // text-safe version of `button` for small labels on white (when button is too light)
  bar?: string; // masthead background when it should differ from `dark` (Adults is white)
  button: string; // button + link accent (passes contrast with btnText)
  btnText: string;
  bright: string; // decorative stripe / dots
  tint: string; // soft panels and chips
  soft: string; // small text on the dark header
};

export const PALETTES: Record<string, Palette> = {
  "church-wide": { key: "church-wide", name: "BRAINERD", label: "Church-Wide", dark: "#00205b", bar: "#00abc9", button: "#008299", btnText: "#ffffff", bright: "#acdceb", tint: "#e0f5f9", soft: "#d6f1f7" },
  kids: { key: "kids", name: "KIDS", label: "Kids", dark: "#0b4452", button: "#007b90", btnText: "#ffffff", bright: "#00abc9", tint: "#e0f5f9", soft: "#bfe7ef" },
  students: { key: "students", name: "STUDENTS", label: "Students", dark: "#6e2f0c", button: "#b84d0a", btnText: "#ffffff", bright: "#f79648", tint: "#f4f5f7", soft: "#fbd5b3" },
  missions: { key: "missions", name: "MISSIONS", label: "Missions", dark: "#00205b", button: "#1e61b9", btnText: "#ffffff", bright: "#acdceb", tint: "#e8eff9", soft: "#c9d9f0" },
  bx: { key: "bx", dot: "#6b6b6b", name: "BX", label: "BX", dark: "#161616", button: "#2e2e2e", btnText: "#ffffff", bright: "#b8b8b8", tint: "#f0f0f0", soft: "#cfcfcf" },
  "life-groups": { key: "life-groups", name: "LIFE GROUPS", label: "Life Groups", dark: "#1c1c1c", bar: "#efc360", button: "#efc360", btnText: "#1c1c1c", accent: "#946a00", bright: "#c9962e", tint: "#fdf6e3", soft: "#f3dd91" },
  adults: { key: "adults", name: "ADULTS", label: "Adults", dark: "#202020", bar: "#ffffff", button: "#3d3a36", btnText: "#ffffff", bright: "#c9bfb1", tint: "#fef7ee", soft: "#d9d2c8" },
  men: { key: "men", dot: "#118058", name: "MEN", label: "Men", dark: "#0d3b2c", button: "#118058", btnText: "#ffffff", bright: "#b7dcc8", tint: "#e6f5ee", soft: "#b7dcc8" },
  pdo: { key: "pdo", dot: "#6b529c", name: "PDO", label: "PDO", dark: "#2f2150", button: "#6b529c", btnText: "#ffffff", bright: "#b8a8d9", tint: "#f0ecf7", soft: "#d9cfee" },
  women: { key: "women", dot: "#b3265c", name: "WOMEN", label: "Women", dark: "#4a1230", button: "#b3265c", btnText: "#ffffff", bright: "#e54e73", tint: "#fbe8ef", soft: "#f3c4d5" },
};

export function paletteFor(key: string): Palette {
  return PALETTES[key] ?? PALETTES["church-wide"];
}

// The ministry's identity color: what you see in its email masthead. Used for dots, chips and charts
// so the app matches the emails. (Adults has a white masthead, so it uses its charcoal.)
export function swatch(p: Palette): string {
  if (p.dot) return p.dot;
  const bar = p.bar?.toLowerCase();
  return bar && bar !== "#ffffff" ? bar : p.dark;
}
