import { createHmac, timingSafeEqual } from "crypto";

// Signed links for the buttons in approval emails. Nothing is stored: the link carries who it is for, which email,
// and which "sent for approval" moment it belongs to. Editing or deciding the email makes older links stop working.
export type ActionClaims = { e: string; u: string; s: string; x: number }; // email id, approver user id, submitted_at, expires (ms)
export const ACTION_TTL_MS = 7 * 24 * 3600 * 1000;

const secret = () => createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only").update("brainerd-mail-action-links-v1").digest();
const b64 = (b: Buffer) => b.toString("base64url");

export function signAction(c: Omit<ActionClaims, "x">): string {
  const body = b64(Buffer.from(JSON.stringify({ ...c, x: Date.now() + ACTION_TTL_MS })));
  return `${body}.${b64(createHmac("sha256", secret()).update(body).digest())}`;
}

export function verifyAction(token: string): { ok: true; claims: ActionClaims } | { ok: false; expired?: boolean } {
  const [body, sig] = String(token).split(".");
  if (!body || !sig || token.length > 600) return { ok: false };
  const want = createHmac("sha256", secret()).update(body).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, "base64url"); } catch { return { ok: false }; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false };
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ActionClaims;
    if (!c?.e || !c?.u || !c?.s || typeof c.x !== "number") return { ok: false };
    if (Date.now() > c.x) return { ok: false, expired: true };
    return { ok: true, claims: c };
  } catch { return { ok: false }; }
}
