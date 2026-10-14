import { getStorage } from "@/lib/providers/storage";
import type { EmailAttachment } from "./types";

// Contracts are stored privately and referenced as "/api/files/<path>"; reading
// them back from storage lets us attach the signed PDF to the client's email
// (the protected link itself can't be opened by a guest without an account).
export async function loadContractAttachment(pdfUrl: string | null | undefined): Promise<EmailAttachment | null> {
  if (!pdfUrl) return null;
  const path = pdfUrl
    .replace(/^\/api\/files\//, "")
    .split("/")
    .map(decodeURIComponent)
    .join("/");
  try {
    const content = await getStorage().read(path);
    return { filename: "Contrat-de-location-IceBox.pdf", content, contentType: "application/pdf" };
  } catch (error) {
    console.error("Could not load contract PDF for email attachment", error);
    return null;
  }
}
