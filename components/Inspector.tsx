"use client";
import type { Block, TravelTeam, PartnerItem } from "@/lib/blocks";
import { uid } from "@/lib/blocks";
import { Area, ButtonFields, Field, ImageFields, Lines, Segmented, Toggle } from "./fields";
import { Plus, Trash2 } from "lucide-react";

type P = { block: Block; onChange: (b: Block) => void };

export default function Inspector({ block, onChange }: P) {
  const set = (patch: Partial<Block>) => onChange({ ...block, ...patch } as Block);

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-4">
          <Field label="Month or label (top right)" value={block.eyebrow} onChange={(v) => set({ eyebrow: v })} />
          <Field label="Headline" value={block.headline} onChange={(v) => set({ headline: v })} />
          <Area label="Short intro" value={block.body} onChange={(v) => set({ body: v })} rows={3} />
          <Toggle label="Show a picture" checked={block.showImage} onChange={(v) => set({ showImage: v })} />
          {block.showImage ? <ImageFields label="Header photo (cropped to a wide banner)" aspect={3} value={block.image} onChange={(v) => set({ image: v })} /> : null}
          <ButtonFields value={block.button} onChange={(v) => set({ button: v })} />
        </div>
      );
    case "text":
      return (
        <div className="space-y-4">
          <Field label="Heading (optional)" value={block.heading} onChange={(v) => set({ heading: v })} />
          <Area label="Text" value={block.body} onChange={(v) => set({ body: v })} rows={8} hint="Leave a blank line between paragraphs" />
        </div>
      );
    case "travel": {
      const upd = (id: string, patch: Partial<TravelTeam>) => set({ teams: block.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
      return (
        <div className="space-y-4">
          <Segmented label="Layout" value={block.layout} options={[{ value: "side-by-side", label: "Side by side" }, { value: "stacked", label: "Stacked" }]} onChange={(v) => set({ layout: v })} />
          <Field label="Section label" value={block.heading} onChange={(v) => set({ heading: v })} />
          {block.teams.map((t, i) => (
            <div key={t.id} className="space-y-3 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="label !mb-0">Team {i + 1}</span>
                <button type="button" aria-label="Remove team" className="text-muted hover:text-red-600" onClick={() => set({ teams: block.teams.filter((x) => x.id !== t.id) })}><Trash2 size={16} /></button>
              </div>
              <Field label="Team name" value={t.name} onChange={(v) => upd(t.id, { name: v })} />
              <Field label="Dates" value={t.dates} onChange={(v) => upd(t.id, { dates: v })} />
              <Field label="Places or team initials" value={t.places} onChange={(v) => upd(t.id, { places: v })} />
              <ImageFields label="Photo (optional, cropped to 3:2)" aspect={1.5} value={t.image} onChange={(v) => upd(t.id, { image: v })} />
              <Lines label="Pray for" value={t.prayer} onChange={(v) => upd(t.id, { prayer: v })} />
            </div>
          ))}
          <button type="button" className="pill-btn w-full border-2 border-navy text-navy" onClick={() => set({ teams: [...block.teams, { id: uid("t"), name: "Team name", dates: "Dates", places: "", prayer: [] }] })}><Plus size={16} className="mr-1" /> Add a team</button>
        </div>
      );
    }
    case "partners": {
      const upd = (id: string, patch: Partial<PartnerItem>) => set({ items: block.items.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
      return (
        <div className="space-y-4">
          <Field label="Section label" value={block.heading} onChange={(v) => set({ heading: v })} />
          <Toggle label="Show pictures" checked={block.showImages} onChange={(v) => set({ showImages: v })} />
          {block.items.map((it, i) => (
            <div key={it.id} className="space-y-3 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="label !mb-0">Update {i + 1}</span>
                <button type="button" aria-label="Remove update" className="text-muted hover:text-red-600" onClick={() => set({ items: block.items.filter((x) => x.id !== it.id) })}><Trash2 size={16} /></button>
              </div>
              <Field label="Small label" value={it.label} onChange={(v) => upd(it.id, { label: v })} />
              <Field label="Heading" value={it.heading} onChange={(v) => upd(it.id, { heading: v })} />
              <Area label="Update" value={it.body} onChange={(v) => upd(it.id, { body: v })} rows={5} />
              <Lines label="Prayer requests" value={it.prayer} onChange={(v) => upd(it.id, { prayer: v })} />
              {block.showImages ? <ImageFields label="Photo (cropped to a 3:2 shape)" aspect={1.5} value={it.image} onChange={(v) => upd(it.id, { image: v })} /> : null}
              <ButtonFields value={it.button} onChange={(v) => upd(it.id, { button: v })} />
            </div>
          ))}
          <button type="button" className="pill-btn w-full border-2 border-navy text-navy" onClick={() => set({ items: [...block.items, { id: uid("p"), label: "SERVING IN", heading: "Update from", body: "", prayer: [] }] })}><Plus size={16} className="mr-1" /> Add an update</button>
        </div>
      );
    }
    case "cta":
      return (
        <div className="space-y-4">
          <Field label="Heading" value={block.heading} onChange={(v) => set({ heading: v })} />
          <Area label="Text" value={block.body} onChange={(v) => set({ body: v })} rows={5} />
          <ButtonFields value={block.button} onChange={(v) => set({ button: v ?? { label: "", url: "" } })} />
          <Field label="Small note under the button" value={block.note} onChange={(v) => set({ note: v })} />
        </div>
      );
    case "card":
      return (
        <div className="space-y-4">
          <Field label="Heading" value={block.heading} onChange={(v) => set({ heading: v })} />
          <Area label="Text" value={block.body} onChange={(v) => set({ body: v })} rows={5} />
          <ButtonFields value={block.button} onChange={(v) => set({ button: v })} />
        </div>
      );
    case "photo":
      return (
        <div className="space-y-4">
          <ImageFields value={block.image} onChange={(v) => set({ image: v })} />
          <Toggle label="Tap to enlarge (opens full size so people can zoom and save it)" checked={block.enlarge !== false} onChange={(v) => set({ enlarge: v })} />
          <Field label="Caption (optional)" value={block.caption} onChange={(v) => set({ caption: v })} />
        </div>
      );
    case "event":
      return (
        <div className="space-y-4">
          <Field label="Small label" value={block.eyebrow} onChange={(v) => set({ eyebrow: v })} />
          <Field label="Event name" value={block.title} onChange={(v) => set({ title: v })} />
          <Area label="Description" value={block.body} onChange={(v) => set({ body: v })} rows={4} />
          <Field label="Date and time" value={block.date} onChange={(v) => set({ date: v })} />
          <Field label="Place" value={block.place} onChange={(v) => set({ place: v })} />
          <ButtonFields value={block.button} onChange={(v) => set({ button: v })} />
        </div>
      );
    case "map":
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted">A picture of the live Missions map. It always shows the map as it is now, so it can change after the email is sent. Update it in Missions.</p>
          <Field label="Small label" value={block.heading} onChange={(v) => set({ heading: v })} />
          <Area label="Short note (optional)" value={block.body} onChange={(v) => set({ body: v })} rows={3} />
          <Segmented label="Colors" value={String(block.level) as "0" | "1" | "2" | "3"} options={[{ value: "0", label: "All levels" }, { value: "1", label: "Level 1" }, { value: "2", label: "Level 2" }, { value: "3", label: "Level 3" }]} onChange={(v) => set({ level: Number(v) as 0 | 1 | 2 | 3 })} />
          <Toggle label="Show the color key under the map" checked={block.showLegend} onChange={(v) => set({ showLegend: v })} />
          {block.showLegend ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Field key={i} label={`Key for Level ${i + 1}`} value={block.legend?.[i] ?? ""} onChange={(v) => { const l = [...(block.legend ?? ["", "", ""])]; l[i] = v; set({ legend: l }); }} />)}
              <button type="button" className="pill-btn border-2 border-navy text-navy" onClick={async () => { try { const j = await (await fetch("/api/public/missions")).json(); if (Array.isArray(j.levels)) set({ legend: j.levels.map((x: { label: string }) => x.label) }); } catch {} }}>Use the names from Missions</button>
            </div>
          ) : null}
          <ButtonFields value={block.button} onChange={(v) => set({ button: v })} />
        </div>
      );
    case "divider":
      return <p className="text-sm text-muted">A thin line between sections. Nothing to edit.</p>;
  }
}
