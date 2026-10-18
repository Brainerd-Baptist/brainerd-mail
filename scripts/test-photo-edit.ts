import { cropRect, autoGamma, gammaLUT, DEFAULT_EDIT } from "../lib/photo-edit";
const fail = (m: string) => { console.error("FAIL", m); process.exit(1); };
// 4000x3000 photo into a 3:1 banner: full width, a third of the height tall.
let r = cropRect(4000, 3000, 3, 1, 0.5, 0.5);
if (Math.round(r.sw) !== 4000 || Math.round(r.sh) !== 1333 || Math.round(r.sy) !== 833) fail("banner crop " + JSON.stringify(r));
r = cropRect(4000, 3000, 3, 1, 0.5, 0); if (r.sy !== 0) fail("top position");
r = cropRect(4000, 3000, 3, 1, 0.5, 1); if (Math.round(r.sy + r.sh) !== 3000) fail("bottom position");
r = cropRect(4000, 3000, 3, 2, 0, 0); if (Math.round(r.sw) !== 2000) fail("zoom 2x halves the window");
r = cropRect(3000, 4000, undefined, 1, 0.5, 0.5); if (r.sw !== 3000 || r.sh !== 4000) fail("no aspect keeps whole photo");
if (autoGamma(140) !== 1) fail("bright photo untouched");
const g = autoGamma(60); if (g <= 1 || g > 2.2) fail("dark photo gets lifted " + g);
const lut = gammaLUT(g); if (lut[0] !== 0 || lut[255] !== 255 || lut[60] <= 60) fail("lut lifts shadows, keeps ends");
if (DEFAULT_EDIT.gamma !== 1) fail("default is no-op");
console.log("ok photo-edit", { g, lift60: lut[60] });
