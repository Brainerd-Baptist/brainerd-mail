import { uid, type Block, type EmailDoc } from "../blocks";
import { MISSIONS_TEMPLATE } from "./missions";
import { blankDoc } from "./blank";

// One starter per ministry. Anything in [brackets] is a prompt to replace; Brainerd Mail
// won't send for approval until every bracket is gone. Wording follows the church's own
// terms: "Choir & Orchestra" and "Band-Led" services, "the main building", no dates or
// prices that would go stale, and no promises about how guests will be treated.

const hero = (eyebrow: string, headline: string, body: string, button?: { label: string; url: string }): Block =>
  ({ id: uid(), type: "hero", eyebrow, headline, body, showImage: false, button });
const text = (heading: string, body: string): Block => ({ id: uid(), type: "text", heading, body });
const event = (eyebrow: string, title: string, body: string, button?: { label: string; url: string }): Block =>
  ({ id: uid(), type: "event", eyebrow, title, body, date: "[Day, time]", place: "[Where]", button });
const card = (heading: string, body: string, button: { label: string; url: string }): Block => ({ id: uid(), type: "card", heading, body, button });
const cta = (heading: string, body: string, button: { label: string; url: string }, note = ""): Block => ({ id: uid(), type: "cta", heading, body, button, note });

const SITE = "https://www.brainerdbaptist.org";
const FOOTER = MISSIONS_TEMPLATE.footerNote;

type Spec = { title: string; subject: string; previewText: string; blocks: Block[]; footerNote?: string };

function make(ministry: string, s: Spec): EmailDoc {
  return { ...blankDoc(ministry), title: s.title, subject: s.subject, previewText: s.previewText, footerNote: s.footerNote ?? FOOTER, blocks: s.blocks };
}

