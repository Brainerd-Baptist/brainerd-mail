import { loadAll } from "@/lib/missions-db";
import { currentMe, canEditMissions } from "@/lib/roles";
import { MissionsEditor } from "@/components/MissionsEditor";

export const dynamic = "force-dynamic";

// Signed-in staff only (middleware.ts). Everyone can look; Owner, Admins, Approvers and Missions editors can change.
export default async function MissionsPage() {
  const me = await currentMe();
  const { countries, levels } = await loadAll();
  return <MissionsEditor initialCountries={countries} initialLevels={levels} canEdit={!!me && canEditMissions(me)} />;
}
