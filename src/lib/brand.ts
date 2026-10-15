// Brand colors for places that cannot read the CSS variables (emails, PWA metadata).
// Keep in sync with :root in src/app/globals.css — that file is the source of truth
// for everything rendered by the website itself.
export const BRAND = {
  navy: "#005f9b", // PANTONE P 107-7 C (screen value of the official logo)
  navyDark: "#004c7c", // pressed / hover state of the primary color
  accent: "#009dde", // PANTONE P 112-7 C
  text: "#1b2733",
  muted: "#5f6b75",
} as const;
