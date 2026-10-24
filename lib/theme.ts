// Brainerd standard look (2026-10-24): "Daylight" and "Midnight" glass, the
// same two looks as the Personnel dashboard. The user picks a MODE —
// auto (follow the device), light, or dark. The mode is resolved to a
// concrete theme and written to <html data-theme="light|dark"> (plus
// data-theme-mode="auto|light|dark" so menus can show the choice).
// Everything in globals.css and Tailwind resolves through CSS custom
// properties keyed to data-theme.
export const THEME_MODES = [
  { id: "auto", label: "Auto", description: "Match this device's light or dark setting." },
  { id: "light", label: "Light", description: "Daylight: frosted white glass." },
  { id: "dark", label: "Dark", description: "Midnight: frosted glass over a dark gradient." },
] as const;

export type ThemeMode = (typeof THEME_MODES)[number]["id"];
export type ThemeId = "light" | "dark";
export const DEFAULT_MODE: ThemeMode = "auto";
export const THEME_STORAGE_KEY = "brainerd-mail-theme-mode";

export function isValidMode(id: string | null | undefined): id is ThemeMode {
  return id === "auto" || id === "light" || id === "dark";
}

export function systemTheme(): ThemeId {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getMode(): ThemeMode {
  if (typeof document === "undefined") return DEFAULT_MODE;
  const m = document.documentElement.getAttribute("data-theme-mode");
  return isValidMode(m) ? m : DEFAULT_MODE;
}

export function applyMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved: ThemeId = mode === "auto" ? systemTheme() : mode;
  const root = document.documentElement;
  root.setAttribute("data-theme-mode", mode);
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Private browsing / storage disabled — the choice just won't persist.
  }
}

// THEME_INIT_SCRIPT — inlined as a blocking <script> in app/layout.tsx's
// <head> so the right theme applies before first paint (no flash). It also
// listens for the device switching light/dark and re-resolves whenever the
// mode is "auto", so a phone flipping to dark at sunset updates live.
export const THEME_INIT_SCRIPT = `
(function () {
  var KEY = "brainerd-mail-theme-mode";
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function mode() {
    try {
      var m = localStorage.getItem(KEY);
      if (m === "light" || m === "dark" || m === "auto") return m;
    } catch (e) {}
    return "auto";
  }
  function apply() {
    var m = mode();
    var t = m === "auto" ? (mq && mq.matches ? "dark" : "light") : m;
    root.setAttribute("data-theme-mode", m);
    root.setAttribute("data-theme", t);
    root.style.colorScheme = t;
  }
  apply();
  if (mq) {
    var onChange = function () { if (root.getAttribute("data-theme-mode") === "auto") apply(); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
`;
