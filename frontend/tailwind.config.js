/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-tint": "#4d44e3",
        "primary-container": "#0f0069",
        "on-primary": "#ffffff",
        "secondary": "#006a61",
        "secondary-fixed": "#89f5e7",
        "on-secondary-fixed": "#00201d",
        "tertiary-container": "#07006c",
        "on-tertiary-container": "#7073ff",
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "surface": "#faf8ff",
        "on-surface": "#131b2e",
        "surface-variant": "#dae2fd",
        "on-surface-variant": "#45464d",
        "surface-container-highest": "#dae2fd",
        "surface-container-high": "#e2e7ff",
        "surface-container": "#eaedff",
        "surface-container-low": "#f2f3ff",
        "surface-container-lowest": "#ffffff",
        "surface-dim": "#d2d9f4",
        "outline": "#76777d",
        "outline-variant": "#c6c6cd"
      },
      fontFamily: {
        headline: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      }
    },
  },
  plugins: [],
}

