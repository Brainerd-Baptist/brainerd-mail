// Builds lib/missions-geo.json: the world map shapes used by the Missions map
// (public page, embed and email image). Run only when the map shapes need to change.
//   mkdir -p ~/geo-tmp && cp scripts/gen-missions-geo.mjs ~/geo-tmp/ && cd ~/geo-tmp
//   npm i --no-save world-atlas@2 topojson-client@3 topojson-simplify@3 d3-geo@3 i18n-iso-countries@7
//   node gen-missions-geo.mjs <path to>/lib/missions-geo.json
// Shapes are Natural Earth (public domain), simplified for the web.
import fs from "fs";
import { createRequire } from "module";
import { feature } from "topojson-client";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import iso from "i18n-iso-countries";
const require = createRequire(import.meta.url);
iso.registerLocale(require("i18n-iso-countries/langs/en.json"));

const W = 1000, H = 520;
const NAMES = { US: "United States", GB: "United Kingdom", CD: "Congo DR", CG: "Congo", CI: "Ivory Coast", KR: "South Korea", KP: "North Korea", RU: "Russia", SY: "Syria", IR: "Iran", VN: "Vietnam", LA: "Laos", MD: "Moldova", TZ: "Tanzania", VE: "Venezuela", BO: "Bolivia", CZ: "Czechia", MK: "North Macedonia", PS: "Palestine", TW: "Taiwan", SZ: "Eswatini", TR: "Turkey", CV: "Cape Verde", BN: "Brunei", FM: "Micronesia", TL: "Timor-Leste" };

let topo = JSON.parse(fs.readFileSync("node_modules/world-atlas/countries-50m.json"));
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.18));
const feats = feature(topo, topo.objects.countries).features.filter((f) => f.properties.name !== "Antarctica");
// France and the Netherlands: draw the home country only, not overseas territories.
for (const f of feats) {
  if (f.id === "250" && f.geometry.type === "MultiPolygon") f.geometry.coordinates = f.geometry.coordinates.filter((p) => p[0][0][0] > -20 && p[0][0][1] > 30);
  if (f.id === "528" && f.geometry.type === "MultiPolygon") f.geometry.coordinates = f.geometry.coordinates.filter((p) => p[0][0][1] > 40);
}
const proj = geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features: feats });
const path = geoPath(proj);
const r1 = (s) => s.replace(/-?\d+\.\d+/g, (n) => (+n).toFixed(1));
const countries = [], rest = [];
for (const f of feats) {
  const d = path(f); if (!d) continue;
  const a2 = f.id ? iso.numericToAlpha2(String(f.id).padStart(3, "0")) : undefined;
  if (a2) countries.push({ id: a2, name: NAMES[a2] || iso.getName(a2, "en", { select: "alias" }) || f.properties.name, d: r1(d) });
  else rest.push(r1(d));
}
countries.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(process.argv[2], JSON.stringify({ W, H, countries, rest: rest.join("") }));
console.log(countries.length, "countries,", rest.length, "unlabelled shapes,", fs.statSync(process.argv[2]).size, "bytes");
