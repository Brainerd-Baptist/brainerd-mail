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
        line:    withOpacity("--color-line"),
        mist:    withOpacity("--color-mist"),
        ink:     withOpacity("--color-ink"),
        muted:   withOpacity("--color-muted"),
        surface: withOpacity("--color-surface"),
      } as any,
      fontFamily: {
        sans:  ["Georgia", '"Times New Roman"', "serif"],
        serif: ["Georgia", '"Times New Roman"', "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
