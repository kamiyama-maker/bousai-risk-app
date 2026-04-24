import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1c1d1f",
        paper: "#f5f3ee",
        navy: "#e88545",
        accent: "#ffffff",
        danger: "#b33a3a",
        warn: "#d07d2a",
        ok: "#3e8e5a",
      },
      fontFamily: {
        sans: [
          "Noto Sans JP",
          "Hiragino Sans",
          "Yu Gothic",
          "Meiryo",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
