import { sendEmail } from "./resend";
import { siteUrl } from "./site";
import { ROLE_LABEL, type Role } from "./roles";
import { PALETTES } from "./ministries";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const A = (r: Role) => (r === "admin" || r === "approver" || r === "editor" || r === "owner" ? "an" : "a");

const WHAT: Record<Role, string> = {
  owner: "run everything",
  admin: "invite people and edit and approve any ministry's email",
  approver: "review and approve any ministry's email",
  editor: "build and schedule emails",
  viewer: "see every email and the calendar",
};

// The invitation: branded HTML plus a plain-text copy. Sign-in itself is with Google, so the button just opens the sign-in page.
export async function sendInvite(a: { to: string; firstName?: string; role: Role; ministries: string[]; inviterName: string; expiresAt: string }) {
  const site = siteUrl();
  const url = `${site}/login`;
  const where = a.role === "editor" && a.ministries.length ? ` for ${a.ministries.map((m) => PALETTES[m]?.label ?? m).join(", ")}` : "";
  const label = ROLE_LABEL[a.role];
  const by = a.expiresAt ? new Date(a.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" }) : "";
  const head = "You're invited to Brainerd Mail";
  const hi = a.firstName ? `Hi ${a.firstName}. ` : "";
  const body = `${hi}${a.inviterName} added you to Brainerd Mail as ${A(a.role)} ${label}${where}. You'll be able to ${WHAT[a.role]}.`;
  const how = `Sign in with your Brainerd Baptist Google account (${a.to}). This invitation is good until ${by}.`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#00205b;padding:22px 28px;"><img src="${site}/brand/brainerd-logo-white.png" width="150" alt="Brainerd Baptist Church" style="display:block;border:0;height:auto;"></td></tr>
<tr><td style="padding:28px 28px 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#00205b;font-weight:bold;">${esc(head)}</td></tr>
<tr><td style="padding:0 28px 14px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#33445d;">${esc(body)}</td></tr>
<tr><td style="padding:0 28px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#33445d;">${esc(how)}</td></tr>
<tr><td style="padding:0 28px 30px;"><a href="${url}" style="display:inline-block;background:#1e61b9;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:999px;">Sign in to Brainerd Mail</a></td></tr>
<tr><td style="background:#f4f8fd;padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b6b82;">Brainerd Mail · sent to staff only</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${head}\n\n${body}\n\n${how}\n\nSign in: ${url}\n`;
  await sendEmail({ to: a.to, subject: `${a.inviterName} invited you to Brainerd Mail`, html, text });
}
