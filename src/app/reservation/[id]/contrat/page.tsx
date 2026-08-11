import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { WizardShell } from "@/components/wizard/WizardShell";
import { SignaturePad } from "@/components/forms/SignaturePad";
import { stepIndexForSegment } from "@/lib/wizard";
import { buildContractLines } from "@/lib/providers/signature/contract-text";
import type { TrailerSize } from "@/lib/constants";

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
  const contractLines = buildContractLines({
    firstName: reservation.client.firstName,
    lastName: reservation.client.lastName,
    company: reservation.client.company,
    email: reservation.client.email,
    phone: reservation.client.phone,
    trailerSize: reservation.trailer.size as TrailerSize,
    start,
    end,
    totalCents: reservation.totalAmount,
    billingAddress: reservation.client.billingAddress,
    billingCity: reservation.client.billingCity,
    billingProvince: reservation.client.billingProvince,
    billingPostalCode: reservation.client.billingPostalCode,
  });

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
