import type { Role } from "@/lib/roles-ui";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/roles-ui";

export type TourStep = { title: string; body: string; hint?: string };

// The first-run tour. Everyone gets the basics; each role then gets the steps that are theirs.
export function tourFor(role: Role, name: string): TourStep[] {
  const first = name.split(" ")[0] || "there";
  const welcome: TourStep = { title: `Welcome, ${first}`, body: `You're signed in to Brainerd Mail as ${/^[aeiou]/i.test(ROLE_LABEL[role]) ? "an" : "a"} ${ROLE_LABEL[role]}. ${ROLE_BLURB[role]} This takes about a minute.` };
  const menu: TourStep = { title: "Everything is in the menu", body: "Tap the three lines at the top left of any screen. You'll find Emails, Calendar and anything else your role can use. Your name and role show at the bottom.", hint: "Menu, top left" };
  const emails: TourStep = { title: "Emails", body: "The Emails screen lists every email from every ministry, newest edit first. Search by name, or filter by ministry. Tap one to open it.", hint: "Menu → Emails" };
  const calendar: TourStep = { title: "The calendar", body: "See what each ministry plans to send and what actually went out: on time, late, or missed (judged by the day). Switch between Month and Week. Every email links straight from its day.", hint: "Menu → Calendar" };
  const feedback: TourStep = { title: "Tell us what's off", body: "Something confusing, broken, or missing? Use Feedback inside the email editor. It goes straight to the owner and admins.", hint: "Editor → Feedback" };
  const help: TourStep = { title: "Help is one tap away", body: "The ? button at the top of every screen shows help for the page you're on. You can also type a question in plain English, like \"how do I make a photo bigger?\" If help can't answer it, you can send it to us right there.", hint: "? at the top of any screen" };
  const replay: TourStep = { title: "You're set", body: "You can replay this tour any time from the menu: tap the three lines, then Take the tour.", hint: "Menu → Take the tour" };

  const steps: TourStep[] = [welcome, menu];

  if (role === "viewer") {
    steps.push(emails, { title: "Look, don't touch", body: "You can open any email and see how it looks on a phone and on a desktop. Buttons that change things are hidden for your role, so you can't break anything." }, calendar, feedback);
  }
  if (role === "editor") {
    steps.push(
      emails,
      { title: "Start an email", body: "Tap New email, pick the ministry you're responsible for, and choose a blank email or a starter. You can only build emails for the ministries you were assigned; you can still see everyone else's.", hint: "Emails → New email" },
      { title: "Build it", body: "Add blocks for text, photos, buttons and more. Tap a photo in the email to make it enlarge for readers. Undo and Redo are always there, and History keeps earlier versions so nothing is lost.", hint: "Editor" },
      { title: "Check it first", body: "Tap Send me a test to get the real email in your own inbox, with working links. The checklist flags anything that must be fixed before it can go for approval.", hint: "Editor → Send me a test" },
      { title: "Schedule it", body: "Tap Schedule to choose when it should go out, then send it for approval. Approvers need 72 hours before the send time. Less than that is marked expedited and needs explicit approval.", hint: "Editor → Schedule" },
      { title: "If changes are requested", body: "An approver can send an email back with a note. The note appears at the top of the editor. Fix it and send it for approval again; you'll get an email when it's approved." },
      { title: "Plan ahead on the calendar", body: "Reserve a day with Plan an email, or set up a repeating email like \"third Friday every month.\" Starting from a repeating slot copies the last email so you only update what's new.", hint: "Calendar → Plan an email" },
      feedback,
    );
  }
  if (role === "approver") {
    steps.push(
      { title: "Reviewing emails", body: "When someone sends an email for approval, you get an email with a Review button. It opens a phone-friendly screen that shows the email as readers will see it.", hint: "Emails → Waiting for approval" },
      { title: "Approve or send it back", body: "Approve it, or send it back with a note saying what to change. If the send time is under 72 hours away, you have to confirm that you approve an expedited send. You can't approve an email you submitted yourself.", hint: "Review screen" },
      emails,
      { title: "Edit any ministry's email", body: "Approvers can open and edit any ministry's draft, for example to fix a typo rather than sending it back." },
      calendar, feedback,
    );
  }
  if (role === "admin" || role === "owner") {
    steps.push(
      emails,
      { title: "Review and approve", body: "Emails sent for approval appear as Waiting for approval, and you get an email each time. Approve, or send it back with a note. If the send time is under 72 hours away, you confirm an expedited send." },
      calendar,
      { title: "Team: invite people", body: "Open Team from the menu. Tap Invite someone, enter first and last name and a church email, choose a role, and for Editors pick the ministries they're responsible for. They sign in with Google.", hint: "Menu → Team" },
      { title: "When someone leaves", body: "Open them in Team, tap Manage, then Remove access. They're signed out on their next click and can't get back in. Their past work stays on the history, and you can restore access later.", hint: "Team → Manage → Remove access" },
      { title: "Feedback inbox", body: "Notes people send from the editor land in the Feedback inbox. Mark them seen, planned, or done.", hint: "Menu → Feedback inbox" },
    );
    if (role === "owner") steps.push({ title: "Owner only", body: "Only you can see when each person was last active (in Team), change Admins, or hand ownership to someone else with Make owner. There is only ever one owner." , hint: "Team" });
  }
  steps.push(help, replay);
  return steps;
}
