import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfText } from "@/lib/pdf-text";

async function helvetica() {
  const doc = await PDFDocument.create();
  return doc.embedFont(StandardFonts.Helvetica);
}

describe("text for a PDF", () => {
  it("keeps French text exactly as it is", () => {
    for (const text of ["Marie Tremblay", "Zoë Côté", "Lévis (Québec) G6Z 1C5", "Dépôt de 1 000 $ — « garantie » ‘ok’ “ok” …", "Œuvre • 5 € ™"]) {
      assert.equal(pdfText(text), text);
    }
  });

  it("turns names the font cannot draw into their plain letters", () => {
    assert.equal(pdfText("Nguyễn Văn Đặng"), "Nguyen Van Dang");
    assert.equal(pdfText("Łukasz Wiśniewski"), "Lukasz Wisniewski");
    assert.equal(pdfText("Şerban Ćirić"), "Serban Ciric");
    assert.equal(pdfText("İstanbul"), "Istanbul");
  });

  it("uses a question mark for what has no equivalent (other alphabets, emoji)", () => {
    assert.equal(pdfText("Игорь"), "?????");
    assert.equal(pdfText("Jean 😀"), "Jean ?");
    assert.equal(pdfText("李"), "?");
  });

  it("turns every kind of space and line break into one plain space", () => {
    assert.equal(pdfText("a b c\nd\te\r\nf"), "a b c d e  f");
  });

  it("turns typographic hyphens and arrows into plain characters", () => {
    assert.equal(pdfText("Saint‑Joseph − 5"), "Saint-Joseph - 5");
    assert.equal(pdfText("Lévis → Québec"), "Lévis -> Québec");
  });

  it("drops invisible and control characters", () => {
    assert.equal(pdfText("a​b\u0000c­d\u007fe"), "abcde");
  });

  // The guarantee that matters: whatever is typed, the font can draw the result (pdf-lib throws otherwise).
  it("always gives text the PDF font can encode", async () => {
    const font = await helvetica();
    const codePoints: number[] = [];
    for (let code = 0; code <= 0x2fff; code++) codePoints.push(code);
    for (let code = 0xd800; code <= 0xdfff; code += 7) codePoints.push(code);
    for (let code = 0x1f300; code <= 0x1f64f; code++) codePoints.push(code);
    codePoints.push(0xfeff, 0xfffd, 0x10ffff);
    for (const code of codePoints) {
      const out = pdfText(String.fromCodePoint(code));
      assert.doesNotThrow(() => font.encodeText(out), `U+${code.toString(16)}`);
    }
    const nasty = "Nguyễn\nŁukasz\t😀 Игорь  → ‑ \u0000 ﷽";
    assert.doesNotThrow(() => font.widthOfTextAtSize(pdfText(nasty), 10));
  });

  it("is gentle on the original: the plain text is unchanged by a second pass", () => {
    const once = pdfText("Nguyễn Łukasz 😀 a b");
    assert.equal(pdfText(once), once);
  });
});
