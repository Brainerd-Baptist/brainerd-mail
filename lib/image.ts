// Prepares a photo from a phone: fixes rotation, shrinks it to a sensible
// size and compresses it, so a 12 MB camera photo becomes a ~200-400 KB
// email-friendly JPEG before it ever leaves the phone.
// With `aspect` (width / height, e.g. 3 for a wide banner) the photo is
// center-cropped to that shape so every email's header image matches.
import { measure, judge, type PhotoQuality } from "./image-quality";
import { cropRect, gammaLUT, DEFAULT_EDIT, type PhotoEdit } from "./photo-edit";

type Source = CanvasImageSource & { width: number; height: number };

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/jpeg", quality));
}

// Look at a small copy of what will actually be shown.
function assess(canvas: HTMLCanvasElement, usedWidth: number): PhotoQuality {
  try {
    const tw = Math.min(320, canvas.width), th = Math.max(1, Math.round((canvas.height * tw) / canvas.width));
    const small = document.createElement("canvas");
    small.width = tw; small.height = th;
    const ctx = small.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, 0, 0, tw, th);
    return judge(measure(ctx.getImageData(0, 0, tw, th).data, tw, th), usedWidth);
  } catch { return {}; }
}

// Applies rotate, crop (with zoom and position), and brightness to a source,
// at no more than maxEdge pixels on the long side.
export function renderToCanvas(src: Source, edit: PhotoEdit, aspect: number | undefined, maxEdge: number): { canvas: HTMLCanvasElement; usedWidth: number } {
  const swap = edit.rotate === 90 || edit.rotate === 270;
  const rw = swap ? src.height : src.width, rh = swap ? src.width : src.height;
  let rotated: Source = src;
  if (edit.rotate) {
    const rc = document.createElement("canvas");
    rc.width = rw; rc.height = rh;
    const rctx = rc.getContext("2d")!;
    rctx.translate(rw / 2, rh / 2);
    rctx.rotate((edit.rotate * Math.PI) / 180);
    rctx.drawImage(src, -src.width / 2, -src.height / 2);
    rotated = rc;
  }
  const { sx, sy, sw, sh } = cropRect(rw, rh, aspect, edit.zoom, edit.fx, edit.fy);
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: edit.gamma > 1.001 })!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(rotated, sx, sy, sw, sh, 0, 0, w, h);
  if (edit.gamma > 1.001) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data, lut = gammaLUT(edit.gamma);
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
    ctx.putImageData(img, 0, 0);
  }
  return { canvas, usedWidth: sw };
}

export async function renderEdit(src: Source, edit: PhotoEdit, aspect: number | undefined, maxEdge = 1600, quality = 0.85): Promise<{ blob: Blob; quality: PhotoQuality }> {
  const { canvas, usedWidth } = renderToCanvas(src, edit, aspect, maxEdge);
  const q = assess(canvas, usedWidth);
  return { blob: await toBlob(canvas, quality), quality: q };
}

export async function prepareImage(file: File, maxEdge = 1600, quality = 0.85, aspect?: number): Promise<Blob> {
  return (await prepareImageQ(file, maxEdge, quality, aspect)).blob;
}

export async function prepareImageQ(file: File, maxEdge = 1600, quality = 0.85, aspect?: number): Promise<{ blob: Blob; quality: PhotoQuality }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  return renderEdit(bmp, DEFAULT_EDIT, aspect, maxEdge, quality);
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

// Uploads to Brainerd Mail's storage. If storage isn't connected yet (dev),
// falls back to an in-browser preview that checks will refuse to send.
export async function uploadBlob(blob: Blob): Promise<{ url: string; local: boolean }> {
  const fd = new FormData();
  fd.append("file", blob, "photo.jpg");
  try {
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (r.ok) { const j = await r.json(); return { url: j.url, local: false }; }
  } catch {}
  return { url: await blobToDataUrl(blob), local: true };
}

// Adds a photo. When it is cropped to a banner shape, the full photo is
// uploaded too so the author can reposition the crop later.
export async function uploadPhoto(file: File, aspect?: number): Promise<{ url: string; local: boolean; bytes: number; quality: PhotoQuality; original?: string }> {
  const { blob, quality } = await prepareImageQ(file, 1600, 0.85, aspect);
  const main = await uploadBlob(blob);
  let original: string | undefined;
  if (aspect && !main.local) {
    try { original = (await uploadBlob(await prepareImage(file, 1600, 0.85))).url; } catch {}
  }
  return { ...main, bytes: blob.size, quality, original };
}
