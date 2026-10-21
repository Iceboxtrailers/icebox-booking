// Text for a PDF drawn with one of the built-in fonts. Those fonts only know the Windows-1252 ("WinAnsi")
// characters, and pdf-lib throws on any other: a client named "Nguyễn" or "Łukasz", an address pasted with
// a non-breaking hyphen, an emoji or a line break would make the contract (or the owner's report) fail
// instead of being drawn. This keeps what can be kept, turns the rest into its closest plain letters, and
// uses "?" for what has no equivalent (other alphabets).

// Beyond Latin-1, the characters Windows-1252 adds.
const WIN_ANSI_EXTRA = "ŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™";

const REPLACEMENTS: Record<string, string> = {
  // hyphens, minus, dashes
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "―": "-",
  "−": "-",
  // apostrophes and primes
  "ʼ": "'",
  "′": "'",
  "″": '"',
  // arrows
  "→": "->",
  "←": "<-",
  // letters that do not decompose into a base letter and an accent
  "Ł": "L",
  "ł": "l",
  "Đ": "D",
  "đ": "d",
  "Ħ": "H",
  "ħ": "h",
  "ı": "i",
  // invisible characters
  "­": "",
  "​": "",
  "‌": "",
  "‍": "",
  "﻿": "",
};

function isWinAnsi(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff) || WIN_ANSI_EXTRA.includes(char);
}

export function pdfText(value: string): string {
  let out = "";
  for (const char of value.normalize("NFC")) {
    // Every kind of space and line break becomes one plain space (pdf-lib cannot draw a line break).
    if (/\s/u.test(char)) {
      out += " ";
    } else if (/\p{Cc}/u.test(char)) {
      continue;
    } else if (Object.hasOwn(REPLACEMENTS, char)) {
      out += REPLACEMENTS[char];
    } else if (isWinAnsi(char)) {
      out += char;
    } else {
      // "ễ" -> "e", "ć" -> "c": the letter without its accents, if that is something the font has.
      const base = char.normalize("NFD").replace(/\p{M}/gu, "");
      out += base && [...base].every(isWinAnsi) ? base : "?";
    }
  }
  return out;
}
