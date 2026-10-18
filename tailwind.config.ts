import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/calendar.ts"],
  theme: {
    extend: {
      colors: {
        navy: "#00205b",
        brand: "#1e61b9",
        line: "#dbe3ec",
        mist: "#f1f5f9",
        ink: "#1b2a41",
        muted: "#5b6b80",
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        serif: ['"Source Serif 4"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
