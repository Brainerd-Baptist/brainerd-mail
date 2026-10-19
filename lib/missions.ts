// The Missions map: one list of countries, edited in Brainerd Mail (Missions) and shown three ways:
// the live public map (embed + JSON for the website), an image block in emails, and the editor itself.
// Pure code: no database access here, so screens, routes and tests share one definition.
import geo from "./missions-geo.json";

export type Level = 1 | 2 | 3;
export const LEVELS: Level[] = [1, 2, 3];
export const LEVEL_COLOR: Record<Level, string> = { 1: "#00abc9", 2: "#33bc53", 3: "#ff4a53" };
export const LAND = "#6f7893";

export type CountryRow = {
  iso2: string; name: string; level: number; since: string; religion: string; people_group: string;
  unreached_groups: string; unreached_pop: string; is_public: boolean; show_people_group: boolean; updated_at?: string;
};
export type Country = {
  iso2: string; name: string; level: Level; since: string; religion: string; peopleGroup: string;
  unreachedGroups: string; unreachedPop: string; isPublic: boolean; showPeopleGroup: boolean; updatedAt?: string;
};
export type LevelInfo = { level: Level; label: string; blurb: string };
export type LevelRow = { level: number; label: string; blurb: string };

const asLevel = (n: number): Level => (n === 2 ? 2 : n === 3 ? 3 : 1);
export const fromRow = (r: CountryRow): Country => ({
  iso2: r.iso2, name: r.name, level: asLevel(r.level), since: r.since, religion: r.religion, peopleGroup: r.people_group,
  unreachedGroups: r.unreached_groups, unreachedPop: r.unreached_pop, isPublic: r.is_public, showPeopleGroup: r.show_people_group, updatedAt: r.updated_at,
});
export const levelsFromRows = (rows: LevelRow[]): LevelInfo[] =>
  LEVELS.map((l) => { const r = rows.find((x) => x.level === l); return { level: l, label: r?.label || `Level ${l}`, blurb: r?.blurb || "" }; });

// Every country on the map, for the "Add a country" picker.
export const GEO_LIST: { id: string; name: string }[] = geo.countries.map((c) => ({ id: c.id, name: c.name }));
const GEO_IDS = new Set(GEO_LIST.map((c) => c.id));
export const isGeoId = (id: string) => GEO_IDS.has(id);
export const MAP_W: number = geo.W;
export const MAP_H: number = geo.H;

// What the public (and emails) may see. Private countries are left out entirely; if a country's
// people-group names are switched off, those names never leave the server.
export type PublicCountry = { id: string; name: string; level: Level; since: string; religion: string; peopleGroup: string; unreachedGroups: string; unreachedPop: string };
export type PublicView = { countries: PublicCountry[]; levels: LevelInfo[]; counts: { 1: number; 2: number; 3: number; total: number }; updatedAt: string };

export function publicView(all: Country[], levels: LevelInfo[]): PublicView {
  const shown = all.filter((c) => c.isPublic && isGeoId(c.iso2));
  const counts = { 1: 0, 2: 0, 3: 0, total: shown.length };
  shown.forEach((c) => { counts[c.level]++; });
  const updatedAt = all.map((c) => c.updatedAt ?? "").sort().pop() ?? "";
  return {
    countries: shown.map((c) => ({ id: c.iso2, name: c.name, level: c.level, since: c.since, religion: c.religion, peopleGroup: c.showPeopleGroup ? c.peopleGroup : "", unreachedGroups: c.unreachedGroups, unreachedPop: c.unreachedPop })),
    levels, counts, updatedAt,
  };
}

// Map shapes: the engaged countries individually, everything else as one land shape.
export function mapShapes(engaged: Iterable<string>): { base: string; hit: { id: string; d: string }[] } {
  const ids = new Set(engaged);
  const hit: { id: string; d: string }[] = [];
  let base = geo.rest;
  for (const c of geo.countries) { if (ids.has(c.id)) hit.push({ id: c.id, d: c.d }); else base += c.d; }
  return { base, hit };
}

// A still picture of the map (SVG), turned into a PNG for emails. Shapes only, so it needs no fonts.
export function staticMapSvg(view: PublicView, opts: { level?: Level | null } = {}): string {
  const { base, hit } = mapShapes(view.countries.map((c) => c.id));
  const byId = new Map(view.countries.map((c) => [c.id, c]));
  const only = opts.level ?? null;
  const parts = hit.map((h) => {
    const lv = byId.get(h.id)!.level;
    const off = only !== null && lv !== only;
    const fill = off ? LAND : LEVEL_COLOR[lv];
    const main = `<path d="${h.d}" fill="${fill}"${off ? ' fill-opacity=".55"' : ""} stroke="#0b1a40" stroke-width=".6"/>`;
    return !off && lv === 3 ? main + `<path d="${h.d}" fill="url(#st)"/>` : main;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_W} ${MAP_H + 20}" width="${MAP_W}" height="${MAP_H + 20}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a3270"/><stop offset=".45" stop-color="#00205b"/><stop offset="1" stop-color="#001540"/></linearGradient>
<pattern id="st" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="6" fill="#ffffff" fill-opacity=".38"/></pattern></defs>
<rect width="${MAP_W}" height="${MAP_H + 20}" rx="26" fill="url(#bg)"/>
<g transform="translate(0,10)"><path d="${base}" fill="${LAND}" stroke="#2a3350" stroke-width=".5"/>${parts.join("")}</g></svg>`;
}

// ---- Editing: clean up what a person typed before it is saved ----
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
export type CountryInput = Omit<Country, "updatedAt">;
export function cleanCountry(iso2: string, body: unknown): { ok: true; value: CountryInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!isGeoId(iso2)) return { ok: false, error: "That country isn't on the map." };
  const level = Number(b.level);
  if (![1, 2, 3].includes(level)) return { ok: false, error: "Pick Level 1, 2 or 3." };
  const name = clip(b.name, 80);
  if (!name) return { ok: false, error: "Every country needs a name." };
  return { ok: true, value: {
    iso2, name, level: level as Level, since: clip(b.since, 20), religion: clip(b.religion, 80), peopleGroup: clip(b.peopleGroup, 200),
    unreachedGroups: clip(b.unreachedGroups, 20), unreachedPop: clip(b.unreachedPop, 40), isPublic: b.isPublic !== false, showPeopleGroup: b.showPeopleGroup !== false,
  } };
}
export const toRow = (c: CountryInput, by: string | null) => ({
  iso2: c.iso2, name: c.name, level: c.level, since: c.since, religion: c.religion, people_group: c.peopleGroup,
  unreached_groups: c.unreachedGroups, unreached_pop: c.unreachedPop, is_public: c.isPublic, show_people_group: c.showPeopleGroup,
  updated_at: new Date().toISOString(), updated_by: by,
});
export const cleanLevels = (body: unknown): LevelInfo[] | null => {
  const list = (body && typeof body === "object" ? (body as { levels?: unknown }).levels : null);
  if (!Array.isArray(list) || list.length !== 3) return null;
  const out = LEVELS.map((l) => { const x = list.find((i) => Number(i?.level) === l); return x ? { level: l, label: clip(x.label, 30) || `Level ${l}`, blurb: clip(x.blurb, 240) } : null; });
  return out.every(Boolean) ? (out as LevelInfo[]) : null;
};
