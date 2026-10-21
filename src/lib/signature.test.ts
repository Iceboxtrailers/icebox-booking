import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MIN_TYPED_SIGNATURE_LENGTH, isTypedSignatureValid, typedSignatureText } from "@/lib/signature";
import { signContractSchema } from "@/lib/validation";

describe("typed signature", () => {
  it("is the name as written, without stray spaces", () => {
    assert.equal(typedSignatureText("  Marie   Tremblay "), "Marie Tremblay");
    assert.equal(typedSignatureText("Jean\tPaul\nTremblay"), "Jean Paul Tremblay");
    assert.equal(typedSignatureText("   "), "");
  });

  it("needs a few letters, not spaces and not a single one", () => {
    assert.equal(isTypedSignatureValid(""), false);
    assert.equal(isTypedSignatureValid("   "), false);
    assert.equal(isTypedSignatureValid("x"), false);
    assert.equal(isTypedSignatureValid("Al"), false);
    assert.equal(isTypedSignatureValid("Ali"), true);
    assert.equal(isTypedSignatureValid("  Ali  "), true);
    assert.equal(MIN_TYPED_SIGNATURE_LENGTH, 3);
  });
});

describe("signing request", () => {
  const image = "data:image/png;base64,iVBORw0KGgo=";

  it("a drawn signature is the default, for pages that do not say how the client signed", () => {
    const parsed = signContractSchema.safeParse({ signerName: "Marie Tremblay", signatureImageBase64: image });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.signatureMethod, "drawn");
  });

  it("accepts a typed signature with a real name", () => {
    const parsed = signContractSchema.safeParse({ signerName: "Marie Tremblay", signatureImageBase64: image, signatureMethod: "typed" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.signatureMethod, "typed");
  });

  it("refuses a typed signature that is too short to be a name", () => {
    const parsed = signContractSchema.safeParse({ signerName: "  x ", signatureImageBase64: image, signatureMethod: "typed" });
    assert.equal(parsed.success, false);
    assert.equal(parsed.error?.issues[0]?.message, "Tapez votre nom complet pour signer");
    // The same short name is fine for a drawn signature: the drawing is the signature.
    assert.equal(signContractSchema.safeParse({ signerName: "x", signatureImageBase64: image, signatureMethod: "drawn" }).success, true);
  });

  it("refuses an unknown method, a missing image, an oversized image and a name that is too long", () => {
    const base = { signerName: "Marie Tremblay", signatureImageBase64: image };
    assert.equal(signContractSchema.safeParse({ ...base, signatureMethod: "stamp" }).success, false);
    assert.equal(signContractSchema.safeParse({ signerName: "Marie Tremblay", signatureImageBase64: "" }).success, false);
    assert.equal(signContractSchema.safeParse({ ...base, signatureImageBase64: "x".repeat(500_000) }).success, false);
    assert.equal(signContractSchema.safeParse({ ...base, signerName: "a".repeat(121) }).success, false);
  });
});
