import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { pdfText } from "@/lib/pdf-text";

// The fonts of the contract, as the owner's revised contract (27 October 2026) sets them: Bungee, the brand's
// display font, for the titles and DejaVu Sans for the text. The files sit next to this one (licences included).
export const CONTRACT_FONT_DIR = path.join(process.cwd(), "src/lib/providers/signature/fonts");

export type ContractFonts = {
  body: PDFFont;
  bold: PDFFont;
  // Titles and headings.
  display: PDFFont;
  // Text the fonts can draw: what they cannot (an emoji in a name, another alphabet) becomes a plain letter or "?"
  // instead of failing the contract.
  clean: (text: string) => string;
  // False when the font files could not be read and the built-in fonts stand in.
  custom: boolean;
};

const bytesCache = new Map<string, Promise<Uint8Array>>();

// A file is read once per process; a failed read is not remembered.
function fontBytes(dir: string, name: string): Promise<Uint8Array> {
  const file = path.join(dir, name);
  let bytes = bytesCache.get(file);
  if (!bytes) {
    bytes = readFile(file);
    bytesCache.set(file, bytes);
    bytes.catch(() => bytesCache.delete(file));
  }
  return bytes;
}

// The reference contract is set without ligatures or kerning: the same here, so a line breaks where it breaks there.
const PLAIN_TEXT = { liga: false, clig: false, kern: false };

// Whitespace other than the no-break space is one plain space; control characters are dropped.
function plainSpaces(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    if (char === "\u00a0") out += char;
    else if (/\s/u.test(char)) out += " ";
    else if (!/\p{Cc}/u.test(char)) out += char;
  }
  return out;
}

export async function loadContractFonts(pdfDoc: PDFDocument, dir = CONTRACT_FONT_DIR): Promise<ContractFonts> {
  try {
    const [bodyBytes, boldBytes, displayBytes] = await Promise.all([
      fontBytes(dir, "DejaVuSans.ttf"),
      fontBytes(dir, "DejaVuSans-Bold.ttf"),
      fontBytes(dir, "Bungee-Regular.ttf"),
    ]);
    pdfDoc.registerFontkit(fontkit);
    // A given name keeps the file the same from one rendering to the next (pdf-lib adds a random one otherwise).
    const embed = (bytes: Uint8Array, customName: string) => pdfDoc.embedFont(bytes, { subset: true, customName, features: PLAIN_TEXT });
    const [body, bold, display] = await Promise.all([
      embed(bodyBytes, "AAAAAA+DejaVuSans"),
      embed(boldBytes, "BBBBBB+DejaVuSans-Bold"),
      embed(displayBytes, "CCCCCC+Bungee-Regular"),
    ]);

    // The text fonts decide: the display font only draws the titles, which are fixed wording.
    const drawable = [body, bold].map((font) => new Set(font.getCharacterSet()));
    const clean = (text: string) => {
      let out = "";
      for (const char of plainSpaces(text)) {
        const code = char.codePointAt(0) ?? 0;
        if (drawable.every((set) => set.has(code))) {
          out += char;
          continue;
        }
        // "ễ" -> "e": the letter without its accents, if the fonts have it.
        const base = char.normalize("NFD").replace(/\p{M}/gu, "");
        out += base && [...base].every((c) => drawable.every((set) => set.has(c.codePointAt(0) ?? 0))) ? base : "?";
      }
      return out;
    };
    return { body, bold, display, clean, custom: true };
  } catch (error) {
    // The contract matters more than its looks: without the files it is still made, in the built-in fonts.
    console.error("Contract fonts could not be loaded, using the built-in fonts", error);
    const [body, bold] = await Promise.all([pdfDoc.embedFont(StandardFonts.Helvetica), pdfDoc.embedFont(StandardFonts.HelveticaBold)]);
    return { body, bold, display: bold, clean: (text) => pdfText(text.replaceAll("☐", "[ ]")), custom: false };
  }
}
