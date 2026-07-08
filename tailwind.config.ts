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
      },
    },
  },
  plugins: [],
};
export default config;
