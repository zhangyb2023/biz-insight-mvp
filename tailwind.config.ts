import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12221e",
        moss: "#3d6b55",
        mint: "#cfe6d4",
        sand: "#f5f1e8",
        ember: "#c8643b"
      },
      boxShadow: {
        panel: "0 18px 60px rgba(18, 34, 30, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
