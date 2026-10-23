export const THEMES = [
  { id: "light", label: "Light", description: "Clean and bright — the default." },
  { id: "dark",  label: "Dark",  description: "Easy on the eyes in low light." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "light";
export const THEME_STORAGE_KEY = "brainerd-mail-theme";

export function isValidTheme(id: string | null): id is ThemeId {
  return id === "light" || id === "dark";
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
  try { window.localStorage.setItem(THEME_STORAGE_KEY, id); } catch {}
}

/** Blocking inline script — put in <head> before any stylesheet to prevent flash. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem("brainerd-mail-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;
