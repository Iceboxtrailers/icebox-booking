import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { WizardShell } from "@/components/wizard/WizardShell";
import { SignaturePad } from "@/components/forms/SignaturePad";
import { stepIndexForSegment } from "@/lib/wizard";
import { buildContractText } from "@/lib/providers/signature/contract-text";

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
  if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate) {
    redirect(`/reservation/${id}/remorque-dates`);
  }

  const start = reservation.pickupDate.toISOString().slice(0, 10);
  const end = reservation.returnDate.toISOString().slice(0, 10);
  const contractText = buildContractText({
    firstName: reservation.client.firstName,
    lastName: reservation.client.lastName,
    trailerType: reservation.trailer.type,
    trailerSize: reservation.trailer.size,
    start,
    end,
    dailyRateCents: reservation.trailer.dailyRate,
    totalCents: reservation.totalAmount,
  });

  return (
    <WizardShell step={stepIndexForSegment("contrat")}>
      <SignaturePad
        reservationId={id}
        contractText={contractText}
        defaultSignerName={`${reservation.client.firstName} ${reservation.client.lastName}`}
        initialPdfUrl={reservation.contract?.pdfUrl ?? null}
      />
    </WizardShell>
  );
}
