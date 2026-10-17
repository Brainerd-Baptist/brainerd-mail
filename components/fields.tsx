"use client";
import type { Btn, Img } from "@/lib/blocks";

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

export function ButtonFields({ label = "Button", value, onChange }: { label?: string; value?: Btn; onChange: (v: Btn | undefined) => void }) {
  const v = value ?? { label: "", url: "" };
  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-3">
      <span className="label !mb-0">{label}</span>
      <Field label="Words on the button" value={v.label} onChange={(x) => onChange({ ...v, label: x })} />
      <Field label="Where it goes" value={v.url} onChange={(x) => onChange({ ...v, url: x })} placeholder="https://" />
    </div>
  );
}

export function ImageFields({ label = "Photo", value, onChange }: { label?: string; value?: Img; onChange: (v: Img) => void }) {
  const v = value ?? { url: "", alt: "" };
  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-3">
      <span className="label !mb-0">{label}</span>
      {v.url ? <img src={v.url} alt="" className="h-24 w-full rounded-lg object-cover" /> : <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">No photo yet</div>}
      <Field label="Photo address" value={v.url} onChange={(x) => onChange({ ...v, url: x })} placeholder="Upload coming soon, paste an address for now" />
      <Field label="Description for screen readers" value={v.alt} onChange={(x) => onChange({ ...v, alt: x })} hint="Describe what is in the photo" />
    </div>
  );
}
