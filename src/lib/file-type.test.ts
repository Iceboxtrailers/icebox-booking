import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectFileType, isPng } from "@/lib/file-type";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bytes = (...parts: (number[] | string)[]) =>
  Buffer.concat(parts.map((part) => (typeof part === "string" ? Buffer.from(part, "ascii") : Buffer.from(part))));

describe("what an uploaded file really is", () => {
  it("recognises the four formats the site accepts from their first bytes", () => {
    assert.deepEqual(detectFileType(bytes(PNG, [0, 0, 0, 13])), { mime: "image/png", ext: "png" });
    assert.deepEqual(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16])), { mime: "image/jpeg", ext: "jpg" });
    assert.deepEqual(detectFileType(bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 ")), { mime: "image/webp", ext: "webp" });
    assert.deepEqual(detectFileType(bytes("%PDF-1.7\n")), { mime: "application/pdf", ext: "pdf" });
  });

  it("does not take a RIFF file that is not a WebP image for one", () => {
    assert.equal(detectFileType(bytes("RIFF", [0x24, 0, 0, 0], "WAVEfmt ")), null);
  });

  it("does not trust a file that only looks like one at a glance", () => {
    assert.equal(detectFileType(bytes("%PDF")), null);
    assert.equal(detectFileType(bytes(PNG.slice(0, 7))), null);
    assert.equal(detectFileType(bytes([0xff, 0xd8])), null);
    // A JPEG starts with the three bytes FF D8 FF, not just one or two of them.
    assert.equal(detectFileType(bytes([0xff, 0xd9, 0xff, 0xe0])), null);
    assert.equal(detectFileType(bytes([0xff, 0xd8, 0x00, 0xe0])), null);
    assert.equal(detectFileType(bytes([0x00, 0xd8, 0xff, 0xe0])), null);
  });

  it("rejects what a visitor could hide behind an image name: web pages, scripts, vector images, empty files", () => {
    for (const content of ["<html><script>alert(1)</script></html>", "<svg xmlns='http://www.w3.org/2000/svg'></svg>", "GIF89a....", "MZ\x90\x00", "", "plain text"]) {
      assert.equal(detectFileType(bytes(content)), null, JSON.stringify(content));
    }
  });
});

describe("isPng", () => {
  it("needs the whole eight-byte signature", () => {
    assert.equal(isPng(bytes(PNG)), true);
    assert.equal(isPng(bytes(PNG.slice(0, 7))), false);
    assert.equal(isPng(bytes("\x89PNG\r\n\x1a\x0b")), false);
  });
});
