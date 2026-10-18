// Small, safe photo adjustments. The original is kept, edits are stored as a
// few numbers, and the edited copy is re-made from the original each time.

export type PhotoEdit = { fx: number; fy: number; zoom: number; rotate: 0 | 90 | 180 | 270; gamma: number };
export const DEFAULT_EDIT: PhotoEdit = { fx: 0.5, fy: 0.5, zoom: 1, rotate: 0, gamma: 1 };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Which part of the (already rotated) source to show. fx/fy slide the window
// across whatever slack there is; zoom shrinks the window.
export function cropRect(w: number, h: number, aspect: number | undefined, zoom: number, fx: number, fy: number) {
  let cw = w, ch = h;
  if (aspect) { if (w / h > aspect) cw = h * aspect; else ch = w / aspect; }
  cw /= Math.max(1, zoom); ch /= Math.max(1, zoom);
  return { sx: (w - cw) * clamp(fx), sy: (h - ch) * clamp(fy), sw: cw, sh: ch };
}

export function gammaLUT(g: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, 1 / g));
  return lut;
}

// Lifts shadows so the average brightness lands near a comfortable level.
export function autoGamma(brightness: number, target = 115): number {
  if (brightness >= target || brightness <= 1) return 1;
  const g = Math.log(brightness / 255) / Math.log(target / 255);
  return Math.round(clamp(g, 1, 2.2) * 100) / 100;
}
