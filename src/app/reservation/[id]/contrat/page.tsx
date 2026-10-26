import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { WizardShell } from "@/components/wizard/WizardShell";
import { SignaturePad } from "@/components/forms/SignaturePad";
import { stepIndexForSegment } from "@/lib/wizard";
import { buildContractLines, contractParamsFor } from "@/lib/providers/signature/contract-text";

export default async function ContratPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getCurrentClientId();
  if (!clientId) redirect(`/login?callbackUrl=/reservation/${id}/contrat`);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { client: true, trailer: true, contract: true },
  });
  if (!reservation || reservation.clientId !== clientId) notFound();
  if (reservation.status !== "pending") redirect(`/reservation/${id}/confirmation`);
  if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate || !reservation.usageLocation) {
    redirect(`/reservation/${id}/remorque-dates`);
  }

  // The same mapping as the PDF, so the page and the signed copy show the same contract.
  const contractLines = buildContractLines(
    contractParamsFor({
      ...reservation,
      trailer: reservation.trailer,
      pickupDate: reservation.pickupDate,
      returnDate: reservation.returnDate,
    }),
  );

  return (
    <WizardShell step={stepIndexForSegment("contrat")}>
      <SignaturePad
        reservationId={id}
        contractLines={contractLines}
        defaultSignerName={`${reservation.client.firstName} ${reservation.client.lastName}`}
        initialPdfUrl={reservation.contract?.pdfUrl ?? null}
      />
    </WizardShell>
  );
}
