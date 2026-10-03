import type { Config } from "tailwindcss";

// Make Time To Move brand (guidelines v1.0): Strength theme — Bone on Ink,
// Stone for secondary text. Square corners, hairline rules, no shadows.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E0E0D",
        bone: "#EFEBE3",
        stone: "#8F8B83",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        // MTTM Lettering: capitals, spacing built in (letter-spacing 0).
        display: ["var(--font-mttm)", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "1px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
        "2xl": "2px",
      },
    },
  },
  plugins: [],
};
export default config;
