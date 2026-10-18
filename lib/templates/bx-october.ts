import type { EmailDoc } from "../blocks";

// October 2026 BX news, rebuilt from the September Canva newsletter. Photos are still
// hotlinked from Canva (like the Missions email): re-upload them in the editor before a real send.
const CANVA = "https://brainerdbaptistkidsnews.my.canva.site/september-bx-news/_assets/media";

export const BX_OCTOBER: EmailDoc = {
  ministry: "bx",
  title: "October BX News",
  subject: "October at the BX: Family Fun Run on Oct 24",
  previewText: "Join us for the Family Fun Run on October 24, plus the group fitness schedule and training with Cherish Hamill.",
  monthLabel: "OCTOBER 2026",
  footerNote: "You’re receiving this email because you’re part of the BX community.",
  blocks: [
    {
      id: "hero1", type: "hero", eyebrow: "OCTOBER BX NEWS",
      headline: "A new season at the BX.",
      body: "Save some dates and hop into a new class this semester.",
      showImage: true,
      image: { url: `${CANVA}/7215fc0879558a3e35256c94f797c89e.jpg`, alt: "Sneakers, dumbbells and a water bottle on the floor of the BX fitness room, with the Brainerd BX Crossroads logo" },
    },
    {
      id: "photo1", type: "photo", caption: "",
      image: { url: `${CANVA}/6cd2786357a683ae9579d83a02793402.jpg`, alt: "Brainerd Baptist Family Fun Run graphic with autumn leaves and the church campus" },
    },
    {
      id: "event1", type: "event", eyebrow: "COMMUNITY EVENT", title: "Family Fun Run",
      body: "Run with us! Support the community, get a sweat in, and pick up free giveaways.",
      date: "Saturday, October 24 · 9 to 11 AM", place: "Belvoir neighborhood",
      button: { label: "Register", url: "https://brainerdbaptist.churchcenter.com/registrations/events/3663860" },
    },
    {
      id: "coach1", type: "partners", heading: "MEET A COACH", showImages: true,
      items: [{
        id: "c1", label: "TRAIN WITH US", heading: "Train with Cherish Hamill",
        body: "Cherish has a BS in Exercise Science and an M Ed in Physical Education. She is an ACSM certified personal trainer and group fitness instructor, holds a CrossFit L1 certification, and is a certified Health and Nutrition Coach.\n\nShe loves coaching the Advanced Fitness class and enjoys one-on-one training built around each person’s needs and goals, plus nutrition and healthy habit coaching for lifestyle changes that last.\n\nJoin her Mondays and Fridays at 9 AM for Advanced Fitness in the Aerobics Room. To get started, call 423-503-4482.",
        prayer: [],
        image: { url: `${CANVA}/b268163684a2a539a1c106dc26f357da.jpg`, alt: "Cherish Hamill, BX trainer, smiling in a light blue tank top" },
      }],
    },
    {
      id: "card1", type: "card", heading: "New equipment on the way",
      body: "New gym equipment is coming in. Look for some rearranging of equipment over the next few weeks.",
    },
    {
      id: "text1", type: "text", heading: "Schedule changes",
      body: "[Any closures or court changes this month. Delete this block if there are none.]",
    },
  ],
};
