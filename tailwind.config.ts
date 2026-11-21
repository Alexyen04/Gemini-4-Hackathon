import type { Config } from "tailwindcss";

// Dunkoma "Court Orange" palette, shared with the landing page (web/src/styles/tokens.css).
const PAPER = "#F4EEE2";
const INK = "#16130F";
const TONE = "#A39E93";
const ACCENT = "#FF5A1F";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // sharp corners only
    borderRadius: { none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0", full: "9999px" },
    extend: {
      colors: {
        ink: { 950: INK, 900: INK, 800: "#2A2620", 700: "#4A453D", 600: "#6E685E" },
        paper: { 50: PAPER, 100: PAPER, 200: "#E8E0D0", 300: TONE },
        tone: TONE,
        // legacy accent names → the one accent
        crimson: { 500: ACCENT, 600: ACCENT },
        court: { 500: ACCENT, 400: ACCENT },
        amber: { 300: ACCENT },
        emerald: { 300: PAPER, 600: INK, 700: INK, 950: INK },
        white: PAPER,
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sfx: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        manga: `4px 4px 0 0 ${INK}`,
        "manga-sm": `3px 3px 0 0 ${INK}`,
        "manga-lg": `8px 8px 0 0 ${INK}`,
        "manga-light": `4px 4px 0 0 ${PAPER}`,
        "manga-crimson": `4px 4px 0 0 ${ACCENT}`,
      },
    },
  },
  plugins: [],
};

export default config;
