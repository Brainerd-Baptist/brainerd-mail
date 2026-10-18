// "just now", "5 min ago", "yesterday", "Oct 12"
export function ago(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  if (s < 172800) return "yesterday";
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} days ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(t).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric", timeZone: "America/New_York" });
}
