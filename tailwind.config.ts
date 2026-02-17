import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-montserrat)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "Apple Color Emoji",
          "Segoe UI Emoji"
        ]
      },
      colors: {
        ink: {
          50: "#f6f7f8",
          100: "#eceff1",
          200: "#d7dde1",
          300: "#b4c0ca",
          400: "#7f94a3",
          500: "#566d7b",
          600: "#425863",
          700: "#344750",
          800: "#29383f",
          900: "#1d262b",
          950: "#0f1518"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15,21,24,.12)"
      },
      keyframes: {
        "kb-zoom": {
          "0%": { transform: "scale(1) translateZ(0)" },
          "100%": { transform: "scale(1.12) translateZ(0)" }
        }
      },
      animation: {
        "kb-zoom": "kb-zoom 14s ease-in-out infinite alternate"
      }
    }
  },
  plugins: []
};

export default config;
