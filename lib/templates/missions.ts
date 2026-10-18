import type { EmailDoc } from "../blocks";

// Starting point for every Missions newsletter. "Start from last email"
// will copy the most recent sent email instead; this is the first one.
// Content mirrors the October 2026 Canva newsletter, tightened for a phone.
const CANVA = "https://brainerdbaptistkidsnews.my.canva.site/brainerd-baptist-missions-newsletter-october-2026/_assets/media";

const ROSTER = [
  { region: "South America", who: "Ignacio, Lauren, Ali Greis, Sofia, Nicolas, Eleonora & Tobías", place: "Ecuador", deployed: "July 2017", note: "" },
  { region: "South America", who: "John, Aimee, Leia, Clara, Micah & Makayla", place: "Panama", deployed: "2009", note: "Pray for their ministry of sharing, equipping and encouraging." },
  { region: "South America", who: "Jim, Mandy, Micah & Ellie", place: "Peru", deployed: "November 2014", note: "" },
  { region: "Europe / Middle East", who: "Jeremy", place: "Eastern Europe", deployed: "", note: "Pray as he trains and serves with pastors and church planters in Eastern Europe and leads our International Community Connection ministry." },
  { region: "Europe / Middle East", who: "R, A, C, L", place: "", deployed: "September 2019", note: "" },
  { region: "Europe / Middle East", who: "Jeff, Jennifer, Parker, Reece, Riley & Braxton", place: "Germany", deployed: "2023", note: "Serving as a NAMB chaplain for the US Armed Forces." },
  { region: "Africa", who: "Laura", place: "Togo", deployed: "December 2022", note: "" },
  { region: "North America", who: "Dave & Mollie", place: "Tempe, AZ", deployed: "July 2018", note: "NAMB church planters of Salt River Community Church." },
  { region: "South Asia", who: "Brain, Stephanie, Matthew & Caleb", place: "South Asia", deployed: "March 2015", note: "Pray for believers in South Asia who are facing persecution and opposition as a result of placing their faith in Jesus." },
  { region: "South Asia", who: "Jett & Morgan Bates", place: "South Asia", deployed: "March 2026", note: "Pray for a smooth transition to their new home, language learning, new friendships and a fruitful ministry." },
  { region: "South Asia", who: "Greg", place: "South Asia", deployed: "", note: "Pray for Greg’s ministry work in South Asia, that hearts and minds may be receptive to the Good News." },
  { region: "Southeast Asia", who: "Nathan, Amber, Reese & Zella Kate", place: "Asia Pacific Rim", deployed: "October 2013", note: "Pray for the people of Southeast Asia who are still waiting to hear the Good News." },
];

