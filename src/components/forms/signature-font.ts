import { Dancing_Script } from "next/font/google";

// The handwriting a typed name is set in. It is drawn on a canvas, so the family is read from
// `signatureFont.style.fontFamily` instead of applying a class, and it is not preloaded: the file is only
// fetched when someone chooses to type their name. Accents and Vietnamese letters are covered.
export const signatureFont = Dancing_Script({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: "600",
  display: "swap",
  preload: false,
});
