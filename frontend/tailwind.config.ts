import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        error: "var(--error)",
        "error-hover": "var(--error-hover)",
        "error-light": "var(--error-light)",
        border: "var(--border)",
      },
      ringColor: {
        primary: "var(--primary)",
      },
    },
  },
  plugins: [],
} satisfies Config;
