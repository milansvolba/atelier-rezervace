import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        free: "#F1EFE8",
        booked: "#5DCAA5",
        pending: "#FAC775",
        rental: "#F0997B",
        // Sladěno s brand paletou hlavního webu ateliernapobrezi.cz (styles.css)
        brand: {
          bg: "#f2f2f0",
          bgAlt: "#ffffff",
          ink: "#1c1c1c",
          inkSoft: "#57615c",
          accent: "#d3a53c",
          accentSoft: "#f0dba9",
          sea: "#2f4a4a",
          navy: "#141d33",
          line: "#e3e3e1",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-work-sans)", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
