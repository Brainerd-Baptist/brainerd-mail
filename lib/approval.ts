// The approval rules in one place (see the Brainerd Mail spec).
// A normal send needs 72 hours between "sent for approval" and the send time.
// Under 72 hours is "expedited": it needs explicit approval and never auto-sends.
export const LEAD_HOURS = 72;
export const REMINDER_HOURS = [24, 48, 66];
export const MIN_SEND_MINUTES = 30; // can't schedule a send in the next half hour

export function leadHours(sendAt: Date | string, from: Date | string = new Date()): number {
  return (new Date(sendAt).getTime() - new Date(from).getTime()) / 3600000;
}
export const isExpedited = (sendAt: Date | string, from: Date | string = new Date()) => leadHours(sendAt, from) < LEAD_HOURS;

// Sending itself is not switched on yet: approved emails wait, nothing goes out.
export const SENDING_ENABLED = false;

export const EDITING_CANCELS = ["pending_approval", "approved"]; // editing returns these to draft
export const READ_ONLY = ["scheduled", "sending", "sent", "cancelled"];

export function when(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";
}