export const MISSIONS_TEMPLATE: EmailDoc = {
  ministry: "missions",
  title: "October Global Update",
  subject: "Global Update: who’s traveling and who we’re praying for",
  previewText: "Two teams head out this month, plus news from the Fricks and Laura, and a way to give.",
  monthLabel: "OCTOBER 2026",
  footerNote: "You’re receiving this email because you’re part of our church family or signed up for our regular newsletter. Let’s keep growing together in faith, love, and community.",
  blocks: [
    {
      id: "hero1", type: "hero", eyebrow: "GLOBAL UPDATE",
      headline: "Kingdom work around the globe.",
      body: "Explore a map of where Brainerd is involved in the Kingdom work happening around the world.",
      showImage: true,
      image: { url: "/sample/map.svg", alt: "A map showing where Brainerd missionaries and teams serve around the world" },
      button: { label: "Open the interactive map", url: "https://www.brainerdbaptist.org/missions" },
    },
    {
      id: "travel1", type: "travel", heading: "UPCOMING TRAVEL", layout: "side-by-side",
      teams: [
        {
          id: "t2", name: "Southeast Asia Team", dates: "Oct 15 – 26", places: "SB · CB · JW · KW",
          prayer: ["Hearts open to the teaching", "Health and safety during travel", "Encouragement for local partners"],
          image: { url: `${CANVA}/ac032acf0a5647d21239a8b8a5afaee4.png`, alt: "A hillside town in Southeast Asia with temples and colorful rooftops" },
        },
        {
          id: "t1", name: "South Asia Team", dates: "Oct 18 – 24", places: "CH · BJ",
          prayer: ["Partners to be strengthened and supported by this visit", "Endurance and joy as they continue the work in challenging circumstances"],
          image: { url: `${CANVA}/ecd1fc94495d0f459ecdff45539041f4.png`, alt: "Green fields and a river at sunset in South Asia" },
        },
      ],
    },
    {
      id: "partners1", type: "partners", heading: "PARTNER UPDATES", showImages: true,
      items: [
        {
          id: "p1", label: "SERVING IN SOUTH ASIA", heading: "Update from the Fricks",
          body: "Before heading to their stateside assignment, they celebrated God’s faithfulness with local Baptist pastors. One of their ministry partners, Rahtee, visited the states and shared how God is working in her life with churches and communities.",
          prayer: ["Praise God for how He provided for Rahtee and used her sharing to impact churches", "Continued growth as the girls learn in classroom settings during stateside time", "Meaningful time with parents and rest before returning to ministry overseas"],
          image: { url: `${CANVA}/9bdb74b16305ee03880cb56314f5c677.png`, alt: "The Fricks and a ministry partner sharing with a children’s class" },
          button: { label: "Read more from the Fricks", url: "https://mailchi.mp/462f72480c79/ov2pmxbhe3" },
        },
        {
          id: "p2", label: "SERVING IN TOGO", heading: "Update from Laura",
          body: "Laura’s first term overseas is wrapping up, and what a journey it has been. From bundling up in a chilly French studio while struggling through her first words of French, to delivering babies and sharing Jesus in Togo, she has seen God’s faithfulness every step of the way. Now she is looking forward to returning home, reuniting with supporters, and celebrating the next chapter with Will.",
          prayer: ["People in Togo to accept Jesus, and for Gospel workers (Reine, Ablam, Judy, Faith) to pursue Kingdom work", "Laura and Will as they travel to the States, plan their wedding, and prepare for marriage", "The maintenance team as they work to restore the oxygen concentrator to full function"],
          image: { url: `${CANVA}/8512b7484be1d0f81019739a1226c07b.png`, alt: "Sunrise over the hills of Togo through the branches of a tree" },
          button: { label: "Read more from Laura", url: "https://mailchi.mp/378851b96841/four-years-later" },
        },
      ],
    },
    {
      id: "card1", type: "card", heading: "Sent from Brainerd",
      body: "Our church has sent many members to serve around the world. They need our ongoing prayer as they share Christ’s love and face the challenges of cross-cultural ministry. Pray for their strength, provision, and open doors for the Gospel. Let’s faithfully support those we’ve sent as partners in the Great Commission.",
      button: { label: "See the full list", url: "https://mail.brainerdhq.app/serving" },
    },
    {
      id: "roster1", type: "partners", heading: "WHO WE’VE SENT", showImages: false,
      items: ROSTER.map((r, n) => ({
        id: `m${n}`, label: [r.region, r.place].filter(Boolean).join(" · ").toUpperCase(), heading: r.who,
        body: [r.deployed && `Deployed ${r.deployed}.`, r.note].filter(Boolean).join(" "), prayer: [],
      })),
    },
    {
      id: "cta1", type: "cta", heading: "Give to Missions",
      body: "If God has put missions on your heart, consider giving toward the Kingdom work happening around the world. Your generosity supports our missionary partners overseas, sends teams from Brainerd to serve alongside them, and helps equip believers in other nations. Give regularly or toward a specific project; every gift advances the Gospel globally.",
      button: { label: "Give to Missions", url: "https://app.securegive.com/brainerdbaptist/main/donate/category?cats=47305&amts=false&recurring=true" },
      note: "Questions? missions@brainerdbaptist.org",
    },
  ],
};
