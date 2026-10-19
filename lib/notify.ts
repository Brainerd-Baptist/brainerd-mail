import { sendEmail } from "./resend";
import { siteUrl } from "./site";
import { when } from "./approval";
import { supabaseAdmin } from "./supabase/admin";
import { signAction } from "./action-token";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Note = {
  kind: "submitted" | "reminder" | "changes" | "approved" | "passed";
  emailId: string; title: string; subject: string; ministry: string;
  sendAt?: string | null; expedited?: boolean; submittedAt?: string; hoursWaiting?: number; note?: string | null;
};

const COPY: Record<Note["kind"], { subject: (n: Note) => string; head: string; body: (n: Note) => string; button: string }> = {
  submitted: {
    subject: (n) => `${n.expedited ? "Expedited: " : ""}Review needed: ${n.title}`,
    head: "An email is waiting for your approval",
    body: (n) => n.expedited
      ? `This one is set to go out in under 72 hours, so it needs your explicit approval and will not send on its own.`
      : `It has at least 72 hours of lead time. Open it to see how it looks on a phone and on a desktop, then approve it or ask for changes.`,
    button: "Review the email",
  },
  reminder: {
    subject: (n) => `Reminder: ${n.title} is still waiting for approval`,
    head: "Still waiting for your approval",
    body: (n) => `It has been waiting about ${Math.round(n.hoursWaiting ?? 0)} hours.`,
    button: "Review the email",
  },
  changes: {
    subject: (n) => `Changes requested: ${n.title}`,
    head: "Changes were requested",
    body: (n) => (n.note ? `Note: “${n.note}”` : `Open it, make the changes, and send it for approval again.`),
    button: "Open the email",
  },
  approved: {
    subject: (n) => `Approved: ${n.title}`,
    head: "Your email was approved",
    body: () => `It is approved and waiting for its send time.`,
    button: "See the email",
  },
  passed: {
    subject: (n) => `Send time passed: ${n.title}`,
    head: "The send time passed without approval",
    body: () => `Nothing was sent. Review it and pick a new send time.`,
    button: "Review the email",
  },
};

// A branded HTML message to staff (never plain text).
export async function notify(to: string[], n: Note) {
  const site = siteUrl();
  const c = COPY[n.kind];
  const url = n.kind === "changes" || n.kind === "approved" ? `${site}/editor?e=${n.emailId}` : `${site}/review/${n.emailId}`;
  const rows = [["Email", n.title], ["Subject", n.subject], n.sendAt ? ["Planned send", when(n.sendAt)] : null].filter(Boolean) as string[][];
  const build = (acts: { approve: string; changes: string } | null) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#00205b;padding:22px 28px;"><img src="${site}/brand/brainerd-logo-white.png" width="150" alt="Brainerd Baptist Church" style="display:block;border:0;height:auto;"></td></tr>
<tr><td style="padding:28px 28px 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#00205b;font-weight:bold;">${esc(c.head)}</td></tr>
<tr><td style="padding:0 28px 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#33445d;">${esc(c.body(n))}</td></tr>
<tr><td style="padding:0 28px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fd;border-radius:12px;">${rows.map(([k, v]) => `<tr><td style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;color:#5b6b82;font-weight:bold;text-transform:uppercase;width:110px;vertical-align:top;">${esc(k)}</td><td style="padding:10px 16px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0b1b33;">${esc(v)}</td></tr>`).join("")}</table></td></tr>
${acts ? `<tr><td style="padding:0 28px 8px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:0 10px 10px 0;"><a href="${acts.approve}" style="display:inline-block;background:#118058;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 26px;border-radius:999px;">Approve</a></td><td style="padding:0 0 10px 0;"><a href="${acts.changes}" style="display:inline-block;background:#ffffff;color:#00205b;border:2px solid #00205b;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:999px;">Request changes</a></td></tr></table></td></tr><tr><td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#5b6b82;">These buttons work only for you and only for this version. You can also change the send time. <a href="${url}" style="color:#1e61b9;font-weight:bold;">Open it in Brainerd Mail</a> instead.</td></tr>` : `<tr><td style="padding:0 28px 30px;"><a href="${url}" style="display:inline-block;background:#1e61b9;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:999px;">${esc(c.button)}</a></td></tr>`}
<tr><td style="background:#f4f8fd;padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b6b82;">Brainerd Mail · sent to staff only</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${c.head}\n\n${c.body(n)}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${acts ? `Approve: ${acts.approve}\nRequest changes: ${acts.changes}\nOr open it in Brainerd Mail: ${url}` : `${c.button}: ${url}`}\n`;
  return { html, text };
  };

  // Approval requests carry two signed buttons per approver (see lib/action-token.ts).
  const tokens = new Map<string, string>();
  if (n.submittedAt && (n.kind === "submitted" || n.kind === "reminder")) {
    try {
      const { data } = await supabaseAdmin().from("staff").select("user_id,email").in("email", to);
      for (const r of data ?? []) tokens.set(String(r.email).toLowerCase(), signAction({ e: n.emailId, u: r.user_id as string, s: n.submittedAt }));
    } catch {}
  }
  await Promise.all(to.map((addr) => {
    const t = tokens.get(addr.toLowerCase());
    const { html, text } = build(t ? { approve: `${site}/a/${t}?do=approve`, changes: `${site}/a/${t}?do=changes` } : null);
    return sendEmail({ to: addr, subject: c.subject(n), html, text }).catch(() => null);
  }));
}