export const STARTERS: Record<string, { label: string; blurb: string; build: () => EmailDoc }> = {
  "church-wide": {
    label: "Church-wide update", blurb: "A headline, one featured event, what’s ahead, and a next step.",
    build: () => make("church-wide", {
      title: "Church-wide update", subject: "[What’s happening at Brainerd]", previewText: "[One line that makes people want to open it]",
      blocks: [
        hero("FROM BRAINERD", "[The one thing to know this week]", "[Two sentences on why it matters to our church family.]", { label: "[Button label]", url: "" }),
        event("FEATURED EVENT", "[Event name]", "[Two sentences on what it is and who it’s for.]", { label: "Learn more", url: "" }),
        text("What’s ahead", "[A short list in sentences: the next few things to put on the calendar.]"),
        card("Take a next step", "Whether you’re new or have called Brainerd home for years, there’s a next step for you.", { label: "See next steps", url: SITE }),
      ],
    }),
  },
  kids: {
    label: "Kids update", blurb: "A warm opening, a note for parents, check-in help, and an upcoming event.",
    build: () => make("kids", {
      title: "Kids update", subject: "[What’s coming up for kids]", previewText: "[What parents will want to know]",
      blocks: [
        hero("BRAINERD KIDS", "[What your kids will love this month]", "[One or two sentences for parents about what’s happening in Kids.]"),
        text("For parents", "[What’s new, what to bring, or what to talk about at home this week.]"),
        card("Checking in", "Plan to arrive 15 to 20 minutes early. That gives you time to check in, find the room, grab a coffee and a seat.", { label: "How check-in works", url: "" }),
        event("COMING UP", "[Event name]", "[What it is and which ages it’s for.]", { label: "Details and sign-up", url: "" }),
        cta("Serve with Kids", "[A sentence on why serving with kids matters, and what a first step looks like.]", { label: "Tell us you’re interested", url: "" }),
      ],
    }),
  },
  students: {
    label: "Students update", blurb: "For students and parents: the next gathering, the next event, what to know.",
    build: () => make("students", {
      title: "Students update", subject: "[The next thing for students]", previewText: "[What’s happening and when]",
      blocks: [
        hero("BRAINERD STUDENTS", "[Headline that sounds like a student wrote it]", "[One or two sentences on what’s happening.]"),
        event("THIS WEEK", "[Weekly gathering]", "[What to expect and who it’s for.]"),
        event("COMING UP", "[Next event]", "[What it is, what it costs, what to bring.]", { label: "Sign up", url: "" }),
        text("For parents", "[What parents should know: transportation, forms, who to contact.]"),
        card("Questions?", "[Who students and parents can reach out to.]", { label: "Contact the Students team", url: "" }),
      ],
    }),
  },
  bx: {
    label: "BX news", blurb: "News from the BX and a clear way to ask about reserving it.",
    build: () => make("bx", {
      title: "BX news", subject: "[What’s new at the BX]", previewText: "[A line about what’s happening there]",
      blocks: [
        hero("THE BX", "[What’s new at the BX]", "[One or two sentences on what’s happening.]"),
        text("What’s going on", "[A short update on events, improvements, or how the space is being used.]"),
        event("UPCOMING", "[Event name]", "[What it is and who it’s for.]", { label: "Details", url: "" }),
        card("Plan an event at the BX", "Thinking about hosting something? Call 423.643.4978 or ask about reserving the BX.", { label: "Ask about reserving", url: "" }),
      ],
    }),
  },
  pdo: {
    label: "PDO monthly update", blurb: "What's coming up, announcements, weather and closures, and payment reminders for PDO families.",
    build: () => make("pdo", {
      title: "PDO monthly update", subject: "[Month] at PDO", previewText: "[One line about the most important thing this month]",
      blocks: [
        hero("PARENTS DAY OUT", "[Month] at PDO", "[One or two warm sentences to open the month.]"),
        text("Weather and closures", "[Any closure or delay this month, with the day and how families will hear about it. If there are none, say: No closures are planned this month.]"),
        event("COMING UP", "[Activity or special day]", "[What children will do and anything to send with them.]"),
        event("COMING UP", "[Second activity, field trip or event]", "[What it is and what to bring.]"),
        text("Announcements", "[Two or three short items: staff news, enrollment, schedule changes, reminders.]"),
        card("Payments", "[A short reminder of what is due and when.]", { label: "Make a payment", url: "" }),
        cta("Questions?", "[Who to contact at PDO and the best way to reach them.]", { label: "Contact PDO", url: "" }),
      ],
    }),
  },
  "life-groups": {
    label: "Life Groups update", blurb: "Invites people into groups, with a nudge to lead one.",
    build: () => make("life-groups", {
      title: "Life Groups update", subject: "[Find your people]", previewText: "[A short invitation]",
      blocks: [
        hero("LIFE GROUPS", "[Headline that invites someone in]", "[Two sentences on what a Life Group is like.]"),
        text("Why a group", "[A short story or reason groups matter at Brainerd.]"),
        card("Find a Life Group", "Browse groups by day, time and season of life, then reach out to the leader.", { label: "Find a Life Group", url: "" }),
        event("FOR LEADERS", "[Leader gathering or training]", "[What it covers and who should come.]", { label: "Sign up", url: "" }),
        cta("Lead a group", "[A sentence for someone who has wondered about hosting.]", { label: "Tell us you’re interested", url: "" }),
      ],
    }),
  },
  adults: {
    label: "Adults update", blurb: "A short word, the next gathering, and a way to connect.",
    build: () => make("adults", {
      title: "Adults update", subject: "[What’s next for adults]", previewText: "[One line about what’s ahead]",
      blocks: [
        hero("ADULTS AT BRAINERD", "[What’s ahead for adults]", "[One or two sentences setting up the update.]"),
        text("[A short word]", "[Two or three short paragraphs: encouragement, a reflection, or news.]"),
        event("COMING UP", "[Event name]", "[What it is and who it’s for.]", { label: "Details and sign-up", url: "" }),
        card("Connect", "[A line about the next way to get connected.]", { label: "Get connected", url: "" }),
      ],
    }),
  },
  men: {
    label: "Men’s update", blurb: "A short devotional thought, the next gathering, and how to connect.",
    build: () => make("men", {
      title: "Men’s update", subject: "[What’s next for the men of Brainerd]", previewText: "[One line about the next gathering]",
      blocks: [
        hero("MEN OF BRAINERD", "[Headline for the men]", "[One or two sentences on what’s happening.]"),
        text("A word for the week", "[A verse and two or three sentences of reflection.]"),
        event("NEXT GATHERING", "[Gathering name]", "[What it is, what to expect, who to bring.]", { label: "Details", url: "" }),
        card("Get connected", "[A line about joining a group or serving alongside other men.]", { label: "Find your group", url: "" }),
      ],
    }),
  },
  women: {
    label: "Women’s update", blurb: "An encouraging word, the next gathering, and how to connect.",
    build: () => make("women", {
      title: "Women’s update", subject: "[What’s next for the women of Brainerd]", previewText: "[One line about the next gathering]",
      blocks: [
        hero("WOMEN OF BRAINERD", "[Headline for the women]", "[One or two sentences on what’s happening.]"),
        text("An encouraging word", "[A verse and two or three sentences of encouragement.]"),
        event("NEXT GATHERING", "[Gathering name]", "[What it is, what to expect, who to bring.]", { label: "Details and sign-up", url: "" }),
        card("Get connected", "[A line about joining a group or serving alongside other women.]", { label: "Find your group", url: "" }),
      ],
    }),
  },
  missions: {
    label: "Missions update", blurb: "Upcoming travel, partner updates, a link to the full list, and a way to give.",
    build: () => JSON.parse(JSON.stringify(MISSIONS_TEMPLATE)),
  },
};
