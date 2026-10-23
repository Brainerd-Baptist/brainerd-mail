"use client";
import { useEffect, useRef, useState } from "react";
import { X, RotateCw, Sun, Wand2, RotateCcw } from "lucide-react";
import { renderToCanvas, renderEdit, loadImage, uploadBlob } from "@/lib/image";
import { DEFAULT_EDIT, SHAPES, autoGamma, cropRect, shapeAspect, type PhotoEdit, type Shape } from "@/lib/photo-edit";
import type { PhotoQuality } from "@/lib/image-quality";

// Three small tools: choose what shows (drag + zoom), brighten, rotate.
// Always works from the original, so nothing is ever lost.
export function PhotoEditor({ source, shape: shape0, initial, quality, onCancel, onSave }: {
  source: string; shape: Shape; initial?: PhotoEdit; quality?: PhotoQuality;
  onCancel: () => void;
  onSave: (r: { url: string; local: boolean; edit: PhotoEdit; quality: PhotoQuality; shape: Shape }) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<PhotoEdit>(initial ?? DEFAULT_EDIT);
  const [busy, setBusy] = useState(false);
  const [shape, setShape] = useState<Shape>(shape0);
  const aspect = shapeAspect(shape);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

  useEffect(() => {
    loadImage(source).then((i) => {
      setImg(i);
      // A dark photo opens already brightened; the author can undo it.
      if (!initial && quality?.dark && quality.brightness) setEdit((e) => ({ ...e, gamma: autoGamma(quality.brightness!) }));
    }).catch(() => setErr("Could not open that photo. Try adding it again."));
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      const cv = canvasRef.current!;
      const { canvas } = renderToCanvas(img, edit, aspect, 720);
      cv.width = canvas.width; cv.height = canvas.height;
      cv.getContext("2d")!.drawImage(canvas, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [img, edit, aspect]);

  const swap = edit.rotate === 90 || edit.rotate === 270;
  const rw = img ? (swap ? img.naturalHeight : img.naturalWidth) : 1, rh = img ? (swap ? img.naturalWidth : img.naturalHeight) : 1;

  function down(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: edit.fx, fy: edit.fy };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current, cv = canvasRef.current;
    if (!d || !cv || !img) return;
    const r = cropRect(rw, rh, aspect, edit.zoom, 0, 0);
    const k = r.sw / cv.getBoundingClientRect().width; // source pixels per screen pixel
    const slackX = rw - r.sw, slackY = rh - r.sh;
    const fx = slackX > 1 ? d.fx - ((e.clientX - d.x) * k) / slackX : d.fx;
    const fy = slackY > 1 ? d.fy - ((e.clientY - d.y) * k) / slackY : d.fy;
    setEdit((s) => ({ ...s, fx: Math.min(1, Math.max(0, fx)), fy: Math.min(1, Math.max(0, fy)) }));
  }

  async function save() {
    if (!img) return;
    setBusy(true); setErr("");
    try {
      const { blob, quality: q } = await renderEdit(img, edit, aspect, 1600, 0.85);
      const up = await uploadBlob(blob);
      onSave({ url: up.url, local: up.local, edit, quality: q, shape });
    } catch { setErr("Could not save that. Try again."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[rgb(var(--color-mist))] text-white">
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <button onClick={onCancel} aria-label="Cancel" className="flex h-11 w-11 items-center justify-center rounded-full"><X size={22} /></button>
        <span className="text-[15px] font-semibold">Adjust photo</span>
        <button onClick={save} disabled={!img || busy} className="min-h-11 rounded-full bg-brand px-5 text-[15px] font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3">
        {err ? <p className="text-sm text-[#ffb4b4]">{err}</p> : !img ? <p className="text-sm text-white/70">Opening photo…</p> : (
          <>
            <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)} className={`max-h-full cursor-grab touch-none bg-black ${shape === "circle" ? "aspect-square w-auto max-w-[360px] rounded-full object-cover" : "w-full max-w-[560px] rounded-lg"}`} />
            <p className="mt-2 text-xs text-white/60">Drag the photo to choose what shows.</p>
          </>
        )}
      </div>
      <div className="shrink-0 space-y-4 px-5 pb-8 pt-3">
        <div>
          <span className="mb-1 block text-sm font-semibold">Shape</span>
          <div className="flex flex-wrap gap-2">
            {SHAPES.map((x) => (
              <button key={x.key} type="button" onClick={() => { setShape(x.key); setEdit((e) => ({ ...e, fx: 0.5, fy: 0.5 })); }}
                className={`min-h-9 rounded-full border px-3.5 text-sm font-semibold ${shape === x.key ? "border-white bg-surface text-[#0b1220]" : "border-white/30"}`}>{x.label}</button>
            ))}
          </div>
        </div>
        <label className="block text-sm"><span className="mb-1 block font-semibold">Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={edit.zoom} onChange={(e) => setEdit({ ...edit, zoom: Number(e.target.value) })} className="w-full accent-[#6aa6ff]" />
        </label>
        <label className="block text-sm"><span className="mb-1 flex items-center justify-between font-semibold"><span className="flex items-center gap-1.5"><Sun size={15} />Brightness</span>
          <button type="button" onClick={() => img && setEdit({ ...edit, gamma: autoGamma(quality?.brightness ?? 70) })} className="flex min-h-8 items-center gap-1 rounded-full border border-white/30 px-3 text-xs font-semibold"><Wand2 size={13} />Auto</button></span>
          <input type="range" min={1} max={2.2} step={0.01} value={edit.gamma} onChange={(e) => setEdit({ ...edit, gamma: Number(e.target.value) })} className="w-full accent-[#6aa6ff]" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEdit({ ...edit, rotate: (((edit.rotate + 90) % 360) as PhotoEdit["rotate"]), fx: 0.5, fy: 0.5 })} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/30 text-sm font-semibold"><RotateCw size={16} />Rotate</button>
          <button type="button" onClick={() => setEdit(DEFAULT_EDIT)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/30 text-sm font-semibold"><RotateCcw size={16} />Reset</button>
        </div>
      </div>
    </div>
  );
}
