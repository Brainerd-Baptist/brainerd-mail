// Sign-in rules. Only church Google accounts can ever sign in; who gets in, and as what,
// is decided by the staff table (roles) and invites. The owner address below is always let in as Owner.
export const OWNER_EMAIL = "jking@brainerdbaptist.org";
export const CHURCH_DOMAIN = "brainerdbaptist.org";
export const isOwnerEmail = (e?: string | null) => !!e && e.toLowerCase() === OWNER_EMAIL;
export const isChurchEmail = (e?: string | null) => !!e && /^[^@\s]+@brainerdbaptist\.org$/i.test(e.trim());
