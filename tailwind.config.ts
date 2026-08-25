import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        urgency: {
          normal: "#3b82f6",   // blue
          warning: "#f59e0b",  // amber
          critical: "#ef4444", // red
          expired: "#9ca3af",  // gray
        },
      },
    },
  },
  plugins: [],
};

export default config;
