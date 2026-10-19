// Roles and what they allow. Pure (no server code), so screens and routes share one definition.
export type Role = "owner" | "admin" | "approver" | "editor" | "viewer";
export const ROLES: Role[] = ["owner", "admin", "approver", "editor", "viewer"];
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", approver: "Approver", editor: "Editor", viewer: "Viewer" };
export const ROLE_BLURB: Record<Role, string> = {
  owner: "Can do everything, including changing Admins and handing off ownership. There is only one.",
  admin: "Runs Mail day to day: invites people, edits and approves any ministry's email, reads the Feedback inbox.",
  approver: "Signs off on emails. Approves or sends back any ministry's email and can edit them. Can't manage people.",
  editor: "Builds emails for the ministries assigned to them: edit, schedule, send for approval. Can't approve.",
  viewer: "Read-only. Sees every email and the calendar. Can send feedback.",
};

export type Perm = { role: Role; ministries: string[] };
export type Me = Perm & { userId: string; email: string; name: string | null };

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as string[]).includes(v);
export const canBuild = (p: Perm) => p.role !== "viewer";
export const canBuildIn = (p: Perm, ministry: string) => p.role === "owner" || p.role === "admin" || p.role === "approver" || (p.role === "editor" && p.ministries.includes(ministry));
export const canApprove = (p: Perm) => p.role === "owner" || p.role === "admin" || p.role === "approver";
export const canManageTeam = (p: Perm) => p.role === "owner" || p.role === "admin";
// Analytics: everyone signed in can read it. Editors see their own ministries; individual-level detail (who opened, who clicked) is for the Owner and Admins.
export const analyticsMinistries = (p: Perm): string[] | null => (p.role === "editor" ? p.ministries : null);
export const canSeePeopleStats = (p: Perm) => p.role === "owner" || p.role === "admin";
export const canSeeFeedback = (p: Perm) => p.role === "owner" || p.role === "admin";
export const canEditRoster = (p: Perm) => p.role === "owner" || p.role === "admin" || p.role === "approver" || (p.role === "editor" && p.ministries.includes("missions"));
// Which roles this person may hand out, and whose role they may change.
export const rolesICanGrant = (p: Perm): Role[] => (p.role === "owner" ? ["admin", "approver", "editor", "viewer"] : p.role === "admin" ? ["approver", "editor", "viewer"] : []);
export const canManageTarget = (actor: Role, target: Role) => (actor === "owner" ? target !== "owner" : actor === "admin" ? target === "approver" || target === "editor" || target === "viewer" : false);

