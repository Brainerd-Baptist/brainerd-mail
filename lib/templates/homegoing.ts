import { uid, type EmailDoc } from "../blocks";
import { blankDoc } from "./blank";

// Announcement of the homegoing of a church member. Church-wide colors, a quiet layout:
// the name, a portrait, the notice, then visitation and service details. Anything in [brackets]
// is a prompt to replace; Brainerd Mail won't send for approval until every bracket is gone.
export function homegoingDoc(): EmailDoc {
  const base = blankDoc("church-wide");
  return {
    ...base,
    title: "Homegoing announcement",
    subject: "Announcement of the Homegoing of [Full Name]",
    previewText: "[First name], a member of Brainerd, went home to be with the Lord on [day, date].",
    blocks: [
      { id: uid(), type: "hero", eyebrow: "ANNOUNCEMENT OF THE HOMEGOING OF", headline: "[Mr. or Mrs. Full Name]", body: "[Birth year] – [Year of passing]", showImage: false },
      { id: uid(), type: "photo", image: { url: "", alt: "" }, caption: "" },
      { id: uid(), type: "text", heading: "", body: "[First and last name], a member of Brainerd, went home to be with the Lord on [day, month date].\n\nPlease pray for [First name]’s family at this time." },
      { id: uid(), type: "event", eyebrow: "VISITATION", title: "[Funeral home name]", body: "The family will receive friends.", date: "[Day, month date, start time to end time]", place: "[Funeral home address]" },
      { id: uid(), type: "event", eyebrow: "VISITATION", title: "Brainerd Baptist Church", body: "The family will also receive friends at the church.", date: "[Day, month date, start time to end time]", place: "[Where at the church]" },
      { id: uid(), type: "event", eyebrow: "SERVICE", title: "[Celebration of life service]", body: "", date: "[Day, month date, time]", place: "[Where]" },
      { id: uid(), type: "card", heading: "Full details", body: "Read more about [First name]’s life and the arrangements.", button: { label: "Full details", url: "" } },
    ],
  };
}
