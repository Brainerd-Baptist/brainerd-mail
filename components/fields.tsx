"use client";
import { useRef, useState } from "react";
import { Camera, ClipboardPaste, ImagePlus } from "lucide-react";
import type { Btn, Img } from "@/lib/blocks";
import { uploadPhoto } from "@/lib/image";
import { PhotoEditor } from "@/components/PhotoEditor";

export function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Area({ label, value, onChange, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="field" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

// One item per line, e.g. prayer points.
export function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="field" rows={Math.max(3, value.length + 1)} value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
      <span className="mt-1 block text-xs text-muted">One per line</span>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-[15px] text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-brand" : "bg-[#c4cfdc]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-1 rounded-full bg-[#e3eaf2] p-1">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${value === o.value ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LinkField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [msg, setMsg] = useState("");
  async function paste() {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (t) { onChange(/^https?:\/\//i.test(t) ? t : `https://${t}`); setMsg(""); }
      else setMsg("Nothing copied yet");
    } catch { setMsg("Press and hold in the box, then tap Paste"); }
  }
  return (
    <div>
      <span className="label">Where it goes</span>
      <div className="flex gap-2">
        <input className="field min-w-0 flex-1" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={value} placeholder="https://" onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={paste} className="pill-btn shrink-0 border-2 border-navy px-4 text-navy" aria-label="Paste the link you copied"><ClipboardPaste size={18} className="mr-1.5" />Paste</button>
      </div>
      {msg ? <span className="mt-1 block text-xs text-muted">{msg}</span> : null}
    </div>
  );
}

export function ButtonFields({ label = "Button", value, onChange }: { label?: string; value?: Btn; onChange: (v: Btn | undefined) => void }) {
  const v = value ?? { label: "", url: "" };
  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-3">
      <span className="label !mb-0">{label}</span>
      <Field label="Words on the button" value={v.label} onChange={(x) => onChange({ ...v, label: x })} />
      <LinkField value={v.url} onChange={(x) => onChange({ ...v, url: x })} />
    </div>
  );
}

export function ImageFields({ label = "Photo", value, onChange, aspect }: { label?: string; value?: Img; onChange: (v: Img) => void; aspect?: number }) {
  const v = value ?? { url: "", alt: "" };
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  async function pick(file?: File | null) {
    if (!file) return;
    setBusy(true); setNote("");
    try {
      const r = await uploadPhoto(file, aspect);
      onChange({ ...v, url: r.url, quality: r.quality, original: r.original, edit: undefined });
      setNote(r.local ? "Preview only. Photos upload for real once storage is connected." : `Added (${Math.round(r.bytes / 1024)} KB)`);
    } catch { setNote("That photo could not be read. Try another."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-3">
      <span className="label !mb-0">{label}</span>
      {v.url ? <img src={v.url} alt="" className="h-40 w-full rounded-lg object-cover" /> : (
        <button type="button" onClick={() => input.current?.click()} className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-muted active:bg-[#f4f8fd]">
          <ImagePlus size={28} /><span className="text-sm font-semibold">Tap to add a photo</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="pill-btn flex-1 border-2 border-navy text-navy"><Camera size={18} className="mr-1.5" />{busy ? "Adding…" : v.url ? "Change photo" : "Choose or take a photo"}</button>
        {v.url ? <button type="button" onClick={() => setEditing(true)} className="pill-btn px-4 text-brand">Adjust</button> : null}
        {v.url ? <button type="button" onClick={() => onChange({ ...v, url: "", quality: undefined, original: undefined, edit: undefined })} className="pill-btn px-4 text-muted">Remove</button> : null}
      </div>
      {note ? <span className="block text-xs text-muted">{note}</span> : null}
      {v.url && (v.quality?.dark || v.quality?.soft || v.quality?.small) ? (
        <span className="block rounded-lg bg-[#fff6e5] px-3 py-2 text-xs text-[#7a4a00]">{v.quality.dark ? "This photo looks dark. Tap Adjust to brighten it. " : ""}{v.quality.soft ? "It looks a little blurry. " : ""}{v.quality.small ? "It's small, so it may look soft on new phones." : ""}</span>
      ) : null}
      {editing && v.url ? (
        <PhotoEditor source={v.original ?? v.url} aspect={aspect} initial={v.edit} quality={v.quality}
          onCancel={() => setEditing(false)}
          onSave={(r) => { onChange({ ...v, url: r.url, original: v.original ?? v.url, edit: r.edit, quality: r.quality }); setEditing(false); setNote(r.local ? "Preview only. Photos upload for real once storage is connected." : "Photo adjusted"); }} />
      ) : null}
      <Field label="Description for screen readers" value={v.alt} onChange={(x) => onChange({ ...v, alt: x })} hint="Say what is in the photo, in a few words" />
    </div>
  );
}
