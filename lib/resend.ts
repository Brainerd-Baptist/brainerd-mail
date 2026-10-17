// Sends one email through Resend's REST API (same service Brainerd HQ uses).
export async function sendEmail(a: { to: string; subject: string; html: string; text: string; unsubscribeUrl?: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Brainerd Mail <mail@brainerdhq.app>",
      to: [a.to], subject: a.subject, html: a.html, text: a.text, reply_to: a.replyTo,
      headers: a.unsubscribeUrl ? { "List-Unsubscribe": `<${a.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Resend said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { id: string };
}
