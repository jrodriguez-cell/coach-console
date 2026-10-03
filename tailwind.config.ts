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
        // MTTM Lettering is the brand display face; Michroma is the guide's
        // documented stand-in until the font files are added.
        display: ["MTTM Lettering", "var(--font-michroma)", "Arial Black", "sans-serif"],
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
