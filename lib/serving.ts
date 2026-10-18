// The "Members serving globally" roster. One list, shown on the public page
// at /serving and edited at /roster. Regions show in this order; any other
// region name a staff member types shows after them.
export const REGIONS = ["South America", "Europe / Middle East", "Africa", "North America", "South Asia", "Southeast Asia"];

export type Member = {
  id: string;
  region: string;
  who: string; // "Jim, Mandy, Micah & Ellie"
  place: string; // "Peru"
  deployed: string; // "November 2014"
  note: string; // a prayer request or a line about their work
  photo: string; // public https address, or ""
  hidden: boolean;
};

export type Row = { id: string; region: string; who: string; place: string; deployed: string; note: string; photo_url: string; hidden: boolean; sort: number; updated_at?: string };

export const fromRow = (r: Row): Member => ({ id: r.id, region: r.region, who: r.who, place: r.place, deployed: r.deployed, note: r.note, photo: r.photo_url, hidden: r.hidden });

export function groupByRegion(list: Member[]): { region: string; members: Member[] }[] {
  const order = (r: string) => { const i = REGIONS.indexOf(r); return i === -1 ? REGIONS.length : i; };
  const regions = Array.from(new Set(list.map((m) => m.region)));
  regions.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return regions.map((region) => ({ region, members: list.filter((m) => m.region === region) }));
}

export const regionId = (r: string) => "r-" + r.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
