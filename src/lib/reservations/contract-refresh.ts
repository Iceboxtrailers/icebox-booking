import { prisma } from "@/lib/prisma";
import { getSignatureProvider } from "@/lib/providers/signature";

// "none": no contract was made yet. "regenerated": the unsigned contract was made again with the new terms.
// "cleared": it could not be made again, so the old file was dropped rather than left to be sent. "signed_outdated":
// the client already signed; that copy stays as it was and no longer matches the booking.
export type ContractRefresh = "none" | "regenerated" | "cleared" | "signed_outdated";

// The contract is a picture of the terms (trailer, dates, price, transport). After staff change them, an unsigned
// contract that was already made is made again, so nobody prints or sends an old one; a signed one is never touched.
export async function refreshContractAfterTermsChange(reservationId: string): Promise<ContractRefresh> {
  const contract = await prisma.contract.findUnique({ where: { reservationId } });
  if (!contract?.pdfUrl) return "none";
  if (contract.signatureStatus === "signed") return "signed_outdated";
  try {
    await getSignatureProvider().generateContract({ reservationId });
    return "regenerated";
  } catch (error) {
    console.error("Contract could not be made again after a change", error);
    await prisma.contract.update({ where: { reservationId }, data: { pdfUrl: null } });
    return "cleared";
  }
}
