// Plain pixel math (no browser needed) so it can be tested. Measures how
// bright and how sharp a photo is, then judges whether to warn the author.
// Thresholds are a first guess; the raw numbers are saved with the photo so
// they can be tuned against real ministry photos.

export type PhotoQuality = { dark?: boolean; soft?: boolean; small?: boolean; brightness?: number; sharpness?: number };

export function measure(rgba: Uint8ClampedArray, w: number, h: number): { brightness: number; sharpness: number } {
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const y = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];
    g[i] = y; sum += y;
  }
  // Variance of the Laplacian: low means few crisp edges (blur or smear).
  let n = 0, s = 0, s2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      s += l; s2 += l * l; n++;
    }
  }
  const mean = n ? s / n : 0;
  return { brightness: sum / (w * h), sharpness: n ? s2 / n - mean * mean : 0 };
}

export const DARK_BELOW = 85; // average brightness, 0 to 255
export const SOFT_BELOW = 45; // Laplacian variance on a 320px-wide copy
export const SMALL_BELOW = 800; // source pixels across the part that is used

export function judge(m: { brightness: number; sharpness: number }, usedWidth: number): PhotoQuality {
  return {
    dark: m.brightness < DARK_BELOW || undefined,
    soft: m.sharpness < SOFT_BELOW || undefined,
    small: usedWidth < SMALL_BELOW || undefined,
    brightness: Math.round(m.brightness),
    sharpness: Math.round(m.sharpness),
  };
}
