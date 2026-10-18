// Prepares a photo from a phone: fixes rotation, shrinks it to a sensible
// size and compresses it, so a 12 MB camera photo becomes a ~200-400 KB
// email-friendly JPEG before it ever leaves the phone.
// With `aspect` (width / height, e.g. 3 for a wide banner) the photo is
// center-cropped to that shape so every email's header image matches.
export async function prepareImage(file: File, maxEdge = 1600, quality = 0.85, aspect?: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (aspect) {
    if (bmp.width / bmp.height > aspect) { sw = Math.round(bmp.height * aspect); sx = Math.round((bmp.width - sw) / 2); }
    else { sh = Math.round(bmp.width / aspect); sy = Math.round((bmp.height - sh) / 2); }
  }
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/jpeg", quality));
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}

// Uploads to Brainerd Mail's storage. If storage isn't connected yet (dev),
// falls back to an in-browser preview that checks will refuse to send.
export async function uploadPhoto(file: File, aspect?: number): Promise<{ url: string; local: boolean; bytes: number }> {
  const blob = await prepareImage(file, 1600, 0.85, aspect);
  const fd = new FormData();
  fd.append("file", blob, "photo.jpg");
  try {
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (r.ok) { const j = await r.json(); return { url: j.url, local: false, bytes: blob.size }; }
  } catch {}
  return { url: await blobToDataUrl(blob), local: true, bytes: blob.size };
}
