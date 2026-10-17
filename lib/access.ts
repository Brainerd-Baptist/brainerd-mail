// Who may sign in. For now jking@ is the only admin; anyone else is turned away.
// To add people later, add them to the staff table (or this list) with a role.
export const ADMIN_EMAILS = ["jking@brainerdbaptist.org"];
export const isAdminEmail = (e?: string | null) => !!e && ADMIN_EMAILS.includes(e.toLowerCase());
