import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070709",
          900: "#0d0d11",
          800: "#17171e",
          700: "#262631",
          600: "#3c3c4c",
        },
        paper: {
          50: "#fcfbf7",
          100: "#f6f3ea",
          200: "#ebe5d5",
          300: "#d9cfb8",
        },
        crimson: {
          500: "#e11d48",
          600: "#be123c",
        },
        court: {
          500: "#ea580c",
          400: "#fb923c",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sfx: ["var(--font-sfx)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        manga: "5px 5px 0px 0px #09090b",
        "manga-sm": "3px 3px 0px 0px #09090b",
        "manga-lg": "8px 8px 0px 0px #09090b",
        "manga-light": "5px 5px 0px 0px #f6f3ea",
        "manga-crimson": "5px 5px 0px 0px #e11d48",
      },
    },
  },
  plugins: [],
};

export default config;
