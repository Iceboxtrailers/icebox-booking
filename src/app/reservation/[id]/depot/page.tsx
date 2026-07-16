import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { WizardShell } from "@/components/wizard/WizardShell";
import { DepositForm } from "@/components/forms/DepositForm";
import { stepIndexForSegment } from "@/lib/wizard";

export default async function DepotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getCurrentClientId();
  if (!clientId) redirect(`/login?callbackUrl=/reservation/${id}/depot`);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { contract: true },
  });
  if (!reservation || reservation.clientId !== clientId) notFound();
  if (reservation.status !== "pending") redirect(`/reservation/${id}/confirmation`);
  if (reservation.contract?.signatureStatus !== "signed") redirect(`/reservation/${id}/contrat`);

  return (
    <WizardShell step={stepIndexForSegment("depot")}>
      <DepositForm reservationId={id} initiallyAuthorized={reservation.depositStatus === "authorized"} />
    </WizardShell>
  );
}
