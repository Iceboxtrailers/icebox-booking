import { StubSignatureProvider } from "./stub";
import type { SignatureProvider } from "./types";

export type { SignatureProvider };

let instance: SignatureProvider | null = null;

export function getSignatureProvider(): SignatureProvider {
  if (!instance) {
    instance = new StubSignatureProvider();
  }
  return instance;
}
