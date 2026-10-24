import type { Config } from "tailwindcss";

function withOpacity(variableName: string) {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue === undefined) return `rgb(var(${variableName}))`;
    return `rgb(var(${variableName}) / ${opacityValue})`;
  };
}

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/calendar.ts"],
  theme: {
    extend: {
      colors: {
        navy:    withOpacity("--color-navy"),
        brand:   withOpacity("--color-brand"),
        "brand-soft": withOpacity("--color-brand-soft"),
        line:    withOpacity("--color-line"),
        mist:    withOpacity("--color-mist"),
        ink:     withOpacity("--color-ink"),
        muted:   withOpacity("--color-muted"),
        surface: withOpacity("--color-surface"),
      } as any,
      fontFamily: {
        sans:  ["ui-sans-serif", "system-ui", "sans-serif", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"],
        serif: ["ui-sans-serif", "system-ui", "sans-serif", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"],
      },
    },
  },
  plugins: [],
};
export default config;
