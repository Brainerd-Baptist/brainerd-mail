import { supabaseAdmin } from "@/lib/supabase/admin";

// The master switch for real sending. Server only. If anything goes wrong reading it, Mail behaves as if sending is OFF.
export type SendMode = "off" | "staff" | "live";
export type MailSettings = { send_mode: SendMode; safe_list: string[]; live_cap: number; auto_send: boolean; updated_at: string | null; updated_by: string | null };

export const SAFE_DEFAULT: MailSettings = { send_mode: "off", safe_list: [], live_cap: 25, auto_send: false, updated_at: null, updated_by: null };
export const MODE_LABEL: Record<SendMode, string> = { off: "Off", staff: "Staff only", live: "Live" };
export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export async function getSettings(): Promise<MailSettings> {
  try {
    const { data, error } = await supabaseAdmin().from("mail_settings").select("send_mode,safe_list,live_cap,auto_send,updated_at,updated_by").eq("id", 1).maybeSingle();
    if (error || !data) return SAFE_DEFAULT;
    const mode = data.send_mode === "staff" || data.send_mode === "live" ? (data.send_mode as SendMode) : "off";
    return { send_mode: mode, safe_list: ((data.safe_list as string[] | null) ?? []).map((s) => s.toLowerCase()), live_cap: Number(data.live_cap) || 25, auto_send: !!data.auto_send, updated_at: (data.updated_at as string) ?? null, updated_by: (data.updated_by as string) ?? null };
  } catch {
    return SAFE_DEFAULT;
  }
}

// Used by the real send (next step): who may a send go to right now? Never throws; anything unclear means nobody.
export function allowedRecipients(s: MailSettings, wanted: string[]): { ok: boolean; reason?: string; to: string[] } {
  if (s.send_mode === "off") return { ok: false, reason: "Sending is switched off.", to: [] };
  if (s.send_mode === "staff") {
    const safe = new Set(s.safe_list);
    const to = wanted.filter((e) => safe.has(e.toLowerCase()));
    return to.length ? { ok: true, to } : { ok: false, reason: "Staff-only mode: no one on the safe list to send to.", to: [] };
  }
  if (wanted.length > s.live_cap) return { ok: false, reason: `This send has ${wanted.length} people, over the cap of ${s.live_cap}.`, to: [] };
  return { ok: true, to: wanted };
}
