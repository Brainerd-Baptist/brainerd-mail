// Prepares a photo from a phone: fixes rotation, shrinks it to a sensible
// size and compresses it, so a 12 MB camera photo becomes a ~200-400 KB
// email-friendly JPEG before it ever leaves the phone.
export async function prepareImage(file: File, maxEdge = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/jpeg", quality));
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}

// Uploads to Brainerd Mail's storage. If storage isn't connected yet (dev),
// falls back to an in-browser preview that checks will refuse to send.
export async function uploadPhoto(file: File): Promise<{ url: string; local: boolean; bytes: number }> {
  const blob = await prepareImage(file);
  const fd = new FormData();
  fd.append("file", blob, "photo.jpg");
  try {
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (r.ok) { const j = await r.json(); return { url: j.url, local: false, bytes: blob.size }; }
  } catch {}
  return { url: await blobToDataUrl(blob), local: true, bytes: blob.size };
}
